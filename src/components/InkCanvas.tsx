import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InkPoint, InkStroke, InkTool, Note, TextAnnotation } from "../types";
import { drawStrokePolygon, strokePolygon, strokesToPngDataUrl, uid } from "../utils/ink";
import { solveEquation, recognizeEquationForGraph } from "../api/client";
import { SelectionPopup } from "./SelectionPopup";

interface InkCanvasProps {
  note: Note;
  tool: InkTool;
  color: string;
  penSize: number;
  highlighterSize: number;
  showGrid: boolean;
  onAppendStroke: (noteId: string, stroke: InkStroke) => void;
  onEraseAt: (noteId: string, x: number, y: number, radius: number) => void;
  onDeleteStrokes: (noteId: string, strokeIds: string[]) => void;
  onMoveStrokes: (noteId: string, strokeIds: string[], dx: number, dy: number) => void;
  onDuplicateStrokes: (noteId: string, strokeIds: string[]) => string[];
  onChangeStrokesColor: (noteId: string, strokeIds: string[], newColor: string) => void;
  onAddTextAnnotation: (noteId: string, annotation: TextAnnotation) => void;
  onDeleteImages: (noteId: string, imageIds: string[]) => void;
  onMoveImages: (noteId: string, imageIds: string[], dx: number, dy: number) => void;
  onScaleStrokes: (noteId: string, strokeIds: string[], scale: number, centerX: number, centerY: number) => void;
  onScaleImages: (noteId: string, imageIds: string[], scale: number, centerX: number, centerY: number) => void;
  onPanViewport: (noteId: string, dx: number, dy: number) => void;
  onZoomViewportAt: (noteId: string, nextScale: number, anchorX: number, anchorY: number) => void;
  onAddToGraph?: (latex: string) => void;
  onExportReady?: (exportFn: () => string) => void;
}

const BACKGROUND = "#f8fafc";
const INSERT_TEXT_COLOR = "#000000";

