import { createVersion, createWelcomeNote } from "./versioning.js";

const STORAGE_KEY = "idea-evolution-notes-v1";

const fallbackNotes = [createWelcomeNote()];

function sanitizeVersion(entry, fallbackTitle, fallbackContent, fallbackTimestamp, index) {
    const timestamp = Number.isFinite(entry && entry.timestamp) ? entry.timestamp : fallbackTimestamp;
    const title = entry && typeof entry.title === "string" ? entry.title : fallbackTitle;
    const content = entry && typeof entry.content === "string" ? entry.content : fallbackContent;
    const type = entry && (entry.type === "ai" || entry.type === "user") ? entry.type : "user";

    return {
        id: entry && typeof entry.id === "string" && entry.id.length > 0 ? entry.id : `version-${timestamp}-${index}`,
        type,
        label: type === "ai" ? "AI Improved" : "User Edit",
        title,
        content,
        timestamp,
    };
}

function sanitizeNotes(value) {
    if (!Array.isArray(value)) {
        return fallbackNotes;
    }

    const sanitized = value
        .filter((entry) => entry && typeof entry === "object")
        .map((entry, index) => {
            const updatedAt = Number.isFinite(entry.updatedAt) ? entry.updatedAt : Date.now();
            const title = typeof entry.title === "string" ? entry.title : "Untitled";
            const content = typeof entry.content === "string" ? entry.content : String(entry.content || "");
            const baseVersion = createVersion({
                type: "user",
                title,
                content,
                timestamp: updatedAt,
            });

            const versions = Array.isArray(entry.versions) && entry.versions.length > 0
                ? entry.versions
                      .filter((item) => item && typeof item === "object")
                      .map((item, versionIndex) =>
                          sanitizeVersion(item, title, content, updatedAt, versionIndex)
                      )
                      .sort((a, b) => b.timestamp - a.timestamp)
                : [baseVersion];

            return {
                id: typeof entry.id === "string" && entry.id.length > 0 ? entry.id : `note-${Date.now()}-${index}`,
                title,
                content,
                updatedAt,
                versions,
            };
        });

    return sanitized.length > 0 ? sanitized : fallbackNotes;
}

export function loadNotes() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);

        if (!raw) {
            return fallbackNotes;
        }

        const parsed = JSON.parse(raw);
        return sanitizeNotes(parsed);
    } catch {
        return fallbackNotes;
    }
}

export function saveNotes(notes) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch {
        // Ignore write failures when browser storage is unavailable.
    }
}
