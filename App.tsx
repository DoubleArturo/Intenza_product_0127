
import React, { useState, createContext, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import { MOCK_PRODUCTS, MOCK_SHIPMENTS, MOCK_TESTERS } from './services/mockData';
import { ProductModel, Language, LocalizedString, Tester, ShipmentData, DEFAULT_SERIES, UserAccount } from './types';

// Importing pages
import { Dashboard } from './pages/Dashboard';
import ProductDetail from './pages/ProductDetail';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import TesterDatabase from './pages/TesterDatabase';
import Sidebar from './components/Sidebar';
import Login from './components/Login';

/**
 * Fix: Define and export LanguageContextType to provide strong typing for the context.
 * This resolves the errors where 't' and 'language' are not found on the context object.
 */
export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (str: LocalizedString) => string;
}

/**
 * Fix: Export LanguageContext so it can be consumed by other components via named import.
 * Initialized with default values to prevent property access errors in TypeScript.
 */
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

  /**
   * Fix: Centralized translation helper that handles multi-language support based on current state.
   */
  const t = useCallback((str: any) => {
    if (!str) return '';
    if (typeof str === 'string') return str;
    return str[language] || str.en || str.zh || '';
  }, [language]);

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
      <div className="flex min-h-screen bg-slate-50">
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
      </div>
    </LanguageContext.Provider>
  );
};

export default App;
