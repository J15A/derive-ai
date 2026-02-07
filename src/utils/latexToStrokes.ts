import katex from "katex";
import type { InkStroke, InkPoint } from "../types";
import { uid } from "./ink";

/**
 * Convert LaTeX expression to ink strokes by rendering to canvas and tracing pixels
 */
export async function latexToStrokes(
  latex: string,
  x: number,
  y: number,
  color: string,
  displayMode: boolean = false
): Promise<InkStroke[]> {
  try {
    // Render LaTeX to HTML using KaTeX
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      output: "html",
    });

    // Create a temporary DOM element to render the LaTeX
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";
    tempDiv.style.fontSize = displayMode ? "64px" : "48px";
    tempDiv.style.color = "black";
    tempDiv.style.fontFamily = "KaTeX_Main, Times New Roman, serif";
    document.body.appendChild(tempDiv);

    // Wait for fonts to load
    await document.fonts.ready;

    // Get dimensions
    const bbox = tempDiv.getBoundingClientRect();
    const width = Math.ceil(bbox.width);
    const height = Math.ceil(bbox.height);

    if (width === 0 || height === 0) {
      document.body.removeChild(tempDiv);
      return [];
    }

    // Create a canvas to render the LaTeX
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      document.body.removeChild(tempDiv);
      return [];
    }

    // Set canvas size with some padding
    const padding = 10;
    canvas.width = width + padding * 2;
    canvas.height = height + padding * 2;

    // Fill white background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Create SVG with foreignObject and inline KaTeX styles
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", String(canvas.width));
    svg.setAttribute("height", String(canvas.height));
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    // Add comprehensive inline styles for KaTeX
    const style = document.createElementNS(svgNS, "style");
    style.textContent = `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      .katex { font: normal 1em KaTeX_Main, Times New Roman, serif; line-height: 1.2; text-indent: 0; text-rendering: auto; }
      .katex * { -ms-high-contrast-adjust: none!important; }
      .katex .katex-html { display: inline-block; }
      .katex .base { position: relative; display: inline-block; white-space: nowrap; width: min-content; }
      .katex .strut { display: inline-block; }
      .katex .textbf { font-weight: bold; }
      .katex .textit { font-style: italic; }
      .katex .textrm { font-family: KaTeX_Main; }
      .katex .textsf { font-family: KaTeX_SansSerif; }
      .katex .texttt { font-family: KaTeX_Typewriter; }
      .katex .mathdefault { font-family: KaTeX_Math; font-style: italic; }
      .katex .mathit { font-family: KaTeX_Math; font-style: italic; }
      .katex .mathrm { font-style: normal; }
      .katex .mathbf { font-family: KaTeX_Main; font-weight: bold; }
      .katex .boldsymbol { font-family: KaTeX_Math; font-weight: bold; font-style: italic; }
      .katex .amsrm { font-family: KaTeX_AMS; }
      .katex .msupsub { text-align: left; }
      .katex .mfrac > span > span { text-align: center; }
      .katex .mfrac .frac-line { display: inline-block; width: 100%; border-bottom-style: solid; }
      .katex .vlist-t { display: inline-table; table-layout: fixed; }
      .katex .vlist-r { display: table-row; }
      .katex .vlist { display: table-cell; vertical-align: bottom; position: relative; }
      .katex .vlist > span { display: block; height: 0; position: relative; }
      .katex .vlist > span > span { display: inline-block; }
      .katex .vlist .baseline-fix { display: inline-table; table-layout: fixed; }
      .katex .msupsub .vlist-t { vertical-align: -0.05em; }
      .katex .msupsub .vlist > span { margin-top: -0.2em; }
      .katex .mord + .mop { margin-left: 0.16667em; }
      .katex .mord + .mbin { margin-left: 0.22222em; }
      .katex .mord + .mrel { margin-left: 0.27778em; }
      .katex .mord + .minner { margin-left: 0.16667em; }
      .katex .mop + .mord { margin-left: 0.16667em; }
      .katex .mop + .mop { margin-left: 0.16667em; }
      .katex .mop + .mrel { margin-left: 0.27778em; }
      .katex .mop + .minner { margin-left: 0.16667em; }
      .katex .mbin + .mord { margin-left: 0.22222em; }
      .katex .mbin + .mop { margin-left: 0.22222em; }
      .katex .mbin + .mopen { margin-left: 0.22222em; }
      .katex .mbin + .minner { margin-left: 0.22222em; }
      .katex .mrel + .mord { margin-left: 0.27778em; }
      .katex .mrel + .mop { margin-left: 0.27778em; }
      .katex .mrel + .mopen { margin-left: 0.27778em; }
      .katex .mrel + .minner { margin-left: 0.27778em; }
      .katex .mclose + .mop { margin-left: 0.16667em; }
      .katex .mclose + .mbin { margin-left: 0.22222em; }
      .katex .mclose + .mrel { margin-left: 0.27778em; }
      .katex .mclose + .minner { margin-left: 0.16667em; }
      .katex .mpunct + .mord { margin-left: 0.16667em; }
      .katex .mpunct + .mop { margin-left: 0.16667em; }
      .katex .mpunct + .mrel { margin-left: 0.16667em; }
      .katex .mpunct + .mopen { margin-left: 0.16667em; }
      .katex .mpunct + .mclose { margin-left: 0.16667em; }
      .katex .mpunct + .mpunct { margin-left: 0.16667em; }
      .katex .mpunct + .minner { margin-left: 0.16667em; }
      .katex .minner + .mord { margin-left: 0.16667em; }
      .katex .minner + .mop { margin-left: 0.16667em; }
      .katex .minner + .mbin { margin-left: 0.22222em; }
      .katex .minner + .mrel { margin-left: 0.27778em; }
      .katex .minner + .mopen { margin-left: 0.16667em; }
      .katex .minner + .mpunct { margin-left: 0.16667em; }
      .katex .minner + .minner { margin-left: 0.16667em; }
      .katex .sizing, .katex .fontsize-ensurer { display: inline-block; }
      .katex .sizing.reset-size1.size1, .katex .fontsize-ensurer.reset-size1.size1 { font-size: 1em; }
      .katex .sizing.reset-size1.size2, .katex .fontsize-ensurer.reset-size1.size2 { font-size: 1.2em; }
      .katex .sizing.reset-size1.size3, .katex .fontsize-ensurer.reset-size1.size3 { font-size: 1.4em; }
      .katex .sizing.reset-size1.size4, .katex .fontsize-ensurer.reset-size1.size4 { font-size: 1.6em; }
      .katex .sizing.reset-size1.size5, .katex .fontsize-ensurer.reset-size1.size5 { font-size: 1.8em; }
      .katex .sizing.reset-size1.size6, .katex .fontsize-ensurer.reset-size1.size6 { font-size: 2em; }
      .katex .sizing.reset-size1.size7, .katex .fontsize-ensurer.reset-size1.size7 { font-size: 2.4em; }
      .katex .sizing.reset-size2.size1, .katex .fontsize-ensurer.reset-size2.size1 { font-size: 0.83333em; }
      .katex .sizing.reset-size2.size2, .katex .fontsize-ensurer.reset-size2.size2 { font-size: 1em; }
      .katex .sizing.reset-size2.size3, .katex .fontsize-ensurer.reset-size2.size3 { font-size: 1.16667em; }
      .katex .sizing.reset-size2.size4, .katex .fontsize-ensurer.reset-size2.size4 { font-size: 1.33333em; }
      .katex .sizing.reset-size2.size5, .katex .fontsize-ensurer.reset-size2.size5 { font-size: 1.5em; }
      .katex .sizing.reset-size2.size6, .katex .fontsize-ensurer.reset-size2.size6 { font-size: 1.66667em; }
      .katex .sizing.reset-size2.size7, .katex .fontsize-ensurer.reset-size2.size7 { font-size: 2em; }
      .katex .sizing.reset-size3.size1, .katex .fontsize-ensurer.reset-size3.size1 { font-size: 0.71429em; }
      .katex .sizing.reset-size3.size2, .katex .fontsize-ensurer.reset-size3.size2 { font-size: 0.85714em; }
      .katex .sizing.reset-size3.size3, .katex .fontsize-ensurer.reset-size3.size3 { font-size: 1em; }
      .katex .sizing.reset-size3.size4, .katex .fontsize-ensurer.reset-size3.size4 { font-size: 1.14286em; }
      .katex .sizing.reset-size3.size5, .katex .fontsize-ensurer.reset-size3.size5 { font-size: 1.28571em; }
      .katex .sizing.reset-size3.size6, .katex .fontsize-ensurer.reset-size3.size6 { font-size: 1.42857em; }
      .katex .sizing.reset-size3.size7, .katex .fontsize-ensurer.reset-size3.size7 { font-size: 1.71429em; }
      .katex .sizing.reset-size4.size1, .katex .fontsize-ensurer.reset-size4.size1 { font-size: 0.625em; }
      .katex .sizing.reset-size4.size2, .katex .fontsize-ensurer.reset-size4.size2 { font-size: 0.75em; }
      .katex .sizing.reset-size4.size3, .katex .fontsize-ensurer.reset-size4.size3 { font-size: 0.875em; }
      .katex .sizing.reset-size4.size4, .katex .fontsize-ensurer.reset-size4.size4 { font-size: 1em; }
      .katex .sizing.reset-size4.size5, .katex .fontsize-ensurer.reset-size4.size5 { font-size: 1.125em; }
      .katex .sizing.reset-size4.size6, .katex .fontsize-ensurer.reset-size4.size6 { font-size: 1.25em; }
      .katex .sizing.reset-size4.size7, .katex .fontsize-ensurer.reset-size4.size7 { font-size: 1.5em; }
      .katex .sizing.reset-size5.size1, .katex .fontsize-ensurer.reset-size5.size1 { font-size: 0.55556em; }
      .katex .sizing.reset-size5.size2, .katex .fontsize-ensurer.reset-size5.size2 { font-size: 0.66667em; }
      .katex .sizing.reset-size5.size3, .katex .fontsize-ensurer.reset-size5.size3 { font-size: 0.77778em; }
      .katex .sizing.reset-size5.size4, .katex .fontsize-ensurer.reset-size5.size4 { font-size: 0.88889em; }
      .katex .sizing.reset-size5.size5, .katex .fontsize-ensurer.reset-size5.size5 { font-size: 1em; }
      .katex .sizing.reset-size5.size6, .katex .fontsize-ensurer.reset-size5.size6 { font-size: 1.11111em; }
      .katex .sizing.reset-size5.size7, .katex .fontsize-ensurer.reset-size5.size7 { font-size: 1.33333em; }
      .katex .sizing.reset-size6.size1, .katex .fontsize-ensurer.reset-size6.size1 { font-size: 0.5em; }
      .katex .sizing.reset-size6.size2, .katex .fontsize-ensurer.reset-size6.size2 { font-size: 0.6em; }
      .katex .sizing.reset-size6.size3, .katex .fontsize-ensurer.reset-size6.size3 { font-size: 0.7em; }
      .katex .sizing.reset-size6.size4, .katex .fontsize-ensurer.reset-size6.size4 { font-size: 0.8em; }
      .katex .sizing.reset-size6.size5, .katex .fontsize-ensurer.reset-size6.size5 { font-size: 0.9em; }
      .katex .sizing.reset-size6.size6, .katex .fontsize-ensurer.reset-size6.size6 { font-size: 1em; }
      .katex .sizing.reset-size6.size7, .katex .fontsize-ensurer.reset-size6.size7 { font-size: 1.2em; }
      .katex .sizing.reset-size7.size1, .katex .fontsize-ensurer.reset-size7.size1 { font-size: 0.41667em; }
      .katex .sizing.reset-size7.size2, .katex .fontsize-ensurer.reset-size7.size2 { font-size: 0.5em; }
      .katex .sizing.reset-size7.size3, .katex .fontsize-ensurer.reset-size7.size3 { font-size: 0.58333em; }
      .katex .sizing.reset-size7.size4, .katex .fontsize-ensurer.reset-size7.size4 { font-size: 0.66667em; }
      .katex .sizing.reset-size7.size5, .katex .fontsize-ensurer.reset-size7.size5 { font-size: 0.75em; }
      .katex .sizing.reset-size7.size6, .katex .fontsize-ensurer.reset-size7.size6 { font-size: 0.83333em; }
      .katex .sizing.reset-size7.size7, .katex .fontsize-ensurer.reset-size7.size7 { font-size: 1em; }
      .katex .delimsizing.size1 { font-family: KaTeX_Size1; }
      .katex .delimsizing.size2 { font-family: KaTeX_Size2; }
      .katex .delimsizing.size3 { font-family: KaTeX_Size3; }
      .katex .delimsizing.size4 { font-family: KaTeX_Size4; }
      .katex .nulldelimiter { display: inline-block; width: 0.12em; }
    `;
    svg.appendChild(style);

    const foreignObject = document.createElementNS(svgNS, "foreignObject");
    foreignObject.setAttribute("width", String(canvas.width));
    foreignObject.setAttribute("height", String(canvas.height));
    foreignObject.setAttribute("x", "0");
    foreignObject.setAttribute("y", "0");
    
    // Create wrapper with proper namespace
    const wrapper = document.createElement("div");
    wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    wrapper.style.width = canvas.width + "px";
    wrapper.style.height = canvas.height + "px";
    wrapper.style.padding = padding + "px";
    
    const divClone = tempDiv.cloneNode(true) as HTMLElement;
    divClone.style.position = "static";
    divClone.style.left = "0";
    divClone.style.margin = "0";
    wrapper.appendChild(divClone);
    
    foreignObject.appendChild(wrapper);
    svg.appendChild(foreignObject);

    // Convert SVG to data URL (avoids CORS/taint issues)
    const svgString = new XMLSerializer().serializeToString(svg);
    const encodedSvg = encodeURIComponent(svgString)
      .replace(/'/g, "%27")
      .replace(/"/g, "%22");
    const dataUrl = `data:image/svg+xml,${encodedSvg}`;

    const img = new Image();
    
    const strokes = await new Promise<InkStroke[]>((resolve) => {
      img.onload = () => {
        // Draw image to canvas
        ctx.drawImage(img, 0, 0);
        
        // Get pixel data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        
        // Trace the pixels to create filled strokes
        const strokes = tracePixelsToFilledStrokes(pixels, canvas.width, canvas.height, x, y, color);
        
        // Cleanup
        document.body.removeChild(tempDiv);
        
        resolve(strokes);
      };
      
      img.onerror = () => {
        document.body.removeChild(tempDiv);
        resolve([]);
      };
      
      img.src = dataUrl;
    });

    return strokes;
  } catch (error) {
    console.error("Failed to render LaTeX:", error);
    return [];
  }
}

