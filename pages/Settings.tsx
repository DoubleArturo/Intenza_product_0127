import React, { useState, useRef, useContext, useEffect, useMemo } from 'react';
import { Plus, X, Save, Download, Upload, AlertTriangle, CheckCircle, Pencil, History, Sparkles, Shield, User, Trash2, Eye, EyeOff, Key, Database, HardDrive, Info, Cloud, LogOut, Loader2, Link as LinkIcon, Activity, Layers, ImageIcon, RotateCcw, Settings2, LayoutGrid, Maximize, Palette, MousePointer2, ClipboardList, Clock, Search, ChevronRight, Filter, UserRound, ArrowDown, GitCommit, UserCheck, CheckSquare, Square, List, UserSearch } from 'lucide-react';
import { AppState, LocalizedString, UserAccount, AuditLog, UserPermissions, ProductModel } from '../types';
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
  onDeleteLog?: (id: string) => void;
  onSyncCloud: (isAuto?: boolean, partial?: Partial<AppState>) => Promise<void>;
  onLogout: () => void;
  syncStatus: 'idle' | 'saving' | 'success' | 'error';
  onResetDashboard?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ 
  seriesList, onAddSeries, onUpdateSeriesList, onRenameSeries, 
  currentAppState, onLoadProject, onUpdateMaxHistory, onToggleAiInsights,
  onUpdateLogo, onUpdateStatusLightSize, onUpdateDashboardColumns, onUpdateCardAspectRatio, onUpdateChartColorStyle, 
  onUpdateAnalyticsTooltipScale, onUpdateAnalyticsTooltipPosition, onUpdateEvaluationModalYOffset,
  onAddUser, onUpdateUser, onDeleteUser, onDeleteAuditLogs, onDeleteLog, onSyncCloud, onLogout, syncStatus, onResetDashboard
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
  const [isLogBrowserOpen, setIsLogBrowserOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);

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
    analyzeUrl(currentAppState.customLogoUrl);
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      const url = await api.uploadImage(file);
      onUpdateLogo(url);
      showNotification('Logo 已更新，請手動同步雲端', 'success');
    } catch (err) {
      showNotification('Logo 上傳失敗', 'error');
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleResetShipments = () => {
    const confirmed = window.confirm(
      language === 'zh' 
        ? '⚠️ 警告：這將會清空所有出貨數據（產品儀表板內容）。此動作無法復原，您確定嗎？' 
        : '⚠️ WARNING: This will permanently delete all shipment data (Product Dashboard contents). This action cannot be undone. Are you sure?'
    );
    if (confirmed && onResetDashboard) {
      onResetDashboard();
      showNotification(language === 'zh' ? '儀表板數據已清空' : 'Dashboard data has been reset', 'success');
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
  const activeSessions = Array.from(new Set((currentAppState.auditLogs || []).filter(l => !l.logoutTime).map(l => l.username))).length;

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
          {/* Logo Section */}
          <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
             <div className="flex items-center gap-2 mb-6">
                 <Settings2 className="text-intenza-600" size={20} />
                 <h2 className="text-xl font-bold text-slate-900">品牌視覺配置 (Login Logo)</h2>
             </div>
             <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="w-32 h-32 rounded-2xl bg-slate-900 border-2 border-slate-800 flex items-center justify-center overflow-hidden relative group shadow-inner">
                    {currentAppState.customLogoUrl ? (
                        <img src={currentAppState.customLogoUrl} alt="Logo Preview" className="w-full h-full object-contain p-2" />
                    ) : (
                        <div className="text-white font-bold text-4xl">I</div>
                    )}
                    {isUploadingLogo && <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>}
                </div>
                <div className="flex-1 space-y-4">
                    <p className="text-sm text-slate-500">上傳您的公司 Logo。建議上傳具備對比度的標誌。</p>
                    <div className="flex gap-3">
                        <button onClick={() => logoInputRef.current?.click()} disabled={isUploadingLogo} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors flex items-center gap-2"><Upload size={16} /> 上傳新 Logo</button>
                        {currentAppState.customLogoUrl && <button onClick={() => onUpdateLogo(undefined)} className="px-5 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"><RotateCcw size={16} /> 重置預設</button>}
                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </div>
                </div>
             </div>
          </section>

          {/* Global UI Section */}
          <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
             <div className="flex items-center gap-2 mb-6 text-slate-900">
                <Settings2 className="text-intenza-600" size={20} />
                <h2 className="text-xl font-bold">{t({ en: 'Global UI Configuration', zh: '系統全域 UI 配置' })}</h2>
             </div>
             <div className="space-y-10">
                <div>
                   <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">{t({ en: 'Status Light Size (Unified)', zh: '產品指示燈大小 (一次統一調整)' })}</label>
                   <div className="flex gap-4">
                      {['SMALL', 'NORMAL', 'LARGE'].map(sz => (
                         <button key={sz} type="button" onClick={() => onUpdateStatusLightSize(sz as any)} className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold border-2 transition-all ${currentAppState.globalStatusLightSize === sz ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'}`}>{sz}</button>
                      ))}
                   </div>
                </div>

                <div>
                   <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-4"><LayoutGrid size={14} />{t({ en: 'Dashboard Max Columns', zh: '產品卡片呈現數量 (畫面最大化時)' })}</label>
                   <div className="flex gap-2">
                      {[2, 3, 4, 5, 6].map(count => (
                         <button key={count} type="button" onClick={() => onUpdateDashboardColumns(count)} className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold border-2 transition-all ${(currentAppState.dashboardColumns || 4) === count ? 'bg-intenza-600 text-white border-intenza-600 shadow-lg' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'}`}>{count} {t({ en: 'Cols', zh: '欄' })}</button>
                      ))}
                   </div>
                </div>

                <div>
                   <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-4"><Maximize size={14} />{t({ en: 'Product Card Proportions', zh: '產品卡片長寬比例 (自訂調整)' })}</label>
                   <div className="grid grid-cols-2 gap-3">
                      {aspectRatios.map(ratio => (
                         <button key={ratio.value} type="button" onClick={() => onUpdateCardAspectRatio(ratio.value)} className={`py-3 px-4 rounded-xl text-xs font-bold border-2 transition-all ${(currentAppState.cardAspectRatio || '3/4') === ratio.value ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'}`}>{ratio.label}</button>
                      ))}
                   </div>
                </div>

                <div>
                   <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-4"><Palette size={14} />{t({ en: 'Dashboard Chart Theme', zh: '儀表板圖表顏色風格' })}</label>
                   <div className="flex gap-3">
                      {(['COLORFUL', 'MONOCHROME', 'SLATE'] as const).map(style => (
                         <button 
                           key={style} 
                           type="button" 
                           onClick={() => onUpdateChartColorStyle(style)} 
                           className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold border-2 transition-all ${
                             (currentAppState.chartColorStyle || 'COLORFUL') === style 
                             ? 'bg-slate-900 text-white border-slate-900 shadow-lg' 
                             : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'
                           }`}
                         >
                           {style === 'COLORFUL' ? t({en: 'Colorful', zh: '多彩'}) : style === 'MONOCHROME' ? t({en: 'Monochrome', zh: '同色系'}) : t({en: 'Slate', zh: '多主色系'})}
                         </button>
                      ))}
                   </div>
                </div>
             </div>
          </section>

          {/* Audit Log Section - PRINCIPLE 3 COMPLIANT */}
          <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm group">
             <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <ClipboardList className="text-indigo-600" size={22} />
                    <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">操作紀錄 (Audit Log)</h2>
                </div>
                <button onClick={handleExportLogs} className="p-2 text-slate-400 hover:text-slate-900 transition-colors" title="Export CSV/JSON"><Download size={18} /></button>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Sessions</span>
                    <span className="text-2xl font-black text-slate-900">{logsCount.toLocaleString()}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unique Online Users</span>
                    <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${activeSessions > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                        <span className="text-2xl font-black text-slate-900">{activeSessions}</span>
                    </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Log Record</span>
                    <span className="text-sm font-bold text-slate-700 block truncate">{lastLog ? `${lastLog.username} (${new Date(lastLog.loginTime).toLocaleDateString()})` : 'N/A'}</span>
                </div>
             </div>
             <button onClick={() => setIsLogBrowserOpen(true)} className="w-full py-4 bg-indigo-50 hover:bg-indigo-100 border-2 border-dashed border-indigo-200 rounded-2xl flex items-center justify-center gap-3 transition-all text-indigo-600 font-black uppercase tracking-widest group/btn">
                <Database size={20} className="group-hover/btn:scale-110 transition-transform" />
                <span>點入管理完整操作歷史與用戶行為篩選</span>
                <ChevronRight size={18} />
             </button>
          </section>

          {/* User Management */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2"><Shield className="text-intenza-600" size={20} /><h2 className="text-xl font-bold text-slate-900">帳號管理</h2></div>
                <button onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }} className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors"><Plus size={16} /> 新增用戶</button>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider"><tr><th className="px-6 py-4">使用者名稱</th><th className="px-6 py-4">權限</th><th className="px-6 py-4 text-right">操作</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentAppState.users?.slice().sort((a, b) => {
                      const priority: Record<string, number> = { 'admin': 0, 'viewer': 1, 'uploader': 2, 'user': 3 };
                      return (priority[a.role] ?? 4) - (priority[b.role] ?? 4);
                    }).map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><User size={16} /></div><span className="font-bold text-slate-700">{user.username}</span></div></td>
                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${user.role === 'admin' ? 'bg-intenza-100 text-intenza-700' : user.role === 'uploader' ? 'bg-emerald-100 text-emerald-700' : user.role === 'viewer' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{user.role}</span></td>
                        <td className="px-6 py-4 text-right"><div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setEditingUser(user); setIsPermissionsModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-white" title="Granular Permissions"><Shield size={16} /></button>
                          <button onClick={() => { setEditingUser(user); setIsUserModalOpen(true); }} className="p-2 text-slate-400 hover:text-intenza-600 transition-colors rounded-lg hover:bg-white"><Pencil size={16} /></button>
                          <button onClick={() => { if(window.confirm(`確定要刪除用戶 ${user.username}？`)) onDeleteUser(user.id); }} className="p-2 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-white"><Trash2 size={16} /></button>
                        </div></td>
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
              <div className="space-y-3">
                  <button onClick={() => onSyncCloud()} disabled={syncStatus === 'saving'} className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${syncStatus === 'saving' ? 'bg-slate-100 text-slate-400' : 'bg-intenza-600 text-white hover:bg-intenza-700 shadow-intenza-600/20'}`}>{syncStatus === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <Cloud size={18} />}{syncStatus === 'saving' ? '正在同步數據...' : '立即同步至 Postgres'}</button>
                  <button onClick={async () => { try { const tf = new File(["test"], "test.txt"); await api.uploadImage(tf); showNotification('Vercel Blob 連線正常！', 'success'); } catch (e) { showNotification('Blob 連線失敗', 'error'); } }} className="w-full py-3 rounded-xl font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"><Activity size={18} className="text-emerald-500" />測試 Blob 雲端連線</button>
              </div>
           </section>
        </div>
      </div>

      {isUserModalOpen && (
        <UserAccountModal 
          isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)}
          onSave={(data) => { if (editingUser) onUpdateUser({ ...editingUser, ...data } as any); else onAddUser(data as any); setIsUserModalOpen(false); }} user={editingUser}
        />
      )}

      {isLogBrowserOpen && (
          <AuditLogBrowserModal 
            isOpen={isLogBrowserOpen}
            onClose={() => setIsLogBrowserOpen(false)}
            logs={currentAppState.auditLogs || []}
            onDeleteAll={() => { if(window.confirm('確定要清空所有追蹤日誌嗎？此動作無法復原。')) { onDeleteAuditLogs(); setIsLogBrowserOpen(false); } }}
            onDeleteLog={(id) => { if(window.confirm('確定要刪除此筆日誌紀錄？')) onDeleteLog?.(id); }}
            onExport={handleExportLogs}
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

const AuditLogBrowserModal: React.FC<{ isOpen: boolean; onClose: () => void; logs: AuditLog[]; onDeleteAll: () => void; onDeleteLog: (id: string) => void; onExport: () => void; }> = ({ isOpen, onClose, logs, onDeleteAll, onDeleteLog, onExport }) => {
    // Inject t from LanguageContext to resolve "Cannot find name 't'"
    const { t } = useContext(LanguageContext);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
    const [selectedUser, setSelectedUser] = useState('ALL');
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
    
    const uniqueUsernames = useMemo(() => {
        return Array.from(new Set(logs.map(l => l.username))).sort();
    }, [logs]);

    const latestActiveSessionMap = useMemo(() => {
        const map = new Map<string, string>();
        [...logs].forEach(l => {
            if (!l.logoutTime) {
                map.set(l.username, l.id);
            }
        });
        return map;
    }, [logs]);

    // Define activeSessions to resolve "Cannot find name 'activeSessions'"
    const activeSessions = latestActiveSessionMap.size;

    const filteredLogs = useMemo(() => {
        return [...logs].reverse().filter(log => {
                const isActuallyLive = !log.logoutTime && latestActiveSessionMap.get(log.username) === log.id;
                const matchesSearch = log.username.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesUser = selectedUser === 'ALL' || log.username === selectedUser;
                const matchesFilter = filterStatus === 'ALL' || 
                                     (filterStatus === 'ACTIVE' && isActuallyLive) || 
                                     (filterStatus === 'COMPLETED' && (log.logoutTime || !isActuallyLive));
                return matchesSearch && matchesFilter && matchesUser;
        });
    }, [logs, searchTerm, filterStatus, selectedUser, latestActiveSessionMap]);

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white md:rounded-[2.5rem] shadow-2xl w-full h-full max-w-6xl overflow-hidden flex flex-col animate-slide-up">
                <header className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white sticky top-0 z-10">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20"><History size={24} /></div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">操作日誌管理系統</h2>
                        </div>
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">{filteredLogs.length} Records Found</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex gap-2">
                            <button onClick={onExport} className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all" title="Export CSV"><Download size={20}/></button>
                            <button onClick={onDeleteAll} className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all" title="Clear All"><Trash2 size={20}/></button>
                        </div>
                        <div className="h-8 w-px bg-slate-100" />
                        <button onClick={onClose} className="p-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all"><X size={24} strokeWidth={3} /></button>
                    </div>
                </header>

                <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 space-y-4">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <div className="relative flex-1 w-full">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="搜尋帳號名稱..." 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                                className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-500 outline-none shadow-sm transition-all" 
                            />
                        </div>
                        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full md:w-auto overflow-x-auto no-scrollbar">
                            {['ALL', 'ACTIVE', 'COMPLETED'].map((status) => (
                                <button 
                                    key={status} 
                                    onClick={() => setFilterStatus(status as any)} 
                                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === status ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 whitespace-nowrap'}`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                         <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">
                            <UserSearch size={14} /> 篩選特定用戶:
                         </div>
                         <div className="flex-1 overflow-x-auto no-scrollbar py-1">
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setSelectedUser('ALL')}
                                    className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all whitespace-nowrap ${selectedUser === 'ALL' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
                                >
                                    所有用戶
                                </button>
                                {uniqueUsernames.map(uname => (
                                    <button 
                                        key={uname}
                                        onClick={() => setSelectedUser(uname)}
                                        className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all whitespace-nowrap ${selectedUser === uname ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
                                    >
                                        {uname}
                                    </button>
                                ))}
                            </div>
                         </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/80 sticky top-0 z-20 backdrop-blur-md">
                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                                <th className="px-8 py-4 w-12"></th>
                                <th className="px-4 py-4">{t({ en: 'User Account', zh: '操作帳號' })}</th>
                                <th className="px-4 py-4 text-center">{t({ en: 'Status', zh: '當前狀態' })}</th>
                                <th className="px-4 py-4">{t({ en: 'Login Time', zh: '登入時間' })}</th>
                                <th className="px-4 py-4">{t({ en: 'Logout Time', zh: '登出時間' })}</th>
                                <th className="px-4 py-4 text-center">{t({ en: 'Duration', zh: '停留時間' })}</th>
                                <th className="px-4 py-4 text-right">{t({ en: 'Actions', zh: '紀錄數' })}</th>
                                <th className="px-8 py-4 w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredLogs.length > 0 ? filteredLogs.map((log) => {
                                const isActuallyLive = !log.logoutTime && latestActiveSessionMap.get(log.username) === log.id;
                                const isStale = !log.logoutTime && !isActuallyLive;
                                const isExpanded = expandedLogId === log.id;
                                
                                return (
                                    <React.Fragment key={log.id}>
                                        <tr 
                                            className={`group hover:bg-slate-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50/80 shadow-inner' : ''}`}
                                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                        >
                                            <td className="px-8 py-4">
                                                <div className={`w-2 h-2 rounded-full ${isActuallyLive ? 'bg-emerald-500 animate-pulse-slow shadow-[0_0_8px_rgba(16,185,129,0.5)]' : isStale ? 'bg-amber-400' : 'bg-slate-200'}`} />
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${isActuallyLive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        <UserRound size={16} />
                                                    </div>
                                                    <span className="text-sm font-black text-slate-900 tracking-tight">{log.username}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                {isActuallyLive ? (
                                                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-50 text-emerald-600 uppercase">Live</span>
                                                ) : isStale ? (
                                                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-50 text-amber-500 uppercase">Stale</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-slate-100 text-slate-400 uppercase">Ended</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-xs font-bold text-slate-600 font-mono">{log.loginTime}</td>
                                            <td className="px-4 py-4 text-xs font-bold text-slate-600 font-mono">{log.logoutTime || '-'}</td>
                                            <td className="px-4 py-4 text-center">
                                                <span className="text-xs font-black text-indigo-600 font-mono">{log.durationMinutes ? `${log.durationMinutes}m` : (isActuallyLive ? '...' : '<1m')}</span>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className="text-[10px] font-black text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded-md uppercase">{log.activities?.length || 0} Events</span>
                                                    <ChevronRight size={14} className={`text-slate-300 transition-transform ${isExpanded ? 'rotate-90 text-indigo-500' : ''}`} />
                                                </div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onDeleteLog(log.id); }}
                                                    className="p-1.5 text-slate-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-slate-50/80 animate-fade-in">
                                                <td colSpan={8} className="px-12 py-6">
                                                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xl">
                                                        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                                                            <Activity size={16} className="text-indigo-500" />
                                                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Behavior Logs (用戶行為細節回溯)</h4>
                                                        </div>
                                                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-4">
                                                            {log.activities && log.activities.length > 0 ? (
                                                                log.activities.map((act, i) => (
                                                                    <div key={i} className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-xl transition-all border border-transparent hover:border-slate-100">
                                                                        <div className="text-[10px] font-black text-indigo-500 font-mono shrink-0 w-24">{act.timestamp.split(' ')[1]}</div>
                                                                        <div className="w-2 h-2 rounded-full bg-slate-200 mt-1.5" />
                                                                        <div className="text-xs font-bold text-slate-700 leading-relaxed">{act.action}</div>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div className="text-center py-8 opacity-30 italic text-xs">No specific activities logged for this session.</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={8} className="py-20 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-3">
                                            <Search size={48} className="opacity-10" />
                                            <p className="font-bold text-sm uppercase tracking-widest">No matching logs found.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <footer className="p-6 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                            <span className="text-xs font-black uppercase tracking-tighter">{activeSessions} Active Online Users</span>
                        </div>
                        <div className="h-4 w-px bg-white/10" />
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Audit Trail: {logs.length} Total Sessions</div>
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase italic tracking-[0.2em] flex items-center gap-2">
                        <Shield size={12} /> Secured Operation Database
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default Settings;