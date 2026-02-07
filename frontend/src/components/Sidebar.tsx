import { memo, useDeferredValue, useId, useMemo, useState, useTransition } from "react";
import { ChevronLeft, Trash2 } from "lucide-react";
import type { Note } from "../types";

interface SidebarProps {
  notes: Note[];
  selectedNoteId: string | null;
  searchQuery: string;
  isCollapsed: boolean;
  onSearch: (query: string) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onToggleCollapse: () => void;
}

function SidebarImpl({
  notes,
  selectedNoteId,
  searchQuery,
  isCollapsed,
  onSearch,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onToggleCollapse,
}: SidebarProps): JSX.Element | null {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(searchQuery);
  const searchId = useId();

  const filtered = useMemo(() => {
    const q = deferredQuery.toLowerCase().trim();
    if (!q) {
      return notes;
    }
    return notes.filter((note) => note.title.toLowerCase().includes(q));
  }, [deferredQuery, notes]);

  if (isCollapsed) {
    return null;
  }

  return (
    <aside className="relative z-30 flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-panel shadow-soft transition-transform duration-300 ease-in-out max-sm:rounded-none max-sm:border-x-0 max-sm:border-t-0">
      <button
        onClick={onToggleCollapse}
        className="absolute -right-8 top-1/2 z-10 flex h-24 w-8 -translate-y-1/2 items-center justify-center rounded-r-2xl border border-l-0 border-slate-200 bg-panel text-slate-500 transition-all duration-200 hover:w-10 hover:-right-10 hover:bg-slate-50 hover:text-slate-700 max-sm:hidden"
        title="Close sidebar"
        type="button"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="space-y-2 border-b border-slate-100 p-3 max-sm:space-y-3">
        <button className="btn btn-active w-full" onClick={onCreate} type="button">
          New Note
        </button>
        <label htmlFor={searchId} className="sr-only">
          Search notes
        </label>
        <input
          id={searchId}
          value={searchQuery}
          onChange={(e) => {
            const next = e.target.value;
            startTransition(() => onSearch(next));
          }}
          placeholder="Search notes"
          className="input max-sm:py-3 max-sm:text-base"
        />
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-auto p-2 max-sm:space-y-2 max-sm:p-3">
        {filtered.map((note) => {
          const isSelected = note.id === selectedNoteId;
          const isEditing = editingId === note.id;

          return (
            <div
              key={note.id}
              className={`grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg p-1 max-sm:p-2 ${
                isSelected ? "bg-slate-100 ring-1 ring-slate-200" : "hover:bg-slate-50"
              }`}
            >
              {isEditing ? (
                <input
                  autoFocus
                  defaultValue={note.title}
                  className="input py-1.5"
                  onBlur={(e) => {
                    onRename(note.id, e.target.value);
                    setEditingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onRename(note.id, (e.target as HTMLInputElement).value);
                      setEditingId(null);
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="truncate rounded-md px-2 py-1.5 text-left text-sm text-slate-800 max-sm:py-2.5 max-sm:text-base"
                  onClick={() => startTransition(() => onSelect(note.id))}
                  onDoubleClick={() => setEditingId(note.id)}
                >
                  {note.title}
                </button>
              )}

              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-200 hover:text-red-600 max-sm:h-10 max-sm:w-10"
                onClick={() => {
                  if (window.confirm("Delete this note?")) {
                    onDelete(note.id);
                  }
                }}
                title="Delete note"
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
        {isPending ? "Updating..." : `${filtered.length} notes`}
      </div>
    </aside>
  );
}

export const Sidebar = memo(SidebarImpl);
