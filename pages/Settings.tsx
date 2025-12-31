
import React, { useState, useRef, useContext, useEffect, useMemo } from 'react';
import { Plus, X, Save, Download, Upload, AlertTriangle, CheckCircle, Pencil, History, Sparkles, Shield, User, Trash2, Eye, EyeOff, Key, Database, HardDrive, Info, Cloud, LogOut, Loader2, Link as LinkIcon, Activity, Layers, BrainCircuit, ClipboardList, Check } from 'lucide-react';
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
  onUpdateSearchDisplayFields: (fields: Record<string, boolean>) => void;
  onSyncCloud: () => Promise<void>;
  onLogout: () => void;
  syncStatus: 'idle' | 'saving' | 'success' | 'error';
}

const Settings: React.FC<SettingsProps> = ({ 
  seriesList, onAddSeries, onUpdateSeriesList, onRenameSeries, 
  currentAppState, onLoadProject, onUpdateMaxHistory, onToggleAiInsights,
  onAddUser, onUpdateUser, onDeleteUser, onUpdateSearchDisplayFields, onSyncCloud, onLogout, syncStatus
}) => {
  const { t } = useContext(LanguageContext);
  const [newSeriesName, setNewSeriesName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const toggleField = (key: string) => {
    const current = currentAppState.searchDisplayFields || {};
    onUpdateSearchDisplayFields({ ...current, [key]: !current[key] });
  };

  const fieldOptions = [
    { key: 'shipDate', label: '出貨日期 (Shipped date)' },
    { key: 'buyer', label: '客戶名稱 (Buyer)' },
    { key: 'deliveryNo', label: '送貨單號 (Delivery No.)' },
    { key: 'pi', label: 'P/I 號碼' },
    { key: 'pn', label: 'P/N 料號' },
    { key: 'variant', label: '產品描述 (Description)' },
    { key: 'version', label: '版本號 (Version)' },
    { key: 'category', label: '分類 (Category)' },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in space-y-8">
      <header className="border-b border-slate-100 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">System Configuration</h1>
          <p className="text-slate-500 mt-1">管理數據結構與追溯欄位顯示設定。</p>
        </div>
        <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors">
          <LogOut size={18} /> 登出系統
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* S/N 貨蹤查詢顯示設定 */}
          <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
             <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-intenza-50 rounded-xl text-intenza-600">
                  <ClipboardList size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">S/N 貨蹤追溯顯示設定</h2>
                  <p className="text-sm text-slate-500">勾選在查詢 S/N 序號時，前端條列結果中要呈現的資訊項目。</p>
                </div>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {fieldOptions.map((opt) => (
                   <button 
                     key={opt.key}
                     onClick={() => toggleField(opt.key)}
                     className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                       currentAppState.searchDisplayFields?.[opt.key] 
                         ? 'bg-intenza-50 border-intenza-200 text-intenza-900 ring-1 ring-intenza-200' 
                         : 'bg-slate-50 border-slate-200 text-slate-500'
                     }`}
                   >
                     <span className="text-sm font-bold">{opt.label}</span>
                     <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                       currentAppState.searchDisplayFields?.[opt.key] ? 'bg-intenza-600 text-white' : 'bg-slate-200 text-transparent'
                     }`}>
                        <Check size={12} strokeWidth={4} />
                     </div>
                   </button>
                ))}
             </div>
          </section>

          {/* User Management */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <Shield className="text-intenza-600" size={20} />
                    <h2 className="text-xl font-bold text-slate-900">帳號管理</h2>
                </div>
             </div>
             {/* ... 帳號管理列表內容 ... */}
          </section>
        </div>

        <div className="space-y-8">
           <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2"><Cloud size={20} className="text-intenza-600" /> 雲端同步</h2>
              <button onClick={onSyncCloud} className="w-full py-3 bg-intenza-600 text-white rounded-xl font-bold shadow-lg shadow-intenza-600/20">立即同步雲端資料庫</button>
           </section>
        </div>
      </div>
    </div>
  );
};

export default Settings;
