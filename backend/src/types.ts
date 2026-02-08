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

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
}

export interface Note {
  ownerSub: string;
  id: string;
  title: string;
  text: string;
  chatMessages: ChatMessage[];
  strokes: InkStroke[];
  undoneStrokes: InkStroke[];
  viewport: CanvasViewport;
  createdAt: number;
  updatedAt: number;
}
