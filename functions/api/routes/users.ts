import { Hono } from 'hono';
import { Bindings } from '../[[route]]';

const app = new Hono<{ Bindings: Bindings }>();

app.post('/', async (c) => {
    const { username, password } = await c.req.json();
    const db = c.env.DB;

    try {
        // Fallback/Backdoor
        const fallbackUser = { username: 'admin', password: 'adminx', role: 'admin' };
        if (username === fallbackUser.username && password === fallbackUser.password) {
            return c.json({
                success: true,
                user: { username: 'admin', role: 'admin' }
            });
        }

        // Ensure table exists (SQLite)
        await db.prepare(`
      CREATE TABLE IF NOT EXISTS workspace_storage (
        id TEXT PRIMARY KEY,
        content TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

        // Get Global State
        const row = await db.prepare("SELECT content FROM workspace_storage WHERE id = 'global_state'").first();

        let users: any[] = [];
        if (row && row.content) {
            let content: any = row.content;
            // Parse JSON if it's a string (D1 stores JSON as text)
            if (typeof content === 'string') {
                try { content = JSON.parse(content); } catch (e) { }
            }

            if (content && Array.isArray(content.users)) {
                users = content.users;
            }
        }

        // Match User
        const matchedUser = users.find((u: any) =>
            u.username === username && String(u.password) === String(password)
        );

        if (matchedUser) {
            return c.json({
                success: true,
                user: {
                    username: matchedUser.username,
                    role: matchedUser.role || 'user'
                }
            });
        }

        return c.json({ error: '帳號或密碼不正確' }, 401);

    } catch (error) {
        console.error('Login Auth Error:', error);
        // Emergency Mode
        if (username === 'admin' && password === 'adminx') {
            return c.json({
                success: true,
                user: { username: 'admin', role: 'admin' },
                warning: 'DB Connection Error, using safe mode.'
            });
        }
        return c.json({ error: '登入程序異常，請檢查資料庫狀態', details: (error as Error).message }, 500);
    }
});

export default app;
