import type { InkTool } from "../types";

interface ToolbarProps {
  tool: InkTool;
  color: string;
  size: number;
  zoomPercent: number;
  onToolChange: (tool: InkTool) => void;
  onColorChange: (value: string) => void;
  onSizeChange: (value: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExportPng: () => void;
  onExportBundle: () => void;
  onImportBundle: (file: File) => void;
}

export function Toolbar({
  tool,
  color,
  size,
  zoomPercent,
  onToolChange,
  onColorChange,
  onSizeChange,
  onZoomIn,
  onZoomOut,
  onResetView,
  onUndo,
  onRedo,
  onClear,
  onExportPng,
  onExportBundle,
  onImportBundle,
}: ToolbarProps): JSX.Element {
  return (
    <div className="toolbar">
      <div className="tool-group">
        <button
          className={`tool-btn ${tool === "pen" ? "active" : ""}`}
          type="button"
          onClick={() => onToolChange("pen")}
        >
          Pen
        </button>
        <button
          className={`tool-btn ${tool === "eraser" ? "active" : ""}`}
          type="button"
          onClick={() => onToolChange("eraser")}
        >
          Eraser
        </button>
        <button
          className={`tool-btn ${tool === "pan" ? "active" : ""}`}
          type="button"
          onClick={() => onToolChange("pan")}
        >
          Pan
        </button>
      </div>

      <div className="tool-group">
        <label className="inline-label">
          Color
          <input
            type="color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            disabled={tool !== "pen"}
          />
        </label>
        <label className="inline-label">
          Size
          <input
            type="range"
            min={1}
            max={24}
            value={size}
            onChange={(e) => onSizeChange(Number(e.target.value))}
          />
          <span>{size}</span>
        </label>
      </div>

      <div className="tool-group">
        <button className="tool-btn" type="button" onClick={onZoomOut}>
          Zoom -
        </button>
        <span className="zoom-label">{zoomPercent}%</span>
        <button className="tool-btn" type="button" onClick={onZoomIn}>
          Zoom +
        </button>
        <button className="tool-btn" type="button" onClick={onResetView}>
          Reset View
        </button>
      </div>

      <div className="tool-group">
        <button className="tool-btn" type="button" onClick={onUndo}>
          Undo
        </button>
        <button className="tool-btn" type="button" onClick={onRedo}>
          Redo
        </button>
        <button className="tool-btn" type="button" onClick={onClear}>
          Clear
        </button>
      </div>

      <div className="tool-group">
        <button className="tool-btn" type="button" onClick={onExportPng}>
          Export PNG
        </button>
        <button className="tool-btn" type="button" onClick={onExportBundle}>
          Export Bundle
        </button>
        <label className="tool-btn file-btn">
          Import Bundle
          <input
            type="file"
            accept="application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onImportBundle(file);
                e.currentTarget.value = "";
              }
            }}
          />
        </label>
      </div>
    </div>
  );
}
