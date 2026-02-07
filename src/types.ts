export type InkTool = "pen" | "eraser" | "pan" | "selector" | "highlighter";

export interface InkPoint {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
}

export interface InkStroke {
  id: string;
  tool: "pen" | "highlighter";
  color: string;
  baseSize: number;
  points: InkPoint[];
}

export interface Selection {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeIds: string[];
}

export interface CanvasViewport {
  offsetX: number;
  offsetY: number;
  scale: number;
}

export interface Note {
  id: string;
  title: string;
  text: string;
  strokes: InkStroke[];
  undoneStrokes: InkStroke[];
  viewport: CanvasViewport;
  createdAt: number;
  updatedAt: number;
}

export interface NoteBundle {
  version: 1;
  exportedAt: string;
  note: {
    title: string;
    text: string;
    strokes: InkStroke[];
    inkPngDataUrl: string;
  };
}
