
import React, { useState, createContext, useCallback, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { MOCK_PRODUCTS, MOCK_SHIPMENTS, MOCK_TESTERS } from './services/mockData';
import { ProductModel, Language, LocalizedString, Tester, ShipmentData, DEFAULT_SERIES, UserAccount, AppState } from './types';
import { api } from './services/api';
import { Cloud, CloudCheck, CloudOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

// Importing pages
import { Dashboard } from './pages/Dashboard';
import ProductDetail from './pages/ProductDetail';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import TesterDatabase from './pages/TesterDatabase';
import Sidebar from './components/Sidebar';
import Login from './components/Login';

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (str: LocalizedString) => string;
}

export const LanguageContext = createContext<LanguageContextType>({
  language: 'zh',
  setLanguage: () => {},
  t: (str) => (str ? (str.zh || str.en || '') : ''),
});

const App = () => {
  const [language, setLanguage] = useState<Language>('zh');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [products, setProducts] = useState<ProductModel[]>(MOCK_PRODUCTS);
  const [shipments, setShipments] = useState<ShipmentData[]>(MOCK_SHIPMENTS);
  const [testers, setTesters] = useState<Tester[]>(MOCK_TESTERS);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [showAiInsights, setShowAiInsights] = useState(true);
  const [maxHistorySteps, setMaxHistorySteps] = useState(10);

  // Sync Status State
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const t = useCallback((str: any) => {
    if (!str) return '';
    if (typeof str === 'string') return str;
    return str[language] || str.en || str.zh || '';
  }, [language]);

  /**
   * 從雲端載入資料
   */
  const handleLoadFromCloud = useCallback(async () => {
    try {
      const cloudData = await api.loadData();
      if (cloudData) {
        if (cloudData.products) setProducts(cloudData.products);
        if (cloudData.shipments) setShipments(cloudData.shipments);
        if (cloudData.testers) setTesters(cloudData.testers);
        if (cloudData.users) setUsers(cloudData.users);
        if (cloudData.language) setLanguage(cloudData.language);
        if (cloudData.showAiInsights !== undefined) setShowAiInsights(cloudData.showAiInsights);
      }
    } catch (error) {
      console.error('Failed to load cloud data:', error);
    }
  }, []);

  /**
   * 將資料同步至雲端
   */
  const handleSyncToCloud = useCallback(async () => {
    if (syncStatus === 'saving') return;
    
    setSyncStatus('saving');
    const state: AppState = {
      products,
      seriesList: DEFAULT_SERIES,
      shipments,
      testers,
      users,
      language,
      showAiInsights,
      maxHistorySteps
    };

    try {
      await api.saveData(state);
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (error) {
      console.error('Cloud Sync Error:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  }, [products, shipments, testers, users, language, showAiInsights, maxHistorySteps, syncStatus]);

  /**
   * 登入後自動載入
   */
  useEffect(() => {
    if (isLoggedIn) {
      handleLoadFromCloud();
    }
  }, [isLoggedIn, handleLoadFromCloud]);

  /**
   * 快捷鍵監聽 Ctrl+S / Cmd+S
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isLoggedIn) {
          handleSyncToCloud();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoggedIn, handleSyncToCloud]);

  const handleAddProduct = async (p: any) => {
    const newProduct: ProductModel = { 
        ...p, 
        id: `p-${Date.now()}`, 
        ergoProjects: [], 
        customerFeedback: [], 
        designHistory: [], 
        ergoTests: [], 
        durabilityTests: [], 
        isWatched: false, 
        customSortOrder: products.length,
        uniqueFeedbackTags: {}
    };
    setProducts([...products, newProduct]);
  };

  const handleUpdateProduct = async (p: ProductModel) => {
    setProducts(products.map(old => old.id === p.id ? p : old));
  };

  const handleDeleteProduct = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
  };

  const handleToggleWatch = (id: string) => {
    setProducts(products.map(p => p.id === id ? { ...p, isWatched: !p.isWatched } : p));
  };

  const handleMoveProduct = (id: string, dir: 'left' | 'right') => {
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) return;
    const newProducts = [...products];
    const targetIdx = dir === 'left' ? idx - 1 : idx + 1;
    if (targetIdx >= 0 && targetIdx < products.length) {
      [newProducts[idx], newProducts[targetIdx]] = [newProducts[targetIdx], newProducts[idx]];
      setProducts(newProducts);
    }
  };

  if (!isLoggedIn) {
    return <Login onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      <div className="flex min-h-screen bg-slate-50 relative">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={
              <Dashboard 
                products={products} 
                seriesList={DEFAULT_SERIES} 
                onAddProduct={handleAddProduct}
                onUpdateProduct={handleUpdateProduct}
                onToggleWatch={handleToggleWatch}
                onMoveProduct={handleMoveProduct}
                onDeleteProduct={handleDeleteProduct}
              />
            } />
            <Route path="/product/:id" element={
              <ProductDetail 
                products={products} 
                testers={testers}
                onUpdateProduct={handleUpdateProduct}
                showAiInsights={showAiInsights}
              />
            } />
            <Route path="/analytics" element={
              <Analytics 
                products={products} 
                shipments={shipments} 
                testers={testers}
                onImportData={(data) => setShipments([...shipments, ...data])}
                onBatchAddProducts={(newPs) => setProducts([...products, ...newPs])}
                showAiInsights={showAiInsights}
              />
            } />
            <Route path="/settings" element={
              <Settings 
                seriesList={DEFAULT_SERIES}
                onAddSeries={async (name) => {}}
                onUpdateSeriesList={() => {}}
                onRenameSeries={() => {}}
                currentAppState={{ products, seriesList: DEFAULT_SERIES, shipments, testers, users, language, showAiInsights, maxHistorySteps }}
                onLoadProject={(state) => {
                    if (state.products) setProducts(state.products);
                    if (state.shipments) setShipments(state.shipments);
                    if (state.testers) setTesters(state.testers);
                }}
                onUpdateMaxHistory={setMaxHistorySteps}
                onToggleAiInsights={setShowAiInsights}
                onAddUser={(u) => setUsers([...users, { ...u, id: Date.now().toString() }])}
                onUpdateUser={(u) => setUsers(users.map(old => old.id === u.id ? u : old))}
                onDeleteUser={(id) => setUsers(users.filter(u => u.id !== id))}
              />
            } />
            <Route path="/testers" element={
              <TesterDatabase 
                testers={testers}
                onAddTester={(t) => setTesters([...testers, { ...t, id: Date.now().toString() }])}
                onUpdateTester={(t) => setTesters(testers.map(old => old.id === t.id ? t : old))}
                onDeleteTester={(id) => setTesters(testers.filter(t => t.id !== id))}
              />
            } />
          </Routes>
        </main>

        {/* Global Sync Status Notification */}
        {syncStatus !== 'idle' && (
          <div className="fixed bottom-6 right-6 z-[100] animate-slide-up">
            <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border backdrop-blur-md ${
              syncStatus === 'saving' ? 'bg-slate-900/90 text-white border-slate-700' :
              syncStatus === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400' :
              'bg-red-500/90 text-white border-red-400'
            }`}>
              {syncStatus === 'saving' && <Loader2 size={18} className="animate-spin" />}
              {syncStatus === 'success' && <CheckCircle size={18} />}
              {syncStatus === 'error' && <AlertCircle size={18} />}
              
              <div className="flex flex-col">
                <span className="text-sm font-bold leading-tight">
                  {syncStatus === 'saving' ? '正在同步至雲端...' :
                   syncStatus === 'success' ? '雲端同步成功' : '同步失敗'}
                </span>
                <span className="text-[10px] opacity-80 font-medium">
                  {syncStatus === 'saving' ? '請稍候，正在更新資料庫' :
                   syncStatus === 'success' ? '所有變更已儲存' : '伺服器未響應或連線錯誤'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </LanguageContext.Provider>
  );
};

export default App;
