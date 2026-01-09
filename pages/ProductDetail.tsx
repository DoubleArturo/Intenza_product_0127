
import React, { useState, useMemo, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, GitCommit, UserCheck, Activity, AlertTriangle, CheckCircle, Clock, Calendar, 
  Layers, Users, Plus, X, Pencil, Trash2, Upload, MessageSquare, ChevronsRight, 
  ChevronsLeft, Tag, FileText, User, Database, Mars, Venus, Link as LinkIcon, Search, 
  ClipboardList, ListPlus, Check, ChevronDown, ChevronRight, RefreshCw, HelpCircle, 
  BarChart3, AlertCircle, PlayCircle, Loader2, StickyNote, Lightbulb, Paperclip, 
  Video, Image as ImageIcon, Save, Star, Info, Ship, Users2, Maximize2 
} from 'lucide-react';
import { ProductModel, TestStatus, DesignChange, LocalizedString, TestResult, EcoStatus, ErgoFeedback, ErgoProject, Tester, ErgoProjectCategory, NgReason, ProjectOverallStatus, Gender, NgDecisionStatus, EvaluationTask, ShipmentData, TesterGroup, UserAccount } from '../types';
import GeminiInsight from '../components/GeminiInsight';
import { LanguageContext } from '../App';
import { api } from '../services/api';

// Helper to determine if a URL is a video
const isVideo = (url: string) => {
    if (!url) return false;
    return url.startsWith('data:video') || url.match(/\.(mp4|webm|ogg)$/i);
};

const formatVersion = (v: string) => {
    const clean = (v || '1.0').toUpperCase().replace('V', '');
    return `V${clean}`;
};

interface ProductDetailProps {
  products: ProductModel[];
  shipments: ShipmentData[];
  testers: Tester[];
  testerGroups?: TesterGroup[];
  user?: {username: string, role: 'admin' | 'user' | 'uploader' | 'viewer', permissions?: UserAccount['permissions']};
  onUpdateProduct: (p: ProductModel) => Promise<void>;
  showAiInsights: boolean;
  evaluationModalYOffset?: number;
}

