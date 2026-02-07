import { useEffect, useRef } from "react";
import type { InkTool } from "../types";
import { Pen, Eraser, Hand, SquareDashedMousePointer, Highlighter } from "lucide-react";
import { useState } from "react";

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

  const toolButton = (name: InkTool, icon: JSX.Element) => (
    <button
      className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
        tool === name 
          ? "bg-slate-700 text-white hover:bg-slate-600" 
          : "text-slate-700 hover:bg-slate-200"
      }`}
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
    <div className="flex min-w-0 items-center gap-2 border-b border-slate-100 p-3">
      <div className="flex min-w-0 items-center gap-2">
        {/* Pen with color dropdown */}
        <div 
          className="relative"
          onMouseEnter={() => setShowPenMenu(true)}
          onMouseLeave={() => setShowPenMenu(false)}
        >
          <button
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
              tool === "pen" 
                ? "bg-slate-700 text-white hover:bg-slate-600" 
                : "text-slate-700 hover:bg-slate-200"
            }`}
            type="button"
            onClick={() => {
              onColorChange(penColor);
              onToolChange("pen");
            }}
            title="Pen"
          >
            <Pen size={20} />
          </button>
          
          {/* Color dropdown menu */}
          {showPenMenu && (
            <div className="absolute left-0 top-10 z-50 flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
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
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                <span className="w-14 text-xs font-semibold text-slate-600">Size</span>
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
            </div>
          )}
        </div>
        
        {toolButton("eraser", <Eraser size={20} />)}
        {toolButton("pan", <Hand size={20} />)}
        {toolButton("selector", <SquareDashedMousePointer size={20} />)}
        
        {/* Highlighter with color dropdown */}
        <div 
          className="relative"
          onMouseEnter={() => setShowHighlighterMenu(true)}
          onMouseLeave={() => setShowHighlighterMenu(false)}
        >
          <button
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
              tool === "highlighter" 
                ? "bg-slate-700 text-white hover:bg-slate-600" 
                : "text-slate-700 hover:bg-slate-200"
            }`}
            type="button"
            onClick={() => {
              onColorChange(highlighterColor);
              onToolChange("highlighter");
            }}
            title="Highlighter"
          >
            <Highlighter size={20} />
          </button>
          
          {/* Color dropdown menu */}
          {showHighlighterMenu && (
            <div className="absolute left-0 top-10 z-50 flex gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
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
          )}
        </div>
      </div>

      <span className="ml-auto w-14 text-center text-sm font-semibold text-slate-700">{zoomPercent}%</span>
      <button className={`btn h-9 ${isFullscreen ? "btn-active" : ""}`} type="button" onClick={onToggleFullscreen}>
        {isFullscreen ? "Exit Full" : "Full"}
      </button>

      <details className="group relative" ref={settingsRef}>
        <summary className="btn h-9 list-none select-none">Settings</summary>

        <div className="absolute right-0 top-11 z-30 w-[320px] space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">

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
