import { GoogleGenAI } from "@google/genai";

// 延迟初始化 Gemini Client (避免在没有 API Key 时崩溃)
let ai: GoogleGenAI | null = null;

const getAI = (): GoogleGenAI | null => {
  // Vite 環境變量必須使用 import.meta.env，且必須以 VITE_ 開頭
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  
  if (!apiKey) {
    console.warn('Gemini API Key 未設定，AI 功能將無法使用');
    return null;
  }
  if (!ai) {
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

/**
 * Analyzes student code to provide insights for the teacher.
 */
export const analyzeStudentCode = async (code: string, language: string, assignmentDescription?: string): Promise<string> => {
  if (!code || code.trim().length < 5) return "程式碼太短，無法分析。";

  const client = getAI();
  if (!client) {
    return "AI 分析服務目前無法使用（API Key 未設定）。";
  }

  try {
    const prompt = `
      Act as a senior computer science instructor. Analyze the following ${language} code written by a student.
      ${assignmentDescription ? `Context (Assignment): ${assignmentDescription}` : ''}
      
      Code:
      \`\`\`${language}
      ${code}
      \`\`\`

      Provide a very brief (max 3 sentences) summary in Traditional Chinese (繁體中文) of what the code does and point out any critical logic errors or syntax issues. 
      Do not rewrite the code. Address the teacher.
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "無法生成分析結果。";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "AI 分析服務目前無法使用。";
  }
};

/**
 * Generates a helpful hint for the student without revealing the solution.
 */
export const generateStudentHint = async (code: string, language: string, assignmentDescription: string): Promise<string> => {
  const client = getAI();
  if (!client) {
    return "AI 提示服務目前無法使用（API Key 未設定）。";
  }

  try {
    const prompt = `
      Act as a helpful tutor. The student is working on the following task: "${assignmentDescription}".
      
      Current Code:
      \`\`\`${language}
      ${code}
      \`\`\`

      The student is stuck. Provide a short, encouraging hint in Traditional Chinese (繁體中文) to nudge them in the right direction without writing the code for them.
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "繼續努力！檢查一下你的語法。";
  } catch (error) {
    console.error("Gemini Hint Error:", error);
    return "AI 提示服務目前無法使用。";
  }
};
