import React, { useState } from "https://esm.sh/react@18.2.0?target=es2019";
import { Eye, X } from "https://esm.sh/lucide-react@0.453.0?target=es2019&deps=react@18.2.0";

export function EvolutionEditor({ note, previewVersion, onTitleChange, onContentChange, onExitPreview }) {
    const [isFocused, setFocused] = useState(false);
    const previewing = Boolean(previewVersion);

    if (!note) {
        return React.createElement("section", { className: "flex flex-1 items-center justify-center text-zinc-500" },
            React.createElement("p", null, "Create a note to start evolving your ideas.")
        );
    }

    const displayTitle = previewing ? previewVersion.title : note.title;
    const displayContent = previewing ? previewVersion.content : note.content;

    return React.createElement("section", {
        className: `panel-scroll flex-1 overflow-y-auto transition-shadow duration-200 ${isFocused && !previewing ? "shadow-[inset_0_0_0_1px_rgba(96,165,250,0.35)]" : ""}`,
    },
        React.createElement("div", { className: "mx-auto w-full max-w-4xl px-6 pb-20 pt-10 md:px-14" },
            previewing
                ? React.createElement("div", {
                    className: "mb-6 flex items-center justify-between rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-200",
                },
                    React.createElement("div", { className: "inline-flex items-center gap-1.5" },
                        React.createElement(Eye, { size: 13 }),
                        React.createElement("span", null, "Previewing timeline version")
                    ),
                    React.createElement("button", {
                        type: "button",
                        className: "inline-flex h-6 w-6 items-center justify-center rounded text-sky-200 transition hover:bg-sky-500/20",
                        onClick: onExitPreview,
                        "aria-label": "Exit preview mode",
                    }, React.createElement(X, { size: 14 }))
                )
                : null,
            React.createElement("input", {
                type: "text",
                value: typeof displayTitle === "string" ? displayTitle : "",
                readOnly: previewing,
                onFocus: () => setFocused(true),
                onBlur: () => setFocused(false),
                onChange: (event) => onTitleChange(event.target.value),
                placeholder: "Untitled idea",
                className: "w-full border-0 bg-transparent p-0 text-[2.55rem] font-bold tracking-tight text-zinc-100 placeholder:text-zinc-600 focus:outline-none",
            }),
            React.createElement("textarea", {
                value: typeof displayContent === "string" ? displayContent : "",
                readOnly: previewing,
                onFocus: () => setFocused(true),
                onBlur: () => setFocused(false),
                onChange: (event) => onContentChange(event.target.value),
                placeholder: "Write freely. Your thinking will evolve here.",
                className: "mt-8 min-h-[68vh] w-full resize-none border-0 bg-transparent p-0 text-[1.06rem] leading-8 text-zinc-200 placeholder:text-zinc-500 focus:outline-none",
            })
        )
    );
}
