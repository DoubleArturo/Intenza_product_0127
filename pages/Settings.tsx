
import React, { useState, useRef, useContext, useEffect, useMemo } from 'react';
// Added missing 'Check' icon to the lucide-react import list
import { Plus, X, Save, Download, Upload, AlertTriangle, CheckCircle, Pencil, History, Sparkles, Shield, User, Trash2, Eye, EyeOff, Key, Database, HardDrive, Info, Cloud, LogOut, Loader2, Link as LinkIcon, Activity, Layers, ImageIcon, RotateCcw, Settings2, LayoutGrid, Maximize, Palette, MousePointer2, ClipboardList, Clock, Search, ChevronRight, Filter, UserRound, ArrowDown, Lock, Check } from 'lucide-react';
import { AppState, LocalizedString, UserAccount, AuditLog, UserPermissions } from '../types';
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
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isLogBrowserOpen, setIsLogBrowserOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in space-y-8">
      <header className="border-b border-slate-100 pb-6 flex justify-between items-end">
        <div><h1 className="text-3xl font-bold text-slate-900">System Settings</h1><p className="text-slate-500 mt-1">系統配置、帳號管理與權限劃分。</p></div>
        <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"><LogOut size={18} /> 登出系統</button>
      </header>

      {notification && (
        <div className={`fixed top-8 right-8 px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slide-up z-50 ${notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span className="font-medium">{notification.msg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2"><Shield className="text-intenza-600" size={20} /><h2 className="text-xl font-bold text-slate-900">帳號管理與權限劃分</h2></div>
                <button onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }} className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors"><Plus size={16} /> 新增用戶</button>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider"><tr><th className="px-6 py-4">使用者名稱</th><th className="px-6 py-4">權限</th><th className="px-6 py-4">密碼</th><th className="px-6 py-4 text-right">操作</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentAppState.users?.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><User size={16} /></div><span className="font-bold text-slate-700">{user.username}</span></div></td>
                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${user.role === 'admin' ? 'bg-intenza-100 text-intenza-700' : 'bg-slate-100 text-slate-600'}`}>{user.role}</span></td>
                        <td className="px-6 py-4"><div className="flex items-center gap-2 font-mono text-sm text-slate-400"><span>{showPasswordMap[user.id] ? user.password : '••••••••'}</span><button onClick={() => setShowPasswordMap(p => ({...p, [user.id]: !p[user.id]}))} className="hover:text-slate-600">{showPasswordMap[user.id] ? <EyeOff size={14} /> : <Eye size={14} />}</button></div></td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setEditingUser(user); setIsPermissionModalOpen(true); }} className="p-2 text-indigo-500 hover:text-indigo-700" title="權限設定"><Lock size={16} /></button>
                            <button onClick={() => { setEditingUser(user); setIsUserModalOpen(true); }} className="p-2 text-slate-400 hover:text-intenza-600"><Pencil size={16} /></button>
                            <button onClick={() => { if(window.confirm(`確定要刪除用戶 ${user.username}？`)) onDeleteUser(user.id); }} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </section>
      </div>

      {isUserModalOpen && <UserAccountModal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} onSave={(data) => { if (editingUser) onUpdateUser({ ...editingUser, ...data } as any); else onAddUser(data as any); setIsUserModalOpen(false); }} user={editingUser} />}
      {isPermissionModalOpen && editingUser && (
        <UserPermissionModal 
          isOpen={isPermissionModalOpen} 
          onClose={() => setIsPermissionModalOpen(false)} 
          user={editingUser}
          seriesList={seriesList}
          products={currentAppState.products}
          onSave={(perms) => { onUpdateUser({ ...editingUser, permissions: perms }); setIsPermissionModalOpen(false); showNotification('權限設定已儲存', 'success'); }}
        />
      )}
    </div>
  );
};

