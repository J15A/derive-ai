import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, Note, NoteBundle, InkTool, TextAnnotation, WhiteboardImage } from "../types";
import { buildNoteBundle } from "../store/noteStore";
import { strokesToPngDataUrl } from "../utils/ink";
import { uid } from "../utils/ink";
import { InkCanvas } from "./InkCanvas";
import { TextEditor } from "./TextEditor";
import { GraphPanel } from "./GraphPanel";
import type { GraphEquation } from "./GraphPanel";
import { Toolbar } from "./Toolbar";

const GRAPH_PANEL_VISIBILITY_KEY = "deriveAiGraphPanelVisible";

interface NoteEditorProps {
  note: Note | null;
  tool: InkTool;
  color: string;
  penSize: number;
  highlighterSize: number;
  showGrid: boolean;
  showTextPanel: boolean;
  chatMessages: ChatMessage[];
  onSendChatMessage: (value: string) => Promise<void>;
  onExplainWithGemini: (recognizedText: string) => Promise<void>;
  onStopChatGeneration: () => void;
  onClearChat: () => void;
  isChatSending: boolean;
  chatError: string | null;
  onToolChange: (tool: InkTool) => void;
  onColorChange: (value: string) => void;
  onPenSizeChange: (value: number) => void;
  onHighlighterSizeChange: (value: number) => void;
  onShowGridChange: (value: boolean) => void;
  onShowTextPanelChange: (value: boolean) => void;
  onAppendStroke: (noteId: string, stroke: Note["strokes"][number]) => void;
  onEraseAt: (noteId: string, x: number, y: number, radius: number) => void;
  onDeleteStrokes: (noteId: string, strokeIds: string[]) => void;
  onMoveStrokes: (noteId: string, strokeIds: string[], dx: number, dy: number) => void;
  onDuplicateStrokes: (noteId: string, strokeIds: string[]) => string[];
  onChangeStrokesColor: (noteId: string, strokeIds: string[], newColor: string) => void;
  onAddTextAnnotation: (noteId: string, annotation: TextAnnotation) => void;
  onAddImage: (noteId: string, image: WhiteboardImage) => void;
  onDeleteImages: (noteId: string, imageIds: string[]) => void;
  onMoveImages: (noteId: string, imageIds: string[], dx: number, dy: number) => void;
  onScaleStrokes: (noteId: string, strokeIds: string[], scale: number, centerX: number, centerY: number) => void;
  onScaleImages: (noteId: string, imageIds: string[], scale: number, centerX: number, centerY: number) => void;
  onPanViewport: (noteId: string, dx: number, dy: number) => void;
  onZoomViewportAt: (noteId: string, nextScale: number, anchorX: number, anchorY: number) => void;
  onResetViewport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onImportBundle: (bundle: NoteBundle) => void;
}

