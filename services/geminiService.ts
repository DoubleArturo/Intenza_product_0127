import { GoogleGenAI } from "@google/genai";

export const generateDataInsight = async (context: string, data: any): Promise<string> => {
  // Always initialize Gemini with the direct process.env.API_KEY as per the guidelines.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const prompt = `
      您是 INTENZA 的品質保證分析師。請分析以下數據並提供精簡、專業的摘要（最多 3 點）。
      內容：${context}
      數據：${JSON.stringify(data)}
    `;

    // Standard call to generateContent with the model name and prompt.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Directly accessing .text property as recommended by current best practices.
    return response.text || "無法產生洞察。";
  } catch (error) {
    console.error("AI 服務錯誤:", error);
    return "AI 服務暫時無法使用。";
  }
};