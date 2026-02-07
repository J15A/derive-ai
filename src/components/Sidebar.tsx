import { useMemo, useState } from "react";
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

export function Sidebar({
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

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      return notes;
    }
    return notes.filter((n) => n.title.toLowerCase().includes(q));
  }, [notes, searchQuery]);

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <button className="primary-btn" onClick={onCreate} type="button">
          New Note
        </button>
        <input
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search notes"
          className="search-input"
        />
      </div>
      <div className="note-list">
        {filtered.map((note) => {
          const isSelected = note.id === selectedNoteId;
          const isEditing = editingId === note.id;

          return (
            <div key={note.id} className={`note-list-item ${isSelected ? "selected" : ""}`}>
              {isEditing ? (
                <input
                  autoFocus
                  defaultValue={note.title}
                  className="note-title-input"
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
                  className="note-title-btn"
                  onClick={() => onSelect(note.id)}
                  onDoubleClick={() => setEditingId(note.id)}
                >
                  {note.title}
                </button>
              )}

              <button
                type="button"
                className="ghost-btn"
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
    </aside>
  );
}
