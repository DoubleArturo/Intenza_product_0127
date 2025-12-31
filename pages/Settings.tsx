
import React, { useState, useRef, useContext, useEffect, useMemo } from 'react';
// Added missing 'Layers' to the lucide-react import list
import { Plus, X, Save, Download, Upload, AlertTriangle, CheckCircle, Pencil, History, Sparkles, Shield, User, Trash2, Eye, EyeOff, Key, Database, HardDrive, Info, Cloud, LogOut, Loader2, Link as LinkIcon, Activity, Layers, BrainCircuit } from 'lucide-react';
import { AppState, LocalizedString, UserAccount } from '../types';
import { LanguageContext } from '../App';
import { api } from '../services/api';

interface SettingsProps {
  seriesList: LocalizedString[];
  onAddSeries: (seriesName: string) => Promise<void>;
  onUpdateSeriesList: (series: LocalizedString[]) => void;
  onRenameSeries: (index: number, newName: string) => void;
  currentAppState: AppState;
  onLoadProject: (state: AppState) => void;
  onUpdateMaxHistory: (steps: number) => void;
  onToggleAiInsights: (enabled: boolean) => void;
  onAddUser: (user: Omit<UserAccount, 'id'>) => void;
  onUpdateUser: (user: UserAccount) => void;
  onDeleteUser: (id: string) => void;
  onSyncCloud: () => Promise<void>;
  onLogout: () => void;
  syncStatus: 'idle' | 'saving' | 'success' | 'error';
}

