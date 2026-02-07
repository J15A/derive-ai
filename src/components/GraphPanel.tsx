import { useEffect, useRef, useState } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";

declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator: (
        element: HTMLElement,
        options?: Record<string, unknown>
      ) => DesmosCalculator;
      Graphing3D?: (
        element: HTMLElement,
        options?: Record<string, unknown>
      ) => DesmosCalculator;
    };
  }
}

interface DesmosCalculator {
  setExpression: (expr: { id: string; latex: string; color?: string }) => void;
  removeExpression: (expr: { id: string }) => void;
  destroy: () => void;
  resize: () => void;
}

interface GraphEquation {
  id: string;
  latex: string;
  color: string;
  is3D?: boolean;
}

interface GraphPanelProps {
  equations: GraphEquation[];
  onRemoveEquation: (id: string) => void;
  onClose: () => void;
}

export type { GraphEquation };

// Helper function to detect if equation needs 3D mode
function needs3D(latex: string): boolean {
  // Check for z variable (common in 3D equations)
  // Look for z as a standalone variable, not just in function names
  return /\bz\b/i.test(latex) || 
         latex.includes('z=') || 
         latex.includes('z^') ||
         latex.includes('z_') ||
         latex.includes('z+') ||
         latex.includes('z-') ||
         latex.includes('z*') ||
         latex.includes('z/') ||
         latex.includes('z)') ||
         latex.includes('(z');
}

export function GraphPanel({
  equations,
  onRemoveEquation,
  onClose,
}: GraphPanelProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<DesmosCalculator | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(!!window.Desmos);
  const [collapsed, setCollapsed] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Check if we need 3D mode
  const is3DMode = equations.some(eq => needs3D(eq.latex));

  useEffect(() => {
    if (is3DMode) {
      console.log("🎯 3D mode detected!");
      console.log("Equations:", equations.map(eq => eq.latex));
      console.log("Graphing3D available:", !!window.Desmos?.Graphing3D);
    }
  }, [is3DMode, equations]);

  // Load Desmos script once
  useEffect(() => {
    if (window.Desmos) {
      setScriptLoaded(true);
      return;
    }

    const existing = document.querySelector(
      'script[src*="desmos.com/api"]'
    );
    if (existing) {
      existing.addEventListener("load", () => setScriptLoaded(true));
      return;
    }

    // Load the main Desmos API v1.11 which includes both 2D and 3D calculators
    const script = document.createElement("script");
    script.src = "https://www.desmos.com/api/v1.11/calculator.js?apiKey=7b6711de094c4e1c9000de7fe7c2292a";
    script.async = true;
    script.onload = () => {
      console.log("✅ Desmos API v1.11 loaded successfully");
      console.log("2D Calculator available:", !!window.Desmos?.GraphingCalculator);
      console.log("3D Calculator (Graphing3D) available:", !!window.Desmos?.Graphing3D);
      setScriptLoaded(true);
    };
    script.onerror = () => {
      console.error("❌ Failed to load Desmos API");
      setLoadError("Failed to load Desmos API. Check your internet connection.");
    };
    document.head.appendChild(script);
  }, []);

  // Create calculator instance
  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || !window.Desmos || collapsed) {
      return;
    }

    // Destroy previous instance if any
    if (calcRef.current) {
      calcRef.current.destroy();
      calcRef.current = null;
    }

    // Use 3D calculator if any equation needs it, otherwise use 2D
    let calc: DesmosCalculator;
    
    if (is3DMode && window.Desmos.Graphing3D) {
      console.log("✅ Creating 3D calculator using Graphing3D");
      calc = window.Desmos.Graphing3D(containerRef.current, {
        expressions: false,
        settingsMenu: false,
        zoomButtons: true,
        border: false,
      });
    } else if (is3DMode && !window.Desmos.Graphing3D) {
      console.warn("⚠️ 3D calculator (Graphing3D) not available, falling back to 2D");
      calc = window.Desmos.GraphingCalculator(containerRef.current, {
        expressions: false,
        settingsMenu: false,
        zoomButtons: true,
        lockViewport: false,
        border: false,
        keypad: false,
      });
    } else {
      console.log("✅ Creating 2D calculator");
      calc = window.Desmos.GraphingCalculator(containerRef.current, {
        expressions: false,
        settingsMenu: false,
        zoomButtons: true,
        lockViewport: false,
        border: false,
        keypad: false,
      });
    }

    calcRef.current = calc;

    // Add existing equations
    for (const eq of equations) {
      calc.setExpression({ id: eq.id, latex: eq.latex, color: eq.color });
    }

    return () => {
      calc.destroy();
      calcRef.current = null;
    };
    // We re-create when collapsed changes or when switching between 2D/3D mode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptLoaded, collapsed, is3DMode]);

  // Sync equations to calculator
  const prevEquationsRef = useRef<GraphEquation[]>([]);
  useEffect(() => {
    const calc = calcRef.current;
    if (!calc) return;

    const currentIds = new Set(equations.map(eq => eq.id));

    // Remove equations that are no longer in the list
    for (const prevEq of prevEquationsRef.current) {
      if (!currentIds.has(prevEq.id)) {
        calc.removeExpression({ id: prevEq.id });
      }
    }

    // Add or update equations
    for (const eq of equations) {
      calc.setExpression({ id: eq.id, latex: eq.latex, color: eq.color });
    }

    prevEquationsRef.current = equations;
  }, [equations]);

  // Resize on equation list change
  useEffect(() => {
    calcRef.current?.resize();
  }, [equations.length]);

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-end border-b border-slate-100 bg-slate-50 px-2 py-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <button
            type="button"
            className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
            onClick={onClose}
            title="Close graph"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Desmos graph container */}
          {loadError ? (
            <div className="flex h-[300px] w-full items-center justify-center bg-red-50 px-4 text-center">
              <div>
                <p className="text-sm font-medium text-red-700">{loadError}</p>
                <button
                  type="button"
                  className="mt-2 rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
                  onClick={() => window.location.reload()}
                >
                  Reload Page
                </button>
              </div>
            </div>
          ) : (
            <div ref={containerRef} className="h-[300px] w-full" />
          )}

          {/* Equations list */}
          {equations.length > 0 && (
            <div className="max-h-[140px] overflow-y-auto border-t border-slate-100">
              {equations.map((eq) => (
                <div
                  key={eq.id}
                  className="flex items-center gap-2 border-b border-slate-50 px-3 py-1.5 last:border-b-0"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: eq.color }}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700">
                    {eq.latex}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    onClick={() => onRemoveEquation(eq.id)}
                    title="Remove equation"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {equations.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-slate-400">
              Select strokes and click the graph button to add equations
            </div>
          )}
        </>
      )}
    </section>
  );
}
