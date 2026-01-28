import { getDb } from '../_db';

export const onRequest: PagesFunction = async (context) => {
    const { request, env } = context;
    const sql = getDb(env);
    const method = request.method;

    try {
        switch (method) {
            case 'GET': {
                const rows = await sql`SELECT * FROM todos ORDER BY id ASC`;
                return new Response(JSON.stringify(rows), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            case 'POST': {
                const body: any = await request.json();
                const { title } = body;
                const result = await sql`INSERT INTO todos (title, completed) VALUES (${title}, false) RETURNING *`;
                return new Response(JSON.stringify(result[0]), {
                    status: 201, // 201 Created
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            default:
                return new Response(null, { status: 405, statusText: 'Method Not Allowed' });
        }
    } catch (error) {
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
