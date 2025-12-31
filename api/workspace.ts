
import { db } from '@vercel/postgres';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const client = await db.connect();
  
  try {
    // 1. 獲取資料 (GET)
    if (request.method === 'GET') {
      // 獲取最新的一筆紀錄
      const { rows } = await client.sql`
        SELECT content FROM workspace_storage 
        ORDER BY updated_at DESC LIMIT 1
      `;
      
      if (rows.length === 0) {
        return response.status(200).json(null);
      }
      return response.status(200).json(rows[0].content);
    }
    
    // 2. 儲存資料 (POST)
    if (request.method === 'POST') {
      const state = request.body;
      
      // 使用單一 ID 'default' 來維持全局狀態，或者您可以根據 User ID 擴充
      await client.sql`
        INSERT INTO workspace_storage (id, content, updated_at)
        VALUES ('global_state', ${JSON.stringify(state)}, NOW())
        ON CONFLICT (id) 
        DO UPDATE SET content = ${JSON.stringify(state)}, updated_at = NOW()
      `;
      
      return response.status(200).json({ success: true });
    }
    
    return response.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('Database Error:', error);
    return response.status(500).json({ error: (error as Error).message });
  } finally {
    client.release();
  }
}
