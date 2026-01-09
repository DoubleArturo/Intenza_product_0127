
import React, { useState, createContext, useCallback, useEffect, lazy, Suspense, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MOCK_PRODUCTS, MOCK_SHIPMENTS, MOCK_TESTERS } from './services/mockData';
import { ProductModel, Language, LocalizedString, Tester, ShipmentData, DEFAULT_SERIES, UserAccount, AppState, TesterGroup, AuditLog } from './types';
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
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  
  const [products, setProducts] = useState<ProductModel[]>(MOCK_PRODUCTS);
  const [seriesList, setSeriesList] = useState<LocalizedString[]>(DEFAULT_SERIES);
  const [shipments, setShipments] = useState<ShipmentData[]>(MOCK_SHIPMENTS);
  const [testers, setTesters] = useState<Tester[]>(MOCK_TESTERS);
  const [testerGroups, setTesterGroups] = useState<TesterGroup[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showAiInsights, setShowAiInsights] = useState(false); 
  const [maxHistorySteps, setMaxHistorySteps] = useState(10);
  const [customLogoUrl, setCustomLogoUrl] = useState<string | undefined>(undefined);
  const [globalStatusLightSize, setGlobalStatusLightSize] = useState<'SMALL' | 'NORMAL' | 'LARGE'>('NORMAL');
  const [dashboardColumns, setDashboardColumns] = useState<number>(4);
  const [cardAspectRatio, setCardAspectRatio] = useState<string>('3/4');
  const [chartColorStyle, setChartColorStyle] = useState<'COLORFUL' | 'MONOCHROME' | 'SLATE'>('COLORFUL');
  const [analyticsTooltipScale, setAnalyticsTooltipScale] = useState<number>(2); // Default to 2x as requested
  const [analyticsTooltipPosition, setAnalyticsTooltipPosition] = useState<'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT' | 'FOLLOW'>('TOP_LEFT');
  const [evaluationModalYOffset, setEvaluationModalYOffset] = useState<number>(100); // Default to 100px from top

  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorDetail, setErrorDetail] = useState<string>('');
  
  const isSyncingRef = useRef(false);
  const initialLoadDone = useRef(false);

  // Ref to track the latest state for the window-close handler
  const latestStateRef = useRef<AppState | null>(null);
  useEffect(() => {
    latestStateRef.current = {
      products, seriesList, shipments, testers, testerGroups, users, auditLogs, language, showAiInsights, maxHistorySteps, customLogoUrl, globalStatusLightSize, dashboardColumns, cardAspectRatio, chartColorStyle, analyticsTooltipScale, analyticsTooltipPosition, evaluationModalYOffset
    };
  }, [products, seriesList, shipments, testers, testerGroups, users, auditLogs, language, showAiInsights, maxHistorySteps, customLogoUrl, globalStatusLightSize, dashboardColumns, cardAspectRatio, chartColorStyle, analyticsTooltipScale, analyticsTooltipPosition, evaluationModalYOffset]);

  const t = useCallback((str: any) => {
    if (!str) return '';
    if (typeof str === 'string') return str;
    return str[language] || str.en || str.zh || '';
  }, [language]);

  const handleSyncToCloud = useCallback(async (isAutoSync = false) => {
    if (isSyncingRef.current || !isLoggedIn || currentUser?.role === 'viewer') return;
    
    isSyncingRef.current = true;
    setSyncStatus('saving');
    
    const state: AppState = {
      products, seriesList, shipments, testers, testerGroups, users, auditLogs, language, showAiInsights, maxHistorySteps, customLogoUrl, globalStatusLightSize, dashboardColumns, cardAspectRatio, chartColorStyle, analyticsTooltipScale, analyticsTooltipPosition, evaluationModalYOffset
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
  }, [products, seriesList, shipments, testers, testerGroups, users, auditLogs, language, showAiInsights, maxHistorySteps, customLogoUrl, globalStatusLightSize, dashboardColumns, cardAspectRatio, chartColorStyle, analyticsTooltipScale, analyticsTooltipPosition, evaluationModalYOffset, isLoggedIn, currentUser]);

  const handleLogout = useCallback(async () => {
    if (currentUser) {
      // Find the last login entry for this user that hasn't logged out yet
      setAuditLogs(prev => {
        const logs = [...prev];
        const lastIndex = [...logs].reverse().findIndex(l => l.username === currentUser.username && !l.logoutTime);
        if (lastIndex !== -1) {
            const actualIndex = logs.length - 1 - lastIndex;
            const now = new Date();
            const loginDate = new Date(logs[actualIndex].loginTime);
            const diffMs = now.getTime() - loginDate.getTime();
            const diffMins = Math.max(1, Math.round(diffMs / 60000));
            
            logs[actualIndex] = {
                ...logs[actualIndex],
                logoutTime: now.toLocaleString(),
                durationMinutes: diffMins
            };
        }
        return logs;
      });
      
      // Wait a tiny bit for state to settle then attempt a final sync before closing session
      setTimeout(() => {
        setIsLoggedIn(false);
        setCurrentUser(null);
      }, 500);
    } else {
      setIsLoggedIn(false);
      setCurrentUser(null);
    }
  }, [currentUser]);

  // Handle automatic logout when browser tab/window is closed
  useEffect(() => {
    const handleBrowserClose = () => {
      if (!isLoggedIn || !currentUser || !latestStateRef.current) return;

      const currentState = latestStateRef.current;
      const logs = [...(currentState.auditLogs || [])];
      const lastIndex = [...logs].reverse().findIndex(l => l.username === currentUser.username && !l.logoutTime);
      
      if (lastIndex !== -1) {
        const actualIndex = logs.length - 1 - lastIndex;
        const now = new Date();
        const loginDate = new Date(logs[actualIndex].loginTime);
        const diffMs = now.getTime() - loginDate.getTime();
        const diffMins = Math.max(1, Math.round(diffMs / 60000));
        
        logs[actualIndex] = {
          ...logs[actualIndex],
          logoutTime: now.toLocaleString(),
          durationMinutes: diffMins
        };

        const finalState: AppState = {
          ...currentState,
          auditLogs: logs
        };

        // Use keepalive fetch to ensure the sync completes even as tab closes
        fetch('/api/workspace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalState),
          keepalive: true
        });
      }
    };

    window.addEventListener('beforeunload', handleBrowserClose);
    return () => window.removeEventListener('beforeunload', handleBrowserClose);
  }, [isLoggedIn, currentUser]);

  const handleLoginSuccess = useCallback((user: any) => {
    // Find full user object from current users list if available, or use the response
    const fullUser = users.find(u => u.username === user.username) || user;
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      username: user.username,
      loginTime: new Date().toLocaleString()
    };
    setAuditLogs(prev => [...prev, newLog]);
    setCurrentUser(fullUser);
    setIsLoggedIn(true);
  }, [users]);

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
        if (cloudData.testerGroups) setTesterGroups(cloudData.testerGroups);
        if (cloudData.users) setUsers(cloudData.users);
        if (cloudData.auditLogs) setAuditLogs(cloudData.auditLogs);
        if (cloudData.language) setLanguage(cloudData.language);
        if (cloudData.showAiInsights !== undefined) setShowAiInsights(cloudData.showAiInsights);
        if (cloudData.customLogoUrl) setCustomLogoUrl(cloudData.customLogoUrl);
        if (cloudData.globalStatusLightSize) setGlobalStatusLightSize(cloudData.globalStatusLightSize);
        if (cloudData.dashboardColumns) setDashboardColumns(cloudData.dashboardColumns);
        if (cloudData.cardAspectRatio) setCardAspectRatio(cloudData.cardAspectRatio);
        if (cloudData.chartColorStyle) setChartColorStyle(cloudData.chartColorStyle);
        if (cloudData.analyticsTooltipScale !== undefined) setAnalyticsTooltipScale(cloudData.analyticsTooltipScale);
        if (cloudData.analyticsTooltipPosition) setAnalyticsTooltipPosition(cloudData.analyticsTooltipPosition);
        if (cloudData.evaluationModalYOffset !== undefined) setEvaluationModalYOffset(cloudData.evaluationModalYOffset);
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
    if (currentUser?.role === 'viewer') return;
    setShipments([]);
    setTimeout(() => handleSyncToCloud(true), 100);
  }, [handleSyncToCloud, currentUser]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isLoggedIn && currentUser?.role !== 'viewer') {
          handleSyncToCloud();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoggedIn, handleSyncToCloud, currentUser]);

  useEffect(() => {
    if (!initialLoadDone.current) {
      handleLoadFromCloud();
    }
  }, [handleLoadFromCloud]);

  useEffect(() => {
    if (isLoggedIn && initialLoadDone.current && currentUser?.role !== 'viewer') {
      const timer = setTimeout(() => handleSyncToCloud(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [users, seriesList, products, testers, testerGroups, shipments, auditLogs, customLogoUrl, globalStatusLightSize, dashboardColumns, cardAspectRatio, chartColorStyle, analyticsTooltipScale, analyticsTooltipPosition, evaluationModalYOffset, isLoggedIn, handleSyncToCloud, currentUser]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {!isLoggedIn ? (
        <Login 
          customLogoUrl={customLogoUrl}
          onLoginSuccess={handleLoginSuccess} 
        />
      ) : (
        <div className="flex min-h-screen bg-slate-50 relative">
          <Sidebar 
            onLogout={handleLogout} 
            userRole={currentUser?.role} 
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
                    currentUser={currentUser}
                    globalStatusLightSize={globalStatusLightSize}
                    dashboardColumns={dashboardColumns}
                    cardAspectRatio={cardAspectRatio}
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
                    products={products} shipments={shipments} testers={testers} testerGroups={testerGroups} 
                    currentUser={currentUser} onUpdateProduct={async (p) => setProducts(products.map(old => old.id === p.id ? p : old))} 
                    showAiInsights={showAiInsights} 
                    evaluationModalYOffset={evaluationModalYOffset}
                  />
                } />
                <Route path="/analytics" element={
                  <Analytics 
                    products={products} shipments={shipments} testers={testers} onImportData={(data) => setShipments([...shipments, ...data])} onBatchAddProducts={(newPs) => setProducts([...products, ...newPs])} showAiInsights={showAiInsights} userRole={currentUser?.role} chartColorStyle={chartColorStyle} 
                    tooltipScale={analyticsTooltipScale} tooltipPosition={analyticsTooltipPosition}
                  />
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
                      currentAppState={{ products, seriesList, shipments, testers, testerGroups, users, auditLogs, language, showAiInsights, maxHistorySteps, customLogoUrl, globalStatusLightSize, dashboardColumns, cardAspectRatio, chartColorStyle, analyticsTooltipScale, analyticsTooltipPosition, evaluationModalYOffset }}
                      onLoadProject={(state) => {
                          if (state.products) setProducts(state.products);
                          if (state.seriesList) setSeriesList(state.seriesList);
                          if (state.shipments) setShipments(state.shipments);
                          if (state.testers) setTesters(state.testers);
                          if (state.testerGroups) setTesterGroups(state.testerGroups);
                          if (state.users) setUsers(state.users);
                          if (state.auditLogs) setAuditLogs(state.auditLogs);
                          if (state.customLogoUrl) setCustomLogoUrl(state.customLogoUrl);
                          if (state.globalStatusLightSize) setGlobalStatusLightSize(state.globalStatusLightSize);
                          if (state.dashboardColumns) setDashboardColumns(state.dashboardColumns);
                          if (state.cardAspectRatio) setCardAspectRatio(state.cardAspectRatio);
                          if (state.chartColorStyle) setChartColorStyle(state.chartColorStyle);
                          if (state.analyticsTooltipScale !== undefined) setAnalyticsTooltipScale(state.analyticsTooltipScale);
                          if (state.analyticsTooltipPosition) setAnalyticsTooltipPosition(state.analyticsTooltipPosition);
                          if (state.evaluationModalYOffset !== undefined) setEvaluationModalYOffset(state.evaluationModalYOffset);
                      }}
                      onUpdateMaxHistory={setMaxHistorySteps} onToggleAiInsights={setShowAiInsights}
                      onUpdateLogo={setCustomLogoUrl}
                      onUpdateStatusLightSize={setGlobalStatusLightSize}
                      onUpdateDashboardColumns={setDashboardColumns}
                      onUpdateCardAspectRatio={setCardAspectRatio}
                      onUpdateChartColorStyle={setChartColorStyle}
                      onUpdateAnalyticsTooltipScale={setAnalyticsTooltipScale}
                      onUpdateAnalyticsTooltipPosition={setAnalyticsTooltipPosition}
                      onUpdateEvaluationModalYOffset={setEvaluationModalYOffset}
                      onAddUser={(u) => setUsers([...users, { ...u, id: Date.now().toString() }])}
                      onUpdateUser={(u) => setUsers(users.map(old => old.id === u.id ? u : old))}
                      onDeleteUser={(id) => setUsers(users.filter(u => u.id !== id))}
                      onDeleteAuditLogs={() => setAuditLogs([])}
                      onSyncCloud={handleSyncToCloud} onLogout={handleLogout} syncStatus={syncStatus}
                      onResetDashboard={handleResetShipments}
                    />
                  ) : <Navigate to="/" />
                } />
                <Route path="/testers" element={
                  <TesterDatabase 
                    testers={testers} 
                    testerGroups={testerGroups}
                    cardAspectRatio={cardAspectRatio}
                    userRole={currentUser?.role} 
                    onAddTester={(t) => setTesters([...testers, { ...t, id: Date.now().toString() }])} 
                    onUpdateTester={(t) => setTesters(testers.map(old => old.id === t.id ? t : old))} 
                    onDeleteTester={(id) => setTesters(testers.filter(t => t.id !== id))}
                    onAddGroup={(g) => setTesterGroups([...testerGroups, { ...g, id: Date.now().toString() }])}
                    onUpdateGroup={(g) => setTesterGroups(testerGroups.map(old => old.id === g.id ? g : old))}
                    onDeleteGroup={(id) => setTesterGroups(testerGroups.filter(g => g.id !== id))}
                  />
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
