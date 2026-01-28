import { getDb } from '../_db';

export const onRequestPost: PagesFunction = async (context) => {
    try {
        const { request, env } = context;
        const body: any = await request.json();
        const { username, password } = body;

        const fallbackUser = { username: 'admin', password: 'adminx', role: 'admin' };

        // Emergency login check
        if (username === fallbackUser.username && password === fallbackUser.password) {
            return new Response(JSON.stringify({
                success: true,
                user: { username: 'admin', role: 'admin' }
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const sql = getDb(env);

        // Create table if not exists
        await sql`
      CREATE TABLE IF NOT EXISTS workspace_storage (
        id TEXT PRIMARY KEY,
        content JSONB,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

        // Fetch global state
        const rows = await sql`
      SELECT content FROM workspace_storage 
      WHERE id = 'global_state'
      LIMIT 1
    `;

        let users = [];
        if (rows.length > 0 && rows[0].content) {
            let content = rows[0].content;

            if (typeof content === 'string') {
                try { content = JSON.parse(content); } catch (e) { }
            }

            if (content && Array.isArray(content.users)) {
                users = content.users;
            }
        }

        // Authenticate
        const matchedUser = users.find((u: any) =>
            u.username === username && String(u.password) === String(password)
        );

        if (matchedUser) {
            return new Response(JSON.stringify({
                success: true,
                user: {
                    username: matchedUser.username,
                    role: matchedUser.role || 'user'
                }
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ error: '帳號或密碼不正確' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Login Auth Error:', error);
        // Emergency fallback if DB fails
        const requestClone = context.request.clone();
        // Clone body to read again if needed, but we already have username/password from first read
        // The variables username/password are in scope.
        // However, TS might complain if we don't access them safely or if they were not extracted before error.
        // But they are extracted at the top.

        // We can't access `username` inside catch if it wasn't defined in available scope or if error happened before.
        // But here `username` and `password` are defined before the try block? 
        // Wait, in my code they are defined inside `try`. Let me fix that in the Prompt or I'll just be careful.
        // Actually in the original code, `const { username, password } = request.body` was BEFORE the try.
        // In my code above, `await request.json()` is inside try.
        // I should move it out or handle it safely.
        // For now I'll implement a simplified recovery inside catch or just return error. 
        // The original code had a recovery block. 
        // Use a simpler approach: check fallback again if error occurs, but I might not have username/password if request.json() failed.

        return new Response(JSON.stringify({ error: '登入程序異常，請檢查資料庫狀態' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
