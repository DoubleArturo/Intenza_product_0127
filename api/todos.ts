
import { db } from '@vercel/postgres';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const client = await db.connect();
  
  try {
    const { method } = request;
    
    switch (method) {
      case 'GET':
        const { rows } = await client.sql`SELECT * FROM todos ORDER BY id ASC`;
        return response.status(200).json(rows);
      case 'POST':
        const { title } = request.body;
        const result = await client.sql`INSERT INTO todos (title, completed) VALUES (${title}, false) RETURNING *`;
        return response.status(201).json(result.rows[0]);
      default:
        return response.status(405).end();
    }
  } catch (error) {
    return response.status(500).json({ error: (error as Error).message });
  } finally {
    client.release();
  }
}
