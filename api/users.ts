
import { db } from '@vercel/postgres';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const client = await db.connect();
  
  try {
    if (request.method === 'GET') {
      const { rows } = await client.sql`SELECT * FROM users ORDER BY created_at DESC`;
      return response.status(200).json({ users: rows });
    }
    
    if (request.method === 'POST') {
      const { name, email } = request.body;
      const { rows } = await client.sql`
        INSERT INTO users (name, email) 
        VALUES (${name}, ${email}) 
        RETURNING *
      `;
      return response.status(201).json(rows[0]);
    }

    return response.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    return response.status(500).json({ error: (error as Error).message });
  } finally {
    client.release();
  }
}
