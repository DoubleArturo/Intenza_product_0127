import { GoogleGenAI } from "@google/genai";

// Always use direct process.env.API_KEY reference for initialization as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateDataInsight = async (context: string, data: any): Promise<string> => {
  // Use process.env.API_KEY directly as per GenAI guidelines
  if (!process.env.API_KEY) {
    return "API Key is missing. Please configure the environment to use Gemini for smart insights. (Simulated Analysis: Data trends show positive durability in DL series, but attention needed on cardio rust resistance.)";
  }

  try {
    const prompt = `
      You are a Quality Assurance Data Analyst for INTENZA, a high-end fitness equipment manufacturer.
      Analyze the following data context and JSON data. 
      Provide a concise, professional executive summary (max 3 bullet points) focusing on quality patterns, potential risks, or distribution highlights.
      
      Context: ${context}
      Data: ${JSON.stringify(data, null, 2)}
    `;

    // Use gemini-3-flash-preview for basic text tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // response.text is a property, not a method
    return response.text || "No insights generated.";
  } catch (error: any) {
    if (error.status === 'RESOURCE_EXHAUSTED' || error.message?.includes('429')) {
      return "Insight generation paused (API quota limit reached). Please try again later.";
    }
    console.warn("Gemini Insight Error:", error);
    return "Unable to generate AI insights at this time.";
  }
};

export const translateText = async (text: string, targetLanguage: 'en' | 'zh'): Promise<string> => {
  if (!process.env.API_KEY) {
    // console.warn("API Key is missing. Returning mock translation.");
    return `[${targetLanguage.toUpperCase()}] ${text}`;
  }
  if (!text || !text.trim()) {
    return "";
  }

  try {
    const targetLangName = targetLanguage === 'en' ? 'English' : 'Traditional Chinese';
    const prompt = `Translate the following text to ${targetLangName}. Return ONLY the translated text, without any additional comments, formatting, or quotation marks.

Text to translate: "${text}"`;

    // Use gemini-3-flash-preview for text translation
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    const translated = response.text?.trim() || text;
    // Clean up response to remove potential quotation marks
    return translated.replace(/^"|"$/g, '');

  } catch (error: any) {
    // Gracefully handle Rate Limits (429) and Server Errors (500)
    if (error.status === 'RESOURCE_EXHAUSTED' || error.message?.includes('429')) {
      console.warn("Gemini Translation Skipped (Quota Exceeded). Using original text.");
      return text;
    }
    console.warn("Gemini Translation Failed:", error.message || error);
    return text; // Fallback to original text on error
  }
};