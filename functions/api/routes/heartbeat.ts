import { Hono } from 'hono';
import { Bindings } from '../[[route]]';

const app = new Hono<{ Bindings: Bindings }>();

app.post('/', async (c) => {
    const { username } = await c.req.json();
    if (!username) {
        return c.json({ error: 'Username is required' }, 400);
    }

    const db = c.env.DB;

    try {
        // 1. Get Global State
        const row = await db.prepare("SELECT content FROM workspace_storage WHERE id = 'global_state'").first();

        if (!row) {
            return c.json({ status: 'ok', message: 'No state found' });
        }

        let content: any = row.content;
        if (typeof content === 'string') {
            try { content = JSON.parse(content); } catch (e) { content = {}; }
        }

        const now = Date.now();
        const TIMEOUT_MS = 90000; // 90 seconds

        // Initialize heartbeats
        if (!content.heartbeats) content.heartbeats = {};

        // Update current user heartbeat
        content.heartbeats[username] = now;

        const logs: any[] = content.auditLogs || [];
        let stateChanged = true;

        // 2. Cleanup timeouts
        for (const activeUser in content.heartbeats) {
            const lastHeatbeat = content.heartbeats[activeUser];

            if (now - lastHeatbeat > TIMEOUT_MS) {
                // Timeout detected
                // Find last active session (no logoutTime)
                // Reverse search
                let lastSessionIndex = -1;
                for (let i = logs.length - 1; i >= 0; i--) {
                    if (logs[i].username === activeUser && !logs[i].logoutTime) {
                        lastSessionIndex = i;
                        break;
                    }
                }

                if (lastSessionIndex !== -1) {
                    const session = logs[lastSessionIndex];
                    const loginDate = new Date(session.loginTime);
                    const diffMins = Math.max(1, Math.round((now - loginDate.getTime()) / 60000));

                    logs[lastSessionIndex] = {
                        ...session,
                        logoutTime: new Date(now).toLocaleString(),
                        durationMinutes: diffMins,
                        note: 'Auto-Logout (Heartbeat Timeout)'
                    };
                }

                delete content.heartbeats[activeUser];
            }
        }

        // 3. Update Database
        const jsonString = JSON.stringify(content);
        await db.prepare(`
      UPDATE workspace_storage 
      SET content = ?, updated_at = datetime('now')
      WHERE id = 'global_state'
    `).bind(jsonString).run();

        return c.json({ status: 'ok' });

    } catch (error) {
        console.error('Heartbeat Logic Error:', error);
        return c.json({ error: 'Internal Server Error', details: (error as Error).message }, 500);
    }
});

export default app;