/**
 * Trace pixels to create filled strokes by flood-filling connected regions
 */
function tracePixelsToFilledStrokes(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
  color: string,
  threshold: number = 200
): InkStroke[] {
  const strokes: InkStroke[] = [];
  const visited = new Set<string>();
  const timestamp = performance.now();

  // Helper to check if a pixel is dark
  const isDark = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const idx = (y * width + x) * 4;
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
          const { x, y } = queue.shift()!;
          const pixelKey = `${x},${y}`;
          
          if (visited.has(pixelKey) || !isDark(x, y)) {
            continue;
          }
          
          visited.add(pixelKey);
          regionPoints.push({ x, y });
          
          // Add neighbors (4-connected)
          if (x > 0) queue.push({ x: x - 1, y });
          if (x < width - 1) queue.push({ x: x + 1, y });
          if (y > 0) queue.push({ x, y: y - 1 });
          if (y < height - 1) queue.push({ x, y: y + 1 });
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
          
          for (const y of sortedRows) {
            const xValues = rowMap.get(y)!.sort((a, b) => a - b);
            
            // Create continuous horizontal strokes
            let lineStart = xValues[0];
            let prevX = xValues[0];
            
            for (let i = 1; i <= xValues.length; i++) {
              const x = i < xValues.length ? xValues[i] : -1;
              
              // If there's a gap or end of line, create stroke
              if (x !== prevX + 1 || i === xValues.length) {
                const points: InkPoint[] = [];
                for (let px = lineStart; px <= prevX; px++) {
                  points.push({
                    x: offsetX + px,
                    y: offsetY + y,
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
                
                lineStart = x;
              }
              
              prevX = x;
            }
          }
        }
      }
    }
  }

  return strokes;
}