const UserPermissionModal = ({ isOpen, onClose, user, seriesList, products, onSave }: any) => {
    const { t } = useContext(LanguageContext);
    const [perms, setPerms] = useState<UserPermissions>(user.permissions || { canUploadShipments: false, seriesAccess: {}, skuAccess: {} });

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">User Permissions</h2>
                        <p className="text-sm text-slate-400 mt-1">Configuring access for <b>{user.username}</b></p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500"><X size={24}/></button>
                </div>
                
                <div className="p-8 overflow-y-auto space-y-10 custom-scrollbar">
                    {/* Global Upload Access */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
                            <div><h3 className="font-bold text-slate-900">Shipment Data Upload</h3><p className="text-xs text-slate-500">權限 a: 允許上傳並同步 Analytics 頁面的出貨資料</p></div>
                            <button onClick={() => setPerms({...perms, canUploadShipments: !perms.canUploadShipments})} className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${perms.canUploadShipments ? 'bg-intenza-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200'}`}>{perms.canUploadShipments ? 'Allowed' : 'Denied'}</button>
                        </div>
                    </section>

                    {/* Series Access */}
                    <section className="space-y-4">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Series Management (權限 b)</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {seriesList.map((s: any) => {
                                const title = t(s);
                                const isSelected = !!perms.seriesAccess[title];
                                return (
                                    <button key={title} onClick={() => setPerms({...perms, seriesAccess: {...perms.seriesAccess, [title]: !isSelected}})} className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-2 ${isSelected ? 'border-intenza-500 bg-intenza-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                                        <div className="text-sm font-black text-slate-900 leading-tight">{title}</div>
                                        <div className={`text-[9px] font-black uppercase tracking-widest ${isSelected ? 'text-intenza-600' : 'text-slate-300'}`}>{isSelected ? 'Full Access' : 'No Access'}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {/* SKU Granular Access */}
                    <section className="space-y-4">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Granular SKU Access (權限 b - 特殊劃分)</h3>
                        <div className="border border-slate-100 rounded-2xl overflow-hidden">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-3">SKU ID</th>
                                        <th className="px-6 py-3 text-center">Design & ECO</th>
                                        <th className="px-6 py-3 text-center">Ergonomics</th>
                                        <th className="px-6 py-3 text-center">Durability</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {products.map((p: any) => {
                                        const sku = p.sku;
                                        const skuPerm = perms.skuAccess[sku] || { design: false, ergo: false, durability: false };
                                        const toggle = (field: keyof typeof skuPerm) => {
                                            setPerms({ ...perms, skuAccess: { ...perms.skuAccess, [sku]: { ...skuPerm, [field]: !skuPerm[field] } } });
                                        };
                                        return (
                                            <tr key={sku} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-bold text-slate-700">{sku} <span className="text-[9px] text-slate-300 block font-normal">{t(p.modelName)}</span></td>
                                                <td className="px-6 py-4 text-center"><button type="button" onClick={() => toggle('design')} className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all mx-auto ${skuPerm.design ? 'bg-indigo-600 text-white' : 'bg-white border-slate-200'}`}>{skuPerm.design && <Check size={14}/>}</button></td>
                                                <td className="px-6 py-4 text-center"><button type="button" onClick={() => toggle('ergo')} className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all mx-auto ${skuPerm.ergo ? 'bg-indigo-600 text-white' : 'bg-white border-slate-200'}`}>{skuPerm.ergo && <Check size={14}/>}</button></td>
                                                <td className="px-6 py-4 text-center"><button type="button" onClick={() => toggle('durability')} className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all mx-auto ${skuPerm.durability ? 'bg-indigo-600 text-white' : 'bg-white border-slate-200'}`}>{skuPerm.durability && <Check size={14}/>}</button></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                <div className="p-8 border-t border-slate-100 bg-white sticky bottom-0 flex gap-4">
                    <button onClick={onClose} className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all">Cancel</button>
                    <button onClick={() => onSave(perms)} className="flex-1 py-4 bg-slate-900 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all shadow-2xl shadow-slate-900/30">Save All Permissions</button>
                </div>
            </div>
        </div>
    );
};

const UserAccountModal = ({ user, isOpen, onClose, onSave }: any) => {
    const [d, setD] = useState(user || { username: '', password: '', role: 'user' });
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl animate-slide-up">
                <h3 className="text-xl font-bold mb-6">{user ? 'Edit User' : 'New User'}</h3>
                <div className="space-y-4 mb-8">
                    <div><label className="text-xs font-bold text-slate-400 uppercase">Username</label><input type="text" value={d.username} onChange={e=>setD({...d, username: e.target.value})} className="w-full p-2 border rounded-xl bg-slate-50"/></div>
                    <div><label className="text-xs font-bold text-slate-400 uppercase">Password</label><input type="text" value={d.password} onChange={e=>setD({...d, password: e.target.value})} className="w-full p-2 border rounded-xl bg-slate-50"/></div>
                    <div><label className="text-xs font-bold text-slate-400 uppercase">Role</label><select value={d.role} onChange={e=>setD({...d, role: e.target.value as any})} className="w-full p-2 border rounded-xl bg-slate-50"><option value="admin">Admin</option><option value="user">Standard User</option><option value="uploader">Uploader</option><option value="viewer">Viewer</option></select></div>
                </div>
                <div className="flex gap-2"><button onClick={onClose} className="flex-1 py-2 font-bold text-slate-400">Cancel</button><button onClick={()=>onSave(d)} className="flex-1 py-2 bg-slate-900 text-white rounded-xl font-bold">Save</button></div>
            </div>
        </div>
    );
};

export default Settings;
