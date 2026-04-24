const DEPLOYED_API_BASE = "https://vertigo-reseller-upload.ngrok-free.dev";
const API_BASE = DEPLOYED_API_BASE;
const SESSION_KEY = "notes_auth_session";

async function requestAuth(path, payload) {
    const requestOptions = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify(payload || {}),
    };

    const response = await fetch(`${API_BASE}${path}`, requestOptions);
    const raw = await response.text();
    let parsed = {};

    if (raw) {
        try {
            parsed = JSON.parse(raw);
        } catch {
            parsed = { detail: raw };
        }
    }

    if (!response.ok) {
        const detail = parsed && typeof parsed.detail === "string"
            ? parsed.detail
            : `Request failed (${response.status})`;
        throw new Error(detail);
    }

    return parsed;
}

function createFeedbackElement(form) {
    const node = document.createElement("div");
    node.setAttribute("aria-live", "polite");
    node.className = "hidden rounded-xl border px-4 py-3 text-sm";
    form.appendChild(node);
    return node;
}

function showFeedback(node, message, kind) {
    node.textContent = message || "";
    node.classList.remove(
        "hidden",
        "border-rose-500/30",
        "bg-rose-500/10",
        "text-rose-200",
        "border-emerald-500/30",
        "bg-emerald-500/10",
        "text-emerald-200",
    );

    if (kind === "success") {
        node.classList.add("border-emerald-500/30", "bg-emerald-500/10", "text-emerald-200");
    } else {
        node.classList.add("border-rose-500/30", "bg-rose-500/10", "text-rose-200");
    }
}

function detectAuthMode() {
    const fileName = window.location.pathname.split("/").pop() || "";
    return fileName.toLowerCase().includes("register") ? "signup" : "login";
}

document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("form");

    if (!form) {
        return;
    }

    const mode = detectAuthMode();
    const submitBtn = form.querySelector('button[type="submit"]');
    const feedback = createFeedbackElement(form);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const emailInput = form.querySelector("#email");
        const passwordInput = form.querySelector("#password");
        const email = emailInput && typeof emailInput.value === "string" ? emailInput.value.trim() : "";
        const password = passwordInput && typeof passwordInput.value === "string" ? passwordInput.value : "";

        if (!email || !password) {
            showFeedback(feedback, "Please enter email and password.", "error");
            return;
        }

        const originalText = submitBtn ? submitBtn.innerText : "";

        if (submitBtn) {
            submitBtn.innerText = "Please wait...";
            submitBtn.disabled = true;
        }

        try {
            if (mode === "login") {
                const response = await requestAuth("/auth/login", { email, password });
                window.localStorage.setItem(
                    SESSION_KEY,
                    JSON.stringify({
                        access_token: response.access_token,
                        refresh_token: response.refresh_token,
                        user: response.user,
                    }),
                );
                showFeedback(feedback, "Login successful. Redirecting...", "success");
                window.location.href = "./index.html";
                return;
            }

            const response = await requestAuth("/auth/signup", { email, password });
            const maybeToken = response && response.session ? response.session.access_token : null;

            if (maybeToken) {
                window.localStorage.setItem(
                    SESSION_KEY,
                    JSON.stringify({
                        access_token: response.session.access_token,
                        refresh_token: response.session.refresh_token,
                        user: response.user,
                    }),
                );
                showFeedback(feedback, "Account created. Redirecting...", "success");
                window.location.href = "./index.html";
                return;
            }

            showFeedback(
                feedback,
                "Signup successful. Check your email for verification, then login.",
                "success",
            );
        } catch (error) {
            const message = error && error.message ? error.message : "Authentication request failed.";
            showFeedback(feedback, message, "error");
            console.error("Auth request failed:", error);
        } finally {
            if (submitBtn) {
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            }
        }
    });
});
