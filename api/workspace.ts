
import { db } from '@vercel/postgres';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const client = await db.connect();
  
  try {
    // 確保表結構存在
    await client.sql`
      CREATE TABLE IF NOT EXISTS workspace_storage (
        id TEXT PRIMARY KEY,
        content JSONB,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 1. 獲取資料 (GET)
    if (request.method === 'GET') {
      const { rows } = await client.sql`
        SELECT content FROM workspace_storage 
        WHERE id = 'global_state'
        LIMIT 1
      `;
      
      if (rows.length === 0) {
        return response.status(200).json(null);
      }
      return response.status(200).json(rows[0].content);
    }
    
    // 2. 儲存資料 (POST)
    if (request.method === 'POST') {
      const state = request.body;
      
      if (!state) {
        return response.status(400).json({ error: 'Payload is empty' });
      }

      const jsonString = JSON.stringify(state);
      
      // 檢查體積 (Vercel Postgres 有單一欄位限制，Serverless Function 有 4.5MB 限制)
      if (jsonString.length > 4 * 1024 * 1024) {
         return response.status(413).json({ error: 'Payload too large. Try reducing image sizes.' });
      }

      await client.sql`
        INSERT INTO workspace_storage (id, content, updated_at)
        VALUES ('global_state', ${jsonString}, NOW())
        ON CONFLICT (id) 
        DO UPDATE SET content = ${jsonString}, updated_at = NOW()
      `;
      
      return response.status(200).json({ success: true });
    }
    
    return response.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('Database Operation Failed:', error);
    return response.status(500).json({ 
      error: 'Database error', 
      details: (error as Error).message 
    });
  } finally {
    client.release();
  }
}
