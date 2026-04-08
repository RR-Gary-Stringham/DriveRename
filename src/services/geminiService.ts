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

export async function getRenameSuggestions(
  files: { id: string; name: string }[],
  intent: string
): Promise<FileSuggestion[]> {
  if (files.length === 0) return [];

  const ai = getAi();
  const prompt = `
    Analyze the following list of Google Drive files and suggest logical, clean, and professional new names based on this intent: "${intent}".
    
    Files:
    ${files.map((f) => `- ID: ${f.id}, Name: ${f.name}`).join("\n")}
    
    Use the 'proposeFileRenames' tool to provide your suggestions.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ functionDeclarations: [proposeFileRenamesTool] }],
      },
    });

    // Handle function calls
    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      if (call.name === "proposeFileRenames") {
        const args = call.args as any;
        return args.fileList.map((f: RenameSuggestion) => ({
          id: f.fileId,
          originalName: f.currentName,
          proposedName: f.proposedName,
          reasoning: f.reasoning
        }));
      }
    }

    return [];
  } catch (error) {
    console.error("Error getting suggestions:", error);
    throw error;
  }
}
