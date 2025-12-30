
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
  loadData: async (): Promise<AppState> => {
    const response = await fetch('/api/workspace', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('無法載入遠端資料');
    return response.json();
  },

  /**
   * 將當前狀態儲存至遠端
   */
  saveData: async (state: AppState): Promise<void> => {
    const response = await fetch('/api/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    if (!response.ok) throw new Error('資料同步至伺服器失敗');
  }
};
