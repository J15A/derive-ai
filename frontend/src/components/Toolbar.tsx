import { useEffect, useRef } from "react";
import type { InkTool } from "../types";
import { 
  Pen, 
  Eraser, 
  Hand, 
  SquareDashedMousePointer, 
  Highlighter,
  Maximize,
  Minimize,
  Settings,
  Grid3x3,
  Type,
  ZoomIn,
  ZoomOut,
  Focus,
  Undo,
  Redo,
  Image,
  Package,
  Upload,
  ImageUp,
  TextCursor,
  LineChart
} from "lucide-react";
import { useState } from "react";

interface ToolbarProps {
  tool: InkTool;
  color: string;
  penSize: number;
  highlighterSize: number;
  showGrid: boolean;
  showTextPanel: boolean;
  showGraphPanel: boolean;
  isFullscreen: boolean;
  zoomPercent: number;
  onToolChange: (tool: InkTool) => void;
  onColorChange: (value: string) => void;
  onPenSizeChange: (value: number) => void;
  onHighlighterSizeChange: (value: number) => void;
  onShowGridChange: (value: boolean) => void;
  onShowTextPanelChange: (value: boolean) => void;
  onShowGraphPanelChange: (value: boolean) => void;
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
  onUploadImage: (file: File) => void;
}

const HIGHLIGHTER_COLORS = [
  { name: "Yellow", value: "#FFEB3B" },
  { name: "Green", value: "#4CAF50" },
  { name: "Blue", value: "#2196F3" },
  { name: "Pink", value: "#FF4081" },
  { name: "Orange", value: "#FF9800" },
  { name: "Purple", value: "#9C27B0" },
];

