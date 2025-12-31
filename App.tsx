
import React, { useState, createContext, useCallback, useEffect, lazy, Suspense, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { MOCK_PRODUCTS, MOCK_SHIPMENTS, MOCK_TESTERS } from './services/mockData';
import { ProductModel, Language, LocalizedString, Tester, ShipmentData, DEFAULT_SERIES, UserAccount, AppState } from './types';
import { api } from './services/api';
import { Cloud, CloudCheck, CloudOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

// Using React.lazy for route-based code splitting
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Settings = lazy(() => import('./pages/Settings'));
const TesterDatabase = lazy(() => import('./pages/TesterDatabase'));

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

const PageLoader = () => (
  <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 min-h-[60vh]">
    <Loader2 size={40} className="text-intenza-600 animate-spin mb-4" />
    <p className="text-slate-500 font-medium animate-pulse text-sm">正在載入模組...</p>
  </div>
);

const App = () => {
  const [language, setLanguage] = useState<Language>('zh');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [products, setProducts] = useState<ProductModel[]>(MOCK_PRODUCTS);
  const [seriesList, setSeriesList] = useState<LocalizedString[]>(DEFAULT_SERIES);
  const [shipments, setShipments] = useState<ShipmentData[]>(MOCK_SHIPMENTS);
  const [testers, setTesters] = useState<Tester[]>(MOCK_TESTERS);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [showAiInsights, setShowAiInsights] = useState(true);
  const [maxHistorySteps, setMaxHistorySteps] = useState(10);

  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorDetail, setErrorDetail] = useState<string>('');
  
  // 使用 Ref 追蹤同步狀態，避免 useCallback 循環依賴
  const isSyncingRef = useRef(false);

  const t = useCallback((str: any) => {
    if (!str) return '';
    if (typeof str === 'string') return str;
    return str[language] || str.en || str.zh || '';
  }, [language]);

  const handleLogout = useCallback(() => {
    setIsLoggedIn(false);
  }, []);

  const handleSyncToCloud = useCallback(async (isAutoSync = false) => {
    if (isSyncingRef.current) return;
    
    isSyncingRef.current = true;
    setSyncStatus('saving');
    setErrorDetail('');
    
    const state: AppState = {
      products,
      seriesList,
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
      setTimeout(() => {
        setSyncStatus('idle');
        isSyncingRef.current = false;
      }, isAutoSync ? 2000 : 3000);
    } catch (error: any) {
      console.error('Cloud Sync Error:', error);
      setSyncStatus('error');
      setErrorDetail(error.message || '連線錯誤');
      isSyncingRef.current = false;
      setTimeout(() => setSyncStatus('idle'), 6000);
    }
  }, [products, seriesList, shipments, testers, users, language, showAiInsights, maxHistorySteps]);

  // 分離載入邏輯
  const handleLoadFromCloud = useCallback(async () => {
    if (isSyncingRef.current) return;
    
    setSyncStatus('saving');
    isSyncingRef.current = true;
    
    try {
      const cloudData = await api.loadData();
      if (cloudData) {
        if (cloudData.products) setProducts(cloudData.products);
        if (cloudData.seriesList) setSeriesList(cloudData.seriesList);
        if (cloudData.shipments) setShipments(cloudData.shipments);
        if (cloudData.testers) setTesters(cloudData.testers);
        if (cloudData.users) setUsers(cloudData.users);
        if (cloudData.language) setLanguage(cloudData.language);
        if (cloudData.showAiInsights !== undefined) setShowAiInsights(cloudData.showAiInsights);
        setSyncStatus('success');
      } else {
        // 第一次使用，同步預設資料
        console.log("No cloud data, initializing...");
      }
    } catch (error) {
      console.error('Failed to load cloud data:', error);
      setSyncStatus('error');
      setErrorDetail('無法獲取雲端資料，改用本地快取');
    } finally {
      isSyncingRef.current = false;
      setTimeout(() => setSyncStatus('idle'), 2000);
    }
  }, []);

  // 僅在登入狀態改變時觸發一次載入
  useEffect(() => {
    if (isLoggedIn) {
      handleLoadFromCloud();
    }
  }, [isLoggedIn, handleLoadFromCloud]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isLoggedIn) handleSyncToCloud();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoggedIn, handleSyncToCloud]);

  if (!isLoggedIn) {
    return <Login onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      <div className="flex min-h-screen bg-slate-50 relative">
        <Sidebar onLogout={handleLogout} />
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={
                <Dashboard 
                  products={products} 
                  seriesList={seriesList} 
                  onAddProduct={async (p) => setProducts([...products, { ...p, id: `p-${Date.now()}`, ergoProjects: [], customerFeedback: [], designHistory: [], ergoTests: [], durabilityTests: [], isWatched: false, customSortOrder: products.length, uniqueFeedbackTags: {} } as any])}
                  onUpdateProduct={async (p) => setProducts(products.map(old => old.id === p.id ? p : old))}
                  onToggleWatch={(id) => setProducts(products.map(p => p.id === id ? { ...p, isWatched: !p.isWatched } : p))}
                  onMoveProduct={(id, dir) => {
                    const idx = products.findIndex(p => p.id === id);
                    const targetIdx = dir === 'left' ? idx - 1 : idx + 1;
                    if (targetIdx >= 0 && targetIdx < products.length) {
                      const newP = [...products];
                      [newP[idx], newP[targetIdx]] = [newP[targetIdx], newP[idx]];
                      setProducts(newP);
                    }
                  }}
                  onDeleteProduct={(id) => setProducts(products.filter(p => p.id !== id))}
                />
              } />
              <Route path="/product/:id" element={
                <ProductDetail 
                  products={products} 
                  testers={testers}
                  onUpdateProduct={async (p) => setProducts(products.map(old => old.id === p.id ? p : old))}
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
                  seriesList={seriesList}
                  onAddSeries={async (name) => setSeriesList([...seriesList, { en: name, zh: name }])}
                  onUpdateSeriesList={(list) => setSeriesList(list)}
                  onRenameSeries={(idx, name) => {
                      const newList = [...seriesList];
                      newList[idx] = { ...newList[idx], [language]: name };
                      setSeriesList(newList);
                  }}
                  currentAppState={{ products, seriesList, shipments, testers, users, language, showAiInsights, maxHistorySteps }}
                  onLoadProject={(state) => {
                      if (state.products) setProducts(state.products);
                      if (state.seriesList) setSeriesList(state.seriesList);
                      if (state.shipments) setShipments(state.shipments);
                      if (state.testers) setTesters(state.testers);
                  }}
                  onUpdateMaxHistory={setMaxHistorySteps}
                  onToggleAiInsights={setShowAiInsights}
                  onAddUser={(u) => setUsers([...users, { ...u, id: Date.now().toString() }])}
                  onUpdateUser={(u) => setUsers(users.map(old => old.id === u.id ? u : old))}
                  onDeleteUser={(id) => setUsers(users.filter(u => u.id !== id))}
                  onSyncCloud={handleSyncToCloud}
                  onLogout={handleLogout}
                  syncStatus={syncStatus}
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
          </Suspense>
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
                  {syncStatus === 'error' ? errorDetail : '所有變更已儲存'}
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
