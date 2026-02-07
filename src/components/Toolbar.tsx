import type { InkTool } from "../types";

interface ToolbarProps {
  tool: InkTool;
  color: string;
  size: number;
  showGrid: boolean;
  showTextPanel: boolean;
  isFullscreen: boolean;
  zoomPercent: number;
  onToolChange: (tool: InkTool) => void;
  onColorChange: (value: string) => void;
  onSizeChange: (value: number) => void;
  onShowGridChange: (value: boolean) => void;
  onShowTextPanelChange: (value: boolean) => void;
  onToggleFullscreen: () => void;
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
  showGrid,
  showTextPanel,
  isFullscreen,
  zoomPercent,
  onToolChange,
  onColorChange,
  onSizeChange,
  onShowGridChange,
  onShowTextPanelChange,
  onToggleFullscreen,
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
  const toolButton = (name: InkTool, label: string) => (
    <button
      className={`btn h-9 min-w-20 ${tool === name ? "btn-active" : ""}`}
      type="button"
      onClick={() => onToolChange(name)}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-2 border-b border-slate-100 p-3">
      <div className="flex items-center gap-2">{toolButton("pen", "Pen")}{toolButton("eraser", "Eraser")}{toolButton("pan", "Pan")}</div>

      <span className="ml-auto w-14 text-center text-sm font-semibold text-slate-700">{zoomPercent}%</span>
      <button className={`btn h-9 ${isFullscreen ? "btn-active" : ""}`} type="button" onClick={onToggleFullscreen}>
        {isFullscreen ? "Exit Full" : "Full"}
      </button>

      <details className="group relative">
        <summary className="btn h-9 list-none select-none">Settings</summary>

        <div className="absolute right-0 top-11 z-30 w-[320px] space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
            <span className="w-14 text-xs font-semibold text-slate-600">Color</span>
            <input
              type="color"
              value={color}
              onChange={(e) => onColorChange(e.target.value)}
              disabled={tool !== "pen"}
              className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-white disabled:cursor-not-allowed"
            />
            <span className="ml-2 w-10 text-xs font-semibold text-slate-600">Size</span>
            <input
              type="range"
              min={1}
              max={24}
              value={size}
              onChange={(e) => onSizeChange(Number(e.target.value))}
              className="w-full"
            />
            <span className="w-7 text-center text-xs font-semibold text-slate-700">{size}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button className={`btn ${showGrid ? "btn-active" : ""}`} type="button" onClick={() => onShowGridChange(!showGrid)}>
              Grid
            </button>
            <button className={`btn ${showTextPanel ? "btn-active" : ""}`} type="button" onClick={() => onShowTextPanelChange(!showTextPanel)}>
              Text Panel
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button className="btn" type="button" onClick={onZoomOut}>Zoom -</button>
            <button className="btn" type="button" onClick={onZoomIn}>Zoom +</button>
            <button className="btn" type="button" onClick={onResetView}>Reset</button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button className="btn" type="button" onClick={onUndo}>Undo</button>
            <button className="btn" type="button" onClick={onRedo}>Redo</button>
            <button className="btn" type="button" onClick={onClear}>Clear</button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button className="btn" type="button" onClick={onExportPng}>PNG</button>
            <button className="btn" type="button" onClick={onExportBundle}>Bundle</button>
            <label className="btn relative cursor-pointer overflow-hidden">
              Import
              <input
                type="file"
                accept="application/json"
                className="absolute inset-0 cursor-pointer opacity-0"
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
      </details>
    </div>
  );
}
