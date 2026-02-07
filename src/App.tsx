import { useEffect, useMemo, useRef } from "react";
import { loadNotesFromDb, saveNotesToDb } from "./db/database";
import { NoteEditor } from "./components/NoteEditor";
import { Sidebar } from "./components/Sidebar";
import { useNoteStore } from "./store/noteStore";

export default function App(): JSX.Element {
  const {
    notes,
    selectedNoteId,
    searchQuery,
    activeTab,
    textPreview,
    tool,
    color,
    size,
    hydrated,
    setHydrated,
    setNotes,
    selectNote,
    createNote,
    renameNote,
    deleteNote,
    setSearchQuery,
    setActiveTab,
    setTextPreview,
    updateNoteTitle,
    updateNoteText,
    setTool,
    setColor,
    setSize,
    appendStroke,
    eraseAt,
    panViewport,
    zoomViewportAt,
    resetViewport,
    undoInk,
    redoInk,
    clearInk,
    importBundle,
  } = useNoteStore();

  const selectedNote = useMemo(() => {
    if (!selectedNoteId) {
      return notes[0] ?? null;
    }
    return notes.find((note) => note.id === selectedNoteId) ?? null;
  }, [notes, selectedNoteId]);
  const saveTimerRef = useRef<number | null>(null);

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

    // Debounced autosave for text and ink updates.
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
        createNote();
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
  }, [createNote, redoInk, undoInk]);

  useEffect(() => {
    if (!selectedNoteId && notes.length > 0) {
      selectNote(notes[0].id);
    }
  }, [notes, selectedNoteId, selectNote]);

  return (
    <div className="app-shell">
      <Sidebar
        notes={notes}
        selectedNoteId={selectedNote?.id ?? null}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        onSelect={selectNote}
        onCreate={createNote}
        onRename={renameNote}
        onDelete={deleteNote}
      />
      <NoteEditor
        note={selectedNote}
        activeTab={activeTab}
        textPreview={textPreview}
        tool={tool}
        color={color}
        size={size}
        onTabChange={setActiveTab}
        onTitleChange={updateNoteTitle}
        onTextChange={updateNoteText}
        onTogglePreview={() => setTextPreview(!textPreview)}
        onToolChange={setTool}
        onColorChange={setColor}
        onSizeChange={setSize}
        onAppendStroke={appendStroke}
        onEraseAt={eraseAt}
        onPanViewport={panViewport}
        onZoomViewportAt={zoomViewportAt}
        onResetViewport={resetViewport}
        onUndo={undoInk}
        onRedo={redoInk}
        onClear={clearInk}
        onImportBundle={importBundle}
      />
    </div>
  );
}
