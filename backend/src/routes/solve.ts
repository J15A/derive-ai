import { Router, Request, Response } from "express";

const router = Router();

// Strong model for solving - this needs to be accurate
// Using GPT-4o for strong reasoning and math capabilities
const SOLVER_MODEL = "openai/gpt-4o";

// Recognition model for graph (also using GPT-4o for better accuracy)
// Upgraded from gpt-4o-mini to gpt-4o for better handwriting recognition
export const RECOGNITION_MODEL = "openai/gpt-4o";

router.post("/", async (req: Request, res: Response) => {
  try {
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "OPENROUTER_API_KEY is not configured on the server" });
    }

    const { imageDataUrl, fontSize } = req.body as { imageDataUrl?: string; fontSize?: number };

    if (!imageDataUrl) {
      return res.status(400).json({ error: "Missing imageDataUrl in request body" });
    }

    // Default font size if not provided, then scale up output by 2x
    const inputFontSize = fontSize || 16;
    const outputFontSize = inputFontSize * 2;

    // Use a strong model to both recognize and solve the equation
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.YOUR_SITE_URL || "http://localhost:3001",
        "X-Title": "Derive AI Notebook",
      },
      body: JSON.stringify({
        model: SOLVER_MODEL,
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
                text: `You are a math expert specializing in handwriting recognition. Look at this handwritten mathematical expression or equation in the image and solve it step by step.

The input handwriting has an approximate font size of ${inputFontSize}px. Your output should be rendered at ${outputFontSize}px (2x larger for better visibility).

CRITICAL RECOGNITION TIPS:
- Pay close attention to distinguish similar characters:
  * "x" vs "×" (letter x vs multiplication)
  * "0" (zero) vs "O" (letter O)
  * "1" (one) vs "l" (lowercase L) vs "|" (vertical bar)
  * "2" vs "Z"
  * "5" vs "S"
  * "6" vs "b"
  * "(" vs "[" vs "{"
  * "+" vs "t"
  * "-" vs "–" vs "—" (different dash lengths)
  * "=" vs "≡"
  * Exponents are typically smaller and positioned higher
  * Subscripts are typically smaller and positioned lower
- SQUARE ROOT RECOGNITION - CRITICAL:
  * The radical symbol (√) looks like a checkmark with an overline
  * Common notations: "√x", "sqrt(x)", "√(x)", or just a radical over the expression
  * "sqrt x = 4" means √x = 4 (square root of x equals 4)
  * "sqrt(x + 1)" means √(x + 1)
  * The horizontal bar extends over everything under the radical
  * Don't confuse √ with "v", "V", or a checkmark
- Look at mathematical context to disambiguate:
  * Between numbers, "x" is likely multiplication
  * As a variable in equations, "x" is the letter x
  * In expressions like "2x", the x is a variable (no multiplication sign needed)
- Recognize common mathematical patterns:
  * Quadratic form: ax² + bx + c
  * Fractions typically have a horizontal line between numerator and denominator
  * Square roots: √x, √(expression), or ∛x for cube roots
  * Exponents are superscript
- Handle different handwriting styles:
  * Some people write "1" with a serif, others without
  * "7" may or may not have a cross-bar
  * "4" can be written open or closed

INSTRUCTIONS:
1. First, carefully recognize what is written in the image with attention to detail
2. Then, solve or simplify the expression/equation completely
3. For implicit equations (like x² + y² = 4), identify what they represent (e.g., "circle with radius 2")
4. For equations with a single variable, solve for that variable
5. Show your work with clear steps
6. Format your response using LaTeX

RESPONSE FORMAT - CRITICAL:
- Output ONLY LaTeX math expressions wrapped in SINGLE dollar signs: $expression$
- DO NOT use double dollar signs ($$), only single $ delimiters
- NO blank lines between steps
- NO English words, NO labels like "Step 1:", NO explanations
- Each step should be on its own line as: $math expression$
- For implicit equations, you may use \\text{} to describe what it represents
- For integrals, use proper notation: \\int with \\, dx, show intermediate steps, include +C for indefinite integrals
- Keep the output concise and similar in visual length to the input
- Use LaTeX arrow (\\to) or equals signs to show progression
- The last line should be the final answer
- Use proper LaTeX formatting for fractions, exponents, integrals, etc.

EXAMPLES:
For "2x + 4 = 10":
$2x + 4 = 10$
$2x = 10 - 4$
$2x = 6$
$x = 3$

For "x² - 4 = 0":
$x^2 - 4 = 0$
$(x-2)(x+2) = 0$
$x - 2 = 0 \\text{ or } x + 2 = 0$
$x = 2 \\text{ or } x = -2$

For "√x = 4" or "sqrt x = 4":
$\\sqrt{x} = 4$
$(\\sqrt{x})^2 = 4^2$
$x = 16$

For "x² + y² = 4" (implicit equation):
$x^2 + y^2 = 4$
$x^2 + y^2 = 2^2$
$\\text{Circle with center } (0,0) \\text{ and radius } 2$

For "∫ 2x dx":
$\\int 2x \\, dx$
$= 2 \\int x \\, dx$
$= 2 \\cdot \\frac{x^2}{2} + C$
$= x^2 + C$

For "∫₀¹ x² dx" (definite integral):
$\\int_0^1 x^2 \\, dx$
$= \\left[ \\frac{x^3}{3} \\right]_0^1$
$= \\frac{1}{3} - 0$
$= \\frac{1}{3}$

For "5 + 3 × 2":
$5 + 3 \\times 2$
$5 + 6$
$= 11$

IMPORTANT: 
- Output ONLY math in LaTeX format. English words only inside \\text{} when necessary
- Keep output compact and avoid overly verbose steps
- Match the visual scale of the input
- For implicit equations, describe what they represent geometrically
- Take extra care with character recognition - context matters!

If you cannot recognize valid math in the image, respond with exactly: Could not recognize equation`,
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

    const result = data.choices?.[0]?.message?.content?.trim();

    if (!result || result.includes("Could not recognize")) {
      return res.json({ result: "Could not recognize equation" });
    }

    console.log("Solve result:", result);

    // Clean up the result - ensure it's properly formatted
    let formattedResult = result;
    
    // Remove blank lines
    formattedResult = formattedResult
      .split('\n')
      .filter(line => line.trim().length > 0)
      .join('\n');
    
    // Replace $$ with $ for consistency (we want inline mode, not display mode)
    formattedResult = formattedResult.replace(/\$\$/g, '$');
    
    // Fix lines that are missing opening $ delimiter
    // Pattern: lines that start with LaTeX content but missing opening $
    formattedResult = formattedResult
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        
        // If line ends with $ but doesn't start with $, add opening $
        if (trimmed.endsWith('$') && !trimmed.startsWith('$')) {
          return '$' + trimmed;
        }
        
        // If line starts with $ but doesn't end with $, add closing $
        if (trimmed.startsWith('$') && !trimmed.endsWith('$')) {
          return trimmed + '$';
        }
        
        // If line contains LaTeX commands but no delimiters at all, wrap it
        if (!trimmed.includes('$') && (
          trimmed.includes('\\') || 
          trimmed.match(/[a-z]\^|_\{|\\frac|\\sqrt|\\text/)
        )) {
          return '$' + trimmed + '$';
        }
        
        return line;
      })
      .join('\n');

    res.json({ result: formattedResult, fontSize: outputFontSize });
  } catch (error) {
    console.error("Error solving equation:", error);
    res.status(500).json({ error: "Failed to solve equation" });
  }
});

export default router;
