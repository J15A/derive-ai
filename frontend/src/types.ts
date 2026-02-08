export type InkTool = "pen" | "eraser" | "pan" | "selector" | "highlighter" | "text" | "shape";

export type ShapeType = "rectangle" | "circle" | "line" | "arrow" | "triangle";

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

export interface InkHistoryAction {
  /** Human-readable label for the action (used only for debugging). */
  label: string;
  /** Full snapshot of strokes before this action. */
  beforeStrokes: InkStroke[];
  /** Full snapshot of strokes after this action. */
  afterStrokes: InkStroke[];
  /** Full snapshot of shapes before this action. */
  beforeShapes: Shape[];
  /** Full snapshot of shapes after this action. */
  afterShapes: Shape[];
  /** Full snapshot of text annotations before this action. */
  beforeTextAnnotations: TextAnnotation[];
  /** Full snapshot of text annotations after this action. */
  afterTextAnnotations: TextAnnotation[];
  /** Full snapshot of images before this action. */
  beforeImages: WhiteboardImage[];
  /** Full snapshot of images after this action. */
  afterImages: WhiteboardImage[];
  timestamp: number;
}

export interface WhiteboardImage {
  id: string;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  createdAt: number;
  latex?: string; // Optional: stores the LaTeX source if this image was generated from LaTeX
  fontSize?: number; // Optional: stores the font size used to render the LaTeX
}

export interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
  filled: boolean;
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

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
}

export interface Note {
  id: string;
  title: string;
  text: string;
  chatMessages: ChatMessage[];
  strokes: InkStroke[];
  shapes: Shape[];
  images: WhiteboardImage[];
  undoneStrokes: InkStroke[];
  textAnnotations: TextAnnotation[];
  undoHistory: InkHistoryAction[];
  redoHistory: InkHistoryAction[];
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
