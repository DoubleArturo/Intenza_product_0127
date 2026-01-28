import { Hono } from 'hono';
import { Bindings } from '../[[route]]';

const app = new Hono<{ Bindings: Bindings }>();

// Helper to ensure table exists
async function ensureTable(db: D1Database) {
    await db.prepare(`
    CREATE TABLE IF NOT EXISTS workspace_storage (
      id TEXT PRIMARY KEY,
      content TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

app.get('/', async (c) => {
    const db = c.env.DB;
    await ensureTable(db);

    const row = await db.prepare("SELECT content FROM workspace_storage WHERE id = 'global_state'").first();

    if (!row) {
        return c.json(null);
    }

    let content = row.content;
    if (typeof content === 'string') {
        try { content = JSON.parse(content); } catch (e) { content = {}; }
    }

    return c.json(content);
});

app.post('/', async (c) => {
    const partialState = await c.req.json();
    const db = c.env.DB;

    if (!partialState || typeof partialState !== 'object' || Array.isArray(partialState)) {
        return c.json({ error: 'Payload must be a JSON object' }, 400);
    }

    const jsonString = JSON.stringify(partialState);
    if (jsonString.length > 4 * 1024 * 1024) {
        return c.json({ error: 'Payload too large.' }, 413);
    }

    try {
        await ensureTable(db);

        // D1/SQLite doesn't have JSONB merge (||), so we do Read-Modify-Write
        // Note: In high concurrency, this has a race condition. 
        // For a strict lock, Durable Objects are recommended, but D1 is fast enough for this MVP.

        const current = await db.prepare("SELECT content FROM workspace_storage WHERE id = 'global_state'").first();
        let currentContent: any = {};
        if (current && typeof current.content === 'string') {
            try { currentContent = JSON.parse(current.content); } catch (e) { }
        }

        // Merge: Top-level merge (Postgres || equivalent)
        const newContent = { ...currentContent, ...partialState };
        const newContentStr = JSON.stringify(newContent);

        // Upsert
        await db.prepare(`
      INSERT INTO workspace_storage (id, content, updated_at)
      VALUES ('global_state', ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
      content = ?,
      updated_at = datetime('now')
    `).bind(newContentStr, newContentStr).run();

        return c.json({ success: true });

    } catch (error) {
        console.error('Database Operation Failed:', error);
        return c.json({ error: 'Database sync error', details: (error as Error).message }, 500);
    }
});

export default app;
