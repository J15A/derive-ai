import { create } from "zustand";
import type {
  ChatMessage,
  InkHistoryAction,
  InkStroke,
  InkTool,
  Note,
  NoteBundle,
  TextAnnotation,
  WhiteboardImage, ShapeType, Shape,
} from "../types";
import { strokeIntersectsCircle, strokesToPngDataUrl, uid } from "../utils/ink";

/** Check if a shape's edges intersect the eraser circle. */
function shapeIntersectsCircle(shape: Shape, cx: number, cy: number, radius: number): boolean {
  if (shape.type === "line" || shape.type === "arrow") {
    // For line/arrow, check distance from point to the line segment
    return pointToSegDist(cx, cy, shape.x, shape.y, shape.x + shape.width, shape.y + shape.height) <= radius + shape.strokeWidth * 0.5;
  }
  if (shape.type === "triangle") {
    // Right triangle: right angle at (x, y+h)
    const rightAngle = { x: shape.x, y: shape.y + shape.height };
    const hLeg = { x: shape.x + shape.width, y: shape.y + shape.height };
    const vLeg = { x: shape.x, y: shape.y };
    const half = shape.strokeWidth * 0.5;
    return (
      pointToSegDist(cx, cy, rightAngle.x, rightAngle.y, hLeg.x, hLeg.y) <= radius + half ||
      pointToSegDist(cx, cy, hLeg.x, hLeg.y, vLeg.x, vLeg.y) <= radius + half ||
      pointToSegDist(cx, cy, vLeg.x, vLeg.y, rightAngle.x, rightAngle.y) <= radius + half
    );
  }
  if (shape.type === "circle") {
    // Ellipse: check if the eraser point is near the ellipse boundary
    const ecx = shape.x + shape.width / 2;
    const ecy = shape.y + shape.height / 2;
    const rx = Math.abs(shape.width) / 2;
    const ry = Math.abs(shape.height) / 2;
    if (rx < 0.01 || ry < 0.01) return false;
    // Normalized distance from center
    const dx = cx - ecx;
    const dy = cy - ecy;
    const normDist = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
    // The eraser hits if the point is near the boundary (normDist ≈ 1)
    const approxR = Math.sqrt(rx * ry); // geometric mean for tolerance
    const tol = (radius + shape.strokeWidth * 0.5) / approxR;
    return Math.abs(normDist - 1) < tol;
  }
  // Rectangle: check the 4 edges
  const x0 = shape.x, y0 = shape.y;
  const x1 = shape.x + shape.width, y1 = shape.y + shape.height;
  const half = shape.strokeWidth * 0.5;
  return (
    pointToSegDist(cx, cy, x0, y0, x1, y0) <= radius + half ||
    pointToSegDist(cx, cy, x1, y0, x1, y1) <= radius + half ||
    pointToSegDist(cx, cy, x1, y1, x0, y1) <= radius + half ||
    pointToSegDist(cx, cy, x0, y1, x0, y0) <= radius + half
  );
}

/** Point-to-segment distance. */
function pointToSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * abx + (py - ay) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
}

const now = () => Date.now();