const PEN_COLORS = [
  { name: "Black", value: "#111827" },
  { name: "Red", value: "#EF4444" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Green", value: "#10B981" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Orange", value: "#F97316" },
];

export function Toolbar({
  tool,
  penSize,
  highlighterSize,
  showGrid,
  showTextPanel,
  showGraphPanel,
  isFullscreen,
  zoomPercent,
  onToolChange,
  onColorChange,
  onPenSizeChange,
  onHighlighterSizeChange,
  onShowGridChange,
  onShowTextPanelChange,
  onShowGraphPanelChange,
  onToggleFullscreen,
  onZoomIn,
  onZoomOut,
  onResetView,
  onUndo,
  onRedo,
  onExportPng,
  onExportBundle,
  onImportBundle,
  onUploadImage,
}: ToolbarProps): JSX.Element {
  const coloredToolActiveClass = "bg-white shadow-[inset_0_0_0_2px_#cbd5e1] hover:bg-slate-50";
  const settingsRef = useRef<HTMLDetailsElement | null>(null);
  const [showPenMenu, setShowPenMenu] = useState(false);
  const [showHighlighterMenu, setShowHighlighterMenu] = useState(false);
  const [penColor, setPenColor] = useState("#111827");
  const [highlighterColor, setHighlighterColor] = useState(HIGHLIGHTER_COLORS[0].value);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const settings = settingsRef.current;
      if (!settings?.open) {
        return;
      }
      if (event.target instanceof Node && !settings.contains(event.target)) {
        settings.open = false;
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && settingsRef.current?.open) {
        settingsRef.current.open = false;
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const neutralToolActiveClass = "bg-white shadow-[inset_0_0_0_2px_#cbd5e1] hover:bg-slate-50";
  const toolButton = (name: InkTool, icon: JSX.Element) => (
    <button
      className={`tool-btn ${tool === name ? (name === "eraser" || name === "pan" || name === "selector" ? neutralToolActiveClass : "tool-btn-active") : ""}`}
      type="button"
      onClick={() => onToolChange(name)}
      title={name.charAt(0).toUpperCase() + name.slice(1)}
    >
      {icon}
    </button>
  );

  const handlePenColorSelect = (newColor: string) => {
    setPenColor(newColor);
    onColorChange(newColor);
    onToolChange("pen");
  };

  const handleHighlighterColorSelect = (newColor: string) => {
    setHighlighterColor(newColor);
    onColorChange(newColor);
    onToolChange("highlighter");
  };

  return (
    <div className="relative z-40 flex min-w-0 items-center gap-2 border-b border-slate-100 p-3 max-sm:flex-wrap">
      <div className="flex min-w-0 items-center gap-2 max-sm:w-full max-sm:overflow-x-auto max-sm:pb-1 hide-scrollbar">
        {/* Pen with color dropdown */}
        <div 
          className="relative"
          onMouseEnter={() => setShowPenMenu(true)}
          onMouseLeave={() => setShowPenMenu(false)}
        >
          <button
            className={`tool-btn ${tool === "pen" ? coloredToolActiveClass : ""}`}
            type="button"
            onClick={() => {
              onColorChange(penColor);
              onToolChange("pen");
            }}
            title="Pen"
          >
            <Pen size={20} style={{ color: penColor }} />
          </button>
          
          {/* Color dropdown menu */}
          {showPenMenu && (
            <div className="absolute left-0 top-10 z-[120] flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-lg max-sm:fixed max-sm:left-3 max-sm:right-3 max-sm:top-[4.5rem]">
              <div className="flex gap-1">
                {PEN_COLORS.map((c) => (
                  <button
                    key={c.value}
                    className="h-8 w-8 rounded-md border-2 transition-transform hover:scale-110"
                    style={{ 
                      backgroundColor: c.value,
                      borderColor: penColor === c.value ? "#334155" : "transparent"
                    }}
                    onClick={() => handlePenColorSelect(c.value)}
                    title={c.name}
                    type="button"
                  />
                ))}
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
                <input
                  type="range"
                  min={1}
                  max={24}
                  value={penSize}
                  onChange={(e) => onPenSizeChange(Number(e.target.value))}
                  className="flex-1"
                  style={{ minWidth: "120px" }}
                />
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-xs font-semibold text-slate-700 shadow-sm">
                  {penSize}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Highlighter with color dropdown */}
        <div
          className="relative"
          onMouseEnter={() => setShowHighlighterMenu(true)}
          onMouseLeave={() => setShowHighlighterMenu(false)}
        >
          <button
            className={`tool-btn ${tool === "highlighter" ? coloredToolActiveClass : ""}`}
            type="button"
            onClick={() => {
              onColorChange(highlighterColor);
              onToolChange("highlighter");
            }}
            title="Highlighter"
          >
            <Highlighter size={20} style={{ color: highlighterColor }} />
          </button>

          {showHighlighterMenu && (
            <div className="absolute left-0 top-10 z-[120] flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-lg max-sm:fixed max-sm:left-3 max-sm:right-3 max-sm:top-[4.5rem]">
              <div className="flex gap-1">
                {HIGHLIGHTER_COLORS.map((c) => (
                  <button
                    key={c.value}
                    className="h-8 w-8 rounded-md border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c.value,
                      borderColor: highlighterColor === c.value ? "#334155" : "transparent"
                    }}
                    onClick={() => handleHighlighterColorSelect(c.value)}
                    title={c.name}
                    type="button"
                  />
                ))}
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
                <input
                  type="range"
                  min={8}
                  max={32}
                  value={highlighterSize}
                  onChange={(e) => onHighlighterSizeChange(Number(e.target.value))}
                  className="flex-1"
                  style={{ minWidth: "120px" }}
                />
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-xs font-semibold text-slate-700 shadow-sm">
                  {highlighterSize}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {toolButton("eraser", <Eraser size={20} />)}
        {toolButton("pan", <Hand size={20} />)}
        {toolButton("selector", <SquareDashedMousePointer size={20} />)}
        {toolButton("text", <TextCursor size={20} />)}
        
        <button 
          className="tool-btn"
          type="button" 
          onClick={onUndo} 
          title="Undo"
        >
          <Undo size={20} />
        </button>
        
        <button 
          className="tool-btn"
          type="button" 
          onClick={onRedo} 
          title="Redo"
        >
          <Redo size={20} />
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2 max-sm:ml-0 max-sm:w-full max-sm:justify-start max-sm:gap-1 max-sm:overflow-x-auto max-sm:pb-1 hide-scrollbar">
        <button className="tool-btn" type="button" onClick={onZoomOut} title="Zoom Out">
          <ZoomOut size={20} />
        </button>
        <button className="tool-btn" type="button" onClick={onZoomIn} title="Zoom In">
          <ZoomIn size={20} />
        </button>
        <button className="tool-btn" type="button" onClick={onResetView} title="Reset View">
          <Focus size={20} />
        </button>
        <button 
          className={`tool-btn ${showGrid ? "tool-btn-active" : ""}`}
          type="button" 
          onClick={() => onShowGridChange(!showGrid)}
          title="Toggle Grid"
        >
          <Grid3x3 size={20} />
        </button>
        <button 
          className={`tool-btn ${showTextPanel ? "tool-btn-active" : ""}`}
          type="button" 
          onClick={() => onShowTextPanelChange(!showTextPanel)}
          title="Toggle Text Panel"
        >
          <Type size={20} />
        </button>
        <button 
          className={`tool-btn ${showGraphPanel ? "tool-btn-active" : ""}`}
          type="button" 
          onClick={() => onShowGraphPanelChange(!showGraphPanel)}
          title="Toggle Graph Panel"
        >
          <LineChart size={20} />
        </button>
        <span className="w-14 shrink-0 text-center text-sm font-semibold text-slate-700">{zoomPercent}%</span>
        <button 
          className={`tool-btn ${isFullscreen ? "tool-btn-active" : ""}`}
          type="button" 
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>

        <details className="group relative" ref={settingsRef}>
          <summary className="tool-btn cursor-pointer list-none">
            <Settings size={20} />
          </summary>

          <div className="absolute right-0 top-11 z-[120] w-[320px] space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl max-sm:fixed max-sm:left-3 max-sm:right-3 max-sm:top-[4.5rem] max-sm:w-auto">
            <div>
              <div className="grid grid-cols-3 gap-2">
                <button className="btn flex flex-col items-center justify-center gap-1" type="button" onClick={onExportPng} title="Export PNG">
                  <Image size={18} />
                  <span className="text-xs">PNG</span>
                </button>
                <button className="btn flex flex-col items-center justify-center gap-1" type="button" onClick={onExportBundle} title="Export Bundle">
                  <Package size={18} />
                  <span className="text-xs">Bundle</span>
                </button>
                <label className="btn relative flex cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden" title="Import Bundle">
                  <Upload size={18} />
                  <span className="text-xs">Import</span>
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
            <div className="border-t border-slate-200 pt-3">
              <label className="btn relative flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden" title="Upload Image">
                <ImageUp size={18} />
                <span className="text-sm">Upload Image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onUploadImage(file);
                      e.currentTarget.value = "";
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
