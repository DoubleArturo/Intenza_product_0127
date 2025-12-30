
import React, { useState, useEffect, createContext, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import { Dashboard } from './pages/Dashboard';
import ProductDetail from './pages/ProductDetail';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import TesterDatabase from './pages/TesterDatabase';
import { MOCK_PRODUCTS, MOCK_SHIPMENTS, MOCK_TESTERS } from './services/mockData';
import { ProductModel, ShipmentData, DEFAULT_SERIES, AppState, Language, LocalizedString, DesignChange, Tester, UserAccount } from './types';
import { api } from './services/api';
import { Loader2 } from 'lucide-react';

// Language Context
interface ILanguageContext {
  language: Language;
  setLanguage?: (lang: Language) => void;
  t: (localizedString: LocalizedString) => string;
}
export const LanguageContext = createContext<ILanguageContext>({
  language: 'en',
  t: (ls) => ls.en,
});

const AppContent = () => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
    
    const [products, setProducts] = useState<ProductModel[]>([]);
    const [seriesList, setSeriesList] = useState<LocalizedString[]>([]);
    const [shipments, setShipments] = useState<ShipmentData[]>([]);
    const [testers, setTesters] = useState<Tester[]>([]);
    const [users, setUsers] = useState<UserAccount[]>([]); // 管理使用者帳號
    const [language, setLanguage] = useState<Language>('en');
    const [maxHistorySteps, setMaxHistorySteps] = useState<number>(10);
    const [showAiInsights, setShowAiInsights] = useState<boolean>(true);
    
    // History Stack for Undo
    const [history, setHistory] = useState<AppState[]>([]);
  
    // 從遠端 API 載入資料 (loadData)
    const loadDataFromApi = async () => {
      setIsLoadingData(true);
      try {
        const data = await api.loadData();
        setProducts(data.products || MOCK_PRODUCTS);
        setSeriesList(data.seriesList || DEFAULT_SERIES);
        setShipments(data.shipments || MOCK_SHIPMENTS);
        setTesters(data.testers || MOCK_TESTERS);
        setUsers(data.users || [{ id: 'u1', username: 'admin', password: 'admin', role: 'admin' }]);
        setLanguage(data.language || 'en');
        if (data.maxHistorySteps) setMaxHistorySteps(data.maxHistorySteps);
        if (data.showAiInsights !== undefined) setShowAiInsights(data.showAiInsights);
      } catch (err) {
        console.error("無法從 API 獲取資料，使用 Mock Data 作為回退方案", err);
        setProducts(MOCK_PRODUCTS);
        setSeriesList(DEFAULT_SERIES);
        setShipments(MOCK_SHIPMENTS);
        setTesters(MOCK_TESTERS);
        setUsers([{ id: 'u1', username: 'admin', password: 'admin', role: 'admin' }]);
      } finally {
        setIsLoadingData(false);
      }
    };

    // 當登入成功時執行
    useEffect(() => {
      if (isAuthenticated) {
        loadDataFromApi();
      }
    }, [isAuthenticated]);
  
    // 自動儲存至遠端 (saveData)
    useEffect(() => {
      if (isAuthenticated && !isLoadingData) {
        const state: AppState = { products, seriesList, shipments, testers, users, language, maxHistorySteps, showAiInsights };
        api.saveData(state).catch(err => console.error("同步至伺服器失敗:", err));
      }
    }, [products, seriesList, shipments, testers, users, language, maxHistorySteps, showAiInsights, isAuthenticated, isLoadingData]);
  
    // Snapshot for Undo
    const takeSnapshot = useCallback(() => {
      setHistory(prev => {
          const currentState: AppState = { products, seriesList, shipments, testers, users, language, maxHistorySteps, showAiInsights };
          const newHistory = [...prev, currentState];
          if (newHistory.length > maxHistorySteps) {
              return newHistory.slice(newHistory.length - maxHistorySteps);
          }
          return newHistory;
      });
    }, [products, seriesList, shipments, testers, users, language, maxHistorySteps, showAiInsights]);
  
    // Undo Handler
    const handleUndo = useCallback(() => {
      setHistory(prev => {
          if (prev.length === 0) return prev;
          const previousState = prev[prev.length - 1];
          const newHistory = prev.slice(0, -1);
          
          setProducts(previousState.products);
          setSeriesList(previousState.seriesList);
          setShipments(previousState.shipments);
          setTesters(previousState.testers || []);
          setUsers(previousState.users || []);
          setLanguage(previousState.language);
          if (previousState.maxHistorySteps) setMaxHistorySteps(previousState.maxHistorySteps);
          if (previousState.showAiInsights !== undefined) setShowAiInsights(previousState.showAiInsights);
  
          return newHistory;
      });
    }, []);
  
    // Keyboard Listener for Ctrl+Z
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
              const activeTag = document.activeElement?.tagName;
              if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
              e.preventDefault();
              handleUndo();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo]);
    
    const createLocalizedObject = async (text: string, sourceLang: Language): Promise<LocalizedString> => {
      return { en: text, zh: text };
    };
  
    // --- Actions ---
    const handleAddProduct = async (productData: Omit<ProductModel, 'id'| 'ergoProjects' | 'customerFeedback' | 'designHistory' | 'ergoTests' | 'durabilityTests'>) => {
      takeSnapshot();
      const newId = `p-${Date.now()}`;
      const maxSort = products.reduce((max, p) => Math.max(max, p.customSortOrder), 0);
      const newProduct: ProductModel = {
        id: newId,
        series: productData.series,
        modelName: await createLocalizedObject(productData.modelName[language], language),
        description: await createLocalizedObject(productData.description[language], language),
        sku: productData.sku,
        imageUrl: productData.imageUrl || `https://picsum.photos/400/300?random=${newId}`,
        currentVersion: productData.currentVersion,
        designHistory: [],
        ergoTests: [],
        ergoProjects: [],
        customerFeedback: [],
        uniqueFeedbackTags: {},
        durabilityTests: [],
        isWatched: false,
        customSortOrder: maxSort + 1,
      };
      setProducts(prev => [newProduct, ...prev]);
    };
  
    const handleBatchAddProducts = (productsData: any[]) => {
      takeSnapshot();
      const currentMaxSort = products.reduce((max, p) => Math.max(max, p.customSortOrder), 0);
      const newProducts: ProductModel[] = productsData.map((data, idx) => ({
        id: data.id || `p-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        series: data.series,
        modelName: { en: data.modelName.en || data.modelName[language], zh: data.modelName.zh || data.modelName[language] }, 
        description: { en: data.description.en || data.description[language], zh: data.description.zh || data.description[language] },
        sku: data.sku,
        imageUrl: data.imageUrl || `https://picsum.photos/400/300?random=${Math.random()}`,
        currentVersion: data.currentVersion,
        designHistory: [],
        ergoTests: [],
        ergoProjects: [],
        customerFeedback: [],
        uniqueFeedbackTags: {},
        durabilityTests: [],
        isWatched: false,
        customSortOrder: currentMaxSort + idx + 1,
      }));
      setProducts(prev => [...newProducts, ...prev]);
    };
  
    const handleUpdateProduct = async (updatedProduct: ProductModel) => {
      takeSnapshot();
      const originalProduct = products.find(p => p.id === updatedProduct.id);
      if (!originalProduct) return;
      if (originalProduct.modelName[language] !== updatedProduct.modelName[language]) {
          updatedProduct.modelName = await createLocalizedObject(updatedProduct.modelName[language], language);
      }
      if (originalProduct.description[language] !== updatedProduct.description[language]) {
          updatedProduct.description = await createLocalizedObject(updatedProduct.description[language], language);
      }
      for (let i = 0; i < updatedProduct.designHistory.length; i++) {
          const eco = updatedProduct.designHistory[i];
          const originalEco = originalProduct.designHistory.find(e => e.id === eco.id);
          if (!originalEco || originalEco.description[language] !== eco.description[language]) {
              eco.description = await createLocalizedObject(eco.description[language], language);
          }
      }
      setProducts(prev => prev.map(p => (p.id === updatedProduct.id ? updatedProduct : p)));
    };
  
    const handleDeleteProduct = (productId: string) => {
      takeSnapshot();
      setProducts(prev => prev.filter(p => p.id !== productId));
      setShipments(prev => prev.filter(s => s.modelId !== productId));
    };
  
    const handleToggleWatch = (productId: string) => {
      takeSnapshot();
      setProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, isWatched: !p.isWatched } : p
      ));
    };
  
    const handleMoveProduct = (productId: string, direction: 'left' | 'right') => {
      takeSnapshot();
      const sortedProducts = [...products].sort((a, b) => a.customSortOrder - b.customSortOrder);
      const currentIndex = sortedProducts.findIndex(p => p.id === productId);
      if (currentIndex === -1) return;
      const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex >= 0 && targetIndex < sortedProducts.length) {
         const productA = sortedProducts[currentIndex];
         const productB = sortedProducts[targetIndex];
         const orderA = productA.customSortOrder;
         const orderB = productB.customSortOrder;
         const updatedProducts = products.map(p => {
             if (p.id === productA.id) return { ...p, customSortOrder: orderB };
             if (p.id === productB.id) return { ...p, customSortOrder: orderA };
             return p;
         });
         setProducts(updatedProducts);
      }
    };
  
    const handleAddSeries = async (newSeriesName: string) => {
      takeSnapshot();
      const newSeriesLS = await createLocalizedObject(newSeriesName, language);
      setSeriesList(prev => [...prev, newSeriesLS]);
    };
  
    const handleUpdateSeriesList = (newSeriesList: LocalizedString[]) => {
      takeSnapshot();
      setSeriesList(newSeriesList);
    };
  
    const handleRenameSeries = (index: number, newName: string) => {
      takeSnapshot();
      const oldSeries = seriesList[index];
      const newSeriesLS: LocalizedString = { en: newName, zh: newName }; 
      const newSeriesList = [...seriesList];
      newSeriesList[index] = newSeriesLS;
      setSeriesList(newSeriesList);
      setProducts(prevProducts => prevProducts.map(p => {
        if (p.series.en === oldSeries.en) {
          return { ...p, series: newSeriesLS };
        }
        return p;
      }));
    };
  
    const handleImportData = (newShipments: ShipmentData[]) => {
      takeSnapshot();
      setShipments(newShipments);
    };
  
    const handleLoadProject = (state: AppState) => {
      takeSnapshot();
      setProducts(state.products);
      setSeriesList(state.seriesList);
      setShipments(state.shipments);
      setTesters(state.testers || []);
      setUsers(state.users || []);
      setLanguage(state.language || 'en');
      if (state.maxHistorySteps) setMaxHistorySteps(state.maxHistorySteps);
      if (state.showAiInsights !== undefined) setShowAiInsights(state.showAiInsights);
    };
    
    const handleUpdateMaxHistory = (steps: number) => {
        setMaxHistorySteps(steps);
    };
  
    const handleToggleAiInsights = (enabled: boolean) => {
        takeSnapshot();
        setShowAiInsights(enabled);
    };
  
    const handleAddTester = (tester: Omit<Tester, 'id'>) => {
      takeSnapshot();
      const newTester = { ...tester, id: `t-${Date.now()}` };
      setTesters(prev => [...prev, newTester]);
    };
    
    const handleUpdateTester = (updatedTester: Tester) => {
        takeSnapshot();
        setTesters(prev => prev.map(t => t.id === updatedTester.id ? updatedTester : t));
    };
  
    const handleDeleteTester = (id: string) => {
      takeSnapshot();
      setTesters(prev => prev.filter(t => t.id !== id));
    };

    // --- User Management Actions ---
    const handleAddUser = (user: Omit<UserAccount, 'id'>) => {
        takeSnapshot();
        const newUser: UserAccount = { ...user, id: `u-${Date.now()}` };
        setUsers(prev => [...prev, newUser]);
    };

    const handleUpdateUser = (updatedUser: UserAccount) => {
        takeSnapshot();
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    };

    const handleDeleteUser = (id: string) => {
        takeSnapshot();
        setUsers(prev => prev.filter(u => u.id !== id));
    };
  
    const t = (localizedString: LocalizedString): string => {
      return localizedString?.[language] || localizedString?.en || '';
    };

    // 尚未登入時顯示登入畫面
    if (!isAuthenticated) {
      return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
    }

    // 資料讀取中顯示 Loading
    if (isLoadingData) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
          <Loader2 size={40} className="text-intenza-600 animate-spin mb-4" />
          <p className="text-slate-500 font-medium">同步遠端資料中...</p>
        </div>
      );
    }

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            <div className="flex min-h-screen bg-[#f8fafc]">
                <Sidebar />
                <main className="flex-1 overflow-x-hidden">
                    <Routes>
                        <Route
                            path="/"
                            element={
                                <Dashboard
                                    products={products}
                                    seriesList={seriesList}
                                    onAddProduct={handleAddProduct}
                                    onUpdateProduct={handleUpdateProduct}
                                    onToggleWatch={handleToggleWatch}
                                    onMoveProduct={handleMoveProduct}
                                    onDeleteProduct={handleDeleteProduct}
                                />
                            }
                        />
                        <Route
                            path="/product/:id"
                            element={
                                <ProductDetail
                                    products={products}
                                    testers={testers}
                                    onUpdateProduct={handleUpdateProduct}
                                    showAiInsights={showAiInsights}
                                />
                            }
                        />
                        <Route
                            path="/analytics"
                            element={
                                <Analytics
                                    products={products}
                                    shipments={shipments}
                                    testers={testers}
                                    onImportData={handleImportData}
                                    onBatchAddProducts={handleBatchAddProducts}
                                    showAiInsights={showAiInsights}
                                />
                            }
                        />
                        <Route
                            path="/settings"
                            element={
                                <Settings
                                    seriesList={seriesList}
                                    onAddSeries={handleAddSeries}
                                    onUpdateSeriesList={handleUpdateSeriesList}
                                    onRenameSeries={handleRenameSeries}
                                    currentAppState={{ products, seriesList, shipments, testers, users, language, maxHistorySteps, showAiInsights }}
                                    onLoadProject={handleLoadProject}
                                    onUpdateMaxHistory={handleUpdateMaxHistory}
                                    onToggleAiInsights={handleToggleAiInsights}
                                    onAddUser={handleAddUser}
                                    onUpdateUser={handleUpdateUser}
                                    onDeleteUser={handleDeleteUser}
                                />
                            }
                        />
                        <Route
                            path="/testers"
                            element={
                                <TesterDatabase
                                    testers={testers}
                                    onAddTester={handleAddTester}
                                    onUpdateTester={handleUpdateTester}
                                    onDeleteTester={handleDeleteTester}
                                />
                            }
                        />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </main>
            </div>
        </LanguageContext.Provider>
    );
};

const App = () => {
    return (
        <AppContent />
    );
};

export default App;
