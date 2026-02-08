import { Router, Request, Response } from "express";
import { RECOGNITION_MODEL } from "./solve.js";

const router = Router();

// Use a reasoning model for checking mathematical work - DeepSeek R1 is better at mathematical verification
const CHECK_MODEL = process.env.OPENROUTER_CHECK_MODEL || "openai/gpt-5.2-chat" || "openai/gpt-5.2-chat";

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

    // Step 1: Use vision model to recognize all lines of the solution
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
                text: `You are a math expert specializing in handwriting recognition. Look at this image which contains a handwritten math solution with multiple lines/steps.

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
  * Don't confuse √ with "v", "V", or a checkmark
- Look at mathematical context to disambiguate
- Recognize common mathematical patterns

INSTRUCTIONS:
1. Carefully recognize EVERY line of math written in the image, from top to bottom
2. Each line of handwriting should become one line of LaTeX output
3. Preserve the exact order of lines as they appear in the image
4. Be precise with the notation

RESPONSE FORMAT:
- Output each recognized line in LaTeX, one per line
- Wrap each line in SINGLE dollar signs: $equation$
- NO explanations, NO labels, just the math lines in order
- If you cannot recognize valid math in the image, respond with exactly: Could not recognize`,
              },
            ],
          },
        ],
      }),
    });

    if (!recognitionResponse.ok) {
      const errorData = await recognitionResponse.json().catch(() => ({}));
      console.error("OpenRouter API error (check recognition):", errorData);
      return res.status(recognitionResponse.status).json({
        error: (errorData as { error?: { message?: string } }).error?.message || "Failed to recognize solution",
      });
    }

    const recognitionData = await recognitionResponse.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const recognizedText = recognitionData.choices?.[0]?.message?.content?.trim() || "";

    if (!recognizedText || recognizedText.includes("Could not recognize")) {
      return res.json({ error: "Could not recognize the solution" });
    }

    console.log("Check - Recognized solution:", recognizedText);

    // Parse recognized lines
    const recognizedLines = recognizedText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('$') && line.endsWith('$') && line.length > 2);

    if (recognizedLines.length === 0) {
      return res.json({ error: "No valid math lines recognized" });
    }

    // Step 2: Send to checking model to validate each step
    const checkResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.YOUR_SITE_URL || "http://localhost:3001",
        "X-Title": "Derive AI Notebook",
      },
      body: JSON.stringify({
        model: CHECK_MODEL,
        messages: [
          {
            role: "user",
            content: `You are a math teacher checking a student's work. The student has written the following solution, with each line being one step:

${recognizedLines.map((line, i) => `Line ${i + 1}: ${line}`).join('\n')}

CRITICAL CHECKING RULES:
1. Verify EACH transition from one line to the next is mathematically correct
2. Students may show intermediate steps (like expanding before combining like terms) - this is CORRECT
3. Students may rearrange terms or write them in different orders - this is CORRECT as long as it's algebraically equivalent
4. ONLY flag an error if there is an actual mathematical mistake (wrong sign, wrong coefficient, wrong operation, etc.)
5. If a step is algebraically equivalent to what it should be, even if shown differently, it is CORRECT
6. **IMPORTANT**: If a line contains a minor error BUT the error is corrected in the NEXT line, DO NOT flag it as an error. Only flag persistent errors that are NOT corrected.

EXAMPLES OF WHAT IS CORRECT (NOT errors):
- Expanding (x^2+x-6)(x+4) to x^3+x^2-6x+4x^2+4x-24 before simplifying (showing work)
- Writing x^2+4x^2 as 5x^2 in a later step (combining like terms)
- Rearranging terms: x^3+5x^2-2x-24 is the same as x^3-2x+5x^2-24
- Distributing step by step vs all at once
- Making a small mistake on one line but correcting it on the next line (self-correction)

EXAMPLES OF ACTUAL ERRORS (that should be flagged):
- Wrong sign that persists: (x+3)(x-2) = x^2+x-6 when it should be x^2+x-6, and the wrong answer is used in subsequent steps
- Wrong coefficient that persists: 2x + 3x = 6x (should be 5x), and 6x is used in the final answer
- Wrong operation: x^2 * x^2 = x^4 written as x^8, and x^8 appears in the final answer

IMPORTANT:
- Carefully verify the algebra step by step
- Be lenient with valid algebraic manipulations
- Look ahead one line to see if errors are self-corrected before flagging them
- Only flag errors that PERSIST and affect the final answer

RESPONSE FORMAT - You MUST respond with ONLY valid JSON, no other text:
If ALL steps are correct:
{"correct": true, "totalLines": ${recognizedLines.length}}

If there IS a mistake:
{"correct": false, "totalLines": ${recognizedLines.length}, "errorLine": <LINE_NUMBER>, "explanation": "<brief explanation of the error>"}

Where <LINE_NUMBER> is the 1-based line number where the FIRST mistake occurs.

IMPORTANT: Respond with ONLY the JSON object. No markdown, no code blocks, no extra text.`,
          },
        ],
      }),
    });

    if (!checkResponse.ok) {
      const errorData = await checkResponse.json().catch(() => ({}));
      console.error("OpenRouter API error (checking):", errorData);
      return res.status(checkResponse.status).json({
        error: (errorData as { error?: { message?: string } }).error?.message || "Failed to check solution",
      });
    }

    const checkData = await checkResponse.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const checkResultRaw = checkData.choices?.[0]?.message?.content?.trim() || "";
    console.log("Check result raw:", checkResultRaw);

    // Parse the JSON response from the model
    let checkResult: { correct: boolean; totalLines: number; errorLine?: number; explanation?: string };

    try {
      // Try to extract JSON from the response (in case the model wraps it in markdown)
      const jsonMatch = checkResultRaw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      checkResult = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Failed to parse check result:", parseError, "Raw:", checkResultRaw);
      return res.status(500).json({ error: "Failed to parse the checking result" });
    }

    // Return the result with the total number of lines for the frontend to use
    res.json({
      correct: checkResult.correct,
      totalLines: recognizedLines.length,
      errorLine: checkResult.errorLine || null,
      explanation: checkResult.explanation || null,
    });

  } catch (error) {
    console.error("Error checking solution:", error);
    res.status(500).json({ error: "Failed to check solution" });
  }
});

export default router;