import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Note, NoteBundle, InkTool, TextAnnotation } from "../types";
import { buildNoteBundle } from "../store/noteStore";
import { strokesToPngDataUrl } from "../utils/ink";
import { InkCanvas } from "./InkCanvas";
import { TextEditor } from "./TextEditor";
import { GraphPanel } from "./GraphPanel";
import type { GraphEquation } from "./GraphPanel";
import { Toolbar } from "./Toolbar";

interface NoteEditorProps {
  note: Note | null;
  tool: InkTool;
  color: string;
  penSize: number;
  highlighterSize: number;
  showGrid: boolean;
  showTextPanel: boolean;
  onTextChange: (value: string) => void;
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
  onTextChange,
  onToolChange,
  onColorChange,
  onPenSizeChange,
  onHighlighterSizeChange,
  onShowGridChange,
  onShowTextPanelChange,
  onAppendStroke,
  onEraseAt,
  onDeleteStrokes,
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
  const rootRef = useRef<HTMLElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGraphPanel, setShowGraphPanel] = useState(false);
  const [graphEquations, setGraphEquations] = useState<GraphEquation[]>([]);
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

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === rootRef.current);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

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
      <main className="flex h-full min-h-0 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-soft" ref={rootRef}>
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

  return (
    <main className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-panel shadow-soft" ref={rootRef}>
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
      />

      <div className="relative min-h-0 min-w-0 flex-1">
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
          onPanViewport={onPanViewport}
          onZoomViewportAt={onZoomViewportAt}
          onAddToGraph={handleAddToGraph}
        />

        {showTextPanel ? (
          <section className="absolute bottom-3 right-3 top-3 z-20 flex min-h-0 w-[420px] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl max-md:left-3 max-md:w-auto">
            <TextEditor
              text={safeNote.text}
              onTextChange={onTextChange}
              onClose={() => onShowTextPanelChange(false)}
            />
          </section>
        ) : null}

        {showGraphPanel ? (
          <div className={`absolute top-3 z-20 w-[380px] max-w-[calc(100%-1.5rem)] ${showTextPanel ? "left-3" : "right-3"}`}>
            <GraphPanel
              equations={graphEquations}
              onRemoveEquation={handleRemoveEquation}
              onClose={() => setShowGraphPanel(false)}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
