
import React, { useState, useRef, useContext, useEffect, useMemo } from 'react';
import { Plus, X, Save, Download, Upload, AlertTriangle, CheckCircle, Pencil, History, Sparkles, Shield, User, Trash2, Eye, EyeOff, Key, Database, HardDrive, Info, Cloud, LogOut, Loader2, Link as LinkIcon, Activity, Layers, ImageIcon, RotateCcw, Settings2, LayoutGrid, Maximize, Palette, MousePointer2, ClipboardList, Clock, Search, ChevronRight, Filter, UserRound, ArrowDown, GitCommit, UserCheck } from 'lucide-react';
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
  const [isLogBrowserOpen, setIsLogBrowserOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
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

  const tooltipPositions = [
    { label: 'TOP-L', value: 'TOP_LEFT' },
    { label: 'TOP-R', value: 'TOP_RIGHT' },
    { label: 'BTM-L', value: 'BOTTOM_LEFT' },
    { label: 'BTM-R', value: 'BOTTOM_RIGHT' },
    { label: 'FOLLOW', value: 'FOLLOW' },
  ];

  // Logs derived stats
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
                           {style === 'COLORFUL' ? t({en: 'Colorful', zh: '多彩(可自訂多主色)'}) : style === 'MONOCHROME' ? t({en: 'Monochrome', zh: '同色系(可自訂主色系)'}) : t({en: 'Slate', zh: '多主色系(可自訂多主色)'})}
                         </button>
                      ))}
                   </div>
                </div>

                <div className="pt-6 border-t border-slate-100 space-y-6">
                   <div className="flex items-center gap-2 text-slate-900">
                      <Settings2 className="text-intenza-600" size={18} />
                      <h3 className="text-sm font-black uppercase tracking-widest">Global Layout & Precision</h3>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                         <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><ArrowDown size={14} /> Evaluation Dialog Y-Offset (px)</label>
                         <div className="flex items-center gap-4">
                            <input type="range" min="0" max="600" step="10" value={currentAppState.evaluationModalYOffset || 100} onChange={(e) => onUpdateEvaluationModalYOffset?.(Number(e.target.value))} className="flex-1 accent-intenza-600" />
                            <span className="text-xs font-black font-mono bg-slate-100 px-3 py-1 rounded-lg">{(currentAppState.evaluationModalYOffset || 100)}px</span>
                         </div>
                      </div>
                      <div>
                         <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><MousePointer2 size={14} /> Analytics Tooltip Scale</label>
                         <div className="flex items-center gap-4">
                            <input type="range" min="1" max="4" step="0.5" value={currentAppState.analyticsTooltipScale || 2} onChange={(e) => onUpdateAnalyticsTooltipScale?.(Number(e.target.value))} className="flex-1 accent-slate-900" />
                            <span className="text-xs font-black font-mono bg-slate-100 px-3 py-1 rounded-lg">{(currentAppState.analyticsTooltipScale || 2).toFixed(1)}x</span>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2"><Shield className="text-intenza-600" size={20} /><h2 className="text-xl font-bold text-slate-900">帳號管理</h2></div>
                <button onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }} className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors"><Plus size={16} /> 新增用戶</button>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider"><tr><th className="px-6 py-4">使用者名稱</th><th className="px-6 py-4">權限</th><th className="px-6 py-4">密碼</th><th className="px-6 py-4 text-right">操作</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentAppState.users?.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><User size={16} /></div><span className="font-bold text-slate-700">{user.username}</span></div></td>
                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${user.role === 'admin' ? 'bg-intenza-100 text-intenza-700' : user.role === 'uploader' ? 'bg-emerald-100 text-emerald-700' : user.role === 'viewer' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{user.role}</span></td>
                        <td className="px-6 py-4"><div className="flex items-center gap-2 font-mono text-sm text-slate-400"><span>{showPasswordMap[user.id] ? user.password : '••••••••'}</span><button onClick={() => setShowPasswordMap(p => ({...p, [user.id]: !p[user.id]}))} className="hover:text-slate-600 transition-colors">{showPasswordMap[user.id] ? <EyeOff size={14} /> : <Eye size={14} />}</button></div></td>
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

          {/* REFACTORED: ACCOUNT SESSION TRACKING LOGS (Summary View) */}
          <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm group">
             <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <ClipboardList className="text-indigo-600" size={22} />
                    <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">帳號活動追蹤記錄</h2>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleExportLogs} className="p-2 text-slate-400 hover:text-slate-900 transition-colors" title="Export CSV/JSON"><Download size={18} /></button>
                </div>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Sessions</span>
                    <span className="text-2xl font-black text-slate-900">{logsCount.toLocaleString()}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Sessions</span>
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

             <button 
                onClick={() => setIsLogBrowserOpen(true)}
                className="w-full py-4 bg-indigo-50 hover:bg-indigo-100 border-2 border-dashed border-indigo-200 rounded-2xl flex items-center justify-center gap-3 transition-all text-indigo-600 font-black uppercase tracking-widest group/btn"
             >
                <Database size={20} className="group-hover/btn:scale-110 transition-transform" />
                <span>點入瀏覽完整日誌歷史</span>
                <ChevronRight size={18} />
             </button>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-2">產品系列配置</h2>
            <div className="flex gap-3 mb-6">
              <input type="text" value={newSeriesName} onChange={(e) => setNewSeriesName(e.target.value)} placeholder="輸入系列名稱..." className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-intenza-500/20 bg-slate-50 text-slate-900" onKeyPress={(e) => e.key === 'Enter' && handleAddSeries()}/>
              <button onClick={handleAddSeries} disabled={isSubmitting} className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:bg-slate-400">{isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />} 新增</button>
            </div>
            <div className="space-y-3">
              {seriesList.map((series, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 border-slate-100"><span className="font-medium text-slate-700">{t(series)}</span><div className="flex items-center gap-1"><button onClick={() => { if(window.confirm('確定刪除系列？')) { const nl = [...seriesList]; nl.splice(index,1); onUpdateSeriesList(nl); } }} className="text-slate-400 hover:text-red-600 p-2"><X size={18} /></button></div></div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-red-100 p-8 shadow-sm">
             <div className="flex items-center gap-2 mb-4 text-red-600"><AlertTriangle size={20} /><h2 className="text-xl font-bold">危險區域 (Danger Zone)</h2></div>
             <div className="p-4 bg-red-50 rounded-xl border border-red-100 mb-6"><p className="text-sm text-red-800 font-medium">數據維護操作：此區塊功能將永久刪除或更改核心數據，請謹謹執行。</p></div>
             <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"><div className="flex-1"><h3 className="font-bold text-slate-900">重置產品儀表板數據</h3><p className="text-xs text-slate-500 mt-1">清空所有導入的出貨記錄 (Shipment Data)。</p></div><button onClick={handleResetShipments} className="flex items-center gap-2 px-6 py-2.5 bg-white border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-600 hover:text-white transition-all shadow-sm"><Trash2 size={16} /> 清空出貨數據</button></div>
          </section>
        </div>

        <div className="space-y-8">
           <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-6"><Cloud className="text-intenza-600" size={20} /><h2 className="text-xl font-bold text-slate-900">雲端同步狀態</h2></div>
              <div className="space-y-3">
                  <button onClick={onSyncCloud} disabled={syncStatus === 'saving'} className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${syncStatus === 'saving' ? 'bg-slate-100 text-slate-400' : 'bg-intenza-600 text-white hover:bg-intenza-700 shadow-intenza-600/20'}`}>{syncStatus === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <Cloud size={18} />}{syncStatus === 'saving' ? '正在同步數據...' : '立即同步至 Postgres'}</button>
                  <button onClick={async () => { try { const tf = new File(["test"], "test.txt"); await api.uploadImage(tf); showNotification('Vercel Blob 連線正常！', 'success'); } catch (e) { showNotification('Blob 連線失敗', 'error'); } }} className="w-full py-3 rounded-xl font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"><Activity size={18} className="text-emerald-500" />測試 Blob 雲端連線</button>
              </div>
           </section>

           <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-2"><h2 className="text-xl font-bold text-slate-900">容量使用率</h2><span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">LIVE</span></div>
              <p className="text-sm text-slate-500 mb-6">監控 Vercel 與 Postgres 資源配額。</p>
              <div className="space-y-8">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider"><div className="flex items-center gap-2 text-slate-600"><Database size={14} className="text-indigo-500" />專案數據體積</div><span className={storageStats.sizePercent > 90 ? 'text-red-600' : 'text-slate-400'}>{storageStats.sizeInMB.toFixed(2)} MB / {storageStats.sizeLimitMB} MB</span></div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ${getProgressColor(storageStats.sizePercent)}`} style={{ width: `${storageStats.sizePercent}%` }}></div></div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider"><div className="flex items-center gap-2 text-slate-600"><Layers size={14} className="text-emerald-500" />資料庫記錄行數</div><span className="text-slate-400">{storageStats.rowCount.toLocaleString()} / {storageStats.rowLimit.toLocaleString()}</span></div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ${getProgressColor(storageStats.rowPercent)}`} style={{ width: `${storageStats.rowPercent}%` }}></div></div>
                </div>
              </div>
           </section>

           <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
             <h2 className="text-xl font-bold text-slate-900 mb-4">專案本地備份</h2>
             <div className="grid grid-cols-1 gap-4">
               <button onClick={handleDownloadProject} className="flex items-center justify-center gap-2 w-full py-2.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-all"><Download size={18} /> 導出 JSON 備份</button>
               <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-all"><Upload size={18} /> 載入 JSON 備份</button>
               <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportProject} />
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

      {isPermissionsModalOpen && editingUser && (
        <PermissionsModal 
          isOpen={isPermissionsModalOpen}
          onClose={() => setIsPermissionsModalOpen(false)}
          user={editingUser}
          products={currentAppState.products}
          seriesList={seriesList}
          onSave={(perms) => {
            onUpdateUser({ ...editingUser, granularPermissions: perms });
            setIsPermissionsModalOpen(false);
          }}
        />
      )}

      {isLogBrowserOpen && (
          <AuditLogBrowserModal 
            isOpen={isLogBrowserOpen}
            onClose={() => setIsLogBrowserOpen(false)}
            logs={currentAppState.auditLogs || []}
            onDeleteAll={() => { if(window.confirm('確定要清空所有追蹤日誌嗎？此動作無法復原。')) { onDeleteAuditLogs(); setIsLogBrowserOpen(false); } }}
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

/**
 * NEW: Granular Permissions Modal
 * Allows administrators to set permissions by Series, SKU, and Module.
 */
const PermissionsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  user: UserAccount;
  products: ProductModel[];
  seriesList: LocalizedString[];
  onSave: (perms: UserPermissions) => void;
}> = ({ isOpen, onClose, user, products, seriesList, onSave }) => {
  const { t } = useContext(LanguageContext);
  const [allowedSeries, setAllowedSeries] = useState<string[]>(user.granularPermissions?.allowedSeries || []);
  const [skuPermissions, setSkuPermissions] = useState<UserPermissions['skuPermissions']>(user.granularPermissions?.skuPermissions || {});
  const [searchTerm, setSearchTerm] = useState('');

  const handleToggleSeries = (seriesName: string) => {
    setAllowedSeries(prev => prev.includes(seriesName) ? prev.filter(s => s !== seriesName) : [...prev, seriesName]);
  };

  const handleToggleModule = (sku: string, module: 'design' | 'ergo' | 'durability') => {
    setSkuPermissions(prev => {
      const current = prev[sku] || { design: false, ergo: false, durability: false };
      return {
        ...prev,
        [sku]: { ...current, [module]: !current[module] }
      };
    });
  };

  const filteredProducts = products.filter(p => 
    t(p.modelName).toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t(p.series).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up border border-white/20">
        <header className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20"><Shield size={24} /></div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Granular Permissions</h2>
            </div>
            <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-widest">Managing access for: {user.username}</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-50 text-slate-500 rounded-full hover:bg-slate-100 transition-colors"><X size={24} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar">
          {/* Series Access */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Layers className="text-indigo-500" size={18} />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Series Level Authorization</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {seriesList.map(s => {
                const sName = t(s);
                const isSelected = allowedSeries.includes(sName);
                return (
                  <button 
                    key={sName}
                    onClick={() => handleToggleSeries(sName)}
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                      isSelected ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-md' : 'bg-slate-50 border-slate-50 text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    <span className="font-bold text-xs uppercase">{sName}</span>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${isSelected ? 'bg-indigo-500 border-indigo-400 text-white' : 'border-slate-200'}`}>
                      {isSelected && <CheckCircle size={12} strokeWidth={4} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* SKU / Module Access */}
          <section>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Settings2 className="text-slate-900" size={18} />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Specific SKU & Module Control</h3>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Filter SKUs..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm bg-slate-50/50">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                    <th className="px-6 py-4">Product Detail</th>
                    <th className="px-6 py-4 text-center">Design / ECO</th>
                    <th className="px-6 py-4 text-center">Ergonomics</th>
                    <th className="px-6 py-4 text-center">Durability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map(p => {
                    const perms = skuPermissions[p.sku] || { design: false, ergo: false, durability: false };
                    return (
                      <tr key={p.id} className="hover:bg-white transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center overflow-hidden">
                              {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-contain" /> : <ImageIcon size={14} className="text-slate-200" />}
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-900 leading-none">{t(p.modelName)}</div>
                              <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{p.sku}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <ModuleToggle active={perms.design} onClick={() => handleToggleModule(p.sku, 'design')} icon={<GitCommit size={14} />} color="indigo" />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <ModuleToggle active={perms.ergo} onClick={() => handleToggleModule(p.sku, 'ergo')} icon={<UserCheck size={14} />} color="emerald" />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <ModuleToggle active={perms.durability} onClick={() => handleToggleModule(p.sku, 'durability')} icon={<Activity size={14} />} color="rose" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <footer className="p-8 border-t border-slate-100 bg-white flex gap-4">
          <button onClick={onClose} className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all">Cancel</button>
          <button 
            onClick={() => onSave({ allowedSeries, skuPermissions })} 
            className="flex-1 py-4 bg-slate-900 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-[0.98]"
          >
            Save Permissions
          </button>
        </footer>
      </div>
    </div>
  );
};

const ModuleToggle = ({ active, onClick, icon, color }: { active: boolean, onClick: () => void, icon: React.ReactNode, color: string }) => {
  const colors: Record<string, string> = {
    indigo: active ? 'bg-indigo-600 text-white shadow-indigo-600/20' : 'bg-white text-slate-300 border-slate-100',
    emerald: active ? 'bg-emerald-600 text-white shadow-emerald-600/20' : 'bg-white text-slate-300 border-slate-100',
    rose: active ? 'bg-rose-600 text-white shadow-rose-600/20' : 'bg-white text-slate-300 border-slate-100',
  };

  return (
    <button 
      onClick={onClick}
      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm border ${colors[color]} hover:scale-110 active:scale-95 mx-auto`}
    >
      {icon}
    </button>
  );
};

/**
 * REFACTORED BROWSER MODAL FOR AUDIT LOGS
 */
const AuditLogBrowserModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    logs: AuditLog[];
    onDeleteAll: () => void;
    onExport: () => void;
}> = ({ isOpen, onClose, logs, onDeleteAll, onExport }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');

    const filteredLogs = useMemo(() => {
        return [...logs]
            .reverse()
            .filter(log => {
                const matchesSearch = log.username.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesFilter = 
                    filterStatus === 'ALL' || 
                    (filterStatus === 'ACTIVE' && !log.logoutTime) || 
                    (filterStatus === 'COMPLETED' && log.logoutTime);
                return matchesSearch && matchesFilter;
            });
    }, [logs, searchTerm, filterStatus]);

    const activeSessions = useMemo(() => logs.filter(l => !l.logoutTime).length, [logs]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white md:rounded-[2.5rem] shadow-2xl w-full h-full max-w-6xl overflow-hidden flex flex-col animate-slide-up">
                {/* Header */}
                <header className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white sticky top-0 z-10">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20"><History size={24} /></div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">完整帳號日誌歷史</h2>
                        </div>
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">{logs.length} Total Sessions Recorded</p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="flex gap-2">
                            <button onClick={onExport} className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-100" title="Export Logs"><Download size={20}/></button>
                            <button onClick={onDeleteAll} className="p-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl transition-all border border-rose-100" title="Purge History"><Trash2 size={20}/></button>
                        </div>
                        <div className="h-10 w-px bg-slate-100 hidden md:block mx-2" />
                        <button onClick={onClose} className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20"><X size={24} strokeWidth={3} /></button>
                    </div>
                </header>

                {/* Filter Bar */}
                <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row items-center gap-6">
                    <div className="relative flex-1 w-full">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="搜尋帳號名稱..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-indigo-500 outline-none transition-all shadow-sm"
                        />
                    </div>
                    <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 shrink-0">
                        {['ALL', 'ACTIVE', 'COMPLETED'].map((status) => (
                            <button 
                                key={status}
                                onClick={() => setFilterStatus(status as any)}
                                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                    filterStatus === status 
                                    ? 'bg-indigo-600 text-white shadow-lg' 
                                    : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-hidden relative flex flex-col">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {filteredLogs.length > 0 ? filteredLogs.map((log) => (
                                <div key={log.id} className="bg-white rounded-3xl border-2 border-slate-50 p-6 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group relative overflow-hidden">
                                    <div className={`absolute top-0 right-0 w-16 h-1 bg-gradient-to-l ${!log.logoutTime ? 'from-emerald-500 to-emerald-300' : 'from-slate-200 to-slate-100'}`} />
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-sm ${!log.logoutTime ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                <UserRound size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg">{log.username}</h3>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    {!log.logoutTime ? (
                                                        <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                            Currently Active
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md uppercase">Session Ended</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-4">
                                            <div>
                                                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Login Time</span>
                                                <span className="text-[11px] font-bold text-slate-700 leading-tight">{log.loginTime}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Logout Time</span>
                                                <span className="text-[11px] font-bold text-slate-700 leading-tight">{log.logoutTime || '-'}</span>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between border border-slate-100 shadow-inner">
                                            <div className="flex items-center gap-2">
                                                <Clock size={16} className="text-indigo-400" />
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Session Duration</span>
                                            </div>
                                            <span className="text-sm font-black text-indigo-600 font-mono">
                                                {log.durationMinutes ? `${log.durationMinutes}m` : (log.logoutTime ? '< 1m' : 'Live')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-6 pt-4 border-t border-slate-50 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                                        <div className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">Session ID: {log.id}</div>
                                    </div>
                                </div>
                            )) : (
                                <div className="col-span-full flex flex-col items-center justify-center py-32 text-slate-300 space-y-4">
                                    <div className="p-8 bg-slate-50 rounded-full"><Database size={64} className="opacity-20" /></div>
                                    <p className="font-black text-lg uppercase tracking-widest">找不到符合條件的日誌</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <footer className="p-6 bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Analytics Insights</div>
                        <div className="flex gap-4">
                             <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" /><span className="text-xs font-bold">{activeSessions} Active</span></div>
                             <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500" /><span className="text-xs font-bold">{logs.length} Total Logs</span></div>
                        </div>
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase italic">Records are synchronized with cloud workspace automatically.</div>
                </footer>
            </div>
        </div>
    );
};

export default Settings;