const ProductDetail: React.FC<ProductDetailProps> = ({ products, shipments = [], testers = [], testerGroups = [], user, onUpdateProduct, showAiInsights, evaluationModalYOffset = 100 }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language } = useContext(LanguageContext);

  const product = products.find(p => p.id === id);
  const [activeTab, setActiveTab] = useState<'DESIGN' | 'ERGO' | 'LIFE'>(location.state?.activeTab || 'DESIGN');
  const [isEcoModalOpen, setIsEcoModalOpen] = useState(false);
  const [editingEco, setEditingEco] = useState<DesignChange | null>(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<TestResult | null>(null);
  const [isNoShipmentModalOpen, setIsNoShipmentModalOpen] = useState(false);
  const [selectedVersionForModal, setSelectedVersionForModal] = useState('');
  const ergoSectionRef = useRef<HTMLDivElement>(null);
  const [highlightedFeedback, setHighlightedFeedback] = useState<{projectId?: string, taskId?: string, testerId?: string, feedbackId?: string} | null>(null);
  const [isFeedbackPanelOpen, setIsFeedbackPanelOpen] = useState(false);
  const [lightboxState, setLightboxState] = useState<{isOpen: boolean, ecoId?: string, testId?: string, imgUrl?: string, imgIndex?: number} | null>(null);

  // 權限檢查輔助函數 (細分到 SKU 模組)
  const getModulePermission = (module: 'design' | 'ergo' | 'durability'): { canEdit: boolean; canSync: boolean } => {
    if (!user || !product) return { canEdit: false, canSync: false };
    if (user.role === 'admin') return { canEdit: true, canSync: true };
    if (user.role === 'viewer') return { canEdit: false, canSync: false };
    if (!user.permissions) return { canEdit: user.role !== 'viewer' && user.role !== 'uploader', canSync: user.role !== 'viewer' };

    // 優先檢查 SKU 權限
    const skuPerm = user.permissions.skuAccess[product.sku];
    if (skuPerm) return skuPerm[module];

    // 檢查系列權限 (作為備援)
    const seriesPerm = user.permissions.seriesAccess[t(product.series)];
    if (seriesPerm) return seriesPerm;

    return { canEdit: false, canSync: false };
  };

  const designPerm = getModulePermission('design');
  const ergoPerm = getModulePermission('ergo');
  const lifePerm = getModulePermission('durability');

  const isViewer = user?.role === 'viewer';

  const pendingNgCount = useMemo(() => {
    if (!product) return 0;
    let count = 0;
    product.ergoProjects.forEach(p => {
        (['Resistance profile', 'Experience', 'Stroke', 'Other Suggestion'] as ErgoProjectCategory[]).forEach(cat => {
            p.tasks[cat]?.forEach(t => {
                count += t.ngReasons.filter(ng => !ng.decisionStatus || ng.decisionStatus === NgDecisionStatus.PENDING || ng.decisionStatus === NgDecisionStatus.DISCUSSION).length;
            });
        });
    });
    return count;
  }, [product]);

  const pendingFeedbackCount = useMemo(() => {
      if (!product) return 0;
      return product.customerFeedback.filter(fb => fb.status === 'PENDING' || fb.status === 'DISCUSSION').length;
  }, [product]);

  useEffect(() => {
    if (location.state?.activeTab) setActiveTab(location.state.activeTab);
    if (location.state?.highlightFeedback) {
        setActiveTab('ERGO');
        const highlight = location.state.highlightFeedback;
        if (highlight.feedbackId) setIsFeedbackPanelOpen(true);
        setHighlightedFeedback(highlight);
        navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  if (!product) return <div className="p-10 text-center text-slate-500">Product not found.</div>;

  // ECO Handlers
  const handleOpenEcoModal = (eco: DesignChange | null = null) => {
    if (!designPerm.canEdit) return;
    setEditingEco(eco);
    setIsEcoModalOpen(true);
  };
  
  const handleSaveEco = async (ecoData: any) => {
      if (!designPerm.canEdit) return;
      let updatedDesignHistory;
      let newCurrentVersion = product.currentVersion;
      if (ecoData.status === EcoStatus.IN_PRODUCTION) newCurrentVersion = ecoData.version;
      if (editingEco) {
          updatedDesignHistory = product.designHistory.map(eco => eco.id === editingEco.id ? { ...eco, ...ecoData } : eco);
      } else {
          updatedDesignHistory = [...product.designHistory, { ...ecoData, id: `eco-${Date.now()}` }];
      }
      await onUpdateProduct({ ...product, designHistory: updatedDesignHistory, currentVersion: newCurrentVersion });
      setIsEcoModalOpen(false);
  };

  // Test Handlers
  const handleOpenTestModal = (test: TestResult | null = null) => {
    if (!lifePerm.canEdit) return;
    setEditingTest(test);
    setIsTestModalOpen(true);
  };

  const handleSaveTest = async (testData: any) => {
    if (!lifePerm.canEdit) return;
    let updatedDurabilityTests;
    if (editingTest) {
      updatedDurabilityTests = product.durabilityTests.map(t => t.id === editingTest.id ? { ...t, ...testData } : t);
    } else {
      updatedDurabilityTests = [...product.durabilityTests, { ...testData, id: `test-${Date.now()}` }];
    }
    await onUpdateProduct({ ...product, durabilityTests: updatedDurabilityTests });
    setIsTestModalOpen(false);
  };

  const productVersions = useMemo(() => Array.from(new Set([product.currentVersion, ...product.designHistory.map(h => h.version)])).sort().reverse(), [product]);

  return (
    <div className="min-h-screen bg-slate-50/50 w-full">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="w-full px-8 py-6">
          <button onClick={() => navigate('/')} className="flex items-center text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors"><ArrowLeft size={16} className="mr-1" /> Back to Portfolio</button>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex items-start gap-6">
              <div className="w-24 h-24 rounded-xl overflow-hidden shadow-md bg-slate-100 flex items-center justify-center text-slate-300">
                 {product.imageUrl ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={40} className="opacity-20" />}
              </div>
              <div><h1 className="text-3xl font-bold text-slate-900 mb-1">{t(product.modelName)}</h1><div className="flex items-center gap-3 text-sm text-slate-500"><span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{product.sku}</span><span>•</span><span>Latest: {product.currentVersion}</span></div></div>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <TabButton active={activeTab === 'DESIGN'} onClick={() => setActiveTab('DESIGN')} icon={<GitCommit size={16} />} label="Design & ECO" />
              <TabButton active={activeTab === 'ERGO'} onClick={() => setActiveTab('ERGO')} icon={<UserCheck size={16} />} label="Ergonomics" />
              <TabButton active={activeTab === 'LIFE'} onClick={() => setActiveTab('LIFE')} icon={<Activity size={16} />} label="Durability" />
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-8 py-8 animate-slide-up">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-6">
             {activeTab === 'DESIGN' && (
               <DesignSection 
                 product={product} shipments={shipments} canEdit={designPerm.canEdit}
                 onAddEco={() => handleOpenEcoModal()} onEditEco={handleOpenEcoModal} 
                 onDeleteEco={(id: string) => onUpdateProduct({...product, designHistory: product.designHistory.filter(e => e.id !== id)})} 
                 onOpenLightbox={(ecoId: string, url: string, idx: number) => setLightboxState({isOpen: true, ecoId, imgUrl: url, imgIndex: idx})}
               />
             )}
             {activeTab === 'ERGO' && (
                <div ref={ergoSectionRef}>
                    <ErgoSection 
                        product={product} testers={testers} testerGroups={testerGroups} onUpdateProduct={onUpdateProduct} 
                        highlightedFeedback={highlightedFeedback} isFeedbackPanelOpen={isFeedbackPanelOpen} setIsFeedbackPanelOpen={setIsFeedbackPanelOpen}
                        canEdit={ergoPerm.canEdit} evaluationModalYOffset={evaluationModalYOffset}
                    />
                </div>
             )}
             {activeTab === 'LIFE' && <LifeSection product={product} canEdit={lifePerm.canEdit} onAddTest={() => handleOpenTestModal()} onEditTest={handleOpenTestModal} onDeleteTest={(id: string) => onUpdateProduct({...product, durabilityTests: product.durabilityTests.filter(t => t.id !== id)})} onOpenLightbox={(testId: string, url: string, idx: number) => setLightboxState({isOpen: true, testId, imgUrl: url, imgIndex: idx})} />}
          </div>
          <div className="space-y-6 sticky top-40">
             {showAiInsights && <GeminiInsight context={`Analyzing product quality`} data={product} />}
             <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"><h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-intenza-600"/> {t({en: 'Quick Stats', zh: '快速統計'})}</h3><div className="space-y-4"><div><div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Pending Ergo NG</div><div className="text-2xl font-black text-amber-600">{pendingNgCount}</div></div><div><div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Customer Issues</div><div className="text-2xl font-black text-rose-500">{pendingFeedbackCount}</div></div></div></div>
          </div>
        </div>
      </div>
      
      {isEcoModalOpen && <EcoModal isOpen={isEcoModalOpen} onClose={() => setIsEcoModalOpen(false)} onSave={handleSaveEco} product={product} productVersions={productVersions} eco={editingEco}/>}
      {isTestModalOpen && <TestModal isOpen={isTestModalOpen} onClose={() => setIsTestModalOpen(false)} onSave={handleSaveTest} productVersions={productVersions} test={editingTest}/>}
    </div>
  );
};

// --- Sub-components (Simplified for logic injection) ---
const TabButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}>
    {icon}{label}
  </button>
);

const DesignSection = ({ product, canEdit, onAddEco, onEditEco, onDeleteEco, onOpenLightbox }: any) => {
  const { t } = useContext(LanguageContext);
  const versions = useMemo(() => Array.from(new Set([product.currentVersion, ...product.designHistory.map((h: DesignChange) => h.version)])).sort().reverse(), [product]);
  const [v, setV] = useState(versions[0] || product.currentVersion);
  const activeChanges = product.designHistory.filter((h: DesignChange) => h.version === v);
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold text-slate-900">Design History</h2>{canEdit && <button onClick={onAddEco} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold"><Plus size={16}/> Add ECO</button>}</div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        <div className="flex px-6 border-b border-slate-100 overflow-x-auto bg-slate-50/50">{versions.map(vr => <button key={vr} onClick={() => setV(vr)} className={`py-4 text-sm font-medium border-b-2 transition-all px-4 ${v === vr ? 'border-intenza-600 text-intenza-600' : 'border-transparent text-slate-400'}`}>{vr}</button>)}</div>
        <div className="p-8 space-y-8">{activeChanges.map((change: any) => (
          <div key={change.id} className="flex gap-8 group relative">
            <div className="w-48"><span className="font-mono text-sm font-black text-intenza-600">{change.ecoNumber}</span><div className="text-[10px] text-slate-400 uppercase mt-2">{change.date}</div></div>
            <div className="flex-1"><h4 className="text-xl font-bold text-slate-900 mb-4">{t(change.description)}</h4></div>
            {canEdit && <div className="absolute top-0 right-0 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => onEditEco(change)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200"><Pencil size={14}/></button></div>}
          </div>
        ))}</div>
      </div>
    </div>
  );
};