function createNote(title = "Untitled Note"): Note {
  const timestamp = now();
  return {
    id: uid(),
    title,
    text: "",
    chatMessages: [],
    strokes: [],
    images: [],
    shapes: [],
    undoneStrokes: [],
    textAnnotations: [],
    undoHistory: [],
    redoHistory: [],
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
  shapeType: ShapeType;
  color: string;
  highlighterColor: string;
  penSize: number;
  highlighterSize: number;
  showGrid: boolean;
  showTextPanel: boolean;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  setNotes: (notes: Note[]) => void;
  selectNote: (id: string) => void;
  createNote: () => Note;
  renameNote: (id: string, title: string) => void;
  deleteNote: (id: string) => void;
  reorderNotes: (fromIndex: number, toIndex: number) => void;
  setSearchQuery: (query: string) => void;
  setActiveTab: (tab: "ink" | "text") => void;
  updateNoteTitle: (title: string) => void;
  updateNoteText: (text: string) => void;
  addUserChatMessage: (noteId: string, content: string) => ChatMessage;
  addAssistantChatMessage: (noteId: string, content: string) => ChatMessage;
  updateChatMessageContent: (noteId: string, messageId: string, content: string) => void;
  removeChatMessage: (noteId: string, messageId: string) => void;
  clearChatMessages: (noteId: string) => void;
  setTool: (tool: InkTool) => void;
  setShapeType: (shapeType: ShapeType) => void;
  setColor: (color: string) => void;
  setHighlighterColor: (color: string) => void;
  setPenSize: (size: number) => void;
  setHighlighterSize: (size: number) => void;
  setShowGrid: (show: boolean) => void;
  setShowTextPanel: (show: boolean) => void;
  appendStroke: (noteId: string, stroke: InkStroke) => void;
  eraseAt: (noteId: string, x: number, y: number, radius: number) => void;
  deleteStrokes: (noteId: string, strokeIds: string[]) => void;
  moveStrokes: (noteId: string, strokeIds: string[], dx: number, dy: number) => void;
  duplicateStrokes: (noteId: string, strokeIds: string[]) => string[];
  changeStrokesColor: (noteId: string, strokeIds: string[], newColor: string) => void;
  addTextAnnotation: (noteId: string, annotation: TextAnnotation) => void;
  addShape: (noteId: string, shape: Shape) => void;
  addImage: (noteId: string, image: WhiteboardImage) => void;
  deleteShapes: (noteId: string, shapeIds: string[]) => void;
  moveShapes: (noteId: string, shapeIds: string[], dx: number, dy: number) => void;
  scaleShapes: (noteId: string, shapeIds: string[], scale: number, centerX: number, centerY: number) => void;
  deleteImages: (noteId: string, imageIds: string[]) => void;
  moveImages: (noteId: string, imageIds: string[], dx: number, dy: number) => void;
  scaleStrokes: (noteId: string, strokeIds: string[], scale: number, centerX: number, centerY: number) => void;
  scaleImages: (noteId: string, imageIds: string[], scale: number, centerX: number, centerY: number) => void;
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
const ERASE_MERGE_WINDOW_MS = 250;
const TRANSFORM_MERGE_WINDOW_MS = 250;

/**
 * Build a history entry that snapshots before/after state of all drawable collections.
 * If `mergeWith` is provided the before-snapshot is taken from that earlier action
 * (useful for merging rapid-fire eraser / drag events into one undo step).
 */
function makeHistoryAction(
  label: string,
  before: Pick<Note, "strokes" | "shapes" | "textAnnotations" | "images">,
  after: Pick<Note, "strokes" | "shapes" | "textAnnotations" | "images">,
  mergeWith?: InkHistoryAction,
): InkHistoryAction {
  return {
    label,
    beforeStrokes: mergeWith ? mergeWith.beforeStrokes : before.strokes,
    afterStrokes: after.strokes,
    beforeShapes: mergeWith ? mergeWith.beforeShapes : before.shapes,
    afterShapes: after.shapes,
    beforeTextAnnotations: mergeWith ? mergeWith.beforeTextAnnotations : before.textAnnotations,
    afterTextAnnotations: after.textAnnotations,
    beforeImages: mergeWith ? mergeWith.beforeImages : before.images,
    afterImages: after.images,
    timestamp: now(),
  };
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  selectedNoteId: null,
  searchQuery: "",
  activeTab: "ink",
  tool: "pen",
  shapeType: "rectangle",
  color: "#111827",
  highlighterColor: "#FFEB3B",
  penSize: 6,
  highlighterSize: 16,
  showGrid: false,
  showTextPanel: false,
  hydrated: false,
  setHydrated: (value) => set({ hydrated: value }),
  setNotes: (notes) => {
    const normalized = notes.map((note) => ({
      ...note,
      shapes: note.shapes ?? [],
      text: note.text ?? "",
      chatMessages: note.chatMessages ?? [],
      strokes: note.strokes ?? [],
      images: note.images ?? [],
      undoneStrokes: note.undoneStrokes ?? [],
      textAnnotations: note.textAnnotations ?? [],
      undoHistory: [],
      redoHistory: [],
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
    return note;
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
  reorderNotes: (fromIndex, toIndex) => {
    set((state) => {
      const newNotes = [...state.notes];
      const [movedNote] = newNotes.splice(fromIndex, 1);
      newNotes.splice(toIndex, 0, movedNote);
      return { notes: newNotes };
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
  addUserChatMessage: (noteId, content) => {
    const message: ChatMessage = {
      id: uid(),
      role: "user",
      content: content.trim(),
      createdAt: now(),
    };
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === noteId
          ? {
              ...note,
              chatMessages: [...(note.chatMessages ?? []), message],
              updatedAt: now(),
            }
          : note,
      ),
    }));
    return message;
  },
  addAssistantChatMessage: (noteId, content) => {
    const message: ChatMessage = {
      id: uid(),
      role: "assistant",
      content: content.trim(),
      createdAt: now(),
    };
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === noteId
          ? {
              ...note,
              chatMessages: [...(note.chatMessages ?? []), message],
              updatedAt: now(),
            }
          : note,
      ),
    }));
    return message;
  },
  updateChatMessageContent: (noteId, messageId, content) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) {
          return note;
        }
        return {
          ...note,
          chatMessages: (note.chatMessages ?? []).map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  content,
                }
              : message,
          ),
          updatedAt: now(),
        };
      }),
    }));
  },
  removeChatMessage: (noteId, messageId) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) {
          return note;
        }
        return {
          ...note,
          chatMessages: (note.chatMessages ?? []).filter((message) => message.id !== messageId),
          updatedAt: now(),
        };
      }),
    }));
  },
  clearChatMessages: (noteId) => {
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === noteId
          ? {
              ...note,
              chatMessages: [],
              updatedAt: now(),
            }
          : note,
      ),
    }));
  },
  setTool: (tool) => set({ tool }),
  setShapeType: (shapeType) => set({ shapeType }),
  setColor: (color) => set({ color }),
  setHighlighterColor: (color) => set({ highlighterColor: color }),
  setPenSize: (size) => set({ penSize: size }),
  setHighlighterSize: (size) => set({ highlighterSize: size }),
  setShowGrid: (show) => set({ showGrid: show }),
  setShowTextPanel: (show) => set({ showTextPanel: show }),
  appendStroke: (noteId, stroke) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) return note;
        const nextStrokes = [...note.strokes, stroke];
        const action = makeHistoryAction("addStroke", note, { ...note, strokes: nextStrokes });
        return {
          ...note,
          strokes: nextStrokes,
          undoHistory: [...note.undoHistory, action],
          redoHistory: [],
          updatedAt: now(),
        };
      }),
    }));
  },
  eraseAt: (noteId, x, y, radius) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) return note;

        const filteredStrokes = note.strokes.filter((stroke) => !strokeIntersectsCircle(stroke, x, y, radius));

        // Filter out text annotations that intersect with the eraser
        const filteredAnnotations = (note.textAnnotations ?? []).filter((annotation) => {
          const lines = annotation.text.split('\n');
          const textWidth = Math.max(...lines.map(line => line.length)) * annotation.fontSize * 0.6;
          const lineHeight = annotation.fontSize * 1.1;
          const textHeight = lines.length * lineHeight;
          const closestX = Math.max(annotation.x, Math.min(x, annotation.x + textWidth));
          const closestY = Math.max(annotation.y, Math.min(y, annotation.y + textHeight));
          const distanceX = x - closestX;
          const distanceY = y - closestY;
          return (distanceX * distanceX + distanceY * distanceY) > radius * radius;
        });

        // Filter out shapes that intersect with the eraser
        const filteredShapes = note.shapes.filter((shape) => {
          return !shapeIntersectsCircle(shape, x, y, radius);
        });

        if (filteredStrokes.length === note.strokes.length &&
            filteredAnnotations.length === (note.textAnnotations ?? []).length &&
            filteredShapes.length === note.shapes.length) {
          return note;
        }

        const ts = now();
        const afterState = { ...note, strokes: filteredStrokes, textAnnotations: filteredAnnotations, shapes: filteredShapes };
        const lastAction = note.undoHistory[note.undoHistory.length - 1];
        const shouldMerge = lastAction?.label === "erase" && ts - lastAction.timestamp < ERASE_MERGE_WINDOW_MS;

        const action = makeHistoryAction("erase", note, afterState, shouldMerge ? lastAction : undefined);

        return {
          ...note,
          strokes: filteredStrokes,
          shapes: filteredShapes,
          textAnnotations: filteredAnnotations,
          undoHistory: shouldMerge
            ? [...note.undoHistory.slice(0, -1), action]
            : [...note.undoHistory, action],
          redoHistory: [],
          updatedAt: ts,
        };
      }),
    }));
  },
  deleteStrokes: (noteId, strokeIds) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) return note;
        const filtered = note.strokes.filter((stroke) => !strokeIds.includes(stroke.id));
        if (filtered.length === note.strokes.length) return note;
        const action = makeHistoryAction("deleteStrokes", note, { ...note, strokes: filtered });
        return {
          ...note,
          strokes: filtered,
          undoHistory: [...note.undoHistory, action],
          redoHistory: [],
          updatedAt: now(),
        };
      }),
    }));
  },
  moveStrokes: (noteId, strokeIds, dx, dy) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId || (dx === 0 && dy === 0)) return note;
        const nextStrokes = note.strokes.map((stroke) => {
          if (!strokeIds.includes(stroke.id)) return stroke;
          return { ...stroke, points: stroke.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) };
        });
        const ts = now();
        const afterState = { ...note, strokes: nextStrokes };
        const lastAction = note.undoHistory[note.undoHistory.length - 1];
        const shouldMerge = lastAction?.label === "moveStrokes" && ts - lastAction.timestamp < TRANSFORM_MERGE_WINDOW_MS;
        const action = makeHistoryAction("moveStrokes", note, afterState, shouldMerge ? lastAction : undefined);
        return {
          ...note,
          strokes: nextStrokes,
          undoHistory: shouldMerge
            ? [...note.undoHistory.slice(0, -1), action]
            : [...note.undoHistory, action],
          redoHistory: [],
          updatedAt: ts,
        };
      }),
    }));
  },
  duplicateStrokes: (noteId, strokeIds) => {
    const newIds: string[] = [];
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) return note;
        const duplicates = note.strokes
          .filter((stroke) => strokeIds.includes(stroke.id))
          .map((stroke) => {
            const newId = uid();
            newIds.push(newId);
            return { ...stroke, id: newId, points: stroke.points.map((p) => ({ ...p, x: p.x + 20, y: p.y + 20 })) };
          });
        const nextStrokes = [...note.strokes, ...duplicates];
        const action = makeHistoryAction("duplicateStrokes", note, { ...note, strokes: nextStrokes });
        return {
          ...note,
          strokes: nextStrokes,
          undoHistory: [...note.undoHistory, action],
          redoHistory: [],
          updatedAt: now(),
        };
      }),
    }));
    return newIds;
  },
  changeStrokesColor: (noteId, strokeIds, newColor) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) return note;
        const nextStrokes = note.strokes.map((stroke) =>
          strokeIds.includes(stroke.id) ? { ...stroke, color: newColor } : stroke,
        );
        const action = makeHistoryAction("changeStrokesColor", note, { ...note, strokes: nextStrokes });
        return {
          ...note,
          strokes: nextStrokes,
          undoHistory: [...note.undoHistory, action],
          redoHistory: [],
          updatedAt: now(),
        };
      }),
    }));
  },
  addTextAnnotation: (noteId, annotation) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) return note;
        const nextAnnotations = [...(note.textAnnotations ?? []), annotation];
        const action = makeHistoryAction("addTextAnnotation", note, { ...note, textAnnotations: nextAnnotations });
        return {
          ...note,
          textAnnotations: nextAnnotations,
          undoHistory: [...note.undoHistory, action],
          redoHistory: [],
          updatedAt: now(),
        };
      }),
    }));
  },
  addImage: (noteId, image) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) return note;
        const nextImages = [...note.images, image];
        const action = makeHistoryAction("addImage", note, { ...note, images: nextImages });
        return {
          ...note,
          images: nextImages,
          undoHistory: [...note.undoHistory, action],
          redoHistory: [],
          updatedAt: now(),
        };
      }),
    }));
  },
  addShape: (noteId, shape) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) return note;
        const nextShapes = [...note.shapes, shape];
        const action = makeHistoryAction("addShape", note, { ...note, shapes: nextShapes });
        return {
          ...note,
          shapes: nextShapes,
          undoHistory: [...note.undoHistory, action],
          redoHistory: [],
          updatedAt: now(),
        };
      }),
    }));
  },
  deleteShapes: (noteId, shapeIds) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) return note;
        const nextShapes = note.shapes.filter((shape) => !shapeIds.includes(shape.id));
        if (nextShapes.length === note.shapes.length) return note;
        const action = makeHistoryAction("deleteShapes", note, { ...note, shapes: nextShapes });
        return {
          ...note,
          shapes: nextShapes,
          undoHistory: [...note.undoHistory, action],
          redoHistory: [],
          updatedAt: now(),
        };
      }),
    }));
  },
  moveShapes: (noteId, shapeIds, dx, dy) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId || (dx === 0 && dy === 0)) return note;
        const nextShapes = note.shapes.map((shape) =>
          shapeIds.includes(shape.id) ? { ...shape, x: shape.x + dx, y: shape.y + dy } : shape,
        );
        const ts = now();
        const afterState = { ...note, shapes: nextShapes };
        const lastAction = note.undoHistory[note.undoHistory.length - 1];
        const shouldMerge = lastAction?.label === "moveShapes" && ts - lastAction.timestamp < TRANSFORM_MERGE_WINDOW_MS;
        const action = makeHistoryAction("moveShapes", note, afterState, shouldMerge ? lastAction : undefined);
        return {
          ...note,
          shapes: nextShapes,
          undoHistory: shouldMerge
            ? [...note.undoHistory.slice(0, -1), action]
            : [...note.undoHistory, action],
          redoHistory: [],
          updatedAt: ts,
        };
      }),
    }));
  },
  scaleShapes: (noteId, shapeIds, scale, centerX, centerY) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId || scale === 1) return note;
        const nextShapes = note.shapes.map((shape) =>
          shapeIds.includes(shape.id)
            ? {
                ...shape,
                x: centerX + (shape.x - centerX) * scale,
                y: centerY + (shape.y - centerY) * scale,
                width: shape.width * scale,
                height: shape.height * scale,
                strokeWidth: shape.strokeWidth * scale,
              }
            : shape,
        );
        const ts = now();
        const afterState = { ...note, shapes: nextShapes };
        const lastAction = note.undoHistory[note.undoHistory.length - 1];
        const shouldMerge = lastAction?.label === "scaleShapes" && ts - lastAction.timestamp < TRANSFORM_MERGE_WINDOW_MS;
        const action = makeHistoryAction("scaleShapes", note, afterState, shouldMerge ? lastAction : undefined);
        return {
          ...note,
          shapes: nextShapes,
          undoHistory: shouldMerge
            ? [...note.undoHistory.slice(0, -1), action]
            : [...note.undoHistory, action],
          redoHistory: [],
          updatedAt: ts,
        };
      }),
    }));
  },
  deleteImages: (noteId, imageIds) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) return note;
        const nextImages = note.images.filter((image) => !imageIds.includes(image.id));
        if (nextImages.length === note.images.length) return note;
        const action = makeHistoryAction("deleteImages", note, { ...note, images: nextImages });
        return {
          ...note,
          images: nextImages,
          undoHistory: [...note.undoHistory, action],
          redoHistory: [],
          updatedAt: now(),
        };
      }),
    }));
  },
  moveImages: (noteId, imageIds, dx, dy) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId || (dx === 0 && dy === 0)) return note;
        const nextImages = note.images.map((image) =>
          imageIds.includes(image.id) ? { ...image, x: image.x + dx, y: image.y + dy } : image,
        );
        const ts = now();
        const afterState = { ...note, images: nextImages };
        const lastAction = note.undoHistory[note.undoHistory.length - 1];
        const shouldMerge = lastAction?.label === "moveImages" && ts - lastAction.timestamp < TRANSFORM_MERGE_WINDOW_MS;
        const action = makeHistoryAction("moveImages", note, afterState, shouldMerge ? lastAction : undefined);
        return {
          ...note,
          images: nextImages,
          undoHistory: shouldMerge
            ? [...note.undoHistory.slice(0, -1), action]
            : [...note.undoHistory, action],
          redoHistory: [],
          updatedAt: ts,
        };
      }),
    }));
  },
  scaleStrokes: (noteId, strokeIds, scale, centerX, centerY) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) return note;
        const nextStrokes = note.strokes.map((stroke) =>
          strokeIds.includes(stroke.id)
            ? {
                ...stroke,
                points: stroke.points.map((p) => ({
                  ...p,
                  x: centerX + (p.x - centerX) * scale,
                  y: centerY + (p.y - centerY) * scale,
                })),
                baseSize: stroke.baseSize * scale,
              }
            : stroke,
        );
        const ts = now();
        const afterState = { ...note, strokes: nextStrokes };
        const lastAction = note.undoHistory[note.undoHistory.length - 1];
        const shouldMerge = lastAction?.label === "scaleStrokes" && ts - lastAction.timestamp < TRANSFORM_MERGE_WINDOW_MS;
        const action = makeHistoryAction("scaleStrokes", note, afterState, shouldMerge ? lastAction : undefined);
        return {
          ...note,
          strokes: nextStrokes,
          undoHistory: shouldMerge
            ? [...note.undoHistory.slice(0, -1), action]
            : [...note.undoHistory, action],
          redoHistory: [],
          updatedAt: ts,
        };
      }),
    }));
  },
  scaleImages: (noteId, imageIds, scale, centerX, centerY) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId || scale === 1) return note;
        const nextImages = note.images.map((image) =>
          imageIds.includes(image.id)
            ? {
                ...image,
                x: centerX + (image.x - centerX) * scale,
                y: centerY + (image.y - centerY) * scale,
                width: image.width * scale,
                height: image.height * scale,
              }
            : image,
        );
        const ts = now();
        const afterState = { ...note, images: nextImages };
        const lastAction = note.undoHistory[note.undoHistory.length - 1];
        const shouldMerge = lastAction?.label === "scaleImages" && ts - lastAction.timestamp < TRANSFORM_MERGE_WINDOW_MS;
        const action = makeHistoryAction("scaleImages", note, afterState, shouldMerge ? lastAction : undefined);
        return {
          ...note,
          images: nextImages,
          undoHistory: shouldMerge
            ? [...note.undoHistory.slice(0, -1), action]
            : [...note.undoHistory, action],
          redoHistory: [],
          updatedAt: ts,
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
        const undoHistory = note.undoHistory ?? [];
        if (note.id !== selectedId || undoHistory.length === 0) {
          return note;
        }

        const action = undoHistory[undoHistory.length - 1];

        return {
          ...note,
          strokes: action.beforeStrokes,
          shapes: action.beforeShapes,
          textAnnotations: action.beforeTextAnnotations,
          images: action.beforeImages,
          undoHistory: undoHistory.slice(0, -1),
          redoHistory: [...(note.redoHistory ?? []), action],
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
        const redoHistory = note.redoHistory ?? [];
        if (note.id !== selectedId || redoHistory.length === 0) {
          return note;
        }

        const action = redoHistory[redoHistory.length - 1];

        return {
          ...note,
          strokes: action.afterStrokes,
          shapes: action.afterShapes,
          textAnnotations: action.afterTextAnnotations,
          images: action.afterImages,
          undoHistory: [...(note.undoHistory ?? []), action],
          redoHistory: redoHistory.slice(0, -1),
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
      notes: state.notes.map((note) => {
        if (note.id !== selectedId) return note;
        // Only push history if there is anything to clear
        const hasContent = note.strokes.length > 0 || note.shapes.length > 0 ||
          (note.textAnnotations ?? []).length > 0 || note.images.length > 0;
        if (!hasContent) return note;
        const emptyState = { strokes: [] as typeof note.strokes, shapes: [] as typeof note.shapes, textAnnotations: [] as typeof note.textAnnotations, images: [] as typeof note.images };
        const action = makeHistoryAction("clearAll", note, { ...note, ...emptyState });
        return {
          ...note,
          ...emptyState,
          undoHistory: [...note.undoHistory, action],
          redoHistory: [],
          updatedAt: now(),
        };
      }),
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
      chatMessages: [],
      strokes: bundle.note.strokes || [],
      shapes: [],
      images: bundle.note.images || [],
      undoneStrokes: [],
      textAnnotations: [],
      undoHistory: [],
      redoHistory: [],
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
      images: note.images,
      inkPngDataUrl: strokesToPngDataUrl(note.strokes),
    },
  };
}
