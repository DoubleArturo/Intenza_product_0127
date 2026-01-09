
import React, { useState, useRef, useContext, useEffect, useMemo } from 'react';
import { Plus, X, Save, Download, Upload, AlertTriangle, CheckCircle, Pencil, History, Sparkles, Shield, User, Trash2, Eye, EyeOff, Key, Database, HardDrive, Info, Cloud, LogOut, Loader2, Link as LinkIcon, Activity, Layers, ImageIcon, RotateCcw, Settings2, LayoutGrid, Maximize, Palette, MousePointer2, ClipboardList, Clock, Search, ChevronRight, Filter, UserRound, ArrowDown, Settings as SettingsIcon, Check } from 'lucide-react';
import { AppState, LocalizedString, UserAccount, AuditLog, UserPermissions, ProductModel, SkuPermission } from '../types';
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

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isLogBrowserOpen, setIsLogBrowserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  const storageStats = useMemo(() => {
    const rowCount = (currentAppState.products?.length || 0) + (currentAppState.shipments?.length || 0) + (currentAppState.testers?.length || 0) + (currentAppState.users?.length || 0);
    const sizeInMB = JSON.stringify(currentAppState).length / (1024 * 1024);
    return { 
      rowCount, rowLimit: 10000, rowPercent: Math.min(100, (rowCount / 10000) * 100), 
      sizeInMB, sizeLimitMB: 4.5, sizePercent: Math.min(100, (sizeInMB / 4.5) * 100)
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
    } catch (err) { showNotification('Logo 上傳失敗', 'error'); }
    finally { setIsUploadingLogo(false); if (logoInputRef.current) logoInputRef.current.value = ''; }
  };

  const handleDownloadProject = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentAppState, null, 2));
    const a = document.createElement('a'); a.href = dataStr; a.download = `intenza-project-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const handleAddSeries = async () => {
    if (!newSeriesName.trim()) return;
    setIsSubmitting(true);
    try { await onAddSeries(newSeriesName); setNewSeriesName(''); showNotification('系列已新增', 'success'); }
    catch (err) { showNotification('新增失敗', 'error'); }
    finally { setIsSubmitting(false); }
  };

  const handleResetShipments = () => {
    if (window.confirm('警告：這將會清空所有出貨數據。確定嗎？')) {
      onResetDashboard?.();
      showNotification('數據已清空', 'success');
    }
  };

  const aspectRatios = [
    { label: t({ en: 'Square (1:1)', zh: '方形 (1:1)' }), value: '1/1' },
    { label: t({ en: 'Portrait (3:4)', zh: '直式 (3:4)' }), value: '3/4' },
    { label: t({ en: 'Standard (4:3)', zh: '標準 (4:3)' }), value: '4/3' },
    { label: t({ en: 'Cinematic (16:9)', zh: '寬螢幕 (16:9)' }), value: '16/9' },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in space-y-8">
      <header className="border-b border-slate-100 pb-6 flex justify-between items-end">
        <div><h1 className="text-3xl font-bold text-slate-900">System Settings</h1><p className="text-slate-500 mt-1">系統配置、帳號管理與雲端存儲監控。</p></div>
        <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"><LogOut size={18} /> 登出系統</button>
      </header>

      {notification && (
        <div className={`fixed top-8 right-8 px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slide-up z-50 ${notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}<span className="font-medium">{notification.msg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
             <div className="flex items-center gap-2 mb-6"><Settings2 className="text-intenza-600" size={20} /><h2 className="text-xl font-bold text-slate-900">品牌視覺配置 (Login Logo)</h2></div>
             <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="w-32 h-32 rounded-2xl bg-slate-900 flex items-center justify-center overflow-hidden relative group shadow-inner">
                    {currentAppState.customLogoUrl ? <img src={currentAppState.customLogoUrl} alt="Logo" className="w-full h-full object-contain p-2" /> : <div className="text-white font-bold text-4xl">I</div>}
                    {isUploadingLogo && <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>}
                </div>
                <div className="flex-1 space-y-4">
                    <p className="text-sm text-slate-500">上傳您的公司 Logo。</p>
                    <div className="flex gap-3">
                        <button onClick={() => logoInputRef.current?.click()} disabled={isUploadingLogo} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 flex items-center gap-2"><Upload size={16} /> 上傳</button>
                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </div>
                </div>
             </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
             <div className="flex items-center gap-2 mb-6 text-slate-900"><Settings2 className="text-intenza-600" size={20} /><h2 className="text-xl font-bold">系統全域 UI 配置</h2></div>
             <div className="space-y-10">
                <div>
                   <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">產品指示燈大小</label>
                   <div className="flex gap-4">{['SMALL', 'NORMAL', 'LARGE'].map(sz => (<button key={sz} type="button" onClick={() => onUpdateStatusLightSize(sz as any)} className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold border-2 transition-all ${currentAppState.globalStatusLightSize === sz ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'}`}>{sz}</button>))}</div>
                </div>
                <div>
                   <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-4"><LayoutGrid size={14} />儀表板欄數</label>
                   <div className="flex gap-2">{[2, 3, 4, 5, 6].map(count => (<button key={count} type="button" onClick={() => onUpdateDashboardColumns(count)} className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold border-2 transition-all ${(currentAppState.dashboardColumns || 4) === count ? 'bg-intenza-600 text-white border-intenza-600 shadow-lg' : 'bg-white text-slate-500 border-slate-100'}`}>{count}</button>))}</div>
                </div>
                <div>
                   <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-4"><Maximize size={14} />卡片比例</label>
                   <div className="grid grid-cols-2 gap-3">{aspectRatios.map(ratio => (<button key={ratio.value} type="button" onClick={() => onUpdateCardAspectRatio(ratio.value)} className={`py-3 px-4 rounded-xl text-xs font-bold border-2 transition-all ${(currentAppState.cardAspectRatio || '3/4') === ratio.value ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'}`}>{ratio.label}</button>))}</div>
                </div>
             </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2"><Shield className="text-intenza-600" size={20} /><h2 className="text-xl font-bold text-slate-900">帳號管理</h2></div>
                <button onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }} className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2"><Plus size={16} /> 新增用戶</button>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider"><tr><th className="px-6 py-4">使用者名稱</th><th className="px-6 py-4">權限</th><th className="px-6 py-4">密碼</th><th className="px-6 py-4 text-right">操作</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentAppState.users?.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><User size={16} /></div><span className="font-bold text-slate-700">{user.username}</span></div></td>
                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${user.role === 'admin' ? 'bg-intenza-100 text-intenza-700' : 'bg-slate-100'}`}>{user.role}</span></td>
                        <td className="px-6 py-4"><div className="flex items-center gap-2 font-mono text-sm text-slate-400"><span>{showPasswordMap[user.id] ? user.password : '••••••••'}</span><button onClick={() => setShowPasswordMap(p => ({...p, [user.id]: !p[user.id]}))}>{showPasswordMap[user.id] ? <EyeOff size={14} /> : <Eye size={14} />}</button></div></td>
                        <td className="px-6 py-4 text-right"><div className="flex items-center justify-end gap-1"><button onClick={() => { setEditingUser(user); setIsUserModalOpen(true); }} className="p-2 text-slate-400 hover:text-intenza-600"><Pencil size={16} /></button><button onClick={() => { if(window.confirm('確定刪除？')) onDeleteUser(user.id); }} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-6">產品系列配置</h2>
            <div className="flex gap-3 mb-6">
              <input type="text" value={newSeriesName} onChange={(e) => setNewSeriesName(e.target.value)} placeholder="系列名稱..." className="flex-1 px-4 py-2 border rounded-lg bg-slate-50" />
              <button onClick={handleAddSeries} disabled={isSubmitting} className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800">{isSubmitting ? <Loader2 className="animate-spin" size={18} /> : '新增'}</button>
            </div>
            <div className="space-y-3">
              {seriesList.map((series, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border bg-slate-50"><span className="font-medium">{t(series)}</span><button onClick={() => { if(window.confirm('確定刪除？')) { const nl = [...seriesList]; nl.splice(index,1); onUpdateSeriesList(nl); } }} className="text-slate-400 hover:text-red-600"><X size={18} /></button></div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-8">
           <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-6"><Cloud className="text-intenza-600" size={20} /><h2 className="text-xl font-bold text-slate-900">雲端同步狀態</h2></div>
              <button onClick={onSyncCloud} disabled={syncStatus === 'saving'} className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${syncStatus === 'saving' ? 'bg-slate-100 text-slate-400' : 'bg-intenza-600 text-white shadow-lg shadow-intenza-600/20'}`}>{syncStatus === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <Cloud size={18} />}同步數據</button>
           </section>
           <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm"><h2 className="text-xl font-bold text-slate-900 mb-4">容量使用率</h2><div className="space-y-8"><div className="space-y-2"><div className="flex justify-between text-[11px] font-bold uppercase"><div className="flex items-center gap-2"><Database size={14} />數據體積</div><span>{storageStats.sizeInMB.toFixed(2)} MB / 4.5 MB</span></div><div className="w-full bg-slate-100 h-2 rounded-full"><div className="h-full bg-indigo-500" style={{ width: `${storageStats.sizePercent}%` }}></div></div></div></div></section>
        </div>
      </div>

      {isUserModalOpen && (
        <UserAccountModal 
          isOpen={isUserModalOpen} 
          onClose={() => setIsUserModalOpen(false)}
          onSave={(data) => { if (editingUser) onUpdateUser({ ...editingUser, ...data } as any); else onAddUser(data as any); setIsUserModalOpen(false); }} 
          user={editingUser}
          seriesList={seriesList}
          products={currentAppState.products}
        />
      )}

      {isLogBrowserOpen && <AuditLogBrowserModal isOpen={isLogBrowserOpen} onClose={() => setIsLogBrowserOpen(false)} logs={currentAppState.auditLogs || []} onDeleteAll={onDeleteAuditLogs} onExport={() => {}} />}
    </div>
  );
};

const UserAccountModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: (data: Omit<UserAccount, 'id'>) => void;
  user: UserAccount | null;
  seriesList: LocalizedString[];
  products: ProductModel[];
}> = ({ isOpen, onClose, onSave, user, seriesList, products }) => {
  const [formData, setFormData] = useState({ username: '', password: '', role: 'user' as any });
  const [perms, setPerms] = useState<UserPermissions>(user?.permissions || { allowedSeries: ['ALL'], skuOverrides: {} });
  
  // New SKU selection state
  const [skuSearch, setSkuSearch] = useState('');
  
  useEffect(() => { 
    if (user) {
        setFormData({ username: user.username, password: user.password, role: user.role });
        setPerms(user.permissions || { allowedSeries: ['ALL'], skuOverrides: {} });
    } else {
        setFormData({ username: '', password: '', role: 'user' });
        setPerms({ allowedSeries: ['ALL'], skuOverrides: {} });
    }
  }, [user, isOpen]);

  const toggleSeries = (sName: string) => {
    let list = [...perms.allowedSeries];
    if (sName === 'ALL') {
        list = ['ALL'];
    } else {
        list = list.filter(l => l !== 'ALL');
        if (list.includes(sName)) list = list.filter(l => l !== sName);
        else list.push(sName);
        if (list.length === 0) list = ['ALL'];
    }
    setPerms({ ...perms, allowedSeries: list });
  };

  const addSkuOverride = (sku: string) => {
    if (perms.skuOverrides[sku]) return;
    setPerms({ ...perms, skuOverrides: { ...perms.skuOverrides, [sku]: { design: true, ergo: true, durability: true } } });
    setSkuSearch('');
  };

  const updateSkuPerm = (sku: string, area: keyof SkuPermission, val: boolean) => {
    const override = { ...perms.skuOverrides[sku], [area]: val };
    setPerms({ ...perms, skuOverrides: { ...perms.skuOverrides, [sku]: override } });
  };

  const removeSkuOverride = (sku: string) => {
    const next = { ...perms.skuOverrides };
    delete next[sku];
    setPerms({ ...perms, skuOverrides: next });
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave({ ...formData, permissions: perms }); };

  const filteredSkuList = products.filter(p => p.sku.toLowerCase().includes(skuSearch.toLowerCase()) && !perms.skuOverrides[p.sku]).slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl animate-slide-up overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-100"><h2 className="text-xl font-bold text-slate-900">{user ? '編輯用戶' : '新增系統用戶'}</h2><button onClick={onClose}><X size={20} /></button></div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
           <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold text-slate-500 mb-1">使用者名稱</label><input type="text" required value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className="w-full px-4 py-2 border rounded-lg bg-slate-50" /></div>
              <div><label className="block text-xs font-bold text-slate-500 mb-1">密碼</label><input type="text" required value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full px-4 py-2 border rounded-lg bg-slate-50" /></div>
           </div>
           
           <div>
              <label className="block text-xs font-bold text-slate-500 mb-3">帳號基本權限角色</label>
              <div className="grid grid-cols-4 gap-2 bg-slate-100 p-1 rounded-xl">
                   {['admin', 'uploader', 'user', 'viewer'].map(r => (
                       <button key={r} type="button" onClick={() => setFormData({ ...formData, role: r as any })} className={`py-2 text-[10px] font-bold rounded-lg transition-all ${formData.role === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>{r.toUpperCase()}</button>
                   ))}
              </div>
           </div>

           {(formData.role === 'user' || formData.role === 'uploader') && (
              <div className="space-y-6 pt-4 border-t border-slate-100">
                 <div className="flex items-center gap-2 text-intenza-600"><SettingsIcon size={18} /><h3 className="text-sm font-black uppercase tracking-widest">Granular Access Control (細部權限劃分)</h3></div>
                 
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">1. Series Access (系列層級)</label>
                    <div className="flex flex-wrap gap-2">
                       <button type="button" onClick={() => toggleSeries('ALL')} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${perms.allowedSeries.includes('ALL') ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>ALL SERIES</button>
                       {seriesList.map(s => (
                          <button key={s.en} type="button" onClick={() => toggleSeries(s.en)} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${perms.allowedSeries.includes(s.en) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>{s.en}</button>
                       ))}
                    </div>
                 </div>

                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">2. SKU Functional Overrides (SKU 功能層級)</label>
                    <div className="relative mb-4">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" placeholder="Search SKU to add override..." value={skuSearch} onChange={e => setSkuSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-slate-50 border rounded-xl text-sm outline-none" />
                        {skuSearch && filteredSkuList.length > 0 && (
                            <div className="absolute top-full left-0 w-full bg-white border rounded-xl shadow-2xl z-20 mt-1 overflow-hidden">
                                {filteredSkuList.map(p => (
                                    <button key={p.id} type="button" onClick={() => addSkuOverride(p.sku)} className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-slate-50 flex items-center justify-between"><span>{p.sku}</span><Plus size={12} /></button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        {Object.entries(perms.skuOverrides).map(([sku, sp]) => (
                            <div key={sku} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div className="flex flex-col"><span className="text-[10px] font-black text-slate-400 uppercase mb-1">SKU</span><span className="font-mono text-xs font-bold text-slate-900">{sku}</span></div>
                                <div className="flex gap-4">
                                    {(['design', 'ergo', 'durability'] as const).map(area => (
                                        <button key={area} type="button" onClick={() => updateSkuPerm(sku, area, !sp[area])} className={`flex flex-col items-center gap-1 group`}>
                                            <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter group-hover:text-slate-500 transition-colors">{area}</span>
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${sp[area] ? 'bg-intenza-600 text-white border-intenza-500 shadow-md' : 'bg-white text-slate-300 border-slate-100 shadow-inner'}`}>
                                                {sp[area] ? <Check size={14} strokeWidth={4} /> : <X size={14} />}
                                            </div>
                                        </button>
                                    ))}
                                    <button type="button" onClick={() => removeSkuOverride(sku)} className="ml-2 p-2 text-slate-300 hover:text-red-500 transition-colors self-end"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>
              </div>
           )}

           <div className="pt-8 flex gap-3 sticky bottom-0 bg-white/90 backdrop-blur-md pb-4"><button type="button" onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold">取消</button><button type="submit" className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-xl">儲存用戶配置</button></div>
        </form>
      </div>
    </div>
  );
};

const AuditLogBrowserModal: React.FC<{ isOpen: boolean; onClose: () => void; logs: AuditLog[]; onDeleteAll: () => void; onExport: () => void; }> = ({ isOpen, onClose, logs, onDeleteAll, onExport }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full h-full max-w-4xl overflow-hidden flex flex-col">
                <header className="p-8 border-b flex justify-between items-center"><h2 className="text-2xl font-bold">Audit Logs</h2><button onClick={onClose}><X size={24}/></button></header>
                <div className="flex-1 overflow-y-auto p-8"><div className="space-y-4">{logs.map(log => (<div key={log.id} className="p-4 bg-slate-50 rounded-xl border"><span>{log.username}</span> - {log.loginTime}</div>))}</div></div>
            </div>
        </div>
    );
};

export default Settings;
