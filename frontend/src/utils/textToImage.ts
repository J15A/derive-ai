import katex from "katex";
import type { WhiteboardImage } from "../types";
import { uid } from "./ink";

// ─── CSS / font embedding cache ────────────────────────────────────────────────
// SVG foreignObject runs in an isolated rendering context — it can't see the
// page's stylesheets or @font-face rules.  We extract the full KaTeX CSS (with
// corrected font URLs) and the handwriting font, cache everything once, and
// embed it as a <style> element inside the SVG so layout is pixel-perfect.

let _fontDataUrlPromise: Promise<string | null> | null = null;

function loadFontAsDataUrl(): Promise<string | null> {
  if (!_fontDataUrlPromise) {
    _fontDataUrlPromise = fetch("/CaveatBrush-Regular.ttf")
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          }),
      )
      .catch(() => null);
  }
  return _fontDataUrlPromise;
}

let _katexCssCache: string | null = null;

/**
 * Extract all KaTeX-related CSS rules from the page's loaded stylesheets and
 * rewrite relative `url(fonts/...)` references to absolute URLs so they
 * resolve correctly inside a serialised SVG foreignObject.
 */
function getKatexCss(): string {
  if (_katexCssCache !== null) return _katexCssCache;

  const rules: string[] = [];
  for (const sheet of document.styleSheets) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cssRules = sheet.cssRules || (sheet as any).rules;
      if (!cssRules) continue;

      // Detect if this stylesheet contains KaTeX rules
      let isKatexSheet = false;
      for (let i = 0; i < cssRules.length; i++) {
        const text = cssRules[i].cssText;
        if (text.includes(".katex") || text.includes("KaTeX_")) {
          isKatexSheet = true;
          break;
        }
      }
      if (!isKatexSheet) continue;

      // Determine base URL for rewriting relative font paths
      const href = sheet.href || "";
      const baseUrl = href ? href.substring(0, href.lastIndexOf("/") + 1) : "";

      for (let i = 0; i < cssRules.length; i++) {
        let css = cssRules[i].cssText;
        // Rewrite relative font URLs to absolute
        if (baseUrl) {
          css = css.replace(/url\(["']?fonts\//g, `url(${baseUrl}fonts/`);
        }
        rules.push(css);
      }
    } catch {
      // Cross-origin stylesheet — skip silently
    }
  }

  _katexCssCache = rules.join("\n");
  return _katexCssCache;
}

/**
 * Detect LaTeX expressions in text (between $ or $$).
 * Returns array of segments with type 'text' or 'latex'.
 */
export function parseTextWithLatex(
  text: string,
): Array<{ type: "text" | "latex"; content: string; displayMode: boolean }> {
  const segments: Array<{
    type: "text" | "latex";
    content: string;
    displayMode: boolean;
  }> = [];

  let i = 0;
  let currentText = "";

  while (i < text.length) {
    if (text[i] === "$" && text[i + 1] === "$") {
      if (currentText) {
        segments.push({
          type: "text",
          content: currentText,
          displayMode: false,
        });
        currentText = "";
      }
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
        currentText += text[i];
        i++;
      }
    } else if (text[i] === "$") {
      if (currentText) {
        segments.push({
          type: "text",
          content: currentText,
          displayMode: false,
        });
        currentText = "";
      }
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
        currentText += text[i];
        i++;
      }
    } else {
      currentText += text[i];
      i++;
    }
  }

  if (currentText) {
    segments.push({ type: "text", content: currentText, displayMode: false });
  }

  return segments;
}

/**
 * Render a plain text segment to a canvas and return as data URL.
 */
function renderTextToDataUrl(
  text: string,
  fontSize: number,
  color: string,
): { dataUrl: string; width: number; height: number } | null {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const dpr = 2; // render at 2× for crisp text
  // Use a clean sans-serif font for plain text (different from LaTeX handwriting)
  const fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
  ctx.font = `${fontSize * dpr}px ${fontFamily}`;
  const metrics = ctx.measureText(text);

  const width = Math.ceil(metrics.width) + 4;
  const height = Math.ceil(fontSize * dpr * 1.4) + 4;
  canvas.width = width;
  canvas.height = height;

  // Re-set font after resize clears canvas state
  ctx.font = `${fontSize * dpr}px ${fontFamily}`;
  ctx.textBaseline = "top";
  ctx.fillStyle = color;
  ctx.fillText(text, 2, fontSize * dpr * 0.15);

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: width / dpr,
    height: height / dpr,
  };
}

