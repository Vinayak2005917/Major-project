const DEPLOYED_API_BASE = "https://vertigo-reseller-upload.ngrok-free.dev";

const API_BASE = DEPLOYED_API_BASE;
const SESSION_KEY = "notes_auth_session";

// --- Direct AI config (calls aicredits.in from the browser) ---
const AI_API_KEY =
	"sk-live-72cea74d30e0997953bb2fb353412fca8cbbf04d826468416c4aec87893a6937";
const AI_BASE_URL = "https://api.aicredits.in/v1";
const AI_MODEL = "inception/mercury-2";

const AI_SYSTEM_PROMPT =
	"You are a precise writing assistant. Improve clarity, grammar, and flow without adding new facts. " +
	"Format the output in clean Markdown. Use minimal bullet points only" +
	"content already has a list-like structure. Keep paragraph structure. Return only the improved note text.";

function buildAiUserPrompt(content, instructions) {
	const promptText = (instructions || "").trim();
	return (
		"Return only the improved note text.\n\n" +
		`User instructions: ${promptText || "No extra instructions."}\n\n` +
		`Original note:\n${(content || "").trim() || "[empty note]"}`
	);
}

function readSession() {
    const raw = window.localStorage.getItem(SESSION_KEY);

    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function getAccessTokenOrNull() {
    const session = readSession();
    const token = session && typeof session.access_token === "string" ? session.access_token : "";

    return token || null;
}

export function setAuthSession(sessionPayload) {
    if (!sessionPayload || typeof sessionPayload !== "object") {
        return;
    }

    window.localStorage.setItem(SESSION_KEY, JSON.stringify(sessionPayload));
}

export function clearAuthSession() {
    window.localStorage.removeItem(SESSION_KEY);
}

export function getStoredSession() {
    return readSession();
}

async function authRequest(path, payload) {
    return requestJson(path, {
        method: "POST",
        body: JSON.stringify(payload || {}),
        skipAuth: true,
    });
}

export async function signup(email, password) {
    return authRequest("/auth/signup", { email, password });
}

export async function login(email, password) {
    return authRequest("/auth/login", { email, password });
}

export async function me() {
    return requestJson("/auth/me");
}

function ensureAuthenticatedUnlessSkipped(skipAuth) {
    if (skipAuth) {
        return null;
    }

    const token = getAccessTokenOrNull();

    if (token) {
        return token;
    }

    throw new Error("Not authenticated. Please login first.");
}

function buildHeaders(settings, token) {
    const base = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        ...(settings.headers || {}),
    };

    if (token) {
        base.Authorization = `Bearer ${token}`;
    }

    return base;
}

async function requestJson(path, options) {
    const settings = options || {};
    const token = ensureAuthenticatedUnlessSkipped(Boolean(settings.skipAuth));
    const requestOptions = {
        ...settings,
        headers: buildHeaders(settings, token),
    };

    const response = await fetch(`${API_BASE}${path}`, requestOptions);

    const raw = await response.text();
    let payload = {};

    if (raw) {
        try {
            payload = JSON.parse(raw);
        } catch {
            payload = { detail: raw };
        }
    }

    if (!response.ok) {
        const detail = payload && typeof payload.detail === "string" ? payload.detail : `Request failed (${response.status})`;
        throw new Error(detail);
    }

    return payload;
}

export async function listNotes() {
    return requestJson("/notes");
}

export async function getNote(noteId) {
    return requestJson(`/notes/${noteId}`);
}

export async function createNote(payload) {
    return requestJson("/notes", {
        method: "POST",
        body: JSON.stringify(payload || {}),
    });
}

export async function updateNote(noteId, payload) {
    return requestJson(`/notes/${noteId}`, {
        method: "PUT",
        body: JSON.stringify(payload || {}),
    });
}

export async function deleteNote(noteId) {
    return requestJson(`/notes/${noteId}`, {
        method: "DELETE",
    });
}

export async function getNoteVersions(noteId) {
    return requestJson(`/notes/${noteId}/versions`);
}

export async function createRewriteJob(noteId, instructions) {
    return requestJson(`/notes/${noteId}/rewrite`, {
        method: "POST",
        body: JSON.stringify({ instructions: instructions || "" }),
    });
}

export async function getRewriteJob(jobId) {
    return requestJson(`/rewrite/${jobId}`);
}

export async function saveNoteToBucket(noteId) {
    return requestJson(`/notes/${noteId}/save`, {
        method: "POST",
    });
}

export async function deleteVersion(noteId, versionId) {
    return requestJson(`/notes/${noteId}/versions/${versionId}`, {
        method: "DELETE",
    });
}

export async function directStreamRewrite(content, instructions, callbacks, signal) {
	const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${AI_API_KEY}`,
		},
		body: JSON.stringify({
			model: AI_MODEL,
			messages: [
				{ role: "system", content: AI_SYSTEM_PROMPT },
				{ role: "user", content: buildAiUserPrompt(content, instructions) },
			],
			stream: true,
		}),
		signal,
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`AI API error (${response.status}): ${text}`);
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() || "";

		for (const line of lines) {
			if (line.startsWith("data: ")) {
				const raw = line.slice(6).trim();
				if (!raw || raw === "[DONE]") continue;
				try {
					const parsed = JSON.parse(raw);
					const delta = parsed.choices?.[0]?.delta;
					const token = delta?.content || "";
					if (token && callbacks.onToken) {
						callbacks.onToken(token);
					}
				} catch {
					// skip malformed lines
				}
			}
		}
	}
}

export async function persistRewrite(noteId, title, content) {
	return requestJson(`/notes/${noteId}`, {
		method: "PUT",
		body: JSON.stringify({ title, content }),
	});
}
