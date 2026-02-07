import { create } from "zustand";
import type { InkStroke, InkTool, Note, NoteBundle } from "../types";
import { strokeIntersectsCircle, strokesToPngDataUrl, uid } from "../utils/ink";

const now = () => Date.now();

function createNote(title = "Untitled Note"): Note {
  const timestamp = now();
  return {
    id: uid(),
    title,
    text: "",
    strokes: [],
    undoneStrokes: [],
    viewport: { offsetX: 0, offsetY: 0, scale: 1 },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

interface NoteState {
  notes: Note[];
  selectedNoteId: string | null;
  searchQuery: string;
  activeTab: "ink" | "text";
  tool: InkTool;
  color: string;
  size: number;
  showGrid: boolean;
  showTextPanel: boolean;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  setNotes: (notes: Note[]) => void;
  selectNote: (id: string) => void;
  createNote: () => void;
  renameNote: (id: string, title: string) => void;
  deleteNote: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setActiveTab: (tab: "ink" | "text") => void;
  updateNoteTitle: (title: string) => void;
  updateNoteText: (text: string) => void;
  setTool: (tool: InkTool) => void;
  setColor: (color: string) => void;
  setSize: (size: number) => void;
  setShowGrid: (show: boolean) => void;
  setShowTextPanel: (show: boolean) => void;
  appendStroke: (noteId: string, stroke: InkStroke) => void;
  eraseAt: (noteId: string, x: number, y: number, radius: number) => void;
  deleteStrokes: (noteId: string, strokeIds: string[]) => void;
  moveStrokes: (noteId: string, strokeIds: string[], dx: number, dy: number) => void;
  undoInk: () => void;
  redoInk: () => void;
  clearInk: () => void;
  panViewport: (noteId: string, dx: number, dy: number) => void;
  zoomViewportAt: (noteId: string, nextScale: number, anchorX: number, anchorY: number) => void;
  resetViewport: () => void;
  importBundle: (bundle: NoteBundle) => void;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 6;

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  selectedNoteId: null,
  searchQuery: "",
  activeTab: "ink",
  tool: "pen",
  color: "#111827",
  size: 6,
  showGrid: false,
  showTextPanel: false,
  hydrated: false,
  setHydrated: (value) => set({ hydrated: value }),
  setNotes: (notes) => {
    const normalized = notes.map((note) => ({
      ...note,
      viewport: {
        offsetX: note.viewport?.offsetX ?? 0,
        offsetY: note.viewport?.offsetY ?? 0,
        scale: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, note.viewport?.scale ?? 1)),
      },
    }));
    const sorted = [...normalized].sort((a, b) => b.updatedAt - a.updatedAt);
    const fallback = sorted.length > 0 ? sorted : [createNote()];
    set({
      notes: fallback,
      selectedNoteId: fallback[0]?.id ?? null,
    });
  },
  selectNote: (id) => set({ selectedNoteId: id }),
  createNote: () => {
    const note = createNote();
    set((state) => ({
      notes: [note, ...state.notes],
      selectedNoteId: note.id,
      activeTab: "ink",
    }));
  },
  renameNote: (id, title) => {
    const cleanTitle = title.trim() || "Untitled Note";
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === id ? { ...note, title: cleanTitle, updatedAt: now() } : note,
      ),
    }));
  },
  deleteNote: (id) => {
    set((state) => {
      const remaining = state.notes.filter((note) => note.id !== id);
      if (remaining.length > 0) {
        return {
          notes: remaining,
          selectedNoteId:
            state.selectedNoteId === id ? remaining[0].id : state.selectedNoteId,
        };
      }
      const fallback = createNote();
      return { notes: [fallback], selectedNoteId: fallback.id };
    });
  },
  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  updateNoteTitle: (title) => {
    const selectedId = get().selectedNoteId;
    if (!selectedId) {
      return;
    }
    get().renameNote(selectedId, title);
  },
  updateNoteText: (text) => {
    const selectedId = get().selectedNoteId;
    if (!selectedId) {
      return;
    }
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === selectedId ? { ...note, text, updatedAt: now() } : note,
      ),
    }));
  },
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setSize: (size) => set({ size }),
  setShowGrid: (show) => set({ showGrid: show }),
  setShowTextPanel: (show) => set({ showTextPanel: show }),
  appendStroke: (noteId, stroke) => {
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === noteId
          ? {
              ...note,
              strokes: [...note.strokes, stroke],
              undoneStrokes: [],
              updatedAt: now(),
            }
          : note,
      ),
    }));
  },
  eraseAt: (noteId, x, y, radius) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) {
          return note;
        }
        const filtered = note.strokes.filter((stroke) => !strokeIntersectsCircle(stroke, x, y, radius));
        if (filtered.length === note.strokes.length) {
          return note;
        }
        return {
          ...note,
          strokes: filtered,
          undoneStrokes: [],
          updatedAt: now(),
        };
      }),
    }));
  },
  deleteStrokes: (noteId, strokeIds) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) {
          return note;
        }
        const filtered = note.strokes.filter((stroke) => !strokeIds.includes(stroke.id));
        if (filtered.length === note.strokes.length) {
          return note;
        }
        return {
          ...note,
          strokes: filtered,
          undoneStrokes: [],
          updatedAt: now(),
        };
      }),
    }));
  },
  moveStrokes: (noteId, strokeIds, dx, dy) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) {
          return note;
        }
        return {
          ...note,
          strokes: note.strokes.map((stroke) => {
            if (!strokeIds.includes(stroke.id)) {
              return stroke;
            }
            return {
              ...stroke,
              points: stroke.points.map((p) => ({
                ...p,
                x: p.x + dx,
                y: p.y + dy,
              })),
            };
          }),
          undoneStrokes: [],
          updatedAt: now(),
        };
      }),
    }));
  },
  undoInk: () => {
    const selectedId = get().selectedNoteId;
    if (!selectedId) {
      return;
    }
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== selectedId || note.strokes.length === 0) {
          return note;
        }
        const last = note.strokes[note.strokes.length - 1];
        return {
          ...note,
          strokes: note.strokes.slice(0, -1),
          undoneStrokes: [...note.undoneStrokes, last],
          updatedAt: now(),
        };
      }),
    }));
  },
  redoInk: () => {
    const selectedId = get().selectedNoteId;
    if (!selectedId) {
      return;
    }
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== selectedId || note.undoneStrokes.length === 0) {
          return note;
        }
        const redoStroke = note.undoneStrokes[note.undoneStrokes.length - 1];
        return {
          ...note,
          strokes: [...note.strokes, redoStroke],
          undoneStrokes: note.undoneStrokes.slice(0, -1),
          updatedAt: now(),
        };
      }),
    }));
  },
  clearInk: () => {
    const selectedId = get().selectedNoteId;
    if (!selectedId) {
      return;
    }
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === selectedId
          ? { ...note, strokes: [], undoneStrokes: [], updatedAt: now() }
          : note,
      ),
    }));
  },
  panViewport: (noteId, dx, dy) => {
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === noteId
          ? {
              ...note,
            viewport: {
              offsetX: note.viewport.offsetX + dx,
              offsetY: note.viewport.offsetY + dy,
              scale: note.viewport.scale,
            },
          }
        : note,
      ),
    }));
  },
  zoomViewportAt: (noteId, nextScale, anchorX, anchorY) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) {
          return note;
        }
        const currentScale = note.viewport.scale || 1;
        const clampedScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextScale));
        const worldX = (anchorX - note.viewport.offsetX) / currentScale;
        const worldY = (anchorY - note.viewport.offsetY) / currentScale;
        return {
          ...note,
          viewport: {
            offsetX: anchorX - worldX * clampedScale,
            offsetY: anchorY - worldY * clampedScale,
            scale: clampedScale,
          },
          updatedAt: now(),
        };
      }),
    }));
  },
  resetViewport: () => {
    const selectedId = get().selectedNoteId;
    if (!selectedId) {
      return;
    }
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === selectedId
          ? { ...note, viewport: { offsetX: 0, offsetY: 0, scale: 1 }, updatedAt: now() }
          : note,
      ),
    }));
  },
  importBundle: (bundle) => {
    const stamp = now();
    const note: Note = {
      id: uid(),
      title: bundle.note.title || "Imported Note",
      text: bundle.note.text || "",
      strokes: bundle.note.strokes || [],
      undoneStrokes: [],
      viewport: { offsetX: 0, offsetY: 0, scale: 1 },
      createdAt: stamp,
      updatedAt: stamp,
    };
    set((state) => ({
      notes: [note, ...state.notes],
      selectedNoteId: note.id,
      activeTab: "ink",
    }));
  },
}));

export function getSelectedNote(state: NoteState): Note | null {
  if (!state.selectedNoteId) {
    return state.notes[0] ?? null;
  }
  return state.notes.find((note) => note.id === state.selectedNoteId) ?? null;
}

export function buildNoteBundle(note: Note): NoteBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    note: {
      title: note.title,
      text: note.text,
      strokes: note.strokes,
      inkPngDataUrl: strokesToPngDataUrl(note.strokes),
    },
  };
}
