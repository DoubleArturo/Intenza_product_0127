import { db } from '@vercel/postgres';
import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Heartbeat Handler
 * 目的：追蹤使用者在線狀態，並自動登出斷開連線超過 90 秒的用戶。
 */
export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { username } = request.body;
  if (!username) {
    return response.status(400).json({ error: 'Username is required' });
  }

  const client = await db.connect();
  
  try {
    // 1. 取得當前全局狀態
    const { rows } = await client.sql`
      SELECT content FROM workspace_storage 
      WHERE id = 'global_state'
      LIMIT 1
    `;
    
    if (rows.length === 0) {
      return response.status(200).json({ status: 'ok', message: 'No state found' });
    }

    let content = rows[0].content;
    const now = Date.now();
    const TIMEOUT_MS = 90000; // 90 秒逾時

    // 初始化心跳追蹤
    if (!content.heartbeats) content.heartbeats = {};
    
    // 更新當前使用者心跳
    content.heartbeats[username] = now;

    const logs = content.auditLogs || [];
    let stateChanged = true; // 至少心跳時間變了

    // 2. 遍歷所有心跳，清理逾時用戶
    for (const activeUser in content.heartbeats) {
      const lastHeatbeat = content.heartbeats[activeUser];
      
      if (now - lastHeatbeat > TIMEOUT_MS) {
        // 偵測到逾時！執行登出邏輯
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
        
        // 移除心跳記錄
        delete content.heartbeats[activeUser];
      }
    }

    // 3. 更新資料庫
    const jsonString = JSON.stringify(content);
    await client.sql`
      UPDATE workspace_storage 
      SET content = ${jsonString}::jsonb, updated_at = NOW() 
      WHERE id = 'global_state'
    `;

    return response.status(200).json({ status: 'ok' });

  } catch (error) {
    console.error('Heartbeat Logic Error:', error);
    return response.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
}
