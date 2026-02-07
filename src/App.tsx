import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronRight } from "lucide-react";
import { loadNotesFromDb, saveNotesToDb } from "./api/client";
import { NoteEditor } from "./components/NoteEditor";
import { Sidebar } from "./components/Sidebar";
import { useNoteStore } from "./store/noteStore";

const UI_SETTINGS_KEY = "deriveAiUiSettings";

export default function App(): JSX.Element {
  const {
    notes,
    selectedNoteId,
    searchQuery,
    tool,
    color,
    penSize,
    highlighterSize,
    showGrid,
    showTextPanel,
    hydrated,
    setHydrated,
    setNotes,
    selectNote,
    createNote,
    renameNote,
    deleteNote,
    setSearchQuery,
    updateNoteText,
    setTool,
    setColor,
    setPenSize,
    setHighlighterSize,
    setShowGrid,
    setShowTextPanel,
    appendStroke,
    eraseAt,
    deleteStrokes,
    moveStrokes,
    panViewport,
    zoomViewportAt,
    resetViewport,
    undoInk,
    redoInk,
    clearInk,
    importBundle,
  } = useNoteStore();

  const [isPending, startTransition] = useTransition();
  const [uiSettingsReady, setUiSettingsReady] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const selectedNote = useMemo(() => {
    if (!selectedNoteId) {
      return notes[0] ?? null;
    }
    return notes.find((note) => note.id === selectedNoteId) ?? null;
  }, [notes, selectedNoteId]);
  const saveTimerRef = useRef<number | null>(null);

  const handleCreateNote = useCallback(() => {
    startTransition(() => {
      createNote();
    });
  }, [createNote, startTransition]);

  useEffect(() => {
    const raw = window.localStorage.getItem(UI_SETTINGS_KEY);
    if (!raw) {
      setUiSettingsReady(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<{
        tool: "pen" | "eraser" | "pan" | "selector" | "highlighter";
        color: string;
        penSize: number;
        highlighterSize: number;
        showGrid: boolean;
        showTextPanel: boolean;
      }>;

      if (parsed.tool) {
        setTool(parsed.tool);
      }
      if (typeof parsed.color === "string") {
        setColor(parsed.color);
      }
      if (typeof parsed.penSize === "number") {
        setPenSize(Math.min(24, Math.max(1, parsed.penSize)));
      }
      if (typeof parsed.highlighterSize === "number") {
        setHighlighterSize(Math.min(32, Math.max(1, parsed.highlighterSize)));
      }
      if (typeof parsed.showGrid === "boolean") {
        setShowGrid(parsed.showGrid);
      }
      if (typeof parsed.showTextPanel === "boolean") {
        setShowTextPanel(parsed.showTextPanel);
      }
    } catch (error: unknown) {
      console.error("Failed to load UI settings", error);
    } finally {
      setUiSettingsReady(true);
    }
  }, [setColor, setShowGrid, setShowTextPanel, setPenSize, setHighlighterSize, setTool]);

  useEffect(() => {
    if (!uiSettingsReady) {
      return;
    }
    window.localStorage.setItem(
      UI_SETTINGS_KEY,
      JSON.stringify({
        tool,
        color,
        penSize,
        highlighterSize,
        showGrid,
        showTextPanel,
      }),
    );
  }, [color, showGrid, showTextPanel, penSize, highlighterSize, tool, uiSettingsReady]);

  useEffect(() => {
    loadNotesFromDb()
      .then((loaded) => {
        setNotes(loaded);
      })
      .finally(() => setHydrated(true));
  }, [setHydrated, setNotes]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveNotesToDb(notes).catch((error: unknown) => {
        console.error("Failed to save notes", error);
      });
    }, 450);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [hydrated, notes]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) {
        return;
      }

      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleCreateNote();
        return;
      }

      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redoInk();
        } else {
          undoInk();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleCreateNote, redoInk, undoInk]);

  useEffect(() => {
    if (!selectedNoteId && notes.length > 0) {
      selectNote(notes[0].id);
    }
  }, [notes, selectedNoteId, selectNote]);

  return (
    <div className="h-full bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 p-3 md:p-4">
      <div className={`mx-auto grid h-full max-w-[1800px] grid-cols-1 gap-2 ${
        sidebarCollapsed ? "md:grid-cols-1" : "md:grid-cols-[300px_1fr]"
      }`}>
        {!sidebarCollapsed && (
          <div className="relative h-full">
            <Sidebar
              notes={notes}
              selectedNoteId={selectedNote?.id ?? null}
              searchQuery={searchQuery}
              isCollapsed={sidebarCollapsed}
              onSearch={setSearchQuery}
              onSelect={selectNote}
              onCreate={handleCreateNote}
              onRename={renameNote}
              onDelete={deleteNote}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
          </div>
        )}
        
        {sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="fixed left-0 top-1/2 z-50 hidden h-24 w-8 -translate-y-1/2 items-center justify-center rounded-r-2xl border border-l-0 border-slate-200 bg-panel text-slate-500 shadow-soft transition-all duration-200 hover:w-10 hover:bg-slate-50 hover:text-slate-700 md:flex"
            title="Open sidebar"
            type="button"
          >
            <ChevronRight size={18} />
          </button>
        )}

        <div className="relative h-full min-h-0 min-w-0">
          <NoteEditor
            note={selectedNote}
            tool={tool}
            color={color}
            penSize={penSize}
            highlighterSize={highlighterSize}
            showGrid={showGrid}
            showTextPanel={showTextPanel}
            onTextChange={updateNoteText}
            onToolChange={setTool}
            onColorChange={setColor}
            onPenSizeChange={setPenSize}
            onHighlighterSizeChange={setHighlighterSize}
            onShowGridChange={setShowGrid}
            onShowTextPanelChange={setShowTextPanel}
            onAppendStroke={appendStroke}
            onEraseAt={eraseAt}
            onDeleteStrokes={deleteStrokes}
            onMoveStrokes={moveStrokes}
            onPanViewport={panViewport}
            onZoomViewportAt={zoomViewportAt}
            onResetViewport={resetViewport}
            onUndo={undoInk}
            onRedo={redoInk}
            onClear={clearInk}
            onImportBundle={importBundle}
          />
          {isPending ? (
            <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-slate-900/85 px-2 py-1 text-xs font-medium text-white">
              Updating
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