/**
 * Detect LaTeX expressions in text (between $ or $$)
 * Returns array of segments with type 'text' or 'latex'
 */
export function parseTextWithLatex(text: string): Array<{ type: "text" | "latex"; content: string; displayMode: boolean }> {
  const segments: Array<{ type: "text" | "latex"; content: string; displayMode: boolean }> = [];
  
  let i = 0;
  let currentText = "";
  
  while (i < text.length) {
    // Check for display mode LaTeX ($$)
    if (text[i] === "$" && text[i + 1] === "$") {
      // Save any accumulated text
      if (currentText) {
        segments.push({ type: "text", content: currentText, displayMode: false });
        currentText = "";
      }
      
      // Find closing $$
      let j = i + 2;
      while (j < text.length - 1) {
        if (text[j] === "$" && text[j + 1] === "$") {
          segments.push({
            type: "latex",
            content: text.substring(i + 2, j),
            displayMode: true,
          });
          i = j + 2;
          break;
        }
        j++;
      }
      
      if (j >= text.length - 1) {
        // No closing $$, treat as regular text
        currentText += text[i];
        i++;
      }
    }
    // Check for inline LaTeX ($)
    else if (text[i] === "$") {
      // Save any accumulated text
      if (currentText) {
        segments.push({ type: "text", content: currentText, displayMode: false });
        currentText = "";
      }
      
      // Find closing $
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === "$") {
          segments.push({
            type: "latex",
            content: text.substring(i + 1, j),
            displayMode: false,
          });
          i = j + 1;
          break;
        }
        j++;
      }
      
      if (j >= text.length) {
        // No closing $, treat as regular text
        currentText += text[i];
        i++;
      }
    } else {
      currentText += text[i];
      i++;
    }
  }
  
  // Add any remaining text
  if (currentText) {
    segments.push({ type: "text", content: currentText, displayMode: false });
  }
  
  return segments;
}
