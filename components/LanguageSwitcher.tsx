import React, { useContext } from 'react';
import { LanguageContext } from '../App';

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useContext(LanguageContext);

  if (!setLanguage) {
    return null;
  }

  const baseStyle = "px-4 py-1.5 rounded-md text-sm font-bold flex-1 text-center transition-all";
  const activeStyle = "bg-slate-900 text-white shadow-sm";
  const inactiveStyle = "text-slate-400 hover:bg-slate-200";

  return (
    <div className="flex bg-slate-100 rounded-lg p-1 w-full">
      <button 
        onClick={() => setLanguage('en')}
        className={`${baseStyle} ${language === 'en' ? activeStyle : inactiveStyle}`}
      >
        EN
      </button>
      <button 
        onClick={() => setLanguage('zh')}
        className={`${baseStyle} ${language === 'zh' ? activeStyle : inactiveStyle}`}
      >
        ZH
      </button>
    </div>
  );
};

export default LanguageSwitcher;