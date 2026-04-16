import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "https://esm.sh/react@18.2.0?target=es2019";
import { PanelLeft } from "https://esm.sh/lucide-react@0.453.0?target=es2019&deps=react@18.2.0";
import { Sidebar } from "./components/Sidebar.js";
import { EvolutionEditor } from "./components/EvolutionEditor.js";
import { TimelinePanel } from "./components/TimelinePanel.js";
import { AiRewriteFab } from "./components/AiRewriteFab.js";
import { AuthScreen } from "./components/AuthScreen.js";
import {
  clearAuthSession,
  createNote,
  createRewriteJob,
  deleteNote,
  getStoredSession,
  getNote,
  getNoteVersions,
  getRewriteJob,
  saveNoteToBucket,
  login,
  listNotes,
  me,
  setAuthSession,
  signup,
  updateNote,
} from "./utils/api.js";

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function toTimestamp(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function normalizeNote(raw) {
  const source = raw || {};

  return {
    id: String(source.id || ""),
    title: typeof source.title === "string" ? source.title : "Untitled",
    content: typeof source.content === "string" ? source.content : "",
    updatedAt: toTimestamp(source.updated_at || source.updatedAt),
  };
}

function normalizeVersion(raw, fallbackTitle, forceType) {
  const type = forceType === "ai" ? "ai" : "user";
  const source = raw || {};

  return {
    id: String(source.id || `${Date.now()}-${Math.random()}`),
    type,
    label: type === "ai" ? "AI Improved" : "User Edit",
    title:
      typeof fallbackTitle === "string" && fallbackTitle.trim().length > 0
        ? fallbackTitle
        : "Untitled",
    content: typeof source.content === "string" ? source.content : "",
    timestamp: toTimestamp(source.created_at || source.createdAt),
  };
}

function getDisplayTitle(note) {
  if (!note || typeof note.title !== "string") {
    return "Untitled";
  }

  const cleaned = note.title.trim();
  return cleaned.length > 0 ? cleaned : "Untitled";
}

export function App() {
  const [session, setSession] = useState(() => getStoredSession());
  const [isAuthBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [notes, setNotes] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [versionsByNote, setVersionsByNote] = useState({});
  const [isSidebarOpen, setSidebarOpen] = useState(
    () => window.innerWidth >= 1024,
  );
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [isAiRewriting, setAiRewriting] = useState(false);
  const [isSavingBucket, setSavingBucket] = useState(false);
  const [isLoadingNotes, setLoadingNotes] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const lastSyncedRef = useRef({});

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => b.updatedAt - a.updatedAt),
    [notes],
  );

  const activeNote = notes.find((note) => note.id === activeId) || null;
  const versions =
    activeId && Array.isArray(versionsByNote[activeId])
      ? versionsByNote[activeId]
      : [];
  const selectedVersion =
    versions.find((entry) => entry.id === selectedVersionId) || null;

  async function fetchAndStoreVersions(noteId, fallbackTitle, markLatestAsAi) {
    try {
      const response = await getNoteVersions(noteId);
      const rows =
        response && Array.isArray(response.versions) ? response.versions : [];

      const mapped = rows.map((row) =>
        normalizeVersion(row, fallbackTitle, "user"),
      );
      if (markLatestAsAi && mapped[0]) {
        mapped[0] = {
          ...mapped[0],
          type: "ai",
          label: "AI Improved",
        };
      }

      setVersionsByNote((prevState) => ({
        ...prevState,
        [noteId]: mapped,
      }));
    } catch (error) {
      setErrorMessage(
        error && error.message ? error.message : "Failed to load timeline.",
      );
    }
  }

  async function loadNotesForCurrentSession() {
    setLoadingNotes(true);
    setErrorMessage("");

    const response = await listNotes();
    const rows = Array.isArray(response) ? response : [];
    const mapped = rows.map((row) => normalizeNote(row));

    setNotes(mapped);

    const syncMap = {};
    mapped.forEach((note) => {
      syncMap[note.id] = {
        title: note.title,
        content: note.content,
      };
    });
    lastSyncedRef.current = syncMap;

    const firstId = mapped[0] ? mapped[0].id : null;
    setActiveId(firstId);
    setSelectedVersionId(null);
    setVersionsByNote({});

    if (firstId) {
      await fetchAndStoreVersions(firstId, mapped[0].title, false);
    }

    setLoadingNotes(false);
  }

  useEffect(() => {
    let alive = true;

    async function bootstrap() {
      if (!session || !session.access_token) {
        setLoadingNotes(false);
        setNotes([]);
        setVersionsByNote({});
        setActiveId(null);
        return;
      }

      try {
        await me();
        if (!alive) {
          return;
        }

        await loadNotesForCurrentSession();
      } catch (error) {
        if (!alive) {
          return;
        }

        clearAuthSession();
        setSession(null);
        setAuthError(
          error && error.message
            ? error.message
            : "Session expired. Please login again.",
        );
      }
    }

    bootstrap();

    return () => {
      alive = false;
    };
  }, [session ? session.access_token : ""]);

  async function handleLogin(email, password) {
    try {
      setAuthBusy(true);
      setAuthError("");
      const authResponse = await login(email, password);
      const nextSession = {
        access_token: authResponse.access_token,
        refresh_token: authResponse.refresh_token,
        user: authResponse.user,
      };

      setAuthSession(nextSession);
      setSession(nextSession);
    } catch (error) {
      setAuthError(error && error.message ? error.message : "Login failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignup(email, password) {
    try {
      setAuthBusy(true);
      setAuthError("");
      const signupResponse = await signup(email, password);
      const maybeAccessToken =
        signupResponse && signupResponse.session
          ? signupResponse.session.access_token
          : null;

      if (maybeAccessToken) {
        const nextSession = {
          access_token: signupResponse.session.access_token,
          refresh_token: signupResponse.session.refresh_token,
          user: signupResponse.user,
        };
        setAuthSession(nextSession);
        setSession(nextSession);
        return;
      }

      setAuthError(
        "Signup successful. Please verify email if required, then login.",
      );
    } catch (error) {
      setAuthError(error && error.message ? error.message : "Sign up failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  function handleLogout() {
    clearAuthSession();
    setSession(null);
    setNotes([]);
    setVersionsByNote({});
    setActiveId(null);
    setSelectedVersionId(null);
  }

  if (!session || !session.access_token) {
    return React.createElement(AuthScreen, {
      onLogin: handleLogin,
      onSignup: handleSignup,
      loading: isAuthBusy,
      errorMessage: authError,
    });
  }

  async function handleCreateNote() {
    try {
      setErrorMessage("");
      const created = await createNote({ title: "Untitled", content: "" });
      const normalized = normalizeNote(created);

      setNotes((prevNotes) => [normalized, ...prevNotes]);
      setActiveId(normalized.id);
      setSelectedVersionId(null);

      lastSyncedRef.current[normalized.id] = {
        title: normalized.title,
        content: normalized.content,
      };

      await fetchAndStoreVersions(normalized.id, normalized.title, false);

      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    } catch (error) {
      setErrorMessage(
        error && error.message ? error.message : "Failed to create note.",
      );
    }
  }

  function handleSelectNote(noteId) {
    setActiveId(noteId);
    setSelectedVersionId(null);

    const selected = notes.find((entry) => entry.id === noteId);
    if (!versionsByNote[noteId] && selected) {
      fetchAndStoreVersions(noteId, selected.title, false);
    }

    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }

  async function handleDeleteNote(noteId) {
    const target = notes.find((entry) => entry.id === noteId);
    if (!target) {
      return;
    }

    const confirmed = window.confirm(
      `Delete \"${getDisplayTitle(target)}\"? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      setErrorMessage("");
      await deleteNote(noteId);

      setNotes((prevNotes) => prevNotes.filter((note) => note.id !== noteId));
      setVersionsByNote((prevState) => {
        const nextState = { ...prevState };
        delete nextState[noteId];
        return nextState;
      });
      delete lastSyncedRef.current[noteId];

      if (activeId === noteId) {
        const remaining = sortedNotes.filter((note) => note.id !== noteId);
        const nextActive = remaining[0] ? remaining[0].id : null;

        setActiveId(nextActive);
        setSelectedVersionId(null);

        if (nextActive && !versionsByNote[nextActive]) {
          const fallback = remaining.find((note) => note.id === nextActive);
          if (fallback) {
            await fetchAndStoreVersions(nextActive, fallback.title, false);
          }
        }
      }
    } catch (error) {
      setErrorMessage(
        error && error.message ? error.message : "Failed to delete note.",
      );
    }
  }

  function patchActiveNote(nextStateFactory) {
    setNotes((prevNotes) =>
      prevNotes.map((note) => {
        if (note.id !== activeId) {
          return note;
        }

        return nextStateFactory(note);
      }),
    );
  }

  function handleContentChange(nextContent) {
    setSelectedVersionId(null);

    patchActiveNote((note) => ({
      ...note,
      content: nextContent,
      updatedAt: Date.now(),
    }));
  }

  function handleTitleChange(nextTitle) {
    setSelectedVersionId(null);

    patchActiveNote((note) => ({
      ...note,
      title: nextTitle,
      updatedAt: Date.now(),
    }));
  }

  function handleSidebarToggle() {
    setSidebarOpen((prevState) => !prevState);
  }

  function handleSelectVersion(versionId) {
    setSelectedVersionId(versionId);
  }

  function handleExitPreview() {
    setSelectedVersionId(null);
  }

  async function handleRestoreVersion(versionId) {
    const selected = versions.find((entry) => entry.id === versionId);

    if (!activeNote || !selected) {
      return;
    }

    setSelectedVersionId(null);

    patchActiveNote((note) => ({
      ...note,
      title: selected.title,
      content: selected.content,
      updatedAt: Date.now(),
    }));

    try {
      const updated = await updateNote(activeNote.id, {
        title: selected.title,
        content: selected.content,
      });
      const normalized = normalizeNote(updated);

      setNotes((prevNotes) =>
        prevNotes.map((note) =>
          note.id === normalized.id ? { ...note, ...normalized } : note,
        ),
      );

      lastSyncedRef.current[normalized.id] = {
        title: normalized.title,
        content: normalized.content,
      };
    } catch (error) {
      setErrorMessage(
        error && error.message ? error.message : "Failed to restore version.",
      );
    }
  }

  async function handleAiRewrite() {
    if (!activeNote || isAiRewriting) {
      return;
    }

    setErrorMessage("");
    setSelectedVersionId(null);
    setAiRewriting(true);

    try {
      const job = await createRewriteJob(activeNote.id, "");
      const jobId = job && job.job_id ? job.job_id : "";

      if (!jobId) {
        throw new Error("Rewrite job did not return job_id.");
      }

      let result = null;
      for (let attempt = 0; attempt < 24; attempt += 1) {
        await wait(900);
        const polled = await getRewriteJob(jobId);

        if (
          polled &&
          (polled.status === "done" || polled.status === "failed")
        ) {
          result = polled;
          break;
        }
      }

      if (!result) {
        throw new Error("Rewrite timed out. Try again.");
      }

      if (result.status !== "done") {
        throw new Error(
          typeof result.output === "string" && result.output
            ? result.output
            : "Rewrite job failed.",
        );
      }

      const refreshed = await getNote(activeNote.id);
      const normalized = normalizeNote(refreshed);

      setNotes((prevNotes) =>
        prevNotes.map((note) =>
          note.id === normalized.id ? { ...note, ...normalized } : note,
        ),
      );

      lastSyncedRef.current[normalized.id] = {
        title: normalized.title,
        content: normalized.content,
      };

      await fetchAndStoreVersions(normalized.id, normalized.title, true);
    } catch (error) {
      setErrorMessage(
        error && error.message ? error.message : "AI rewrite failed.",
      );
    } finally {
      setAiRewriting(false);
    }
  }

  async function handleManualSave() {
    if (!activeNote || isSavingBucket) {
      return;
    }

    try {
      setErrorMessage("");
      setSavingBucket(true);

      // Persist latest editor state to DB first, then save snapshot to storage bucket.
      const updated = await updateNote(activeNote.id, {
        title: activeNote.title,
        content: activeNote.content,
      });
      const normalized = normalizeNote(updated);

      setNotes((prevNotes) =>
        prevNotes.map((note) =>
          note.id === normalized.id ? { ...note, ...normalized } : note,
        ),
      );

      lastSyncedRef.current[normalized.id] = {
        title: normalized.title,
        content: normalized.content,
      };

      await saveNoteToBucket(activeNote.id);
      await fetchAndStoreVersions(normalized.id, normalized.title, false);
    } catch (error) {
      setErrorMessage(
        error && error.message
          ? error.message
          : "Failed to save note to bucket.",
      );
    } finally {
      setSavingBucket(false);
    }
  }

  return React.createElement(
    "div",
    {
      className:
        "relative h-screen overflow-hidden bg-[#0f0f0f] font-sans text-zinc-200 antialiased",
    },
    React.createElement(
      "div",
      {
        className: `grid h-full transition-[grid-template-columns] duration-300 ease-out ${isSidebarOpen ? "lg:grid-cols-[15.5rem_minmax(0,1fr)_22rem]" : "lg:grid-cols-[0_minmax(0,1fr)_22rem]"}`,
      },
      React.createElement(Sidebar, {
        isOpen: isSidebarOpen,
        notes: sortedNotes,
        activeId: activeNote ? activeNote.id : null,
        onCreate: handleCreateNote,
        onSelect: handleSelectNote,
        onDelete: handleDeleteNote,
      }),
      React.createElement(
        "main",
        {
          className:
            "relative flex min-w-0 flex-col border-r border-zinc-800/70",
        },
        React.createElement(
          "header",
          {
            className:
              "flex h-12 items-center gap-2 border-b border-zinc-800/70 px-3 text-sm md:px-6",
          },
          React.createElement(
            "button",
            {
              className:
                "inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-200 focus:outline-none",
              type: "button",
              onClick: handleSidebarToggle,
              "aria-label": "Toggle notes menu",
            },
            React.createElement(PanelLeft, { size: 16 }),
          ),
          React.createElement(
            "div",
            {
              className: "min-w-0",
            },
            React.createElement(
              "p",
              { className: "truncate text-sm text-zinc-400" },
              isLoadingNotes ? "Loading notes..." : "Neurodapt (prototype)",
            ),
            React.createElement(
              "p",
              { className: "truncate text-xs text-zinc-500" },
              getDisplayTitle(activeNote),
            ),
          ),
          React.createElement(
            "button",
            {
              type: "button",
              onClick: handleManualSave,
              disabled: !activeNote || isLoadingNotes || isSavingBucket,
              className:
                "ml-auto rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800/70 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60",
            },
            isSavingBucket ? "Saving..." : "Save to Bucket",
          ),
          React.createElement(
            "button",
            {
              type: "button",
              onClick: handleLogout,
              className:
                "rounded-md px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-800/70 hover:text-zinc-200",
            },
            "Logout",
          ),
        ),
        errorMessage
          ? React.createElement(
              "div",
              {
                className:
                  "border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-200",
              },
              errorMessage,
            )
          : null,
        React.createElement(EvolutionEditor, {
          note: activeNote,
          previewVersion: selectedVersion,
          onTitleChange: handleTitleChange,
          onContentChange: handleContentChange,
          onExitPreview: handleExitPreview,
        }),
      ),
      React.createElement(TimelinePanel, {
        versions,
        selectedVersionId,
        onSelectVersion: handleSelectVersion,
        onRestoreVersion: handleRestoreVersion,
        isAiRewriting,
      }),
    ),
    React.createElement(AiRewriteFab, {
      isLoading: isAiRewriting,
      onClick: handleAiRewrite,
      disabled: !activeNote || isLoadingNotes,
    }),
    React.createElement("button", {
      type: "button",
      className: `fixed inset-0 z-20 border-0 bg-black/40 transition-opacity duration-200 lg:hidden ${isSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`,
      onClick: handleSidebarToggle,
      "aria-label": "Close sidebar overlay",
    }),
  );
}
