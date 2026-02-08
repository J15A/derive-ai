import { Router, Request, Response } from "express";
import { RECOGNITION_MODEL } from "./solve.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "OPENROUTER_API_KEY is not configured on the server" });
    }

    const { imageDataUrl, latex } = req.body as { imageDataUrl?: string; latex?: string };

    if (!imageDataUrl && !latex) {
      return res.status(400).json({ error: "Missing imageDataUrl or latex in request body" });
    }

    let recognizedLatex: string;

    // If latex is provided, skip image recognition and use it directly
    if (latex) {
      recognizedLatex = latex;
      console.log("Using provided LaTeX for graphing:", recognizedLatex);
      
      // Clean up the LaTeX (remove dollar signs if present)
      recognizedLatex = recognizedLatex.replace(/\$/g, '').trim();
      
      return res.json({ latex: recognizedLatex });
    } else if (!imageDataUrl) {
      return res.status(400).json({ error: "Either imageDataUrl or latex must be provided" });
    }

    // Use lightweight Gemini model for image recognition (just OCR, no solving needed)
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
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
                text: `Recognize the handwritten math in this image and return it as a valid Desmos-compatible LaTeX expression for graphing.

CRITICAL RECOGNITION TIPS - Pay close attention:
- Distinguish similar characters carefully:
  * "x" vs "×" (letter x vs multiplication) - in algebra, "2x" means 2 times x
  * "0" (zero) vs "O" (letter O) - look for circular shape vs oval
  * "1" (one) vs "l" (lowercase L) vs "|" (vertical bar)
  * "2" vs "Z" - number 2 has a flat base
  * "5" vs "S" - number 5 has straight lines
  * "6" vs "b" - number 6 is completely closed at top
  * Exponents are smaller and positioned higher (like x² or x^2)
  * Subscripts are smaller and positioned lower
- SQUARE ROOT RECOGNITION - CRITICAL:
  * The radical symbol (√) looks like a checkmark with an overline
  * "sqrt x" or "sqrt(x)" means √x (square root of x)
  * "√x", "sqrt x", "sqrt(x)" all mean the same thing
  * Don't confuse √ with "v", "V", or a checkmark
  * For graphing: √x becomes \\sqrt{x}
- Use mathematical context:
  * In "2x" or "3x", the x is a variable (not multiplication symbol)
  * Between two numbers like "3 × 4", × is multiplication
  * Common functions: sin, cos, tan, log, ln, sqrt
  * Fractions have horizontal division line
- Common patterns:
  * y = mx + b (linear)
  * y = ax² + bx + c (quadratic)
  * x² + y² = r² (circle)
  * y = sin(x), y = cos(x), etc.
  * y = √x (square root function)

RULES:
- Return ONLY the LaTeX expression, nothing else.
- The expression must be valid for the Desmos graphing calculator.
- Use Desmos-compatible LaTeX syntax:
  - Use \\frac{a}{b} for fractions
  - Use x^{2} for exponents (braces required for multi-digit)
  - Use \\sqrt{x} for square roots
  - Use \\sin, \\cos, \\tan, \\log, \\ln for functions
  - Use \\pi for pi, e for Euler's number
  - Use y= or f(x)= format for functions when possible
  - For implicit equations like circles, use x^2+y^2=r^2 form
- If the expression is just a number or constant, return y=<that number>
- If it's an expression in x (like x^2+3x-5), return y=x^{2}+3x-5
- If it already has y= or f(x)=, keep it
- Pay special attention to distinguishing variables from operators
- If you cannot recognize valid math, reply with exactly: UNRECOGNIZED

Examples:
- Handwritten "x² + 1" → y=x^{2}+1
- Handwritten "2x + 3" → y=2x+3
- Handwritten "sin(x)" → y=\\sin(x)
- Handwritten "√x" or "sqrt x" → y=\\sqrt{x}
- Handwritten "√(x+1)" or "sqrt(x+1)" → y=\\sqrt{x+1}
- Handwritten "y = 2x + 3" → y=2x+3
- Handwritten "x² + y² = 4" → x^{2}+y^{2}=4
- Handwritten "3" → y=3
- Handwritten "x²/2" → y=\\frac{x^{2}}{2}`,
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
