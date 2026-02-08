import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InkPoint, InkStroke, InkTool, Note, WhiteboardImage, ShapeType, Shape } from "../types";
import { drawStrokePolygon, strokePolygon, strokesToPngDataUrl, uid } from "../utils/ink";
import { solveEquation, recognizeEquationForGraph, recognizeSelectionContent, getNextStep } from "../api/client";
import { SelectionPopup } from "./SelectionPopup";
import { textToImage } from "../utils/textToImage";

interface InkCanvasProps {
  note: Note;
  tool: InkTool;
  shapeType: ShapeType;
  color: string;
  highlighterColor: string;
  penSize: number;
  highlighterSize: number;
  showGrid: boolean;
  onAppendStroke: (noteId: string, stroke: InkStroke) => void;
  onEraseAt: (noteId: string, x: number, y: number, radius: number) => void;
  onDeleteStrokes: (noteId: string, strokeIds: string[]) => void;
  onMoveStrokes: (noteId: string, strokeIds: string[], dx: number, dy: number) => void;
  onDuplicateStrokes: (noteId: string, strokeIds: string[]) => string[];
  onChangeStrokesColor: (noteId: string, strokeIds: string[], newColor: string) => void;
  onAddShape: (noteId: string, shape: Shape) => void;
  onDeleteShapes: (noteId: string, shapeIds: string[]) => void;
  onMoveShapes: (noteId: string, shapeIds: string[], dx: number, dy: number) => void;
  onScaleShapes: (noteId: string, shapeIds: string[], scale: number, centerX: number, centerY: number) => void;
  onAddImage: (noteId: string, image: WhiteboardImage) => void;
  onDeleteImages: (noteId: string, imageIds: string[]) => void;
  onMoveImages: (noteId: string, imageIds: string[], dx: number, dy: number) => void;
  onScaleStrokes: (noteId: string, strokeIds: string[], scale: number, centerX: number, centerY: number) => void;
  onScaleImages: (noteId: string, imageIds: string[], scale: number, centerX: number, centerY: number) => void;
  onPanViewport: (noteId: string, dx: number, dy: number) => void;
  onZoomViewportAt: (noteId: string, nextScale: number, anchorX: number, anchorY: number) => void;
  onAddToGraph?: (latex: string) => void;
  onExplainWithGemini?: (recognizedText: string) => Promise<void> | void;
  onExportReady?: (exportFn: () => string) => void;
}

const BACKGROUND = "#f8fafc";
const INSERT_TEXT_COLOR = "#000000";

