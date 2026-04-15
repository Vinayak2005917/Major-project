import React from "https://esm.sh/react@18.2.0?target=es2019";
import { Bot, History, RotateCcw, UserRound } from "https://esm.sh/lucide-react@0.453.0?target=es2019&deps=react@18.2.0";
import { summarizeText } from "../utils/versioning.js";

function formatTime(timestamp) {
    const date = new Date(timestamp);

    return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function TimelinePanel({ versions, selectedVersionId, onSelectVersion, onRestoreVersion, isAiRewriting }) {
    const entries = Array.isArray(versions) ? versions : [];

    return React.createElement("aside", {
        className: "hidden min-w-0 flex-col bg-[#101010] lg:flex",
    },
        React.createElement("header", {
            className: "flex h-12 items-center gap-2 border-b border-zinc-800/70 px-4",
        },
            React.createElement(History, { size: 15, className: "text-zinc-400" }),
            React.createElement("h2", { className: "text-sm font-medium text-zinc-300" }, "Evolution Timeline")
        ),
        React.createElement("div", { className: "panel-scroll flex-1 overflow-y-auto px-4 py-4" },
            isAiRewriting
                ? React.createElement("div", {
                    className: "mb-4 rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-200",
                },
                    React.createElement("span", { className: "inline-flex items-center gap-1.5" },
                        React.createElement("span", { className: "inline-flex h-2 w-2 animate-pulse rounded-full bg-sky-300" }),
                        React.createElement("span", null, "AI is evolving this note...")
                    )
                )
                : null,
            entries.length === 0
                ? React.createElement("p", { className: "text-sm text-zinc-500" }, "Versions will appear as you write and rewrite.")
                : React.createElement("ol", { className: "space-y-3" },
                    entries.map((entry, index) => {
                        const isAi = entry.type === "ai";
                        const isSelected = selectedVersionId === entry.id;

                        return React.createElement("li", {
                            key: entry.id,
                            className: "timeline-entry group relative pl-6",
                            style: { animationDelay: `${index * 45}ms` },
                        },
                            index !== entries.length - 1
                                ? React.createElement("span", {
                                    className: "absolute left-[8px] top-4 bottom-[-14px] w-px bg-zinc-800",
                                    "aria-hidden": "true",
                                })
                                : null,
                            React.createElement("span", {
                                className: `absolute left-[4px] top-2.5 h-2.5 w-2.5 rounded-full ${isAi ? "bg-sky-400" : "bg-zinc-500"}`,
                                "aria-hidden": "true",
                            }),
                            React.createElement("button", {
                                type: "button",
                                onClick: () => onSelectVersion(entry.id),
                                className: `w-full rounded-md px-2.5 py-2 text-left transition duration-150 ${isSelected ? "bg-zinc-800/80" : "hover:bg-zinc-800/55"} ${isAi ? "ring-1 ring-sky-500/25" : ""}`,
                            },
                                React.createElement("div", { className: "mb-1 flex items-center justify-between gap-2" },
                                    React.createElement("span", {
                                        className: `inline-flex items-center gap-1 text-xs font-medium ${isAi ? "text-sky-300" : "text-zinc-400"}`,
                                    },
                                        isAi ? React.createElement(Bot, { size: 12 }) : React.createElement(UserRound, { size: 12 }),
                                        React.createElement("span", null, isAi ? "AI Improved" : "User Edit")
                                    ),
                                    React.createElement("time", { className: "text-[11px] text-zinc-500" }, formatTime(entry.timestamp))
                                ),
                                React.createElement("p", { className: "timeline-preview text-xs leading-5 text-zinc-300" }, summarizeText(entry.content, 110))
                            ),
                            React.createElement("button", {
                                type: "button",
                                onClick: (event) => {
                                    event.stopPropagation();
                                    onRestoreVersion(entry.id);
                                },
                                className: "mt-1 inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-400 opacity-0 transition duration-150 hover:bg-zinc-800 hover:text-zinc-200 group-hover:opacity-100",
                            },
                                React.createElement(RotateCcw, { size: 11 }),
                                React.createElement("span", null, "Restore")
                            )
                        );
                    })
                )
        )
    );
}
