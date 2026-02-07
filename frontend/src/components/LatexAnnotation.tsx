import { useEffect, useRef } from "react";
import katex from "katex";

interface LatexAnnotationProps {
  text: string;
  x: number; // Screen X position
  y: number; // Screen Y position
  color: string;
}

export function LatexAnnotation({ text, x, y, color }: LatexAnnotationProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      // Render using KaTeX
      katex.render(text, containerRef.current, {
        throwOnError: false,
        displayMode: true,
      });
    } catch (error) {
      console.error("Failed to render LaTeX:", error);
      // Fallback to plain text if LaTeX rendering fails
      containerRef.current.textContent = text;
    }
  }, [text]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        color: color,
        fontSize: "20px",
        fontWeight: "500",
        textShadow: "0 1px 2px rgba(0,0,0,0.1)",
        transform: "translateX(-50%)",
      }}
    />
  );
}
