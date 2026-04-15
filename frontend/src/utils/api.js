const API_BASE = (window.localStorage.getItem("notes_api_base") || "https://major-project-63y1.onrender.com").replace(/\/+$/, "");
const SESSION_KEY = "notes_auth_session";

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

    const response = await fetch(`${API_BASE}${path}`, {
        ...settings,
        headers: buildHeaders(settings, token),
    });

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
