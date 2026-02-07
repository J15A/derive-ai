/**
 * MongoDB Connection Manager (Backend)
 * 
 * Handles the connection to MongoDB Atlas and provides
 * access to the database and collections.
 */

import { MongoClient, Db, Collection } from "mongodb";
import type { Note } from "./types.js";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToDatabase(uri: string): Promise<Db> {
  if (db) {
    return db;
  }

  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db();
    
    console.log("✅ Connected to MongoDB");
    
    // Create indexes for better query performance
    await db.collection("notes").createIndex({ updatedAt: -1 });
    await db.collection("notes").createIndex({ title: "text", text: "text" });
    
    return db;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
}

export function getDatabase(): Db {
  if (!db) {
    throw new Error("Database not initialized. Call connectToDatabase first.");
  }
  return db;
}

export function getNotesCollection(): Collection<Note> {
  return getDatabase().collection<Note>("notes");
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log("Disconnected from MongoDB");
  }
}
