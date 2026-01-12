
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
    
    // 2. 儲存資料 (POST) - 部分更新 (Partial Update)
    if (request.method === 'POST') {
      const partialState = request.body;
      
      if (!partialState || typeof partialState !== 'object') {
        return response.status(400).json({ error: 'Payload must be a JSON object' });
      }

      const jsonString = JSON.stringify(partialState);
      
      // 檢查體積 (Vercel Postgres 單一欄位限制約 4.5MB)
      if (jsonString.length > 4 * 1024 * 1024) {
         return response.status(413).json({ error: 'Payload too large. Please optimize image sizes.' });
      }

      /**
       * 使用 jsonb_merge_patch 實現「合併更新」。
       * 此方法只會更新傳入的 top-level 鍵值，保留資料庫中其餘未傳入的資料。
       */
      await client.sql`
        INSERT INTO workspace_storage (id, content, updated_at)
        VALUES ('global_state', ${jsonString}::jsonb, NOW())
        ON CONFLICT (id) 
        DO UPDATE SET 
          content = jsonb_merge_patch(COALESCE(workspace_storage.content, '{}'::jsonb), ${jsonString}::jsonb), 
          updated_at = NOW()
      `;
      
      return response.status(200).json({ success: true });
    }
    
    return response.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('Database Operation Failed:', error);
    return response.status(500).json({ 
      error: 'Database sync error', 
      details: (error as Error).message 
    });
  } finally {
    client.release();
  }
}
