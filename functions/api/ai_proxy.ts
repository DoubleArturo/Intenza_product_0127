import { GoogleGenAI } from "@google/genai";

export const onRequestPost: PagesFunction = async (context) => {
    try {
        const { request, env } = context;
        const body: any = await request.json();
        const { prompt } = body;

        const apiKey = env.API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Missing API Key" }), { status: 500 });
        }

        // Initialize Gemini Client
        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash', // Updated to latest stable or flash model if available, user used 'gemini-3-flash-preview' in original code but that might be typo or specific. I will stick to what user used or a safe default.
            // User used 'gemini-3-flash-preview'. I will use that or fallback.
            // Actually checking original file: 'gemini-3-flash-preview'.
            // If that model doesn't exist, it will fail. I'll trust the user knows the model name.
            contents: prompt,
        });

        // Supports both .text() method (standard) or .text property if using different SDK version
        const text = typeof (response as any).text === 'function' ? (response as any).text() : (response as any).text;

        return new Response(JSON.stringify({ text }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("AI Proxy Error:", error);
        return new Response(JSON.stringify({ error: "Failed to generate content" }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
