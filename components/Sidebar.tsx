import React, { useContext, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BarChart2, Settings, Menu } from 'lucide-react';
import { LanguageContext } from '../App';

const Sidebar = () => {
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
        {/* 1. Product Dashboard (Formerly Data Visualization) - Moved to Top */}
        <NavLink to="/analytics" className={linkClass}>
          <div className="flex-shrink-0">
            <BarChart2 size={22} />
          </div>
          <span className={`font-medium transition-opacity duration-300 ${isExpanded ? 'opacity-100 delay-75' : 'opacity-0 hidden'}`}>
            {t({ en: 'Product Dashboard', zh: '產品儀表板' })}
          </span>
        </NavLink>

        {/* 2. Product Design - Moved to Second */}
        <NavLink to="/" className={linkClass}>
          <div className="flex-shrink-0">
            <LayoutDashboard size={22} />
          </div>
          <span className={`font-medium transition-opacity duration-300 ${isExpanded ? 'opacity-100 delay-75' : 'opacity-0 hidden'}`}>
            {t({ en: 'Product Design', zh: '產品設計' })}
          </span>
        </NavLink>
      </nav>

      <div className="mt-auto px-3 pb-6">
        <div className="pt-4 mt-4 border-t border-slate-100">
          <NavLink to="/settings" className={`flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-slate-600 transition-colors w-full rounded-xl hover:bg-slate-50 overflow-hidden whitespace-nowrap ${!isExpanded ? 'justify-center' : ''}`}>
            <div className="flex-shrink-0">
              <Settings size={22} />
            </div>
            <span className={`font-medium transition-opacity duration-300 ${isExpanded ? 'opacity-100 delay-75' : 'opacity-0 hidden'}`}>
              {t({ en: 'Settings', zh: '設定' })}
            </span>
          </NavLink>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;