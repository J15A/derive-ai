import { memo, useDeferredValue, useId, useMemo, useState, useTransition } from "react";
import type { Note } from "../types";

interface SidebarProps {
  notes: Note[];
  selectedNoteId: string | null;
  searchQuery: string;
  onSearch: (query: string) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

function SidebarImpl({
  notes,
  selectedNoteId,
  searchQuery,
  onSearch,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: SidebarProps): JSX.Element {
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

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-panel shadow-soft">
      <div className="space-y-2 border-b border-slate-100 p-3">
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
          className="input"
        />
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-auto p-2">
        {filtered.map((note) => {
          const isSelected = note.id === selectedNoteId;
          const isEditing = editingId === note.id;

          return (
            <div
              key={note.id}
              className={`grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg p-1 ${
                isSelected ? "bg-slate-100" : "hover:bg-slate-50"
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
                  className="truncate rounded-md px-2 py-1.5 text-left text-sm text-slate-800"
                  onClick={() => startTransition(() => onSelect(note.id))}
                  onDoubleClick={() => setEditingId(note.id)}
                >
                  {note.title}
                </button>
              )}

              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                onClick={() => {
                  if (window.confirm("Delete this note?")) {
                    onDelete(note.id);
                  }
                }}
                title="Delete note"
              >
                Delete
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
