
import { put } from '@vercel/blob';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const filename = request.query.filename as string || 'file-' + Date.now();
    const blob = await put(filename, request.body, {
      access: 'public',
    });
    
    return response.status(200).json(blob);
  } catch (error) {
    return response.status(500).json({ error: (error as Error).message });
  }
}
