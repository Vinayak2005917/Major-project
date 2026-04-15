import React from "https://esm.sh/react@18.2.0?target=es2019";
import { Sparkles, WandSparkles } from "https://esm.sh/lucide-react@0.453.0?target=es2019&deps=react@18.2.0";

export function AiRewriteFab({ isLoading, onClick, disabled }) {
    return React.createElement("div", { className: "pointer-events-none fixed bottom-6 right-6 z-40 lg:bottom-7 lg:right-7" },
        React.createElement("div", { className: "group relative" },
            React.createElement("button", {
                type: "button",
                onClick: onClick,
                disabled: Boolean(disabled) || Boolean(isLoading),
                className: `pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-sky-500/30 bg-sky-500/15 text-sky-200 shadow-sm transition duration-200 hover:scale-[1.03] hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-55 ${isLoading ? "animate-pulse" : ""}`,
                "aria-label": "Rewrite with AI",
            },
                isLoading
                    ? React.createElement(WandSparkles, { size: 19, className: "animate-spin" })
                    : React.createElement(Sparkles, { size: 18 })
            ),
            React.createElement("span", {
                className: "pointer-events-none absolute right-14 top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-zinc-700/60 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 opacity-0 transition duration-150 group-hover:block group-hover:opacity-100",
            }, isLoading ? "AI is rewriting..." : "Rewrite with AI")
        )
    );
}