export function InkCanvas({
  note,
  tool,
  shapeType,
  color,
  highlighterColor,
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
  onDeleteShapes,
  onMoveShapes,
  onScaleShapes,
  onDuplicateStrokes,
  onChangeStrokesColor,
  onAddShape,
  onAddImage,
  onPanViewport,
  onZoomViewportAt,
  onAddToGraph,
  onExplainWithGemini,
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
  const [selectedShapes, setSelectedShapes] = useState<string[]>([]);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; bounds: { minX: number; minY: number; maxX: number; maxY: number } } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [eraserTrail, setEraserTrail] = useState<{ x: number; y: number }[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSolving, setIsSolving] = useState(false);
  const [isGettingNextStep, setIsGettingNextStep] = useState(false);
  const [isGraphing, setIsGraphing] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [textInput, setTextInput] = useState<{ x: number; y: number; worldX: number; worldY: number } | null>(null);
  const [textValue, setTextValue] = useState("");
  const [tempShape, setTempShape] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
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

    // Draw shapes
    for (const shape of note.shapes) {
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.strokeWidth;
      ctx.fillStyle = shape.color;

      if (shape.type === "rectangle") {
        if (shape.filled) {
          ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
        } else {
          ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        }
      } else if (shape.type === "circle") {
        const centerX = shape.x + shape.width / 2;
        const centerY = shape.y + shape.height / 2;
        const radiusX = shape.width / 2;
        const radiusY = shape.height / 2;
        
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        if (shape.filled) {
          ctx.fill();
        } else {
          ctx.stroke();
        }
      } else if (shape.type === "line") {
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(shape.x + shape.width, shape.y + shape.height);
        ctx.stroke();
      } else if (shape.type === "arrow") {
        const startX = shape.x;
        const startY = shape.y;
        const endX = shape.x + shape.width;
        const endY = shape.y + shape.height;
        const angle = Math.atan2(endY - startY, endX - startX);
        const headLen = Math.max(14, shape.strokeWidth * 4) / note.viewport.scale;

        // Shorten line so it stops at the base of the arrowhead
        const lineEndX = endX - headLen * Math.cos(angle) * 0.6;
        const lineEndY = endY - headLen * Math.sin(angle) * 0.6;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(lineEndX, lineEndY);
        ctx.stroke();

        // Draw filled arrowhead
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLen * Math.cos(angle - Math.PI / 6),
          endY - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          endX - headLen * Math.cos(angle + Math.PI / 6),
          endY - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      } else if (shape.type === "triangle") {
        // Right triangle: right angle at (x, y+h), with vertices adapting to sign of w/h
        const x0 = shape.x;
        const y0 = shape.y;
        const x1 = shape.x + shape.width;
        const y1 = shape.y + shape.height;
        ctx.beginPath();
        ctx.moveTo(x0, y1);        // right angle vertex
        ctx.lineTo(x1, y1);        // horizontal leg end
        ctx.lineTo(x0, y0);        // vertical leg end
        ctx.closePath();
        if (shape.filled) {
          ctx.fill();
        } else {
          ctx.stroke();
        }
      }
    }

    // Draw temporary shape being drawn
    if (tool === "shape" && tempShape) {
      const x = Math.min(tempShape.startX, tempShape.endX);
      const y = Math.min(tempShape.startY, tempShape.endY);
      const width = Math.abs(tempShape.endX - tempShape.startX);
      const height = Math.abs(tempShape.endY - tempShape.startY);

      ctx.strokeStyle = color;
      ctx.lineWidth = penSize;
      ctx.fillStyle = color;

      if (shapeType === "rectangle") {
        ctx.strokeRect(x, y, width, height);
      } else if (shapeType === "circle") {
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const radiusX = width / 2;
        const radiusY = height / 2;
        
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (shapeType === "line") {
        ctx.beginPath();
        ctx.moveTo(tempShape.startX, tempShape.startY);
        ctx.lineTo(tempShape.endX, tempShape.endY);
        ctx.stroke();
      } else if (shapeType === "arrow") {
        const startX = tempShape.startX;
        const startY = tempShape.startY;
        const endX = tempShape.endX;
        const endY = tempShape.endY;
        const angle = Math.atan2(endY - startY, endX - startX);
        const headLen = Math.max(14, penSize * 4) / note.viewport.scale;

        // Shorten line so it stops at the base of the arrowhead
        const lineEndX = endX - headLen * Math.cos(angle) * 0.6;
        const lineEndY = endY - headLen * Math.sin(angle) * 0.6;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(lineEndX, lineEndY);
        ctx.stroke();

        // Draw filled arrowhead
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLen * Math.cos(angle - Math.PI / 6),
          endY - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          endX - headLen * Math.cos(angle + Math.PI / 6),
          endY - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      } else if (shapeType === "triangle") {
        // Right triangle: right angle at (startX, endY)
        ctx.beginPath();
        ctx.moveTo(tempShape.startX, tempShape.endY);   // right angle vertex
        ctx.lineTo(tempShape.endX, tempShape.endY);     // horizontal leg end
        ctx.lineTo(tempShape.startX, tempShape.startY); // vertical leg end
        ctx.closePath();
        ctx.stroke();
      }
    }

    // Draw single bounding box for all selected strokes, images, and shapes
    if ((selectedStrokes.length > 0 || selectedImages.length > 0 || selectedShapes.length > 0) && tool === "selector") {
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

      for (const shape of note.shapes) {
        if (selectedShapes.includes(shape.id)) {
          const sx = Math.min(shape.x, shape.x + shape.width);
          const sy = Math.min(shape.y, shape.y + shape.height);
          const sx2 = Math.max(shape.x, shape.x + shape.width);
          const sy2 = Math.max(shape.y, shape.y + shape.height);
          minX = Math.min(minX, sx);
          minY = Math.min(minY, sy);
          maxX = Math.max(maxX, sx2);
          maxY = Math.max(maxY, sy2);
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
      ctx.fillStyle = tool === "highlighter" ? highlighterColor : color;
      ctx.fill();
      ctx.restore();
    } else if (currentPointsRef.current.length > 1 && (tool === "pen" || tool === "highlighter")) {
      const currentSize = tool === "highlighter" ? highlighterSize : penSize;
      const tempStroke: InkStroke = {
        id: "temp",
        tool: tool === "highlighter" ? "highlighter" : "pen",
        color: tool === "highlighter" ? highlighterColor : color,
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
    highlighterColor,
    note.strokes,
    note.shapes,
    note.images,
    note.viewport.offsetX,
    note.viewport.offsetY,
    note.viewport.scale,
    showGrid,
    penSize,
    highlighterSize,
    tool,
    shapeType,
    tempShape,
    selectedStrokes,
    selectedImages,
    selectedShapes,
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
  }, [note, tool, shapeType, tempShape, penSize, highlighterSize, color, highlighterColor, scheduleDraw]);

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
    if (tool !== "selector" && (selectedStrokes.length > 0 || selectedImages.length > 0 || selectedShapes.length > 0)) {
      setSelectedStrokes([]);
      setSelectedImages([]);
      setSelectedShapes([]);
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
  }, [tool, selectedStrokes.length, selectedImages.length, selectedShapes.length]);

  // Show popup below selection when strokes or images are selected
  useEffect(() => {
    if ((selectedStrokes.length > 0 || selectedImages.length > 0 || selectedShapes.length > 0) && tool === "selector" && !isDraggingSelection) {
      // Calculate bounding box of selected strokes, images, and shapes in world space
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

      for (const shape of note.shapes) {
        if (selectedShapes.includes(shape.id)) {
          const sx = Math.min(shape.x, shape.x + shape.width);
          const sy = Math.min(shape.y, shape.y + shape.height);
          const sx2 = Math.max(shape.x, shape.x + shape.width);
          const sy2 = Math.max(shape.y, shape.y + shape.height);
          minX = Math.min(minX, sx);
          minY = Math.min(minY, sy);
          maxX = Math.max(maxX, sx2);
          maxY = Math.max(maxY, sy2);
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
  }, [selectedStrokes, selectedImages, selectedShapes, tool, note.strokes, note.shapes, note.images, note.viewport, isDraggingSelection]);

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
      color: tool === "highlighter" ? highlighterColor : color,
      baseSize: currentSize,
      points: [...currentPointsRef.current],
    };

    onAppendStroke(note.id, stroke);
    currentPointsRef.current = [];
    scheduleDraw();
  }, [color, highlighterColor, note.id, onAppendStroke, scheduleDraw, tool, penSize, highlighterSize]);

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

    // Allow panning with right mouse button for any tool
    const shouldPan = e.button === 2 || tool === "pan";

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

    if (tool === "shape") {
      const point = toWorldPoint(e.clientX, e.clientY);
      setTempShape({ startX: point.x, startY: point.y, endX: point.x, endY: point.y });
      isDrawingRef.current = true;
      drawingPointerId.current = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    if (tool === "selector") {
      const point = toWorldPoint(e.clientX, e.clientY);

      // First check if clicking on a resize handle
      if (selectedStrokes.length > 0 || selectedImages.length > 0 || selectedShapes.length > 0) {
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

        for (const shape of note.shapes) {
          if (selectedShapes.includes(shape.id)) {
            const sx = Math.min(shape.x, shape.x + shape.width);
            const sy = Math.min(shape.y, shape.y + shape.height);
            const sx2 = Math.max(shape.x, shape.x + shape.width);
            const sy2 = Math.max(shape.y, shape.y + shape.height);
            minX = Math.min(minX, sx);
            minY = Math.min(minY, sy);
            maxX = Math.max(maxX, sx2);
            maxY = Math.max(maxY, sy2);
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

      // Check if clicking on a selected shape
      const clickedShape = note.shapes.find((shape) => {
        if (!selectedShapes.includes(shape.id)) return false;
        const sx = Math.min(shape.x, shape.x + shape.width);
        const sy = Math.min(shape.y, shape.y + shape.height);
        const sx2 = Math.max(shape.x, shape.x + shape.width);
        const sy2 = Math.max(shape.y, shape.y + shape.height);
        return point.x >= sx - 5 && point.x <= sx2 + 5 && point.y >= sy - 5 && point.y <= sy2 + 5;
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

      if (clickedImage || clickedStroke || clickedShape) {
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

    if (tool === "shape" && tempShape) {
      const point = toWorldPoint(e.clientX, e.clientY);
      setTempShape({
        ...tempShape,
        endX: point.x,
        endY: point.y,
      });
      scheduleDraw();
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
        onScaleShapes(note.id, selectedShapes, scale, centerX, centerY);

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
        onMoveShapes(note.id, selectedShapes, dx, dy);
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
      } else if (tool === "shape" && tempShape) {
        // Finalize shape
        const isDirectional = shapeType === "line" || shapeType === "arrow" || shapeType === "triangle";
        const x = isDirectional ? tempShape.startX : Math.min(tempShape.startX, tempShape.endX);
        const y = isDirectional ? tempShape.startY : Math.min(tempShape.startY, tempShape.endY);
        const width = isDirectional ? tempShape.endX - tempShape.startX : Math.abs(tempShape.endX - tempShape.startX);
        const height = isDirectional ? tempShape.endY - tempShape.startY : Math.abs(tempShape.endY - tempShape.startY);

        // Only add shape if it has some size
        if (Math.abs(width) > 2 || Math.abs(height) > 2) {
          const shape: Shape = {
            id: uid(),
            type: shapeType,
            x,
            y,
            width,
            height,
            color,
            strokeWidth: penSize,
            filled: false,
          };
          onAddShape(note.id, shape);
        }
        setTempShape(null);
        scheduleDraw();
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

          const selectedShapeIds = note.shapes
              .filter((shape) => {
                // Check if shape intersects with selection box
                const sx = Math.min(shape.x, shape.x + shape.width);
                const sy = Math.min(shape.y, shape.y + shape.height);
                const sx2 = Math.max(shape.x, shape.x + shape.width);
                const sy2 = Math.max(shape.y, shape.y + shape.height);
                return !(sx2 < minX || sx > maxX || sy2 < minY || sy > maxY);
              })
              .map((s) => s.id);

          setSelectedStrokes(selectedStrokeIds);
          setSelectedImages(selectedImageIds);
          setSelectedShapes(selectedShapeIds);
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

  // Keyboard handler for deleting selected strokes, images, and shapes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Backspace" || e.key === "Delete") && (selectedStrokes.length > 0 || selectedImages.length > 0 || selectedShapes.length > 0) && tool === "selector") {
        e.preventDefault();
        if (selectedStrokes.length > 0) {
          onDeleteStrokes(note.id, selectedStrokes);
        }
        if (selectedImages.length > 0) {
          onDeleteImages(note.id, selectedImages);
        }
        if (selectedShapes.length > 0) {
          onDeleteShapes(note.id, selectedShapes);
        }
        setSelectedStrokes([]);
        setSelectedImages([]);
        setSelectedShapes([]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedStrokes, selectedImages, selectedShapes, tool, note.id, onDeleteStrokes, onDeleteImages, onDeleteShapes]);

  const handlePopupDelete = () => {
    if (selectedStrokes.length > 0) {
      onDeleteStrokes(note.id, selectedStrokes);
    }
    if (selectedImages.length > 0) {
      onDeleteImages(note.id, selectedImages);
    }
    if (selectedShapes.length > 0) {
      onDeleteShapes(note.id, selectedShapes);
    }
    setSelectedStrokes([]);
    setSelectedImages([]);
    setSelectedShapes([]);
    setShowPopup(false);
  };

  const handlePopupDuplicate = () => {
    const newIds = onDuplicateStrokes(note.id, selectedStrokes);
    setSelectedStrokes(newIds);
    setShowPopup(false);
  };

  const handlePopupSolve = async () => {
    const selectedStrokeObjects = note.strokes.filter((stroke) => selectedStrokes.includes(stroke.id));
    const selectedImageObjects = note.images.filter((image) => selectedImages.includes(image.id));

    if (selectedStrokeObjects.length === 0 && selectedImageObjects.length === 0) return;

    setIsSolving(true);

    try {
      let imageDataUrl: string | undefined;
      let inputFontSize = 16;
      let latex: string | undefined;

      // Check if we have selected images with LaTeX (prioritize this for speed)
      if (selectedImageObjects.length > 0 && selectedImageObjects[0].latex) {
        latex = selectedImageObjects[0].latex;
        // Use the original font size from the image, or estimate if not stored
        inputFontSize = selectedImageObjects[0].fontSize || Math.max(16, selectedImageObjects[0].height * 0.8);
        console.log("Using LaTeX from selected image:", latex, "fontSize:", inputFontSize);
      } else if (selectedStrokeObjects.length > 0) {
        // Render selected strokes to a PNG image
        imageDataUrl = strokesToPngDataUrl(selectedStrokeObjects);

        // Calculate average stroke size to send to backend
        let totalSize = 0;
        for (const stroke of selectedStrokeObjects) {
          totalSize += stroke.baseSize;
        }
        const avgStrokeSize = totalSize / selectedStrokeObjects.length;
        inputFontSize = Math.max(16, avgStrokeSize * 10);
      } else {
        alert("⚠️ Please select handwritten strokes or LaTeX equations");
        return;
      }

      // Send to backend via API with font size information
      const { result, fontSize: outputFontSize } = await solveEquation(imageDataUrl, inputFontSize, latex);

      // Check if equation was not recognized
      if (result.toLowerCase().includes("could not recognize")) {
        // Show a friendly error message instead of adding text annotation
        alert("⚠️ Unable to recognize the equation\n\nPlease make sure your handwriting is clear and try again.");
        return;
      }

      // Calculate position based on the selection bounding box
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const stroke of selectedStrokeObjects) {
        for (const p of stroke.points) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
      }

      for (const image of selectedImageObjects) {
        minX = Math.min(minX, image.x);
        minY = Math.min(minY, image.y);
        maxX = Math.max(maxX, image.x + image.width);
        maxY = Math.max(maxY, image.y + image.height);
      }

      // Use the fontSize returned from the backend (2x the input)
      const fontSize = outputFontSize;
      
      // Split result by newlines to create separate images for each step
      // Skip the first line as it's usually a repeat of the input
      const lines = result.split('\n').filter(line => line.trim()).slice(1);
      
      // Start positioning right after the input equation with small padding
      // currentTop tracks where the top of the next image should be
      const stepPadding = 8; // Small padding between steps for readability
      let currentTop = maxY + stepPadding;
      
      // Render each line as a separate image
      for (const line of lines) {
        // Render the image with center Y positioned so that top = currentTop
        // Since textToImage does: y = centerY - height/2
        // We need to provide a centerY first, then adjust the image.y after
        const tempImage = await textToImage(line, minX, currentTop, fontSize, "#000000");
        if (!tempImage) continue;
        
        // Override the y position to ensure top is exactly at currentTop
        // textToImage centers vertically, so we need to adjust
        tempImage.y = currentTop;
        
        onAddImage(note.id, tempImage);
        
        // Update currentTop to this image's bottom plus padding for next iteration
        currentTop = tempImage.y + tempImage.height + stepPadding;
      }

      // Force immediate redraw to show the solution
      scheduleDraw();

      // Clear selection so user can see the solution immediately
      setSelectedStrokes([]);
      setSelectedImages([]);
      setSelectedShapes([]);
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

  const handlePopupNextStep = async () => {
    const selectedStrokeObjects = note.strokes.filter((stroke) => selectedStrokes.includes(stroke.id));
    const selectedImageObjects = note.images.filter((image) => selectedImages.includes(image.id));

    if (selectedStrokeObjects.length === 0 && selectedImageObjects.length === 0) return;

    setIsGettingNextStep(true);

    try {
      let imageDataUrl: string | undefined;
      let inputFontSize = 16;
      let latex: string | undefined;

      // Check if we have selected images with LaTeX (prioritize this for speed)
      if (selectedImageObjects.length > 0 && selectedImageObjects[0].latex) {
        latex = selectedImageObjects[0].latex;
        // Use the original font size from the image, or estimate if not stored
        inputFontSize = selectedImageObjects[0].fontSize || Math.max(16, selectedImageObjects[0].height * 0.8);
        console.log("Using LaTeX from selected image:", latex, "fontSize:", inputFontSize);
      } else if (selectedStrokeObjects.length > 0) {
        // Render selected strokes to a PNG image
        imageDataUrl = strokesToPngDataUrl(selectedStrokeObjects);

        // Calculate average stroke size to send to backend
        let totalSize = 0;
        for (const stroke of selectedStrokeObjects) {
          totalSize += stroke.baseSize;
        }
        const avgStrokeSize = totalSize / selectedStrokeObjects.length;
        inputFontSize = Math.max(16, avgStrokeSize * 10);
      } else {
        alert("⚠️ Please select handwritten strokes or LaTeX equations");
        return;
      }

      // Send to backend via API with font size information
      const { result, fontSize: outputFontSize } = await getNextStep(imageDataUrl, inputFontSize, latex);

      // Check if equation was not recognized or could not determine next step
      if (result.toLowerCase().includes("could not recognize")) {
        alert("⚠️ Unable to recognize the equation\n\nPlease make sure your handwriting is clear and try again.");
        return;
      }
      
      if (result.toLowerCase().includes("could not get") || result.toLowerCase().includes("could not determine")) {
        alert("⚠️ Unable to determine next step\n\nThe equation might already be solved or fully simplified.");
        return;
      }

      // Calculate position based on the selection bounding box
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const stroke of selectedStrokeObjects) {
        for (const p of stroke.points) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
      }

      for (const image of selectedImageObjects) {
        minX = Math.min(minX, image.x);
        minY = Math.min(minY, image.y);
        maxX = Math.max(maxX, image.x + image.width);
        maxY = Math.max(maxY, image.y + image.height);
      }

      // Use the fontSize returned from the backend (2x the input)
      const fontSize = outputFontSize;
      
      // Split result by newlines - we expect exactly 2 lines for next step
      // Line 1: Current equation (skip this as it's already on the canvas)
      // Line 2: Next step (show this)
      const lines = result.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        alert("⚠️ Could not determine next step\n\nPlease try again.");
        return;
      }
      
      // Start positioning right after the input equation with small padding
      const stepPadding = 8;
      const currentTop = maxY + stepPadding;
      
      // Render only the second line (the next step)
      const nextStepLine = lines[1];
      const tempImage = await textToImage(nextStepLine, minX, currentTop, fontSize, "#000000");
      if (tempImage) {
        // Override the y position to ensure top is exactly at currentTop
        tempImage.y = currentTop;
        onAddImage(note.id, tempImage);
      }

      // Force immediate redraw to show the next step
      scheduleDraw();

      // Clear selection so user can see the next step immediately
      setSelectedStrokes([]);
      setSelectedImages([]);
      setSelectedShapes([]);
      setSelectionBox(null);
    } catch (error) {
      console.error("Failed to get next step:", error);
      const message = error instanceof Error ? error.message : "Failed to get next step";
      alert(`❌ Error getting next step\n\n${message}`);
    } finally {
      setIsGettingNextStep(false);
      setShowPopup(false);
    }
  };

  const handlePopupAddToGraph = async () => {
    const selectedStrokeObjects = note.strokes.filter((stroke) => selectedStrokes.includes(stroke.id));
    const selectedImageObjects = note.images.filter((image) => selectedImages.includes(image.id));
    
    if (selectedStrokeObjects.length === 0 && selectedImageObjects.length === 0) return;

    setIsGraphing(true);
    console.log("📈 Adding to graph:", selectedStrokeObjects.length, "strokes,", selectedImageObjects.length, "images");

    try {
      let latex: string;

      // Check if we have selected images with LaTeX (prioritize this for speed)
      if (selectedImageObjects.length > 0 && selectedImageObjects[0].latex) {
        const imageLaTeX = selectedImageObjects[0].latex;
        console.log("📊 Using LaTeX from selected image:", imageLaTeX);
        
        // Send to backend with LaTeX (will skip recognition)
        latex = await recognizeEquationForGraph(undefined, imageLaTeX);
      } else if (selectedStrokeObjects.length > 0) {
        // Use handwritten strokes
        const imageDataUrl = strokesToPngDataUrl(selectedStrokeObjects);
        console.log("📸 Generated image data URL, length:", imageDataUrl.length);

        latex = await recognizeEquationForGraph(imageDataUrl);
        console.log("✅ Recognized LaTeX:", latex);
      } else {
        alert("⚠️ Please select handwritten strokes or LaTeX equations");
        return;
      }

      if (onAddToGraph) {
        onAddToGraph(latex);
        console.log("📊 Added to graph panel");
      } else {
        console.warn("⚠️ onAddToGraph callback is not defined");
      }

      setSelectedStrokes([]);
      setSelectedImages([]);
      setSelectedShapes([]);
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

  const handlePopupExplainWithGemini = async () => {
    if (selectedStrokes.length === 0 && selectedImages.length === 0 && selectedShapes.length === 0) {
      alert("Select note content first.");
      return;
    }
    if (!onExplainWithGemini) {
      return;
    }

    setIsExplaining(true);

    try {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const stroke of note.strokes) {
        if (!selectedStrokes.includes(stroke.id)) continue;
        for (const p of stroke.points) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
      }

      for (const image of note.images) {
        if (!selectedImages.includes(image.id)) continue;
        minX = Math.min(minX, image.x);
        minY = Math.min(minY, image.y);
        maxX = Math.max(maxX, image.x + image.width);
        maxY = Math.max(maxY, image.y + image.height);
      }

      for (const shape of note.shapes) {
        if (!selectedShapes.includes(shape.id)) continue;
        const sx = Math.min(shape.x, shape.x + shape.width);
        const sy = Math.min(shape.y, shape.y + shape.height);
        const sx2 = Math.max(shape.x, shape.x + shape.width);
        const sy2 = Math.max(shape.y, shape.y + shape.height);
        minX = Math.min(minX, sx);
        minY = Math.min(minY, sy);
        maxX = Math.max(maxX, sx2);
        maxY = Math.max(maxY, sy2);
      }

      if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
        throw new Error("Could not compute selection bounds");
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error("Canvas not available");
      }

      const rect = canvas.getBoundingClientRect();
      const dprX = rect.width > 0 ? canvas.width / rect.width : 1;
      const dprY = rect.height > 0 ? canvas.height / rect.height : 1;
      const padding = 12;

      const cropX = minX * note.viewport.scale + note.viewport.offsetX - padding;
      const cropY = minY * note.viewport.scale + note.viewport.offsetY - padding;
      const cropW = (maxX - minX) * note.viewport.scale + padding * 2;
      const cropH = (maxY - minY) * note.viewport.scale + padding * 2;

      const srcX = Math.max(0, Math.floor(cropX * dprX));
      const srcY = Math.max(0, Math.floor(cropY * dprY));
      const srcW = Math.max(1, Math.min(canvas.width - srcX, Math.ceil(cropW * dprX)));
      const srcH = Math.max(1, Math.min(canvas.height - srcY, Math.ceil(cropH * dprY)));

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = srcW;
      tempCanvas.height = srcH;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) {
        throw new Error("Failed to prepare selection image");
      }

      tempCtx.drawImage(canvas, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
      const imageDataUrl = tempCanvas.toDataURL("image/png");
      const recognizedText = await recognizeSelectionContent(imageDataUrl);
      await onExplainWithGemini(recognizedText);
      setSelectedStrokes([]);
      setSelectedImages([]);
      setSelectedShapes([]);
      setSelectionBox(null);
    } catch (error) {
      console.error("Failed to explain with Gemini:", error);
      const message = error instanceof Error ? error.message : "Failed to recognize selected content";
      alert(`Could not explain selection.\n\n${message}`);
    } finally {
      setIsExplaining(false);
      setShowPopup(false);
    }
  };

  const handlePopupClose = () => {
    setShowPopup(false);
  };

  const handleTextSubmit = async () => {
    if (!textInput || !textValue.trim()) {
      setTextInput(null);
      setTextValue("");
      return;
    }

    const image = await textToImage(
      textValue.trim(),
      textInput.worldX,
      textInput.worldY,
      56,
      INSERT_TEXT_COLOR,
    );

    if (image) {
      onAddImage(note.id, image);
    }

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
            onContextMenu={(e) => e.preventDefault()}
        />

        {showPopup && (
            <SelectionPopup
                position={popupPosition}
                isSolving={isSolving}
                isGettingNextStep={isGettingNextStep}
                isGraphing={isGraphing}
                isExplaining={isExplaining}
                onDelete={handlePopupDelete}
                onDuplicate={handlePopupDuplicate}
                onChangeColor={handlePopupChangeColor}
                onSolve={handlePopupSolve}
                onNextStep={handlePopupNextStep}
                onAddToGraph={handlePopupAddToGraph}
                onExplainWithGemini={handlePopupExplainWithGemini}
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
