import os
import re
import uuid
import json
from datetime import datetime, timezone
from typing import List, Optional
import uvicorn

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import Client, create_client

load_dotenv()


def utc_now_iso() -> str:
	return datetime.now(timezone.utc).isoformat()


def new_uuid() -> str:
	return str(uuid.uuid4())


def parse_origins(raw_value: str) -> List[str]:
	if not raw_value:
		return ["*"]

	values = [item.strip() for item in raw_value.split(",") if item.strip()]
	return values if values else ["*"]


SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "").strip()
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "Notes").strip() or "Notes"
ALLOWED_ORIGINS = parse_origins(os.getenv("ALLOWED_ORIGINS", "*"))

SUPABASE_BACKEND_KEY = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_BACKEND_KEY:
	supabase = create_client(SUPABASE_URL, SUPABASE_BACKEND_KEY)

auth_supabase: Optional[Client] = None
if SUPABASE_URL and (SUPABASE_ANON_KEY or SUPABASE_KEY):
	auth_supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_KEY)

app = FastAPI(
	title="NeuroAdapt (prototype) API",
	version="1.0.0",
	description="NeuroAdapt (prototype): FastAPI + Supabase backend for notes, versions, AI rewrite jobs, and auth.",
)

app.add_middleware(
	CORSMiddleware,
	allow_origins=ALLOWED_ORIGINS,
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


class NoteCreateIn(BaseModel):
	title: str = Field(default="Untitled", max_length=200)
	content: str = Field(default="")


class NoteUpdateIn(BaseModel):
	title: Optional[str] = Field(default=None, max_length=200)
	content: Optional[str] = Field(default=None)
	is_archived: Optional[bool] = Field(default=None)


class RewriteRequestIn(BaseModel):
	instructions: Optional[str] = Field(default=None, max_length=1000)


class AuthSignUpIn(BaseModel):
	email: str = Field(min_length=5, max_length=320)
	password: str = Field(min_length=6, max_length=128)


class AuthLoginIn(BaseModel):
	email: str = Field(min_length=5, max_length=320)
	password: str = Field(min_length=6, max_length=128)


def require_supabase() -> Client:
	if supabase is None:
		raise HTTPException(
			status_code=500,
			detail="Supabase backend client is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (recommended) or SUPABASE_KEY in .env.",
		)

	return supabase


def require_auth_supabase() -> Client:
	if auth_supabase is None:
		raise HTTPException(
			status_code=500,
			detail="Supabase auth client is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_KEY).",
		)

	return auth_supabase


def parse_bearer_token(authorization: Optional[str]) -> Optional[str]:
	if not authorization:
		return None

	parts = authorization.strip().split(" ", 1)
	if len(parts) != 2:
		return None

	scheme, token = parts
	if scheme.lower() != "bearer" or not token.strip():
		return None

	return token.strip()


def resolve_user_id(authorization: Optional[str]) -> str:
	client = require_auth_supabase()
	bearer_token = parse_bearer_token(authorization)
	if not bearer_token:
		raise HTTPException(status_code=401, detail="Missing Authorization bearer token.")

	try:
		user_response = client.auth.get_user(bearer_token)
	except Exception as exc:  # noqa: BLE001
		raise HTTPException(status_code=401, detail="Invalid or expired access token.") from exc

	user = getattr(user_response, "user", None)
	user_id = getattr(user, "id", None)
	if not user_id:
		raise HTTPException(status_code=401, detail="Could not resolve user from access token.")

	return str(user_id)


def validate_uuid(value: str, field_name: str) -> str:
	try:
		uuid.UUID(value)
		return value
	except ValueError as exc:
		raise HTTPException(status_code=400, detail=f"{field_name} must be a valid UUID.") from exc


def fetch_note_for_user(client: Client, note_id: str, user_id: str) -> dict:
	response = (
		client.table("notes")
		.select("*")
		.eq("id", note_id)
		.eq("user_id", user_id)
		.eq("is_deleted", False)
		.limit(1)
		.execute()
	)

	if not response.data:
		raise HTTPException(status_code=404, detail="Note not found.")

	return response.data[0]


def upload_note_snapshot_to_bucket(client: Client, note: dict, user_id: str) -> dict:
	if SUPABASE_BACKEND_KEY.startswith("sb_publishable_"):
		raise HTTPException(
			status_code=500,
			detail="Backend storage writes require a service role/secret key. Set SUPABASE_SERVICE_ROLE_KEY in backend .env.",
		)

	note_id = str(note["id"])
	timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
	base_path = f"{user_id}/{note_id}"
	versioned_path = f"{base_path}/{timestamp}.json"
	latest_path = f"{base_path}/latest.json"

	payload = {
		"note_id": note_id,
		"user_id": user_id,
		"title": note.get("title") or "Untitled",
		"content": note.get("content") or "",
		"is_archived": bool(note.get("is_archived")),
		"is_deleted": bool(note.get("is_deleted")),
		"updated_at": note.get("updated_at"),
		"saved_at": utc_now_iso(),
	}

	data_bytes = json.dumps(payload, ensure_ascii=True, indent=2).encode("utf-8")
	storage = client.storage.from_(SUPABASE_BUCKET)

	# Supabase Python client has changed upload signature between versions; try both.
	try:
		storage.upload(versioned_path, data_bytes, {"content-type": "application/json", "upsert": "true"})
	except TypeError:
		storage.upload(
			path=versioned_path,
			file=data_bytes,
			file_options={"content-type": "application/json", "upsert": "true"},
		)

	try:
		storage.upload(latest_path, data_bytes, {"content-type": "application/json", "upsert": "true"})
	except TypeError:
		storage.upload(
			path=latest_path,
			file=data_bytes,
			file_options={"content-type": "application/json", "upsert": "true"},
		)

	return {
		"bucket": SUPABASE_BUCKET,
		"path": latest_path,
		"versioned_path": versioned_path,
	}


def sentence_case(value: str) -> str:
	cleaned = value.strip()
	if not cleaned:
		return ""

	return f"{cleaned[0].upper()}{cleaned[1:]}"


def simulated_ai_rewrite(content: str, instructions: str = "") -> str:
	paragraphs = [chunk.strip() for chunk in re.split(r"\n\s*\n", content or "") if chunk.strip()]

	if not paragraphs:
		base = "Capture one clear idea, one supporting detail, and one concrete next action."
		return f"{base}\n\n{instructions.strip()}" if instructions.strip() else base

	polished: list[str] = []
	for paragraph in paragraphs:
		single_line = re.sub(r"\s+", " ", paragraph).strip()
		refined = sentence_case(single_line)
		if not re.search(r"[.!?]$", refined):
			refined = f"{refined}."
		polished.append(refined)

	if instructions and instructions.strip():
		polished.append(f"AI focus: {instructions.strip()}")

	return "\n\n".join(polished)


def complete_rewrite_job(job_id: str, note_id: str, user_id: str, instructions: str = "") -> None:
	client = require_supabase()

	try:
		note = fetch_note_for_user(client, note_id, user_id)
		updated_content = simulated_ai_rewrite(note.get("content") or "", instructions)
		updated_title = (note.get("title") or "Untitled").strip() or "Untitled"
		now_iso = utc_now_iso()

		(
			client.table("notes")
			.update(
				{
					"title": updated_title,
					"content": updated_content,
					"updated_at": now_iso,
				}
			)
			.eq("id", note_id)
			.eq("user_id", user_id)
			.execute()
		)

		client.table("note_versions").insert({"id": new_uuid(), "note_id": note_id, "content": updated_content}).execute()

		(
			client.table("ai_jobs")
			.update(
				{
					"status": "done",
					"output": updated_content,
					"updated_at": now_iso,
				}
			)
			.eq("id", job_id)
			.execute()
		)
	except Exception as exc:  # noqa: BLE001
		(
			client.table("ai_jobs")
			.update(
				{
					"status": "failed",
					"output": str(exc),
					"updated_at": utc_now_iso(),
				}
			)
			.eq("id", job_id)
			.execute()
		)


@app.get("/health")
def health() -> dict:
	return {
		"ok": True,
		"supabase_configured": bool(SUPABASE_URL and SUPABASE_KEY),
		"bucket": SUPABASE_BUCKET,
	}


@app.post("/auth/signup")
def auth_signup(payload: AuthSignUpIn) -> dict:
	client = require_auth_supabase()

	try:
		response = client.auth.sign_up({"email": payload.email.strip().lower(), "password": payload.password})
	except Exception as exc:  # noqa: BLE001
		raise HTTPException(status_code=400, detail=f"Sign up failed: {str(exc)}") from exc

	user = getattr(response, "user", None)
	session = getattr(response, "session", None)

	return {
		"user": {
			"id": getattr(user, "id", None),
			"email": getattr(user, "email", None),
		},
		"session": {
			"access_token": getattr(session, "access_token", None),
			"refresh_token": getattr(session, "refresh_token", None),
		},
		"message": "Signup successful. If email confirmation is enabled, verify your email before login.",
	}


@app.post("/auth/login")
def auth_login(payload: AuthLoginIn) -> dict:
	client = require_auth_supabase()

	try:
		response = client.auth.sign_in_with_password(
			{"email": payload.email.strip().lower(), "password": payload.password}
		)
	except Exception as exc:  # noqa: BLE001
		raise HTTPException(status_code=401, detail=f"Login failed: {str(exc)}") from exc

	user = getattr(response, "user", None)
	session = getattr(response, "session", None)

	if not session or not getattr(session, "access_token", None):
		raise HTTPException(status_code=401, detail="Login failed: missing access token.")

	return {
		"user": {
			"id": getattr(user, "id", None),
			"email": getattr(user, "email", None),
		},
		"access_token": getattr(session, "access_token", None),
		"refresh_token": getattr(session, "refresh_token", None),
	}


@app.get("/auth/me")
def auth_me(authorization: Optional[str] = Header(default=None, alias="Authorization")) -> dict:
	client = require_auth_supabase()
	bearer_token = parse_bearer_token(authorization)

	if not bearer_token:
		raise HTTPException(status_code=401, detail="Missing Authorization bearer token.")

	try:
		response = client.auth.get_user(bearer_token)
	except Exception as exc:  # noqa: BLE001
		raise HTTPException(status_code=401, detail="Invalid or expired access token.") from exc

	user = getattr(response, "user", None)
	if not user:
		raise HTTPException(status_code=401, detail="Could not resolve user.")

	return {
		"id": getattr(user, "id", None),
		"email": getattr(user, "email", None),
	}


@app.post("/notes")
def create_note(
	payload: NoteCreateIn,
	authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> dict:
	client = require_supabase()
	user_id = resolve_user_id(authorization)
	now_iso = utc_now_iso()

	note_data = {
		"id": new_uuid(),
		"user_id": user_id,
		"title": (payload.title or "Untitled").strip() or "Untitled",
		"content": payload.content or "",
		"is_archived": False,
		"is_deleted": False,
		"created_at": now_iso,
		"updated_at": now_iso,
	}

	try:
		insert_result = client.table("notes").insert(note_data).execute()
	except Exception as exc:  # noqa: BLE001
		error_text = str(exc)
		if "notes_user_id_fkey" in error_text or "Key (user_id)=" in error_text:
			raise HTTPException(
				status_code=400,
				detail="Authenticated user is invalid. Authorization token user must exist in Supabase auth.users.",
			) from exc

		raise HTTPException(status_code=500, detail=f"Could not create note: {error_text}") from exc
	if not insert_result.data:
		raise HTTPException(status_code=500, detail="Could not create note.")

	created_note = insert_result.data[0]
	client.table("note_versions").insert({"id": new_uuid(), "note_id": created_note["id"], "content": created_note["content"]}).execute()

	return created_note


@app.get("/notes")
def list_notes(
	authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> list[dict]:
	client = require_supabase()
	user_id = resolve_user_id(authorization)

	response = (
		client.table("notes")
		.select("*")
		.eq("user_id", user_id)
		.eq("is_deleted", False)
		.order("updated_at", desc=True)
		.execute()
	)
	return response.data or []


@app.get("/notes/{note_id}")
def get_note(
	note_id: str,
	authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> dict:
	client = require_supabase()
	user_id = resolve_user_id(authorization)
	safe_note_id = validate_uuid(note_id, "note_id")
	note = fetch_note_for_user(client, safe_note_id, user_id)
	return note


@app.put("/notes/{note_id}")
def update_note(
	note_id: str,
	payload: NoteUpdateIn,
	authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> dict:
	client = require_supabase()
	user_id = resolve_user_id(authorization)
	safe_note_id = validate_uuid(note_id, "note_id")
	current_note = fetch_note_for_user(client, safe_note_id, user_id)

	updates: dict = {"updated_at": utc_now_iso()}
	content_changed = False

	if payload.title is not None:
		updates["title"] = payload.title.strip() or "Untitled"

	if payload.content is not None:
		updates["content"] = payload.content
		content_changed = payload.content != (current_note.get("content") or "")

	if payload.is_archived is not None:
		updates["is_archived"] = payload.is_archived

	if len(updates) == 1:
		raise HTTPException(status_code=400, detail="No fields to update.")

	(
		client.table("notes")
		.update(updates)
		.eq("id", safe_note_id)
		.eq("user_id", user_id)
		.execute()
	)

	updated_note = fetch_note_for_user(client, safe_note_id, user_id)

	if content_changed:
		client.table("note_versions").insert({"id": new_uuid(), "note_id": safe_note_id, "content": updated_note["content"]}).execute()

	return updated_note


@app.delete("/notes/{note_id}")
def delete_note(
	note_id: str,
	authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> dict:
	client = require_supabase()
	user_id = resolve_user_id(authorization)
	safe_note_id = validate_uuid(note_id, "note_id")
	fetch_note_for_user(client, safe_note_id, user_id)

	(
		client.table("notes")
		.update({"is_deleted": True, "updated_at": utc_now_iso()})
		.eq("id", safe_note_id)
		.eq("user_id", user_id)
		.execute()
	)

	return {"ok": True, "id": safe_note_id}


@app.get("/notes/{note_id}/versions")
def get_note_versions(
	note_id: str,
	authorization: Optional[str] = Header(default=None, alias="Authorization"),
	version_id: Optional[str] = Query(default=None),
) -> dict:
	client = require_supabase()
	user_id = resolve_user_id(authorization)
	safe_note_id = validate_uuid(note_id, "note_id")
	fetch_note_for_user(client, safe_note_id, user_id)

	if version_id:
		safe_version_id = validate_uuid(version_id, "version_id")
		version_response = (
			client.table("note_versions")
			.select("*")
			.eq("id", safe_version_id)
			.eq("note_id", safe_note_id)
			.limit(1)
			.execute()
		)

		if not version_response.data:
			raise HTTPException(status_code=404, detail="Version not found.")

		return {"version": version_response.data[0]}

	list_response = (
		client.table("note_versions")
		.select("*")
		.eq("note_id", safe_note_id)
		.order("created_at", desc=True)
		.execute()
	)

	return {"versions": list_response.data or []}


@app.post("/notes/{note_id}/rewrite")
def create_rewrite_job(
	note_id: str,
	background_tasks: BackgroundTasks,
	payload: RewriteRequestIn,
	authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> dict:
	client = require_supabase()
	user_id = resolve_user_id(authorization)
	safe_note_id = validate_uuid(note_id, "note_id")
	note = fetch_note_for_user(client, safe_note_id, user_id)

	now_iso = utc_now_iso()
	job_insert = (
		client.table("ai_jobs")
		.insert(
			{
				"id": new_uuid(),
				"note_id": safe_note_id,
				"status": "queued",
				"input": note.get("content") or "",
				"output": "",
				"created_at": now_iso,
				"updated_at": now_iso,
			}
		)
		.execute()
	)

	if not job_insert.data:
		raise HTTPException(status_code=500, detail="Could not create rewrite job.")

	created_job = job_insert.data[0]
	background_tasks.add_task(
		complete_rewrite_job,
		created_job["id"],
		safe_note_id,
		user_id,
		payload.instructions or "",
	)

	return {
		"job_id": created_job["id"],
		"status": created_job["status"],
	}


@app.get("/rewrite/{job_id}")
def get_rewrite_job(
	job_id: str,
	authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> dict:
	client = require_supabase()
	user_id = resolve_user_id(authorization)
	safe_job_id = validate_uuid(job_id, "job_id")

	job_response = client.table("ai_jobs").select("*").eq("id", safe_job_id).limit(1).execute()

	if not job_response.data:
		raise HTTPException(status_code=404, detail="Rewrite job not found.")

	job = job_response.data[0]

	note_response = (
		client.table("notes")
		.select("id")
		.eq("id", job["note_id"])
		.eq("user_id", user_id)
		.eq("is_deleted", False)
		.limit(1)
		.execute()
	)

	if not note_response.data:
		raise HTTPException(status_code=404, detail="Job not found for this user.")

	return {
		"job_id": job["id"],
		"note_id": job["note_id"],
		"status": job.get("status") or "unknown",
		"done": (job.get("status") == "done"),
		"output": job.get("output") or "",
		"updated_at": job.get("updated_at"),
	}


@app.post("/notes/{note_id}/save")
def save_note_to_bucket(
	note_id: str,
	authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> dict:
	client = require_supabase()
	user_id = resolve_user_id(authorization)
	safe_note_id = validate_uuid(note_id, "note_id")
	note = fetch_note_for_user(client, safe_note_id, user_id)

	try:
		result = upload_note_snapshot_to_bucket(client, note, user_id)
	except Exception as exc:  # noqa: BLE001
		raise HTTPException(status_code=500, detail=f"Failed to save note to bucket: {str(exc)}") from exc

	return {
		"ok": True,
		"note_id": safe_note_id,
		"saved_at": utc_now_iso(),
		**result,
	}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
