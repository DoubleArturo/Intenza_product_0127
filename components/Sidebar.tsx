
import React, { useContext, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BarChart2, Settings, LogOut, CloudUpload, CloudDownload, Cloud, Loader2 } from 'lucide-react';
import { LanguageContext } from '../App';
import LanguageSwitcher from './LanguageSwitcher';
import { UserAccount, ModulePermissions } from '../types';

interface SidebarProps {
  onLogout: () => void;
  user?: {username: string, role: 'admin' | 'user' | 'uploader' | 'viewer', permissions?: UserAccount['permissions']};
  onPush: () => void;
  onPull: () => void;
  syncStatus: 'idle' | 'saving' | 'success' | 'error';
  customLogoUrl?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout, user, onPush, onPull, syncStatus, customLogoUrl }) => {
  const { t } = useContext(LanguageContext);
  const [isExpanded, setIsExpanded] = useState(false);
  const isAdmin = user?.role === 'admin';
  const isViewer = user?.role === 'viewer';

  // 檢查是否具備任何「同步」權限
  const canPush = (): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'viewer') return false;
    if (!user.permissions) return user.role === 'uploader' || user.role === 'user';

    const p = user.permissions;
    if (p.canSyncShipments) return true;
    
    // 檢查系列是否有任一同步權限
    // FIX: Explicitly casting to any to avoid TS unknown property access error
    if (Object.values(p.seriesAccess || {}).some((s: any) => s.canSync)) return true;
    
    // 檢查 SKU 模組是否有任一同步權限
    // FIX: Explicitly casting to any to avoid TS unknown property access error
    if (Object.values(p.skuAccess || {}).some((sku: any) => 
        sku.design?.canSync || sku.ergo?.canSync || sku.durability?.canSync
    )) return true;

    return false;
  };

  const containerClass = `bg-white border-r border-slate-200 h-screen sticky top-0 flex flex-col transition-all duration-300 ease-in-out z-50 ${isExpanded ? 'w-64 shadow-2xl' : 'w-20'}`;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 overflow-hidden whitespace-nowrap ${isActive ? 'bg-intenza-500 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'} ${!isExpanded ? 'justify-center' : ''}`;

  return (
    <aside className={containerClass} onMouseEnter={() => setIsExpanded(true)} onMouseLeave={() => setIsExpanded(false)}>
      <div className={`mb-8 flex items-center gap-3 px-4 py-6 transition-all duration-300 ${!isExpanded ? 'justify-center' : ''}`}>
        <div className="w-10 h-10 flex items-center justify-center bg-slate-900 rounded-xl shadow-lg">
          {customLogoUrl ? <img src={customLogoUrl} alt="Logo" className="w-full h-full object-contain p-1.5" /> : <span className="text-white font-bold text-xl">I</span>}
        </div>
        <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}><span className="text-xl font-bold tracking-tight text-slate-900 uppercase">Intenza</span></div>
      </div>

      <nav className="flex-1 space-y-2 px-3">
        <NavLink to="/analytics" className={linkClass}><div className="flex-shrink-0"><BarChart2 size={22} /></div>{isExpanded && <span className="font-medium">{t({ en: 'Dashboard', zh: '產品資訊儀表板' })}</span>}</NavLink>
        <NavLink to="/" className={linkClass}><div className="flex-shrink-0"><LayoutDashboard size={22} /></div>{isExpanded && <span className="font-medium">{t({ en: 'Status', zh: '產品設計狀態' })}</span>}</NavLink>
      </nav>

      <div className="px-3 mb-4">
        <div className="bg-slate-50 rounded-2xl p-2">
          {isExpanded && <div className="mb-2 px-2 text-[10px] font-bold text-slate-400 uppercase">Cloud Sync</div>}
          <div className={`flex gap-1 w-full ${!isExpanded ? 'flex-col' : ''}`}>
            {canPush() && (
              <button onClick={(e) => { e.preventDefault(); onPush(); }} disabled={syncStatus === 'saving'} className={`flex-1 flex items-center justify-center p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-intenza-600 transition-all ${syncStatus === 'saving' && 'bg-slate-200'}`} title="Push"><CloudUpload size={18} />{isExpanded && <span className="text-[11px] font-bold ml-2">Push</span>}</button>
            )}
            {isAdmin && (
              <button onClick={(e) => { e.preventDefault(); onPull(); }} disabled={syncStatus === 'saving'} className="flex-1 flex items-center justify-center p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-emerald-600 transition-all" title="Pull"><CloudDownload size={18} />{isExpanded && <span className="text-[11px] font-bold ml-2">Pull</span>}</button>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 pb-6 space-y-2">
        <div className="pt-4 border-t border-slate-100 space-y-2">
          {isExpanded && <div className="px-1 py-1"><LanguageSwitcher /></div>}
          {isAdmin && <NavLink to="/settings" className={linkClass}><div className="flex-shrink-0"><Settings size={22} /></div>{isExpanded && <span className="font-medium">{t({ en: 'Settings', zh: '系統設定' })}</span>}</NavLink>}
          <button onClick={onLogout} className={`flex items-center gap-4 px-4 py-3 text-red-400 hover:bg-red-50 transition-all w-full rounded-xl overflow-hidden ${!isExpanded ? 'justify-center' : ''}`}><LogOut size={22} />{isExpanded && <span className="font-bold">Logout</span>}</button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
