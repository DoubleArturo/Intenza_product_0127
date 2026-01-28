import { Hono } from 'hono';
import { Bindings } from '../[[route]]';

const app = new Hono<{ Bindings: Bindings }>();

app.post('/', async (c) => {
    const filename = c.req.query('filename') || `upload-${Date.now()}`;
    const bucket = c.env.BUCKET;

    if (!bucket) {
        return c.json({ error: 'Storage Configuration Error', details: 'R2 Bucket not bound' }, 500);
    }

    try {
        // Cloudflare Workers allow streaming request body directly to R2
        // options: { httpMetadata: { contentType: ... } } could be added if headers are present
        const object = await bucket.put(filename, c.req.raw.body);

        if (!object) {
            throw new Error('Upload failed');
        }

        // Construct a public URL (Assuming R2 is connected to a domain or using correct standard)
        // Note: You need to enable "Public Access" or connect a domain to R2 bucket
        // For now, we return the key.
        return c.json({
            url: `/r2/${object.key}`, // Placeholder: Adjust this based on your R2 public domain setup
            pathname: object.key,
            contentType: object.httpMetadata?.contentType,
            size: object.size,
            uploadedAt: object.uploaded,
        });
    } catch (error) {
        console.error('[API/UPLOAD] R2 Error:', error);
        return c.json({ error: '檔案上傳失敗', details: (error as Error).message }, 500);
    }
});

export default app;
