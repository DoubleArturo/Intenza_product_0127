export const generateDataInsight = async (context: string, data: any): Promise<string> => {
  try {
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ context, data })
    });

    if (!response.ok) {
      throw new Error(`AI Request Failed: ${response.status}`);
    }

    const result = await response.json() as { text?: string };
    return result.text || "無法產生洞察。";
  } catch (error) {
    console.error("AI 服務錯誤:", error);
    return "AI 服務暫時無法使用。";
  }
};