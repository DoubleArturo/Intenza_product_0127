
import React, { useContext, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BarChart2, Settings, LogOut, CloudUpload, CloudDownload, Cloud, Loader2 } from 'lucide-react';
import { LanguageContext } from '../App';
import LanguageSwitcher from './LanguageSwitcher';

interface SidebarProps {
  onLogout: () => void;
  userRole?: string;
  onPush: () => void;
  onPull: () => void;
  syncStatus: 'idle' | 'saving' | 'success' | 'error';
  customLogoUrl?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout, userRole, onPush, onPull, syncStatus, customLogoUrl }) => {
  const { t } = useContext(LanguageContext);
  const [isExpanded, setIsExpanded] = useState(false);
  const isAdmin = userRole === 'admin';
  const isViewer = userRole === 'viewer';

  const containerClass = `bg-white border-r border-slate-200 h-screen sticky top-0 flex flex-col transition-all duration-300 ease-in-out z-50 ${
    isExpanded ? 'w-64 shadow-2xl' : 'w-20'
  }`;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 overflow-hidden whitespace-nowrap ${
      isActive
        ? 'bg-intenza-500 text-white shadow-lg shadow-intenza-500/30'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    } ${!isExpanded ? 'justify-center' : ''}`;

  return (
    <aside 
      className={containerClass}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className={`mb-8 flex items-center gap-3 px-4 py-6 transition-all duration-300 ${!isExpanded ? 'justify-center' : ''}`}>
        {/* Added bg-slate-900 to ensure visibility for white/reversed logos */}
        <div className={`w-10 h-10 flex items-center justify-center flex-shrink-0 overflow-hidden bg-slate-900 rounded-xl shadow-lg transition-transform ${isExpanded ? 'scale-110' : ''}`}>
          {customLogoUrl ? (
            <img src={customLogoUrl} alt="Logo" className="w-full h-full object-contain p-1.5" />
          ) : (
            <span className="text-white font-bold text-xl">I</span>
          )}
        </div>
        <div className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
          <span className="text-xl font-bold tracking-tight text-slate-900 uppercase">Intenza</span>
        </div>
      </div>

      <nav className="flex-1 space-y-2 px-3">
        <NavLink to="/analytics" className={linkClass}>
          <div className="flex-shrink-0"><BarChart2 size={22} /></div>
          <span className={`font-medium transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
            {t({ en: 'Product Info. Dashboard', zh: '產品資訊儀表板' })}
          </span>
        </NavLink>

        <NavLink to="/" className={linkClass}>
          <div className="flex-shrink-0"><LayoutDashboard size={22} /></div>
          <span className={`font-medium transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
            {t({ en: 'Product Design Status', zh: '產品設計狀態' })}
          </span>
        </NavLink>
      </nav>

      {/* Cloud Center */}
      <div className="px-3 mb-4">
        <div className={`bg-slate-50 rounded-2xl p-2 transition-all duration-300 ${isExpanded ? 'opacity-100' : 'opacity-100 flex flex-col items-center'}`}>
          <div className={`mb-2 px-2 flex items-center justify-between w-full ${!isExpanded ? 'hidden' : ''}`}>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Cloud size={10} /> {t({ en: 'Cloud Sync', zh: '雲端同步' })}
             </span>
             {syncStatus === 'saving' && <Loader2 size={10} className="text-intenza-600 animate-spin" />}
          </div>
          
          <div className={`flex gap-1 w-full ${!isExpanded ? 'flex-col' : ''}`}>
            {!isViewer && (
              <button 
                onClick={(e) => { e.preventDefault(); onPush(); }}
                disabled={syncStatus === 'saving'}
                title={t({ en: 'Push', zh: '推送' })}
                className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg transition-all ${
                  syncStatus === 'saving' ? 'bg-slate-200 text-slate-400' : 'bg-white border border-slate-200 text-slate-600 hover:text-intenza-600 hover:border-intenza-200 hover:shadow-sm'
                }`}
              >
                <CloudUpload size={18} />
                {isExpanded && <span className="text-[11px] font-bold">Push</span>}
              </button>
            )}
            {isAdmin && (
              <button 
                onClick={(e) => { e.preventDefault(); onPull(); }}
                disabled={syncStatus === 'saving'}
                title={t({ en: 'Pull', zh: '抓取' })}
                className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg transition-all ${
                  syncStatus === 'saving' ? 'bg-slate-200 text-slate-400' : 'bg-white border border-slate-200 text-slate-600 hover:text-emerald-600 hover:border-emerald-200 hover:shadow-sm'
                }`}
              >
                <CloudDownload size={18} />
                {isExpanded && <span className="text-[11px] font-bold">Pull</span>}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 pb-6 space-y-2">
        <div className="pt-4 border-t border-slate-100 space-y-2">
          
          {/* Language Switcher - Only fully visible when expanded */}
          {isExpanded && (
            <div className="px-1 py-1">
              <LanguageSwitcher />
            </div>
          )}

          {/* Settings */}
          {isAdmin && (
            <NavLink to="/settings" className={linkClass}>
              <div className="flex-shrink-0"><Settings size={22} /></div>
              <span className={`font-medium transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
                {t({ en: 'Settings', zh: '系統設定' })}
              </span>
            </NavLink>
          )}

          <button 
            onClick={onLogout}
            className={`flex items-center gap-4 px-4 py-3 text-red-400 hover:text-red-600 hover:bg-red-50 transition-all w-full rounded-xl overflow-hidden whitespace-nowrap ${!isExpanded ? 'justify-center' : ''}`}
          >
            <div className="flex-shrink-0"><LogOut size={22} /></div>
            <span className={`font-bold transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
              {t({ en: 'Logout', zh: '登出系統' })}
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
