import { Copy, Trash2, Move, Palette, Calculator } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SelectionPopupProps {
  position: { x: number; y: number };
  onDelete: () => void;
  onDuplicate: () => void;
  onChangeColor: (color: string) => void;
  onSolve: () => void;
  onClose: () => void;
}

const COLORS = [
  { name: "Black", value: "#111827" },
  { name: "Red", value: "#EF4444" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Green", value: "#10B981" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Orange", value: "#F97316" },
  { name: "Yellow", value: "#FFEB3B" },
  { name: "Pink", value: "#FF4081" },
];

export function SelectionPopup({ 
  position, 
  onDelete, 
  onDuplicate, 
  onChangeColor,
  onSolve,
  onClose 
}: SelectionPopupProps): JSX.Element {
  const popupRef = useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleColorSelect = (color: string) => {
    onChangeColor(color);
    setShowColorPicker(false);
  };

  return (
    <div
      ref={popupRef}
      className="fixed z-50 flex gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-xl"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateX(-50%)',
      }}
    >
      <button
        className="flex items-center justify-center rounded-md p-2 text-slate-700 transition-colors hover:bg-slate-100"
        onClick={onDuplicate}
        title="Duplicate"
        type="button"
      >
        <Copy size={18} />
      </button>

      <button
        className="flex items-center justify-center rounded-md p-2 text-blue-600 transition-colors hover:bg-blue-50"
        onClick={onSolve}
        title="Solve Equation"
        type="button"
      >
        <Calculator size={18} />
      </button>

      <div className="relative">
        <button
          className="flex items-center justify-center rounded-md p-2 text-slate-700 transition-colors hover:bg-slate-100"
          onClick={() => setShowColorPicker(!showColorPicker)}
          title="Change Color"
          type="button"
        >
          <Palette size={18} />
        </button>

        {showColorPicker && (
          <div className="absolute left-0 top-full mt-1 flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg" style={{ width: "160px" }}>
            {COLORS.map((c) => (
              <button
                key={c.value}
                className="h-7 w-7 rounded-md border-2 border-transparent transition-transform hover:scale-110 hover:border-slate-300"
                style={{ backgroundColor: c.value }}
                onClick={() => handleColorSelect(c.value)}
                title={c.name}
                type="button"
              />
            ))}
          </div>
        )}
      </div>

      <button
        className="flex items-center justify-center rounded-md p-2 text-red-600 transition-colors hover:bg-red-50"
        onClick={onDelete}
        title="Delete"
        type="button"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}
