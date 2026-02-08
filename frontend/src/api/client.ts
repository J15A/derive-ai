/**
 * API Client (Frontend)
 * 
 * Provides functions to interact with the backend REST API.
 * All requests are sent to the Express server which handles
 * communication with MongoDB.
 */

import type { ChatRole, Note } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

type AccessTokenProvider = () => Promise<string>;

let accessTokenProvider: AccessTokenProvider | null = null;

export function setAccessTokenProvider(provider: AccessTokenProvider | null): void {
  accessTokenProvider = provider;
}

async function buildAuthHeaders(baseHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
  if (!accessTokenProvider) {
    return baseHeaders;
  }

  const token = await accessTokenProvider();
  return {
    ...baseHeaders,
    Authorization: `Bearer ${token}`,
  };
}

export async function loadNotesFromDb(): Promise<Note[]> {
  try {
    const headers = await buildAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/notes`, { headers });
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
    const headers = await buildAuthHeaders({
      "Content-Type": "application/json",
    });
    const response = await fetch(`${API_BASE_URL}/notes/bulk`, {
      method: "POST",
      headers,
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
    const headers = await buildAuthHeaders({
      "Content-Type": "application/json",
    });
    const response = await fetch(`${API_BASE_URL}/notes`, {
      method: "POST",
      headers,
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
    const headers = await buildAuthHeaders({
      "Content-Type": "application/json",
    });
    const response = await fetch(`${API_BASE_URL}/notes/${id}`, {
      method: "PUT",
      headers,
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
    const headers = await buildAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/notes/${id}`, {
      method: "DELETE",
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete note: ${response.statusText}`);
    }
  } catch (error) {
    console.error("Error deleting note on server:", error);
    throw error;
  }
}

export async function solveEquation(imageDataUrl: string, fontSize = 16): Promise<{ result: string; fontSize: number }> {
  const response = await fetch(`${API_BASE_URL}/solve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageDataUrl, fontSize }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Failed to solve equation: ${response.statusText}`);
  }

  const data = (await response.json()) as { result: string; fontSize: number };
  return data;
}

export async function recognizeEquationForGraph(imageDataUrl: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/graph`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageDataUrl }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Failed to recognize equation: ${response.statusText}`);
  }

  const data = (await response.json()) as { latex: string };
  return data.latex;
}

interface ChatApiMessage {
  role: ChatRole;
  content: string;
}

interface SendChatMessageRequest {
  noteId: string;
  messages: ChatApiMessage[];
}

interface SendChatMessageStreamOptions {
  signal?: AbortSignal;
  onDelta: (chunk: string) => void;
}

export async function sendChatMessage(payload: SendChatMessageRequest): Promise<string> {
  const headers = await buildAuthHeaders({
    "Content-Type": "application/json",
  });

  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Failed to send chat message: ${response.statusText}`);
  }

  const data = (await response.json()) as { reply: string };
  return data.reply;
}

export async function sendChatMessageStream(
  payload: SendChatMessageRequest,
  options: SendChatMessageStreamOptions,
): Promise<void> {
  const headers = await buildAuthHeaders({
    "Content-Type": "application/json",
  });

  const response = await fetch(`${API_BASE_URL}/chat?stream=true`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Failed to send chat message: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("Chat stream body is missing");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const eventChunk of events) {
      const lines = eventChunk
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"));

      for (const line of lines) {
        const jsonText = line.slice(5).trim();
        if (!jsonText) {
          continue;
        }

        let payloadData: { type?: string; delta?: string; error?: string } | null = null;
        try {
          payloadData = JSON.parse(jsonText) as { type?: string; delta?: string; error?: string };
        } catch {
          continue;
        }

        if (payloadData.type === "delta" && payloadData.delta) {
          options.onDelta(payloadData.delta);
        } else if (payloadData.type === "error") {
          throw new Error(payloadData.error || "Stream failed");
        }
      }
    }
  }
}
