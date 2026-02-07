import { Router, Request, Response } from "express";
import axios from "axios";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const WOLFRAM_APP_ID = process.env.WOLFRAM_APP_ID || "";
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
    
    if (!WOLFRAM_APP_ID) {
      return res.status(500).json({ error: "WOLFRAM_APP_ID is not configured on the server" });
    }

    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "OPENROUTER_API_KEY is not configured on the server (needed for handwriting recognition)" });
    }

    const { imageDataUrl } = req.body as { imageDataUrl?: string };

    if (!imageDataUrl) {
      return res.status(400).json({ error: "Missing imageDataUrl in request body" });
    }

    // Step 1: Use OpenRouter/GPT-4 Vision to recognize the handwritten math
    const recognitionResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
                text: "Recognize the handwritten mathematical expression or equation in this image. Respond with ONLY the mathematical expression in plain text format that Wolfram Alpha can understand. DO NOT solve it, just transcribe what you see. Use standard notation: ^ for exponents, * for multiplication, / for division, sqrt() for square root, sin(), cos(), tan() for trig functions, integral() or int() for integrals, d/dx for derivatives. Examples:\n- If you see '2x + 4 = 10', respond with: 2x + 4 = 10\n- If you see '∫x dx', respond with: integrate x dx\n- If you see 'd/dx(x²)', respond with: derivative of x^2\n- If you see 'sin(x) + cos(x)', respond with: sin(x) + cos(x)\n\nIf you cannot recognize valid math, respond with: Could not recognize equation",
              },
            ],
          },
        ],
      }),
    });

    if (!recognitionResponse.ok) {
      const errorData = await recognitionResponse.json().catch(() => ({}));
      console.error("OpenRouter API error:", errorData);
      return res.status(recognitionResponse.status).json({ 
        error: (errorData as { error?: { message?: string } }).error?.message || "Failed to recognize handwriting" 
      });
    }

    const recognitionData = await recognitionResponse.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const recognizedEquation = recognitionData.choices?.[0]?.message?.content?.trim();

    if (!recognizedEquation || recognizedEquation.includes("Could not recognize")) {
      return res.json({ result: "Could not recognize equation" });
    }

    console.log("Recognized equation:", recognizedEquation);

    // Step 2: Use Wolfram Alpha to solve the equation
    try {
      const waResponse = await axios.get("http://api.wolframalpha.com/v2/query", {
        params: {
          input: recognizedEquation,
          appid: WOLFRAM_APP_ID,
          format: "plaintext",
          output: "json",
        },
      });

      const waData = waResponse.data;
      let result = "";
      
      if (waData && waData.queryresult && waData.queryresult.pods) {
        const pods = waData.queryresult.pods;
        
        // Look for solution pods (excluding the input pod)
        const relevantPods = pods.filter((pod: any) => 
          pod.title && 
          !pod.title.includes("Input") &&
          (
            pod.title.includes("Result") || 
            pod.title.includes("Solution") ||
            pod.title.includes("Indefinite integral") ||
            pod.title.includes("Derivative") ||
            pod.title.includes("Simplification") ||
            pod.title.includes("Decimal approximation") ||
            pod.title.includes("Exact result") ||
            pod.title.includes("Alternate form")
          )
        );

        if (relevantPods.length > 0) {
          // Extract plaintext from the first few relevant pods
          for (const pod of relevantPods.slice(0, 3)) {
            if (pod.subpods && pod.subpods.length > 0) {
              for (const subpod of pod.subpods) {
                if (subpod.plaintext) {
                  result += subpod.plaintext + "\n";
                }
              }
            }
          }
        } else {
          // If no specific solution pods, try to get any result pod
          const resultPod = pods.find((pod: any) => 
            pod.title && pod.title.toLowerCase().includes("result")
          );
          
          if (resultPod && resultPod.subpods && resultPod.subpods[0]) {
            result = resultPod.subpods[0].plaintext || "";
          }
        }
      }

      if (!result.trim()) {
        result = "Wolfram Alpha could not solve this expression";
      }

      res.json({ result: result.trim() });
    } catch (waError) {
      console.error("Wolfram Alpha API error:", waError);
      if (axios.isAxiosError(waError) && waError.response) {
        console.error("Wolfram Alpha response:", waError.response.data);
      }
      res.status(500).json({ error: "Failed to solve with Wolfram Alpha" });
    }
  } catch (error) {
    console.error("Error solving equation:", error);
    res.status(500).json({ error: "Failed to solve equation" });
  }
});

export default router;
