
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
import { ProductModel, TestStatus, DesignChange, LocalizedString, TestResult, EcoStatus, ErgoFeedback, ErgoProject, Tester, ErgoProjectCategory, NgReason, ProjectOverallStatus, Gender, NgDecisionStatus, EvaluationTask, ShipmentData, TesterGroup } from '../types';
import GeminiInsight from '../components/GeminiInsight';
import { LanguageContext } from '../App';
import { api } from '../services/api';

// Helper to determine if a URL is a video
const isVideo = (url: string) => {
    if (!url) return false;
    return url.startsWith('data:video') || url.match(/\.(mp4|webm|ogg)$/i);
};

// Helper to format version string consistently with Analytics
const formatVersion = (v: string) => {
    const clean = (v || '1.0').toUpperCase().replace('V', '');
    return `V${clean}`;
};

// Define the interface for ProductDetail props
interface ProductDetailProps {
  products: ProductModel[];
  shipments: ShipmentData[];
  testers: Tester[];
  testerGroups?: TesterGroup[];
  userRole?: 'admin' | 'user' | 'uploader' | 'viewer';
  onUpdateProduct: (p: ProductModel) => Promise<void>;
  showAiInsights: boolean;
  evaluationModalYOffset?: number;
}

// Main Product Detail Page Component
const ProductDetail: React.FC<ProductDetailProps> = ({ products, shipments = [], testers = [], testerGroups = [], userRole, onUpdateProduct, showAiInsights, evaluationModalYOffset = 100 }) => {
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

  // Lightbox state
  const [lightboxState, setLightboxState] = useState<{isOpen: boolean, ecoId?: string, imgUrl?: string, imgIndex?: number} | null>(null);

  const isViewer = userRole === 'viewer';

  const pendingNgCount = useMemo(() => {
    if (!product) return 0;
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
      if (!product) return 0;
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

  useEffect(() => {
    if (highlightedFeedback && ergoSectionRef.current) {
        let selector = '';
        if (highlightedFeedback.feedbackId) {
            selector = `[data-customer-feedback-id="${highlightedFeedback.feedbackId}"]`;
        } else {
            selector = `[data-feedback-id="${highlightedFeedback.projectId}-${highlightedFeedback.taskId}-${highlightedFeedback.testerId}"]`;
        }
        
        setTimeout(() => {
            const element = ergoSectionRef.current?.querySelector(selector);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => setHighlightedFeedback(null), 3500);
            }
        }, 100);
    }
  }, [highlightedFeedback]);

  if (!product) return <div className="p-10 text-center text-slate-500">Product not found in registry.</div>;

  // ECO Handlers
  const handleOpenEcoModal = (eco: DesignChange | null = null) => {
    if (isViewer) return;
    setEditingEco(eco);
    setIsEcoModalOpen(true);
  };
  
  const handleCloseEcoModal = () => {
    setIsEcoModalOpen(false);
    setEditingEco(null);
  };
  
  const handleSaveEco = async (ecoData: any) => {
      if (isViewer) return;
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

  const handleUpdateImageCaption = async (ecoId: string, imgIndex: number, caption: string) => {
    if (isViewer) return;
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const updatedHistory = product.designHistory.map(eco => {
        if (eco.id === ecoId) {
            const captions = [...(eco as any).imageCaptions || []];
            // Fill gaps if any
            while (captions.length <= imgIndex) captions.push('');
            captions[imgIndex] = caption;
            return { ...eco, imageCaptions: captions, updatedAt: timestamp };
        }
        return eco;
    });
    await onUpdateProduct({ ...product, designHistory: updatedHistory });
  };

  const handleDeleteEco = (ecoId: string) => {
    if (isViewer) return;
    if (window.confirm('確定要刪除此 ECO 記錄嗎？')) {
      const updatedDesignHistory = product.designHistory.filter(eco => eco.id !== ecoId);
      onUpdateProduct({ ...product, designHistory: updatedDesignHistory });
    }
  };

  // Test Handlers
  const handleOpenTestModal = (test: TestResult | null = null) => {
    if (isViewer) return;
    setEditingTest(test);
    setIsTestModalOpen(true);
  };

  const handleCloseTestModal = () => {
    setIsTestModalOpen(false);
    setEditingTest(null);
  };

  const handleSaveTest = async (testData: any) => {
    if (isViewer) return;
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

  const handleDeleteTest = (testId: string) => {
    if (isViewer) return;
    if (window.confirm('確定要刪除此測試記錄嗎？')) {
      const updatedDurabilityTests = product.durabilityTests.filter(t => t.id !== testId);
      onUpdateProduct({ ...product, durabilityTests: updatedDurabilityTests });
    }
  };
  
  const handleDeleteVersion = (versionToDelete: string) => {
    if (isViewer) return;
    if (window.confirm(`⚠️ 警告：這將會刪除版本 ${versionToDelete} 下的所有 ECO 資訊，此動作無法復原。確定要繼續嗎？`)) {
      const updatedDesignHistory = product.designHistory.filter(eco => eco.version !== versionToDelete);
      onUpdateProduct({ ...product, currentVersion: product.currentVersion === versionToDelete ? '' : product.currentVersion, designHistory: updatedDesignHistory });
    }
  };

  const handleSetCurrentVersion = (version: string) => {
    if (isViewer) return;
    onUpdateProduct({ ...product, currentVersion: version });
  };

  // Source navigation helper
  const navigateToSource = (source: any) => {
      setActiveTab('ERGO');
      if (source.feedbackId) {
          setIsFeedbackPanelOpen(true);
      }
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
                 {product.imageUrl ? (
                    <img src={product.imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x200?text=No+Img'; }} />
                 ) : (
                    <ImageIcon size={40} className="opacity-20" />
                 )}
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
                 product={product} 
                 shipments={shipments}
                 userRole={userRole}
                 onAddEco={() => handleOpenEcoModal()} 
                 onEditEco={handleOpenEcoModal} 
                 onDeleteEco={handleDeleteEco} 
                 onDeleteVersion={handleDeleteVersion} 
                 onSetCurrentVersion={handleSetCurrentVersion}
                 onNavigateToSource={navigateToSource}
                 onOpenLightbox={(ecoId: string, url: string, idx: number) => setLightboxState({isOpen: true, ecoId, imgUrl: url, imgIndex: idx})}
                 onNoShipment={(version: string) => {
                    setSelectedVersionForModal(version);
                    setIsNoShipmentModalOpen(true);
                 }}
               />
             )}
             {activeTab === 'ERGO' && (
                <div ref={ergoSectionRef}>
                    <ErgoSection 
                        product={product} 
                        testers={testers} 
                        testerGroups={testerGroups}
                        onUpdateProduct={onUpdateProduct} 
                        highlightedFeedback={highlightedFeedback} 
                        isFeedbackPanelOpen={isFeedbackPanelOpen}
                        setIsFeedbackPanelOpen={setIsFeedbackPanelOpen}
                        userRole={userRole}
                        evaluationModalYOffset={evaluationModalYOffset}
                    />
                </div>
             )}
             {activeTab === 'LIFE' && <LifeSection product={product} userRole={userRole} onAddTest={() => handleOpenTestModal()} onEditTest={handleOpenTestModal} onDeleteTest={handleDeleteTest} />}
          </div>
          <div className="space-y-6 sticky top-40">
             {showAiInsights && <GeminiInsight context={`Analyzing product quality for ${t(product.modelName)} (${product.sku}). Active tab: ${activeTab}`} data={product} />}
             
             <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-intenza-600"/> {t({en: 'Quick Stats', zh: '快速統計'})}</h3>
                <div className="space-y-6">
                  <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100">{t({en: 'Human Factors Evaluation', zh: '人因測試項資訊'})}</h4>
                      <div className="space-y-2">
                          <div className="flex justify-between items-center">
                              <span className="text-slate-600 text-sm flex items-center gap-2">
                                  <AlertCircle size={14} className="text-slate-400"/> {t({en: 'NG Tracking (Pending)', zh: 'NG 追蹤項 (Pending)數量'})}
                              </span>
                              <span className={`font-mono font-bold ${pendingNgCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{pendingNgCount}</span>
                          </div>
                          <div className="flex justify-between items-center">
                              <span className="text-slate-600 text-sm flex items-center gap-2">
                                  <MessageSquare size={14} className="text-slate-400"/> {t({en: 'Customer NG (Pending)', zh: '客戶 NG 追蹤項資訊'})}
                              </span>
                              <span className={`font-mono font-bold ${pendingFeedbackCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{pendingFeedbackCount}</span>
                          </div>
                      </div>
                  </div>

                  <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100">{t({en: 'Product Testing', zh: '產品測試項資訊'})}</h4>
                      <div className="flex justify-between items-center">
                          <span className="text-slate-600 text-sm flex items-center gap-2">
                              <Activity size={14} className="text-slate-400"/> {t({en: 'Durability Tests', zh: '耐久測試任務數量'})}
                          </span>
                          <span className="font-mono font-bold text-slate-900">{product.durabilityTests.length}</span>
                      </div>
                  </div>
                </div>
             </div>

             {activeTab === 'ERGO' && (
                <div onClick={() => navigate('/testers')} className="group bg-white rounded-2xl border border-slate-200 p-4 shadow-sm cursor-pointer hover:border-intenza-200 hover:shadow-md transition-all">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-900/20 group-hover:scale-110 transition-transform"><Database size={24} /></div>
                      <div>
                         <h4 className="font-bold text-slate-900 group-hover:text-intenza-600 transition-colors">Tester Database</h4>
                         <p className="text-xs text-slate-500">Manage test subjects</p>
                      </div>
                      <div className="ml-auto text-slate-300 group-hover:text-intenza-500 transition-colors"><Users size={20} /></div>
                   </div>
                </div>
             )}
          </div>
        </div>
      </div>
      
      {isEcoModalOpen && <EcoModal isOpen={isEcoModalOpen} onClose={handleCloseEcoModal} onSave={handleSaveEco} eco={editingEco} productVersions={productVersions} product={product}/>}
      {isTestModalOpen && <TestModal isOpen={isTestModalOpen} onClose={handleCloseTestModal} onSave={handleSaveTest} test={editingTest} productVersions={productVersions}/>}
      {isNoShipmentModalOpen && <NoShipmentModal isOpen={isNoShipmentModalOpen} onClose={() => setIsNoShipmentModalOpen(false)} version={selectedVersionForModal} />}
      
      {/* Lightbox Modal */}
      {lightboxState && lightboxState.isOpen && (
        <ImageLightbox 
            imgUrl={lightboxState.imgUrl!} 
            onClose={() => setLightboxState(null)} 
            caption={(product.designHistory.find(e => e.id === lightboxState.ecoId) as any)?.imageCaptions?.[lightboxState.imgIndex!] || ''}
            onSaveCaption={(caption: string) => handleUpdateImageCaption(lightboxState.ecoId!, lightboxState.imgIndex!, caption)}
            isViewer={isViewer}
        />
      )}
    </div>
  );
};

// --- Sub-components & Helper Logic ---

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
  [EcoStatus.EVALUATING]: '評估中',
  [EcoStatus.DESIGNING]: '設計中',
  [EcoStatus.DESIGN_COMPLETE]: '設計完成',
  [EcoStatus.IN_PRODUCTION]: '導入量產',
};

const ngDecisionStyles: { [key in NgDecisionStatus]: string } = {
  [NgDecisionStatus.PENDING]: 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200',
  [NgDecisionStatus.NEEDS_IMPROVEMENT]: 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100',
  [NgDecisionStatus.DISCUSSION]: 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100',
  [NgDecisionStatus.IGNORED]: 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100',
  [NgDecisionStatus.IDEA]: 'bg-sky-50 text-sky-600 border-sky-200 hover:bg-sky-100'
};

const ngDecisionTranslations: { [key in NgDecisionStatus]: string } = {
    [NgDecisionStatus.PENDING]: 'PENDING',
    [NgDecisionStatus.NEEDS_IMPROVEMENT]: 'NEEDS IMPROVEMENT',
    [NgDecisionStatus.DISCUSSION]: 'IN DISCUSSION',
    [NgDecisionStatus.IGNORED]: 'IGNORED',
    [NgDecisionStatus.IDEA]: 'LOGGED AS IDEA'
};

const LifeSection = ({ product, userRole, onAddTest, onEditTest, onDeleteTest }: any) => {
  const { t } = useContext(LanguageContext);
  const isViewer = userRole === 'viewer';
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">Durability & Reliability Tests</h2>
        {!isViewer && (
          <button onClick={onAddTest} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors">
            <Plus size={16} /> Add Test
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {product.durabilityTests.map((test: TestResult) => (
          <div key={test.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm group relative overflow-hidden transition-all duration-300">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 inline-block">{test.category}</span>
                  {test.version && (
                    <span className="text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded shadow-sm border border-slate-700">
                      {test.version.toUpperCase().startsWith('V') ? test.version.toUpperCase() : `V${test.version}`}
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-slate-900">{t(test.testName)}</h4>
              </div>
              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${
                test.status === TestStatus.PASS ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                test.status === TestStatus.FAIL ? 'bg-rose-50 text-rose-700 border-rose-200' :
                'bg-slate-50 text-slate-600 border-slate-200'
              }`}>{test.status}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-medium">Progress</span>
                <span className="text-xs font-bold text-slate-900">{test.score}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                <div className={`h-full transition-all duration-1000 ${test.status === TestStatus.PASS ? 'bg-emerald-500' : test.status === TestStatus.FAIL ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${test.score}%` }}></div>
            </div>
            {test.attachmentUrls && test.attachmentUrls.length > 0 && (
                <div className="flex gap-1 mb-2">
                    {test.attachmentUrls.map((url, i) => (
                        <div key={i} className="w-6 h-6 rounded border border-slate-100 overflow-hidden"><img src={url} className="w-full h-full object-cover" /></div>
                    ))}
                </div>
            )}
            <p className="text-xs text-slate-500 line-clamp-2">{t(test.details)}</p>
            <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm p-6 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col pointer-events-none">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                        <Info size={16} className="text-intenza-600" />
                        <span className="text-xs font-black uppercase tracking-widest text-slate-900">Details / Notes</span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                    {test.details?.en || test.details?.zh ? (
                        <p className="text-sm text-slate-700 leading-relaxed font-medium">{t(test.details)}</p>
                    ) : (
                        <p className="text-xs text-slate-400 italic">No additional details recorded.</p>
                    )}
                </div>
                {test.attachmentUrls && test.attachmentUrls.length > 0 && (
                    <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                        {test.attachmentUrls.map((url, i) => (
                            <img key={i} src={url} className="h-16 w-16 rounded-lg object-cover border border-slate-200 shadow-sm" />
                        ))}
                    </div>
                )}
            </div>
            {!isViewer && (
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                  <button onClick={() => onEditTest(test)} className="p-1.5 bg-white border border-slate-100 rounded-md text-slate-500 hover:text-slate-900 hover:shadow-sm transition-all pointer-events-auto"><Pencil size={12} /></button>
                  <button onClick={() => onDeleteTest(test.id)} className="p-1.5 bg-white border border-slate-100 rounded-md text-red-500 hover:text-red-700 hover:shadow-sm transition-all pointer-events-auto"><Trash2 size={12} /></button>
              </div>
            )}
          </div>
        ))}
        {product.durabilityTests.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border-2 border-dashed border-slate-200">No durability tests recorded.</div>
        )}
      </div>
    </div>
  );
};

const ProjectCard = ({ project, testers, product, onOpenAddTask, onEditTaskName, onDeleteTask, onOpenTaskResults, onDeleteProject, onEditProject, categoryTranslations, onStatusClick, onEditNgReason, highlightedFeedback, userRole }: any) => {
    const { t, language } = useContext(LanguageContext);
    const categories: ErgoProjectCategory[] = ['Resistance profile', 'Experience', 'Stroke', 'Other Suggestion'];
    const isViewer = userRole === 'viewer';
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in group mb-6">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-slate-900">{t(project.name)}</h3>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-400 flex items-center gap-1"><Calendar size={12}/> {project.date}</span>
                        <span className="text-xs text-slate-400 flex items-center gap-1"><Users size={12}/> {project.testerIds.length} Testers</span>
                    </div>
                </div>
                {!isViewer && (
                  <div className="flex items-center gap-2">
                      <button onClick={onEditProject} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white transition-colors"><Pencil size={16}/></button>
                      <button onClick={() => { if(window.confirm('Delete this project?')) onDeleteProject(); }} className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-white transition-colors"><Trash2 size={16}/></button>
                  </div>
                )}
            </div>
            <div className="p-6 space-y-8">
                {categories.map(cat => (
                    <div key={cat} className="space-y-4">
                        <div className="flex items-center justify-between border-l-4 border-intenza-500 pl-3">
                            <h4 className="font-bold text-sm text-slate-800 uppercase tracking-tight">{language === 'en' ? cat : categoryTranslations[cat]}</h4>
                            {!isViewer && (
                              <button onClick={() => onOpenAddTask(project.id, cat)} className="text-[10px] font-bold text-intenza-600 flex items-center gap-1 hover:underline"><Plus size={10}/> Add Task</button>
                            )}
                        </div>
                        <div className="space-y-3 pl-4">
                            {project.tasks[cat]?.map((task: any) => (
                                <div key={task.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100 group/task">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <h5 className="font-bold text-slate-700 text-sm">{t(task.name)}</h5>
                                            {!isViewer && (
                                              <button onClick={() => onEditTaskName(project.id, cat, task.id, t(task.name))} className="opacity-0 group-hover/task:opacity-100 p-1 text-slate-400 hover:text-slate-600"><Pencil size={12}/></button>
                                            )}
                                        </div>
                                        {!isViewer && (
                                          <div className="flex items-center gap-2">
                                              <button onClick={() => onOpenTaskResults(cat, task.id)} className="text-[10px] font-bold bg-white border border-slate-200 text-slate-600 px-3 py-1 rounded-lg hover:border-slate-400 transition-all">Set Pass/NG</button>
                                              <button onClick={() => { if(window.confirm('Delete task?')) onDeleteTask(project.id, cat, task.id); }} className="opacity-0 group-hover/task:opacity-100 p-1 text-slate-400 hover:text-red-500"><Trash2 size={12}/></button>
                                          </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {project.testerIds.map((tid: string) => {
                                            const tester = testers.find((ts: any) => ts.id === tid);
                                            const isPass = task.passTesterIds.includes(tid);
                                            const ngReason = task.ngReasons.find((r: any) => r.testerId === tid);
                                            const isHighlighted = highlightedFeedback?.projectId === project.id && highlightedFeedback?.taskId === task.id && highlightedFeedback?.testerId === tid;
                                            const linkedEco = product.designHistory.find((eco: DesignChange) => eco.id === ngReason?.linkedEcoId);
                                            
                                            // Determine styles based on decision status
                                            const status = ngReason?.decisionStatus || NgDecisionStatus.PENDING;
                                            let statusStyle = ngDecisionStyles[status];
                                            if (linkedEco) {
                                                statusStyle = 'bg-amber-50 text-amber-700 border-amber-300 shadow-sm font-black';
                                            }

                                            return (
                                                <div key={tid} data-feedback-id={`${project.id}-${task.id}-${tid}`} className={`p-3 rounded-xl border transition-all ${isPass ? 'bg-white border-slate-100 opacity-60' : isHighlighted ? 'bg-intenza-50 border-intenza-400 shadow-md ring-2 ring-intenza-500/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200"><img src={tester?.imageUrl} className="w-full h-full object-cover" /></div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-[10px] font-bold text-slate-900 truncate">{tester?.name}</div>
                                                            <div className={`text-[8px] font-black uppercase ${isPass ? 'text-emerald-500' : 'text-rose-500'}`}>{isPass ? 'Pass' : 'NG'}</div>
                                                        </div>
                                                    </div>
                                                    {!isPass && (
                                                        <div className="space-y-2">
                                                            <p className="text-[10px] text-slate-600 line-clamp-2 min-h-[1.5rem] italic">"{ngReason?.reason ? t(ngReason.reason) : 'No description'}"</p>
                                                            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                                                {!isViewer && (
                                                                  <button onClick={() => onEditNgReason(cat, task.id, tid)} className="text-[9px] font-bold text-intenza-600 hover:underline">Edit Reason</button>
                                                                )}
                                                                <button 
                                                                    onClick={() => !isViewer && onStatusClick(project.id, cat, task.id, tid, status, ngReason?.linkedEcoId)} 
                                                                    disabled={isViewer} 
                                                                    className={`px-2 py-1 rounded text-[8px] font-black uppercase border transition-all ${statusStyle} ${isViewer ? 'cursor-default' : 'hover:scale-105 active:scale-95'}`}
                                                                >
                                                                    {linkedEco ? linkedEco.ecoNumber : ngDecisionTranslations[status]}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const CustomerFeedbackCard = ({ feedback, onStatusClick, onEdit, onDelete, product, isHighlighted, userRole }: any) => {
    const { t } = useContext(LanguageContext);
    const linkedEco = product.designHistory.find((eco: DesignChange) => eco.id === feedback.linkedEcoId);
    const isViewer = userRole === 'viewer';
    
    // Status Logic
    const status = feedback.status || 'PENDING';
    const isLinked = !!linkedEco;

    let statusStyle = 'bg-slate-100 text-slate-500 border-slate-200';
    if (isLinked) {
        statusStyle = 'bg-amber-50 text-amber-700 border-amber-300 font-black';
    } else if (status === 'DISCUSSION') {
        statusStyle = 'bg-purple-50 text-purple-600 border-purple-200 font-bold';
    } else if (status === 'IGNORED') {
        statusStyle = 'bg-zinc-100 text-zinc-400 border-zinc-200';
    }

    return (
        <div data-customer-feedback-id={feedback.id} className={`rounded-xl border p-4 shadow-sm group transition-all ${isHighlighted ? 'bg-intenza-50 border-intenza-400 shadow-md ring-2 ring-intenza-500/10 scale-[1.02]' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
            <div className="flex justify-between items-start mb-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{feedback.date}</span>
                {!isViewer && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={onEdit} className="p-1 text-slate-400 hover:text-slate-600"><Pencil size={12}/></button>
                      <button onClick={onDelete} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={12}/></button>
                  </div>
                )}
            </div>
            <p className="text-sm text-slate-800 font-medium leading-relaxed mb-4">{t(feedback.content)}</p>
            <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase">
                    <User size={10}/> {feedback.source}
                </div>
                <button 
                    onClick={() => !isViewer && onStatusClick()} 
                    disabled={isViewer} 
                    className={`px-2 py-1 rounded text-[8px] font-black uppercase border transition-all ${statusStyle} ${isViewer ? 'cursor-default' : 'hover:scale-105 active:scale-95'}`}
                >
                    {isLinked ? linkedEco.ecoNumber : status}
                </button>
            </div>
        </div>
    );
};

const DesignSection = ({ product, shipments, userRole, onAddEco, onEditEco, onDeleteEco, onDeleteVersion, onSetCurrentVersion, onNoShipment, onNavigateToSource, onOpenLightbox }: any) => {
  const { t, language } = useContext(LanguageContext);
  const navigate = useNavigate();
  const isViewer = userRole === 'viewer';
  const versions = useMemo(() => Array.from(new Set([product.currentVersion, ...product.designHistory.map((h: DesignChange) => h.version)])).sort().reverse(), [product]);
  const [selectedVersion, setSelectedVersion] = useState<string>(versions[0] || product.currentVersion);
  
  useEffect(() => {
    if (versions.length > 0 && !versions.includes(selectedVersion)) setSelectedVersion(versions[0]);
  }, [versions, selectedVersion]);

  const activeChanges = useMemo(() => product.designHistory.filter((h: DesignChange) => h.version === selectedVersion), [product.designHistory, selectedVersion]);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">Design Version History</h2>
        {!isViewer && (
          <button onClick={onAddEco} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors"><Plus size={16} /> Add ECO</button>
        )}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        <div className="flex items-center gap-8 px-6 border-b border-slate-100 overflow-x-auto bg-slate-50/50">
          {versions.map((v) => (
            <button key={v} onClick={() => setSelectedVersion(v)} className={`py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap px-2 ${selectedVersion === v ? 'border-intenza-600 text-intenza-600' : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'}`}>{v}</button>
          ))}
        </div>
        <div className="p-8 bg-white">
          <div className="flex items-center justify-between mb-8 border-b border-slate-50 pb-4">
             <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        {selectedVersion}
                        <span className={`text-xs font-normal text-white px-2 py-1 rounded-md uppercase tracking-wider ${selectedVersion === product.currentVersion ? 'bg-slate-900' : 'bg-slate-400'}`}>
                        {selectedVersion === product.currentVersion ? 'Current Production' : 'Archived Version'}
                        </span>
                    </h3>
                    <button onClick={() => {
                        const hasShip = shipments.some((s: ShipmentData) => s.sku === product.sku && formatVersion(s.version) === formatVersion(selectedVersion));
                        if (!hasShip) { onNoShipment(selectedVersion); return; }
                        navigate('/analytics', { state: { autoDrill: { sku: product.sku, version: selectedVersion } } });
                    }} className="p-1.5 bg-slate-100 text-slate-500 hover:text-intenza-600 hover:bg-intenza-50 rounded-lg transition-all shadow-sm border border-slate-200" title={t({ en: 'View market distribution', zh: '檢視出貨分佈' })}><Users size={18} /></button>
                </div>
                {selectedVersion !== product.currentVersion && !isViewer && (
                   <button onClick={() => onSetCurrentVersion(selectedVersion)} className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 w-fit mt-1"><Star size={12} fill="currentColor" /> {t({ en: 'Set as Current Production Version', zh: '設為目前的正式量產版本' })}</button>
                )}
             </div>
             {!isViewer && (
               <button onClick={() => onDeleteVersion(selectedVersion)} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"><Trash2 size={14} /> 刪除此版本</button>
             )}
          </div>
          <div className="space-y-8">
               {activeChanges.map((change: any) => {
                  const linkedSources = change.sourceFeedbacks || [];
                  const ergoCount = linkedSources.filter((s: any) => s.projectId).length;
                  const feedbackCount = linkedSources.filter((s: any) => s.feedbackId).length;

                  return (
                    <div key={change.id} className="group relative rounded-2xl transition-all hover:bg-slate-50/80 -m-4 p-4 border border-transparent hover:border-slate-100">
                        <div className="flex flex-col md:flex-row gap-8">
                            <div className="md:w-48 flex-shrink-0">
                                <span className="font-mono text-sm font-black text-intenza-600 bg-intenza-50 px-2 py-1 rounded border border-intenza-100 shadow-sm">{change.ecoNumber || change.ecrNumber || 'N/A'}</span>
                                <div className={`mt-3 px-2 py-1 rounded-md text-[10px] font-black uppercase w-fit border shadow-sm ${ecoStatusStyles[change.status as EcoStatus]}`}>
                                    {ecoStatusTranslations[change.status as EcoStatus]}
                                </div>
                                <div className="flex flex-col gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-4">
                                    <div className="flex items-center gap-2"><Calendar size={12} className="text-slate-300" />Issue: {change.date}</div>
                                    {change.updatedAt && (
                                        <div className="flex items-center gap-2 text-intenza-500 bg-intenza-50/50 px-1.5 py-0.5 rounded w-fit"><RefreshCw size={10} />Updated: {change.updatedAt}</div>
                                    )}
                                </div>
                                
                                {/* REVERSE LINKAGE UI - Now Interactive */}
                                {(ergoCount > 0 || feedbackCount > 0) && (
                                    <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
                                        <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest">關聯來源 (點擊跳轉)</div>
                                        {linkedSources.map((s: any, idx: number) => (
                                            <button 
                                                key={idx} 
                                                onClick={() => onNavigateToSource(s)}
                                                className={`flex items-center gap-1.5 text-[10px] font-bold p-1 rounded hover:bg-white hover:shadow-sm transition-all w-full text-left ${s.projectId ? 'text-indigo-600' : 'text-emerald-600'}`}
                                            >
                                                {s.projectId ? <UserCheck size={10}/> : <MessageSquare size={10}/>}
                                                <span className="truncate">{s.projectId ? '人因評估項' : '客戶回饋'}</span>
                                                <ChevronRight size={10} className="ml-auto opacity-40" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <h4 className="text-xl font-bold text-slate-900 mb-4 leading-snug">{t(change.description)}</h4>
                                {change.imageUrls && change.imageUrls.length > 0 && (
                                    <div className="mb-4 flex flex-wrap gap-3">
                                        {change.imageUrls.map((url: string, imgIndex: number) => (
                                            <div key={imgIndex} className="relative group/img overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-slate-50">
                                                {isVideo(url) ? (
                                                    <video src={url} className="h-40 w-auto" />
                                                ) : (
                                                    <img src={url} className="h-40 w-auto object-cover" />
                                                )}
                                                <div 
                                                    onClick={() => onOpenLightbox(change.id, url, imgIndex)}
                                                    className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center cursor-pointer backdrop-blur-[2px]"
                                                >
                                                    <Maximize2 size={24} className="text-white drop-shadow-md" />
                                                </div>
                                                {change.imageCaptions?.[imgIndex] && (
                                                    <div className="absolute bottom-0 inset-x-0 p-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold truncate">
                                                        {change.imageCaptions[imgIndex]}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        {!isViewer && (
                            <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => onEditEco(change)} className="p-2.5 bg-white shadow-lg rounded-xl text-slate-400 hover:text-slate-900 border border-slate-100 transition-all hover:scale-110"><Pencil size={16} /></button>
                                <button onClick={() => onDeleteEco(change.id)} className="p-2.5 bg-white shadow-lg rounded-xl text-rose-400 hover:text-rose-600 border border-slate-100 transition-all hover:scale-110"><Trash2 size={16} /></button>
                            </div>
                        )}
                    </div>
                  );
               })}
          </div>
        </div>
      </div>
    </div>
  );
};

const ImageLightbox = ({ imgUrl, onClose, caption, onSaveCaption, isViewer }: any) => {
    const [localCaption, setLocalCaption] = useState(caption);
    const [isEditing, setIsEditing] = useState(false);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-slate-950/95 backdrop-blur-xl animate-fade-in">
            <button onClick={onClose} className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-20"><X size={32}/></button>
            
            <div className="w-full h-full flex flex-col items-center justify-center gap-8">
                <div className="flex-1 w-full flex items-center justify-center overflow-hidden">
                    {isVideo(imgUrl) ? (
                        <video src={imgUrl} controls className="max-w-full max-h-full rounded-2xl shadow-2xl" />
                    ) : (
                        <img src={imgUrl} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
                    )}
                </div>

                <div className="w-full max-w-2xl bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-[2rem] shadow-2xl animate-slide-up">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-white/50">
                            <FileText size={18} />
                            <span className="text-xs font-black uppercase tracking-widest">Image Description</span>
                        </div>
                        {!isViewer && (
                            <button 
                                onClick={() => {
                                    if (isEditing) onSaveCaption(localCaption);
                                    setIsEditing(!isEditing);
                                }}
                                className="px-4 py-1.5 bg-white text-slate-900 rounded-xl text-xs font-black uppercase tracking-tight hover:bg-intenza-100 transition-all flex items-center gap-2"
                            >
                                {isEditing ? <><Save size={14}/> Save Annotation</> : <><Pencil size={14}/> Edit Description</>}
                            </button>
                        )}
                    </div>

                    {isEditing ? (
                        <textarea 
                            autoFocus
                            value={localCaption} 
                            onChange={e => setLocalCaption(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:ring-2 focus:ring-white/20 transition-all resize-none font-medium"
                            rows={3}
                            placeholder="Add explanation for this design detail..."
                        />
                    ) : (
                        <p className={`text-lg font-medium leading-relaxed ${localCaption ? 'text-white' : 'text-white/30 italic'}`}>
                            {localCaption || 'No description provided for this visual evidence.'}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

const ErgoSection = ({ product, testers, testerGroups, onUpdateProduct, highlightedFeedback, isFeedbackPanelOpen, setIsFeedbackPanelOpen, userRole, evaluationModalYOffset }: any) => {
  const { t, language } = useContext(LanguageContext);
  const isViewer = userRole === 'viewer';
  const [isStartEvaluationModalOpen, setStartEvaluationModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ErgoProject | null>(null);
  const [addTaskModalState, setAddTaskModalState] = useState<any>({ isOpen: false, context: null });
  const [editTaskModalState, setEditTaskModalState] = useState<any>({ isOpen: false, context: null });
  const [taskResultModalState, setTaskResultModalState] = useState<any>({ isOpen: false, context: null });
  const [feedbackModalState, setFeedbackModalState] = useState<any>({ isOpen: false, feedback: null });
  const [ngReasonModalState, setNgReasonModalState] = useState<any>({ isOpen: false, context: null });
  const [statusModalState, setStatusModalState] = useState<any>({ isOpen: false, context: null });
  const [feedbackStatusModal, setFeedbackStatusModal] = useState<any>({ isOpen: false, feedback: null });
  
  const activeEcosList = product.designHistory.filter((e: DesignChange) => e.status !== EcoStatus.IN_PRODUCTION && e.status !== EcoStatus.DESIGN_COMPLETE);
  const productVersions = useMemo(() => Array.from(new Set([product.currentVersion, ...product.designHistory.map((h: DesignChange) => h.version)])).sort().reverse(), [product]);

  /**
   * REFACTORED: Unified linkage helper to ensure bidirectional consistency
   */
  const performBidirectionalUpdate = (
    newStatus: NgDecisionStatus | string, 
    linkedEcoId?: string, 
    context?: any, // { projectId, category, taskId, testerId }
    feedbackId?: string
  ) => {
    // 1. Clean existing references in all ECOs for this source
    const updatedHistory = product.designHistory.map((eco: DesignChange) => {
        let sources = [...(eco.sourceFeedbacks || [])];
        if (feedbackId) {
            sources = sources.filter(s => s.feedbackId !== feedbackId);
        } else if (context) {
            sources = sources.filter(s => 
                !(s.projectId === context.projectId && 
                  s.taskId === context.taskId && 
                  s.testerId === context.testerId)
            );
        }
        
        // 2. Add new reference if we are linking
        if (linkedEcoId && eco.id === linkedEcoId) {
            if (feedbackId) {
                sources.push({ category: feedbackStatusModal.feedback.category, feedbackId });
            } else if (context) {
                sources.push({ ...context });
            }
        }
        return { ...eco, sourceFeedbacks: sources };
    });

    // 3. Update the source (Task or Feedback)
    let updatedProjects = product.ergoProjects;
    let updatedFeedbacks = product.customerFeedback;

    if (feedbackId) {
        updatedFeedbacks = product.customerFeedback.map((f: ErgoFeedback) => 
            f.id === feedbackId ? { ...f, status: newStatus as any, linkedEcoId } : f
        );
    } else if (context) {
        updatedProjects = product.ergoProjects.map((p: ErgoProject) => 
            p.id === context.projectId ? {
                ...p,
                tasks: {
                    ...p.tasks,
                    [context.category]: p.tasks[context.category].map((t: EvaluationTask) => 
                        t.id === context.taskId ? {
                            ...t,
                            ngReasons: t.ngReasons.map((ng: NgReason) => 
                                ng.testerId === context.testerId ? { ...ng, decisionStatus: newStatus as NgDecisionStatus, linkedEcoId } : ng
                            )
                        } : t
                    )
                }
            } : p
        );
    }

    onUpdateProduct({
        ...product,
        designHistory: updatedHistory,
        ergoProjects: updatedProjects,
        customerFeedback: updatedFeedbacks
    });
  };

  return (
    <div className="relative animate-fade-in">
      <div className={`transition-all duration-500 ease-in-out ${isFeedbackPanelOpen ? 'pr-[40%]' : 'pr-14'}`}>
        <div className="flex justify-end mb-6">
             {!isViewer && (
               <button onClick={() => { setEditingProject(null); setStartEvaluationModalOpen(true); }} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-sm"><Plus size={16} /> Start Evaluation</button>
             )}
        </div>
        <div className="space-y-6">
          {product.ergoProjects.map((project: ErgoProject) => (
             <ProjectCard key={project.id} project={project} testers={testers} product={product} userRole={userRole} onOpenAddTask={(pid: string, cat: ErgoProjectCategory) => setAddTaskModalState({ isOpen: true, context: { projectId: pid, category: cat } })} onEditTaskName={(pid: string, cat: ErgoProjectCategory, tid: string, name: string) => setEditTaskModalState({ isOpen: true, context: { projectId: pid, category: cat, taskId: tid, currentName: name } })} onDeleteTask={(pid: string, cat: ErgoProjectCategory, tid: string) => onUpdateProduct({...product, ergoProjects: product.ergoProjects.map((p: any) => p.id === pid ? {...p, tasks: {...p.tasks, [cat]: p.tasks[cat].filter((t: any) => t.id !== tid)}} : p)})} onOpenTaskResults={(cat: ErgoProjectCategory, taskId: string) => setTaskResultModalState({ isOpen: true, context: { projectId: project.id, category: cat, taskId } })} onDeleteProject={() => onUpdateProduct({...product, ergoProjects: product.ergoProjects.filter((p: any) => p.id !== project.id)})} onEditProject={() => { setEditingProject(project); setStartEvaluationModalOpen(true); }} categoryTranslations={{'Resistance profile': 'Resistance profile', 'Experience': 'Experience', 'Stroke': 'Stroke', 'Other Suggestion': 'Other Suggestion'}} onStatusClick={(pid: string, cat: ErgoProjectCategory, tid: string, testerId: string, cur: NgDecisionStatus, eco: string) => setStatusModalState({ isOpen: true, context: { projectId: pid, category: cat, taskId: tid, testerId, currentStatus: cur, linkedEcoId: eco } })} onEditNgReason={(cat: ErgoProjectCategory, taskId: string, testerId: string) => setNgReasonModalState({ isOpen: true, context: { projectId: project.id, category: cat, taskId, testerId } })} highlightedFeedback={highlightedFeedback} />
          ))}
        </div>
      </div>

      {/* IMPROVED SIDEBAR DRAWER WITH BETTER VISIBILITY WHEN CLOSED */}
      <div className={`absolute top-0 right-0 h-full transition-all duration-500 ease-in-out ${isFeedbackPanelOpen ? 'w-[38%]' : 'w-12'}`}>
        <div className="bg-white rounded-2xl border border-slate-200 h-full shadow-2xl flex flex-col overflow-hidden relative">
          {/* Toggle Button */}
          <button 
            onClick={() => setIsFeedbackPanelOpen(!isFeedbackPanelOpen)} 
            className="absolute top-1/2 -left-6 -translate-y-1/2 bg-white p-2 rounded-l-lg border-l border-t border-b border-slate-200 hover:bg-slate-50 shadow-md z-20"
          >
            {isFeedbackPanelOpen ? <ChevronsRight size={20} className="text-slate-400" /> : <ChevronsLeft size={20} className="text-slate-400" />}
          </button>

          {!isFeedbackPanelOpen ? (
            /* COLLAPSED STATE: SHOW LABEL AND COUNT */
            <div 
              onClick={() => setIsFeedbackPanelOpen(true)}
              className="flex-1 flex flex-col items-center py-8 cursor-pointer hover:bg-slate-50 transition-all group"
            >
              <MessageSquare size={20} className="text-slate-400 group-hover:text-intenza-600 mb-6 transition-colors" />
              <div className="flex-1 flex items-center justify-center">
                <span className="text-[10px] font-black text-slate-300 group-hover:text-slate-500 uppercase tracking-[0.3em] rotate-90 whitespace-nowrap transition-colors">
                  Customer Feedback
                </span>
              </div>
              {product.customerFeedback.length > 0 && (
                <div className="mt-8 bg-intenza-600 text-white text-[9px] font-black px-2 py-1 rounded-full shadow-lg shadow-intenza-600/20">
                  {product.customerFeedback.length}
                </div>
              )}
            </div>
          ) : (
            /* EXPANDED STATE: FULL PANEL */
            <div className="flex-1 flex flex-col bg-slate-50 animate-fade-in">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10 shadow-sm">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <MessageSquare size={18} className="text-intenza-500"/>
                    Customer Feedback
                  </h3>
                  {!isViewer && (
                    <button 
                      onClick={() => setFeedbackModalState({ isOpen: true, feedback: null })} 
                      className="text-xs font-black bg-intenza-600 text-white px-3 py-1.5 rounded-xl hover:bg-intenza-700 flex items-center gap-1 shadow-lg shadow-intenza-600/20 transition-all active:scale-95"
                    >
                      <Plus size={14}/> Add
                    </button>
                  )}
                </div>
                
                <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
                    {product.customerFeedback.length > 0 ? (
                        product.customerFeedback.map((fb: ErgoFeedback) => (
                            <CustomerFeedbackCard 
                                key={fb.id} 
                                feedback={fb} 
                                product={product} 
                                userRole={userRole} 
                                isHighlighted={highlightedFeedback?.feedbackId === fb.id} 
                                onStatusClick={() => setFeedbackStatusModal({ isOpen: true, feedback: fb })} 
                                onEdit={() => setFeedbackModalState({ isOpen: true, feedback: fb })} 
                                onDelete={() => onUpdateProduct({...product, customerFeedback: product.customerFeedback.filter((f: any) => f.id !== fb.id)})} 
                            />
                        ))
                    ) : (
                        /* IMPROVED EMPTY STATE */
                        <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12">
                            <div className="w-20 h-20 bg-white rounded-3xl border border-slate-100 flex items-center justify-center text-slate-200 mb-6 shadow-sm">
                                <MessageSquare size={40} />
                            </div>
                            <h4 className="text-slate-900 font-bold text-lg mb-2">No Feedback Yet</h4>
                            <p className="text-slate-400 text-xs mb-8 leading-relaxed max-w-[200px]">
                              Collect field complaints or market observations here to link them to design changes.
                            </p>
                            {!isViewer && (
                                <button 
                                    onClick={() => setFeedbackModalState({ isOpen: true, feedback: null })} 
                                    className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center gap-2"
                                >
                                    <Plus size={18} strokeWidth={3} />
                                    Add Your First Entry
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
          )}
        </div>
      </div>

      {isStartEvaluationModalOpen && <StartEvaluationModal yOffset={evaluationModalYOffset} onClose={() => setStartEvaluationModalOpen(false)} onStartProject={(name: any, ids: any) => { if(editingProject) { onUpdateProduct({...product, ergoProjects: product.ergoProjects.map((p: any) => p.id === editingProject.id ? {...p, name, testerIds: ids} : p)}); } else { onUpdateProduct({...product, ergoProjects: [...product.ergoProjects, {id: `proj-${Date.now()}`, name, date: new Date().toISOString().split('T')[0], testerIds: ids, overallStatus: 'PENDING', tasks: {'Resistance profile':[], 'Experience':[], 'Stroke':[], 'Other Suggestion':[]}, uniqueNgReasons: {}}]}); } setStartEvaluationModalOpen(false); }} allTesters={testers} testerGroups={testerGroups} project={editingProject} />}
      {addTaskModalState.isOpen && <AddTaskModal onClose={() => setAddTaskModalState({isOpen:false})} onSave={(name: any) => { const {projectId, category} = addTaskModalState.context; onUpdateProduct({...product, ergoProjects: product.ergoProjects.map((p: any) => p.id === projectId ? {...p, tasks: {...p.tasks, [category]: [...p.tasks[category], {id: `t-${Date.now()}`, name: {en: name, zh: name}, passTesterIds: [], ngReasons: []}]}} : p)}); setAddTaskModalState({isOpen:false}); }} />}
      {taskResultModalState.isOpen && <SetTaskResultsModal onClose={() => setTaskResultModalState({isOpen:false})} onSave={(ids: any) => { const {projectId, category, taskId} = taskResultModalState.context; onUpdateProduct({...product, ergoProjects: product.ergoProjects.map((p: any) => p.id === projectId ? {...p, tasks: {...p.tasks, [category]: p.tasks[category].map((t: any) => t.id === taskId ? {...t, passTesterIds: ids, ngReasons: p.testerIds.filter((tid: any) => !ids.includes(tid)).map((tid: any) => t.ngReasons.find((r: any) => r.testerId === tid) || {testerId: tid, reason: {en: '', zh: ''}, decisionStatus: 'PENDING'})} : t)}} : p)}); setTaskResultModalState({isOpen:false}); }} context={taskResultModalState.context} project={product.ergoProjects.find((p: any) => p.id === taskResultModalState.context.projectId)} testers={testers} />}
      {ngReasonModalState.isOpen && <SetPassNgModal onClose={() => setNgReasonModalState({isOpen:false})} onSet={(reason: any, isNew: any, atts: any, type: any) => { const {projectId, category, taskId, testerId} = ngReasonModalState.context; onUpdateProduct({...product, ergoProjects: product.ergoProjects.map((p: any) => p.id === projectId ? {...p, tasks: {...p.tasks, [category]: p.tasks[category].map((t: any) => t.id === taskId ? {...t, ngReasons: t.ngReasons.map((ng: any) => ng.testerId === testerId ? {...ng, reason, attachmentUrls: atts, decisionStatus: type === 'IDEA' ? 'IDEA' : ng.decisionStatus} : ng)} : t)}} : p)}); setNgReasonModalState({isOpen:false}); }} existingReason={product.ergoProjects.find((p: any) => p.id === ngReasonModalState.context.projectId)?.tasks[ngReasonModalState.context.category].find((t: any) => t.id === ngReasonModalState.context.taskId)?.ngReasons.find((ng: any) => ng.testerId === ngReasonModalState.context.testerId)} />}
      
      {statusModalState.isOpen && (
          <StatusDecisionModal 
              onClose={() => setStatusModalState({isOpen:false})} 
              context={statusModalState.context} 
              onSetStatus={(s: any) => {
                  performBidirectionalUpdate(s, undefined, statusModalState.context);
                  setStatusModalState({isOpen:false});
              }} 
              onLinkEco={(ecoId: any) => {
                  const isUnlink = statusModalState.context.linkedEcoId === ecoId;
                  performBidirectionalUpdate(
                      isUnlink ? 'PENDING' : 'NEEDS_IMPROVEMENT', 
                      isUnlink ? undefined : ecoId, 
                      statusModalState.context
                  );
                  setStatusModalState({isOpen:false});
              }} 
              onCreateEco={(version: string) => {
                  const {projectId, category, taskId, testerId} = statusModalState.context;
                  const ng = product.ergoProjects.find((p: any) => p.id === projectId).tasks[category].find((t: any) => t.id === taskId).ngReasons.find((r: any) => r.testerId === testerId);
                  const newEcoId = `eco-${Date.now()}`;
                  const now = new Date();
                  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                  
                  const newEco: any = { 
                      id: newEcoId, 
                      ecoNumber: `EVAL-${Date.now().toString().slice(-4)}`, 
                      date: new Date().toISOString().split('T')[0], 
                      version, 
                      description: {en: `[Ergo Improvement] ${t(ng.reason)}`, zh: `[人因改進] ${t(ng.reason)}`}, 
                      affectedBatches: [], 
                      affectedCustomers: [], 
                      status: EcoStatus.EVALUATING, 
                      imageUrls: ng.attachmentUrls || [], 
                      sourceFeedbacks: [{projectId, category, taskId, testerId}],
                      updatedAt: timestamp 
                  };
                  onUpdateProduct({
                      ...product,
                      designHistory: [...product.designHistory, newEco],
                      ergoProjects: product.ergoProjects.map((p: any) => p.id === projectId ? {
                          ...p,
                          tasks: {
                              ...p.tasks,
                              [category]: p.tasks[category].map((t: any) => t.id === taskId ? {
                                  ...t,
                                  ngReasons: t.ngReasons.map((r: any) => r.testerId === testerId ? { ...r, linkedEcoId: newEcoId, decisionStatus: 'NEEDS_IMPROVEMENT'} : r)
                              } : t)
                          }
                      } : p)
                  });
                  setStatusModalState({isOpen:false});
              }} 
              activeEcos={activeEcosList} 
              versions={productVersions} 
              currentProductVersion={product.currentVersion} 
          />
      )}

      {feedbackModalState.isOpen && <FeedbackModal onClose={() => setFeedbackModalState({isOpen:false})} onSave={(data: any) => { if(feedbackModalState.feedback) { onUpdateProduct({...product, customerFeedback: product.customerFeedback.map((f: any) => f.id === feedbackModalState.feedback.id ? {...f, ...data} : f)}); } else { onUpdateProduct({...product, customerFeedback: [...product.customerFeedback, {id: `fb-${Date.now()}`, ...data, type: 'COMPLAINT', status: 'PENDING'}]}); } setFeedbackModalState({isOpen:false}); }} feedback={feedbackModalState.feedback} product={product} />}
      
      {feedbackStatusModal.isOpen && (
          <FeedbackStatusDecisionModal 
            onClose={() => setFeedbackStatusModal({isOpen:false})} 
            feedback={feedbackStatusModal.feedback} 
            onUpdateStatus={(fid: any, s: any) => {
                performBidirectionalUpdate(s, undefined, undefined, fid);
                setFeedbackStatusModal({isOpen:false});
            }} 
            onLinkEco={(ecoId: any) => {
                const fid = feedbackStatusModal.feedback.id;
                const isUnlink = feedbackStatusModal.feedback.linkedEcoId === ecoId;
                performBidirectionalUpdate(
                    isUnlink ? 'PENDING' : 'DISCUSSION', 
                    isUnlink ? undefined : ecoId, 
                    undefined, 
                    fid
                );
                setFeedbackStatusModal({isOpen:false});
            }} 
            onCreateEco={(version: string) => {
                const f = feedbackStatusModal.feedback;
                const newEcoId = `eco-${Date.now()}`;
                const now = new Date();
                const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                
                const newEco: any = { 
                    id: newEcoId, 
                    ecoNumber: `CUST-${Date.now().toString().slice(-4)}`, 
                    date: new Date().toISOString().split('T')[0], 
                    version, 
                    description: {en: `[Customer Feedback Address] ${t(f.content)}`, zh: `[客訴回饋處理] ${t(f.content)}`}, 
                    affectedBatches: [], 
                    affectedCustomers: [], 
                    status: EcoStatus.EVALUATING, 
                    imageUrls: f.attachmentUrls || [], 
                    sourceFeedbacks: [{category: f.category, feedbackId: f.id}],
                    updatedAt: timestamp 
                };
                onUpdateProduct({
                    ...product,
                    designHistory: [...product.designHistory, newEco],
                    customerFeedback: product.customerFeedback.map((item: any) => item.id === f.id ? { ...item, linkedEcoId: newEcoId, status: 'DISCUSSION'} : item)
                });
                setFeedbackStatusModal({isOpen:false});
            }} 
            activeEcos={activeEcosList} 
            versions={productVersions} 
            currentProductVersion={product.currentVersion} 
          />
      )}
    </div>
  );
};

// --- Modals ---

const EcoModal = ({ isOpen, onClose, onSave, eco, productVersions, product }: any) => {
    const [formData, setFormData] = useState<any>(eco || { ecoNumber: '', date: new Date().toISOString().split('T')[0], version: product.currentVersion, description: { en: '', zh: '' }, status: EcoStatus.EVALUATING, imageUrls: [], imageCaptions: [] });
    const [isUp, setIsUp] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10"><h2 className="text-xl font-bold">{eco ? 'Edit ECO' : 'Add New ECO'}</h2><button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button></div>
            <form onSubmit={(e) => {e.preventDefault(); onSave(formData);}} className="p-6 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">ECO Number</label><input type="text" value={formData.ecoNumber} onChange={e => setFormData({...formData, ecoNumber: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border rounded-lg focus:ring-2 outline-none"/></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Version</label><input type="text" list="v-list" value={formData.version} onChange={e => setFormData({...formData, version: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border rounded-lg"/><datalist id="v-list">{productVersions.map((v: string) => <option key={v} value={v} />)}</datalist></div>
                </div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label><textarea value={formData.description.en} onChange={e => setFormData({...formData, description: {en: e.target.value, zh: e.target.value}})} className="w-full px-4 py-2 bg-slate-50 border rounded-lg" rows={3}/></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label><select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as EcoStatus})} className="w-full px-4 py-2 bg-slate-50 border rounded-lg">{Object.values(EcoStatus).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border rounded-lg"/></div>
                </div>
                <div className="pt-4 border-t"><label className="block text-xs font-bold text-slate-500 uppercase mb-3">Media</label><div className="grid grid-cols-4 gap-3">{(formData.imageUrls || []).map((url: string, i: number) => <div key={i} className="relative aspect-square rounded-lg overflow-hidden border bg-slate-100 group">
                    {isVideo(url)?<div className="w-full h-full flex items-center justify-center"><Video size={20}/></div>:<img src={url} className="w-full h-full object-cover"/>}
                    <button type="button" onClick={() => setFormData({...formData, imageUrls: formData.imageUrls.filter((_:any,idx:number)=>idx!==i), imageCaptions: (formData.imageCaptions||[]).filter((_:any,idx:number)=>idx!==i)})} className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100"><X size={10}/></button>
                </div>)}<button type="button" onClick={() => fileRef.current?.click()} className="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-slate-400 bg-slate-50">{isUp?<Loader2 className="animate-spin"/>:<Plus/>}</button><input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={async e => {const fs=e.target.files; if(!fs) return; setIsUp(true); try{const urls=await Promise.all(Array.from(fs).map(f=>api.uploadImage(f as File))); setFormData({...formData, imageUrls:[...(formData.imageUrls||[]),...urls], imageCaptions: [...(formData.imageCaptions||[]), ...urls.map(()=>'')]});}finally{setIsUp(false);}}}/></div></div>
                <div className="flex gap-3 pt-6"><button type="button" onClick={onClose} className="flex-1 py-3 font-bold text-slate-500">Cancel</button><button type="submit" className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl">Save ECO</button></div>
            </form>
        </div></div>
    );
};

const TestModal = ({ isOpen, onClose, onSave, test, productVersions }: any) => {
    const { language } = useContext(LanguageContext);
    const [isUp, setIsUp] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const opts = [{ en: 'Durability Test', zh: '耐久測試' }, { en: 'Salt Spray Test', zh: '鹽霧測試' }, { en: 'Packaging Test', zh: '包裝測試' }, { en: 'Other Custom Test', zh: '其他自訂測試' }];
    const [formData, setFormData] = useState<any>(test || { category: 'Mechanical', testName: opts[0], version: '', score: 0, status: TestStatus.PENDING, details: { en: '', zh: '' }, attachmentUrls: [] });
    const [custom, setCustom] = useState(!opts.some(o => o.en === formData.testName.en));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex justify-between items-center"><h2 className="text-xl font-bold">Edit Test Record</h2><button onClick={onClose}><X/></button></div>
            <form onSubmit={e => {e.preventDefault(); onSave(formData);}} className="p-6 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-slate-500">Test Item</label><select value={custom ? 'Other Custom Test' : formData.testName.en} onChange={e => { if(e.target.value==='Other Custom Test'){ setCustom(true); setFormData({...formData, testName:{en:'',zh:''}}); }else{ setCustom(false); const s=opts.find(o=>o.en===e.target.value); if(s)setFormData({...formData,testName:s}); } }} className="w-full p-2 border rounded-lg">{opts.map(o => <option key={o.en} value={o.en}>{language==='en'?o.en:o.zh}</option>)}</select></div>
                    <div><label className="text-xs font-bold text-slate-500">Version</label><input type="text" list="dl" value={formData.version} onChange={e => setFormData({...formData,version:e.target.value})} className="w-full p-2 border rounded-lg"/><datalist id="dl">{productVersions.map((v:any)=><option key={v} value={v}/>)}</datalist></div>
                </div>
                {custom && <input type="text" placeholder="Custom name" value={formData.testName.en} onChange={e=>setFormData({...formData,testName:{en:e.target.value,zh:e.target.value}})} className="w-full p-2 border rounded-lg"/>}
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-slate-500">Status</label><select value={formData.status} onChange={e=>setFormData({...formData,status:e.target.value})} className="w-full p-2 border rounded-lg">{Object.values(TestStatus).map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                    <div><label className="text-xs font-bold text-slate-500">Progress: {formData.score}%</label><input type="range" min="0" max="100" value={formData.score} onChange={e=>setFormData({...formData,score:Number(e.target.value)})} className="w-full"/></div>
                </div>
                <div><label className="text-xs font-bold text-slate-500">Details</label><textarea value={formData.details.en} onChange={e=>setFormData({...formData,details:{en:e.target.value,zh:e.target.value}})} className="w-full p-2 border rounded-lg" rows={3}/></div>
                <div className="pt-2"><label className="text-xs font-bold text-slate-500">Photos</label><div className="grid grid-cols-4 gap-2">{(formData.attachmentUrls||[]).map((u:any,i:any)=><img key={i} src={u} className="aspect-square object-cover rounded border"/>)}<button type="button" onClick={()=>fileRef.current?.click()} className="aspect-square border-2 border-dashed rounded flex items-center justify-center">{isUp?<Loader2 className="animate-spin"/>:<Plus/>}</button><input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={async e=>{const fs=e.target.files; if(!fs)return; setIsUp(true); try{const urls=await Promise.all(Array.from(fs).map(f=>api.uploadImage(f as File))); setFormData({...formData,attachmentUrls:[...(formData.attachmentUrls||[]),...urls]});}finally{setIsUp(false);}}}/></div></div>
                <div className="flex gap-2 pt-4"><button type="button" onClick={onClose} className="flex-1 py-3 text-slate-500">Cancel</button><button type="submit" className="flex-1 py-3 bg-slate-900 text-white rounded-xl">Save</button></div>
            </form>
        </div></div>
    );
};

const NoShipmentModal = ({ onClose, version }: any) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-sm p-8 text-center"><Ship size={48} className="mx-auto mb-4 text-amber-500"/><h3 className="text-lg font-bold mb-2">No Market Data</h3><p className="text-sm text-slate-500 mb-6">Version {version} has no recorded shipments.</p><button onClick={onClose} className="w-full py-2 bg-slate-900 text-white rounded-lg">Close</button></div></div>
);

const StartEvaluationModal = ({ onClose, onStartProject, allTesters, testerGroups = [], project, yOffset }: any) => {
    const { t } = useContext(LanguageContext);
    const [name, setName] = useState(project ? project.name.en : '');
    const [ids, setIds] = useState<string[]>(project ? project.testerIds : []);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredTesters = allTesters.filter((tr: Tester) => tr.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleApplyGroup = (groupId: string) => {
        const group = testerGroups.find(g => g.id === groupId);
        if (group) setIds(Array.from(new Set([...ids, ...group.testerIds])));
    };

    return (
        <div 
          className="fixed inset-0 z-50 flex justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in overflow-y-auto"
          style={{ paddingTop: `${yOffset}px`, alignItems: 'flex-start' }}
        >
            <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl mb-20">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h2 className="text-xl font-black text-slate-900">{project ? 'Edit Project' : 'New Evaluation Project'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
                </div>
                
                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Project Name</label>
                        <input type="text" placeholder="Enter evaluation project title..." value={name} onChange={e=>setName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-intenza-500/20 focus:border-intenza-600 outline-none font-bold"/>
                    </div>

                    {testerGroups.length > 0 && (
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Quick Import Groups</label>
                            <div className="flex flex-wrap gap-2">
                                {testerGroups.map(g => (
                                    <button key={g.id} onClick={() => handleApplyGroup(g.id)} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all">
                                        <Users2 size={12} className="text-indigo-500" />
                                        {t(g.name)} ({g.testerIds.length})
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Testers ({ids.length})</label>
                            <div className="relative w-48">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Find subject..." className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:border-intenza-600 outline-none" />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {filteredTesters.map((tester: Tester) => {
                                const isSelected = ids.includes(tester.id);
                                return (
                                    <div 
                                        key={tester.id} 
                                        onClick={() => isSelected ? setIds(ids.filter(i => i !== tester.id)) : setIds([...ids, tester.id])}
                                        className={`relative group cursor-pointer transition-all duration-300 rounded-2xl border-2 overflow-hidden ${isSelected ? 'border-intenza-600 ring-4 ring-intenza-500/10' : 'border-slate-100 hover:border-slate-200'}`}
                                    >
                                        <div className="aspect-square bg-slate-100">
                                            <img src={tester.imageUrl} className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all" alt={tester.name} />
                                            {isSelected && <div className="absolute inset-0 bg-intenza-600/20 backdrop-blur-[1px] flex items-center justify-center"><CheckCircle size={32} className="text-white drop-shadow-lg" strokeWidth={3} /></div>}
                                        </div>
                                        <div className="p-2 bg-white">
                                            <div className="text-[10px] font-black text-slate-800 truncate">{tester.name}</div>
                                            <div className="text-[8px] font-bold text-slate-400 uppercase">{tester.height}cm • {tester.gender}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-white sticky bottom-0">
                    <button 
                        onClick={()=>onStartProject({en:name,zh:name},ids)} 
                        disabled={!name || ids.length === 0}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {project ? 'Update Evaluation' : 'Launch Evaluation Project'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AddTaskModal = ({ onClose, onSave }: any) => {
    const [n, setN] = useState('');
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-sm p-6"><h3 className="font-bold mb-4">Add Task</h3><input type="text" value={n} onChange={e=>setN(e.target.value)} className="w-full p-2 border rounded-xl mb-4 focus:ring-2 focus:ring-slate-200 outline-none"/><button onClick={()=>onSave(n)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold">Add Task</button><button onClick={onClose} className="w-full py-2 mt-2 text-slate-400 font-medium">Cancel</button></div></div>
    );
};

const SetTaskResultsModal = ({ onClose, onSave, project, testers }: any) => {
    const [ids, setIds] = useState<string[]>([]);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"><div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-slide-up"><h3 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-tight">Set Quick Results</h3><div className="space-y-3 mb-8 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">{testers.filter((t:any)=>project.testerIds.includes(t.id)).map((t:any)=><div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100"><span className="font-bold text-slate-700">{t.name}</span><div className="flex gap-1.5"><button onClick={()=>setIds([...ids.filter(i=>i!==t.id),t.id])} className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${ids.includes(t.id)?'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20':'bg-white text-slate-400 border border-slate-200 hover:border-emerald-300'}`}>PASS</button><button onClick={()=>setIds(ids.filter(i=>i!==t.id))} className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${!ids.includes(t.id)?'bg-rose-500 text-white shadow-lg shadow-rose-500/20':'bg-white text-slate-400 border border-slate-200 hover:border-rose-300'}`}>NG</button></div></div>)}</div><button onClick={()=>onSave(ids)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20">Confirm Results</button></div></div>
    );
};

const SetPassNgModal = ({ onClose, onSet, existingReason }: any) => {
    const [r, setR] = useState(existingReason?.reason?.en || '');
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"><div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl animate-slide-up"><h3 className="text-xl font-black text-slate-900 mb-4 uppercase tracking-tight">Set NG Reason</h3><textarea value={r} onChange={e=>setR(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-intenza-500/20 outline-none text-slate-900 font-medium mb-6 resize-none" rows={4} placeholder="Describe the issue observed... "/><button onClick={()=>onSet({en:r,zh:r},false,[],'ISSUE')} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all">Save Reason</button></div></div>
    );
};

/**
 * REFACTORED StatusDecisionModal
 */
const StatusDecisionModal = ({ onClose, onSetStatus, onLinkEco, onCreateEco, activeEcos, versions, currentProductVersion, context }: any) => {
    const [view, setView] = useState('MAIN');
    const [v, setV] = useState(currentProductVersion);
    
    const getActiveStyle = (s: string) => {
        if (context.currentStatus !== s) return 'bg-white text-slate-400 border-slate-200 hover:border-slate-400';
        switch(s) {
            case 'PENDING': return 'bg-slate-900 text-white border-slate-900 shadow-md';
            case 'DISCUSSION': return 'bg-purple-600 text-white border-purple-600 shadow-md';
            case 'IGNORED': return 'bg-zinc-600 text-white border-zinc-600 shadow-md';
            default: return 'bg-slate-900 text-white border-slate-900';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Manage Decision</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
                </div>
                
                {view === 'MAIN' ? (
                    <div className="p-6 space-y-3">
                        <button 
                            onClick={() => setView('SELECT_V')} 
                            className="w-full py-3.5 bg-intenza-600 text-white rounded-xl font-bold hover:bg-intenza-700 transition-all shadow-lg shadow-intenza-600/20 flex items-center justify-center gap-2"
                        >
                            <Plus size={18} /> Address via New ECO
                        </button>
                        <button 
                            onClick={() => setView('LINK')} 
                            className="w-full py-3.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                        >
                            <LinkIcon size={18} /> Link Existing ECO
                        </button>
                        
                        <div className="pt-6 border-t border-slate-100">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Set Status Directly</label>
                            <div className="flex gap-2">
                                {(['PENDING', 'DISCUSSION', 'IGNORED'] as const).map(s => (
                                    <button 
                                        key={s} 
                                        onClick={() => onSetStatus(s)} 
                                        className={`flex-1 py-2 text-[10px] font-black border rounded-xl transition-all uppercase tracking-widest ${getActiveStyle(s)}`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : view === 'LINK' ? (
                    <div className="p-6 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                        <h3 className="text-xs font-black text-slate-400 uppercase mb-3">Select Active ECO</h3>
                        {activeEcos.length > 0 ? activeEcos.map((e: any) => (
                            <button 
                                key={e.id} 
                                onClick={() => onLinkEco(e.id)} 
                                className="w-full text-left p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 hover:border-intenza-300 transition-all group flex items-center justify-between"
                            >
                                <div>
                                    <div className="text-sm font-black text-slate-900">{e.ecoNumber}</div>
                                    <div className="text-[10px] font-bold text-slate-400">{e.version}</div>
                                </div>
                                <ChevronRight size={16} className="text-slate-300 group-hover:text-intenza-500" />
                            </button>
                        )) : (
                            <div className="text-center py-8 text-slate-400 italic text-sm">No active ECOs found.</div>
                        )}
                        <button onClick={() => setView('MAIN')} className="w-full py-3 text-slate-500 font-bold hover:underline">Back</button>
                    </div>
                ) : (
                    <div className="p-6 space-y-2">
                        <h3 className="text-xs font-black text-slate-400 uppercase mb-4">Target Production Version</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {versions.map((vr: any) => (
                                <button 
                                    key={vr} 
                                    onClick={() => setV(vr)} 
                                    className={`py-3 px-2 border rounded-xl text-xs font-bold transition-all ${v === vr ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/10' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                                >
                                    {vr}
                                </button>
                            ))}
                        </div>
                        <button 
                            onClick={() => onCreateEco(v)} 
                            className="w-full py-4 bg-intenza-600 text-white rounded-2xl font-black uppercase tracking-widest mt-6 shadow-xl shadow-intenza-600/20 hover:bg-intenza-700 active:scale-[0.98] transition-all"
                        >
                            Confirm & Create
                        </button>
                        <button onClick={() => setView('MAIN')} className="w-full py-2 text-slate-400 font-bold hover:underline">Cancel</button>
                    </div>
                )}
            </div>
        </div>
    );
};

const FeedbackModal = ({ onClose, onSave, feedback }: any) => {
    const [d, setD] = useState(feedback || { content: {en:'',zh:''}, source: '', category: 'Experience', date: new Date().toISOString().split('T')[0] });
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-md p-6"><h2 className="font-bold mb-4">Feedback</h2><input type="text" placeholder="Source" value={d.source} onChange={e=>setD({...d,source:e.target.value})} className="w-full p-2 border rounded mb-2"/><textarea placeholder="Content" value={d.content.en} onChange={e=>setD({...d,content:{en:e.target.value,zh:e.target.value}})} className="w-full p-2 border rounded mb-4" rows={3}/><button onClick={()=>onSave(d)} className="w-full py-2 bg-slate-900 text-white rounded">Save</button></div></div>
    );
};

const FeedbackStatusDecisionModal = ({ onClose, onUpdateStatus, onLinkEco, onCreateEco, activeEcos, versions, currentProductVersion, feedback }: any) => {
    const [view, setView] = useState('MAIN');
    const [v, setV] = useState(currentProductVersion);
    
    const getActiveStyle = (s: string) => {
        if (feedback.status !== s) return 'bg-white text-slate-400 border-slate-200 hover:border-slate-400';
        switch(s) {
            case 'PENDING': return 'bg-slate-900 text-white border-slate-900 shadow-md';
            case 'DISCUSSION': return 'bg-purple-600 text-white border-purple-600 shadow-md';
            case 'IGNORED': return 'bg-zinc-600 text-white border-zinc-600 shadow-md';
            default: return 'bg-slate-900 text-white border-slate-900';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Manage Feedback</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
                </div>
                
                {view === 'MAIN' ? (
                    <div className="p-6 space-y-3">
                        <button 
                            onClick={() => setView('SELECT_V')} 
                            className="w-full py-3.5 bg-intenza-600 text-white rounded-xl font-bold hover:bg-intenza-700 transition-all shadow-lg shadow-intenza-600/20 flex items-center justify-center gap-2"
                        >
                            <Plus size={18} /> Address via New ECO
                        </button>
                        <button 
                            onClick={() => setView('LINK')} 
                            className="w-full py-3.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                        >
                            <LinkIcon size={18} /> Link Existing ECO
                        </button>
                        
                        <div className="pt-6 border-t border-slate-100">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Set Status Directly</label>
                            <div className="flex gap-2">
                                {(['PENDING', 'DISCUSSION', 'IGNORED'] as const).map(s => (
                                    <button 
                                        key={s} 
                                        onClick={() => onUpdateStatus(feedback.id, s)} 
                                        className={`flex-1 py-2 text-[10px] font-black border rounded-xl transition-all uppercase tracking-widest ${getActiveStyle(s)}`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : view === 'LINK' ? (
                    <div className="p-6 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                        <h3 className="text-xs font-black text-slate-400 uppercase mb-3">Select Active ECO</h3>
                        {activeEcos.length > 0 ? activeEcos.map((e: any) => (
                            <button 
                                key={e.id} 
                                onClick={() => onLinkEco(e.id)} 
                                className="w-full text-left p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 hover:border-intenza-300 transition-all group flex items-center justify-between"
                            >
                                <div>
                                    <div className="text-sm font-black text-slate-900">{e.ecoNumber}</div>
                                    <div className="text-[10px] font-bold text-slate-400">{e.version}</div>
                                </div>
                                <ChevronRight size={16} className="text-slate-300 group-hover:text-intenza-500" />
                            </button>
                        )) : (
                            <div className="text-center py-8 text-slate-400 italic text-sm">No active ECOs found.</div>
                        )}
                        <button onClick={() => setView('MAIN')} className="w-full py-3 text-slate-500 font-bold hover:underline">Back</button>
                    </div>
                ) : (
                    <div className="p-6 space-y-2">
                        <h3 className="text-xs font-black text-slate-400 uppercase mb-4">Target Production Version</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {versions.map((vr: any) => (
                                <button 
                                    key={vr} 
                                    onClick={() => setV(vr)} 
                                    className={`py-3 px-2 border rounded-xl text-xs font-bold transition-all ${v === vr ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/10' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                                >
                                    {vr}
                                </button>
                            ))}
                        </div>
                        <button 
                            onClick={() => onCreateEco(v)} 
                            className="w-full py-4 bg-intenza-600 text-white rounded-2xl font-black uppercase tracking-widest mt-6 shadow-xl shadow-intenza-600/20 hover:bg-intenza-700 active:scale-[0.98] transition-all"
                        >
                            Confirm & Create
                        </button>
                        <button onClick={() => setView('MAIN')} className="w-full py-2 text-slate-400 font-bold hover:underline">Cancel</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductDetail;