export function InkCanvas({
                            note,
                            tool,
                            color,
                            penSize,
                            highlighterSize,
                            showGrid,
                            onAppendStroke,
                            onEraseAt,
                            onDeleteStrokes,
                            onMoveStrokes,
                            onDeleteImages,
                            onMoveImages,
                            onScaleStrokes,
                            onScaleImages,
                            onDuplicateStrokes,
                            onChangeStrokesColor,
                            onAddTextAnnotation,
                            onPanViewport,
                            onZoomViewportAt,
                            onAddToGraph,
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
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; bounds: { minX: number; minY: number; maxX: number; maxY: number } } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [eraserTrail, setEraserTrail] = useState<{ x: number; y: number }[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSolving, setIsSolving] = useState(false);
  const [isGraphing, setIsGraphing] = useState(false);
  const [textInput, setTextInput] = useState<{ x: number; y: number; worldX: number; worldY: number } | null>(null);
  const [textValue, setTextValue] = useState("");
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());

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

    // Render text annotations in world coordinates with handwritten style
    for (const annotation of note.textAnnotations ?? []) {
      ctx.save();

      // Use Caveat - a natural handwriting font
      ctx.font = `700 ${annotation.fontSize}px "Caveat", "Bradley Hand", "Brush Script MT", cursive`;
      ctx.fillStyle = annotation.color;
      ctx.textBaseline = "top";

      // Add subtle shadow for depth
      ctx.shadowColor = "rgba(0, 0, 0, 0.08)";
      ctx.shadowBlur = 1.5 / note.viewport.scale;
      ctx.shadowOffsetX = 0.5 / note.viewport.scale;
      ctx.shadowOffsetY = 0.5 / note.viewport.scale;

      // Split text by newlines and render each line
      const lines = annotation.text.split("\n");
      const lineHeight = annotation.fontSize * 1.1; // Tighter line spacing (1.1x)

      lines.forEach((line, index) => {
        ctx.fillText(line, annotation.x, annotation.y + index * lineHeight);
      });

      ctx.restore();
    }

    // Draw images
    for (const image of note.images) {
      const img = loadedImages.get(image.id);
      if (img && img.complete) {
        ctx.drawImage(img, image.x, image.y, image.width, image.height);
      }
    }

    // Draw single bounding box for all selected strokes and images
    if ((selectedStrokes.length > 0 || selectedImages.length > 0) && tool === "selector") {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const stroke of note.strokes) {
        if (selectedStrokes.includes(stroke.id)) {
          const points = stroke.points;
          if (points.length > 0) {
            const xs = points.map((p) => p.x);
            const ys = points.map((p) => p.y);
            minX = Math.min(minX, ...xs);
            minY = Math.min(minY, ...ys);
            maxX = Math.max(maxX, ...xs);
            maxY = Math.max(maxY, ...ys);
          }
        }
      }

      for (const image of note.images) {
        if (selectedImages.includes(image.id)) {
          minX = Math.min(minX, image.x);
          minY = Math.min(minY, image.y);
          maxX = Math.max(maxX, image.x + image.width);
          maxY = Math.max(maxY, image.y + image.height);
        }
      }

      if (minX !== Infinity && maxX !== -Infinity) {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2 / note.viewport.scale;
        ctx.setLineDash([5 / note.viewport.scale, 5 / note.viewport.scale]);
        ctx.strokeRect(minX - 5, minY - 5, maxX - minX + 10, maxY - minY + 10);
        ctx.setLineDash([]);

        // Draw resize handles at corners
        const handleSize = 8 / note.viewport.scale;
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2 / note.viewport.scale;

        const handles = [
          { x: minX - 5, y: minY - 5, id: "nw" },
          { x: maxX + 5, y: minY - 5, id: "ne" },
          { x: maxX + 5, y: maxY + 5, id: "se" },
          { x: minX - 5, y: maxY + 5, id: "sw" },
        ];

        for (const handle of handles) {
          ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
          ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
        }
      }
    }

    if (currentPointsRef.current.length === 1 && (tool === "pen" || tool === "highlighter")) {
      const point = currentPointsRef.current[0];
      const currentSize = tool === "highlighter" ? highlighterSize : penSize;
      const radius = Math.max(0.5, (currentSize * Math.max(0.1, point.pressure)) / 2);
      ctx.save();
      ctx.globalAlpha = tool === "highlighter" ? 0.4 : 1;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    } else if (currentPointsRef.current.length > 1 && (tool === "pen" || tool === "highlighter")) {
      const currentSize = tool === "highlighter" ? highlighterSize : penSize;
      const tempStroke: InkStroke = {
        id: "temp",
        tool: tool === "highlighter" ? "highlighter" : "pen",
        color,
        baseSize: currentSize,
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
          const radius = Math.max(0.5, (currentSize * Math.max(0.1, point.pressure)) / 2);
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
          Math.abs(selectionBox.endY - selectionBox.startY),
      );
      ctx.setLineDash([]);
    }

    // Draw eraser trail
    if (eraserTrail.length > 1 && tool === "eraser") {
      ctx.strokeStyle = "rgba(156, 163, 175, 0.4)"; // Faint grey
      ctx.lineWidth = Math.max(2, penSize * 0.5) / note.viewport.scale;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(eraserTrail[0].x, eraserTrail[0].y);
      for (let i = 1; i < eraserTrail.length; i++) {
        ctx.lineTo(eraserTrail[i].x, eraserTrail[i].y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }, [
    color,
    note.strokes,
    note.images,
    note.viewport.offsetX,
    note.viewport.offsetY,
    note.viewport.scale,
    showGrid,
    penSize,
    highlighterSize,
    tool,
    selectedStrokes,
    selectedImages,
    selectionBox,
    eraserTrail,
    loadedImages,
  ]);

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
  }, [note, tool, penSize, highlighterSize, color, scheduleDraw]);

  // Load images when they change
  useEffect(() => {
    const newLoadedImages = new Map(loadedImages);
    let hasChanges = false;

    for (const image of note.images) {
      if (!newLoadedImages.has(image.id)) {
        const img = new Image();
        img.src = image.dataUrl;
        newLoadedImages.set(image.id, img);
        hasChanges = true;

        img.onload = () => {
          scheduleDraw();
        };
      }
    }

    // Remove images that no longer exist
    for (const [id] of newLoadedImages) {
      if (!note.images.some((img) => img.id === id)) {
        newLoadedImages.delete(id);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      setLoadedImages(newLoadedImages);
    }
  }, [note.images, scheduleDraw, loadedImages]);

  useEffect(() => {
    // Clear selection when switching away from selector tool
    if (tool !== "selector" && (selectedStrokes.length > 0 || selectedImages.length > 0)) {
      setSelectedStrokes([]);
      setSelectedImages([]);
      setSelectionBox(null);
      setShowPopup(false);
      setIsResizing(false);
      setResizeHandle(null);
      setResizeStart(null);
    }

    // Clear eraser trail when switching tools
    if (tool !== "eraser") {
      setEraserTrail([]);
    }
  }, [tool, selectedStrokes.length, selectedImages.length]);

  // Show popup below selection when strokes or images are selected
  useEffect(() => {
    if ((selectedStrokes.length > 0 || selectedImages.length > 0) && tool === "selector" && !isDraggingSelection) {
      // Calculate bounding box of selected strokes and images in world space
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const stroke of note.strokes) {
        if (selectedStrokes.includes(stroke.id)) {
          const points = stroke.points;
          if (points.length > 0) {
            const xs = points.map((p) => p.x);
            const ys = points.map((p) => p.y);
            minX = Math.min(minX, ...xs);
            minY = Math.min(minY, ...ys);
            maxX = Math.max(maxX, ...xs);
            maxY = Math.max(maxY, ...ys);
          }
        }
      }

      for (const image of note.images) {
        if (selectedImages.includes(image.id)) {
          minX = Math.min(minX, image.x);
          minY = Math.min(minY, image.y);
          maxX = Math.max(maxX, image.x + image.width);
          maxY = Math.max(maxY, image.y + image.height);
        }
      }

      if (minX !== Infinity && maxX !== -Infinity) {
        // Convert world coordinates to canvas/screen coordinates
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          // Center horizontally, position below the bottom of the selection
          const centerX = (minX + maxX) / 2;
          const bottomY = maxY + 10; // 10px padding in world space

          const canvasX = centerX * note.viewport.scale + note.viewport.offsetX;
          const canvasY = bottomY * note.viewport.scale + note.viewport.offsetY;

          // Position popup relative to the viewport (fixed positioning)
          setPopupPosition({
            x: rect.left + canvasX,
            y: rect.top + canvasY,
          });
          setShowPopup(true);
        }
      }
    } else {
      setShowPopup(false);
    }
  }, [selectedStrokes, tool, note.strokes, note.viewport, isDraggingSelection]);

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

    const currentSize = tool === "highlighter" ? highlighterSize : penSize;
    const stroke: InkStroke = {
      id: uid(),
      tool: tool === "pen" || tool === "highlighter" ? tool : "pen",
      color,
      baseSize: currentSize,
      points: [...currentPointsRef.current],
    };

    onAppendStroke(note.id, stroke);
    currentPointsRef.current = [];
    scheduleDraw();
  }, [color, note.id, onAppendStroke, scheduleDraw, tool, penSize, highlighterSize]);

  const eraserRadius = useMemo(() => {
    const currentSize = tool === "highlighter" ? highlighterSize : penSize;
    return Math.max(8, currentSize * 1.5) / note.viewport.scale;
  }, [note.viewport.scale, penSize, highlighterSize, tool]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    e.preventDefault();

    // Allow panning with middle mouse button for any tool
    const shouldPan = e.button === 1 || tool === "pan";

    if (shouldPan) {
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
      setEraserTrail([point]); // Start trail
      onEraseAt(note.id, point.x, point.y, eraserRadius);
      return;
    }

    if (tool === "text") {
      const point = toWorldPoint(e.clientX, e.clientY);
      const canvasPoint = getCanvasSpacePoint(e.clientX, e.clientY);
      setTextInput({ x: canvasPoint.x, y: canvasPoint.y, worldX: point.x, worldY: point.y });
      setTextValue("");
      return;
    }

    if (tool === "selector") {
      const point = toWorldPoint(e.clientX, e.clientY);

      // First check if clicking on a resize handle
      if (selectedStrokes.length > 0 || selectedImages.length > 0) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const stroke of note.strokes) {
          if (selectedStrokes.includes(stroke.id)) {
            const points = stroke.points;
            if (points.length > 0) {
              const xs = points.map((p) => p.x);
              const ys = points.map((p) => p.y);
              minX = Math.min(minX, ...xs);
              minY = Math.min(minY, ...ys);
              maxX = Math.max(maxX, ...xs);
              maxY = Math.max(maxY, ...ys);
            }
          }
        }

        for (const image of note.images) {
          if (selectedImages.includes(image.id)) {
            minX = Math.min(minX, image.x);
            minY = Math.min(minY, image.y);
            maxX = Math.max(maxX, image.x + image.width);
            maxY = Math.max(maxY, image.y + image.height);
          }
        }

        if (minX !== Infinity && maxX !== -Infinity) {
          const handleSize = 8 / note.viewport.scale;
          const tolerance = handleSize;

          const handles = [
            { x: minX - 5, y: minY - 5, id: "nw" },
            { x: maxX + 5, y: minY - 5, id: "ne" },
            { x: maxX + 5, y: maxY + 5, id: "se" },
            { x: minX - 5, y: maxY + 5, id: "sw" },
          ];

          for (const handle of handles) {
            if (Math.abs(point.x - handle.x) <= tolerance && Math.abs(point.y - handle.y) <= tolerance) {
              setIsResizing(true);
              setResizeHandle(handle.id);
              setResizeStart({
                x: point.x,
                y: point.y,
                bounds: { minX: minX - 5, minY: minY - 5, maxX: maxX + 5, maxY: maxY + 5 },
              });
              drawingPointerId.current = e.pointerId;
              canvas.setPointerCapture(e.pointerId);
              return;
            }
          }
        }
      }

      // Check if clicking on a selected image first (images are on top)
      const clickedImage = note.images.find((image) => {
        if (!selectedImages.includes(image.id)) return false;
        return point.x >= image.x && point.x <= image.x + image.width && point.y >= image.y && point.y <= image.y + image.height;
      });

      // Then check if clicking on selected strokes
      const clickedStroke = note.strokes.find((stroke) => {
        if (!selectedStrokes.includes(stroke.id)) return false;
        const points = stroke.points;
        if (points.length === 0) return false;

        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);

        return point.x >= minX - 5 && point.x <= maxX + 5 && point.y >= minY - 5 && point.y <= maxY + 5;
      });

      if (clickedImage || clickedStroke) {
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

    // Handle panning for any tool when triggered
    if (panPointerId.current === e.pointerId && lastPanRef.current) {
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

      // Add to trail (limit to last 30 points for performance)
      setEraserTrail((prev) => {
        const newTrail = [...prev, point];
        return newTrail.length > 30 ? newTrail.slice(-30) : newTrail;
      });

      onEraseAt(note.id, point.x, point.y, eraserRadius);
      return;
    }

    if (tool === "selector") {
      const point = toWorldPoint(e.clientX, e.clientY);

      if (isResizing && resizeStart && resizeHandle) {
        // Calculate scale based on resize handle movement
        const bounds = resizeStart.bounds;
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;

        let scale = 1;

        if (resizeHandle === "se") {
          // Bottom-right: scale based on distance from top-left
          const originalDist = Math.sqrt(Math.pow(bounds.maxX - bounds.minX, 2) + Math.pow(bounds.maxY - bounds.minY, 2));
          const newDist = Math.sqrt(Math.pow(point.x - bounds.minX, 2) + Math.pow(point.y - bounds.minY, 2));
          scale = newDist / originalDist;
        } else if (resizeHandle === "nw") {
          // Top-left: scale based on distance from bottom-right
          const originalDist = Math.sqrt(Math.pow(bounds.maxX - bounds.minX, 2) + Math.pow(bounds.maxY - bounds.minY, 2));
          const newDist = Math.sqrt(Math.pow(bounds.maxX - point.x, 2) + Math.pow(bounds.maxY - point.y, 2));
          scale = newDist / originalDist;
        } else if (resizeHandle === "ne") {
          // Top-right: scale based on distance from bottom-left
          const originalDist = Math.sqrt(Math.pow(bounds.maxX - bounds.minX, 2) + Math.pow(bounds.maxY - bounds.minY, 2));
          const newDist = Math.sqrt(Math.pow(point.x - bounds.minX, 2) + Math.pow(bounds.maxY - point.y, 2));
          scale = newDist / originalDist;
        } else if (resizeHandle === "sw") {
          // Bottom-left: scale based on distance from top-right
          const originalDist = Math.sqrt(Math.pow(bounds.maxX - bounds.minX, 2) + Math.pow(bounds.maxY - bounds.minY, 2));
          const newDist = Math.sqrt(Math.pow(bounds.maxX - point.x, 2) + Math.pow(point.y - bounds.minY, 2));
          scale = newDist / originalDist;
        }

        // Clamp scale to reasonable values
        scale = Math.max(0.1, Math.min(10, scale));

        onScaleStrokes(note.id, selectedStrokes, scale, centerX, centerY);
        onScaleImages(note.id, selectedImages, scale, centerX, centerY);

        // Update resize start for next frame
        setResizeStart({
          x: point.x,
          y: point.y,
          bounds: {
            minX: centerX + (bounds.minX - centerX) * scale,
            minY: centerY + (bounds.minY - centerY) * scale,
            maxX: centerX + (bounds.maxX - centerX) * scale,
            maxY: centerY + (bounds.maxY - centerY) * scale,
          },
        });
        scheduleDraw();
      } else if (isDraggingSelection && dragOffset) {
        const dx = point.x - dragOffset.x;
        const dy = point.y - dragOffset.y;
        onMoveStrokes(note.id, selectedStrokes, dx, dy);
        onMoveImages(note.id, selectedImages, dx, dy);
        setDragOffset(point);
        scheduleDraw();
      } else if (selectionBox) {
        setSelectionBox((prev) => (prev ? { ...prev, endX: point.x, endY: point.y } : null));
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

    // Handle pan release for any tool
    if (panPointerId.current === e.pointerId) {
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
      } else if (tool === "eraser") {
        // Clear trail when releasing eraser
        setEraserTrail([]);
      } else if (tool === "selector") {
        if (isResizing) {
          setIsResizing(false);
          setResizeHandle(null);
          setResizeStart(null);
        } else if (isDraggingSelection && dragOffset) {
          setIsDraggingSelection(false);
          setDragOffset(null);
        } else if (selectionBox) {
          // Select strokes and images within the box
          const minX = Math.min(selectionBox.startX, selectionBox.endX);
          const maxX = Math.max(selectionBox.startX, selectionBox.endX);
          const minY = Math.min(selectionBox.startY, selectionBox.endY);
          const maxY = Math.max(selectionBox.startY, selectionBox.endY);

          const selectedStrokeIds = note.strokes
              .filter((stroke) => {
                const points = stroke.points;
                if (points.length === 0) return false;

                return points.some((p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
              })
              .map((s) => s.id);

          const selectedImageIds = note.images
              .filter((image) => {
                // Check if image intersects with selection box
                return !(image.x + image.width < minX || image.x > maxX || image.y + image.height < minY || image.y > maxY);
              })
              .map((img) => img.id);

          setSelectedStrokes(selectedStrokeIds);
          setSelectedImages(selectedImageIds);
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

  // Keyboard handler for deleting selected strokes and images
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Backspace" || e.key === "Delete") && (selectedStrokes.length > 0 || selectedImages.length > 0) && tool === "selector") {
        e.preventDefault();
        if (selectedStrokes.length > 0) {
          onDeleteStrokes(note.id, selectedStrokes);
        }
        if (selectedImages.length > 0) {
          onDeleteImages(note.id, selectedImages);
        }
        setSelectedStrokes([]);
        setSelectedImages([]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedStrokes, selectedImages, tool, note.id, onDeleteStrokes, onDeleteImages]);

  const handlePopupDelete = () => {
    if (selectedStrokes.length > 0) {
      onDeleteStrokes(note.id, selectedStrokes);
    }
    if (selectedImages.length > 0) {
      onDeleteImages(note.id, selectedImages);
    }
    setSelectedStrokes([]);
    setSelectedImages([]);
    setShowPopup(false);
  };

  const handlePopupDuplicate = () => {
    const newIds = onDuplicateStrokes(note.id, selectedStrokes);
    setSelectedStrokes(newIds);
    setShowPopup(false);
  };

  const handlePopupSolve = async () => {
    const selectedStrokeObjects = note.strokes.filter((stroke) => selectedStrokes.includes(stroke.id));

    if (selectedStrokeObjects.length === 0) return;

    setIsSolving(true);

    try {
      // Render selected strokes to a PNG image
      const imageDataUrl = strokesToPngDataUrl(selectedStrokeObjects);

      // Send to backend via API
      const result = await solveEquation(imageDataUrl);

      // Check if equation was not recognized
      if (result.toLowerCase().includes("could not recognize")) {
        // Show a friendly error message instead of adding text annotation
        alert("⚠️ Unable to recognize the equation\n\nPlease make sure your handwriting is clear and try again.");
        return;
      }

      // Calculate position and size based on the selection bounding box
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let totalSize = 0;

      for (const stroke of selectedStrokeObjects) {
        totalSize += stroke.baseSize;
        for (const p of stroke.points) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
      }

      // Calculate average stroke size and use it for font size (much larger)
      const avgStrokeSize = totalSize / selectedStrokeObjects.length;
      const fontSize = Math.max(80, avgStrokeSize * 15); // Much bigger: at least 80px, scale 15x with stroke size
      const textY = maxY + fontSize * 0.3; // Add spacing proportional to font size

      const annotation: TextAnnotation = {
        id: uid(),
        x: minX,
        y: textY,
        text: result,
        fontSize,
        color: "#3B82F6",
      };

      onAddTextAnnotation(note.id, annotation);

      // Force immediate redraw to show the solution
      scheduleDraw();

      // Clear selection so user can see the solution immediately
      setSelectedStrokes([]);
      setSelectionBox(null);
    } catch (error) {
      console.error("Failed to solve equation:", error);
      const message = error instanceof Error ? error.message : "Failed to solve equation";
      alert(`❌ Error solving equation\n\n${message}`);
    } finally {
      setIsSolving(false);
      setShowPopup(false);
    }
  };

  const handlePopupChangeColor = (newColor: string) => {
    onChangeStrokesColor(note.id, selectedStrokes, newColor);
  };

  const handlePopupAddToGraph = async () => {
    const selectedStrokeObjects = note.strokes.filter((stroke) => selectedStrokes.includes(stroke.id));
    if (selectedStrokeObjects.length === 0) return;

    setIsGraphing(true);
    console.log("📈 Adding to graph:", selectedStrokeObjects.length, "strokes");

    try {
      const imageDataUrl = strokesToPngDataUrl(selectedStrokeObjects);
      console.log("📸 Generated image data URL, length:", imageDataUrl.length);

      const latex = await recognizeEquationForGraph(imageDataUrl);
      console.log("✅ Recognized LaTeX:", latex);

      if (onAddToGraph) {
        onAddToGraph(latex);
        console.log("📊 Added to graph panel");
      } else {
        console.warn("⚠️ onAddToGraph callback is not defined");
      }

      setSelectedStrokes([]);
      setSelectionBox(null);
    } catch (error) {
      console.error("❌ Failed to add to graph:", error);
      const message = error instanceof Error ? error.message : "Failed to recognize equation";
      alert(`❌ Error adding to graph\n\n${message}\n\nMake sure the server is running on port 3001`);
    } finally {
      setIsGraphing(false);
      setShowPopup(false);
    }
  };

  const handlePopupClose = () => {
    setShowPopup(false);
  };

  const handleTextSubmit = () => {
    if (!textInput || !textValue.trim()) {
      setTextInput(null);
      setTextValue("");
      return;
    }

    const annotation: TextAnnotation = {
      id: uid(),
      x: textInput.worldX,
      y: textInput.worldY,
      text: textValue.trim(),
      fontSize: 56,
      color: INSERT_TEXT_COLOR, // <- always black
    };

    onAddTextAnnotation(note.id, annotation);
    setTextInput(null);
    setTextValue("");
    scheduleDraw();
  };

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTextSubmit();
    } else if (e.key === "Escape") {
      setTextInput(null);
      setTextValue("");
    }
  };

  return (
      <div className="relative h-full min-h-0 w-full overflow-hidden rounded-b-2xl bg-slate-50" ref={containerRef}>
        <canvas
            ref={canvasRef}
            className="block h-full w-full touch-none"
            style={{ cursor: tool === "pan" ? "grab" : tool === "eraser" ? "cell" : tool === "selector" ? "default" : tool === "text" ? "text" : "crosshair" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
        />

        {showPopup && (
            <SelectionPopup
                position={popupPosition}
                isSolving={isSolving}
                isGraphing={isGraphing}
                onDelete={handlePopupDelete}
                onDuplicate={handlePopupDuplicate}
                onChangeColor={handlePopupChangeColor}
                onSolve={handlePopupSolve}
                onAddToGraph={handlePopupAddToGraph}
                onClose={handlePopupClose}
            />
        )}

        {textInput && (
            <div
                className="absolute z-50"
                style={{
                  left: textInput.x,
                  top: textInput.y,
                  transform: "translateY(-50%)",
                }}
            >
              <input
                  type="text"
                  autoFocus
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  onKeyDown={handleTextKeyDown}
                  onBlur={handleTextSubmit}
                  className="rounded border-2 border-blue-500 bg-white px-3 py-2 text-2xl font-normal text-slate-900 shadow-lg outline-none"
                  placeholder="Type text..."
                  style={{ minWidth: "200px" }}
              />
            </div>
        )}
      </div>
  );
}
