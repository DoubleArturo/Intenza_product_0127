
import { db } from '@vercel/postgres';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const client = await db.connect();
  
  try {
    if (request.method === 'GET') {
      const { rows } = await client.sql`SELECT * FROM workspaces`;
      return response.status(200).json(rows);
    }
    
    if (request.method === 'PATCH') {
      const { id, config } = request.body;
      await client.sql`
        UPDATE workspaces SET settings = ${JSON.stringify(config)} WHERE id = ${id}
      `;
      return response.status(200).json({ success: true });
    }
    
    return response.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    return response.status(500).json({ error: (error as Error).message });
  } finally {
    client.release();
  }
}
