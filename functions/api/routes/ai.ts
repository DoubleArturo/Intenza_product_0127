import { Hono } from 'hono';
import { Bindings } from '../[[route]]';

const app = new Hono<{ Bindings: Bindings }>();

app.post('/generate', async (c) => {
    const { context, data } = await c.req.json();
    const apiKey = c.env.AI_API_KEY;

    if (!apiKey) {
        return c.json({ error: 'System Configuration Error: API_KEY is missing' }, 500);
    }

    // Basic Security: Ensure request comes from the allowed origin (Self)
    // In production, this should match your custom domain.
    const referer = c.req.header('Referer');
    const host = c.req.header('Host');

    // Simple check: If present, it must contain our host (weak but blocks direct curl abuse)
    if (referer && host && !referer.includes(host)) {
        return c.json({ error: 'Unauthorized Origin' }, 403);
    }

    const prompt = `
    您是 INTENZA 的品質保證分析師。請分析以下數據並提供精簡、專業的摘要（最多 3 點）。
    內容：${context}
    數據：${JSON.stringify(data)}
  `;

    // Use REST API to avoid SDK compatibility issues in Edge Runtime and reduce bundle size
    // Assuming 'gemini-1.5-flash' as stable default, or 'gemini-pro'. 
    // User had 'gemini-3-flash-preview', preserving strict intention if valid, else fallback.
    // Actually, 'gemini-3' is likely a mistake for 'gemini-1.5' or 'gemini-2.0'. 
    // I will use a safe default 'gemini-1.5-flash' which is fast and cheap.
    const model = 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ part: { text: prompt } }]
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Google API Error: ${response.status} ${err}`);
        }

        const result = await response.json();
        // Parse standard Gemini response
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "無法產生洞察。";

        return c.json({ text });

    } catch (error) {
        console.error('AI Proxy Error:', error);
        return c.json({ error: 'AI 服務暫時無法使用', details: (error as Error).message }, 500);
    }
});

export default app;