/**
 * Render a KaTeX expression to a canvas via SVG foreignObject
 * and return the data URL.
 *
 * Instead of manually inlining computed styles (which loses flexbox,
 * table-layout, SVG stretchy delimiters, pseudo-elements, etc.) we embed
 * the entire KaTeX stylesheet plus the handwriting font @font-face directly
 * inside the SVG.  This preserves all of KaTeX's complex layout rules so
 * matrices, tall delimiters, stretchy brackets, and spacing all work correctly.
 */
async function renderLatexToDataUrl(
  latex: string,
  displayMode: boolean,
  fontSize: number,
  color: string,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      output: "html",
    });

    const HANDWRITING_FONT = "'Caveat Brush', 'Caveat', 'Comic Sans MS', cursive";

    // Render in the real DOM so KaTeX CSS applies and we can measure
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";
    tempDiv.style.fontSize = (displayMode ? fontSize * 1.3 : fontSize) + "px";
    tempDiv.style.lineHeight = "1.2";
    tempDiv.style.color = color;
    tempDiv.style.fontFamily = `${HANDWRITING_FONT}, KaTeX_Main, Times New Roman, serif`;
    document.body.appendChild(tempDiv);

    await document.fonts.ready;

    // Measure true visual extent including overflowing sub/superscripts
    const bbox = tempDiv.getBoundingClientRect();
    let minTop = bbox.top;
    let maxBottom = bbox.bottom;
    let maxRight = bbox.right;
    const allEls = tempDiv.querySelectorAll("*");
    for (const child of allEls) {
      const cr = child.getBoundingClientRect();
      if (cr.width === 0 && cr.height === 0) continue;
      if (cr.top < minTop) minTop = cr.top;
      if (cr.bottom > maxBottom) maxBottom = cr.bottom;
      if (cr.right > maxRight) maxRight = cr.right;
    }

    const width = Math.ceil(maxRight - bbox.left);
    const height = Math.ceil(maxBottom - minTop);
    const overflowTop = Math.ceil(bbox.top - minTop);
    if (width === 0 || height === 0) {
      document.body.removeChild(tempDiv);
      return null;
    }

    const dpr = 2;
    const padding = 8;
    const canvasW = (width + padding * 2) * dpr;
    const canvasH = (height + padding * 2) * dpr;

    const canvas = document.createElement("canvas");
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      document.body.removeChild(tempDiv);
      return null;
    }

    // ── Build SVG with embedded stylesheets ──────────────────────────────
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", String(canvasW));
    svg.setAttribute("height", String(canvasH));
    svg.setAttribute("xmlns", svgNS);

    // Collect CSS to embed: KaTeX stylesheet + handwriting font + overrides
    let embeddedCss = getKatexCss();

    // Embed handwriting font
    const fontDataUrl = await loadFontAsDataUrl();
    if (fontDataUrl) {
      embeddedCss += `\n@font-face {
        font-family: 'Caveat Brush';
        src: url('${fontDataUrl}') format('truetype');
        font-weight: normal;
        font-style: normal;
      }`;
    }

    // Override KaTeX font-families to prefer handwriting, but keep
    // KaTeX_Size fonts as-is for large delimiters/brackets/integrals,
    // and keep KaTeX_AMS for special symbols.
    embeddedCss += `
      .katex { font-family: ${HANDWRITING_FONT}, KaTeX_Main, Times New Roman, serif !important; }
      .katex .mathnormal { font-family: ${HANDWRITING_FONT}, KaTeX_Math, serif !important; }
      .katex .mathit { font-family: ${HANDWRITING_FONT}, KaTeX_Main, serif !important; }
      .katex .mathrm { font-family: ${HANDWRITING_FONT}, KaTeX_Main, serif !important; }
      .katex .textrm { font-family: ${HANDWRITING_FONT}, KaTeX_Main, serif !important; }
      .katex .mainrm { font-family: ${HANDWRITING_FONT}, KaTeX_Main, serif !important; }
    `;

    const styleEl = document.createElementNS(svgNS, "style");
    styleEl.textContent = embeddedCss;
    svg.appendChild(styleEl);

    // ── foreignObject wrapper ────────────────────────────────────────────
    const fo = document.createElementNS(svgNS, "foreignObject");
    fo.setAttribute("width", String(width + padding * 2));
    fo.setAttribute("height", String(height + padding * 2));
    fo.setAttribute("x", "0");
    fo.setAttribute("y", "0");
    fo.setAttribute("transform", `scale(${dpr})`);

    const wrapper = document.createElement("div");
    wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    wrapper.style.width = width + padding * 2 + "px";
    wrapper.style.height = height + padding * 2 + "px";
    wrapper.style.paddingLeft = padding + "px";
    wrapper.style.paddingRight = padding + "px";
    wrapper.style.paddingTop = (padding + overflowTop) + "px";
    wrapper.style.paddingBottom = padding + "px";
    wrapper.style.boxSizing = "border-box";
    wrapper.style.overflow = "visible";

    // Clone the KaTeX DOM as-is — the embedded CSS will style it correctly
    const clone = tempDiv.cloneNode(true) as HTMLElement;
    clone.style.position = "static";
    clone.style.left = "0";
    clone.style.margin = "0";
    clone.style.fontSize = (displayMode ? fontSize * 1.3 : fontSize) + "px";
    clone.style.lineHeight = "1.2";
    clone.style.color = color;
    clone.style.fontFamily = `${HANDWRITING_FONT}, KaTeX_Main, Times New Roman, serif`;
    wrapper.appendChild(clone);

    fo.appendChild(wrapper);
    svg.appendChild(fo);

    const svgString = new XMLSerializer().serializeToString(svg);
    const dataUrl = `data:image/svg+xml,${encodeURIComponent(svgString)
      .replace(/'/g, "%27")
      .replace(/"/g, "%22")}`;

    const result = await new Promise<{
      dataUrl: string;
      width: number;
      height: number;
    } | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        resolve({
          dataUrl: canvas.toDataURL("image/png"),
          width: (width + padding * 2),
          height: (height + padding * 2),
        });
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });

    document.body.removeChild(tempDiv);
    return result;
  } catch (error) {
    console.error("Failed to render LaTeX:", error);
    return null;
  }
}

