
import React, { useContext, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BarChart2, Settings, LogOut } from 'lucide-react';
import { LanguageContext } from '../App';

interface SidebarProps {
  onLogout: () => void;
  isAdmin: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout, isAdmin }) => {
  const { t } = useContext(LanguageContext);
  const [isExpanded, setIsExpanded] = useState(false);

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
        <div className="w-10 h-10 bg-intenza-600 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-intenza-500/20 shadow-lg">
          I
        </div>
        <div className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
          <span className="text-xl font-bold tracking-tight text-slate-900">INTENZA</span>
        </div>
      </div>

      <nav className="flex-1 space-y-2 px-3">
        <NavLink to="/analytics" className={linkClass}>
          <div className="flex-shrink-0"><BarChart2 size={22} /></div>
          <span className={`font-medium transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
            {t({ en: 'Product Dashboard', zh: '產品儀表板' })}
          </span>
        </NavLink>

        <NavLink to="/" className={linkClass}>
          <div className="flex-shrink-0"><LayoutDashboard size={22} /></div>
          <span className={`font-medium transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
            {t({ en: 'Product Design', zh: '產品設計' })}
          </span>
        </NavLink>
      </nav>

      <div className="mt-auto px-3 pb-6 space-y-2">
        <div className="pt-4 border-t border-slate-100">
          {/* 僅 Admin 可見設定 */}
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
