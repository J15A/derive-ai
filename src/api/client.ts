/**
 * API Client (Frontend)
 * 
 * Provides functions to interact with the backend REST API.
 * All requests are sent to the Express server which handles
 * communication with MongoDB.
 */

import type { Note } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

export async function loadNotesFromDb(): Promise<Note[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/notes`);
    if (!response.ok) {
      throw new Error(`Failed to load notes: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error loading notes from server:", error);
    return [];
  }
}

export async function saveNotesToDb(notes: Note[]): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/notes/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(notes),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to save notes: ${response.statusText}`);
    }
  } catch (error) {
    console.error("Error saving notes to server:", error);
    throw error;
  }
}

export async function createNote(note: Note): Promise<Note> {
  try {
    const response = await fetch(`${API_BASE_URL}/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(note),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create note: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error creating note on server:", error);
    throw error;
  }
}

export async function updateNote(id: string, updates: Partial<Note>): Promise<Note> {
  try {
    const response = await fetch(`${API_BASE_URL}/notes/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update note: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error updating note on server:", error);
    throw error;
  }
}

export async function deleteNote(id: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/notes/${id}`, {
      method: "DELETE",
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete note: ${response.statusText}`);
    }
  } catch (error) {
    console.error("Error deleting note on server:", error);
    throw error;
  }
}
