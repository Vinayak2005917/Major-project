import React, { useEffect, useRef, useState } from "https://esm.sh/react@18.2.0?target=es2019";
import { Eye, X } from "https://esm.sh/lucide-react@0.453.0?target=es2019&deps=react@18.2.0";

export function EvolutionEditor({ note, previewVersion, onTitleChange, onContentChange, onExitPreview }) {
    const [isFocused, setFocused] = useState(false);
    const textareaRef = useRef(null);
    const previewing = Boolean(previewVersion);
    const displayTitle = note ? (previewing ? previewVersion.title : note.title) : "";
    const displayContent = note ? (previewing ? previewVersion.content : note.content) : "";

    function resizeTextarea() {
        const target = textareaRef.current;
        if (!target) {
            return;
        }

        target.style.height = "auto";
        target.style.height = `${target.scrollHeight}px`;
    }

    useEffect(() => {
        resizeTextarea();
    }, [displayContent, previewing]);

    if (!note) {
        return React.createElement("section", { className: "flex flex-1 items-center justify-center text-zinc-500" },
            React.createElement("p", null, "Create a note to start evolving your ideas.")
        );
    }

    return React.createElement("section", {
        className: `editor-scroll-area panel-scroll relative flex-1 overflow-y-auto scroll-smooth transition-shadow duration-200 ${isFocused && !previewing ? "shadow-[inset_0_0_0_1px_rgba(96,165,250,0.35)]" : ""}`,
    },
        React.createElement("div", { className: "editor-canvas mx-auto w-full max-w-[860px] px-6 pb-16 md:px-12" },
            React.createElement("div", {
                className: "sticky top-0 z-10 -mx-6 border-b border-zinc-800/70 bg-[#0d0f12]/95 px-6 pb-5 pt-8 backdrop-blur-sm md:-mx-12 md:px-12",
            },
                previewing
                    ? React.createElement("div", {
                        className: "mb-5 flex items-center justify-between rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-200",
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
                    className: "w-full border-0 bg-transparent p-0 text-[2.35rem] font-semibold tracking-tight text-zinc-50 placeholder:text-zinc-600 focus:outline-none md:text-[2.6rem]",
                })
            ),
            React.createElement("div", { className: "pt-8" },
                React.createElement("textarea", {
                    ref: textareaRef,
                    value: typeof displayContent === "string" ? displayContent : "",
                    readOnly: previewing,
                    onFocus: () => setFocused(true),
                    onBlur: () => setFocused(false),
                    onChange: (event) => {
                        resizeTextarea();
                        onContentChange(event.target.value);
                    },
                    placeholder: "Write freely. Your thinking will evolve here.",
                    className: "w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[1.03rem] leading-8 text-zinc-200 placeholder:text-zinc-500 focus:outline-none",
                })
            )
        )
    );
}
