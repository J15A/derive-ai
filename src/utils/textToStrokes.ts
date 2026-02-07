import opentype from "opentype.js";
import type { InkStroke, InkPoint } from "../types";
import { uid } from "./ink";
import { latexToStrokes, parseTextWithLatex } from "./latexToStrokes";

let fontCache: opentype.Font | null = null;

export async function loadFont(): Promise<opentype.Font> {
  if (fontCache) {
    return fontCache;
  }

  try {
    // Try loading handwriting-style font first, fall back to others
    try {
      const font = await opentype.load("/CaveatBrush-Regular.ttf");
      fontCache = font;
      return font;
    } catch {
      try {
        const font = await opentype.load("/ComputerModern-Regular.ttf");
        fontCache = font;
        return font;
      } catch {
        const font = await opentype.load("/Roboto-Regular.ttf");
        fontCache = font;
        return font;
      }
    }
  } catch (error) {
    console.error("Failed to load font:", error);
    throw error;
  }
}

/**
 * Render a glyph to a canvas and convert filled pixels to strokes using flood fill
 */
function glyphToFilledStrokes(
  font: opentype.Font,
  char: string,
  x: number,
  y: number,
  fontSize: number,
  color: string
): InkStroke[] {
  const glyph = font.charToGlyph(char);
  const scale = fontSize / font.unitsPerEm;
  const glyphWidth = (glyph.advanceWidth ?? 0) * scale;
  
  if (!glyph.path || glyph.path.commands.length === 0) {
    return [];
  }

  // Create a canvas to render the glyph
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];

  // Set canvas size with padding
  const padding = 10;
  const width = Math.ceil(glyphWidth) + padding * 2;
  const height = Math.ceil(fontSize * 1.5) + padding * 2;
  canvas.width = width;
  canvas.height = height;

  // Fill white background
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, width, height);

  // Draw the glyph path
  const path = glyph.getPath(padding, padding + fontSize, fontSize);
  ctx.fillStyle = "black";
  ctx.beginPath();
  path.commands.forEach((cmd) => {
    if (cmd.type === "M") {
      ctx.moveTo(cmd.x!, cmd.y!);
    } else if (cmd.type === "L") {
      ctx.lineTo(cmd.x!, cmd.y!);
    } else if (cmd.type === "Q") {
      ctx.quadraticCurveTo(cmd.x1!, cmd.y1!, cmd.x!, cmd.y!);
    } else if (cmd.type === "C") {
      ctx.bezierCurveTo(cmd.x1!, cmd.y1!, cmd.x2!, cmd.y2!, cmd.x!, cmd.y!);
    } else if (cmd.type === "Z") {
      ctx.closePath();
    }
  });
  ctx.fill();

  // Get pixel data
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  // Convert pixels to strokes using flood fill algorithm
  const strokes: InkStroke[] = [];
  const timestamp = performance.now();
  const visited = new Set<string>();
  const threshold = 200;

  // Helper to check if a pixel is dark
  const isDark = (px: number, py: number): boolean => {
    if (px < 0 || px >= width || py < 0 || py >= height) return false;
    const idx = (py * width + px) * 4;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    const brightness = (r + g + b) / 3;
    return brightness < threshold;
  };

  // Find connected components and fill them with strokes
  for (let startY = 0; startY < height; startY++) {
    for (let startX = 0; startX < width; startX++) {
      const key = `${startX},${startY}`;
      
      if (isDark(startX, startY) && !visited.has(key)) {
        // Found a new dark region, flood fill it
        const regionPoints: Array<{ x: number; y: number }> = [];
        const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
        
        while (queue.length > 0) {
          const { x: qx, y: qy } = queue.shift()!;
          const pixelKey = `${qx},${qy}`;
          
          if (visited.has(pixelKey) || !isDark(qx, qy)) {
            continue;
          }
          
          visited.add(pixelKey);
          regionPoints.push({ x: qx, y: qy });
          
          // Add neighbors (4-connected)
          if (qx > 0) queue.push({ x: qx - 1, y: qy });
          if (qx < width - 1) queue.push({ x: qx + 1, y: qy });
          if (qy > 0) queue.push({ x: qx, y: qy - 1 });
          if (qy < height - 1) queue.push({ x: qx, y: qy + 1 });
        }
        
        // Create strokes for this region by scanning horizontally
        if (regionPoints.length > 0) {
          // Group points by y coordinate
          const rowMap = new Map<number, number[]>();
          for (const pt of regionPoints) {
            if (!rowMap.has(pt.y)) {
              rowMap.set(pt.y, []);
            }
            rowMap.get(pt.y)!.push(pt.x);
          }
          
          // Sort rows and create horizontal strokes
          const sortedRows = Array.from(rowMap.keys()).sort((a, b) => a - b);
          
          for (const row of sortedRows) {
            const xValues = rowMap.get(row)!.sort((a, b) => a - b);
            
            // Create continuous horizontal strokes
            let lineStart = xValues[0];
            let prevX = xValues[0];
            
            for (let i = 1; i <= xValues.length; i++) {
              const col = i < xValues.length ? xValues[i] : -1;
              
              // If there's a gap or end of line, create stroke
              if (col !== prevX + 1 || i === xValues.length) {
                const points: InkPoint[] = [];
                for (let px = lineStart; px <= prevX; px++) {
                  points.push({
                    x: x + px - padding,
                    y: y + row - padding - fontSize,
                    pressure: 0.5,
                    timestamp: timestamp + points.length,
                  });
                }
                
                if (points.length > 0) {
                  strokes.push({
                    id: uid(),
                    tool: "pen",
                    color: color,
                    baseSize: 2,
                    points: points,
                  });
                }
                
                lineStart = col;
              }
              
              prevX = col;
            }
          }
        }
      }
    }
  }

  return strokes;
}

