
import { GoogleGenAI } from "@google/genai";

/**
 * Fix: Use process.env.API_KEY directly for initialization as per guidelines.
 */
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const generateDataInsight = async (context: string, data: any): Promise<string> => {
  const ai = getAI();
  try {
    const prompt = `
      您是 INTENZA 的品質保證分析師。請分析以下數據並提供精簡、專業的摘要（最多 3 點）。
      內容：${context}
      數據：${JSON.stringify(data)}
    `;

    /**
     * Fix: simplified generateContent call using string input for prompt to match recommended task implementation.
     */
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "無法產生洞察。";
  } catch (error) {
    console.error("AI 服務錯誤:", error);
    return "AI 服務暫時無法使用。";
  }
};
