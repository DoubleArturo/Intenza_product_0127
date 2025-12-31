
import { db } from '@vercel/postgres';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { username, password } = request.body;
  const client = await db.connect();
  
  try {
    // 確保表結構存在，防止初次部署後直接登入導致的崩潰
    await client.sql`
      CREATE TABLE IF NOT EXISTS workspace_storage (
        id TEXT PRIMARY KEY,
        content JSONB,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 取得目前的雲端狀態
    const { rows } = await client.sql`
      SELECT content FROM workspace_storage 
      WHERE id = 'global_state'
      LIMIT 1
    `;
    
    // 預設緊急帳號
    const fallbackUser = { username: 'admin', password: 'adminx', role: 'admin' };

    let users = [];
    if (rows.length > 0 && rows[0].content) {
      let content = rows[0].content;
      
      // 有些驅動程式版本會將 JSONB 傳回為字串，有些則是物件
      if (typeof content === 'string') {
        try {
          content = JSON.parse(content);
        } catch (e) {
          console.error('Failed to parse content string:', e);
        }
      }
      
      if (content && Array.isArray(content.users)) {
        users = content.users;
      }
    }

    // 優先比對資料庫中的用戶
    const matchedUser = users.find((u: any) => 
      u.username === username && String(u.password) === String(password)
    );

    if (matchedUser) {
      return response.status(200).json({ 
        success: true, 
        user: { id: matchedUser.id, username: matchedUser.username, role: matchedUser.role } 
      });
    }

    // 最後檢查預設帳號
    if (username === fallbackUser.username && password === fallbackUser.password) {
      return response.status(200).json({ 
        success: true, 
        user: { id: 'default-admin', username: 'admin', role: 'admin' } 
      });
    }

    return response.status(401).json({ error: '帳號或密碼不正確' });

  } catch (error) {
    console.error('Login API Critical Error:', error);
    // 即使資料庫掛了，也讓 admin/adminx 能登入進去修復或重新同步
    if (username === 'admin' && password === 'adminx') {
      return response.status(200).json({ 
        success: true, 
        user: { id: 'emergency-admin', username: 'admin', role: 'admin' },
        warning: 'Database connection failed, using local fallback.'
      });
    }
    return response.status(500).json({ error: '伺服器驗證異常', details: (error as Error).message });
  } finally {
    client.release();
  }
}
