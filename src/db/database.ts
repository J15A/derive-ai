import Dexie, { type Table } from "dexie";
import type { Note } from "../types";

class NotesDatabase extends Dexie {
  notes!: Table<Note, string>;

  constructor() {
    super("deriveAiNotes");
    this.version(1).stores({
      notes: "id, updatedAt, title",
    });
  }
}

export const db = new NotesDatabase();

export async function loadNotesFromDb(): Promise<Note[]> {
  return db.notes.orderBy("updatedAt").reverse().toArray();
}

export async function saveNotesToDb(notes: Note[]): Promise<void> {
  await db.transaction("rw", db.notes, async () => {
    await db.notes.clear();
    await db.notes.bulkPut(notes);
  });
}
