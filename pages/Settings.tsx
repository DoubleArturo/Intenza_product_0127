
import React, { useState, useRef, useContext, useEffect, useMemo } from 'react';
// FIX: Added GitCommit and UserCheck to imports
import { Plus, X, Save, Download, Upload, AlertTriangle, CheckCircle, Pencil, History, Sparkles, Shield, User, Trash2, Eye, EyeOff, Key, Database, HardDrive, Info, Cloud, LogOut, Loader2, Link as LinkIcon, Activity, Layers, ImageIcon, RotateCcw, Settings2, LayoutGrid, Maximize, Palette, MousePointer2, ClipboardList, Clock, Search, ChevronRight, Filter, UserRound, ArrowDown, Lock, Unlock, FileUp, GitCommit, UserCheck } from 'lucide-react';
import { AppState, LocalizedString, UserAccount, AuditLog, UserPermissions, ModulePermissions } from '../types';
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
  onUpdateLogo: (url: string | undefined) => void;
  onUpdateStatusLightSize: (size: 'SMALL' | 'NORMAL' | 'LARGE') => void;
  onUpdateDashboardColumns: (count: number) => void;
  onUpdateCardAspectRatio: (ratio: string) => void;
  onUpdateChartColorStyle: (style: 'COLORFUL' | 'MONOCHROME' | 'SLATE') => void;
  onUpdateAnalyticsTooltipScale?: (scale: number) => void;
  onUpdateAnalyticsTooltipPosition?: (pos: 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT' | 'FOLLOW') => void;
  onUpdateEvaluationModalYOffset?: (offset: number) => void;
  onAddUser: (user: Omit<UserAccount, 'id'>) => void;
  onUpdateUser: (user: UserAccount) => void;
  onDeleteUser: (id: string) => void;
  onDeleteAuditLogs: () => void;
  onSyncCloud: () => Promise<void>;
  onLogout: () => void;
  syncStatus: 'idle' | 'saving' | 'success' | 'error';
  onResetDashboard?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ 
  seriesList, onAddSeries, onUpdateSeriesList, onRenameSeries, 
  currentAppState, onLoadProject, onUpdateMaxHistory, onToggleAiInsights,
  onUpdateLogo, onUpdateStatusLightSize, onUpdateDashboardColumns, onUpdateCardAspectRatio, onUpdateChartColorStyle, 
  onUpdateAnalyticsTooltipScale, onUpdateAnalyticsTooltipPosition, onUpdateEvaluationModalYOffset,
  onAddUser, onUpdateUser, onDeleteUser, onDeleteAuditLogs, onSyncCloud, onLogout, syncStatus, onResetDashboard
}) => {
  const { t, language } = useContext(LanguageContext);
  const [newSeriesName, setNewSeriesName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  // Modals
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [isLogBrowserOpen, setIsLogBrowserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  const storageStats = useMemo(() => {
    const rowCount = 
      (currentAppState.products?.length || 0) + 
      (currentAppState.shipments?.length || 0) + 
      (currentAppState.testers?.length || 0) + 
      (currentAppState.users?.length || 0);
    const rowLimit = 10000;
    const rowPercent = Math.min(100, (rowCount / rowLimit) * 100);
    const jsonString = JSON.stringify(currentAppState);
    const sizeInBytes = jsonString.length; 
    const sizeInMB = sizeInBytes / (1024 * 1024);
    const sizeLimitMB = 4.5; 
    const sizePercent = Math.min(100, (sizeInMB / sizeLimitMB) * 100);
    return { 
      rowCount, rowLimit, rowPercent, 
      sizeInMB, sizeLimitMB, sizePercent
    };
  }, [currentAppState]);

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      const url = await api.uploadImage(file);
      onUpdateLogo(url);
      showNotification('Logo 已更新', 'success');
    } catch (err) {
      showNotification('Logo 上傳失敗', 'error');
    } finally {
      setIsUploadingLogo(false);
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

  const handleExportLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentAppState.auditLogs || [], null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `login-audit-logs-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showNotification('登入日誌已導出', 'success');
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
  };

  const handleResetShipments = () => {
    const confirmed = window.confirm(language === 'zh' ? '確定要清空所有出貨數據嗎？' : 'Reset all shipment data?');
    if (confirmed && onResetDashboard) {
      onResetDashboard();
      showNotification('出貨數據已重置', 'success');
    }
  };

  const getProgressColor = (percent: number) => {
    if (percent > 90) return 'bg-red-500';
    if (percent > 70) return 'bg-amber-500';
    return 'bg-indigo-500';
  };

  const aspectRatios = [
    { label: t({ en: 'Square (1:1)', zh: '方形 (1:1)' }), value: '1/1' },
    { label: t({ en: 'Portrait (3:4)', zh: '直式 (3:4)' }), value: '3/4' },
    { label: t({ en: 'Standard (4:3)', zh: '標準 (4:3)' }), value: '4/3' },
    { label: t({ en: 'Cinematic (16:9)', zh: '寬螢幕 (16:9)' }), value: '16/9' },
  ];

  const logsCount = currentAppState.auditLogs?.length || 0;
  const lastLog = logsCount > 0 ? (currentAppState.auditLogs || [])[(currentAppState.auditLogs || []).length - 1] : null;
  const activeSessions = (currentAppState.auditLogs || []).filter(l => !l.logoutTime).length;

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in space-y-8">
      <header className="border-b border-slate-100 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">System Settings</h1>
          <p className="text-slate-500 mt-1">系統配置、帳號管理與雲端存儲監控。</p>
        </div>
        <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100">
          <LogOut size={18} /> 登出系統
        </button>
      </header>

      {notification && (
        <div className={`fixed top-8 right-8 px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slide-up z-[100] ${notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span className="font-medium">{notification.msg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Logo & UI Settings */}
          <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
             <div className="flex items-center gap-2 mb-6"><Settings2 className="text-intenza-600" size={20} /><h2 className="text-xl font-bold text-slate-900">品牌視覺配置 (Login Logo)</h2></div>
             <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="w-32 h-32 rounded-2xl bg-slate-900 flex items-center justify-center overflow-hidden shadow-inner">
                    {currentAppState.customLogoUrl ? <img src={currentAppState.customLogoUrl} alt="Logo" className="w-full h-full object-contain p-2" /> : <div className="text-white font-bold text-4xl">I</div>}
                </div>
                <div className="flex-1 space-y-4">
                    <div className="flex gap-3">
                        <button onClick={() => logoInputRef.current?.click()} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors flex items-center gap-2"><Upload size={16} /> 上傳新 Logo</button>
                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </div>
                </div>
             </div>
          </section>

          {/* User Management Section */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2"><Shield className="text-intenza-600" size={20} /><h2 className="text-xl font-bold text-slate-900">帳號管理</h2></div>
                <button onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }} className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors"><Plus size={16} /> 新增用戶</button>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider"><tr><th className="px-6 py-4">使用者名稱</th><th className="px-6 py-4">權限</th><th className="px-6 py-4">操作</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentAppState.users?.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-700">{user.username}</td>
                        <td className="px-6 py-4 text-xs font-bold uppercase">{user.role}</td>
                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                          {user.role !== 'admin' && (
                             <button 
                               onClick={() => { setEditingUser(user); setIsPermissionModalOpen(true); }}
                               className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                               title="權限配置"
                             >
                               <Lock size={16} />
                             </button>
                          )}
                          <button onClick={() => { setEditingUser(user); setIsUserModalOpen(true); }} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"><Pencil size={16} /></button>
                          <button onClick={() => { if(window.confirm('確定刪除？')) onDeleteUser(user.id); }} className="p-2 text-red-400 hover:text-red-600 rounded-lg"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </section>
        </div>

        <div className="space-y-8">
           <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-6"><Cloud className="text-intenza-600" size={20} /><h2 className="text-xl font-bold text-slate-900">雲端同步狀態</h2></div>
              <button onClick={onSyncCloud} disabled={syncStatus === 'saving'} className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${syncStatus === 'saving' ? 'bg-slate-100 text-slate-400' : 'bg-intenza-600 text-white hover:bg-intenza-700 shadow-intenza-600/20'}`}>
                {syncStatus === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <Cloud size={18} />} {syncStatus === 'saving' ? '正在同步...' : '立即同步'}
              </button>
           </section>
           <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-6"><History className="text-slate-900" size={20} /><h2 className="text-xl font-bold text-slate-900">活動日誌</h2></div>
              <div className="space-y-4">
                 <div className="flex justify-between items-center text-sm"><span className="text-slate-500">當前活躍會話</span><span className="font-black text-emerald-500">{activeSessions}</span></div>
                 <button onClick={() => setIsLogBrowserOpen(true)} className="w-full py-2.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl font-bold text-xs hover:bg-slate-100 transition-all flex items-center justify-center gap-2"><ClipboardList size={16} /> 檢視所有日誌</button>
              </div>
           </section>
        </div>
      </div>

      {isUserModalOpen && <UserAccountModal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} onSave={(data) => { if (editingUser) onUpdateUser({ ...editingUser, ...data } as any); else onAddUser(data as any); setIsUserModalOpen(false); }} user={editingUser} />}
      
      {/* 權限管理對話框 */}
      {isPermissionModalOpen && editingUser && (
        <PermissionEditorModal 
          isOpen={isPermissionModalOpen} 
          onClose={() => setIsPermissionModalOpen(false)} 
          user={editingUser} 
          products={currentAppState.products}
          seriesList={currentAppState.seriesList}
          onSave={(perms) => {
            onUpdateUser({ ...editingUser, permissions: perms });
            setIsPermissionModalOpen(false);
            showNotification(`已更新 ${editingUser.username} 的權限配置`, 'success');
          }}
        />
      )}

      {isLogBrowserOpen && <AuditLogBrowserModal isOpen={isLogBrowserOpen} onClose={() => setIsLogBrowserOpen(false)} logs={currentAppState.auditLogs || []} onDeleteAll={() => { onDeleteAuditLogs(); setIsLogBrowserOpen(false); }} onExport={handleExportLogs} />}
    </div>
  );
};

// FIX: Implemented missing AuditLogBrowserModal component
const AuditLogBrowserModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLog[];
  onDeleteAll: () => void;
  onExport: () => void;
}> = ({ isOpen, onClose, logs, onDeleteAll, onExport }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl h-[80vh] overflow-hidden flex flex-col">
        <header className="p-8 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">登入日誌瀏覽</h2>
            <p className="text-slate-400 text-xs font-bold uppercase mt-1">共 {logs.length} 筆記錄</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onExport} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="匯出 JSON"><Download size={20} /></button>
            <button onClick={() => { if(window.confirm('確定清空所有記錄？')) onDeleteAll(); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="清空日誌"><Trash2 size={20} /></button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} /></button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider sticky top-0">
              <tr>
                <th className="px-6 py-4">使用者</th>
                <th className="px-6 py-4">登入時間</th>
                <th className="px-6 py-4">登出時間</th>
                <th className="px-6 py-4">停留 (分)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...logs].reverse().map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-700">{log.username}</td>
                  <td className="px-6 py-4 text-xs">{log.loginTime}</td>
                  <td className="px-6 py-4 text-xs">{log.logoutTime || <span className="text-emerald-500 font-bold">Active</span>}</td>
                  <td className="px-6 py-4 text-xs font-mono">{log.durationMinutes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </main>
      </div>
    </div>
  );
};

const PermissionEditorModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  user: UserAccount;
  products: AppState['products'];
  seriesList: AppState['seriesList'];
  onSave: (perms: UserPermissions) => void;
}> = ({ isOpen, onClose, user, products, seriesList, onSave }) => {
  const { t } = useContext(LanguageContext);
  const [perms, setPerms] = useState<UserPermissions>(user.permissions || {
    canSyncShipments: false,
    seriesAccess: {},
    skuAccess: {}
  });

  const [activeTab, setActiveTab] = useState<'SHIPMENT' | 'SERIES' | 'SKU'>('SHIPMENT');

  const toggleShipment = () => setPerms({ ...perms, canSyncShipments: !perms.canSyncShipments });

  const toggleSeries = (series: string, field: keyof ModulePermissions) => {
    const current = perms.seriesAccess[series] || { canEdit: false, canSync: false };
    setPerms({
      ...perms,
      seriesAccess: {
        ...perms.seriesAccess,
        [series]: { ...current, [field]: !current[field] }
      }
    });
  };

  const toggleSku = (sku: string, module: 'design' | 'ergo' | 'durability', field: keyof ModulePermissions) => {
    const currentSku = perms.skuAccess[sku] || {
      design: { canEdit: false, canSync: false },
      ergo: { canEdit: false, canSync: false },
      durability: { canEdit: false, canSync: false }
    };
    setPerms({
      ...perms,
      skuAccess: {
        ...perms.skuAccess,
        [sku]: {
          ...currentSku,
          [module]: { ...currentSku[module], [field]: !currentSku[module][field] }
        }
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl h-[80vh] overflow-hidden flex flex-col">
        <header className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">權限劃分管理</h2>
            <p className="text-slate-400 text-xs font-bold uppercase mt-1">使用者: {user.username}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} /></button>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* 左側導航 */}
          <aside className="w-56 bg-slate-50 border-r border-slate-100 p-4 space-y-2">
            {[
              { id: 'SHIPMENT', label: '出貨資料管理', icon: <FileUp size={16}/> },
              { id: 'SERIES', label: '產品系列權限', icon: <Layers size={16}/> },
              { id: 'SKU', label: '單一 SKU 權限', icon: <Database size={16}/> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-white'}`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </aside>

          {/* 右側內容區 */}
          <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {activeTab === 'SHIPMENT' && (
              <div className="space-y-6 animate-fade-in">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">出貨資料上傳同步權限</h3>
                <div onClick={toggleShipment} className={`flex items-center justify-between p-6 rounded-3xl border-2 cursor-pointer transition-all ${perms.canSyncShipments ? 'bg-emerald-50 border-emerald-500 shadow-lg shadow-emerald-500/10' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${perms.canSyncShipments ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}><FileUp size={24}/></div>
                    <div><div className="text-lg font-black text-slate-900">同步上傳功能</div><div className="text-xs text-slate-500">允許此使用者導入 Excel 並同步出貨資料至雲端資料庫。</div></div>
                  </div>
                  {perms.canSyncShipments ? <Unlock className="text-emerald-500" /> : <Lock className="text-slate-300" />}
                </div>
              </div>
            )}

            {activeTab === 'SERIES' && (
              <div className="space-y-4 animate-fade-in">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">按產品系列切換權限</h3>
                <div className="grid grid-cols-1 gap-3">
                  {seriesList.map(s => {
                    const name = t(s);
                    const access = perms.seriesAccess[name] || { canEdit: false, canSync: false };
                    return (
                      <div key={name} className="flex items-center justify-between p-5 bg-white border-2 border-slate-50 rounded-2xl hover:border-slate-200 transition-all">
                        <span className="font-bold text-slate-700">{name}</span>
                        <div className="flex gap-2">
                          <button onClick={() => toggleSeries(name, 'canEdit')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${access.canEdit ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>編輯</button>
                          <button onClick={() => toggleSeries(name, 'canSync')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${access.canSync ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>同步</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'SKU' && (
              <div className="space-y-8 animate-fade-in">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">單一 SKU 三大功能模組權限</h3>
                <div className="space-y-6">
                  {products.map(p => {
                    const sku = p.sku;
                    const access = perms.skuAccess[sku] || {
                      design: { canEdit: false, canSync: false },
                      ergo: { canEdit: false, canSync: false },
                      durability: { canEdit: false, canSync: false }
                    };
                    return (
                      <div key={sku} className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                        <div className="flex items-center gap-3 mb-6 border-b border-slate-200 pb-4">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-900 font-mono text-xs font-black shadow-sm">{sku}</div>
                          <div><div className="text-sm font-black text-slate-900">{t(p.modelName)}</div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t(p.series)}</div></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {[
                            { id: 'design', label: 'Design & Eco', color: 'text-rose-600', icon: <GitCommit size={12}/> },
                            { id: 'ergo', label: 'Ergonomics', color: 'text-indigo-600', icon: <UserCheck size={12}/> },
                            { id: 'durability', label: 'Durability', color: 'text-emerald-600', icon: <Activity size={12}/> }
                          ].map(mod => (
                            <div key={mod.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                              <div className={`text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 ${mod.color}`}>{mod.icon} {mod.label}</div>
                              <div className="flex gap-2">
                                <button onClick={() => toggleSku(sku, mod.id as any, 'canEdit')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${access[mod.id as keyof typeof access].canEdit ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-300'}`}>編輯</button>
                                <button onClick={() => toggleSku(sku, mod.id as any, 'canSync')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${access[mod.id as keyof typeof access].canSync ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-300'}`}>同步</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </main>
        </div>

        <footer className="p-8 border-t border-slate-100 bg-white sticky bottom-0 flex gap-4">
          <button onClick={onClose} className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all">取消</button>
          <button onClick={() => onSave(perms)} className="flex-1 py-4 bg-slate-900 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all shadow-2xl shadow-slate-900/30">儲存權限配置</button>
        </footer>
      </div>
    </div>
  );
};

const UserAccountModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: (data: Omit<UserAccount, 'id'>) => void;
  user: UserAccount | null;
}> = ({ isOpen, onClose, onSave, user }) => {
  const [formData, setFormData] = useState({ username: '', password: '', role: 'user' as 'admin' | 'user' | 'uploader' | 'viewer' });
  useEffect(() => { if (user) setFormData({ username: user.username, password: user.password, role: user.role }); else setFormData({ username: '', password: '', role: 'user' }); }, [user, isOpen]);
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(formData); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-slate-100"><h2 className="text-xl font-bold text-slate-900">{user ? '編輯用戶' : '新增系統用戶'}</h2><button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500"><X size={20} /></button></div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
           <div className="space-y-4">
              <div><label className="block text-sm font-bold text-slate-700 mb-1">使用者名稱</label><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="text" required value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-intenza-500/20 outline-none" /></div></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-1">密碼</label><div className="relative"><Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="text" required value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-intenza-500/20 outline-none" /></div></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-1">權限角色</label><div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 bg-slate-100 rounded-lg">
                   <button type="button" onClick={() => setFormData({ ...formData, role: 'admin' })} className={`py-2 text-[10px] font-bold rounded-md transition-all ${formData.role === 'admin' ? 'bg-white shadow text-intenza-600' : 'text-slate-500'}`}>Admin</button>
                   <button type="button" onClick={() => setFormData({ ...formData, role: 'uploader' })} className={`py-2 text-[10px] font-bold rounded-md transition-all ${formData.role === 'uploader' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>Uploader</button>
                   <button type="button" onClick={() => setFormData({ ...formData, role: 'user' })} className={`py-2 text-[10px] font-bold rounded-md transition-all ${formData.role === 'user' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Standard</button>
                   <button type="button" onClick={() => setFormData({ ...formData, role: 'viewer' })} className={`py-2 text-[10px] font-bold rounded-md transition-all ${formData.role === 'viewer' ? 'bg-white shadow text-amber-600' : 'text-slate-500'}`}>Viewer</button>
              </div></div>
           </div>
           <div className="pt-4 flex gap-3"><button type="button" onClick={onClose} className="flex-1 py-2 text-slate-600 font-bold hover:bg-slate-50 rounded-lg">取消</button><button type="submit" className="flex-1 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10">確認</button></div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