/**
 * Convert text (with optional inline LaTeX) to a WhiteboardImage.
 *
 * Plain text is rendered with canvas fillText.
 * LaTeX segments ($..$ or $$..$$) are rendered via KaTeX → SVG foreignObject → canvas.
 * All segments are composited onto a single canvas and returned as a PNG data URL
 * wrapped in a WhiteboardImage.
 */
export async function textToImage(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  color: string,
): Promise<WhiteboardImage | null> {
  const segments = parseTextWithLatex(text);

  // Render each segment to get its image data and dimensions
  const rendered: Array<{
    dataUrl: string;
    width: number;
    height: number;
  }> = [];

  for (const segment of segments) {
    if (segment.type === "latex") {
      const result = await renderLatexToDataUrl(
        segment.content,
        segment.displayMode,
        fontSize,
        color,
      );
      if (result) rendered.push(result);
    } else {
      const result = renderTextToDataUrl(segment.content, fontSize, color);
      if (result) rendered.push(result);
    }
  }

  if (rendered.length === 0) return null;

  // Composite all segments side by side onto a single canvas
  const totalWidth = rendered.reduce((sum, r) => sum + r.width, 0);
  const maxHeight = Math.max(...rendered.map((r) => r.height));
  const dpr = 2;
  const compositeCanvas = document.createElement("canvas");
  compositeCanvas.width = totalWidth * dpr;
  compositeCanvas.height = maxHeight * dpr;
  const ctx = compositeCanvas.getContext("2d");
  if (!ctx) return null;

  // Load all rendered images and draw them
  let offsetX = 0;
  for (const r of rendered) {
    const img = await loadImage(r.dataUrl);
    if (img) {
      // Vertically center each segment
      const yOffset = (maxHeight - r.height) / 2;
      ctx.drawImage(img, offsetX * dpr, yOffset * dpr, r.width * dpr, r.height * dpr);
    }
    offsetX += r.width;
  }

  return {
    id: uid(),
    dataUrl: compositeCanvas.toDataURL("image/png"),
    x,
    y: y - maxHeight / 2, // center vertically at click point
    width: totalWidth,
    height: maxHeight,
    createdAt: Date.now(),
  };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
