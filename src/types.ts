export type InkTool = "pen" | "eraser" | "pan" | "selector" | "highlighter" | "text";

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

export interface WhiteboardImage {
  id: string;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  createdAt: number;
}

export interface Selection {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeIds: string[];
}

export interface TextAnnotation {
  id: string;
  x: number; // World coordinates
  y: number; // World coordinates
  text: string;
  fontSize: number;
  color: string;
  width?: number; // Bounding box for selection/erasing
  height?: number;
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
  images: WhiteboardImage[];
  undoneStrokes: InkStroke[];
  textAnnotations: TextAnnotation[];
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
    images: WhiteboardImage[];
    inkPngDataUrl: string;
  };
}
