
import { put } from '@vercel/blob';
import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function 配置
 * 必須停用 bodyParser 才能正確處理圖片、影片等原始二進制數據流
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  // 僅允許 POST 請求
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 檢查 Vercel Blob Token 是否存在（這是 500 錯誤的常見原因）
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('缺少 BLOB_READ_WRITE_TOKEN 環境變數');
      return response.status(500).json({ 
        error: '系統配置錯誤', 
        details: '伺服器未設定 BLOB 儲存權杖' 
      });
    }

    const filename = request.query.filename as string || `upload-${Date.now()}`;
    
    // 由於停用了 bodyParser，我們直接將 request (IncomingMessage) 傳入 put
    // @vercel/blob 的 put 函數會直接讀取 request stream 並上傳至雲端
    const blob = await put(filename, request, {
      access: 'public',
    });
    
    return response.status(200).json(blob);
  } catch (error) {
    // 將詳細錯誤記錄在 Vercel Log 中以便調試
    console.error('[API/UPLOAD] 發生例外狀況:', error);
    
    return response.status(500).json({ 
      error: '檔案上傳失敗', 
      details: (error as Error).message 
    });
  }
}
