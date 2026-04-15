export function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function summarizeText(value, limit) {
    const maxLength = Number.isFinite(limit) ? limit : 92;
    const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

    if (!text) {
        return "No content yet";
    }

    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength - 1)}...`;
}

export function createVersion(options) {
    const payload = options || {};
    const type = payload.type === "ai" ? "ai" : "user";
    const timestamp = Number.isFinite(payload.timestamp) ? payload.timestamp : Date.now();

    return {
        id: typeof payload.id === "string" && payload.id.length > 0 ? payload.id : createId(),
        type,
        label: type === "ai" ? "AI Improved" : "User Edit",
        title: typeof payload.title === "string" ? payload.title : "Untitled",
        content: typeof payload.content === "string" ? payload.content : "",
        timestamp,
    };
}

export function appendVersion(note, version) {
    const source = note || {};
    const entry = createVersion(version);
    const versions = Array.isArray(source.versions) ? source.versions : [];
    const latest = versions[0];

    if (latest && latest.title === entry.title && latest.content === entry.content && latest.type === entry.type) {
        return {
            ...source,
            versions,
        };
    }

    return {
        ...source,
        versions: [entry, ...versions],
    };
}

function sentenceCase(value) {
    const text = value.trim();

    if (!text) {
        return "";
    }

    return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function polishParagraph(value) {
    const collapsed = value.replace(/\s+/g, " ").trim();

    if (!collapsed) {
        return "";
    }

    const refined = sentenceCase(collapsed)
        .replace(/\bi\b/g, "I")
        .replace(/\s+,/g, ",")
        .replace(/\s+\./g, ".")
        .replace(/\s+!/g, "!")
        .replace(/\s+\?/g, "?");

    if (!/[.!?]$/.test(refined)) {
        return `${refined}.`;
    }

    return refined;
}

function deriveTitle(content) {
    const firstLine = content
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 0);

    if (!firstLine) {
        return "Untitled";
    }

    const cleaned = firstLine.replace(/^[-#*\s]+/, "");

    if (!cleaned) {
        return "Untitled";
    }

    return cleaned.length > 56 ? `${cleaned.slice(0, 55)}...` : cleaned;
}

export function generateAiRewrite(options) {
    const payload = options || {};
    const sourceContent = typeof payload.content === "string" ? payload.content : "";
    const sourceTitle = typeof payload.title === "string" ? payload.title : "";
    const paragraphs = sourceContent
        .split(/\n{2,}/)
        .map((line) => polishParagraph(line))
        .filter((line) => line.length > 0);

    const improvedContent = paragraphs.length > 0
        ? paragraphs.join("\n\n")
        : "Capture one idea, one observation, and one next step to move this thought forward.";

    const improvedTitle = sourceTitle.trim().length > 0 && sourceTitle.trim() !== "Untitled"
        ? sourceTitle.trim()
        : deriveTitle(improvedContent);

    return {
        title: improvedTitle,
        content: improvedContent,
    };
}

export function createBlankNote() {
    const timestamp = Date.now();
    const title = "Untitled";
    const content = "";

    return {
        id: createId(),
        title,
        content,
        updatedAt: timestamp,
        versions: [
            createVersion({
                type: "user",
                title,
                content,
                timestamp,
            }),
        ],
    };
}

export function createWelcomeNote() {
    const timestamp = Date.now();
    const title = "Welcome";
    const content = "Start writing and let AI evolve this note into sharper thinking.";

    return {
        id: "starter-note",
        title,
        content,
        updatedAt: timestamp,
        versions: [
            createVersion({
                id: "starter-version",
                type: "user",
                title,
                content,
                timestamp,
            }),
        ],
    };
}
