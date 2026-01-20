
import React, { useState, createContext, useCallback, useEffect, lazy, Suspense, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MOCK_PRODUCTS, MOCK_SHIPMENTS, MOCK_TESTERS } from './services/mockData';
import { ProductModel, Language, LocalizedString, Tester, ShipmentData, DEFAULT_SERIES, UserAccount, AppState, TesterGroup, AuditLog, AuditActivity } from './types';
import { api } from './services/api';
import { Cloud, CloudCheck, CloudOff, Loader2, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';

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

// New Component for Multi-user Warning
const MultiUserWarningModal = ({ users, onConfirm }: { users: string[], onConfirm: () => void }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md animate-slide-up p-10 text-center border border-white/20">
      <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-500 mx-auto mb-6 shadow-sm border border-amber-100">
        <AlertTriangle size={40} strokeWidth={2.5} />
      </div>
      <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">多人同步警示</h2>
      <p className="text-slate-500 text-sm mb-8 leading-relaxed">
        偵測到目前已有其他用戶在線：<br/>
        <span className="font-black text-slate-800 mt-2 block px-4 py-2 bg-slate-50 rounded-xl">
          {users.join(', ')}
        </span>
        <br/>
        為避免資料覆蓋，請確保您的編輯與他人協調同步。
      </p>
      <button 
        onClick={onConfirm}
        className="w-full py-4 bg-slate-900 text-white font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95"
      >
        已確認，進入系統
      </button>
    </div>
  </div>
);

const App = () => {
  const [language, setLanguage] = useState<Language>('en');
  
  // Try to restore session from sessionStorage on initial load
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = sessionStorage.getItem('intenza_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!sessionStorage.getItem('intenza_user'));
  
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
  const [analyticsTooltipScale, setAnalyticsTooltipScale] = useState<number>(2);
  const [analyticsTooltipPosition, setAnalyticsTooltipPosition] = useState<'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT' | 'FOLLOW'>('TOP_LEFT');
  const [evaluationModalYOffset, setEvaluationModalYOffset] = useState<number>(100);
  const [lastShipmentUpdate, setLastShipmentUpdate] = useState<string | undefined>(undefined);

  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorDetail, setErrorDetail] = useState<string>('');
  
  // State for concurrent user detection
  const [activeUsersAtLogin, setActiveUsersAtLogin] = useState<string[]>([]);
  
  const isSyncingRef = useRef(false);
  const initialLoadDone = useRef(false);

  // Dirty Checking References
  const originalStateRef = useRef<Record<string, any>>({});
  const latestStateRef = useRef<AppState | null>(null);

  useEffect(() => {
    latestStateRef.current = {
      products, seriesList, shipments, testers, testerGroups, users, auditLogs, language, showAiInsights, maxHistorySteps, customLogoUrl, globalStatusLightSize, dashboardColumns, cardAspectRatio, chartColorStyle, analyticsTooltipScale, analyticsTooltipPosition, evaluationModalYOffset, lastShipmentUpdate
    };
  }, [products, seriesList, shipments, testers, testerGroups, users, auditLogs, language, showAiInsights, maxHistorySteps, customLogoUrl, globalStatusLightSize, dashboardColumns, cardAspectRatio, chartColorStyle, analyticsTooltipScale, analyticsTooltipPosition, evaluationModalYOffset, lastShipmentUpdate]);

  const t = useCallback((str: any) => {
    if (!str) return '';
    if (typeof str === 'string') return str;
    return str[language] || str.en || str.zh || '';
  }, [language]);

  /**
   * Heartbeat Mechanism: 每 30 秒向後端發送一次心跳
   */
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isLoggedIn && currentUser) {
      interval = setInterval(() => {
        fetch('/api/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: currentUser.username })
        }).catch(err => console.debug('Heartbeat silent failure', err));
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoggedIn, currentUser]);

  /**
   * handleSyncToCloud 實作「Dirty Checking」髒檢查機制，並記錄操作紀錄
   */
  const handleSyncToCloud = useCallback(async (isAutoSync = false, partialData?: Partial<AppState>) => {
    if (isSyncingRef.current || !isLoggedIn || currentUser?.role === 'viewer') return;
    
    const currentState = {
      products, seriesList, shipments, testers, testerGroups, users, auditLogs, language, showAiInsights, maxHistorySteps, customLogoUrl, globalStatusLightSize, dashboardColumns, cardAspectRatio, chartColorStyle, analyticsTooltipScale, analyticsTooltipPosition, evaluationModalYOffset, lastShipmentUpdate
    };

    // 1. 決定要發送的資料 (Diffing)
    let payload: Partial<AppState> = {};
    let actionsTaken: string[] = [];
    
    if (partialData) {
      payload = partialData;
    } else {
      // 執行髒檢查：比對頂層 Key 的變動
      Object.keys(currentState).forEach(key => {
        const currentVal = (currentState as any)[key];
        const originalVal = originalStateRef.current[key];
        
        // 深度比對 (透過 JSON 字串化簡化複雜物件比對)
        if (JSON.stringify(currentVal) !== JSON.stringify(originalVal)) {
          (payload as any)[key] = currentVal;
          
          // 根據變動的 Key 產生易讀的操作紀錄描述
          switch(key) {
            case 'products': actionsTaken.push('更新產品目錄 (Products)'); break;
            case 'shipments': actionsTaken.push('更新出貨數據 (Shipments)'); break;
            case 'testers': actionsTaken.push('更新測試員資料 (Testers)'); break;
            case 'testerGroups': actionsTaken.push('更新測試分組 (Groups)'); break;
            case 'users': actionsTaken.push('修改使用者帳號 (Users)'); break;
            case 'seriesList': actionsTaken.push('調整產品系列清單'); break;
            case 'customLogoUrl': actionsTaken.push('更新系統標誌 (Logo)'); break;
            default: if (!isAutoSync) actionsTaken.push(`修改系統參數: ${key}`);
          }
        }
      });
    }

    // 2. 如果沒有任何變動，直接跳過網路請求
    if (Object.keys(payload).length === 0) {
      if (!isAutoSync) {
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 2000);
      }
      return;
    }

    // 3. 記錄操作紀錄 (Operation Record)
    // 排除僅包含 auditLogs 的自動更新 (避免遞迴日誌)
    const isOnlyLogs = Object.keys(payload).length === 1 && payload.auditLogs;
    if (actionsTaken.length > 0 && !isOnlyLogs && currentUser) {
        const actionDesc = actionsTaken.join(', ');
        const timestamp = new Date().toLocaleString();
        const newActivity: AuditActivity = { timestamp, action: actionDesc };

        setAuditLogs(prev => {
            const next = [...prev];
            const lastSessionIdx = [...next].reverse().findIndex(l => l.username === currentUser.username && !l.logoutTime);
            if (lastSessionIdx !== -1) {
                const actualIdx = next.length - 1 - lastSessionIdx;
                next[actualIdx] = {
                    ...next[actualIdx],
                    activities: [...(next[actualIdx].activities || []), newActivity]
                };
            }
            return next;
        });
    }

    isSyncingRef.current = true;
    setSyncStatus('saving');
    
    try {
      await api.saveData(payload as any);
      
      // 4. 同步成功後，更新 Original State 基準點
      Object.assign(originalStateRef.current, payload);
      
      setSyncStatus('success');
      setTimeout(() => {
        setSyncStatus('idle');
        isSyncingRef.current = false;
      }, isAutoSync ? 1500 : 3000);
    } catch (error: any) {
      console.error('Sync Error:', error);
      setSyncStatus('error');
      setErrorDetail(error.message || 'Connection Error');
      isSyncingRef.current = false;
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  }, [products, seriesList, shipments, testers, testerGroups, users, auditLogs, language, showAiInsights, maxHistorySteps, customLogoUrl, globalStatusLightSize, dashboardColumns, cardAspectRatio, chartColorStyle, analyticsTooltipScale, analyticsTooltipPosition, evaluationModalYOffset, lastShipmentUpdate, isLoggedIn, currentUser]);

  const handleLogout = useCallback(async () => {
    if (currentUser) {
      let updatedLogs: AuditLog[] = [];
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
        updatedLogs = logs;
        return logs;
      });
      
      // 登出時強制儲存 Audit Log (此處不經髒檢查，直接發送)
      handleSyncToCloud(true, { auditLogs: updatedLogs });

      setTimeout(() => {
        sessionStorage.removeItem('intenza_user');
        setIsLoggedIn(false);
        setCurrentUser(null);
        setActiveUsersAtLogin([]);
        originalStateRef.current = {}; // 清空基準點
      }, 500);
    } else {
      sessionStorage.removeItem('intenza_user');
      setIsLoggedIn(false);
      setCurrentUser(null);
      setActiveUsersAtLogin([]);
    }
  }, [currentUser, handleSyncToCloud]);

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

        const partialPayload = { auditLogs: logs };

        fetch('/api/workspace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(partialPayload),
          keepalive: true
        });
      }
    };

    window.addEventListener('beforeunload', handleBrowserClose);
    return () => window.removeEventListener('beforeunload', handleBrowserClose);
  }, [isLoggedIn, currentUser]);

  const handleLoginSuccess = useCallback((user: UserAccount) => {
    // Persistent session for refresh
    sessionStorage.setItem('intenza_user', JSON.stringify(user));
    
    // Before adding our new log, check if others are active
    const currentlyActive = auditLogs
      .filter(log => !log.logoutTime && log.username !== user.username)
      .map(log => log.username);
    
    const uniqueActive = Array.from(new Set(currentlyActive));
    if (uniqueActive.length > 0) {
      setActiveUsersAtLogin(uniqueActive);
    }

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      username: user.username,
      loginTime: new Date().toLocaleString(),
      activities: [{ timestamp: new Date().toLocaleString(), action: '登入系統' }]
    };
    
    setAuditLogs(prev => {
      const next = [...prev, newLog];
      handleSyncToCloud(true, { auditLogs: next });
      return next;
    });
    
    const fullUser = users.find(u => u.username === user.username) || user;
    setCurrentUser(fullUser);
    setIsLoggedIn(true);
  }, [users, auditLogs, handleSyncToCloud]);

  const handleLoadFromCloud = useCallback(async () => {
    if (isSyncingRef.current) return;
    setSyncStatus('saving');
    isSyncingRef.current = true;
    
    try {
      const cloudData = await api.loadData();
      if (cloudData) {
        // 儲存原始基準點快照 (Dirty Checking 原則)
        originalStateRef.current = JSON.parse(JSON.stringify(cloudData));

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
        if (cloudData.lastShipmentUpdate) setLastShipmentUpdate(cloudData.lastShipmentUpdate);
      }
      setSyncStatus('success');
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
    setLastShipmentUpdate(undefined);
    setTimeout(() => handleSyncToCloud(true, { shipments: [], lastShipmentUpdate: undefined }), 100);
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
      const timer = setTimeout(() => handleSyncToCloud(true), 2500);
      return () => clearTimeout(timer);
    }
  }, [users, seriesList, products, testers, testerGroups, shipments, auditLogs, customLogoUrl, globalStatusLightSize, dashboardColumns, cardAspectRatio, chartColorStyle, analyticsTooltipScale, analyticsTooltipPosition, evaluationModalYOffset, lastShipmentUpdate, isLoggedIn, handleSyncToCloud, currentUser]);

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
                    userRole={currentUser?.role}
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
                    userRole={currentUser?.role} 
                    currentUser={currentUser}
                    onUpdateProduct={async (p) => setProducts(products.map(old => old.id === p.id ? p : old))} 
                    showAiInsights={showAiInsights} 
                    evaluationModalYOffset={evaluationModalYOffset}
                  />
                } />
                <Route path="/analytics" element={
                  <Analytics 
                    products={products} shipments={shipments} testers={testers} 
                    lastShipmentUpdate={lastShipmentUpdate}
                    onImportData={(data) => {
                      setShipments([...shipments, ...data]);
                      setLastShipmentUpdate(new Date().toLocaleString());
                    }} 
                    onBatchAddProducts={(newPs) => setProducts([...products, ...newPs])} 
                    showAiInsights={showAiInsights} 
                    userRole={currentUser?.role} 
                    chartColorStyle={chartColorStyle} 
                    tooltipScale={analyticsTooltipScale} 
                    tooltipPosition={analyticsTooltipPosition}
                    onResetShipments={handleResetShipments}
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
                      currentAppState={{ products, seriesList, shipments, testers, testerGroups, users, auditLogs, language, showAiInsights, maxHistorySteps, customLogoUrl, globalStatusLightSize, dashboardColumns, cardAspectRatio, chartColorStyle, analyticsTooltipScale, analyticsTooltipPosition, evaluationModalYOffset, lastShipmentUpdate }}
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
                          if (state.lastShipmentUpdate) setLastShipmentUpdate(state.lastShipmentUpdate);
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
                      onDeleteLog={(id) => setAuditLogs(prev => prev.filter(l => l.id !== id))}
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

          {/* Active Users Warning Overlay */}
          {activeUsersAtLogin.length > 0 && (
            <MultiUserWarningModal 
              users={activeUsersAtLogin} 
              onConfirm={() => setActiveUsersAtLogin([])} 
            />
          )}

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
                    <span className="text-sm font-bold">{syncStatus === 'saving' ? t({en: 'Syncing', zh: '同步中'}) : syncStatus === 'success' ? t({en: 'Cloud Updated', zh: '雲端已更新'}) : t({en: 'Sync Error', zh: '同步異常'})}</span>
                    {syncStatus === 'error' && errorDetail && <span className="text-[10px] opacity-70 font-mono">{errorDetail}</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </LanguageContext.Provider>
  );
};

export default App;
