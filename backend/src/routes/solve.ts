import { Router, Request, Response } from "express";

const router = Router();

// Strong model for solving - using GPT-4o for better reasoning
// GPT-4o is a powerful chat model that can accurately solve complex math problems
const SOLVER_MODEL = process.env.OPENROUTER_SOLVER_MODEL || "openai/gpt-4";

// Recognition model for graph (also using GPT-4o for better accuracy)
// Upgraded from gpt-4o-mini to gpt-4o for better handwriting recognition
export const RECOGNITION_MODEL = process.env.OPENROUTER_RECOGNITION_MODEL || "openai/gpt-5.2-chat";

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

    // Step 2: Use thinking model to solve the recognized equation
    const solveResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
            content: `You are a math expert. Solve this mathematical expression or equation step by step: ${recognizedEquation}

INSTRUCTIONS:
1. Solve or simplify the expression/equation completely
2. For implicit equations (like x² + y² = 4), identify what they represent (e.g., "circle with radius 2")
3. For equations with a single variable, solve for that variable
4. Show your work with clear steps
5. Format your response using LaTeX

RESPONSE FORMAT - CRITICAL:
- You may think to yourself step by step, but all math must be on its own lines
- Output ONLY LaTeX math expressions wrapped in SINGLE dollar signs: $expression$
- DO NOT use double dollar signs ($$), only single $ delimiters
- NO blank lines between steps
- NO English words, NO labels like "Step 1:", NO explanations
- Each step should be on its own line as: $math expression$
- For integrals, use proper notation: \\int with \\, dx, show intermediate steps, include +C for indefinite integrals
- Use LaTeX arrow (\\to) or equals signs to show progression
- The last line should be the final answer
- Use proper LaTeX formatting for fractions, exponents, integrals, etc.
- For equations that cannot be solved without graphing stop at the simplifed, you may state in latex \text{Cannot be solved analytically}

EXAMPLES:
For "$2x + 4 = 10$":
$2x + 4 = 10$
$2x = 10 - 4$
$2x = 6$
$x = 3$

For "$x^2 - 4 = 0$":
$x^2 - 4 = 0$
$(x-2)(x+2) = 0$
$x - 2 = 0 \\text{ or } x + 2 = 0$
$x = 2 \\text{ or } x = -2$

For "$\\sqrt{x} = 4$":
$\\sqrt{x} = 4$
$(\\sqrt{x})^2 = 4^2$
$x = 16$

For "$x^2 + y^2 = 4$" (implicit equation):
$x^2 + y^2 = 4$
$x^2 + y^2 = 2^2$
$\\text{Circle with center } (0,0) \\text{ and radius } 2$

For "$\\int 2x \\, dx$":
$\\int 2x \\, dx$
$= 2 \\int x \\, dx$
$= 2 \\cdot \\frac{x^2}{2} + C$
$= x^2 + C$

IMPORTANT: 
- Output ONLY math in LaTeX format.
- Keep output compact and avoid overly verbose steps`,
          },
        ],
      }),
    });

    if (!solveResponse.ok) {
      const errorData = await solveResponse.json().catch(() => ({}));
      console.error("OpenRouter API error (solving):", errorData);
      return res.status(solveResponse.status).json({
        error: (errorData as { error?: { message?: string } }).error?.message || "Failed to solve equation",
      });
    }

    const solveData = await solveResponse.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const result = solveData.choices?.[0]?.message?.content?.trim();

    if (!result) {
      return res.json({ result: "Could not solve equation" });
    }

    console.log("Solve result:", result);

    // Clean up the result - ensure it's properly formatted
    let formattedResult = result;
    
    // Replace $$ with $ for consistency (we want inline mode, not display mode)
    formattedResult = formattedResult.replace(/\$\$/g, '$');
    
    // Filter to only keep properly formatted LaTeX lines
    formattedResult = formattedResult
      .split('\n')
      .map(line => line.trim())
      .filter(line => {
        // Skip empty lines
        if (line.length === 0) return false;
        
        // Only keep lines that are properly formatted LaTeX
        // Valid lines must start with $ and end with $
        const isProperlyFormatted = line.startsWith('$') && line.endsWith('$');
        
        // Also check that there's actual content between the dollar signs
        if (isProperlyFormatted) {
          const content = line.slice(1, -1).trim();
          return content.length > 0;
        }
        
        return false;
      })
      .join('\n');

    res.json({ result: formattedResult, fontSize: outputFontSize });
  } catch (error) {
    console.error("Error solving equation:", error);
    res.status(500).json({ error: "Failed to solve equation" });
  }
});

export default router;
