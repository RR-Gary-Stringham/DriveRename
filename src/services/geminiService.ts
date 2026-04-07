import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface FileSuggestion {
  id: string;
  originalName: string;
  proposedName: string;
  reasoning: string;
}

const proposeFileRenamesTool: FunctionDeclaration = {
  name: "proposeFileRenames",
  description: "Analyzes a list of Google Drive files and returns a structured list of suggested new names along with the necessary Apps Script CardService UI code for user approval.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      fileList: {
        type: Type.ARRAY,
        description: "The list of files currently selected or found in the folder.",
        items: {
          type: Type.OBJECT,
          properties: {
            fileId: {
              type: Type.STRING,
              description: "The unique Google Drive ID of the file."
            },
            currentName: {
              type: Type.STRING,
              description: "The current filename including extension."
            },
            proposedName: {
              type: Type.STRING,
              description: "The suggested new filename."
            },
            reasoning: {
              type: Type.STRING,
              description: "The reason for this specific name suggestion."
            }
          },
          required: ["fileId", "currentName", "proposedName", "reasoning"]
        }
      },
      namingConvention: {
        type: Type.STRING,
        description: "Optional user preference for naming (e.g., 'Professional', 'ISO Date format', 'Short')."
      }
    },
    required: ["fileList"]
  }
};

export async function getRenameSuggestions(
  files: { id: string; name: string }[],
  intent: string
): Promise<FileSuggestion[]> {
  if (files.length === 0) return [];

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
        return args.fileList.map((f: any) => ({
          id: f.fileId,
          originalName: f.currentName,
          proposedName: f.proposedName,
          reasoning: f.reasoning
        }));
      }
    }

    // Fallback to JSON parsing if no function call was made (though we requested it)
    try {
      const result = JSON.parse(response.text || '{"suggestions": []}');
      if (result.suggestions) return result.suggestions;
    } catch (e) {
      console.warn("Failed to parse fallback JSON", e);
    }

    return [];
  } catch (error) {
    console.error("Error getting suggestions:", error);
    throw error;
  }
}
