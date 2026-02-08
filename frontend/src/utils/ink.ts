import { getStroke } from "perfect-freehand";
import type { InkPoint, InkStroke } from "../types";

export function uid(): string {
  return crypto.randomUUID();
}

export function toStrokeInput(points: InkPoint[]): [number, number, number][] {
  return points.map((p) => [p.x, p.y, p.pressure]);
}

export function strokePolygon(stroke: InkStroke): number[][] {
  return getStroke(toStrokeInput(stroke.points), {
    size: stroke.baseSize,
    thinning: 0.6,
    smoothing: 0.72,
    streamline: 0.55,
    simulatePressure: false,
    start: { taper: 0 },
    end: { taper: 0 },
  });
}

export function drawStrokePolygon(
  ctx: CanvasRenderingContext2D,
  polygon: number[][],
  color: string,
  offsetX: number,
  offsetY: number,
): void {
  if (polygon.length < 2) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(polygon[0][0] + offsetX, polygon[0][1] + offsetY);

  // Use quadratic curves for smoother rendering instead of straight lines
  for (let i = 1; i < polygon.length - 1; i += 1) {
    const currentPoint = polygon[i];
    const nextPoint = polygon[i + 1];
    
    // Calculate midpoint for smooth curve
    const midX = (currentPoint[0] + nextPoint[0]) / 2 + offsetX;
    const midY = (currentPoint[1] + nextPoint[1]) / 2 + offsetY;
    
    ctx.quadraticCurveTo(
      currentPoint[0] + offsetX,
      currentPoint[1] + offsetY,
      midX,
      midY
    );
  }
  
  // Handle last point
  if (polygon.length > 1) {
    const lastPoint = polygon[polygon.length - 1];
    ctx.lineTo(lastPoint[0] + offsetX, lastPoint[1] + offsetY);
  }

  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby;

  if (abLenSq === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  return Math.hypot(px - cx, py - cy);
}

export function strokeIntersectsCircle(
  stroke: InkStroke,
  x: number,
  y: number,
  radius: number,
): boolean {
  const pts = stroke.points;
  if (pts.length === 0) {
    return false;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  if (
    x + radius < minX ||
    x - radius > maxX ||
    y + radius < minY ||
    y - radius > maxY
  ) {
    return false;
  }

  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    if (pointToSegmentDistance(x, y, a.x, a.y, b.x, b.y) <= radius + stroke.baseSize * 0.5) {
      return true;
    }
  }

  return false;
}

export function strokesToPngDataUrl(strokes: InkStroke[]): string {
  const padding = 40; // Increased padding for better context
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const stroke of strokes) {
    for (const p of stroke.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }

  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 1200;
    maxY = 900;
  }

  // Use higher resolution for better OCR (2x scale factor)
  const scaleFactor = 2;
  const baseWidth = Math.max(800, Math.ceil(maxX - minX + padding * 2));
  const baseHeight = Math.max(600, Math.ceil(maxY - minY + padding * 2));
  const width = baseWidth * scaleFactor;
  const height = baseHeight * scaleFactor;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return "";
  }

  // Enable high-quality rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Fill with white background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Apply scaling
  ctx.save();
  ctx.scale(scaleFactor, scaleFactor);

  const ox = -minX + padding;
  const oy = -minY + padding;

  // Draw strokes with anti-aliasing
  for (const stroke of strokes) {
    // Convert colored strokes to black for better OCR
    const ocrColor = "#000000";
    drawStrokePolygon(ctx, strokePolygon(stroke), ocrColor, ox, oy);
  }

  ctx.restore();

  // Get image data for preprocessing
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Apply contrast enhancement and ensure clean black/white
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Convert to grayscale
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // Apply threshold with slight contrast boost
    // Values below 250 are considered ink, make them pure black
    // Values above 250 are background, make them pure white
    const threshold = 250;
    const value = gray < threshold ? 0 : 255;
    
    data[i] = value;     // R
    data[i + 1] = value; // G
    data[i + 2] = value; // B
    // Alpha stays the same
  }

  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL("image/png");
}
