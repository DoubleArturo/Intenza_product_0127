
import React, { useState } from 'react';
import { Lock, User, Loader2, ChevronRight, UserCircle } from 'lucide-react';
import { api } from '../services/api';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // 在實際生產環境中，這裡會呼叫後端 API
      // 為了方便測試，如果輸入 admin/admin 則模擬成功
      if (username === 'admin' && password === 'admin') {
          await new Promise(resolve => setTimeout(resolve, 800)); // 模擬網路延遲
          onLoginSuccess();
          return;
      }

      await api.login({ username, password });
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || '登入過程中發生錯誤 (測試可用 admin / admin)');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    setLoading(true);
    // 訪客模式：直接進入系統
    setTimeout(() => {
      onLoginSuccess();
    }, 500);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* 背景裝飾 */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-intenza-900/20 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-intenza-600/10 rounded-full blur-[120px]"></div>

      <div className="w-full max-w-md animate-slide-up">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-intenza-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg shadow-intenza-600/20 mb-4">
              I
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">INTENZA QUALITY</h1>
            <p className="text-slate-400 text-sm mt-2">品質追蹤與人因工程管理系統</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm text-center">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="text"
                  placeholder="使用者名稱 (測試用: admin)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-intenza-500/50 transition-all"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="password"
                  placeholder="密碼 (測試用: admin)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-intenza-500/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-intenza-600 hover:bg-intenza-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-intenza-600/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    登入系統
                    <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleGuestLogin}
                disabled={loading}
                className="w-full bg-white/5 hover:bg-white/10 text-slate-300 font-medium py-3 rounded-xl border border-white/5 transition-all flex items-center justify-center gap-2"
              >
                <UserCircle size={18} />
                以訪客身份進入 (免帳號)
              </button>
            </div>
          </form>

          <p className="text-center text-slate-500 text-xs mt-8">
            © {new Date().getFullYear()} INTENZA Fitness. 測試環境模式已開啟。
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
