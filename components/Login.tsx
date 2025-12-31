
import React, { useState, useContext } from 'react';
import { Lock, User, Loader2, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
import { LanguageContext } from '../App';

interface LoginProps {
  onLoginSuccess: (user: {username: string, role: 'admin' | 'user'}) => void;
  customLogoUrl?: string;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, customLogoUrl }) => {
  const { t } = useContext(LanguageContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError(t({ en: 'Please enter credentials', zh: '請輸入帳號與密碼' }));
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const data = await api.login({ username, password });
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || t({ en: 'Login failed, check credentials', zh: '登入失敗，請檢查帳號密碼' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-intenza-900/20 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-intenza-600/10 rounded-full blur-[120px]"></div>

      <div className="w-full max-w-md animate-slide-up">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-10">
            {/* 品牌圖示區塊：圖片高度設為 h-20，移除背景容器並居中 */}
            <div className="h-20 flex items-center justify-center mb-6">
              {customLogoUrl ? (
                <img 
                  src={customLogoUrl} 
                  alt="Company Logo" 
                  className="h-full w-auto object-contain animate-fade-in" 
                />
              ) : (
                <div className="w-20 h-20 bg-intenza-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg shadow-intenza-600/20">
                  I
                </div>
              )}
            </div>
            
            <h1 className="text-2xl font-bold text-white tracking-tight uppercase text-center">
              {t({ en: 'Intenza Design Quality', zh: 'INTENZA 設計品質系統' })}
            </h1>
            <p className="text-slate-400 text-sm mt-2 text-center">
              {t({ en: 'QA & Ergonomics Management', zh: '品質追蹤與人因工程管理系統' })}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm text-center animate-shake">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="text"
                  placeholder={t({ en: 'Username', zh: '使用者名稱' })}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-intenza-500/50 transition-all"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="password"
                  placeholder={t({ en: 'Password', zh: '密碼' })}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-intenza-500/50 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-intenza-600 hover:bg-intenza-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-intenza-600/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  {t({ en: 'Login System', zh: '登入系統' })} <ChevronRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-slate-600 text-[10px] mt-12 italic">
            {t({ en: 'Initial auth via master admin account.', zh: '使用預設 Admin 帳號進行系統初始化。' })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
