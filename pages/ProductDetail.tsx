
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
  currentUser?: UserAccount | null;
  onUpdateProduct: (p: ProductModel) => Promise<void>;
  showAiInsights: boolean;
  evaluationModalYOffset?: number;
}

const ProductDetail: React.FC<ProductDetailProps> = ({ products, shipments = [], testers = [], testerGroups = [], currentUser, onUpdateProduct, showAiInsights, evaluationModalYOffset = 100 }) => {
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

  if (!product) return <div className="p-10 text-center text-slate-500">Product not found in registry.</div>;

  // Permission Checks
  const hasAccess = (feature: 'design' | 'ergo' | 'durability'): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'viewer') return false;
    
    // Check specific SKU first
    const skuPerms = currentUser.permissions?.skuAccess?.[product.sku];
    if (skuPerms) return skuPerms[feature];
    
    // Fallback to Series
    const seriesTitle = t(product.series);
    return !!currentUser.permissions?.seriesAccess?.[seriesTitle];
  };

  const canEditDesign = hasAccess('design');
  const canEditErgo = hasAccess('ergo');
  const canEditDurability = hasAccess('durability');

  const pendingNgCount = useMemo(() => {
    let count = 0;
    product.ergoProjects.forEach(p => {
        (['Resistance profile', 'Experience', 'Stroke', 'Other Suggestion'] as ErgoProjectCategory[]).forEach(cat => {
            p.tasks[cat]?.forEach(t => {
                count += t.ngReasons.filter(ng => 
                    !ng.decisionStatus || 
                    ng.decisionStatus === NgDecisionStatus.PENDING || 
                    ng.decisionStatus === NgDecisionStatus.DISCUSSION
                ).length;
            });
        });
    });
    return count;
  }, [product]);

  const pendingFeedbackCount = useMemo(() => {
      return product.customerFeedback.filter(fb => fb.status === 'PENDING' || fb.status === 'DISCUSSION').length;
  }, [product]);

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
    if (location.state?.highlightFeedback) {
        setActiveTab('ERGO');
        const highlight = location.state.highlightFeedback;
        if (highlight.feedbackId) {
            setIsFeedbackPanelOpen(true);
        }
        setHighlightedFeedback(highlight);
        navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  // ECO Handlers
  const handleOpenEcoModal = (eco: DesignChange | null = null) => {
    if (!canEditDesign) return;
    setEditingEco(eco);
    setIsEcoModalOpen(true);
  };
  
  const handleCloseEcoModal = () => {
    setIsEcoModalOpen(false);
    setEditingEco(null);
  };
  
  const handleSaveEco = async (ecoData: any) => {
      if (!canEditDesign) return;
      let updatedDesignHistory;
      let newCurrentVersion = product.currentVersion;
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      if (ecoData.status === EcoStatus.IN_PRODUCTION) {
          newCurrentVersion = ecoData.version;
      }

      if (editingEco) {
          updatedDesignHistory = product.designHistory.map(eco => 
              eco.id === editingEco.id ? { ...eco, ...ecoData, updatedAt: timestamp } : eco
          );
      } else {
          const newEco = { ...ecoData, id: `eco-${Date.now()}`, updatedAt: timestamp };
          updatedDesignHistory = [...product.designHistory, newEco];
      }
      await onUpdateProduct({ ...product, designHistory: updatedDesignHistory, currentVersion: newCurrentVersion });
      handleCloseEcoModal();
  };

  const handleDeleteEco = (ecoId: string) => {
    if (!canEditDesign) return;
    if (window.confirm('確定要刪除此 ECO 記錄嗎？')) {
      const updatedDesignHistory = product.designHistory.filter(eco => eco.id !== ecoId);
      onUpdateProduct({ ...product, designHistory: updatedDesignHistory });
    }
  };

  const handleSaveTest = async (testData: any) => {
    if (!canEditDurability) return;
    let updatedDurabilityTests;
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    if (editingTest) {
      updatedDurabilityTests = product.durabilityTests.map(t =>
        t.id === editingTest.id ? { ...t, ...testData, updatedDate: timestamp } : t
      );
    } else {
      const newTest = { ...testData, id: `test-${Date.now()}`, updatedDate: timestamp };
      updatedDurabilityTests = [...product.durabilityTests, newTest];
    }
    await onUpdateProduct({ ...product, durabilityTests: updatedDurabilityTests });
    handleCloseTestModal();
  };

  const handleOpenTestModal = (test: TestResult | null = null) => {
    if (!canEditDurability) return;
    setEditingTest(test);
    setIsTestModalOpen(true);
  };

  const handleCloseTestModal = () => {
    setIsTestModalOpen(false);
    setEditingTest(null);
  };

  const handleDeleteTest = (testId: string) => {
    if (!canEditDurability) return;
    if (window.confirm('確定要刪除此測試記錄嗎？')) {
      const updatedDurabilityTests = product.durabilityTests.filter(t => t.id !== testId);
      onUpdateProduct({ ...product, durabilityTests: updatedDurabilityTests });
    }
  };
  
  const handleSetCurrentVersion = (version: string) => {
    if (!canEditDesign) return;
    onUpdateProduct({ ...product, currentVersion: version });
  };

  const navigateToSource = (source: any) => {
      setActiveTab('ERGO');
      if (source.feedbackId) setIsFeedbackPanelOpen(true);
      setHighlightedFeedback({
          projectId: source.projectId,
          taskId: source.taskId,
          testerId: source.testerId,
          feedbackId: source.feedbackId
      });
  };

  const productVersions = useMemo(() => Array.from(new Set([product.currentVersion, ...product.designHistory.map(h => h.version)])).sort().reverse(), [product]);

  return (
    <div className="min-h-screen bg-slate-50/50 w-full">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 animate-fade-in">
        <div className="w-full px-8 py-6">
          <button onClick={() => navigate('/')} className="flex items-center text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors">
            <ArrowLeft size={16} className="mr-1" /> Back to Portfolio
          </button>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex items-start gap-6">
              <div className="w-24 h-24 rounded-xl overflow-hidden shadow-md border border-slate-100 flex-shrink-0 bg-slate-100 flex items-center justify-center text-slate-300">
                 {product.imageUrl ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={40} className="opacity-20" />}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-1">{t(product.modelName)}</h1>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{product.sku}</span>
                  <span>•</span>
                  <span>Latest: {product.currentVersion}</span>
                </div>
              </div>
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
                 product={product} shipments={shipments}
                 canEdit={canEditDesign}
                 onAddEco={() => handleOpenEcoModal()} onEditEco={handleOpenEcoModal} onDeleteEco={handleDeleteEco} onSetCurrentVersion={handleSetCurrentVersion}
                 onNavigateToSource={navigateToSource}
                 onOpenLightbox={(ecoId: string, url: string, idx: number) => setLightboxState({isOpen: true, ecoId, imgUrl: url, imgIndex: idx})}
                 onNoShipment={(version: string) => { setSelectedVersionForModal(version); setIsNoShipmentModalOpen(true); }}
               />
             )}
             {activeTab === 'ERGO' && (
                <div ref={ergoSectionRef}>
                    <ErgoSection 
                        product={product} testers={testers} testerGroups={testerGroups}
                        onUpdateProduct={onUpdateProduct} highlightedFeedback={highlightedFeedback} 
                        isFeedbackPanelOpen={isFeedbackPanelOpen} setIsFeedbackPanelOpen={setIsFeedbackPanelOpen}
                        canEdit={canEditErgo} evaluationModalYOffset={evaluationModalYOffset}
                    />
                </div>
             )}
             {activeTab === 'LIFE' && (
               <LifeSection 
                 product={product} 
                 canEdit={canEditDurability}
                 onAddTest={() => handleOpenTestModal()} onEditTest={handleOpenTestModal} onDeleteTest={handleDeleteTest} onOpenLightbox={(testId: string, url: string, idx: number) => setLightboxState({isOpen: true, testId, imgUrl: url, imgIndex: idx})} 
               />
             )}
          </div>
          <div className="space-y-6 sticky top-40">
             {showAiInsights && <GeminiInsight context={`Analyzing product quality for ${t(product.modelName)} (${product.sku}). Active tab: ${activeTab}`} data={product} />}
             <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-intenza-600"/> Quick Stats</h3>
                <div className="space-y-6">
                  <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100">Ergo Evaluation</h4>
                      <div className="space-y-2">
                          <div className="flex justify-between items-center"><span className="text-slate-600 text-sm flex items-center gap-2"><AlertCircle size={14} className="text-slate-400"/> Pending NG</span><span className={`font-mono font-bold ${pendingNgCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{pendingNgCount}</span></div>
                          <div className="flex justify-between items-center"><span className="text-slate-600 text-sm flex items-center gap-2"><MessageSquare size={14} className="text-slate-400"/> Customer NG</span><span className={`font-mono font-bold ${pendingFeedbackCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{pendingFeedbackCount}</span></div>
                      </div>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </div>
      
      {isEcoModalOpen && <EcoModal isOpen={isEcoModalOpen} onClose={handleCloseEcoModal} onSave={handleSaveEco} eco={editingEco} productVersions={productVersions} product={product}/>}
      {isTestModalOpen && <TestModal isOpen={isTestModalOpen} onClose={handleCloseTestModal} onSave={handleSaveTest} test={editingTest} productVersions={productVersions}/>}
      {isNoShipmentModalOpen && <NoShipmentModal isOpen={isNoShipmentModalOpen} onClose={() => setIsNoShipmentModalOpen(false)} version={selectedVersionForModal} />}
      {lightboxState?.isOpen && (
        <ImageLightbox 
            imgUrl={lightboxState.imgUrl!} onClose={() => setLightboxState(null)} 
            caption={lightboxState.ecoId ? (product.designHistory.find(e => e.id === lightboxState.ecoId) as any)?.imageCaptions?.[lightboxState.imgIndex!] || '' : (product.durabilityTests.find(t => t.id === lightboxState.testId) as any)?.attachmentCaptions?.[lightboxState.imgIndex!] || ''}
            onSaveCaption={(caption: string) => {}}
            isViewer={!(lightboxState.ecoId ? canEditDesign : canEditDurability)}
        />
      )}
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
    {icon}{label}
  </button>
);

const ecoStatusStyles: { [key in EcoStatus]: string } = {
    [EcoStatus.EVALUATING]: 'bg-blue-100 text-blue-800 border-blue-200',
    [EcoStatus.DESIGNING]: 'bg-amber-100 text-amber-800 border-amber-200',
    [EcoStatus.DESIGN_COMPLETE]: 'bg-green-100 text-green-800 border-green-200',
    [EcoStatus.IN_PRODUCTION]: 'bg-slate-900 text-white border-slate-800',
};

const ecoStatusTranslations: { [key in EcoStatus]: string } = {
  [EcoStatus.EVALUATING]: '評估中', [EcoStatus.DESIGNING]: '設計中', [EcoStatus.DESIGN_COMPLETE]: '設計完成', [EcoStatus.IN_PRODUCTION]: '導入量產',
};

const LifeSection = ({ product, canEdit, onAddTest, onEditTest, onDeleteTest, onOpenLightbox }: any) => {
  const { t } = useContext(LanguageContext);
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">Durability Tests</h2>
        {canEdit && <button onClick={onAddTest} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors"><Plus size={16} /> Add Test</button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {product.durabilityTests.map((test: TestResult) => (
          <div key={test.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm group relative overflow-hidden transition-all duration-300">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{test.category}</span>
                  {test.version && <span className="text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded shadow-sm">V{test.version}</span>}
                </div>
                <h4 className="font-bold text-slate-900">{t(test.testName)}</h4>
              </div>
              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${test.status === TestStatus.PASS ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : test.status === TestStatus.FAIL ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{test.status}</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-4"><div className={`h-full ${test.status === TestStatus.PASS ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${test.score}%` }}></div></div>
            {canEdit && <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => onEditTest(test)} className="p-1.5 bg-white border rounded text-slate-500 hover:text-slate-900"><Pencil size={12} /></button><button onClick={() => onDeleteTest(test.id)} className="p-1.5 bg-white border rounded text-red-500"><Trash2 size={12} /></button></div>}
          </div>
        ))}
      </div>
    </div>
  );
};

