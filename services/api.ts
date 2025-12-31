
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
    const response = await fetch('/api/workspace', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(state),
    });

    if (!response.ok) {
        if (response.status === 413) {
           throw new Error('資料體積過大 (圖片過多)，請減少附件數量再試。');
        }
        const errorText = await response.text();
        throw new Error(`同步失敗 (${response.status}): ${errorText.substring(0, 50)}`);
    }
  }
};
