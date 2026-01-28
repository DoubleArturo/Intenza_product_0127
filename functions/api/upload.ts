import { put } from '@vercel/blob';

export const onRequestPost: PagesFunction = async (context) => {
    const { request, env } = context;

    try {
        // Check for Token
        const token = env.BLOB_READ_WRITE_TOKEN;
        if (!token) {
            console.error('缺少 BLOB_READ_WRITE_TOKEN 環境變數');
            return new Response(JSON.stringify({
                error: '系統配置錯誤',
                details: '伺服器未設定 BLOB 儲存權杖'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const url = new URL(request.url);
        const filename = url.searchParams.get('filename') || `upload-${Date.now()}`;

        // In Cloudflare Workers, request.body is a ReadableStream which put() supports.
        if (!request.body) {
            return new Response(JSON.stringify({ error: 'No body provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Pass the token explicitly as it might not be in process.env in Workers
        const blob = await put(filename, request.body, {
            access: 'public',
            token: token as string,
        });

        return new Response(JSON.stringify(blob), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[API/UPLOAD] 發生例外狀況:', error);

        return new Response(JSON.stringify({
            error: '檔案上傳失敗',
            details: (error as Error).message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
