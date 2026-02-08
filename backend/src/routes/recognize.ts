import { Router, Request, Response } from "express";
import { RECOGNITION_MODEL } from "./solve.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "OPENROUTER_API_KEY is not configured on the server" });
    }

    const { imageDataUrl } = req.body as { imageDataUrl?: string };

    if (!imageDataUrl) {
      return res.status(400).json({ error: "Missing imageDataUrl in request body" });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.YOUR_SITE_URL || "http://localhost:3001",
        "X-Title": "Derive AI Notebook",
      },
      body: JSON.stringify({
        model: RECOGNITION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl,
                },
              },
              {
                type: "text",
                text: `Transcribe the content in this note selection.

Return plain text that captures the meaning clearly:
- Include both math and non-math text.
- Preserve important structure (lists, equations, line breaks) when visible.
- Use normal readable notation for math (LaTeX is fine when helpful).
- If there are diagrams or shapes, briefly describe them.
- If content is unclear, include your best guess and mark uncertain parts with [?].

Return ONLY the transcription/description text, with no preamble.`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("OpenRouter API error:", errorData);
      return res.status(response.status).json({
        error: (errorData as { error?: { message?: string } }).error?.message || "Failed to call OpenRouter API",
      });
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return res.status(400).json({ error: "Could not recognize content from selection" });
    }

    res.json({ text });
  } catch (error) {
    console.error("Error recognizing note content:", error);
    res.status(500).json({ error: "Failed to recognize note content" });
  }
});

export default router;
