import opentype from "opentype.js";
import type { InkStroke, InkPoint } from "../types";
import { uid } from "./ink";

let fontCache: opentype.Font | null = null;

export async function loadFont(): Promise<opentype.Font> {
  if (fontCache) {
    return fontCache;
  }

  try {
    const font = await opentype.load("/Roboto-Regular.ttf");
    fontCache = font;
    return font;
  } catch (error) {
    console.error("Failed to load font:", error);
    throw error;
  }
}

function samplePathToPoints(path: opentype.Path, density: number = 2): InkPoint[] {
  const points: InkPoint[] = [];
  const commands = path.commands;
  
  let currentX = 0;
  let currentY = 0;
  const timestamp = performance.now();

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];

    if (cmd.type === "M") {
      // Move to
      currentX = cmd.x!;
      currentY = cmd.y!;
      points.push({ x: currentX, y: currentY, pressure: 0.5, timestamp });
    } else if (cmd.type === "L") {
      // Line to
      const x1 = cmd.x!;
      const y1 = cmd.y!;
      
      const dx = x1 - currentX;
      const dy = y1 - currentY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(2, Math.ceil(distance / density));
      
      for (let j = 1; j <= steps; j++) {
        const t = j / steps;
        points.push({
          x: currentX + dx * t,
          y: currentY + dy * t,
          pressure: 0.5,
          timestamp: timestamp + j,
        });
      }
      
      currentX = x1;
      currentY = y1;
    } else if (cmd.type === "Q") {
      // Quadratic bezier
      const x1 = cmd.x1!;
      const y1 = cmd.y1!;
      const x2 = cmd.x!;
      const y2 = cmd.y!;
      
      const distance = Math.sqrt((x2 - currentX) ** 2 + (y2 - currentY) ** 2);
      const steps = Math.max(3, Math.ceil(distance / density));
      
      for (let j = 1; j <= steps; j++) {
        const t = j / steps;
        const mt = 1 - t;
        const x = mt * mt * currentX + 2 * mt * t * x1 + t * t * x2;
        const y = mt * mt * currentY + 2 * mt * t * y1 + t * t * y2;
        points.push({ x, y, pressure: 0.5, timestamp: timestamp + j });
      }
      
      currentX = x2;
      currentY = y2;
    } else if (cmd.type === "C") {
      // Cubic bezier
      const x1 = cmd.x1!;
      const y1 = cmd.y1!;
      const x2 = cmd.x2!;
      const y2 = cmd.y2!;
      const x3 = cmd.x!;
      const y3 = cmd.y!;
      
      const distance = Math.sqrt((x3 - currentX) ** 2 + (y3 - currentY) ** 2);
      const steps = Math.max(3, Math.ceil(distance / density));
      
      for (let j = 1; j <= steps; j++) {
        const t = j / steps;
        const mt = 1 - t;
        const x = mt * mt * mt * currentX + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3;
        const y = mt * mt * mt * currentY + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3;
        points.push({ x, y, pressure: 0.5, timestamp: timestamp + j });
      }
      
      currentX = x3;
      currentY = y3;
    } else if (cmd.type === "Z") {
      // Close path - handled automatically by subsequent moves
    }
  }

  return points;
}

export async function textToStrokes(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  color: string
): Promise<InkStroke[]> {
  const font = await loadFont();
  const strokes: InkStroke[] = [];
  let offsetX = x;
  
  const scale = fontSize / font.unitsPerEm;

  for (const char of text) {
    const glyph = font.charToGlyph(char);
    const path = glyph.getPath(offsetX, y, fontSize);
    
    // Convert path to points
    const points = samplePathToPoints(path, 1.5);
    
    if (points.length > 1) {
      strokes.push({
        id: uid(),
        tool: "pen",
        color: color,
        baseSize: 2,
        points: points,
      });
    }
    
    offsetX += (glyph.advanceWidth ?? 0) * scale;
  }
  
  return strokes;
}