export async function textToStrokes(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  color: string
): Promise<InkStroke[]> {
  console.log("textToStrokes called:", { text, x, y, fontSize, color });
  
  // Parse text to detect LaTeX expressions
  const segments = parseTextWithLatex(text);
  console.log("Parsed segments:", segments);
  
  const allStrokes: InkStroke[] = [];
  let offsetX = x;
  
  for (const segment of segments) {
    if (segment.type === "latex") {
      // Render LaTeX
      console.log("Rendering LaTeX:", segment.content);
      const latexStrokes = await latexToStrokes(
        segment.content,
        offsetX,
        y - (segment.displayMode ? fontSize * 0.5 : 0),
        color,
        segment.displayMode
      );
      
      console.log("LaTeX strokes:", latexStrokes.length);
      allStrokes.push(...latexStrokes);
      
      // Calculate the width of the LaTeX rendering to update offsetX
      if (latexStrokes.length > 0) {
        const maxX = Math.max(...latexStrokes.flatMap(s => s.points.map(p => p.x)));
        offsetX = maxX + fontSize * 0.3; // Add some spacing
      }
    } else {
      // Render regular text using font with filled characters
      console.log("Rendering regular text:", segment.content);
      const font = await loadFont();
      const scale = fontSize / font.unitsPerEm;

      for (const char of segment.content) {
        if (char === ' ') {
          // Handle space
          const spaceWidth = fontSize * 0.3;
          offsetX += spaceWidth;
          continue;
        }

        const glyph = font.charToGlyph(char);
        const charStrokes = glyphToFilledStrokes(font, char, offsetX, y, fontSize, color);
        console.log(`Char '${char}' generated ${charStrokes.length} strokes`);
        allStrokes.push(...charStrokes);
        
        offsetX += (glyph.advanceWidth ?? 0) * scale;
      }
    }
  }
  
  console.log("Total strokes generated:", allStrokes.length);
  return allStrokes;
}
