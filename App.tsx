
import React, { useState, createContext, useCallback, useEffect, lazy, Suspense, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MOCK_PRODUCTS, MOCK_SHIPMENTS, MOCK_TESTERS } from './services/mockData';
import { ProductModel, Language, LocalizedString, Tester, ShipmentData, DEFAULT_SERIES, UserAccount, AppState } from './types';
import { api } from './services/api';
import { Cloud, CloudCheck, CloudOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

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
  const [language, setLanguage] = useState<Language>('en');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<{username: string, role: 'admin' | 'user'} | null>(null);
  
  const [products, setProducts] = useState<ProductModel[]>(MOCK_PRODUCTS);
  const [seriesList, setSeriesList] = useState<LocalizedString[]>(DEFAULT_SERIES);
  const [shipments, setShipments] = useState<ShipmentData[]>([]); 
  const [testers, setTesters] = useState<Tester[]>(MOCK_TESTERS);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [showAiInsights, setShowAiInsights] = useState(false);
  const [maxHistorySteps, setMaxHistorySteps] = useState(10);
  const [searchDisplayFields, setSearchDisplayFields] = useState<Record<string, boolean>>({
    sn: true, pn: true, pi: true, deliveryNo: true, buyer: true, shipDate: true, variant: true, version: true
  });

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
    initialLoadDone.current = false;
  }, []);

  const handleSyncToCloud = useCallback(async (isAutoSync = false) => {
    if (isSyncingRef.current || !isLoggedIn) return;
    isSyncingRef.current = true;
    setSyncStatus('saving');
    const state: AppState = {
      products, seriesList, shipments, testers, users, language, showAiInsights, maxHistorySteps, searchDisplayFields
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
  }, [products, seriesList, shipments, testers, users, language, showAiInsights, maxHistorySteps, searchDisplayFields, isLoggedIn]);

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
        if (cloudData.searchDisplayFields) setSearchDisplayFields(cloudData.searchDisplayFields);
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

  useEffect(() => {
    if (isLoggedIn && initialLoadDone.current) {
      const timer = setTimeout(() => handleSyncToCloud(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [users, seriesList, products, testers, shipments, searchDisplayFields, isLoggedIn, handleSyncToCloud]);

  useEffect(() => {
    if (isLoggedIn && !initialLoadDone.current) {
      handleLoadFromCloud();
    }
  }, [isLoggedIn, handleLoadFromCloud]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {!isLoggedIn ? (
        <Login onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsLoggedIn(true);
        }} />
      ) : (
        <div className="flex min-h-screen bg-slate-50 relative">
          <Sidebar 
            onLogout={handleLogout} 
            isAdmin={currentUser?.role === 'admin'} 
            onPush={handleSyncToCloud}
            onPull={handleLoadFromCloud}
            syncStatus={syncStatus}
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
                  <Analytics products={products} shipments={shipments} testers={testers} onImportData={(data) => setShipments([...shipments, ...data])} onBatchAddProducts={(newPs) => setProducts([...products, ...newPs])} showAiInsights={showAiInsights} searchDisplayFields={searchDisplayFields} />
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
                      currentAppState={{ products, seriesList, shipments, testers, users, language, showAiInsights, maxHistorySteps, searchDisplayFields }}
                      onLoadProject={(state) => {
                          if (state.products) setProducts(state.products);
                          if (state.seriesList) setSeriesList(state.seriesList);
                          if (state.shipments) setShipments(state.shipments);
                          if (state.testers) setTesters(state.testers);
                          if (state.users) setUsers(state.users);
                          if (state.searchDisplayFields) setSearchDisplayFields(state.searchDisplayFields);
                      }}
                      onUpdateMaxHistory={setMaxHistorySteps} onToggleAiInsights={setShowAiInsights}
                      onAddUser={(u) => setUsers([...users, { ...u, id: Date.now().toString() }])}
                      onUpdateUser={(u) => setUsers(users.map(old => old.id === u.id ? u : old))}
                      onDeleteUser={(id) => setUsers(users.filter(u => u.id !== id))}
                      onUpdateSearchDisplayFields={setSearchDisplayFields}
                      onSyncCloud={handleSyncToCloud} onLogout={handleLogout} syncStatus={syncStatus}
                    />
                  ) : <Navigate to="/" />
                } />
                <Route path="/testers" element={
                  <TesterDatabase testers={testers} onAddTester={(t) => setTesters([...testers, { ...t, id: Date.now().toString() }])} onUpdateTester={(t) => setTesters(testers.map(old => old.id === t.id ? t : old))} onDeleteTester={(id) => setTesters(testers.filter(t => t.id !== id))} />
                } />
              </Routes>
            </Suspense>
          </main>
        </div>
      )}
    </LanguageContext.Provider>
  );
};

export default App;
