import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  onDeleteStrokes: (noteId: string, strokeIds: string[]) => void;
  onMoveStrokes: (noteId: string, strokeIds: string[], dx: number, dy: number) => void;
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
  onDeleteStrokes,
  onMoveStrokes,
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
  
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [selectedStrokes, setSelectedStrokes] = useState<string[]>([]);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);

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
      const opacity = stroke.tool === "highlighter" ? 0.4 : 1;
      
      ctx.save();
      ctx.globalAlpha = opacity;
      
      const polygon = strokePolygon(stroke);
      if (polygon.length >= 2) {
        drawStrokePolygon(ctx, polygon, stroke.color, 0, 0);
      } else {
        const point = stroke.points[stroke.points.length - 1];
        if (point) {
          const radius = Math.max(0.5, (stroke.baseSize * Math.max(0.1, point.pressure)) / 2);
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = stroke.color;
          ctx.fill();
        }
      }
      
      ctx.restore();
    }
    
    // Draw single bounding box for all selected strokes
    if (selectedStrokes.length > 0 && tool === "selector") {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      
      for (const stroke of note.strokes) {
        if (selectedStrokes.includes(stroke.id)) {
          const points = stroke.points;
          if (points.length > 0) {
            const xs = points.map(p => p.x);
            const ys = points.map(p => p.y);
            minX = Math.min(minX, ...xs);
            minY = Math.min(minY, ...ys);
            maxX = Math.max(maxX, ...xs);
            maxY = Math.max(maxY, ...ys);
          }
        }
      }
      
      if (minX !== Infinity && maxX !== -Infinity) {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2 / note.viewport.scale;
        ctx.setLineDash([5 / note.viewport.scale, 5 / note.viewport.scale]);
        ctx.strokeRect(minX - 5, minY - 5, maxX - minX + 10, maxY - minY + 10);
        ctx.setLineDash([]);
      }
    }

    if (currentPointsRef.current.length === 1 && (tool === "pen" || tool === "highlighter")) {
      const point = currentPointsRef.current[0];
      const radius = Math.max(0.5, (size * Math.max(0.1, point.pressure)) / 2);
      ctx.save();
      ctx.globalAlpha = tool === "highlighter" ? 0.4 : 1;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    } else if (currentPointsRef.current.length > 1 && (tool === "pen" || tool === "highlighter")) {
      const tempStroke: InkStroke = {
        id: "temp",
        tool: tool === "highlighter" ? "highlighter" : "pen",
        color,
        baseSize: size,
        points: currentPointsRef.current,
      };
      const polygon = strokePolygon(tempStroke);
      if (polygon.length >= 2) {
        ctx.save();
      ctx.globalAlpha = tool === "highlighter" ? 0.4 : 1;
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
      ctx.restore();
    }
    
    if (selectionBox && tool === "selector") {
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2 / note.viewport.scale;
      ctx.setLineDash([5 / note.viewport.scale, 5 / note.viewport.scale]);
      ctx.strokeRect(
        Math.min(selectionBox.startX, selectionBox.endX),
        Math.min(selectionBox.startY, selectionBox.endY),
        Math.abs(selectionBox.endX - selectionBox.startX),
        Math.abs(selectionBox.endY - selectionBox.startY)
      );
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [color, note.strokes, note.viewport.offsetX, note.viewport.offsetY, note.viewport.scale, showGrid, size, tool, selectedStrokes, selectionBox]);

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
    // Clear selection when switching away from selector tool
    if (tool !== "selector" && selectedStrokes.length > 0) {
      setSelectedStrokes([]);
      setSelectionBox(null);
    }
  }, [tool, selectedStrokes.length]);

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
      if ((tool !== "pen" && tool !== "highlighter") || !(event instanceof PointerEvent)) {
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
      tool: (tool === "pen" || tool === "highlighter") ? tool : "pen",
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
    
    if (tool === "selector") {
      const point = toWorldPoint(e.clientX, e.clientY);
      
      // Check if clicking on selected strokes to drag
      const clickedStroke = note.strokes.find(stroke => {
        if (!selectedStrokes.includes(stroke.id)) return false;
        const points = stroke.points;
        if (points.length === 0) return false;
        
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        
        return point.x >= minX - 5 && point.x <= maxX + 5 && 
               point.y >= minY - 5 && point.y <= maxY + 5;
      });
      
      if (clickedStroke) {
        setIsDraggingSelection(true);
        setDragOffset({ x: point.x, y: point.y });
        drawingPointerId.current = e.pointerId;
        canvas.setPointerCapture(e.pointerId);
      } else {
        drawingPointerId.current = e.pointerId;
        setSelectionBox({ startX: point.x, startY: point.y, endX: point.x, endY: point.y });
        canvas.setPointerCapture(e.pointerId);
      }
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
    
    if (tool === "selector") {
      const point = toWorldPoint(e.clientX, e.clientY);
      
      if (isDraggingSelection && dragOffset) {
        const dx = point.x - dragOffset.x;
        const dy = point.y - dragOffset.y;
        onMoveStrokes(note.id, selectedStrokes, dx, dy);
        setDragOffset(point);
        scheduleDraw();
      } else if (selectionBox) {
        setSelectionBox(prev => prev ? { ...prev, endX: point.x, endY: point.y } : null);
        scheduleDraw();
      }
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

    if (drawingPointerId.current === e.pointerId) {
      if (tool === "pen" || tool === "highlighter") {
        if (isDrawingRef.current) {
          finishStroke();
        }
      } else if (tool === "selector") {
        if (isDraggingSelection && dragOffset) {
          setIsDraggingSelection(false);
          setDragOffset(null);
        } else if (selectionBox) {
          // Select strokes within the box
          const minX = Math.min(selectionBox.startX, selectionBox.endX);
          const maxX = Math.max(selectionBox.startX, selectionBox.endX);
          const minY = Math.min(selectionBox.startY, selectionBox.endY);
          const maxY = Math.max(selectionBox.startY, selectionBox.endY);
          
          const selected = note.strokes.filter(stroke => {
            const points = stroke.points;
            if (points.length === 0) return false;
            
            return points.some(p => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
          }).map(s => s.id);
          
          setSelectedStrokes(selected);
          setSelectionBox(null);
          scheduleDraw();
        }
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

  // Keyboard handler for deleting selected strokes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Backspace" || e.key === "Delete") && selectedStrokes.length > 0 && tool === "selector") {
        e.preventDefault();
        onDeleteStrokes(note.id, selectedStrokes);
        setSelectedStrokes([]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedStrokes, tool, note.id, onDeleteStrokes]);

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-b-2xl bg-slate-50" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        style={{ cursor: tool === "pan" ? "grab" : tool === "eraser" ? "cell" : tool === "selector" ? "default" : "crosshair" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      />
    </div>
  );
}