const Settings: React.FC<SettingsProps> = ({ 
  seriesList, onAddSeries, onUpdateSeriesList, onRenameSeries, 
  currentAppState, onLoadProject, onUpdateMaxHistory, onToggleAiInsights,
  onAddUser, onUpdateUser, onDeleteUser, onSyncCloud, onLogout, syncStatus
}) => {
  const { t } = useContext(LanguageContext);
  const [newSeriesName, setNewSeriesName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTestingBlob, setIsTestingBlob] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  // --- 容量與體積監控邏輯 ---
  const storageStats = useMemo(() => {
    // 1. 估算行數 (Postgres 常用指標)
    const rowCount = 
      (currentAppState.products?.length || 0) + 
      (currentAppState.shipments?.length || 0) + 
      (currentAppState.testers?.length || 0) + 
      (currentAppState.users?.length || 0);
    const rowLimit = 10000;
    const rowPercent = Math.min(100, (rowCount / rowLimit) * 100);

    // 2. 計算 JSON 字串大小 (這是 Vercel Serverless Function 最硬性的 4.5MB 限制)
    const jsonString = JSON.stringify(currentAppState);
    const sizeInBytes = jsonString.length; // 粗略估計 1 char = 1 byte
    const sizeInMB = sizeInBytes / (1024 * 1024);
    const sizeLimitMB = 4.5; // Vercel Body Limit
    const sizePercent = Math.min(100, (sizeInMB / sizeLimitMB) * 100);

    // 3. 掃描舊式 Base64 (優化分析)
    let base64Count = 0;
    let blobFilesCount = 0;
    const analyzeUrl = (url?: string) => {
      if (!url) return;
      if (url.startsWith('data:')) base64Count++;
      else if (url.includes('vercel-storage.com')) blobFilesCount++;
    };

    currentAppState.products?.forEach(p => {
      analyzeUrl(p.imageUrl);
      p.designHistory?.forEach(eco => eco.imageUrls?.forEach(analyzeUrl));
    });

    return { 
      rowCount, rowLimit, rowPercent, 
      sizeInMB, sizeLimitMB, sizePercent,
      base64Count, blobFilesCount 
    };
  }, [currentAppState]);

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleTestBlob = async () => {
    setIsTestingBlob(true);
    try {
      const testFile = new File(["blob connection test"], "test.txt", { type: "text/plain" });
      const url = await api.uploadImage(testFile);
      if (url.includes('vercel-storage.com')) {
        showNotification('Vercel Blob 連線正常！', 'success');
      }
    } catch (err) {
      showNotification('Blob 連線失敗，請檢查 Token 設置', 'error');
    } finally {
      setIsTestingBlob(false);
    }
  };

  const handleDownloadProject = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentAppState, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `intenza-project-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showNotification('專案已導出至本地', 'success');
  };

  const handleAddSeries = async () => {
    if (!newSeriesName.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddSeries(newSeriesName);
      setNewSeriesName('');
      showNotification('系列已新增', 'success');
    } catch (err) {
      showNotification('新增失敗', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const state = JSON.parse(evt.target?.result as string);
        onLoadProject(state);
        showNotification('本地備份已載入', 'success');
      } catch (err) {
        showNotification('JSON 格式無效', 'error');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getProgressColor = (percent: number) => {
    if (percent > 90) return 'bg-red-500';
    if (percent > 70) return 'bg-amber-500';
    return 'bg-indigo-500';
  };

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in space-y-8">
      <header className="border-b border-slate-100 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">System Settings</h1>
          <p className="text-slate-500 mt-1">系統配置、帳號管理與雲端存儲監控。</p>
        </div>
        <button 
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
        >
          <LogOut size={18} /> 登出系統
        </button>
      </header>

      {notification && (
        <div className={`fixed top-8 right-8 px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slide-up z-50 ${
          notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span className="font-medium">{notification.msg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* AI Toggle Section */}
          <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-intenza-50 rounded-xl text-intenza-600">
                      <Sparkles size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">AI 智慧分析功能</h2>
                      <p className="text-sm text-slate-500">啟用後將在數據分析與產品詳情頁顯示由 Gemini AI 產生的洞察摘要。</p>
                    </div>
                </div>
                <button 
                  onClick={() => onToggleAiInsights(!currentAppState.showAiInsights)}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${currentAppState.showAiInsights ? 'bg-intenza-600' : 'bg-slate-200'}`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${currentAppState.showAiInsights ? 'translate-x-7' : 'translate-x-0'}`}
                  />
                </button>
             </div>
          </section>

          {/* User Management */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <Shield className="text-intenza-600" size={20} />
                    <h2 className="text-xl font-bold text-slate-900">帳號管理</h2>
                </div>
                <button 
                  onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }}
                  className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors"
                >
                  <Plus size={16} /> 新增用戶
                </button>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">使用者名稱</th>
                      <th className="px-6 py-4">權限</th>
                      <th className="px-6 py-4">密碼</th>
                      <th className="px-6 py-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentAppState.users?.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                <User size={16} />
                              </div>
                              <span className="font-bold text-slate-700">{user.username}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                             user.role === 'admin' ? 'bg-intenza-100 text-intenza-700' : 'bg-slate-100 text-slate-600'
                           }`}>
                             {user.role}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-2 font-mono text-sm text-slate-400">
                              <span>{showPasswordMap[user.id] ? user.password : '••••••••'}</span>
                              <button onClick={() => setShowPasswordMap(p => ({...p, [user.id]: !p[user.id]}))} className="hover:text-slate-600 transition-colors">
                                {showPasswordMap[user.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                           </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <div className="flex items-center justify-end gap-1">
                              <button onClick={() => { setEditingUser(user); setIsUserModalOpen(true); }} className="p-2 text-slate-400 hover:text-intenza-600 transition-colors rounded-lg hover:bg-white"><Pencil size={16} /></button>
                              <button onClick={() => { if(window.confirm(`確定要刪除用戶 ${user.username}？`)) onDeleteUser(user.id); }} className="p-2 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-white"><Trash2 size={16} /></button>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </section>

          {/* Series Config */}
          <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-2">產品系列配置</h2>
            <div className="flex gap-3 mb-6">
              <input type="text" value={newSeriesName} onChange={(e) => setNewSeriesName(e.target.value)} placeholder="輸入系列名稱..." className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-intenza-500/20 bg-slate-50 text-slate-900" onKeyPress={(e) => e.key === 'Enter' && handleAddSeries()}/>
              <button onClick={handleAddSeries} disabled={isSubmitting} className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:bg-slate-400">
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />} 新增
              </button>
            </div>
            <div className="space-y-3">
              {seriesList.map((series, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 border-slate-100">
                  <span className="font-medium text-slate-700">{t(series)}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { if(window.confirm('確定刪除系列？')) { const nl = [...seriesList]; nl.splice(index,1); onUpdateSeriesList(nl); } }} className="text-slate-400 hover:text-red-600 p-2"><X size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-8">
           {/* Cloud Connection */}
           <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                 <Cloud className="text-intenza-600" size={20} />
                 <h2 className="text-xl font-bold text-slate-900">雲端同步狀態</h2>
              </div>
              <div className="space-y-3">
                  <button 
                    onClick={onSyncCloud}
                    disabled={syncStatus === 'saving'}
                    className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
                      syncStatus === 'saving' ? 'bg-slate-100 text-slate-400' : 'bg-intenza-600 text-white hover:bg-intenza-700 shadow-intenza-600/20'
                    }`}
                  >
                    {syncStatus === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <Cloud size={18} />}
                    {syncStatus === 'saving' ? '正在同步數據...' : '立即同步至 Postgres'}
                  </button>
                  <button onClick={handleTestBlob} disabled={isTestingBlob} className="w-full py-3 rounded-xl font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                    {isTestingBlob ? <Loader2 size={18} className="animate-spin" /> : <Activity size={18} className="text-emerald-500" />}
                    測試 Blob 雲端連線
                  </button>
              </div>
           </section>

           {/* 精確容量監控區塊 */}
           <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                 <h2 className="text-xl font-bold text-slate-900">容量使用率</h2>
                 <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">LIVE</span>
              </div>
              <p className="text-sm text-slate-500 mb-6">監控 Vercel 與 Postgres 資源配額。</p>
              
              <div className="space-y-8">
                {/* 1. 數據量 (JSON 體積) - 這是最關鍵的限制 */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Database size={14} className="text-indigo-500" />
                      專案數據體積
                    </div>
                    <span className={storageStats.sizePercent > 90 ? 'text-red-600' : 'text-slate-400'}>
                      {storageStats.sizeInMB.toFixed(2)} MB / {storageStats.sizeLimitMB} MB
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${getProgressColor(storageStats.sizePercent)}`} 
                      style={{ width: `${storageStats.sizePercent}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                    <span>基於 Vercel Body Limit</span>
                    <span>{Math.round(storageStats.sizePercent)}% 已使用</span>
                  </div>
                </div>

                {/* 2. 資料庫行數 */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Layers size={14} className="text-emerald-500" />
                      資料庫記錄行數
                    </div>
                    <span className="text-slate-400">
                      {storageStats.rowCount.toLocaleString()} / {storageStats.rowLimit.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${getProgressColor(storageStats.rowPercent)}`} 
                      style={{ width: `${storageStats.rowPercent}%` }}
                    ></div>
                  </div>
                </div>

                {/* 3. 媒體文件統計 */}
                <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                   <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Blob CDN</div>
                      <div className="text-lg font-bold text-emerald-600">{storageStats.blobFilesCount} <span className="text-[10px] font-normal text-slate-500">Files</span></div>
                   </div>
                   <div className={`p-3 rounded-xl border ${storageStats.base64Count > 0 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Base64 (需優化)</div>
                      <div className={`text-lg font-bold ${storageStats.base64Count > 0 ? 'text-red-600' : 'text-slate-500'}`}>{storageStats.base64Count} <span className="text-[10px] font-normal text-slate-500">Items</span></div>
                   </div>
                </div>

                {storageStats.base64Count > 0 && (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-start gap-2">
                    <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-800 leading-tight">檢測到內嵌 Base64 數據，這會迅速消耗數據容量。建議重新上傳圖片以自動轉為 Blob 存儲。</p>
                  </div>
                )}
              </div>
           </section>

           {/* Local Backup */}
           <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
             <h2 className="text-xl font-bold text-slate-900 mb-4">專案本地備份</h2>
             <div className="grid grid-cols-1 gap-4">
               <button onClick={handleDownloadProject} className="flex items-center justify-center gap-2 w-full py-2.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-all">
                 <Download size={18} /> 導出 JSON 備份
               </button>
               <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-all">
                 <Upload size={18} /> 載入 JSON 備份
               </button>
               <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportProject} />
             </div>
           </section>
        </div>
      </div>

      {isUserModalOpen && (
        <UserAccountModal 
          isOpen={isUserModalOpen}
          onClose={() => setIsUserModalOpen(false)}
          onSave={(data) => {
            if (editingUser) onUpdateUser({ ...editingUser, ...data } as any);
            else onAddUser(data as any);
            setIsUserModalOpen(false);
          }}
          user={editingUser}
        />
      )}
    </div>
  );
};

const UserAccountModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: (data: Omit<UserAccount, 'id'>) => void;
  user: UserAccount | null;
}> = ({ isOpen, onClose, onSave, user }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'user' as 'admin' | 'user'
  });

  useEffect(() => {
    if (user) {
      setFormData({ username: user.username, password: user.password, role: user.role });
    } else {
      setFormData({ username: '', password: '', role: 'user' });
    }
  }, [user, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-md animate-slide-up overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">{user ? '編輯用戶' : '新增系統用戶'}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
           <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">使用者名稱</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="text" required value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-intenza-500/20 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">密碼</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="text" required value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-intenza-500/20 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">權限角色</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                   <button type="button" onClick={() => setFormData({ ...formData, role: 'admin' })} className={`py-2 text-xs font-bold rounded-md transition-all ${formData.role === 'admin' ? 'bg-white shadow text-intenza-600' : 'text-slate-500'}`}>Admin</button>
                   <button type="button" onClick={() => setFormData({ ...formData, role: 'user' })} className={`py-2 text-xs font-bold rounded-md transition-all ${formData.role === 'user' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Standard</button>
                </div>
              </div>
           </div>
           <div className="pt-4 flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-2 text-slate-600 font-bold hover:bg-slate-50 rounded-lg">取消</button>
              <button type="submit" className="flex-1 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10">確認</button>
           </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
