import { create } from "zustand";
import type {
  ChatMessage,
  InkHistoryAction,
  InkStroke,
  InkTool,
  Note,
  NoteBundle,
  TextAnnotation,
  WhiteboardImage,
} from "../types";
import { strokeIntersectsCircle, strokesToPngDataUrl, uid } from "../utils/ink";

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
  color: string;
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
  setColor: (color: string) => void;
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
  addImage: (noteId: string, image: WhiteboardImage) => void;
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
const IMAGE_TRANSFORM_MERGE_WINDOW_MS = 250;

function sameImageIdSet(a: WhiteboardImage[] | undefined, b: WhiteboardImage[] | undefined): boolean {
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  const ids = new Set(a.map((image) => image.id));
  return b.every((image) => ids.has(image.id));
}

function applyImageSnapshot(images: WhiteboardImage[], snapshot: WhiteboardImage[] | undefined): WhiteboardImage[] {
  if (!snapshot || snapshot.length === 0) {
    return images;
  }
  const imageMap = new Map(snapshot.map((image) => [image.id, image]));
  return images.map((image) => imageMap.get(image.id) ?? image);
}

function appendMissingImages(images: WhiteboardImage[], additions: WhiteboardImage[] | undefined): WhiteboardImage[] {
  if (!additions || additions.length === 0) {
    return images;
  }
  const existingIds = new Set(images.map((image) => image.id));
  return [
    ...images,
    ...additions.filter((image) => !existingIds.has(image.id)),
  ];
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  selectedNoteId: null,
  searchQuery: "",
  activeTab: "ink",
  tool: "pen",
  color: "#111827",
  penSize: 6,
  highlighterSize: 16,
  showGrid: false,
  showTextPanel: false,
  hydrated: false,
  setHydrated: (value) => set({ hydrated: value }),
  setNotes: (notes) => {
    const normalized = notes.map((note) => ({
      ...note,
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
  setColor: (color) => set({ color }),
  setPenSize: (size) => set({ penSize: size }),
  setHighlighterSize: (size) => set({ highlighterSize: size }),
  setShowGrid: (show) => set({ showGrid: show }),
  setShowTextPanel: (show) => set({ showTextPanel: show }),
  appendStroke: (noteId, stroke) => {
    const actionTimestamp = now();
    const historyAction: InkHistoryAction = {
      type: "addStroke",
      strokes: [stroke],
      timestamp: actionTimestamp,
    };
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === noteId
          ? {
              ...note,
              strokes: [...note.strokes, stroke],
              undoneStrokes: [],
              undoHistory: [...(note.undoHistory ?? []), historyAction],
              redoHistory: [],
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
        
        const erasedStrokes = note.strokes.filter((stroke) => strokeIntersectsCircle(stroke, x, y, radius));
        const filteredStrokes = note.strokes.filter((stroke) => !strokeIntersectsCircle(stroke, x, y, radius));
        
        // Filter out text annotations that intersect with the eraser
        const erasedAnnotations = (note.textAnnotations ?? []).filter((annotation) => {
          // Check if eraser circle intersects with text annotation bounding box
          // Account for multiline text
          const lines = annotation.text.split('\n');
          const textWidth = Math.max(...lines.map(line => line.length)) * annotation.fontSize * 0.6; // Rough estimate
          const lineHeight = annotation.fontSize * 1.1; // Match rendering line height
          const textHeight = lines.length * lineHeight;
          
          // Find closest point on the rectangle to the circle center
          const closestX = Math.max(annotation.x, Math.min(x, annotation.x + textWidth));
          const closestY = Math.max(annotation.y, Math.min(y, annotation.y + textHeight));
          
          // Calculate distance between circle center and closest point
          const distanceX = x - closestX;
          const distanceY = y - closestY;
          const distanceSquared = distanceX * distanceX + distanceY * distanceY;
          
          return distanceSquared <= radius * radius;
        });

        const filteredAnnotations = (note.textAnnotations ?? []).filter(
          (annotation) => !erasedAnnotations.some((erased) => erased.id === annotation.id),
        );
        
        if (filteredStrokes.length === note.strokes.length && 
            filteredAnnotations.length === (note.textAnnotations ?? []).length) {
          return note;
        }
        
        const actionTimestamp = now();
        const lastAction = note.undoHistory[note.undoHistory.length - 1];
        const shouldMergeWithPreviousErase =
          lastAction?.type === "erase" && actionTimestamp - lastAction.timestamp < 250;

        const nextUndoHistory: InkHistoryAction[] = shouldMergeWithPreviousErase
          ? [
              ...note.undoHistory.slice(0, -1),
              {
                type: "erase" as const,
                strokes: [
                  ...lastAction.strokes,
                  ...erasedStrokes.filter(
                    (stroke) => !lastAction.strokes.some((existing) => existing.id === stroke.id),
                  ),
                ],
                textAnnotations: [
                  ...(lastAction.textAnnotations ?? []),
                  ...erasedAnnotations.filter(
                    (annotation) =>
                      !(lastAction.textAnnotations ?? []).some((existing) => existing.id === annotation.id),
                  ),
                ],
                timestamp: actionTimestamp,
              },
            ]
          : [
              ...note.undoHistory,
              {
                type: "erase" as const,
                strokes: erasedStrokes,
                textAnnotations: erasedAnnotations,
                timestamp: actionTimestamp,
              },
            ];

        return {
          ...note,
          strokes: filteredStrokes,
          textAnnotations: filteredAnnotations,
          undoneStrokes: [],
          undoHistory: nextUndoHistory,
          redoHistory: [],
          updatedAt: actionTimestamp,
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
  duplicateStrokes: (noteId, strokeIds) => {
    const newIds: string[] = [];
    
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) {
          return note;
        }
        const duplicates = note.strokes
          .filter((stroke) => strokeIds.includes(stroke.id))
          .map((stroke) => {
            const newId = uid();
            newIds.push(newId);
            return {
              ...stroke,
              id: newId,
              points: stroke.points.map((p) => ({
                ...p,
                x: p.x + 20, // Offset duplicates slightly
                y: p.y + 20,
              })),
            };
          });
        const actionTimestamp = now();
        const historyAction: InkHistoryAction = {
          type: "addStroke",
          strokes: duplicates,
          timestamp: actionTimestamp,
        };
        return {
          ...note,
          strokes: [...note.strokes, ...duplicates],
          undoneStrokes: [],
          undoHistory: [...(note.undoHistory ?? []), historyAction],
          redoHistory: [],
          updatedAt: actionTimestamp,
        };
      }),
    }));
    
    return newIds;
  },
  changeStrokesColor: (noteId, strokeIds, newColor) => {
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
              color: newColor,
            };
          }),
          undoneStrokes: [],
          updatedAt: now(),
        };
      }),
    }));
  },
  addTextAnnotation: (noteId, annotation) => {
    const actionTimestamp = now();
    const historyAction: InkHistoryAction = {
      type: "addTextAnnotation",
      strokes: [],
      textAnnotations: [annotation],
      timestamp: actionTimestamp,
    };
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === noteId
          ? {
              ...note,
              textAnnotations: [...(note.textAnnotations ?? []), annotation],
              undoHistory: [...(note.undoHistory ?? []), historyAction],
              redoHistory: [],
              updatedAt: actionTimestamp,
            }
          : note,
      ),
    }));
  },
  addImage: (noteId, image) => {
    const actionTimestamp = now();
    const historyAction: InkHistoryAction = {
      type: "addImage",
      strokes: [],
      images: [image],
      timestamp: actionTimestamp,
    };
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === noteId
          ? {
              ...note,
              images: [...note.images, image],
              undoHistory: [...(note.undoHistory ?? []), historyAction],
              redoHistory: [],
              updatedAt: actionTimestamp,
            }
          : note,
      ),
    }));
  },
  deleteImages: (noteId, imageIds) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) {
          return note;
        }

        const deletedImages = note.images.filter((image) => imageIds.includes(image.id));
        if (deletedImages.length === 0) {
          return note;
        }

        const actionTimestamp = now();
        const historyAction: InkHistoryAction = {
          type: "deleteImages",
          strokes: [],
          images: deletedImages,
          timestamp: actionTimestamp,
        };

        return {
          ...note,
          images: note.images.filter((image) => !imageIds.includes(image.id)),
          undoHistory: [...(note.undoHistory ?? []), historyAction],
          redoHistory: [],
          updatedAt: actionTimestamp,
        };
      }),
    }));
  },
  moveImages: (noteId, imageIds, dx, dy) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId || (dx === 0 && dy === 0)) {
          return note;
        }

        const beforeImages = note.images.filter((image) => imageIds.includes(image.id));
        if (beforeImages.length === 0) {
          return note;
        }

        const actionTimestamp = now();
        const movedMap = new Map(
          beforeImages.map((image) => [image.id, { ...image, x: image.x + dx, y: image.y + dy }]),
        );
        const nextImages = note.images.map((image) => movedMap.get(image.id) ?? image);
        const afterImages = nextImages.filter((image) => imageIds.includes(image.id));

        const lastAction = note.undoHistory[note.undoHistory.length - 1];
        const shouldMerge =
          lastAction?.type === "transformImages"
          && actionTimestamp - lastAction.timestamp < IMAGE_TRANSFORM_MERGE_WINDOW_MS
          && sameImageIdSet(lastAction.afterImages, beforeImages);

        const historyAction: InkHistoryAction = shouldMerge
          ? {
              type: "transformImages",
              strokes: [],
              beforeImages: lastAction.beforeImages ?? beforeImages,
              afterImages,
              timestamp: actionTimestamp,
            }
          : {
              type: "transformImages",
              strokes: [],
              beforeImages,
              afterImages,
              timestamp: actionTimestamp,
            };

        return {
          ...note,
          images: nextImages,
          undoHistory: shouldMerge
            ? [...note.undoHistory.slice(0, -1), historyAction]
            : [...note.undoHistory, historyAction],
          redoHistory: [],
          updatedAt: actionTimestamp,
        };
      }),
    }));
  },
  scaleStrokes: (noteId, strokeIds, scale, centerX, centerY) => {
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === noteId
          ? {
              ...note,
              strokes: note.strokes.map((stroke) =>
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
              ),
              updatedAt: now(),
            }
          : note,
      ),
    }));
  },
  scaleImages: (noteId, imageIds, scale, centerX, centerY) => {
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId || scale === 1) {
          return note;
        }

        const beforeImages = note.images.filter((image) => imageIds.includes(image.id));
        if (beforeImages.length === 0) {
          return note;
        }

        const actionTimestamp = now();
        const scaledMap = new Map(
          beforeImages.map((image) => [
            image.id,
            {
              ...image,
              x: centerX + (image.x - centerX) * scale,
              y: centerY + (image.y - centerY) * scale,
              width: image.width * scale,
              height: image.height * scale,
            },
          ]),
        );
        const nextImages = note.images.map((image) => scaledMap.get(image.id) ?? image);
        const afterImages = nextImages.filter((image) => imageIds.includes(image.id));

        const lastAction = note.undoHistory[note.undoHistory.length - 1];
        const shouldMerge =
          lastAction?.type === "transformImages"
          && actionTimestamp - lastAction.timestamp < IMAGE_TRANSFORM_MERGE_WINDOW_MS
          && sameImageIdSet(lastAction.afterImages, beforeImages);

        const historyAction: InkHistoryAction = shouldMerge
          ? {
              type: "transformImages",
              strokes: [],
              beforeImages: lastAction.beforeImages ?? beforeImages,
              afterImages,
              timestamp: actionTimestamp,
            }
          : {
              type: "transformImages",
              strokes: [],
              beforeImages,
              afterImages,
              timestamp: actionTimestamp,
            };

        return {
          ...note,
          images: nextImages,
          undoHistory: shouldMerge
            ? [...note.undoHistory.slice(0, -1), historyAction]
            : [...note.undoHistory, historyAction],
          redoHistory: [],
          updatedAt: actionTimestamp,
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
        let nextStrokes = note.strokes;
        let nextAnnotations = note.textAnnotations ?? [];
        let nextImages = note.images;

        if (action.type === "addStroke") {
          const actionStrokeIds = new Set(action.strokes.map((stroke) => stroke.id));
          nextStrokes = note.strokes.filter((stroke) => !actionStrokeIds.has(stroke.id));
        } else if (action.type === "addTextAnnotation") {
          const addedAnnotationIds = new Set((action.textAnnotations ?? []).map((annotation) => annotation.id));
          nextAnnotations = (note.textAnnotations ?? []).filter(
            (annotation) => !addedAnnotationIds.has(annotation.id),
          );
        } else if (action.type === "erase") {
          nextStrokes = [...note.strokes, ...action.strokes];
          const erasedAnnotations = action.textAnnotations ?? [];
          nextAnnotations = [...(note.textAnnotations ?? []), ...erasedAnnotations];
        } else if (action.type === "addImage") {
          const addedImageIds = new Set((action.images ?? []).map((image) => image.id));
          nextImages = note.images.filter((image) => !addedImageIds.has(image.id));
        } else if (action.type === "deleteImages") {
          nextImages = appendMissingImages(note.images, action.images);
        } else if (action.type === "transformImages") {
          nextImages = applyImageSnapshot(note.images, action.beforeImages);
        }

        return {
          ...note,
          strokes: nextStrokes,
          textAnnotations: nextAnnotations,
          images: nextImages,
          undoneStrokes: [],
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
        let nextStrokes = note.strokes;
        let nextAnnotations = note.textAnnotations ?? [];
        let nextImages = note.images;

        if (action.type === "addStroke") {
          nextStrokes = [...note.strokes, ...action.strokes];
        } else if (action.type === "addTextAnnotation") {
          nextAnnotations = [...(note.textAnnotations ?? []), ...(action.textAnnotations ?? [])];
        } else if (action.type === "erase") {
          const erasedStrokeIds = new Set(action.strokes.map((stroke) => stroke.id));
          nextStrokes = note.strokes.filter((stroke) => !erasedStrokeIds.has(stroke.id));

          const erasedAnnotationIds = new Set((action.textAnnotations ?? []).map((annotation) => annotation.id));
          nextAnnotations = (note.textAnnotations ?? []).filter(
            (annotation) => !erasedAnnotationIds.has(annotation.id),
          );
        } else if (action.type === "addImage") {
          nextImages = appendMissingImages(note.images, action.images);
        } else if (action.type === "deleteImages") {
          const deletedImageIds = new Set((action.images ?? []).map((image) => image.id));
          nextImages = note.images.filter((image) => !deletedImageIds.has(image.id));
        } else if (action.type === "transformImages") {
          nextImages = applyImageSnapshot(note.images, action.afterImages);
        }

        return {
          ...note,
          strokes: nextStrokes,
          textAnnotations: nextAnnotations,
          images: nextImages,
          undoneStrokes: [],
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
      notes: state.notes.map((note) =>
        note.id === selectedId
          ? {
              ...note,
              strokes: [],
              textAnnotations: [],
              undoneStrokes: [],
              undoHistory: [],
              redoHistory: [],
              updatedAt: now(),
            }
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
      chatMessages: [],
      strokes: bundle.note.strokes || [],
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
