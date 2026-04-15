import React from "https://esm.sh/react@18.2.0?target=es2019";
import { FileText, Plus } from "https://esm.sh/lucide-react@0.453.0?target=es2019&deps=react@18.2.0";

function displayTitle(value) {
    if (typeof value !== "string") {
        return "Untitled";
    }

    const cleaned = value.trim();
    return cleaned.length > 0 ? cleaned : "Untitled";
}

export function Sidebar({ isOpen, notes, activeId, onCreate, onSelect }) {
    return React.createElement(
        "aside",
        {
            className: `fixed inset-y-0 left-0 z-30 w-64 border-r border-zinc-800/80 bg-[#121212] transition-transform duration-200 ease-out lg:static ${isOpen ? "translate-x-0" : "-translate-x-full"}`,
        },
        React.createElement("div", { className: "flex h-full flex-col" },
            React.createElement("div", { className: "flex h-12 items-center px-3" },
                React.createElement("button", {
                    type: "button",
                    onClick: onCreate,
                    className: "inline-flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-300 transition duration-150 hover:bg-zinc-800/65 hover:text-zinc-100",
                },
                    React.createElement(Plus, { size: 14 }),
                    React.createElement("span", null, "New Note")
                )
            ),
            React.createElement("nav", { className: "panel-scroll flex-1 space-y-0.5 overflow-y-auto px-2 pb-4" },
                notes.map((note) => {
                    const isActive = note.id === activeId;

                    return React.createElement("button", {
                        key: note.id,
                        type: "button",
                        onClick: () => onSelect(note.id),
                        className: `group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition duration-150 ${isActive ? "bg-zinc-800/70" : "hover:bg-zinc-800/55"}`,
                    },
                        React.createElement(FileText, {
                            size: 14,
                            className: `shrink-0 transition-colors ${isActive ? "text-zinc-300" : "text-zinc-500 group-hover:text-zinc-400"}`,
                        }),
                        React.createElement("span", {
                            className: `truncate text-sm ${isActive ? "text-zinc-100" : "text-zinc-300"}`,
                        }, displayTitle(note.title))
                    );
                })
            )
        )
    );
}
