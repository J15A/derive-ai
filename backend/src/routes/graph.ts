import { Router, Request, Response } from "express";

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
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.YOUR_SITE_URL || "http://localhost:3001",
        "X-Title": "Derive AI Notebook",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
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
                text: `Recognize the handwritten math in this image and return it as a valid Desmos-compatible LaTeX expression for graphing.

RULES:
- Return ONLY the LaTeX expression, nothing else.
- The expression must be valid for the Desmos graphing calculator.
- Use Desmos-compatible LaTeX syntax:
  - Use \\frac{a}{b} for fractions
  - Use x^{2} for exponents
  - Use \\sqrt{x} for square roots
  - Use \\sin, \\cos, \\tan, \\log, \\ln for functions
  - Use \\pi for pi, e for Euler's number
  - Use y= or f(x)= format for functions when possible
  - For implicit equations like circles, use x^2+y^2=r^2 form
- If the expression is just a number or constant, return y=<that number>
- If it's an expression in x (like x^2+3x-5), return y=x^{2}+3x-5
- If it already has y= or f(x)=, keep it
- If you cannot recognize valid math, reply with exactly: UNRECOGNIZED

Examples:
- Handwritten "x² + 1" → y=x^{2}+1
- Handwritten "sin(x)" → y=\\sin(x)
- Handwritten "y = 2x + 3" → y=2x+3
- Handwritten "x² + y² = 4" → x^{2}+y^{2}=4
- Handwritten "3" → y=3`,
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

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const text = data.choices?.[0]?.message?.content?.trim() || "UNRECOGNIZED";

    if (text === "UNRECOGNIZED") {
      return res.status(400).json({ error: "Could not recognize a graphable equation" });
    }

    res.json({ latex: text });
  } catch (error) {
    console.error("Error recognizing equation for graph:", error);
    res.status(500).json({ error: "Failed to recognize equation" });
  }
});

export default router;
