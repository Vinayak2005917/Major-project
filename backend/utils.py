import os
import json
import re
import uuid
from datetime import datetime, timezone
from urllib import error as urllib_error
from urllib import request as urllib_request
from typing import Optional

from fastapi import HTTPException
from supabase import Client

SUPABASE_BACKEND_KEY = ""
SUPABASE_BUCKET = "Notes"
SUPABASE_CLIENT: Optional[Client] = None
AUTH_SUPABASE_CLIENT: Optional[Client] = None


def get_openrouter_config() -> tuple[str, str]:
	api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
	model = os.getenv("OPENROUTER_MODEL", "openrouter/auto").strip() or "openrouter/auto"
	return api_key, model


def configure_runtime(
	supabase_client: Optional[Client],
	auth_supabase_client: Optional[Client],
	supabase_backend_key: str,
	supabase_bucket: str,
) -> None:
	global SUPABASE_CLIENT
	global AUTH_SUPABASE_CLIENT
	global SUPABASE_BACKEND_KEY
	global SUPABASE_BUCKET

	SUPABASE_CLIENT = supabase_client
	AUTH_SUPABASE_CLIENT = auth_supabase_client
	SUPABASE_BACKEND_KEY = (supabase_backend_key or "").strip()
	SUPABASE_BUCKET = (supabase_bucket or "Notes").strip() or "Notes"


def utc_now_iso() -> str:
	return datetime.now(timezone.utc).isoformat()


def new_uuid() -> str:
	return str(uuid.uuid4())


def parse_origins(raw_value: str) -> list[str]:
	if not raw_value:
		return ["*"]

	values = [item.strip() for item in raw_value.split(",") if item.strip()]
	return values if values else ["*"]


def require_supabase() -> Client:
	if SUPABASE_CLIENT is None:
		raise HTTPException(
			status_code=500,
			detail="Supabase backend client is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (recommended) or SUPABASE_KEY in .env.",
		)

	return SUPABASE_CLIENT


def require_auth_supabase() -> Client:
	if AUTH_SUPABASE_CLIENT is None:
		raise HTTPException(
			status_code=500,
			detail="Supabase auth client is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_KEY).",
		)

	return AUTH_SUPABASE_CLIENT


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


def rewrite_with_openrouter(content: str, instructions: str = "") -> str:
	openrouter_api_key, openrouter_model = get_openrouter_config()

	if not openrouter_api_key:
		raise RuntimeError("OPENROUTER_API_KEY is missing. Add it to backend environment variables.")

	openrouter_referer = "http://localhost:8000"
	openrouter_title = "Neurodapt"

	safe_content = (content or "").strip()
	prompt_text = (instructions or "").strip()

	user_prompt = (
		"Rewrite the following note so it is clearer and more concise while preserving meaning. "
		"Keep paragraph structure if present. Return only the improved note text.\n\n"
		f"User instructions: {prompt_text if prompt_text else 'No extra instructions.'}\n\n"
		f"Original note:\n{safe_content if safe_content else '[empty note]'}"
	)

	body = {
		"model": openrouter_model,
		"messages": [
			{
				"role": "system",
				"content": "You are a precise writing assistant. Improve clarity, grammar, and flow without adding new facts.",
			},
			{
				"role": "user",
				"content": user_prompt,
			},
		],
	}

	req = urllib_request.Request(
		url="https://openrouter.ai/api/v1/chat/completions",
		data=json.dumps(body).encode("utf-8"),
		headers={
			"Authorization": f"Bearer {openrouter_api_key}",
			"Content-Type": "application/json",
			"HTTP-Referer": openrouter_referer,
			"X-Title": openrouter_title,
		},
		method="POST",
	)

	try:
		with urllib_request.urlopen(req, timeout=45) as response:  # noqa: S310
			raw = response.read().decode("utf-8")
	except urllib_error.HTTPError as exc:
		error_raw = exc.read().decode("utf-8", errors="replace")
		raise RuntimeError(f"OpenRouter HTTP {exc.code}: {error_raw}") from exc
	except urllib_error.URLError as exc:
		raise RuntimeError(f"OpenRouter network error: {exc.reason}") from exc

	parsed = json.loads(raw)
	choices = parsed.get("choices") if isinstance(parsed, dict) else None
	if not isinstance(choices, list) or not choices:
		raise RuntimeError("OpenRouter returned no choices.")

	message = choices[0].get("message") if isinstance(choices[0], dict) else None
	content_text = message.get("content") if isinstance(message, dict) else None
	final_text = (content_text or "").strip()

	if not final_text:
		raise RuntimeError("OpenRouter returned an empty rewrite.")

	return final_text


def complete_rewrite_job(job_id: str, note_id: str, user_id: str, instructions: str = "") -> None:
	client = require_supabase()

	try:
		note = fetch_note_for_user(client, note_id, user_id)
		updated_content = rewrite_with_openrouter(note.get("content") or "", instructions)
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
