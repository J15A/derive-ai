export type InkTool = "pen" | "eraser" | "pan";

export interface InkPoint {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
}

export interface InkStroke {
  id: string;
  tool: "pen";
  color: string;
  baseSize: number;
  points: InkPoint[];
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
