import { Router, Request, Response } from "express";

const router = Router();

type ChatRole = "user" | "assistant" | "system";

interface ChatInputMessage {
  role: ChatRole;
  content: string;
}

interface GeminiPart {
  text: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  error?: {
    message?: string;
  };
}

interface StreamEnvelope {
  type: "start" | "delta" | "done" | "error";
  delta?: string;
  error?: string;
}

const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 4000;
const DEFAULT_MODEL = "gemini-1.5-flash";

function extractTextFromGeminiEvent(event: GeminiResponse): string {
  return event.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
}

function writeSse(res: Response, payload: StreamEnvelope): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function collectDeltasFromEventChunk(eventChunk: string, assembledText: string): { nextText: string; deltas: string[] } {
  const lines = eventChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"));

  const deltas: string[] = [];
  let nextText = assembledText;

  for (const line of lines) {
    const jsonText = line.slice(5).trim();
    if (!jsonText || jsonText === "[DONE]") {
      continue;
    }

    let parsed: GeminiResponse | null = null;
    try {
      parsed = JSON.parse(jsonText) as GeminiResponse;
    } catch {
      continue;
    }

    const eventText = extractTextFromGeminiEvent(parsed);
    if (!eventText) {
      continue;
    }

    if (eventText.startsWith(nextText)) {
      const delta = eventText.slice(nextText.length);
      nextText = eventText;
      if (delta) {
        deltas.push(delta);
      }
      continue;
    }

    nextText += eventText;
    deltas.push(eventText);
  }

  return { nextText, deltas };
}

router.post("/", async (req: Request, res: Response) => {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
  const GEMINI_MODEL = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const streamMode = req.query.stream === "true";

  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server" });
    }

    const { noteId, messages } = req.body as {
      noteId?: string;
      messages?: ChatInputMessage[];
    };

    if (!noteId || typeof noteId !== "string") {
      return res.status(400).json({ error: "Missing noteId in request body" });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages must be a non-empty array" });
    }

    if (messages.length > MAX_MESSAGES) {
      return res.status(400).json({ error: `messages exceeds max length of ${MAX_MESSAGES}` });
    }

    const cleanedMessages = messages
      .filter((message) => message && typeof message.content === "string")
      .map((message) => ({
        role: message.role,
        content: message.content.trim().slice(0, MAX_MESSAGE_LENGTH),
      }))
      .filter((message) => message.content.length > 0);

    if (cleanedMessages.length === 0) {
      return res.status(400).json({ error: "No valid messages provided" });
    }

    const systemMessages = cleanedMessages
      .filter((message) => message.role === "system")
      .map((message) => message.content);

    const contents = cleanedMessages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      }));

    if (contents.length === 0) {
      return res.status(400).json({ error: "At least one user or assistant message is required" });
    }

    const requestBody = {
      system_instruction: {
        parts: [
          {
            text: [
              "You are Derive AI's chat assistant inside a whiteboard and notes app.",
              "Be concise and accurate. Use markdown only when it helps readability.",
              ...systemMessages,
            ].join("\n"),
          },
        ],
      },
      contents,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 1024,
      },
    };

    if (!streamMode) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as GeminiResponse;
        return res.status(response.status).json({
          error: errorData.error?.message || "Failed to call Gemini API",
        });
      }

      const data = (await response.json()) as GeminiResponse;
      const reply = extractTextFromGeminiEvent(data).trim();

      if (!reply) {
        return res.status(502).json({ error: "Gemini returned an empty response" });
      }

      return res.json({ reply });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    writeSse(res, { type: "start" });

    const abortController = new AbortController();
    res.on("close", () => {
      abortController.abort();
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      },
    );

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as GeminiResponse;
      writeSse(res, {
        type: "error",
        error: errorData.error?.message || "Failed to call Gemini API",
      });
      return res.end();
    }

    if (!response.body) {
      writeSse(res, { type: "error", error: "Gemini stream body missing" });
      return res.end();
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assembledText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const eventChunk of events) {
        const { nextText, deltas } = collectDeltasFromEventChunk(eventChunk, assembledText);
        assembledText = nextText;
        for (const delta of deltas) {
          writeSse(res, { type: "delta", delta });
        }
      }
    }

    if (buffer.trim()) {
      const { nextText, deltas } = collectDeltasFromEventChunk(buffer, assembledText);
      assembledText = nextText;
      for (const delta of deltas) {
        writeSse(res, { type: "delta", delta });
      }
    }

    if (!assembledText.trim()) {
      writeSse(res, { type: "error", error: "Gemini returned an empty streamed response" });
      return res.end();
    }

    writeSse(res, { type: "done" });
    return res.end();
  } catch (error) {
    if (streamMode) {
      const message = error instanceof Error ? error.message : "Failed to generate chat response";
      writeSse(res, { type: "error", error: message });
      return res.end();
    }
    console.error("Error generating chat response:", error);
    return res.status(500).json({ error: "Failed to generate chat response" });
  }
});

export default router;
