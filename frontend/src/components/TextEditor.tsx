import { ChevronDown, ChevronUp, MoveDiagonal2, X } from "lucide-react";

interface TextEditorProps {
  text: string;
  onTextChange: (value: string) => void;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onHeaderPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onHeaderResizePointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
  showResizeHandle?: boolean;
}

export function TextEditor({
  text,
  onTextChange,
  onClose,
  collapsed,
  onToggleCollapsed,
  onHeaderPointerDown,
  onHeaderResizePointerDown,
  isDragging = false,
  showResizeHandle = true,
}: TextEditorProps): JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div
        className={`flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50 px-2 py-1.5 ${onHeaderPointerDown ? (isDragging ? "cursor-grabbing" : "cursor-grab") : ""}`}
        onPointerDown={onHeaderPointerDown}
      >
        {showResizeHandle ? (
          <div
            className="p-1 text-slate-500 cursor-nwse-resize select-none"
            onPointerDown={onHeaderResizePointerDown}
            title="Resize notes"
          >
            <MoveDiagonal2 size={15} />
          </div>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
            onClick={onToggleCollapsed}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <button
            type="button"
            className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
            onClick={onClose}
            title="Close notes"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      {!collapsed ? (
        <textarea
          className="min-h-0 w-full flex-1 resize-none border-0 bg-transparent p-6 text-sm leading-6 text-slate-800 outline-none"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="# Write notes here"
        />
      ) : null}
    </div>
  );
}
