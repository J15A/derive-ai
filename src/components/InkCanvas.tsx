import { useCallback, useEffect, useMemo, useRef } from "react";
import type { InkPoint, InkStroke, InkTool, Note } from "../types";
import { drawStrokePolygon, strokePolygon, uid } from "../utils/ink";

interface InkCanvasProps {
  note: Note;
  tool: InkTool;
  color: string;
  size: number;
  showGrid: boolean;
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
  showGrid,
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
  const isDrawingRef = useRef(false);
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

    if (showGrid) {
      const gridStep = 40;
      const startX = Math.floor((-note.viewport.offsetX / note.viewport.scale) / gridStep) * gridStep;
      const endX = Math.ceil(((rect.width - note.viewport.offsetX) / note.viewport.scale) / gridStep) * gridStep;
      const startY = Math.floor((-note.viewport.offsetY / note.viewport.scale) / gridStep) * gridStep;
      const endY = Math.ceil(((rect.height - note.viewport.offsetY) / note.viewport.scale) / gridStep) * gridStep;

      ctx.save();
      ctx.translate(note.viewport.offsetX, note.viewport.offsetY);
      ctx.scale(note.viewport.scale, note.viewport.scale);
      ctx.beginPath();
      ctx.lineWidth = 1 / note.viewport.scale;
      ctx.strokeStyle = "#dbe4ee";

      for (let x = startX; x <= endX; x += gridStep) {
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
      }
      for (let y = startY; y <= endY; y += gridStep) {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(note.viewport.offsetX, note.viewport.offsetY);
    ctx.scale(note.viewport.scale, note.viewport.scale);

    for (const stroke of note.strokes) {
      const polygon = strokePolygon(stroke);
      if (polygon.length >= 2) {
        drawStrokePolygon(ctx, polygon, stroke.color, 0, 0);
        continue;
      }
      const point = stroke.points[stroke.points.length - 1];
      if (!point) {
        continue;
      }
      const radius = Math.max(0.5, (stroke.baseSize * Math.max(0.1, point.pressure)) / 2);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = stroke.color;
      ctx.fill();
    }

    if (currentPointsRef.current.length === 1 && tool === "pen") {
      const point = currentPointsRef.current[0];
      const radius = Math.max(0.5, (size * Math.max(0.1, point.pressure)) / 2);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    } else if (currentPointsRef.current.length > 1 && tool === "pen") {
      const tempStroke: InkStroke = {
        id: "temp",
        tool: "pen",
        color,
        baseSize: size,
        points: currentPointsRef.current,
      };
      const polygon = strokePolygon(tempStroke);
      if (polygon.length >= 2) {
        drawStrokePolygon(ctx, polygon, tempStroke.color, 0, 0);
      } else {
        const point = tempStroke.points[tempStroke.points.length - 1];
        if (point) {
          const radius = Math.max(0.5, (size * Math.max(0.1, point.pressure)) / 2);
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }, [color, note.strokes, note.viewport.offsetX, note.viewport.offsetY, note.viewport.scale, showGrid, size, tool]);

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
      drawScene();
    };

    const handleViewportChange = () => {
      resize();
      requestAnimationFrame(resize);
      window.setTimeout(resize, 60);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    window.addEventListener("resize", handleViewportChange);
    document.addEventListener("fullscreenchange", handleViewportChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleViewportChange);
      document.removeEventListener("fullscreenchange", handleViewportChange);
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
      const samples = coalesced.length > 0 ? coalesced : [event];
      for (const e of samples) {
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const handlePointerRawUpdate = (event: Event) => {
      if (tool !== "pen" || !(event instanceof PointerEvent)) {
        return;
      }
      if (!isDrawingRef.current || drawingPointerId.current !== event.pointerId) {
        return;
      }

      pushPointerEvent(event);
      drawScene();
    };

    canvas.addEventListener("pointerrawupdate", handlePointerRawUpdate);
    return () => {
      canvas.removeEventListener("pointerrawupdate", handlePointerRawUpdate);
    };
  }, [drawScene, pushPointerEvent, tool]);

  const finishStroke = useCallback(() => {
    if (currentPointsRef.current.length === 1) {
      const firstPoint = currentPointsRef.current[0];
      currentPointsRef.current.push({
        ...firstPoint,
        x: firstPoint.x + 0.01,
        timestamp: performance.now(),
      });
    }

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
      isDrawingRef.current = true;
      drawingPointerId.current = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      const point = toWorldPoint(e.clientX, e.clientY);
      onEraseAt(note.id, point.x, point.y, eraserRadius);
      return;
    }

    isDrawingRef.current = true;
    drawingPointerId.current = e.pointerId;
    currentPointsRef.current = [];

    // Capture pointer so stroke continues outside canvas bounds.
    canvas.setPointerCapture(e.pointerId);
    pushPointerEvent(e);
    drawScene();
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

    const matchesPointer = drawingPointerId.current === e.pointerId;
    const hasPrimaryButtonDown = (e.buttons & 1) === 1;
    const drawByButtonFallback = isDrawingRef.current && hasPrimaryButtonDown;
    if (!matchesPointer && !drawByButtonFallback) {
      return;
    }
    if (!matchesPointer && drawByButtonFallback) {
      drawingPointerId.current = e.pointerId;
    }

    e.preventDefault();

    if (tool === "eraser") {
      const point = toWorldPoint(e.clientX, e.clientY);
      onEraseAt(note.id, point.x, point.y, eraserRadius);
      return;
    }

    // Coalesced events improve ink quality on high-frequency pen sampling.
    pushPointerEvent(e);
    drawScene();
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

    if (isDrawingRef.current) {
      if (tool === "pen") {
        finishStroke();
      }
      isDrawingRef.current = false;
      drawingPointerId.current = null;
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
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
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-b-2xl bg-slate-50" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
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