const LifeSection = ({ product, canEdit, onAddTest, onEditTest, onDeleteTest }: any) => {
  const { t } = useContext(LanguageContext);
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold text-slate-900">Durability Tests</h2>{canEdit && <button onClick={onAddTest} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold"><Plus size={16}/> Add Test</button>}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{product.durabilityTests.map((test: TestResult) => (
        <div key={test.id} className="bg-white p-5 rounded-2xl border border-slate-200 group relative">
          <div className="flex justify-between mb-3"><div><div className="text-[10px] font-black text-indigo-600 uppercase mb-1">{test.category}</div><h4 className="font-bold">{t(test.testName)}</h4></div><span className="text-xs font-bold">{test.status}</span></div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${test.score}%` }}></div></div>
          {canEdit && <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1"><button onClick={() => onEditTest(test)} className="p-1 bg-white border rounded"><Pencil size={10}/></button></div>}
        </div>
      ))}</div>
    </div>
  );
};

const ErgoSection = ({ product, testers, testerGroups, onUpdateProduct, highlightedFeedback, isFeedbackPanelOpen, setIsFeedbackPanelOpen, canEdit, evaluationModalYOffset }: any) => {
  const { t } = useContext(LanguageContext);
  return (
    <div className="relative animate-fade-in">
      <div className="flex justify-end mb-6">{canEdit && <button onClick={() => {}} className="bg-slate-900 text-white px-6 py-4 rounded-lg font-bold flex items-center gap-2"><Plus size={16} /> Start Evaluation</button>}</div>
      <div className="space-y-6">{product.ergoProjects.map((project: ErgoProject) => (
        <div key={project.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><h3 className="text-lg font-bold">{t(project.name)}</h3><div className="mt-2 text-xs text-slate-400">{project.date} • {project.testerIds.length} Testers</div></div>
      ))}</div>
    </div>
  );
};

// EcoModal & TestModal placeholders for logic integration
const EcoModal = ({ isOpen, onClose, onSave, eco }: any) => <div/>;
const TestModal = ({ isOpen, onClose, onSave, test }: any) => <div/>;

export default ProductDetail;
