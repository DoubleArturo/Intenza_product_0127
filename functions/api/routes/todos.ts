import { Hono } from 'hono';
import { Bindings } from '../[[route]]';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', async (c) => {
    try {
        const { results } = await c.env.DB.prepare('SELECT * FROM todos ORDER BY id ASC').all();
        return c.json(results);
    } catch (e) {
        return c.json({ error: (e as Error).message }, 500);
    }
});

app.post('/', async (c) => {
    const { title } = await c.req.json();
    try {
        // Ensure table exists
        await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        completed INTEGER DEFAULT 0
      )
    `).run();

        const result = await c.env.DB.prepare(
            'INSERT INTO todos (title, completed) VALUES (?, 0) RETURNING *'
        ).bind(title).first();

        return c.json(result, 201);
    } catch (e) {
        return c.json({ error: (e as Error).message }, 500);
    }
});

export default app;
