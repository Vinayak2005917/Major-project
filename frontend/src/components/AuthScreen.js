import React, { useState } from "https://esm.sh/react@18.2.0?target=es2019";
import {
  ArrowLeft,
  BrainCircuit,
} from "https://esm.sh/lucide-react@0.453.0?target=es2019&deps=react@18.2.0";

const ce = React.createElement;

export function AuthScreen({ onLogin, onSignup, loading, errorMessage }) {
  const [view, setView] = useState("welcome"); // "welcome", "login", "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (!email.trim() || !password.trim()) return;
    if (view === "login") {
      await onLogin(email.trim(), password);
    } else if (view === "signup") {
      await onSignup(email.trim(), password);
    }
  }

  const Background = ce(
    "div",
    {
      className:
        "fixed inset-0 overflow-hidden pointer-events-none z-0 bg-[#070707] animate-fade-in",
    },
    ce("div", {
      className:
        "absolute top-[-20%] left-[-10%] w-[70vh] h-[70vh] rounded-full bg-purple-900/30 blur-[130px] animate-blob",
    }),
    ce("div", {
      className:
        "absolute top-[20%] right-[-20%] w-[60vh] h-[60vh] rounded-full bg-blue-900/30 blur-[130px] animate-blob animation-delay-2000",
    }),
    ce("div", {
      className:
        "absolute bottom-[-20%] left-[10%] w-[80vh] h-[80vh] rounded-full bg-indigo-900/20 blur-[130px] animate-blob animation-delay-4000",
    }),
    ce("div", {
      className:
        "absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjAwIDIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZmlsdGVyIGlkPSJub2lzZSI+PGZlVHVyYnVsZW5jZSB0eXBlPSJmcmFjdGFsTm9pc2UiIGJhc2VGcmVxdWVuY3k9IjAuNjUiIG51bU9jdGF2ZXM9IjMiIHN0aXRjaFRpbGVzPSJzdGl0Y2giLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWx0ZXI9InVybCgibm9pc2UpIiBvcGFjaXR5PSIwLjA1Ii8+PC9zdmc+')] opacity-[0.25] mix-blend-overlay",
    }),
  );

  const renderWelcome = () => {
    return ce(
      "div",
      {
        className:
          "relative z-10 w-full max-w-lg rounded-[2.5rem] border border-white/5 bg-white/[0.02] p-10 text-center backdrop-blur-3xl shadow-2xl animate-slide-up",
      },
      ce(
        "div",
        {
          className:
            "mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10 shadow-[0_0_60px_rgba(168,85,247,0.15)]",
        },
        ce(BrainCircuit, {
          className: "text-purple-300",
          size: 48,
          strokeWidth: 1.5,
        }),
      ),
      ce(
        "h1",
        {
          className:
            "mb-4 text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400",
        },
        "Neurodapt",
      ),
      ce(
        "p",
        {
          className:
            "mx-auto mb-10 max-w-sm text-lg text-zinc-400 leading-relaxed font-light",
        },
        "Your personal AI-enhanced cognitive workspace. Evolve your ideas at the speed of thought.",
      ),
      ce(
        "div",
        { className: "space-y-4" },
        ce(
          "button",
          {
            onClick: () => setView("signup"),
            className:
              "w-full rounded-2xl bg-zinc-100 px-4 py-4 text-base font-semibold text-zinc-950 shadow-xl shadow-zinc-100/10 transition-all hover:bg-white active:scale-[0.98] ring-1 ring-white/20",
          },
          "Create Account",
        ),
        ce(
          "button",
          {
            onClick: () => setView("login"),
            className:
              "w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-4 text-base font-medium text-zinc-300 transition-all hover:bg-white/10 active:scale-[0.98]",
          },
          "Log In",
        ),
      ),
    );
  };

  const renderAuthForm = () => {
    const isLogin = view === "login";
    return ce(
      "div",
      {
        className:
          "relative z-10 w-full max-w-md rounded-[2.5rem] border border-white/10 bg-black/40 p-10 backdrop-blur-2xl shadow-[0_0_80px_rgba(0,0,0,0.6)] animate-slide-up",
      },
      ce(
        "button",
        {
          onClick: () => {
            setView("welcome");
          }, // Error message won't clear dynamically, but component remount or user input usually masks it
          className:
            "group mb-8 flex w-fit items-center text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-200",
        },
        ce(ArrowLeft, {
          size: 18,
          className: "mr-2 transition-transform group-hover:-translate-x-1",
        }),
        "Back",
      ),
      ce(
        "h2",
        { className: "mb-2 text-3xl font-bold tracking-tight text-zinc-100" },
        isLogin ? "Welcome Back" : "Create Account",
      ),
      ce(
        "p",
        { className: "mb-8 text-sm text-zinc-400" },
        isLogin
          ? "Enter your details to access your workspace."
          : "Start evolving your ideas today.",
      ),

      ce(
        "form",
        { className: "space-y-5", onSubmit: handleSubmit },
        ce(
          "div",
          { className: "space-y-1.5" },
          ce(
            "label",
            { className: "text-xs font-medium text-zinc-400 ml-1" },
            "Email",
          ),
          ce("input", {
            type: "email",
            value: email,
            onChange: (e) => setEmail(e.target.value),
            placeholder: "name@example.com",
            className:
              "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-purple-500/50 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all",
            autoComplete: "email",
            required: true,
          }),
        ),
        ce(
          "div",
          { className: "space-y-1.5" },
          ce(
            "label",
            { className: "text-xs font-medium text-zinc-400 ml-1" },
            "Password",
          ),
          ce("input", {
            type: "password",
            value: password,
            onChange: (e) => setPassword(e.target.value),
            placeholder: "••••••••",
            className:
              "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-purple-500/50 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all",
            autoComplete: isLogin ? "current-password" : "new-password",
            required: true,
          }),
        ),
        errorMessage
          ? ce(
              "div",
              {
                className:
                  "rounded-xl bg-rose-500/10 border border-rose-500/20 p-3",
              },
              ce(
                "p",
                { className: "text-xs text-rose-300 text-center" },
                errorMessage,
              ),
            )
          : null,
        ce(
          "button",
          {
            type: "submit",
            disabled: loading,
            className:
              "mt-4 w-full rounded-2xl bg-zinc-100 px-4 py-4 text-sm font-semibold text-zinc-900 shadow-lg shadow-white/5 transition-all hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100",
          },
          loading ? "Please wait..." : isLogin ? "Sign In" : "Sign Up",
        ),

        ce(
          "div",
          { className: "pt-4 text-center" },
          ce(
            "p",
            { className: "text-sm text-zinc-400" },
            isLogin ? "Don't have an account? " : "Already have an account? ",
            ce(
              "button",
              {
                type: "button",
                onClick: () => {
                  setView(isLogin ? "signup" : "login");
                },
                className:
                  "font-medium text-zinc-200 underline decoration-purple-500/50 underline-offset-4 hover:text-white transition-colors",
              },
              isLogin ? "Sign up" : "Log in",
            ),
          ),
        ),
      ),
    );
  };

  return ce(
    "div",
    {
      className:
        "relative flex min-h-screen items-center justify-center bg-[#050505] px-4 sm:px-6 lg:px-8 font-sans selection:bg-purple-500/30",
    },
    Background,
    view === "welcome" ? renderWelcome() : renderAuthForm(),
  );
}
