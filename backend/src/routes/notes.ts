import { Router, Request, Response } from "express";
import { getNotesCollection } from "../mongodb.js";
import type { Note } from "../types.js";

const router = Router();

// Get all notes
router.get("/", async (req: Request, res: Response) => {
  try {
    const ownerSub = req.auth?.sub;
    if (!ownerSub) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const notes = await getNotesCollection()
      .find({ ownerSub })
      .sort({ updatedAt: -1 })
      .toArray();
    
    res.json(notes);
  } catch (error) {
    console.error("Error fetching notes:", error);
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

// Get a single note by id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const ownerSub = req.auth?.sub;
    if (!ownerSub) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const note = await getNotesCollection().findOne({ ownerSub, id });
    
    if (!note) {
      return res.status(404).json({ error: "Note not found" });
    }
    
    res.json(note);
  } catch (error) {
    console.error("Error fetching note:", error);
    res.status(500).json({ error: "Failed to fetch note" });
  }
});

// Create a new note
router.post("/", async (req: Request, res: Response) => {
  try {
    const ownerSub = req.auth?.sub;
    if (!ownerSub) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const incoming = req.body as Partial<Note>;
    
    // Validate required fields
    if (!incoming.id || !incoming.title) {
      return res.status(400).json({ error: "Missing required fields: id, title" });
    }

    const note: Note = {
      ...(incoming as Note),
      ownerSub,
    };
    
    // Check if note with this id already exists
    const existing = await getNotesCollection().findOne({ ownerSub, id: note.id });
    if (existing) {
      return res.status(409).json({ error: "Note with this id already exists" });
    }
    
    await getNotesCollection().insertOne(note);
    res.status(201).json(note);
  } catch (error) {
    console.error("Error creating note:", error);
    res.status(500).json({ error: "Failed to create note" });
  }
});

// Update an existing note
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const ownerSub = req.auth?.sub;
    if (!ownerSub) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const updates: Partial<Note> = req.body;
    
    // Remove id from updates to prevent changing it
    delete (updates as any).id;
    delete (updates as any).ownerSub;
    
    const result = await getNotesCollection().updateOne(
      { ownerSub, id },
      { $set: { ...updates, ownerSub } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Note not found" });
    }
    
    const updatedNote = await getNotesCollection().findOne({ ownerSub, id });
    res.json(updatedNote);
  } catch (error) {
    console.error("Error updating note:", error);
    res.status(500).json({ error: "Failed to update note" });
  }
});

// Delete a note
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const ownerSub = req.auth?.sub;
    if (!ownerSub) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    
    const result = await getNotesCollection().deleteOne({ ownerSub, id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Note not found" });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting note:", error);
    res.status(500).json({ error: "Failed to delete note" });
  }
});

// Bulk save notes (useful for syncing)
router.post("/bulk", async (req: Request, res: Response) => {
  try {
    const ownerSub = req.auth?.sub;
    if (!ownerSub) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const notes = req.body as Partial<Note>[];
    
    if (!Array.isArray(notes)) {
      return res.status(400).json({ error: "Expected an array of notes" });
    }
    
    // Use bulk operations for better performance
    const bulkOps = notes.map(note => {
      // Remove _id from the note to avoid MongoDB immutable field error
      const { _id, ownerSub: _ignoredOwnerSub, ...noteWithoutId } = note as any;
      
      return {
        updateOne: {
          filter: { ownerSub, id: note.id },
          update: { $set: { ...noteWithoutId, ownerSub } },
          upsert: true
        }
      };
    });
    
    if (bulkOps.length > 0) {
      await getNotesCollection().bulkWrite(bulkOps);
    }
    
    res.json({ success: true, count: notes.length });
  } catch (error) {
    console.error("Error bulk saving notes:", error);
    res.status(500).json({ error: "Failed to bulk save notes" });
  }
});

export default router;
