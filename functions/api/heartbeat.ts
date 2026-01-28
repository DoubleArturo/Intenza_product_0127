import { getDb } from '../_db';

export const onRequestPost: PagesFunction = async (context) => {
    try {
        const { request, env } = context;
        const body: any = await request.json();
        const { username } = body;

        if (!username) {
            return new Response(JSON.stringify({ error: 'Username is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const sql = getDb(env);

        // 1. Get global state
        const rows = await sql`
      SELECT content FROM workspace_storage 
      WHERE id = 'global_state'
      LIMIT 1
    `;

        if (rows.length === 0) {
            return new Response(JSON.stringify({ status: 'ok', message: 'No state found' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        let content = rows[0].content;
        const now = Date.now();
        const TIMEOUT_MS = 90000; // 90 seconds timeout

        // Init heartbeat tracking
        if (!content.heartbeats) content.heartbeats = {};

        // Update current user heartbeat
        content.heartbeats[username] = now;

        const logs = content.auditLogs || [];
        let stateChanged = true;

        // 2. Cleanup timed out users
        for (const activeUser in content.heartbeats) {
            const lastHeatbeat = content.heartbeats[activeUser];

            if (now - lastHeatbeat > TIMEOUT_MS) {
                // Timeout detected, logout user
                const lastSessionIndex = [...logs].reverse().findIndex((l: any) => l.username === activeUser && !l.logoutTime);

                if (lastSessionIndex !== -1) {
                    const actualIndex = logs.length - 1 - lastSessionIndex;
                    const loginDate = new Date(logs[actualIndex].loginTime);
                    const diffMins = Math.max(1, Math.round((now - loginDate.getTime()) / 60000));

                    logs[actualIndex] = {
                        ...logs[actualIndex],
                        logoutTime: new Date(now).toLocaleString(),
                        durationMinutes: diffMins,
                        note: 'Auto-Logout (Heartbeat Timeout)'
                    };
                }

                // Remove heartbeat record
                delete content.heartbeats[activeUser];
            }
        }

        // 3. Update DB
        const jsonString = JSON.stringify(content);
        await sql`
      UPDATE workspace_storage 
      SET content = ${jsonString}::jsonb, updated_at = NOW() 
      WHERE id = 'global_state'
    `;

        return new Response(JSON.stringify({ status: 'ok' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Heartbeat Logic Error:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