function download(name: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function NoteEditor({
  note,
  tool,
  color,
  penSize,
  highlighterSize,
  showGrid,
  showTextPanel,
  chatMessages,
  onSendChatMessage,
  onExplainWithGemini,
  onStopChatGeneration,
  onClearChat,
  isChatSending,
  chatError,
  onToolChange,
  onColorChange,
  onPenSizeChange,
  onHighlighterSizeChange,
  onShowGridChange,
  onShowTextPanelChange,
  onAppendStroke,
  onEraseAt,
  onDeleteStrokes,
  onAddImage,
  onDeleteImages,
  onMoveImages,
  onScaleStrokes,
  onScaleImages,
  onMoveStrokes,
  onDuplicateStrokes,
  onChangeStrokesColor,
  onAddTextAnnotation,
  onPanViewport,
  onZoomViewportAt,
  onResetViewport,
  onUndo,
  onRedo,
  onClear,
  onImportBundle,
}: NoteEditorProps): JSX.Element {
  const safeNote = useMemo(() => note, [note]);
  const [isPhone, setIsPhone] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 639px)").matches : false,
  );
  const rootRef = useRef<HTMLElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGraphPanel, setShowGraphPanel] = useState(false);
  const [notesCollapsed, setNotesCollapsed] = useState(false);
  const [graphEquations, setGraphEquations] = useState<GraphEquation[]>([]);
  const canvasAreaRef = useRef<HTMLDivElement | null>(null);
  const [graphPanelPosition, setGraphPanelPosition] = useState<{ x: number; y: number } | null>(null);
  const [graphPanelSize, setGraphPanelSize] = useState<{ width: number; height: number }>({ width: 380, height: 420 });
  const [isDraggingGraphPanel, setIsDraggingGraphPanel] = useState(false);
  const graphDragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const [isResizingGraphPanel, setIsResizingGraphPanel] = useState(false);
  const graphResizeStartRef = useRef<{
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const [notesPanelPosition, setNotesPanelPosition] = useState<{ x: number; y: number } | null>(null);
  const [notesPanelSize, setNotesPanelSize] = useState<{ width: number; height: number }>({ width: 420, height: 620 });
  const notesPanelRef = useRef<HTMLElement | null>(null);
  const [isDraggingNotesPanel, setIsDraggingNotesPanel] = useState(false);
  const notesDragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const [isResizingNotesPanel, setIsResizingNotesPanel] = useState(false);
  const notesResizeStartRef = useRef<{
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const graphColorIndex = useRef(0);

  const GRAPH_COLORS = [
    "#2d70b3", "#c74440", "#388c46", "#6042a6", "#000000", "#fa7e19",
  ];

  const handleAddToGraph = useCallback((latex: string) => {
    const color = GRAPH_COLORS[graphColorIndex.current % GRAPH_COLORS.length];
    graphColorIndex.current += 1;
    const eq: GraphEquation = {
      id: `eq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      latex,
      color,
    };
    setGraphEquations((prev) => [...prev, eq]);
    setShowGraphPanel(true);
  }, []);

  const handleRemoveEquation = useCallback((id: string) => {
    setGraphEquations((prev) => prev.filter((eq) => eq.id !== id));
  }, []);

  const getDefaultGraphPanelPosition = useCallback((): { x: number; y: number } => {
    const margin = 12;
    const containerWidth = canvasAreaRef.current?.clientWidth ?? window.innerWidth;
    const x = showTextPanel
      ? margin
      : Math.max(margin, containerWidth - graphPanelSize.width - margin);
    return { x, y: margin };
  }, [graphPanelSize.width, showTextPanel]);

  const handleGraphHeaderPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isPhone) {
        return;
      }
      if (event.target instanceof HTMLElement && event.target.closest("button")) {
        return;
      }
      if (!showGraphPanel) {
        return;
      }
      const container = canvasAreaRef.current;
      if (!container) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const current = graphPanelPosition ?? getDefaultGraphPanelPosition();
      graphDragOffsetRef.current = {
        x: event.clientX - (containerRect.left + current.x),
        y: event.clientY - (containerRect.top + current.y),
      };
      setGraphPanelPosition(current);
      setIsDraggingGraphPanel(true);
      event.preventDefault();
    },
    [getDefaultGraphPanelPosition, graphPanelPosition, isPhone, showGraphPanel],
  );

  const getDefaultNotesPanelPosition = useCallback((): { x: number; y: number } => {
    const margin = 12;
    const containerWidth = canvasAreaRef.current?.clientWidth ?? window.innerWidth;
    const effectiveWidth = Math.min(notesPanelSize.width, Math.max(200, containerWidth - margin * 2));
    const x = Math.max(margin, containerWidth - effectiveWidth - margin);
    return { x, y: margin };
  }, [notesPanelSize.width]);

  const handleNotesHeaderPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isPhone) {
        return;
      }
      if (event.target instanceof HTMLElement && event.target.closest("button")) {
        return;
      }
      if (!showTextPanel) {
        return;
      }
      const container = canvasAreaRef.current;
      if (!container) {
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const current = notesPanelPosition ?? getDefaultNotesPanelPosition();
      notesDragOffsetRef.current = {
        x: event.clientX - (containerRect.left + current.x),
        y: event.clientY - (containerRect.top + current.y),
      };
      setNotesPanelPosition(current);
      setIsDraggingNotesPanel(true);
      event.preventDefault();
    },
    [getDefaultNotesPanelPosition, isPhone, notesPanelPosition, showTextPanel],
  );

  const handleGraphResizePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!showGraphPanel || isPhone) {
      return;
    }
    const currentPosition = graphPanelPosition ?? getDefaultGraphPanelPosition();
    graphResizeStartRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startLeft: currentPosition.x,
      startTop: currentPosition.y,
      startWidth: graphPanelSize.width,
      startHeight: graphPanelSize.height,
    };
    setIsResizingGraphPanel(true);
    event.preventDefault();
    event.stopPropagation();
  }, [getDefaultGraphPanelPosition, graphPanelPosition, graphPanelSize.height, isPhone, showGraphPanel]);

  const handleNotesResizePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!showTextPanel || notesCollapsed || isPhone) {
      return;
    }
    const currentPosition = notesPanelPosition ?? getDefaultNotesPanelPosition();
    notesResizeStartRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startLeft: currentPosition.x,
      startTop: currentPosition.y,
      startWidth: notesPanelSize.width,
      startHeight: notesPanelSize.height,
    };
    setIsResizingNotesPanel(true);
    event.preventDefault();
    event.stopPropagation();
  }, [getDefaultNotesPanelPosition, isPhone, notesCollapsed, notesPanelPosition, notesPanelSize.height, showTextPanel]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsPhone(event.matches);
    };
    setIsPhone(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(GRAPH_PANEL_VISIBILITY_KEY);
      if (raw === "1") {
        setShowGraphPanel(true);
      }
    } catch (error) {
      console.error("Failed to load graph panel visibility", error);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(GRAPH_PANEL_VISIBILITY_KEY, showGraphPanel ? "1" : "0");
    } catch (error) {
      console.error("Failed to save graph panel visibility", error);
    }
  }, [showGraphPanel]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === rootRef.current);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!showGraphPanel || graphPanelPosition !== null) {
      return;
    }
    setGraphPanelPosition(getDefaultGraphPanelPosition());
  }, [getDefaultGraphPanelPosition, graphPanelPosition, showGraphPanel]);

  useEffect(() => {
    if (!showTextPanel || notesPanelPosition !== null) {
      return;
    }
    if (!canvasAreaRef.current || canvasAreaRef.current.clientWidth === 0) {
      return;
    }
    setNotesPanelPosition(getDefaultNotesPanelPosition());
  }, [getDefaultNotesPanelPosition, notesPanelPosition, showTextPanel]);

  useEffect(() => {
    if (!showGraphPanel || !graphPanelPosition || !canvasAreaRef.current) {
      return;
    }
    const margin = 12;
    const container = canvasAreaRef.current;
    const clampedX = Math.max(margin, Math.min(graphPanelPosition.x, container.clientWidth - graphPanelSize.width - margin));
    const clampedY = Math.max(margin, Math.min(graphPanelPosition.y, container.clientHeight - graphPanelSize.height - margin));
    if (clampedX !== graphPanelPosition.x || clampedY !== graphPanelPosition.y) {
      setGraphPanelPosition({ x: clampedX, y: clampedY });
    }
  }, [graphPanelPosition, graphPanelSize.height, graphPanelSize.width, showGraphPanel]);

  useEffect(() => {
    if (!showTextPanel || !notesPanelPosition || !canvasAreaRef.current) {
      return;
    }
    const margin = 12;
    const container = canvasAreaRef.current;
    const panelWidth = notesPanelRef.current?.clientWidth ?? notesPanelSize.width;
    const panelHeight = notesPanelRef.current?.clientHeight ?? (notesCollapsed ? 44 : notesPanelSize.height);
    const currentHeight = notesCollapsed ? 44 : panelHeight;
    const clampedX = Math.max(margin, Math.min(notesPanelPosition.x, container.clientWidth - panelWidth - margin));
    const clampedY = Math.max(margin, Math.min(notesPanelPosition.y, container.clientHeight - currentHeight - margin));
    if (clampedX !== notesPanelPosition.x || clampedY !== notesPanelPosition.y) {
      setNotesPanelPosition({ x: clampedX, y: clampedY });
    }
  }, [notesCollapsed, notesPanelPosition, notesPanelSize.height, notesPanelSize.width, showTextPanel]);

  useEffect(() => {
    if (!showTextPanel || !notesPanelPosition || !canvasAreaRef.current) {
      return;
    }

    const clampToViewport = () => {
      const container = canvasAreaRef.current;
      if (!container) {
        return;
      }
      const margin = 12;
      const panelWidth = notesPanelRef.current?.clientWidth ?? notesPanelSize.width;
      const panelHeight = notesPanelRef.current?.clientHeight ?? (notesCollapsed ? 44 : notesPanelSize.height);
      const currentHeight = notesCollapsed ? 44 : panelHeight;
      const clampedX = Math.max(margin, Math.min(notesPanelPosition.x, container.clientWidth - panelWidth - margin));
      const clampedY = Math.max(margin, Math.min(notesPanelPosition.y, container.clientHeight - currentHeight - margin));
      if (clampedX !== notesPanelPosition.x || clampedY !== notesPanelPosition.y) {
        setNotesPanelPosition({ x: clampedX, y: clampedY });
      }
    };

    const observer = new ResizeObserver(() => {
      clampToViewport();
    });
    observer.observe(canvasAreaRef.current);
    clampToViewport();

    return () => {
      observer.disconnect();
    };
  }, [notesCollapsed, notesPanelPosition, notesPanelSize.height, notesPanelSize.width, showTextPanel]);

  useEffect(() => {
    if (!isDraggingGraphPanel || isResizingGraphPanel || isPhone) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const container = canvasAreaRef.current;
      const dragOffset = graphDragOffsetRef.current;
      if (!container || !dragOffset) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const panelWidth = graphPanelSize.width;
      const panelHeight = graphPanelSize.height;
      const margin = 12;

      const rawX = event.clientX - containerRect.left - dragOffset.x;
      const rawY = event.clientY - containerRect.top - dragOffset.y;

      const nextX = Math.max(margin, Math.min(rawX, containerRect.width - panelWidth - margin));
      const nextY = Math.max(margin, Math.min(rawY, containerRect.height - panelHeight - margin));
      setGraphPanelPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      setIsDraggingGraphPanel(false);
      graphDragOffsetRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [graphPanelSize.height, graphPanelSize.width, isDraggingGraphPanel, isPhone, isResizingGraphPanel]);

  useEffect(() => {
    if (!isDraggingNotesPanel || isResizingNotesPanel || isPhone) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const container = canvasAreaRef.current;
      const dragOffset = notesDragOffsetRef.current;
      if (!container || !dragOffset) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const panelWidth = notesPanelSize.width;
      const panelHeight = notesCollapsed ? 44 : notesPanelSize.height;
      const margin = 12;

      const rawX = event.clientX - containerRect.left - dragOffset.x;
      const rawY = event.clientY - containerRect.top - dragOffset.y;

      const nextX = Math.max(margin, Math.min(rawX, containerRect.width - panelWidth - margin));
      const nextY = Math.max(margin, Math.min(rawY, containerRect.height - panelHeight - margin));
      setNotesPanelPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      setIsDraggingNotesPanel(false);
      notesDragOffsetRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDraggingNotesPanel, isPhone, isResizingNotesPanel, notesCollapsed, notesPanelSize.height, notesPanelSize.width]);

  useEffect(() => {
    if (!isResizingGraphPanel || isPhone) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const container = canvasAreaRef.current;
      const start = graphResizeStartRef.current;
      if (!container || !start) {
        return;
      }
      const margin = 12;
      const minWidth = 320;
      const minHeight = 260;
      const right = start.startLeft + start.startWidth;
      const bottom = start.startTop + start.startHeight;
      const maxWidth = Math.max(minWidth, right - margin);
      const maxHeight = Math.max(minHeight, bottom - margin);
      const nextWidth = Math.max(minWidth, Math.min(start.startWidth - (event.clientX - start.startX), maxWidth));
      const nextHeight = Math.max(minHeight, Math.min(start.startHeight - (event.clientY - start.startY), maxHeight));
      const nextLeft = right - nextWidth;
      const nextTop = bottom - nextHeight;
      setGraphPanelSize({ width: nextWidth, height: nextHeight });
      setGraphPanelPosition({ x: nextLeft, y: nextTop });
    };

    const handlePointerUp = () => {
      setIsResizingGraphPanel(false);
      graphResizeStartRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isPhone, isResizingGraphPanel]);

  useEffect(() => {
    if (!isResizingNotesPanel || isPhone) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const container = canvasAreaRef.current;
      const start = notesResizeStartRef.current;
      if (!container || !start) {
        return;
      }
      const margin = 12;
      const minWidth = 340;
      const minHeight = 360;
      const right = start.startLeft + start.startWidth;
      const bottom = start.startTop + start.startHeight;
      const maxWidth = Math.max(minWidth, right - margin);
      const maxHeight = Math.max(minHeight, bottom - margin);
      const nextWidth = Math.max(minWidth, Math.min(start.startWidth - (event.clientX - start.startX), maxWidth));
      const nextHeight = Math.max(minHeight, Math.min(start.startHeight - (event.clientY - start.startY), maxHeight));
      const nextLeft = right - nextWidth;
      const nextTop = bottom - nextHeight;
      setNotesPanelSize({ width: nextWidth, height: nextHeight });
      setNotesPanelPosition({ x: nextLeft, y: nextTop });
    };

    const handlePointerUp = () => {
      setIsResizingNotesPanel(false);
      notesResizeStartRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isPhone, isResizingNotesPanel]);

  const toggleFullscreen = useCallback(async () => {
    if (!rootRef.current) {
      return;
    }

    if (document.fullscreenElement === rootRef.current) {
      await document.exitFullscreen();
      return;
    }

    await rootRef.current.requestFullscreen();
  }, []);

  if (!safeNote) {
    return (
      <main className="flex h-full min-h-0 items-center justify-center rounded-2xl bg-white shadow-soft" ref={rootRef}>
        No note selected.
      </main>
    );
  }

  const titleSlug = safeNote.title.replace(/\s+/g, "-").toLowerCase() || "note";

  const handleExportPng = () => {
    const dataUrl = strokesToPngDataUrl(safeNote.strokes);
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${titleSlug}-ink.png`;
    link.click();
  };

  const handleExportBundle = () => {
    const bundle = buildNoteBundle(safeNote);
    download(`${titleSlug}-bundle.json`, JSON.stringify(bundle, null, 2), "application/json");
  };

  const handleImportBundle = async (file: File) => {
    const raw = await file.text();
    const parsed = JSON.parse(raw) as NoteBundle;
    if (parsed.version !== 1 || !parsed.note) {
      throw new Error("Invalid bundle format");
    }
    onImportBundle(parsed);
  };

  const handleUploadImage = async (file: File) => {
    if (!safeNote) return;
    
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) {
          reject(new Error("Failed to read image"));
          return;
        }
        
        // Load image to get dimensions
        const img = new Image();
        img.onload = () => {
          // Place image at center of viewport
          const centerX = -safeNote.viewport.offsetX / safeNote.viewport.scale + (window.innerWidth / 2) / safeNote.viewport.scale;
          const centerY = -safeNote.viewport.offsetY / safeNote.viewport.scale + (window.innerHeight / 2) / safeNote.viewport.scale;
          
          // Scale image to reasonable size (max 400px width)
          const maxWidth = 400;
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          const image: WhiteboardImage = {
            id: uid(),
            dataUrl,
            x: centerX - width / 2,
            y: centerY - height / 2,
            width,
            height,
            createdAt: Date.now(),
          };
          
          onAddImage(safeNote.id, image);
          resolve();
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = dataUrl;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const initialNotesWidth = Math.min(
    notesPanelSize.width,
    Math.max(220, (canvasAreaRef.current?.clientWidth ?? window.innerWidth) - 24),
  );

  return (
    <main className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl bg-panel shadow-soft" ref={rootRef}>
      <Toolbar
        tool={tool}
        color={color}
        penSize={penSize}
        highlighterSize={highlighterSize}
        showGrid={showGrid}
        showTextPanel={showTextPanel}
        showGraphPanel={showGraphPanel}
        isFullscreen={isFullscreen}
        zoomPercent={Math.round(safeNote.viewport.scale * 100)}
        onToolChange={onToolChange}
        onColorChange={onColorChange}
        onPenSizeChange={onPenSizeChange}
        onHighlighterSizeChange={onHighlighterSizeChange}
        onShowGridChange={onShowGridChange}
        onShowTextPanelChange={onShowTextPanelChange}
        onShowGraphPanelChange={setShowGraphPanel}
        onToggleFullscreen={() => {
          toggleFullscreen().catch((error: unknown) => {
            const message = error instanceof Error ? error.message : "Fullscreen failed";
            window.alert(message);
          });
        }}
        onZoomIn={() => onZoomViewportAt(safeNote.id, safeNote.viewport.scale * 1.2, 0, 0)}
        onZoomOut={() => onZoomViewportAt(safeNote.id, safeNote.viewport.scale / 1.2, 0, 0)}
        onResetView={onResetViewport}
        onUndo={onUndo}
        onRedo={onRedo}
        onClear={onClear}
        onExportPng={handleExportPng}
        onExportBundle={handleExportBundle}
        onImportBundle={(file) => {
          handleImportBundle(file).catch((error: unknown) => {
            const message = error instanceof Error ? error.message : "Failed to import bundle";
            window.alert(message);
          });
        }}
        onUploadImage={(file) => {
          handleUploadImage(file).catch((error: unknown) => {
            const message = error instanceof Error ? error.message : "Failed to upload image";
            window.alert(message);
          });
        }}
      />

      <div className="relative min-h-0 min-w-0 flex-1" ref={canvasAreaRef}>
        <InkCanvas
          note={safeNote}
          tool={tool}
          color={color}
          penSize={penSize}
          highlighterSize={highlighterSize}
          showGrid={showGrid}
          onAppendStroke={onAppendStroke}
          onEraseAt={onEraseAt}
          onDeleteStrokes={onDeleteStrokes}
          onMoveStrokes={onMoveStrokes}
          onDuplicateStrokes={onDuplicateStrokes}
          onChangeStrokesColor={onChangeStrokesColor}
          onAddTextAnnotation={onAddTextAnnotation}
          onAddImage={onAddImage}
          onDeleteImages={onDeleteImages}
          onMoveImages={onMoveImages}
          onScaleStrokes={onScaleStrokes}
          onScaleImages={onScaleImages}
          onPanViewport={onPanViewport}
          onZoomViewportAt={onZoomViewportAt}
          onAddToGraph={handleAddToGraph}
          onExplainWithGemini={onExplainWithGemini}
        />

        {showTextPanel ? (
          <section
            ref={notesPanelRef}
            className={`absolute z-20 flex min-h-0 max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl ${notesCollapsed ? "h-11" : ""}`}
            style={{
              left: isPhone ? "12px" : notesPanelPosition ? `${notesPanelPosition.x}px` : undefined,
              right: isPhone ? "12px" : notesPanelPosition ? undefined : "12px",
              top: isPhone ? undefined : notesPanelPosition ? `${notesPanelPosition.y}px` : "12px",
              bottom: isPhone ? "12px" : undefined,
              width: isPhone ? undefined : `${initialNotesWidth}px`,
              height: notesCollapsed
                ? undefined
                : isPhone
                  ? showGraphPanel
                    ? "56%"
                    : "64%"
                  : `${notesPanelSize.height}px`,
              maxHeight: notesCollapsed ? undefined : "calc(100% - 1.5rem)",
              minHeight: notesCollapsed ? undefined : "360px",
            }}
          >
            <TextEditor
              messages={chatMessages}
              onSendMessage={onSendChatMessage}
              onStopGenerating={onStopChatGeneration}
              onClearChat={onClearChat}
              isSending={isChatSending}
              errorMessage={chatError}
              onClose={() => onShowTextPanelChange(false)}
              collapsed={notesCollapsed}
              onToggleCollapsed={() => setNotesCollapsed((prev) => !prev)}
              onHeaderPointerDown={isPhone ? undefined : handleNotesHeaderPointerDown}
              onHeaderResizePointerDown={isPhone ? undefined : handleNotesResizePointerDown}
              isDragging={isPhone ? false : isDraggingNotesPanel}
              showResizeHandle={!isPhone}
            />
          </section>
        ) : null}

        {showGraphPanel ? (
          <div
            className="absolute z-20 max-w-[calc(100%-1.5rem)]"
            style={{
              left: isPhone ? "12px" : `${(graphPanelPosition ?? getDefaultGraphPanelPosition()).x}px`,
              right: isPhone ? "12px" : undefined,
              top: isPhone ? "12px" : `${(graphPanelPosition ?? getDefaultGraphPanelPosition()).y}px`,
              width: isPhone ? undefined : `${graphPanelSize.width}px`,
              height: isPhone
                ? showTextPanel
                  ? "42%"
                  : "50%"
                : `${graphPanelSize.height}px`,
            }}
          >
            <GraphPanel
              equations={graphEquations}
              onRemoveEquation={handleRemoveEquation}
              onClose={() => setShowGraphPanel(false)}
              onHeaderPointerDown={isPhone ? undefined : handleGraphHeaderPointerDown}
              onHeaderResizePointerDown={isPhone ? undefined : handleGraphResizePointerDown}
              isDragging={isPhone ? false : isDraggingGraphPanel}
              showResizeHandle={!isPhone}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
