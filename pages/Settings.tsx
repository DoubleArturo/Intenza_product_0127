
import React, { useState, useRef, useContext, useEffect, useMemo } from 'react';
import { Plus, X, Save, Download, Upload, AlertTriangle, CheckCircle, Pencil, History, Sparkles, Shield, User, Trash2, Eye, EyeOff, Key, Database, HardDrive, Info, Cloud, LogOut, Loader2, Link as LinkIcon, Activity } from 'lucide-react';
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

  // --- 容量計算邏輯 (優化版：區分 Base64 與 Blob URL) ---
  const storageStats = useMemo(() => {
    const rowCount = 
      (currentAppState.products?.length || 0) + 
      (currentAppState.shipments?.length || 0) + 
      (currentAppState.testers?.length || 0) + 
      (currentAppState.users?.length || 0);
    const rowLimit = 10000;
    const rowPercent = Math.min(100, (rowCount / rowLimit) * 100);

    let base64Bytes = 0;
    let blobFilesCount = 0;

    const analyzeUrl = (url?: string) => {
      if (!url) return;
      if (url.startsWith('data:')) {
        base64Bytes += (url.length * 3) / 4;
      } else if (url.includes('vercel-storage.com')) {
        blobFilesCount += 1;
      }
    };

    currentAppState.products?.forEach(p => {
      analyzeUrl(p.imageUrl);
      p.designHistory?.forEach(eco => eco.imageUrls?.forEach(analyzeUrl));
      p.durabilityTests?.forEach(test => test.attachmentUrls?.forEach(analyzeUrl));
      p.ergoProjects?.forEach(proj => {
        Object.values(proj.tasks).flat().forEach((task: any) => {
          task.ngReasons.forEach((ng: any) => ng.attachmentUrls?.forEach(analyzeUrl));
        });
      });
    });

    const base64MB = base64Bytes / (1024 * 1024);
    
    return { rowCount, rowLimit, rowPercent, base64MB, blobFilesCount };
  }, [currentAppState]);

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleTestBlob = async () => {
    setIsTestingBlob(true);
    try {
      // 建立一個微小的測試檔案
      const testFile = new File(["blob connection test"], "test.txt", { type: "text/plain" });
      const url = await api.uploadImage(testFile);
      if (url.includes('vercel-storage.com')) {
        showNotification('Vercel Blob 連線正常！', 'success');
      } else {
        throw new Error('回傳的 URL 格式不正確');
      }
    } catch (err: any) {
      console.error(err);
      showNotification('Blob 連線失敗，請檢查環境變數', 'error');
    } finally {
      setIsTestingBlob(false);
    }
  };

  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  const handleDownloadProject = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentAppState, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `intenza-project-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showNotification('Project exported successfully', 'success');
  };

  // Fix: Added missing handleAddSeries function to call the onAddSeries prop and clear input
  const handleAddSeries = async () => {
    if (!newSeriesName.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddSeries(newSeriesName);
      setNewSeriesName('');
      showNotification('Series added successfully', 'success');
    } catch (err) {
      console.error(err);
      showNotification('Failed to add series', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fix: Added missing handleImportProject function to read local JSON files and call onLoadProject
  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        const state = JSON.parse(content);
        onLoadProject(state);
        showNotification('Project imported successfully', 'success');
      } catch (err) {
        console.error(err);
        showNotification('Invalid JSON file', 'error');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in space-y-8">
      <header className="border-b border-slate-100 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">System Settings</h1>
          <p className="text-slate-500 mt-1">Configure global parameters, manage users, and project data.</p>
        </div>
        <button 
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
        >
          <LogOut size={18} /> Logout
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
          {/* User Management Section */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <Shield className="text-intenza-600" size={20} />
                    <h2 className="text-xl font-bold text-slate-900">User Management</h2>
                </div>
                <button 
                  onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }}
                  className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors"
                >
                  <Plus size={16} /> New User
                </button>
             </div>
             
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Username</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Password</th>
                      <th className="px-6 py-4 text-right">Actions</th>
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
                              <button onClick={() => { if(window.confirm(`Delete user ${user.username}?`)) onDeleteUser(user.id); }} className="p-2 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-white"><Trash2 size={16} /></button>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </section>

          {/* Series Configuration Section */}
          <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Product Series Configuration</h2>
            <p className="text-sm text-slate-500 mb-6">Define the product families available in the dashboard.</p>
            <div className="flex gap-3 mb-6">
              <input type="text" value={newSeriesName} onChange={(e) => setNewSeriesName(e.target.value)} placeholder="Enter new series name..." className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-intenza-500/20 bg-slate-50 text-slate-900" onKeyPress={(e) => e.key === 'Enter' && handleAddSeries()}/>
              <button onClick={handleAddSeries} disabled={isSubmitting} className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:bg-slate-400">
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />} Add
              </button>
            </div>
            <div className="space-y-3">
              {seriesList.map((series, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 border-slate-100">
                  <span className="font-medium text-slate-700">{t(series)}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditingIndex(index); setEditValue(t(series)); }} className="text-slate-400 hover:text-intenza-600 p-2"><Pencil size={16} /></button>
                    <button onClick={() => { if(window.confirm('Delete this series?')) { const nl = [...seriesList]; nl.splice(index,1); onUpdateSeriesList(nl); } }} className="text-slate-400 hover:text-red-600 p-2"><X size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-8">
           {/* Cloud Sync Management Section */}
           <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                 <Cloud className="text-intenza-600" size={20} />
                 <h2 className="text-xl font-bold text-slate-900">Cloud Connection</h2>
              </div>
              
              <div className="space-y-3">
                  <button 
                    onClick={onSyncCloud}
                    disabled={syncStatus === 'saving'}
                    className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
                      syncStatus === 'saving' 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                        : 'bg-intenza-600 text-white hover:bg-intenza-700 shadow-intenza-600/20'
                    }`}
                  >
                    {syncStatus === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <Cloud size={18} />}
                    {syncStatus === 'saving' ? 'Syncing...' : 'Sync Data to Postgres'}
                  </button>

                  <button 
                    onClick={handleTestBlob}
                    disabled={isTestingBlob}
                    className="w-full py-3 rounded-xl font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                  >
                    {isTestingBlob ? <Loader2 size={18} className="animate-spin" /> : <Activity size={18} className="text-emerald-500" />}
                    Test Blob Connection
                  </button>
              </div>
           </section>

           {/* Capacity Monitoring Section */}
           <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Storage Usage</h2>
              <p className="text-sm text-slate-500 mb-6">Monitoring Vercel resources.</p>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Database size={14} className="text-indigo-500" />
                      Postgres (Metadata)
                    </div>
                    <span className="text-slate-400">
                      {storageStats.rowCount.toLocaleString()} Rows
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${storageStats.rowPercent}%` }}></div>
                  </div>
                  {storageStats.base64MB > 0 && (
                      <div className="flex items-center gap-1.5 text-amber-600 text-[10px] font-bold animate-pulse mt-1">
                          <AlertTriangle size={10}/> 偵測到 {storageStats.base64MB.toFixed(1)}MB 的舊式 Base64 數據
                      </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2 text-slate-500">
                      <HardDrive size={14} className="text-emerald-500" />
                      Blob (Cloud CDN)
                    </div>
                    <span className="text-slate-400">
                      {storageStats.blobFilesCount} Files Linked
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                      <p className="text-[10px] text-emerald-800 leading-tight">目前所有新上傳的圖片均已自動導向 Vercel Blob，確保了資料庫的穩定性。</p>
                  </div>
                </div>
              </div>
           </section>

           <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
             <h2 className="text-xl font-bold text-slate-900 mb-4">Local Project Backup</h2>
             <div className="grid grid-cols-1 gap-4">
               <button onClick={handleDownloadProject} className="flex items-center justify-center gap-2 w-full py-2.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-all">
                 <Download size={18} /> Export JSON
               </button>
               <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-all">
                 <Upload size={18} /> Import JSON
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">{user ? 'Edit User' : 'Add New User'}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
           <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-intenza-500/20 outline-none"
                    placeholder="e.g. jason_hsu"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-intenza-500/20 outline-none"
                    placeholder="Enter password"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Role</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                   <button 
                     type="button"
                     onClick={() => setFormData({ ...formData, role: 'admin' })}
                     className={`py-2 text-xs font-bold rounded-md transition-all ${formData.role === 'admin' ? 'bg-white shadow text-intenza-600' : 'text-slate-500'}`}
                   >
                     Admin
                   </button>
                   <button 
                     type="button"
                     onClick={() => setFormData({ ...formData, role: 'user' })}
                     className={`py-2 text-xs font-bold rounded-md transition-all ${formData.role === 'user' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                   >
                     Standard User
                   </button>
                </div>
              </div>
           </div>

           <div className="pt-4 flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-2 text-slate-600 font-bold hover:bg-slate-50 rounded-lg transition-all">Cancel</button>
              <button type="submit" className="flex-1 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10">
                {user ? 'Save Changes' : 'Create Account'}
              </button>
           </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
