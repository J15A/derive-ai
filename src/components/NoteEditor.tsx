import { useMemo } from "react";
import type { Note, NoteBundle } from "../types";
import { buildNoteBundle } from "../store/noteStore";
import { strokesToPngDataUrl } from "../utils/ink";
import { InkCanvas } from "./InkCanvas";
import { TextEditor } from "./TextEditor";
import { Toolbar } from "./Toolbar";

interface NoteEditorProps {
  note: Note | null;
  activeTab: "ink" | "text";
  textPreview: boolean;
  tool: "pen" | "eraser" | "pan";
  color: string;
  size: number;
  onTabChange: (tab: "ink" | "text") => void;
  onTitleChange: (value: string) => void;
  onTextChange: (value: string) => void;
  onTogglePreview: () => void;
  onToolChange: (tool: "pen" | "eraser" | "pan") => void;
  onColorChange: (value: string) => void;
  onSizeChange: (value: number) => void;
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
  activeTab,
  textPreview,
  tool,
  color,
  size,
  onTabChange,
  onTitleChange,
  onTextChange,
  onTogglePreview,
  onToolChange,
  onColorChange,
  onSizeChange,
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

  if (!safeNote) {
    return <main className="editor empty">No note selected.</main>;
  }

  const handleExportPng = () => {
    const dataUrl = strokesToPngDataUrl(safeNote.strokes);
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${safeNote.title.replace(/\s+/g, "-").toLowerCase() || "note"}-ink.png`;
    link.click();
  };

  const handleExportBundle = () => {
    const bundle = buildNoteBundle(safeNote);
    download(
      `${safeNote.title.replace(/\s+/g, "-").toLowerCase() || "note"}-bundle.json`,
      JSON.stringify(bundle, null, 2),
      "application/json",
    );
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
    <main className="editor">
      <div className="editor-head">
        <input
          className="editor-title"
          value={safeNote.title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Note title"
        />
        <div className="tab-row">
          <button
            className={`tab-btn ${activeTab === "ink" ? "active" : ""}`}
            type="button"
            onClick={() => onTabChange("ink")}
          >
            Ink
          </button>
          <button
            className={`tab-btn ${activeTab === "text" ? "active" : ""}`}
            type="button"
            onClick={() => onTabChange("text")}
          >
            Text
          </button>
        </div>
      </div>

      {activeTab === "ink" ? (
        <>
          <Toolbar
            tool={tool}
            color={color}
            size={size}
            zoomPercent={Math.round(safeNote.viewport.scale * 100)}
            onToolChange={onToolChange}
            onColorChange={onColorChange}
            onSizeChange={onSizeChange}
            onZoomIn={() =>
              onZoomViewportAt(safeNote.id, safeNote.viewport.scale * 1.2, 0, 0)
            }
            onZoomOut={() =>
              onZoomViewportAt(safeNote.id, safeNote.viewport.scale / 1.2, 0, 0)
            }
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
          <InkCanvas
            note={safeNote}
            tool={tool}
            color={color}
            size={size}
            onAppendStroke={onAppendStroke}
            onEraseAt={onEraseAt}
            onPanViewport={onPanViewport}
            onZoomViewportAt={onZoomViewportAt}
          />
        </>
      ) : (
        <TextEditor
          text={safeNote.text}
          preview={textPreview}
          onTextChange={onTextChange}
          onTogglePreview={onTogglePreview}
        />
      )}
    </main>
  );
}