const DesignSection = ({ product, shipments, canEdit, onAddEco, onEditEco, onDeleteEco, onSetCurrentVersion, onNoShipment, onNavigateToSource, onOpenLightbox }: any) => {
  const { t } = useContext(LanguageContext);
  const navigate = useNavigate();
  const versions = useMemo(() => Array.from(new Set([product.currentVersion, ...product.designHistory.map((h: DesignChange) => h.version)])).sort().reverse(), [product]);
  const [selectedVersion, setSelectedVersion] = useState<string>(versions[0] || product.currentVersion);
  const activeChanges = useMemo(() => product.designHistory.filter((h: DesignChange) => h.version === selectedVersion), [product.designHistory, selectedVersion]);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">Design History</h2>
        {canEdit && <button onClick={onAddEco} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors"><Plus size={16} /> Add ECO</button>}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        <div className="flex items-center gap-8 px-6 border-b border-slate-100 overflow-x-auto bg-slate-50/50">
          {versions.map((v) => <button key={v} onClick={() => setSelectedVersion(v)} className={`py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap px-2 ${selectedVersion === v ? 'border-intenza-600 text-intenza-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>{v}</button>)}
        </div>
        <div className="p-8">
           <div className="space-y-8">
               {activeChanges.map((change: any) => (
                    <div key={change.id} className="group relative rounded-2xl transition-all hover:bg-slate-50/80 -m-4 p-4 border border-transparent hover:border-slate-100">
                        <div className="flex flex-col md:flex-row gap-8">
                            <div className="md:w-48 flex-shrink-0">
                                <span className="font-mono text-sm font-black text-intenza-600 bg-intenza-50 px-2 py-1 rounded border border-intenza-100">{change.ecoNumber || 'N/A'}</span>
                                <div className={`mt-3 px-2 py-1 rounded-md text-[10px] font-black uppercase w-fit border ${ecoStatusStyles[change.status as EcoStatus]}`}>{ecoStatusTranslations[change.status as EcoStatus]}</div>
                            </div>
                            <div className="flex-1"><h4 className="text-xl font-bold text-slate-900 mb-4">{t(change.description)}</h4></div>
                        </div>
                        {canEdit && <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => onEditEco(change)} className="p-2.5 bg-white shadow rounded-xl text-slate-400 hover:text-slate-900"><Pencil size={16} /></button><button onClick={() => onDeleteEco(change.id)} className="p-2.5 bg-white shadow rounded-xl text-rose-400 hover:text-rose-600"><Trash2 size={16} /></button></div>}
                    </div>
               ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ErgoSection = ({ product, testers, testerGroups, onUpdateProduct, canEdit, evaluationModalYOffset }: any) => {
  const { t } = useContext(LanguageContext);
  return (
    <div className="animate-fade-in">
        <div className="flex justify-end mb-6">
             {canEdit && <button onClick={() => {}} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-6 py-4 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-sm"><Plus size={16} /> Start Evaluation</button>}
        </div>
        <div className="space-y-6">
          {product.ergoProjects.map((project: ErgoProject) => (
             <div key={project.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6">
                <div className="flex justify-between items-center mb-6">
                    <div><h3 className="text-lg font-bold text-slate-900">{t(project.name)}</h3></div>
                    {canEdit && <div className="flex items-center gap-2"><button className="p-2 text-slate-400 hover:text-slate-600"><Pencil size={16}/></button><button className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button></div>}
                </div>
                <div className="text-slate-400 text-sm">Evaluation project content...</div>
             </div>
          ))}
        </div>
    </div>
  );
};

const EcoModal = ({ onClose }: any) => (<div>Modal Stub</div>);
const TestModal = ({ onClose }: any) => (<div>Modal Stub</div>);
const NoShipmentModal = ({ onClose }: any) => (<div>Modal Stub</div>);
const ImageLightbox = ({ onClose }: any) => (<div>Lightbox Stub</div>);

export default ProductDetail;
