import React, { useState } from "https://esm.sh/react@18.2.0?target=es2019";

function modeButtonClass(active) {
    return `rounded-md px-3 py-1.5 text-sm transition ${active ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"}`;
}

export function AuthScreen({ onLogin, onSignup, loading, errorMessage }) {
    const [mode, setMode] = useState("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    async function handleSubmit(event) {
        event.preventDefault();

        if (!email.trim() || !password.trim()) {
            return;
        }

        if (mode === "login") {
            await onLogin(email.trim(), password);
            return;
        }

        await onSignup(email.trim(), password);
    }

    return React.createElement("div", {
        className: "flex min-h-screen items-center justify-center bg-[#0f0f0f] px-4 text-zinc-200",
    },
        React.createElement("section", {
            className: "w-full max-w-md rounded-xl border border-zinc-800/80 bg-[#121212] p-6",
        },
            React.createElement("h1", { className: "text-2xl font-semibold tracking-tight text-zinc-100" }, "Note Evolution"),
            React.createElement("p", { className: "mt-1 text-sm text-zinc-400" }, "Sign in to continue or create your account."),
            React.createElement("div", { className: "mt-5 inline-flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/70 p-1" },
                React.createElement("button", {
                    type: "button",
                    className: modeButtonClass(mode === "login"),
                    onClick: () => setMode("login"),
                }, "Login"),
                React.createElement("button", {
                    type: "button",
                    className: modeButtonClass(mode === "signup"),
                    onClick: () => setMode("signup"),
                }, "Sign Up")
            ),
            React.createElement("form", { className: "mt-5 space-y-3", onSubmit: handleSubmit },
                React.createElement("input", {
                    type: "email",
                    value: email,
                    onChange: (event) => setEmail(event.target.value),
                    placeholder: "Email",
                    className: "w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-700 focus:outline-none",
                    autoComplete: "email",
                    required: true,
                }),
                React.createElement("input", {
                    type: "password",
                    value: password,
                    onChange: (event) => setPassword(event.target.value),
                    placeholder: "Password",
                    className: "w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-700 focus:outline-none",
                    autoComplete: mode === "login" ? "current-password" : "new-password",
                    required: true,
                }),
                errorMessage
                    ? React.createElement("p", { className: "text-xs text-rose-300" }, errorMessage)
                    : null,
                React.createElement("button", {
                    type: "submit",
                    disabled: loading,
                    className: "w-full rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70",
                }, loading ? "Please wait..." : mode === "login" ? "Login" : "Create account")
            )
        )
    );
}
