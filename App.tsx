
import React, { useState, createContext, useCallback, useEffect, lazy, Suspense, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
  language: 'en',
  setLanguage: () => {},
  t: (str) => (str ? (str.en || str.zh || '') : ''),
});

const PageLoader = () => (
  <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 min-h-[60vh]">
    <Loader2 size={40} className="text-intenza-600 animate-spin mb-4" />
    <p className="text-slate-500 font-medium animate-pulse text-sm">Loading module...</p>
  </div>
);

const App = () => {
  const [language, setLanguage] = useState<Language>('en'); // Default to English
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<{username: string, role: 'admin' | 'user' | 'uploader'} | null>(null);
  
  const [products, setProducts] = useState<ProductModel[]>(MOCK_PRODUCTS);
  const [seriesList, setSeriesList] = useState<LocalizedString[]>(DEFAULT_SERIES);
  const [shipments, setShipments] = useState<ShipmentData[]>(MOCK_SHIPMENTS);
  const [testers, setTesters] = useState<Tester[]>(MOCK_TESTERS);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [showAiInsights, setShowAiInsights] = useState(false); // 預設關閉 AI
  const [maxHistorySteps, setMaxHistorySteps] = useState(10);
  const [customLogoUrl, setCustomLogoUrl] = useState<string | undefined>(undefined);

  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorDetail, setErrorDetail] = useState<string>('');
  
  const isSyncingRef = useRef(false);
  const initialLoadDone = useRef(false);

  const t = useCallback((str: any) => {
    if (!str) return '';
    if (typeof str === 'string') return str;
    return str[language] || str.en || str.zh || '';
  }, [language]);

  const handleLogout = useCallback(() => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    // Note: customLogoUrl stays to keep branding on login screen
  }, []);

  const handleSyncToCloud = useCallback(async (isAutoSync = false) => {
    if (isSyncingRef.current || !isLoggedIn) return;
    
    isSyncingRef.current = true;
    setSyncStatus('saving');
    
    const state: AppState = {
      products, seriesList, shipments, testers, users, language, showAiInsights, maxHistorySteps, customLogoUrl
    };

    try {
      await api.saveData(state);
      setSyncStatus('success');
      setTimeout(() => {
        setSyncStatus('idle');
        isSyncingRef.current = false;
      }, isAutoSync ? 2000 : 3000);
    } catch (error: any) {
      setSyncStatus('error');
      setErrorDetail(error.message || 'Connection Error');
      isSyncingRef.current = false;
    }
  }, [products, seriesList, shipments, testers, users, language, showAiInsights, maxHistorySteps, customLogoUrl, isLoggedIn]);

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
        if (cloudData.customLogoUrl) setCustomLogoUrl(cloudData.customLogoUrl);
        setSyncStatus('success');
      }
      initialLoadDone.current = true;
    } catch (error) {
      console.error('Cloud load error:', error);
      setSyncStatus('error');
    } finally {
      isSyncingRef.current = false;
      setTimeout(() => setSyncStatus('idle'), 2000);
    }
  }, []);

  const handleResetShipments = useCallback(() => {
    setShipments([]);
    // Immediately trigger a sync to cloud after clearing
    setTimeout(() => handleSyncToCloud(true), 100);
  }, [handleSyncToCloud]);

  // 初始載入（無論登入與否，為了讀取 Logo）
  useEffect(() => {
    if (!initialLoadDone.current) {
      handleLoadFromCloud();
    }
  }, [handleLoadFromCloud]);

  // 自動同步：僅在初始載入完成後，且資料發生變動時觸發
  useEffect(() => {
    if (isLoggedIn && initialLoadDone.current) {
      const timer = setTimeout(() => handleSyncToCloud(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [users, seriesList, products, testers, shipments, customLogoUrl, isLoggedIn, handleSyncToCloud]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {!isLoggedIn ? (
        <Login 
          customLogoUrl={customLogoUrl}
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            setIsLoggedIn(true);
          }} 
        />
      ) : (
        <div className="flex min-h-screen bg-slate-50 relative">
          <Sidebar 
            onLogout={handleLogout} 
            isAdmin={currentUser?.role === 'admin'} 
            onPush={handleSyncToCloud}
            onPull={handleLoadFromCloud}
            syncStatus={syncStatus}
            customLogoUrl={customLogoUrl}
          />
          <main className="flex-1 overflow-y-auto">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={
                  <Dashboard 
                    products={products} seriesList={seriesList} 
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
                  <ProductDetail products={products} testers={testers} onUpdateProduct={async (p) => setProducts(products.map(old => old.id === p.id ? p : old))} showAiInsights={showAiInsights} />
                } />
                <Route path="/analytics" element={
                  <Analytics products={products} shipments={shipments} testers={testers} onImportData={(data) => setShipments([...shipments, ...data])} onBatchAdd吸引Products={(newPs) => setProducts([...products, ...newPs])} showAiInsights={showAiInsights} userRole={currentUser?.role} />
                } />
                <Route path="/settings" element={
                  currentUser?.role === 'admin' ? (
                    <Settings 
                      seriesList={seriesList} onAddSeries={async (name) => setSeriesList([...seriesList, { en: name, zh: name }])} onUpdateSeriesList={(list) => setSeriesList(list)}
                      onRenameSeries={(idx, name) => {
                          const newList = [...seriesList];
                          newList[idx] = { ...newList[idx], [language]: name };
                          setSeriesList(newList);
                      }}
                      currentAppState={{ products, seriesList, shipments, testers, users, language, showAiInsights, maxHistorySteps, customLogoUrl }}
                      onLoadProject={(state) => {
                          if (state.products) setProducts(state.products);
                          if (state.seriesList) setSeriesList(state.seriesList);
                          if (state.shipments) setShipments(state.shipments);
                          if (state.testers) setTesters(state.testers);
                          if (state.users) setUsers(state.users);
                          if (state.customLogoUrl) setCustomLogoUrl(state.customLogoUrl);
                      }}
                      onUpdateMaxHistory={setMaxHistorySteps} onToggleAiInsights={setShowAiInsights}
                      onUpdateLogo={setCustomLogoUrl}
                      onAddUser={(u) => setUsers([...users, { ...u, id: Date.now().toString() }])}
                      onUpdateUser={(u) => setUsers(users.map(old => old.id === u.id ? u : old))}
                      onDeleteUser={(id) => setUsers(users.filter(u => u.id !== id))}
                      onSyncCloud={handleSyncToCloud} onLogout={handleLogout} syncStatus={syncStatus}
                      onResetDashboard={handleResetShipments}
                    />
                  ) : <Navigate to="/" />
                } />
                <Route path="/testers" element={
                  <TesterDatabase testers={testers} onAddTester={(t) => setTesters([...testers, { ...t, id: Date.now().toString() }])} onUpdateTester={(t) => setTesters(testers.map(old => old.id === t.id ? t : old))} onDeleteTester={(id) => setTesters(testers.filter(t => t.id !== id))} />
                } />
              </Routes>
            </Suspense>
          </main>

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
                <span className="text-sm font-bold">{syncStatus === 'saving' ? t({en: 'Syncing', zh: '同步中'}) : syncStatus === 'success' ? t({en: 'Cloud Updated', zh: '雲端已更新'}) : t({en: 'Sync Error', zh: '同步異常'})}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </LanguageContext.Provider>
  );
};

export default App;
