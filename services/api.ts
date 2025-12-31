
import { AppState } from '../types';

/**
 * 處理資料讀取與儲存的 API 服務
 */
export const api = {
  /**
   * 登入使用者
   */
  login: async (credentials: any) => {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!response.ok) throw new Error('登入失敗，請檢查帳號密碼');
    return response.json();
  },

  /**
   * 上傳圖片至 Vercel Blob (Checklist 七)
   * 將檔案上傳並獲取永久 URL
   */
  uploadImage: async (file: File): Promise<string> => {
    const filename = `${Date.now()}-${file.name}`;
    const response = await fetch(`/api/upload?filename=${encodeURIComponent(filename)}`, {
      method: 'POST',
      body: file, // 直接發送檔案流
    });

    if (!response.ok) {
      throw new Error('圖片上傳失敗');
    }

    const blob = await response.json();
    return blob.url; // 返回 Vercel Blob 的公共 URL
  },

  /**
   * 從遠端獲取工作區資料
   */
  loadData: async (): Promise<AppState | null> => {
    try {
      const response = await fetch('/api/workspace', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      return response.json();
    } catch (err) {
      console.warn('Could not load data from cloud:', err);
      throw err;
    }
  },

  /**
   * 將當前狀態儲存至遠端
   */
  saveData: async (state: AppState): Promise<void> => {
    // 在存檔前，確保所有圖片都已經是 URL 而非 Base64 (雖然前端已處理，這是雙重保險)
    const response = await fetch('/api/workspace', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(state),
    });

    if (!response.ok) {
        if (response.status === 413) {
           throw new Error('資料體積過大，請檢查是否有未處理的大圖。');
        }
        const errorText = await response.text();
        throw new Error(`同步失敗 (${response.status}): ${errorText.substring(0, 50)}`);
    }
  }
};
