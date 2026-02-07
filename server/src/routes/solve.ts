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

    // OpenRouter uses OpenAI-compatible API
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
                text: "Recognize the handwritten math in this image and solve it. CRITICAL: DO NOT repeat or rewrite the original equation/expression/integral/derivative that was given in the image. Your response must START with the first solution step or the answer, NOT the problem itself.\n\nShow ONLY solution steps and final answer as pure mathematical expressions. NO explanatory text. Each step on a new line. Use Unicode math symbols: ∫ (integral), ² ³ (superscripts), ₀ ₁ (subscripts), √, π, ∞, ÷, ×, ≈, ≠, ≤, ≥, ∑, ∏, etc.\n\nExamples:\nIf image shows '2x + 4 = 10', respond with:\n2x = 6\nx = 3\n\nIf image shows '2+2', respond with:\n= 4\n\nIf image shows '∫x dx', respond with:\n= x²/2 + C\n\nIf image shows 'd/dx(x²)', respond with:\n= 2x\n\nNEVER start your response by restating the problem. Show 1-4 solution steps maximum. NO words like 'Problem:', 'Step 1:', 'Given:', 'Solving:', etc. If you cannot recognize valid math, reply with: Could not recognize equation",
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
        error: (errorData as { error?: { message?: string } }).error?.message || "Failed to call OpenRouter API" 
      });
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const text = data.choices?.[0]?.message?.content?.trim() || "Could not recognize equation";

    res.json({ result: text });
  } catch (error) {
    console.error("Error solving equation:", error);
    res.status(500).json({ error: "Failed to solve equation" });
  }
});

export default router;
