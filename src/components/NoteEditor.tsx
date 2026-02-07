import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Note, NoteBundle } from "../types";
import { buildNoteBundle } from "../store/noteStore";
import { strokesToPngDataUrl } from "../utils/ink";
import { InkCanvas } from "./InkCanvas";
import { TextEditor } from "./TextEditor";
import { Toolbar } from "./Toolbar";

interface NoteEditorProps {
  note: Note | null;
  tool: "pen" | "eraser" | "pan";
  color: string;
  size: number;
  showGrid: boolean;
  showTextPanel: boolean;
  onTextChange: (value: string) => void;
  onToolChange: (tool: "pen" | "eraser" | "pan") => void;
  onColorChange: (value: string) => void;
  onSizeChange: (value: number) => void;
  onShowGridChange: (value: boolean) => void;
  onShowTextPanelChange: (value: boolean) => void;
  onAppendStroke: (noteId: string, stroke: Note["strokes"][number]) => void;
  onEraseAt: (noteId: string, x: number, y: number, radius: number) => void;
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
  size,
  showGrid,
  showTextPanel,
  onTextChange,
  onToolChange,
  onColorChange,
  onSizeChange,
  onShowGridChange,
  onShowTextPanelChange,
  onAppendStroke,
  onEraseAt,
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
        size={size}
        showGrid={showGrid}
        showTextPanel={showTextPanel}
        isFullscreen={isFullscreen}
        zoomPercent={Math.round(safeNote.viewport.scale * 100)}
        onToolChange={onToolChange}
        onColorChange={onColorChange}
        onSizeChange={onSizeChange}
        onShowGridChange={onShowGridChange}
        onShowTextPanelChange={onShowTextPanelChange}
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
          size={size}
          showGrid={showGrid}
          onAppendStroke={onAppendStroke}
          onEraseAt={onEraseAt}
          onPanViewport={onPanViewport}
          onZoomViewportAt={onZoomViewportAt}
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
      </div>
    </main>
  );
}
