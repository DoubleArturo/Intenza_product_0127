import { getDb } from '../_db';

export const onRequest: PagesFunction = async (context) => {
    const { request, env } = context;
    const sql = getDb(env);
    const method = request.method;

    try {
        // Ensure table exists
        await sql`
      CREATE TABLE IF NOT EXISTS workspace_storage (
        id TEXT PRIMARY KEY,
        content JSONB,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

        // 1. GET Data
        if (method === 'GET') {
            const rows = await sql`
        SELECT content FROM workspace_storage 
        WHERE id = 'global_state'
        LIMIT 1
      `;

            if (rows.length === 0) {
                return new Response(JSON.stringify(null), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            return new Response(JSON.stringify(rows[0].content), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 2. SAVE Data (POST) - Partial Update
        if (method === 'POST') {
            const partialState = await request.json();

            if (!partialState || typeof partialState !== 'object' || Array.isArray(partialState)) {
                return new Response(JSON.stringify({ error: 'Payload must be a JSON object' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const jsonString = JSON.stringify(partialState);

            // Check payload size (Cloudflare Workers have 100MB+ limit usually but DB column might have limits, keep 4MB check)
            if (jsonString.length > 4 * 1024 * 1024) {
                return new Response(JSON.stringify({ error: 'Payload too large. Please optimize image sizes.' }), {
                    status: 413,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            /**
             * Use JSONB merge operator (||)
             * Note: In postgres.js, template variables are parameterized.
             * Casting expected: ${ value }::jsonb
             */
            await sql`
        INSERT INTO workspace_storage (id, content, updated_at)
        VALUES ('global_state', ${jsonString}::jsonb, NOW())
        ON CONFLICT (id) 
        DO UPDATE SET 
          content = COALESCE(workspace_storage.content, '{}'::jsonb) || ${jsonString}::jsonb, 
          updated_at = NOW();
      `;

            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Database Operation Failed:', error);
        return new Response(JSON.stringify({
            error: 'Database sync error',
            details: (error as Error).message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
