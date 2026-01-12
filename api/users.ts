
import { db } from '@vercel/postgres';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { username, password } = request.body;
  const client = await db.connect();
  
  try {
    // 建立表結構（保險機制）
    await client.sql`
      CREATE TABLE IF NOT EXISTS workspace_storage (
        id TEXT PRIMARY KEY,
        content JSONB,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 取得資料庫內容
    const { rows } = await client.sql`
      SELECT content FROM workspace_storage 
      WHERE id = 'global_state'
      LIMIT 1
    `;
    
    // 預設緊急後門
    const fallbackUser = { username: 'admin', password: 'adminx', role: 'admin' };

    let users = [];
    if (rows.length > 0 && rows[0].content) {
      let content = rows[0].content;
      
      // 處理資料庫回傳格式差異
      if (typeof content === 'string') {
        try { content = JSON.parse(content); } catch (e) {}
      }
      
      if (content && Array.isArray(content.users)) {
        users = content.users;
      }
    }

    // 1. 比對自定義用戶
    const matchedUser = users.find((u: any) => 
      u.username === username && String(u.password) === String(password)
    );

    if (matchedUser) {
      return response.status(200).json({ 
        success: true, 
        user: { 
          username: matchedUser.username, 
          role: matchedUser.role || 'user' 
        } 
      });
    }

    // 2. 比對預設 Admin
    if (username === fallbackUser.username && password === fallbackUser.password) {
      return response.status(200).json({ 
        success: true, 
        user: { 
          username: 'admin', 
          role: 'admin' 
        } 
      });
    }

    return response.status(401).json({ error: '帳號或密碼不正確' });

  } catch (error) {
    console.error('Login Auth Error:', error);
    // 異常時的救援登入
    if (username === 'admin' && password === 'adminx') {
      return response.status(200).json({ 
        success: true, 
        user: { username: 'admin', role: 'admin' },
        warning: 'DB Connection Error, using safe mode.'
      });
    }
    return response.status(500).json({ error: '登入程序異常' });
  } finally {
    client.release();
  }
}
