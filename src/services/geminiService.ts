import { GoogleGenAI } from "@google/genai";
import { proposeFileRenamesTool, RenameSuggestion } from "../lib/drive-service";

let aiInstance: GoogleGenAI | null = null;

/**
 * Initializes or updates the Gemini AI instance with the provided API key.
 * @param apiKey The Gemini API key.
 */
export function initGemini(apiKey: string) {
  if (apiKey) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
}

/**
 * Gets the Gemini AI instance, initializing it with the environment variable if not already set.
 * @returns The GoogleGenAI instance.
 */
function getAi() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY || "";
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export interface FileSuggestion {
  id: string;
  originalName: string;
  proposedName: string;
  reasoning: string;
}

/**
 * Wraps an API call with automatic retries for 503 Overloaded errors.
 */
async function fetchWithRetry<T>(apiCallFn: () => Promise<T>, maxRetries = 3, initialDelayMs = 1000): Promise<T> {
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCallFn();
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes("503") || errorMessage.includes("UNAVAILABLE") || errorMessage.includes("high demand")) {
        console.warn(`Gemini API busy. Retrying in ${delay}ms... (Attempt ${attempt} of ${maxRetries})`);
        
        if (attempt === maxRetries) {
          throw new Error("Gemini is currently overloaded. Please try again in a few minutes.");
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }
  throw new Error("Unexpected retry failure");
}

export async function getRenameSuggestions(
  files: { id: string; name: string; content?: string }[],
  intent: string
): Promise<FileSuggestion[]> {
  if (files.length === 0) return [];

  const ai = getAi();
  const prompt = `
    Analyze the following list of Google Drive files and suggest logical, clean, and professional new names based on this intent: "${intent}".
    
    For files where content is provided, use that information (like dates, invoice numbers, or project names found inside the document) to make more accurate suggestions.
    
    Files:
    ${files.map((f) => `- ID: ${f.id}\n  Current Name: ${f.name}${f.content ? `\n  Extracted Content: ${f.content}` : "\n  Extracted Content: [No content available for this file]"}`).join("\n")}
    
    CRITICAL: For PDF files, look specifically for dates (e.g., "Date: 10/25/2023"), invoice numbers, or vendor names within the "Extracted Content" section to fulfill the user's intent.
  `;

  try {
    console.log("Calling Gemini with prompt:", prompt);
    
    const response = await fetchWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ functionDeclarations: [proposeFileRenamesTool] }],
      },
    }));

    console.log("Gemini raw response:", response);

    // Handle function calls
    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      console.log("Function calls detected:", functionCalls);
      const call = functionCalls[0];
      if (call.name === "proposeFileRenames") {
        const args = call.args as any;
        console.log("Function call args:", args);
        return args.fileList.map((f: RenameSuggestion) => ({
          id: f.fileId,
          originalName: f.currentName,
          proposedName: f.proposedName,
          reasoning: f.reasoning
        }));
      }
    } else {
      console.warn("No function calls in Gemini response. Text output:", response.text);
    }

    return [];
  } catch (error) {
    console.error("Error in getRenameSuggestions:", error);
    throw error;
  }
}
