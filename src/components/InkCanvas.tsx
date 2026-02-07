import { useCallback, useEffect, useMemo, useRef } from "react";
import type { InkPoint, InkStroke, InkTool, Note } from "../types";
import { drawStrokePolygon, strokePolygon, uid } from "../utils/ink";

interface InkCanvasProps {
  note: Note;
  tool: InkTool;
  color: string;
  size: number;
  onAppendStroke: (noteId: string, stroke: InkStroke) => void;
  onEraseAt: (noteId: string, x: number, y: number, radius: number) => void;
  onPanViewport: (noteId: string, dx: number, dy: number) => void;
  onZoomViewportAt: (noteId: string, nextScale: number, anchorX: number, anchorY: number) => void;
  onExportReady?: (exportFn: () => string) => void;
}

const BACKGROUND = "#f8fafc";

export function InkCanvas({
  note,
  tool,
  color,
  size,
  onAppendStroke,
  onEraseAt,
  onPanViewport,
  onZoomViewportAt,
  onExportReady,
}: InkCanvasProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const dprRef = useRef(1);
  const drawingPointerId = useRef<number | null>(null);
  const panPointerId = useRef<number | null>(null);
  const currentPointsRef = useRef<InkPoint[]>([]);
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const dpr = dprRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(note.viewport.offsetX, note.viewport.offsetY);
    ctx.scale(note.viewport.scale, note.viewport.scale);

    for (const stroke of note.strokes) {
      drawStrokePolygon(ctx, strokePolygon(stroke), stroke.color, 0, 0);
    }

    if (currentPointsRef.current.length > 1 && tool === "pen") {
      const tempStroke: InkStroke = {
        id: "temp",
        tool: "pen",
        color,
        baseSize: size,
        points: currentPointsRef.current,
      };
      drawStrokePolygon(ctx, strokePolygon(tempStroke), tempStroke.color, 0, 0);
    }

    ctx.restore();
  }, [color, note.strokes, note.viewport.offsetX, note.viewport.offsetY, note.viewport.scale, size, tool]);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current !== null) {
      return;
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      drawScene();
    });
  }, [drawScene]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return;
    }

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      drawScene();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [drawScene]);

  useEffect(() => {
    scheduleDraw();
  }, [note, tool, size, color, scheduleDraw]);

  useEffect(() => {
    if (!onExportReady) {
      return;
    }
    onExportReady(() => canvasRef.current?.toDataURL("image/png") ?? "");
  }, [note.id, onExportReady]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const getCanvasSpacePoint = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const toWorldPoint = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvasPoint = getCanvasSpacePoint(clientX, clientY);
      const x = (canvasPoint.x - note.viewport.offsetX) / note.viewport.scale;
      const y = (canvasPoint.y - note.viewport.offsetY) / note.viewport.scale;
      return { x, y };
    },
    [getCanvasSpacePoint, note.viewport.offsetX, note.viewport.offsetY, note.viewport.scale],
  );

  const pushPointerEvent = useCallback(
    (event: PointerEvent | React.PointerEvent<HTMLCanvasElement>) => {
      const coalesced = "getCoalescedEvents" in event ? event.getCoalescedEvents() : [event];
      for (const e of coalesced) {
        const world = toWorldPoint(e.clientX, e.clientY);
        currentPointsRef.current.push({
          x: world.x,
          y: world.y,
          pressure: Math.max(0.1, e.pressure || 0.5),
          timestamp: performance.now(),
        });
      }
      scheduleDraw();
    },
    [scheduleDraw, toWorldPoint],
  );

  const finishStroke = useCallback(() => {
    if (currentPointsRef.current.length < 2) {
      currentPointsRef.current = [];
      scheduleDraw();
      return;
    }

    const stroke: InkStroke = {
      id: uid(),
      tool: "pen",
      color,
      baseSize: size,
      points: [...currentPointsRef.current],
    };

    onAppendStroke(note.id, stroke);
    currentPointsRef.current = [];
    scheduleDraw();
  }, [color, note.id, onAppendStroke, scheduleDraw, size]);

  const eraserRadius = useMemo(() => Math.max(8, size * 1.5) / note.viewport.scale, [note.viewport.scale, size]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    e.preventDefault();

    if (tool === "pan") {
      panPointerId.current = e.pointerId;
      lastPanRef.current = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    if (tool === "eraser") {
      drawingPointerId.current = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      const point = toWorldPoint(e.clientX, e.clientY);
      onEraseAt(note.id, point.x, point.y, eraserRadius);
      return;
    }

    drawingPointerId.current = e.pointerId;
    currentPointsRef.current = [];

    // Capture pointer so stroke continues outside canvas bounds.
    canvas.setPointerCapture(e.pointerId);
    pushPointerEvent(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (tool === "pan" && panPointerId.current === e.pointerId && lastPanRef.current) {
      const dx = e.clientX - lastPanRef.current.x;
      const dy = e.clientY - lastPanRef.current.y;
      lastPanRef.current = { x: e.clientX, y: e.clientY };
      onPanViewport(note.id, dx, dy);
      return;
    }

    if (drawingPointerId.current !== e.pointerId) {
      return;
    }

    e.preventDefault();

    if (tool === "eraser") {
      const point = toWorldPoint(e.clientX, e.clientY);
      onEraseAt(note.id, point.x, point.y, eraserRadius);
      return;
    }

    // Coalesced events improve ink quality on high-frequency pen sampling.
    pushPointerEvent(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (tool === "pan" && panPointerId.current === e.pointerId) {
      panPointerId.current = null;
      lastPanRef.current = null;
      canvas.releasePointerCapture(e.pointerId);
      return;
    }

    if (drawingPointerId.current === e.pointerId) {
      if (tool === "pen") {
        finishStroke();
      }
      drawingPointerId.current = null;
      canvas.releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    const canvasPoint = getCanvasSpacePoint(e.clientX, e.clientY);
    const intensity = e.deltaMode === 1 ? 0.06 : 0.002;
    const zoomFactor = Math.exp(-e.deltaY * intensity);
    const nextScale = note.viewport.scale * zoomFactor;

    onZoomViewportAt(note.id, nextScale, canvasPoint.x, canvasPoint.y);
  };

  return (
    <div className="ink-canvas-wrap" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="ink-canvas"
        style={{ cursor: tool === "pan" ? "grab" : tool === "eraser" ? "cell" : "crosshair" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      />
    </div>
  );
}
