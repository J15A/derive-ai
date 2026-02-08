import { Router, Request, Response } from "express";
import { RECOGNITION_MODEL } from "./solve";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "OPENROUTER_API_KEY is not configured on the server" });
    }

    const { imageDataUrl, fontSize, latex } = req.body as { imageDataUrl?: string; fontSize?: number; latex?: string };

    if (!imageDataUrl && !latex) {
      return res.status(400).json({ error: "Missing imageDataUrl or latex in request body" });
    }

    // Default font size if not provided
    const inputFontSize = fontSize || 16;
    // Scale up output by 2x ONLY for handwritten equations (imageDataUrl), not for LaTeX
    const outputFontSize = latex ? inputFontSize : inputFontSize * 2;

    let recognizedEquation: string;

    // If latex is provided, skip image recognition
    if (latex) {
      recognizedEquation = latex;
      console.log("Using provided LaTeX:", recognizedEquation);
    } else if (imageDataUrl) {
      // Step 1: Use vision model to recognize the equation from the image
      const recognitionResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
                text: `You are a math expert specializing in handwriting recognition. Look at this handwritten mathematical expression or equation in the image and recognize it accurately.

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
1. Carefully recognize what is written in the image with attention to detail
2. Output the mathematical expression/equation in LaTeX format
3. Be precise with the notation

RESPONSE FORMAT:
- Output ONLY the recognized equation in LaTeX format
- Wrap it in SINGLE dollar signs: $equation$
- NO explanations, NO solving, just the equation as written
- If you cannot recognize valid math in the image, respond with exactly: Could not recognize equation`,
              },
            ],
          },
        ],
      }),
    });

    if (!recognitionResponse.ok) {
      const errorData = await recognitionResponse.json().catch(() => ({}));
      console.error("OpenRouter API error (recognition):", errorData);
      return res.status(recognitionResponse.status).json({
        error: (errorData as { error?: { message?: string } }).error?.message || "Failed to recognize equation",
      });
    }

    const recognitionData = await recognitionResponse.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    recognizedEquation = recognitionData.choices?.[0]?.message?.content?.trim() || "";

    if (!recognizedEquation || recognizedEquation.includes("Could not recognize")) {
      return res.json({ result: "Could not recognize equation" });
    }

    console.log("Recognized equation:", recognizedEquation);
    } else {
      return res.status(400).json({ error: "Either imageDataUrl or latex must be provided" });
    }

    // Step 2: Ask the same vision model for just the next step (faster - single API call)
    // Using the vision model that already has the image context
    const nextStepResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.YOUR_SITE_URL || "http://localhost:3001",
        "X-Title": "Derive AI Notebook",
      },
      body: JSON.stringify({
        model: RECOGNITION_MODEL, // Use same model for speed
        messages: [
          {
            role: "user",
            content: `You are a math tutor helping a student solve this equation step by step: ${recognizedEquation}

Your task: Show the student what the NEXT mathematical operation or transformation should be to progress toward the solution.

CRITICAL REQUIREMENTS:
- Line 2 MUST be different from Line 1 - you must actually perform ONE mathematical operation
- Apply ONE logical step: simplify, factor, isolate variable, expand, combine like terms, etc.
- Do NOT just repeat the equation - TRANSFORM it
- If the input contains an equals sign (=), prefix line 2 with "=" but ensure only ONE equals sign total per line
- For expressions without equals signs (like integrals or simplifications), don't add one

RESPONSE FORMAT - CRITICAL:
- Output EXACTLY TWO lines
- Line 1: The current equation (exactly as given)
- Line 2: The result after applying ONE mathematical operation
- MUST use single dollar signs: $equation$
- DO NOT use \\( \\) or \\[ \\] delimiters
- DO NOT use double dollar signs $$
- NO explanations, NO text, ONLY math wrapped in single $ signs
- Each line should have AT MOST one equals sign

EXAMPLES showing TRANSFORMATIONS (notice the single $ delimiters and single = per line):

For "$2x + 4 = 10$":
$2x + 4 = 10$
$2x = 10 - 4$

For "$2x = 6$":
$2x = 6$
$x = 3$

For "$2x = 10 - 4$":
$2x = 10 - 4$
$2x = 6$

For "$x^2 - 4 = 0$":
$x^2 - 4 = 0$
$(x-2)(x+2) = 0$

For "$\\sqrt{x} = 4$":
$\\sqrt{x} = 4$
$x = 16$

For "$\\int x \\, dx$" (no equals sign in input, so none in output):
$\\int x \\, dx$
$\\frac{x^2}{2} + C$

For "$3x + 6 = 12$":
$3x + 6 = 12$
$3x = 6$

For "$x^2 + 5x + 6 = 0$":
$x^2 + 5x + 6 = 0$
$(x+2)(x+3) = 0$

For "$(x+2)(x+3) = 0$":
$(x+2)(x+3) = 0$
$x = -2 \\text{ or } x = -3$

IMPORTANT: Use ONLY single dollar signs $ for delimiters. Line 2 MUST be DIFFERENT from Line 1. Each line should have AT MOST one equals sign!`,
          },
        ],
      }),
    });

    if (!nextStepResponse.ok) {
      const errorData = await nextStepResponse.json().catch(() => ({}));
      console.error("OpenRouter API error (next step):", errorData);
      return res.status(nextStepResponse.status).json({
        error: (errorData as { error?: { message?: string } }).error?.message || "Failed to get next step",
      });
    }

    const nextStepData = await nextStepResponse.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const result = nextStepData.choices?.[0]?.message?.content?.trim();

    if (!result) {
      return res.json({ result: "Could not get next step" });
    }

    console.log("Next step result:", result);

    // Clean up the result - ensure it's properly formatted
    let formattedResult = result;
    
    // Convert LaTeX delimiters to single dollar signs
    // Replace \( \) with $ $
    formattedResult = formattedResult.replace(/\\\(/g, '$').replace(/\\\)/g, '$');
    // Replace \[ \] with $ $
    formattedResult = formattedResult.replace(/\\\[/g, '$').replace(/\\\]/g, '$');
    
    // Remove blank lines
    formattedResult = formattedResult
      .split('\n')
      .filter(line => line.trim().length > 0)
      .join('\n');
    
    // Replace $$ with $ for consistency (we want inline mode, not display mode)
    formattedResult = formattedResult.replace(/\$\$/g, '$');
    
    // Fix lines that are missing opening $ delimiter
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

    // Ensure we only return up to 2 lines (current + next step)
    const lines = formattedResult.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      console.error("Model did not return 2 lines");
      return res.json({ result: "Could not get next step" });
    }
    
    // Validate that line 2 is actually different from line 1
    const line1 = lines[0].trim();
    const line2 = lines[1].trim();
    
    if (line1 === line2) {
      console.error("Model returned identical lines - no transformation was made");
      return res.json({ result: "Could not determine next step - equation may already be solved or simplified" });
    }
    
    formattedResult = lines.slice(0, 2).join('\n');

    res.json({ result: formattedResult, fontSize: outputFontSize });
  } catch (error) {
    console.error("Error getting next step:", error);
    res.status(500).json({ error: "Failed to get next step" });
  }
});

export default router;
