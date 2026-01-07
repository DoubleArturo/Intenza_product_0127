import React, { useState, useMemo, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, GitCommit, UserCheck, Activity, AlertTriangle, CheckCircle, Clock, Calendar, Layers, Users, Plus, X, Pencil, Trash2, Upload, MessageSquare, ChevronsRight, ChevronsLeft, Tag, FileText, User, Database, Mars, Venus, Link as LinkIcon, Search, ClipboardList, ListPlus, Check, ChevronDown, RefreshCw, HelpCircle, BarChart3, AlertCircle, PlayCircle, Loader2, StickyNote, Lightbulb, Paperclip, Video, Image as ImageIcon, Save, Star, Info, Ship } from 'lucide-react';
import { ProductModel, TestStatus, DesignChange, LocalizedString, TestResult, EcoStatus, ErgoFeedback, ErgoProject, Tester, ErgoProjectCategory, NgReason, ProjectOverallStatus, Gender, NgDecisionStatus, EvaluationTask, ShipmentData } from '../types';
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
  onUpdateProduct: (p: ProductModel) => Promise<void>;
  showAiInsights: boolean;
}

// Main Product Detail Page Component
const ProductDetail: React.FC<ProductDetailProps> = ({ products, shipments = [], testers = [], onUpdateProduct, showAiInsights }) => {
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

  const pendingNgCount = useMemo(() => {
    if (!product) return 0;
    let count = 0;
    product.ergoProjects.forEach(p => {
        (['Resistance profile', 'Experience', 'Stroke', 'Other Suggestion'] as ErgoProjectCategory[]).forEach(cat => {
            p.tasks[cat]?.forEach(t => {
                count += t.ngReasons.filter(ng => 
                    !ng.decisionStatus || 
                    ng.decisionStatus === NgDecisionStatus.PENDING || 
                    ng.decisionStatus === NgDecisionStatus.DISCUSSION || 
                    ng.decisionStatus === NgDecisionStatus.NEEDS_IMPROVEMENT
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
        
        // Use a small delay to ensure panel is open or tab has switched
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
    setEditingEco(eco);
    setIsEcoModalOpen(true);
  };
  
  const handleCloseEcoModal = () => {
    setIsEcoModalOpen(false);
    setEditingEco(null);
  };
  
  const handleSaveEco = async (ecoData: any) => {
      let updatedDesignHistory;
      let newCurrentVersion = product.currentVersion;

      if (ecoData.status === EcoStatus.IN_PRODUCTION) {
          newCurrentVersion = ecoData.version;
      }

      if (editingEco) {
          updatedDesignHistory = product.designHistory.map(eco => 
              eco.id === editingEco.id ? { ...eco, ...ecoData } : eco
          );
      } else {
          const newEco = { ...ecoData, id: `eco-${Date.now()}` };
          updatedDesignHistory = [...product.designHistory, newEco];
      }
      await onUpdateProduct({ ...product, designHistory: updatedDesignHistory, currentVersion: newCurrentVersion });
      handleCloseEcoModal();
  };

  const handleDeleteEco = (ecoId: string) => {
    if (window.confirm('確定要刪除此 ECO 記錄嗎？')) {
      const updatedDesignHistory = product.designHistory.filter(eco => eco.id !== ecoId);
      onUpdateProduct({ ...product, designHistory: updatedDesignHistory });
    }
  };
  
  const handleDeleteVersion = (versionToDelete: string) => {
    if (window.confirm(`⚠️ 警告：這將會刪除版本 ${versionToDelete} 下的所有 ECO 資訊，此動作無法復原。確定要繼續嗎？`)) {
      const updatedDesignHistory = product.designHistory.filter(eco => eco.version !== versionToDelete);
      onUpdateProduct({ ...product, designHistory: updatedDesignHistory });
    }
  };

  const handleSetCurrentVersion = (version: string) => {
    onUpdateProduct({ ...product, currentVersion: version });
  };

  // Durability Test Handlers
  const handleOpenTestModal = (test: TestResult | null = null) => {
    setEditingTest(test);
    setIsTestModalOpen(true);
  };

  const handleCloseTestModal = () => {
    setIsTestModalOpen(false);
    setEditingTest(null);
  };

  const handleSaveTest = async (testResult: Omit<TestResult, 'id'>) => {
      let updatedTests;
      if (editingTest) {
          updatedTests = product.durabilityTests.map(t => t.id === editingTest.id ? { ...editingTest, ...testResult } : t);
      } else {
          const newTest = { ...testResult, id: `test-${Date.now()}` };
          updatedTests = [...product.durabilityTests, newTest];
      }
      await onUpdateProduct({ ...product, durabilityTests: updatedTests });
      handleCloseTestModal();
  };

  const handleDeleteTest = (testId: string) => {
      if (window.confirm('Are you sure you want to delete this test result?')) {
          const updatedTests = product.durabilityTests.filter(t => t.id !== testId);
          onUpdateProduct({ ...product, durabilityTests: updatedTests });
      }
  };

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
                 onAddEco={() => handleOpenEcoModal()} 
                 onEditEco={handleOpenEcoModal} 
                 onDeleteEco={handleDeleteEco} 
                 onDeleteVersion={handleDeleteVersion} 
                 onSetCurrentVersion={handleSetCurrentVersion}
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
                        onUpdateProduct={onUpdateProduct} 
                        highlightedFeedback={highlightedFeedback} 
                        isFeedbackPanelOpen={isFeedbackPanelOpen}
                        setIsFeedbackPanelOpen={setIsFeedbackPanelOpen}
                    />
                </div>
             )}
             {activeTab === 'LIFE' && <LifeSection product={product} onAddTest={() => handleOpenTestModal()} onEditTest={handleOpenTestModal} onDeleteTest={handleDeleteTest} />}
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
      
      {isEcoModalOpen && <EcoModal isOpen={isEcoModalOpen} onClose={handleCloseEcoModal} onSave={handleSaveEco} eco={editingEco} productVersions={Array.from(new Set([product.currentVersion, ...product.designHistory.map(h => h.version)]))} product={product}/>}
      {isTestModalOpen && <TestModal isOpen={isTestModalOpen} onClose={handleCloseTestModal} onSave={handleSaveTest} test={editingTest} productVersions={Array.from(new Set([product.currentVersion, ...product.designHistory.map(h => h.version)]))}/>}
      {isNoShipmentModalOpen && <NoShipmentModal isOpen={isNoShipmentModalOpen} onClose={() => setIsNoShipmentModalOpen(false)} version={selectedVersionForModal} />}
    </div>
  );
};

// --- Sub-components & Help components ---

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
}

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

// Component for Durability Tests
const LifeSection = ({ product, onAddTest, onEditTest, onDeleteTest }: any) => {
  const { t } = useContext(LanguageContext);
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">Durability & Reliability Tests</h2>
        <button onClick={onAddTest} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors">
          <Plus size={16} /> Add Test
        </button>
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
            
            {/* Requirement: Hover Details Overlay */}
            <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm p-6 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col pointer-events-none">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                        <Info size={16} className="text-intenza-600" />
                        <span className="text-xs font-black uppercase tracking-widest text-slate-900">Details / Notes</span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                    {test.details?.en || test.details?.zh ? (
                        <p className="text-sm text-slate-700 leading-relaxed font-medium">
                            {t(test.details)}
                        </p>
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

            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                <button onClick={() => onEditTest(test)} className="p-1.5 bg-white border border-slate-100 rounded-md text-slate-500 hover:text-slate-900 hover:shadow-sm transition-all pointer-events-auto"><Pencil size={12} /></button>
                <button onClick={() => onDeleteTest(test.id)} className="p-1.5 bg-white border border-slate-100 rounded-md text-red-500 hover:text-red-700 hover:shadow-sm transition-all pointer-events-auto"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
        {product.durabilityTests.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border-2 border-dashed border-slate-200">No durability tests recorded.</div>
        )}
      </div>
    </div>
  );
};

// Project Card for Ergo Tab
const ProjectCard = ({ project, testers, product, onOpenAddTask, onEditTaskName, onDeleteTask, onOpenTaskResults, onDeleteProject, onEditProject, categoryTranslations, onStatusClick, onEditNgReason, highlightedFeedback }: any) => {
    const { t, language } = useContext(LanguageContext);
    const categories: ErgoProjectCategory[] = ['Resistance profile', 'Experience', 'Stroke', 'Other Suggestion'];

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
                <div className="flex items-center gap-2">
                    <button onClick={onEditProject} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white transition-colors"><Pencil size={16}/></button>
                    <button onClick={() => { if(window.confirm('Delete this project?')) onDeleteProject(); }} className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-white transition-colors"><Trash2 size={16}/></button>
                </div>
            </div>
            
            <div className="p-6 space-y-8">
                {categories.map(cat => (
                    <div key={cat} className="space-y-4">
                        <div className="flex items-center justify-between border-l-4 border-intenza-500 pl-3">
                            <h4 className="font-bold text-sm text-slate-800 uppercase tracking-tight">{language === 'en' ? cat : categoryTranslations[cat]}</h4>
                            <button onClick={() => onOpenAddTask(project.id, cat)} className="text-[10px] font-bold text-intenza-600 flex items-center gap-1 hover:underline"><Plus size={10}/> Add Task</button>
                        </div>
                        
                        <div className="space-y-3 pl-4">
                            {project.tasks[cat]?.map((task: any) => (
                                <div key={task.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100 group/task">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <h5 className="font-bold text-slate-700 text-sm">{t(task.name)}</h5>
                                            <button onClick={() => onEditTaskName(project.id, cat, task.id, t(task.name))} className="opacity-0 group-hover/task:opacity-100 p-1 text-slate-400 hover:text-slate-600"><Pencil size={12}/></button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => onOpenTaskResults(cat, task.id)} className="text-[10px] font-bold bg-white border border-slate-200 text-slate-600 px-3 py-1 rounded-lg hover:border-slate-400 transition-all">Set Pass/NG</button>
                                            <button onClick={() => { if(window.confirm('Delete task?')) onDeleteTask(project.id, cat, task.id); }} className="opacity-0 group-hover/task:opacity-100 p-1 text-slate-400 hover:text-red-500"><Trash2 size={12}/></button>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {project.testerIds.map((tid: string) => {
                                            const tester = testers.find((ts: any) => ts.id === tid);
                                            const isPass = task.passTesterIds.includes(tid);
                                            const ngReason = task.ngReasons.find((r: any) => r.testerId === tid);
                                            const isHighlighted = highlightedFeedback?.projectId === project.id && highlightedFeedback?.taskId === task.id && highlightedFeedback?.testerId === tid;
                                            const linkedEco = product.designHistory.find((eco: DesignChange) => eco.id === ngReason?.linkedEcoId);
                                            
                                            return (
                                                <div 
                                                    key={tid} 
                                                    data-feedback-id={`${project.id}-${task.id}-${tid}`}
                                                    className={`p-3 rounded-xl border transition-all ${
                                                        isPass ? 'bg-white border-slate-100 opacity-60' : 
                                                        isHighlighted ? 'bg-intenza-50 border-intenza-400 shadow-md ring-2 ring-intenza-500/10' :
                                                        'bg-white border-slate-200'
                                                    }`}
                                                >
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
                                                                <button 
                                                                    onClick={() => onEditNgReason(cat, task.id, tid)}
                                                                    className="text-[9px] font-bold text-intenza-600 hover:underline"
                                                                >
                                                                    Edit Reason
                                                                </button>
                                                                {/* Fix typo: change 'ngDecisionStatus' to 'NgDecisionStatus' to correctly reference the enum */}
                                                                <button 
                                                                    onClick={() => onStatusClick(project.id, cat, task.id, tid, ngReason?.decisionStatus || NgDecisionStatus.PENDING, ngReason?.linkedEcoId)}
                                                                    className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase border transition-colors ${ngDecisionStyles[ngReason?.decisionStatus || NgDecisionStatus.PENDING]}`}
                                                                >
                                                                    {linkedEco ? linkedEco.ecoNumber : ngDecisionTranslations[NgDecisionStatus.PENDING]}
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

// Customer Feedback Card
const CustomerFeedbackCard = ({ feedback, onStatusClick, onEdit, onDelete, product, isHighlighted }: any) => {
    const { t } = useContext(LanguageContext);
    const linkedEco = product.designHistory.find((eco: DesignChange) => eco.id === feedback.linkedEcoId);

    return (
        <div 
            data-customer-feedback-id={feedback.id}
            className={`rounded-xl border p-4 shadow-sm group transition-all ${
                isHighlighted ? 'bg-intenza-50 border-intenza-400 shadow-md ring-2 ring-intenza-500/10 scale-[1.02]' : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
        >
            <div className="flex justify-between items-start mb-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{feedback.date}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={onEdit} className="p-1 text-slate-400 hover:text-slate-600"><Pencil size={12}/></button>
                    <button onClick={onDelete} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={12}/></button>
                </div>
            </div>
            <p className="text-sm text-slate-800 font-medium leading-relaxed mb-4">{t(feedback.content)}</p>
            <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase">
                    <User size={10}/> {feedback.source}
                </div>
                <button 
                    onClick={onStatusClick}
                    className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border transition-colors ${
                        (feedback.status === 'PENDING' && !linkedEco) ? 'bg-slate-100 text-slate-500 border-slate-200' :
                        (feedback.status === 'DISCUSSION' || linkedEco) ? 'bg-purple-50 text-purple-600 border-purple-200' :
                        'bg-zinc-50 text-zinc-500 border-zinc-200'
                    }`}
                >
                    {linkedEco ? linkedEco.ecoNumber : (feedback.status || 'PENDING')}
                </button>
            </div>
        </div>
    );
};

// Design Section
const DesignSection = ({ product, shipments, onAddEco, onEditEco, onDeleteEco, onDeleteVersion, onSetCurrentVersion, onNoShipment }: { product: ProductModel, shipments: ShipmentData[], onAddEco: () => void, onEditEco: (eco: DesignChange) => void, onDeleteEco: (id: string) => void, onDeleteVersion: (version: string) => void, onSetCurrentVersion: (version: string) => void, onNoShipment: (version: string) => void }) => {
  const { t, language } = useContext(LanguageContext);
  const navigate = useNavigate();
  const versions = useMemo(() => Array.from(new Set([product.currentVersion, ...product.designHistory.map(h => h.version)])).sort().reverse(), [product]);
  const [selectedVersion, setSelectedVersion] = useState<string>(versions[0]);
  
  useEffect(() => {
    if (!versions.includes(selectedVersion)) setSelectedVersion(versions[0] || product.currentVersion);
  }, [versions, selectedVersion, product.currentVersion]);

  const activeChanges = useMemo(() => product.designHistory.filter((h: any) => h.version === selectedVersion), [product.designHistory, selectedVersion]);

  const handleLinkBack = (source: any) => {
    navigate(`/product/${product.id}`, { state: { highlightFeedback: source } });
  }

  const handleJumpToAnalytics = () => {
    const formattedSelectedVersion = formatVersion(selectedVersion);
    const hasShipments = shipments.some(s => 
        s.sku === product.sku && formatVersion(s.version) === formattedSelectedVersion
    );

    if (!hasShipments) {
        onNoShipment(selectedVersion);
        return;
    }

    navigate('/analytics', { 
        state: { 
            autoDrill: { 
                sku: product.sku, 
                version: selectedVersion 
            } 
        } 
    });
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">Design Version History</h2>
        <div className="flex gap-2">
            <button onClick={onAddEco} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors"><Plus size={16} /> Add ECO</button>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        <div className="flex items-center gap-8 px-6 border-b border-slate-100 overflow-x-auto bg-slate-50/50">
          {versions.map((version) => (
            <div key={version} className="relative group flex items-center">
              <button onClick={() => setSelectedVersion(version)} className={`py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap px-2 ${selectedVersion === version ? 'border-intenza-600 text-intenza-600' : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'}`}>{version}</button>
            </div>
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
                    <button 
                        onClick={handleJumpToAnalytics}
                        className="p-1.5 bg-slate-100 text-slate-500 hover:text-intenza-600 hover:bg-intenza-50 rounded-lg transition-all shadow-sm border border-slate-200"
                        title={t({ en: 'View market distribution for this version', zh: '檢視此版本的出貨客戶分佈' })}
                    >
                        <Users size={18} />
                    </button>
                </div>
                {selectedVersion !== product.currentVersion && (
                   <button 
                      onClick={() => onSetCurrentVersion(selectedVersion)}
                      className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 w-fit mt-1"
                   >
                      <Star size={12} fill="currentColor" /> {t({ en: 'Set as Current Production Version', zh: '設為目前的正式量產版本' })}
                   </button>
                )}
             </div>
             <button 
                onClick={() => onDeleteVersion(selectedVersion)} 
                className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
             >
                <Trash2 size={14} /> 刪除此版本及其所有 ECO
             </button>
          </div>
          
          {activeChanges.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
               <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300"><GitCommit size={32} /></div>
               <h4 className="text-slate-900 font-medium">No Change Records</h4>
               <p className="text-slate-500 text-sm mt-1 max-w-sm">No Engineering Change Orders (ECO) recorded for this version.</p>
            </div>
          ) : (
            <div className="space-y-6">
               {activeChanges.map((change) => (
                  <div key={change.id} className="group relative rounded-lg transition-colors hover:bg-slate-50/50 -m-3 p-3">
                     <div className="flex flex-col md:flex-row gap-6">
                        <div className="md:w-48 flex-shrink-0">
                           <div className="flex items-center gap-3 mb-2">
                              <span className="font-mono text-sm font-bold text-intenza-600 bg-intenza-50 px-2 py-1 rounded border border-intenza-100">
                                {change.ecoNumber || change.ecrNumber || 'N/A'}
                              </span>
                           </div>
                           <div className="flex flex-col gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider mt-2">
                              {change.ecrNumber && (
                                <div className="flex items-center gap-2"><Calendar size={12} className="text-slate-400" />ECR Initiation: {change.ecrDate || 'N/A'}</div>
                              )}
                              <div className="flex items-center gap-2"><Calendar size={12} className="text-slate-400" />ECO Date: {change.date}</div>
                              {change.implementationDate && (
                                <div className="flex items-center gap-2 text-emerald-600"><Check size={12}/>Production: {change.implementationDate}</div>
                              )}
                           </div>
                        </div>
                        <div className="flex-1">
                           <div className="flex items-start justify-between">
                              <h4 className="text-lg font-medium text-slate-900 mb-3 leading-snug pr-4">{t(change.description)}</h4>
                              <div className="flex flex-col items-end gap-1">
                                 <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border whitespace-nowrap ${ecoStatusStyles[change.status]}`}>{language === 'en' ? change.status : ecoStatusTranslations[change.status]}</span>
                              </div>
                           </div>
                           {change.imageUrls && change.imageUrls.length > 0 && (
                              <div className="mb-4 flex flex-wrap gap-2">
                                 {change.imageUrls.map((url, imgIndex) => (
                                    <div key={imgIndex} className="inline-block group/image relative">
                                       {isVideo(url) ? (
                                          <video src={url} controls className="h-32 w-auto rounded-lg border border-slate-200 shadow-sm" />
                                       ) : (
                                          <a href={url} target="_blank" rel="noopener noreferrer">
                                             <img src={url} alt="" className="h-32 w-auto rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x200?text=Error'; }} />
                                          </a>
                                       )}
                                    </div>
                                 ))}
                              </div>
                           )}
                           {change.sourceFeedbacks && change.sourceFeedbacks.length > 0 && (
                              <div className="mt-2 flex flex-col gap-1">
                                 {change.sourceFeedbacks.map((fb, idx) => (
                                    <button key={idx} onClick={() => handleLinkBack(fb)} className="text-xs text-blue-600 font-semibold flex items-center gap-1 hover:underline w-fit">
                                       <LinkIcon size={12}/> View Feedback Source #{idx + 1}
                                    </button>
                                 ))}
                              </div>
                           )}
                        </div>
                     </div>
                     <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEditEco(change)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800"><Pencil size={14} /></button>
                        <button onClick={() => onDeleteEco(change.id)} className="p-2 bg-red-50 rounded-full text-red-500 hover:bg-red-100 hover:text-red-700"><Trash2 size={14} /></button>
                     </div>
                  </div>
               ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Ergonomics Section
const ErgoSection = ({ product, testers, onUpdateProduct, highlightedFeedback, isFeedbackPanelOpen, setIsFeedbackPanelOpen }: { product: ProductModel, testers: Tester[], onUpdateProduct: (p: ProductModel) => void, highlightedFeedback: any, isFeedbackPanelOpen: boolean, setIsFeedbackPanelOpen: (o: boolean) => void }) => {
  const { t, language } = useContext(LanguageContext);
  const navigate = useNavigate();
  
  const [isStartEvaluationModalOpen, setStartEvaluationModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ErgoProject | null>(null);

  const [addTaskModalState, setAddTaskModalState] = useState<{ isOpen: boolean, context: { projectId: string, category: ErgoProjectCategory } | null }>({ isOpen: false, context: null });
  const [editTaskModalState, setEditTaskModalState] = useState<{ isOpen: boolean, context: { projectId: string, category: ErgoProjectCategory, taskId: string, currentName: string } | null }>({ isOpen: false, context: null });

  const [taskResultModalState, setTaskResultModalState] = useState<{ isOpen: boolean; context: { projectId: string, category: ErgoProjectCategory, taskId: string } | null }>({ isOpen: false, context: null });
  const [feedbackModalState, setFeedbackModalState] = useState<{ isOpen: boolean, feedback: ErgoFeedback | null }>({ isOpen: false, feedback: null });
  const [ngReasonModalState, setNgReasonModalState] = useState<{ isOpen: boolean, context: { projectId: string, category: ErgoProjectCategory, taskId: string, testerId: string } | null }>({ isOpen: false, context: null });
  const [statusModalState, setStatusModalState] = useState<{ isOpen: boolean, context: { projectId: string, category: ErgoProjectCategory, taskId: string, testerId: string, currentStatus: NgDecisionStatus, linkedEcoId?: string } | null }>({ isOpen: false, context: null });
  
  const [feedbackStatusModal, setFeedbackStatusModal] = useState<{ isOpen: boolean, feedback: ErgoFeedback | null }>({ isOpen: false, feedback: null });

  const productVersions = useMemo(() => Array.from(new Set([product.currentVersion, ...product.designHistory.map(h => h.version)])).sort().reverse(), [product]);

  const handleStartProject = (name: LocalizedString, selectedTesterIds: string[]) => {
    const newProject: ErgoProject = {
      id: `proj-${Date.now()}`,
      name: name,
      date: new Date().toISOString().split('T')[0],
      testerIds: selectedTesterIds,
      overallStatus: ProjectOverallStatus.PENDING,
      tasks: { 'Resistance profile': [], 'Experience': [], 'Stroke': [], 'Other Suggestion': [] },
      uniqueNgReasons: {}
    };
    onUpdateProduct({ ...product, ergoProjects: [...product.ergoProjects, newProject] });
    setStartEvaluationModalOpen(false);
  };
  
  const handleEditProject = (name: LocalizedString, selectedTesterIds: string[]) => {
      if (!editingProject) return;
      const updatedProjects = product.ergoProjects.map(p => p.id === editingProject.id ? { ...p, name, testerIds: selectedTesterIds } : p);
      onUpdateProduct({ ...product, ergoProjects: updatedProjects });
      setEditingProject(null);
  };

  const handleOpenEditProject = (project: ErgoProject) => { setEditingProject(project); setStartEvaluationModalOpen(true); };
  const handleDeleteProject = (projectId: string) => { onUpdateProduct({ ...product, ergoProjects: product.ergoProjects.filter(p => p.id !== projectId) }); };

  const handleAddTask = (projectId: string, category: ErgoProjectCategory, taskName: string) => {
      const updatedProjects = product.ergoProjects.map(p => {
          if (p.id === projectId) {
              const newTask: EvaluationTask = { id: `task-${Date.now()}`, name: { en: taskName, zh: taskName }, passTesterIds: [], ngReasons: [] };
              return { ...p, tasks: { ...p.tasks, [category]: [...(p.tasks[category] || []), newTask] } };
          }
          return p;
      });
      onUpdateProduct({ ...product, ergoProjects: updatedProjects });
  };

  const handleUpdateTaskName = (projectId: string, category: ErgoProjectCategory, taskId: string, newName: string) => {
      const updatedProjects = product.ergoProjects.map(p => {
          if (p.id === projectId) {
              const updatedTasks = p.tasks[category].map(t => t.id === taskId ? { ...t, name: { en: newName, zh: newName } } : t);
              return { ...p, tasks: { ...p.tasks, [category]: updatedTasks } };
          }
          return p;
      });
      onUpdateProduct({ ...product, ergoProjects: updatedProjects });
      setEditTaskModalState({ isOpen: false, context: null });
  };

  const handleSaveTask = (name: string) => {
      if (addTaskModalState.context) {
          handleAddTask(addTaskModalState.context.projectId, addTaskModalState.context.category, name);
          setAddTaskModalState({ isOpen: false, context: null });
      }
  }

  const handleDeleteTask = (projectId: string, category: ErgoProjectCategory, taskId: string) => {
      const updatedProjects = product.ergoProjects.map(p => {
          if (p.id === projectId) return { ...p, tasks: { ...p.tasks, [category]: p.tasks[category].filter(t => t.id !== taskId) } };
          return p;
      });
      onUpdateProduct({ ...product, ergoProjects: updatedProjects });
  };

  const handleUpdateTaskResults = (projectId: string, category: ErgoProjectCategory, taskId: string, passTesterIds: string[]) => {
      const updatedProjects = product.ergoProjects.map(p => {
          if (p.id === projectId) {
              const updatedTasks = p.tasks[category].map(t => {
                  if (t.id === taskId) {
                      const allProjectTesters = p.testerIds;
                      const newNgTesterIds = allProjectTesters.filter(tid => !passTesterIds.includes(tid));
                      const currentNgReasons = t.ngReasons || [];
                      const newNgReasons = newNgTesterIds.map(tid => {
                          const existing = currentNgReasons.find(r => r.testerId === tid);
                          return existing || { testerId: tid, reason: { en: '', zh: '' }, decisionStatus: NgDecisionStatus.PENDING };
                      });
                      return { ...t, passTesterIds, ngReasons: newNgReasons };
                  }
                  return t;
              });
              return { ...p, tasks: { ...p.tasks, [category]: updatedTasks } };
          }
          return p;
      });
      onUpdateProduct({ ...product, ergoProjects: updatedProjects });
      setTaskResultModalState({ isOpen: false, context: null });
  };

  const handleSetNgReason = (reason: LocalizedString, isNewTag: boolean, attachments: string[], type: 'ISSUE' | 'IDEA') => {
      if (!ngReasonModalState.context) return;
      const { projectId, category, taskId, testerId } = ngReasonModalState.context;
      const updatedProjects = product.ergoProjects.map(p => {
          if (p.id === projectId) {
              const updatedTasks = p.tasks[category].map(t => {
                  if (t.id === taskId) {
                      const updatedNgReasons = t.ngReasons.map(ng => ng.testerId === testerId ? { ...ng, reason, attachmentUrls: attachments, decisionStatus: type === 'IDEA' ? NgDecisionStatus.IDEA : ng.decisionStatus } : ng);
                      return { ...t, ngReasons: updatedNgReasons };
                  }
                  return t;
              });
              let newUniqueReasons = { ...p.uniqueNgReasons };
              if (isNewTag && reason.en) {
                  const currentReasons = newUniqueReasons[category] || [];
                  newUniqueReasons[category] = [...currentReasons, reason];
              }
              return { ...p, tasks: { ...p.tasks, [category]: updatedTasks }, uniqueNgReasons: newUniqueReasons };
          }
          return p;
      });
      onUpdateProduct({ ...product, ergoProjects: updatedProjects });
      setNgReasonModalState({ isOpen: false, context: null });
  };

  const handleCreateEcoFromFeedback = (projectId: string, category: ErgoProjectCategory, taskId: string, testerId: string, targetVersion: string) => {
      const project = product.ergoProjects.find(p => p.id === projectId);
      const task = project?.tasks[category].find(t => t.id === taskId);
      const ngReason = task?.ngReasons.find(n => n.testerId === testerId);
      if (!ngReason || !project) return;
      const ecoNumber = `EVAL-${Date.now().toString().slice(-4)}`;
      const ecoDescriptionText = `[Needs Improvement] ${t(ngReason.reason)}`;
      const newEcoId = `eco-${Date.now()}`; 
      const newEco: DesignChange = {
          id: newEcoId,
          ecoNumber: ecoNumber,
          date: new Date().toISOString().split('T')[0],
          version: targetVersion,
          description: {en: ecoDescriptionText, zh: ecoDescriptionText},
          affectedBatches: [],
          affectedCustomers: [],
          status: EcoStatus.EVALUATING,
          imageUrls: ngReason.attachmentUrls || [],
          sourceFeedbacks: [{ projectId: project.id, category, taskId, testerId: ngReason.testerId }]
      };
      const updatedProjects = product.ergoProjects.map(p => {
        if (p.id === project.id) {
          const updatedTasks = p.tasks[category].map(t => {
              if (t.id === taskId) {
                  const updatedNgReasons = t.ngReasons.map(ng => ng.testerId === ngReason.testerId ? { ...ng, linkedEcoId: newEcoId, decisionStatus: NgDecisionStatus.NEEDS_IMPROVEMENT } : ng);
                  return { ...t, ngReasons: updatedNgReasons };
              }
              return t;
          });
          return { ...p, tasks: { ...p.tasks, [category]: updatedTasks } };
        }
        return p;
      });
      onUpdateProduct({...product, designHistory: [...product.designHistory, newEco], ergoProjects: updatedProjects });
      setStatusModalState({ isOpen: false, context: null });
  };

  const handleCreateEcoFromCustomerFeedback = (feedbackId: string, targetVersion: string) => {
      const feedback = product.customerFeedback.find(f => f.id === feedbackId);
      if (!feedback) return;
      const ecoNumber = `CUST-${Date.now().toString().slice(-4)}`;
      const ecoDescriptionText = `[Customer Feedback] ${t(feedback.content)}`;
      const newEcoId = `eco-${Date.now()}`;
      const newEco: DesignChange = {
          id: newEcoId,
          ecoNumber: ecoNumber,
          date: new Date().toISOString().split('T')[0],
          version: targetVersion,
          description: {en: ecoDescriptionText, zh: ecoDescriptionText},
          affectedBatches: [],
          affectedCustomers: [],
          status: EcoStatus.EVALUATING,
          imageUrls: feedback.attachmentUrls || [],
          sourceFeedbacks: [{ category: feedback.category, feedbackId: feedback.id }]
      };
      
      onUpdateProduct({
          ...product,
          designHistory: [...product.designHistory, newEco],
          customerFeedback: product.customerFeedback.map(f => f.id === feedbackId ? { ...f, status: 'DISCUSSION', linkedEcoId: newEcoId } : f)
      });
      setFeedbackStatusModal({ isOpen: false, feedback: null });
  };

  const handleLinkEcoToCustomerFeedback = (feedbackId: string, ecoId: string) => {
      const currentFeedback = product.customerFeedback.find(f => f.id === feedbackId);
      if (!currentFeedback) return;
      const oldEcoId = currentFeedback.linkedEcoId;
      const isUnlinking = oldEcoId === ecoId;

      const newLinkedId = isUnlinking ? undefined : ecoId;
      const newStatus = isUnlinking ? 'PENDING' : 'DISCUSSION';

      // Requirement: Clean up source feedbacks in ALL ECOs for this specific feedbackId, preventing stale links
      const updatedDesignHistory = product.designHistory.map(eco => {
          let sources = (eco.sourceFeedbacks || []).filter(s => s.feedbackId !== feedbackId);
          if (eco.id === ecoId && !isUnlinking) {
              sources.push({ category: currentFeedback.category, feedbackId });
          }
          return { ...eco, sourceFeedbacks: sources };
      });

      onUpdateProduct({
          ...product,
          designHistory: updatedDesignHistory,
          customerFeedback: product.customerFeedback.map(f => f.id === feedbackId ? { ...f, status: newStatus as any, linkedEcoId: newLinkedId } : f)
      });
      
      // Update modal state to refresh UI visually without closing
      if (feedbackStatusModal.feedback) {
        setFeedbackStatusModal({
          ...feedbackStatusModal,
          feedback: { ...feedbackStatusModal.feedback, linkedEcoId: newLinkedId, status: newStatus as any }
        });
      }
  };

  const handleLinkExistingEco = (projectId: string, category: ErgoProjectCategory, taskId: string, testerId: string, ecoId: string) => {
      const oldEcoId = statusModalState.context?.linkedEcoId;
      const isUnlinking = oldEcoId === ecoId;

      // Requirement: Clean up source feedbacks in ALL ECOs for this specific project/task/tester triplet
      const updatedDesignHistory = product.designHistory.map(eco => {
          let sources = (eco.sourceFeedbacks || []).filter(s => 
              !(s.projectId === projectId && s.taskId === taskId && s.testerId === testerId)
          );
          
          if (eco.id === ecoId && !isUnlinking) {
              sources.push({ projectId, category, taskId, testerId });
          }
          
          return { ...eco, sourceFeedbacks: sources };
      });

      const updatedProjects = product.ergoProjects.map(p => {
          if (p.id === projectId) {
              const updatedTasks = p.tasks[category].map(t => {
                  if (t.id === taskId) {
                      const updatedNgReasons = t.ngReasons.map(ng => {
                        if (ng.testerId === testerId) {
                            return { 
                                ...ng, 
                                linkedEcoId: isUnlinking ? undefined : ecoId, 
                                decisionStatus: isUnlinking ? NgDecisionStatus.PENDING : NgDecisionStatus.NEEDS_IMPROVEMENT 
                            };
                        }
                        return ng;
                      });
                      return { ...t, ngReasons: updatedNgReasons };
                  }
                  return t;
              });
              return { ...p, tasks: { ...p.tasks, [category]: updatedTasks } };
          }
          return p;
      });
      onUpdateProduct({ ...product, designHistory: updatedDesignHistory, ergoProjects: updatedProjects });
      
      // Update modal state to refresh UI visually without closing
      if (statusModalState.context) {
          setStatusModalState({
            ...statusModalState,
            context: { 
                ...statusModalState.context, 
                linkedEcoId: isUnlinking ? undefined : ecoId,
                currentStatus: isUnlinking ? NgDecisionStatus.PENDING : NgDecisionStatus.NEEDS_IMPROVEMENT
            }
          });
      }
  };

  const handleSetNgDecision = (projectId: string, category: ErgoProjectCategory, taskId: string, testerId: string, decision: NgDecisionStatus) => {
    const updatedProjects = product.ergoProjects.map(p => {
        if (p.id === projectId) {
            const updatedTasks = p.tasks[category].map(t => {
                if (t.id === taskId) {
                    const updatedNgReasons = t.ngReasons.map(ng => {
                        if (ng.testerId === testerId) {
                            const isClear = decision !== NgDecisionStatus.NEEDS_IMPROVEMENT;
                            return { ...ng, decisionStatus: decision, linkedEcoId: isClear ? undefined : ng.linkedEcoId }; 
                        }
                        return ng;
                    });
                    return { ...t, ngReasons: updatedNgReasons };
                }
                return t;
            });
            return { ...p, tasks: { ...p.tasks, [category]: updatedTasks } };
        }
        return p;
    });
    onUpdateProduct({ ...product, ergoProjects: updatedProjects });
    setStatusModalState({ isOpen: false, context: null });
  };
  
  const handleOpenStatusModal = (projectId: string, category: ErgoProjectCategory, taskId: string, testerId: string, currentStatus: NgDecisionStatus, linkedEcoId?: string) => {
      setStatusModalState({ isOpen: true, context: { projectId, category, taskId, testerId, currentStatus, linkedEcoId } });
  }

  const handleSaveFeedback = (feedbackData: Omit<ErgoFeedback, 'id' | 'type'>, isNewTag: boolean) => {
    let updatedFeedbackList;
    if (feedbackModalState.feedback) {
        updatedFeedbackList = product.customerFeedback.map(fb => fb.id === feedbackModalState.feedback!.id ? { ...feedbackModalState.feedback!, ...feedbackData, status: feedbackModalState.feedback!.status } : fb);
    } else {
        const newFeedback: ErgoFeedback = { ...feedbackData, id: `fb-${Date.now()}`, type: 'COMPLAINT', status: 'PENDING' };
        updatedFeedbackList = [...product.customerFeedback, newFeedback];
    }
    let updatedTags = { ...product.uniqueFeedbackTags };
    if (isNewTag) {
        const currentTags = updatedTags[feedbackData.category] || [];
        updatedTags[feedbackData.category] = [...currentTags, feedbackData.content];
    }
    onUpdateProduct({ ...product, customerFeedback: updatedFeedbackList, uniqueFeedbackTags: updatedTags });
    setFeedbackModalState({ isOpen: false, feedback: null });
  };
  
  const handleDeleteFeedback = (feedbackId: string) => {
      const updatedFeedbackList = product.customerFeedback.filter(fb => fb.id !== feedbackId);
      onUpdateProduct({ ...product, customerFeedback: updatedFeedbackList });
  };

  const handleUpdateFeedbackStatus = (feedbackId: string, status: 'PENDING' | 'DISCUSSION' | 'IGNORED') => {
      const updatedFeedbackList = product.customerFeedback.map(fb => fb.id === feedbackId ? { ...fb, status } : fb);
      onUpdateProduct({ ...product, customerFeedback: updatedFeedbackList });
      setFeedbackStatusModal({ isOpen: false, feedback: null });
  };

  const categoryTranslations: Record<ErgoProjectCategory, string> = { 'Resistance profile': 'Resistance profile', 'Experience': 'Ergonomic Operation Experience', 'Stroke': 'Exercise Stroke', 'Other Suggestion': 'Other Suggestions' };
  const activeEcosList = product.designHistory.filter(e => e.status !== EcoStatus.IN_PRODUCTION && e.status !== EcoStatus.DESIGN_COMPLETE);

  return (
    <div className="relative animate-fade-in">
      <div className={`transition-all duration-500 ease-in-out ${isFeedbackPanelOpen ? 'pr-[40%]' : 'pr-14'}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="w-full flex justify-end">
             <button 
                onClick={() => { setEditingProject(null); setStartEvaluationModalOpen(true); }}
                className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-sm">
                <Plus size={16} /> Start Evaluation
             </button>
          </div>
        </div>
        
        <div className="space-y-6">
          {product.ergoProjects.length === 0 && <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">No evaluation projects started.</div>}
          {product.ergoProjects.map(project => (
             <ProjectCard 
                key={project.id}
                project={project}
                testers={testers}
                product={product}
                onOpenAddTask={(pid: string, cat: ErgoProjectCategory) => setAddTaskModalState({ isOpen: true, context: { projectId: pid, category: cat } })}
                onEditTaskName={(pid: string, cat: ErgoProjectCategory, tid: string, name: string) => setEditTaskModalState({ isOpen: true, context: { projectId: pid, category: cat, taskId: tid, currentName: name } })}
                onDeleteTask={handleDeleteTask}
                onOpenTaskResults={(cat: ErgoProjectCategory, taskId: string) => setTaskResultModalState({ isOpen: true, context: { projectId: project.id, category: cat, taskId } })}
                onDeleteProject={() => handleDeleteProject(project.id)}
                onEditProject={() => handleOpenEditProject(project)}
                categoryTranslations={categoryTranslations}
                onStatusClick={handleOpenStatusModal}
                onEditNgReason={(cat: ErgoProjectCategory, taskId: string, testerId: string) => setNgReasonModalState({ isOpen: true, context: { projectId: project.id, category: cat, taskId, testerId } })}
                highlightedFeedback={highlightedFeedback}
             />
          ))}
        </div>
      </div>

      <div className={`absolute top-0 right-0 h-full transition-all duration-500 ease-in-out ${isFeedbackPanelOpen ? 'w-[38%]' : 'w-12'}`}>
        <div className="bg-white rounded-2xl border border-slate-200 h-full shadow-2xl flex flex-col">
          <button 
            onClick={() => setIsFeedbackPanelOpen(!isFeedbackPanelOpen)} 
            className="absolute top-1/2 -left-6 -translate-y-1/2 bg-white p-2 rounded-l-lg border-l border-t border-b border-slate-200 hover:bg-slate-50 shadow-md"
          >
            {isFeedbackPanelOpen ? <ChevronsRight size={20} className="text-slate-400" /> : <ChevronsLeft size={20} className="text-slate-400" />}
          </button>
          {isFeedbackPanelOpen && (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2"><MessageSquare size={18} className="text-intenza-500"/>Customer Feedback</h3>
                    <button onClick={() => setFeedbackModalState({ isOpen: true, feedback: null })} className="text-xs font-medium bg-intenza-600 text-white px-3 py-1.5 rounded-md hover:bg-intenza-700 flex items-center gap-1 shadow-lg shadow-intenza-900/10"><Plus size={12}/>Add</button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {(['Resistance profile', 'Experience', 'Stroke', 'Other Suggestion'] as ErgoProjectCategory[]).map(cat => {
                        const catFeedback = (product.customerFeedback || []).filter(f => f.category === cat);
                        if (catFeedback.length === 0) return null;
                        return (
                            <div key={cat}>
                                 <h4 className="font-semibold text-xs text-slate-400 mb-3 uppercase tracking-wider pl-1 border-l-2 border-slate-300">{language === 'en' ? cat : categoryTranslations[cat]}</h4>
                                 <div className="space-y-3">
                                    {catFeedback.map(fb => (
                                        <CustomerFeedbackCard 
                                            key={fb.id}
                                            feedback={fb}
                                            category={cat}
                                            product={product}
                                            isHighlighted={highlightedFeedback?.feedbackId === fb.id}
                                            onStatusClick={() => setFeedbackStatusModal({ isOpen: true, feedback: fb })}
                                            onEdit={() => setFeedbackModalState({ isOpen: true, feedback: fb })}
                                            onDelete={() => handleDeleteFeedback(fb.id)}
                                        />
                                    ))}
                                 </div>
                            </div>
                        );
                    })}
                    {(product.customerFeedback || []).length === 0 && <div className="text-center py-12 text-slate-400">No customer feedback.</div>}
                </div>
            </div>
          )}
        </div>
      </div>
      
      {isStartEvaluationModalOpen && <StartEvaluationModal isOpen={isStartEvaluationModalOpen} onClose={() => { setStartEvaluationModalOpen(false); setEditingProject(null); }} onStartProject={editingProject ? handleEditProject : handleStartProject} allTesters={testers} project={editingProject} />}
      {addTaskModalState.isOpen && addTaskModalState.context && <AddTaskModal isOpen={addTaskModalState.isOpen} onClose={() => setAddTaskModalState({ isOpen: false, context: null })} onSave={handleSaveTask} />}
      {editTaskModalState.isOpen && editTaskModalState.context && <EditTaskNameModal isOpen={editTaskModalState.isOpen} onClose={() => setEditTaskModalState({ isOpen: false, context: null })} currentName={editTaskModalState.context.currentName} onSave={(newName) => handleUpdateTaskName(editTaskModalState.context!.projectId, editTaskModalState.context!.category, editTaskModalState.context!.taskId, newName)} />}
      {taskResultModalState.isOpen && taskResultModalState.context && <SetTaskResultsModal isOpen={taskResultModalState.isOpen} onClose={() => setTaskResultModalState({ isOpen: false, context: null })} onSave={(passIds) => handleUpdateTaskResults(taskResultModalState.context!.projectId, taskResultModalState.context!.category, taskResultModalState.context!.taskId, passIds)} context={taskResultModalState.context} project={product.ergoProjects.find(p => p.id === taskResultModalState.context!.projectId)!} testers={testers} />}
      {ngReasonModalState.isOpen && ngReasonModalState.context && <SetPassNgModal isOpen={ngReasonModalState.isOpen} onClose={() => setNgReasonModalState({ isOpen: false, context: null })} onSet={handleSetNgReason} context={ngReasonModalState.context} project={product.ergoProjects.find(p => p.id === ngReasonModalState.context!.projectId)!} existingReason={product.ergoProjects.find(p => p.id === ngReasonModalState.context!.projectId)?.tasks[ngReasonModalState.context!.category].find(t => t.id === ngReasonModalState.context!.taskId)?.ngReasons.find(ng => ng.testerId === ngReasonModalState.context!.testerId)} />}
      {statusModalState.isOpen && statusModalState.context && <StatusDecisionModal isOpen={statusModalState.isOpen} onClose={() => setStatusModalState({ isOpen: false, context: null })} context={statusModalState.context} onSetStatus={(status) => handleSetNgDecision(statusModalState.context!.projectId, statusModalState.context!.category, statusModalState.context!.taskId, statusModalState.context!.testerId, status)} onLinkEco={(ecoId) => handleLinkExistingEco(statusModalState.context!.projectId, statusModalState.context!.category, statusModalState.context!.taskId, statusModalState.context!.testerId, ecoId)} onCreateEco={(v) => handleCreateEcoFromFeedback(statusModalState.context!.projectId, statusModalState.context!.category, statusModalState.context!.taskId, statusModalState.context!.testerId, v)} activeEcos={activeEcosList} versions={productVersions} currentProductVersion={product.currentVersion} />}
      {feedbackModalState.isOpen && <FeedbackModal isOpen={feedbackModalState.isOpen} onClose={() => setFeedbackModalState({ isOpen: false, feedback: null })} onSave={handleSaveFeedback} feedback={feedbackModalState.feedback} product={product} />}
      {feedbackStatusModal.isOpen && feedbackStatusModal.feedback && (
        <FeedbackStatusDecisionModal 
            isOpen={feedbackStatusModal.isOpen} 
            onClose={() => setFeedbackStatusModal({ isOpen: false, feedback: null })} 
            feedback={feedbackStatusModal.feedback} 
            onUpdateStatus={handleUpdateFeedbackStatus} 
            onCreateEco={(v) => handleCreateEcoFromCustomerFeedback(feedbackStatusModal.feedback!.id, v)}
            onLinkEco={(ecoId) => handleLinkEcoToCustomerFeedback(feedbackStatusModal.feedback!.id, ecoId)}
            activeEcos={activeEcosList}
            versions={productVersions}
            currentProductVersion={product.currentVersion}
        />
      )}
    </div>
  );
};

// --- Modal Implementations ---

const EcoModal = ({ isOpen, onClose, onSave, eco, productVersions, product }: any) => {
    const [formData, setFormData] = useState<any>(eco || {
        ecoNumber: '', date: new Date().toISOString().split('T')[0], version: product.currentVersion,
        description: { en: '', zh: '' }, affectedBatches: [], affectedCustomers: [], status: EcoStatus.EVALUATING, imageUrls: []
    });
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSave = (e: React.FormEvent) => { e.preventDefault(); onSave(formData); };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setIsUploading(true);
        try {
            // Fix: Explicitly cast each element to File to avoid TypeScript 'unknown' error when mapping from FileList
            const urls = await Promise.all(Array.from(files).map(f => api.uploadImage(f as File)));
            setFormData({ ...formData, imageUrls: [...(formData.imageUrls || []), ...urls] });
        } catch (err) {
            alert('上傳失敗');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeImage = (index: number) => {
        const newUrls = [...formData.imageUrls];
        newUrls.splice(index, 1);
        setFormData({ ...formData, imageUrls: newUrls });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h2 className="text-xl font-bold">{eco ? 'Edit ECO' : 'Add New ECO'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                </div>
                <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ECO Number</label>
                            <input type="text" value={formData.ecoNumber} onChange={e => setFormData({...formData, ecoNumber: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-intenza-500/10 outline-none"/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Version (Customizable)</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    list="versions-datalist"
                                    value={formData.version} 
                                    onChange={e => setFormData({...formData, version: e.target.value})} 
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-intenza-500/10 outline-none"
                                    placeholder="Enter or select version"
                                />
                                <datalist id="versions-datalist">
                                    {productVersions.map((v: string) => <option key={v} value={v} />)}
                                </datalist>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description (EN)</label>
                        <textarea value={formData.description.en} onChange={e => setFormData({...formData, description: {...formData.description, en: e.target.value}})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-intenza-500/10 outline-none" rows={3}/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                            <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-intenza-500/10 outline-none">
                                {Object.values(EcoStatus).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                            <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-intenza-500/10 outline-none"/>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Reference Media</label>
                        <div className="grid grid-cols-4 gap-3 mb-4">
                            {(formData.imageUrls || []).map((url: string, idx: number) => (
                                <div key={idx} className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden border border-slate-200 group/img">
                                    {isVideo(url) ? (
                                        <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-50"><Video size={24}/></div>
                                    ) : (
                                        <img src={url} className="w-full h-full object-cover" />
                                    )}
                                    <button 
                                        type="button"
                                        onClick={() => removeImage(idx)}
                                        className="absolute top-1 right-1 p-1 bg-white rounded-full shadow-md text-red-500 opacity-0 group-hover/img:opacity-100 transition-opacity"
                                    >
                                        <X size={12}/>
                                    </button>
                                </div>
                            ))}
                            <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="aspect-square border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-all bg-slate-50"
                            >
                                {isUploading ? <Loader2 size={20} className="animate-spin"/> : <Plus size={20}/>}
                                <span className="text-[10px] font-bold uppercase mt-1">Upload</span>
                            </button>
                            <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleUpload} />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-6 sticky bottom-0 bg-white border-t border-slate-100 -mx-6 -mb-6 p-6">
                        <button type="button" onClick={onClose} className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl">Cancel</button>
                        <button type="submit" className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10">Save ECO</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Requirement: Enhanced TestModal with extra fields and custom dropdown
const TestModal = ({ isOpen, onClose, onSave, test, productVersions }: any) => {
    const { language } = useContext(LanguageContext);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showCustomName, setShowCustomName] = useState(false);

    const testNameOptions = [
        { en: 'Durability Test', zh: '耐久測試' },
        { en: 'Salt Spray Test', zh: '鹽霧測試' },
        { en: 'Packaging Test', zh: '包裝測試' },
        { en: 'Other Custom Test', zh: '其他自訂測試' }
    ];

    const [formData, setFormData] = useState<any>(test || {
        category: 'Mechanical', 
        testName: { en: 'Durability Test', zh: '耐久測試' }, 
        version: '', 
        score: 0, 
        status: TestStatus.PENDING, 
        details: { en: '', zh: '' }, 
        attachmentUrls: [],
        updatedDate: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        // Initialize custom name visibility if the current test name isn't in standard options
        if (test) {
            const isStandard = testNameOptions.some(opt => opt.en === test.testName.en);
            if (!isStandard) setShowCustomName(true);
        }
    }, [test]);

    const handleSave = (e: React.FormEvent) => { 
        e.preventDefault(); 
        onSave(formData); 
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setIsUploading(true);
        try {
            const urls = await Promise.all(Array.from(files).map(f => api.uploadImage(f as File)));
            setFormData({ ...formData, attachmentUrls: [...(formData.attachmentUrls || []), ...urls] });
        } catch (err) {
            alert('上傳失敗');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeImage = (index: number) => {
        const newUrls = [...(formData.attachmentUrls || [])];
        newUrls.splice(index, 1);
        setFormData({ ...formData, attachmentUrls: newUrls });
    };

    const handleTestNameChange = (val: string) => {
        if (val === 'Other Custom Test') {
            setShowCustomName(true);
            setFormData({ ...formData, testName: { en: '', zh: '' } });
        } else {
            setShowCustomName(false);
            const selected = testNameOptions.find(opt => opt.en === val);
            if (selected) setFormData({ ...formData, testName: selected });
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                    <h2 className="text-xl font-bold">{test ? 'Edit Test Result' : 'Add New Test'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                </div>
                <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Test Item (測試項目)</label>
                            <select 
                                value={showCustomName ? 'Other Custom Test' : formData.testName.en}
                                onChange={e => handleTestNameChange(e.target.value)}
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-intenza-500/10 outline-none font-medium"
                            >
                                {testNameOptions.map(opt => (
                                    <option key={opt.en} value={opt.en}>{language === 'en' ? opt.en : opt.zh}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tested Version (測試版本)</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    list="durability-versions"
                                    value={formData.version} 
                                    onChange={e => setFormData({...formData, version: e.target.value})} 
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-intenza-500/10 outline-none"
                                    placeholder="e.g. v1.0"
                                />
                                <datalist id="durability-versions">
                                    {productVersions.map((v: string) => <option key={v} value={v} />)}
                                </datalist>
                            </div>
                        </div>
                    </div>

                    {showCustomName && (
                        <div className="animate-fade-in">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Custom Test Name (自訂測試項目)</label>
                            <input 
                                type="text" 
                                value={formData.testName.en} 
                                onChange={e => setFormData({...formData, testName: { en: e.target.value, zh: e.target.value }})} 
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-intenza-500/10 outline-none"
                                placeholder="Enter custom test name..."
                                required
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status (測試狀態)</label>
                            <select 
                                value={formData.status} 
                                onChange={e => setFormData({...formData, status: e.target.value})} 
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-intenza-500/10 outline-none"
                            >
                                {/* Requirement: Remove WARNING status */}
                                {Object.values(TestStatus).map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Completion Progress (進度 %)</label>
                            <div className="flex items-center gap-3">
                                <input type="range" min="0" max="100" value={formData.score} onChange={e => setFormData({...formData, score: Number(e.target.value)})} className="flex-1 accent-intenza-600" />
                                <span className="w-10 text-right font-mono font-bold text-sm">{formData.score}%</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Details / Notes (詳細說明與備註)</label>
                        <textarea 
                            value={formData.details.en} 
                            onChange={e => setFormData({...formData, details: { en: e.target.value, zh: e.target.value }})} 
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-intenza-500/10 outline-none resize-none font-medium" 
                            rows={4}
                            placeholder="Describe test results, cycles, or failure modes..."
                        />
                    </div>

                    <div className="pt-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Test Reports / Media (附件照片)</label>
                        <div className="grid grid-cols-4 gap-3 mb-4">
                            {(formData.attachmentUrls || []).map((url: string, idx: number) => (
                                <div key={idx} className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden border border-slate-200 group/img shadow-sm">
                                    <img src={url} className="w-full h-full object-cover" />
                                    <button 
                                        type="button"
                                        onClick={() => removeImage(idx)}
                                        className="absolute top-1 right-1 p-1 bg-white rounded-full shadow-md text-red-500 opacity-0 group-hover/img:opacity-100 transition-opacity"
                                    >
                                        <X size={12}/>
                                    </button>
                                </div>
                            ))}
                            <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="aspect-square border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-all bg-slate-50 active:scale-95"
                            >
                                {isUploading ? <Loader2 size={20} className="animate-spin"/> : <Plus size={20}/>}
                                <span className="text-[10px] font-bold uppercase mt-1">Add Photo</span>
                            </button>
                            <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleUpload} />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-6 sticky bottom-0 bg-white border-t border-slate-100 -mx-6 -mb-6 p-6">
                        <button type="button" onClick={onClose} className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                        <button type="submit" disabled={isUploading} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2">
                            <Save size={18} />
                            Save Test Record
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const NoShipmentModal = ({ isOpen, onClose, version }: any) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4"><Ship size={32} className="text-amber-500" /></div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No Market Data Found</h3>
            <p className="text-sm text-slate-500 mb-6">Version <span className="font-mono font-bold text-slate-900">{version}</span> currently has no recorded shipments in the dashboard database.</p>
            <button onClick={onClose} className="w-full py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all">Close</button>
        </div>
    </div>
);

const StartEvaluationModal = ({ isOpen, onClose, onStartProject, allTesters, project }: any) => {
    const [name, setName] = useState(project ? project.name.en : '');
    const [selectedTesterIds, setSelectedTesterIds] = useState<string[]>(project ? project.testerIds : []);
    const handleSave = () => onStartProject({ en: name, zh: name }, selectedTesterIds);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center"><h2 className="text-xl font-bold">{project ? 'Edit Project' : 'Start Evaluation'}</h2><button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button></div>
                <div className="p-6 space-y-4">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg"/></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Testers</label>
                        <div className="max-h-40 overflow-y-auto space-y-2 border border-slate-100 p-2 rounded-lg">
                            {allTesters.map((t: Tester) => (
                                <label key={t.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedTesterIds.includes(t.id)} onChange={e => e.target.checked ? setSelectedTesterIds([...selectedTesterIds, t.id]) : setSelectedTesterIds(selectedTesterIds.filter(id => id !== t.id))}/>{t.name}</label>
                            ))}
                        </div>
                    </div>
                    <button onClick={handleSave} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg mt-4">{project ? 'Update Project' : 'Launch Project'}</button>
                </div>
            </div>
        </div>
    );
};

const AddTaskModal = ({ isOpen, onClose, onSave }: any) => {
    const [name, setName] = useState('');
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                <h3 className="text-lg font-bold mb-4">Add Task</h3>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg mb-4" placeholder="e.g. Max Resistance Comfort"/>
                <div className="flex gap-2"><button onClick={onClose} className="flex-1 py-2 text-slate-500">Cancel</button><button onClick={() => onSave(name)} className="flex-1 py-2 bg-slate-900 text-white rounded-lg">Add Task</button></div>
            </div>
        </div>
    );
};

const EditTaskNameModal = ({ isOpen, onClose, currentName, onSave }: any) => {
    const [name, setName] = useState(currentName);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                <h3 className="text-lg font-bold mb-4">Rename Task</h3>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg mb-4"/>
                <div className="flex gap-2"><button onClick={onClose} className="flex-1 py-2 text-slate-500">Cancel</button><button onClick={() => onSave(name)} className="flex-1 py-2 bg-slate-900 text-white rounded-lg">Save</button></div>
            </div>
        </div>
    );
};

const SetTaskResultsModal = ({ isOpen, onClose, onSave, project, testers }: any) => {
    const [passIds, setPassIds] = useState<string[]>([]);
    const projectTesters = testers.filter((t: Tester) => project.testerIds.includes(t.id));
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-lg font-bold mb-4">Set Results</h3>
                <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                    {projectTesters.map((t: Tester) => (
                        <label key={t.id} className="flex items-center justify-between p-2 border border-slate-50 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                            <span className="text-sm font-medium">{t.name}</span>
                            <div className="flex gap-1">
                                <button onClick={() => setPassIds([...passIds.filter(id => id !== t.id), t.id])} className={`px-3 py-1 rounded text-xs font-bold ${passIds.includes(t.id) ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>PASS</button>
                                <button onClick={() => setPassIds(passIds.filter(id => id !== t.id))} className={`px-3 py-1 rounded text-xs font-bold ${!passIds.includes(t.id) ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'}`}>NG</button>
                            </div>
                        </label>
                    ))}
                </div>
                <div className="flex gap-2"><button onClick={onClose} className="flex-1 py-2 text-slate-500">Cancel</button><button onClick={() => onSave(passIds)} className="flex-1 py-2 bg-slate-900 text-white rounded-lg">Confirm</button></div>
            </div>
        </div>
    );
};

const SetPassNgModal = ({ isOpen, onClose, onSet, existingReason }: any) => {
    const [reason, setReason] = useState(existingReason ? existingReason.reason.en : '');
    const [type, setType] = useState<'ISSUE' | 'IDEA'>(existingReason?.decisionStatus === NgDecisionStatus.IDEA ? 'IDEA' : 'ISSUE');
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                <h3 className="text-lg font-bold mb-4">NG Reason</h3>
                <div className="flex gap-2 mb-4">
                    <button onClick={() => setType('ISSUE')} className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${type === 'ISSUE' ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>Report Issue</button>
                    <button onClick={() => setType('IDEA')} className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${type === 'IDEA' ? 'bg-sky-50 border-sky-200 text-sky-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>Log as Idea</button>
                </div>
                <textarea value={reason} onChange={e => setReason(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg mb-4" rows={3} placeholder="Describe the issue or suggestion..."/>
                <div className="flex gap-2"><button onClick={onClose} className="flex-1 py-2 text-slate-500">Cancel</button><button onClick={() => onSet({ en: reason, zh: reason }, false, [], type)} className="flex-1 py-2 bg-slate-900 text-white rounded-lg">Save</button></div>
            </div>
        </div>
    );
};

const StatusDecisionModal = ({ isOpen, onClose, context, onSetStatus, onLinkEco, onCreateEco, activeEcos, versions, currentProductVersion }: any) => {
    const [view, setView] = useState<'MAIN' | 'LINK_ECO' | 'SELECT_VERSION'>('MAIN');
    const [selectedVersion, setSelectedVersion] = useState(currentProductVersion);

    const handleStartNewEco = () => {
        if (versions.length > 1) {
            setView('SELECT_VERSION');
        } else {
            onCreateEco(currentProductVersion);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm animate-slide-up overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-lg font-bold">
                        {view === 'MAIN' ? 'Manage Decision' : view === 'LINK_ECO' ? 'Link to Open ECO' : 'Select Target Version'}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                </div>
                
                {view === 'MAIN' ? (
                    <div className="p-6 space-y-3">
                        <button onClick={handleStartNewEco} className="w-full py-4 px-4 bg-intenza-600 text-white rounded-2xl flex items-center gap-4 hover:bg-intenza-700 transition-all group">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform"><Plus size={20}/></div>
                            <div className="text-left">
                                <div className="font-bold text-sm">Start New ECO</div>
                                <div className="text-[10px] text-white/60">Create design change record</div>
                            </div>
                        </button>
                        
                        <button onClick={() => setView('LINK_ECO')} className="w-full py-4 px-4 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl flex items-center gap-4 hover:bg-slate-100 transition-all group">
                            <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center group-hover:scale-110 transition-transform"><LinkIcon size={20}/></div>
                            <div className="text-left">
                                <div className="font-bold text-sm">Link Existing ECO</div>
                                <div className="text-[10px] text-slate-400">Attach to current open task</div>
                            </div>
                        </button>

                        <div className="grid grid-cols-1 gap-2 mt-4">
                            {[NgDecisionStatus.PENDING, NgDecisionStatus.DISCUSSION, NgDecisionStatus.IGNORED].map(status => (
                                <button key={status} onClick={() => onSetStatus(status)} className={`py-3 text-[10px] font-bold rounded-xl border border-slate-100 transition-all uppercase tracking-widest ${context.currentStatus === status ? 'bg-slate-900 text-white border-slate-800' : 'bg-slate-50 text-slate-500 hover:bg-white'}`}>{status}</button>
                            ))}
                        </div>
                    </div>
                ) : view === 'LINK_ECO' ? (
                    <div className="p-6">
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                            {activeEcos.length > 0 ? activeEcos.map((eco: any) => (
                                <button key={eco.id} onClick={() => onLinkEco(eco.id)} className={`w-full p-4 rounded-xl border transition-all text-left flex items-start gap-3 ${context.linkedEcoId === eco.id ? 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-500/10' : 'border-slate-100 hover:border-intenza-200 hover:bg-intenza-50/50'}`}>
                                    <div className="flex-1">
                                        <div className="text-xs font-bold text-intenza-600 mb-1">{eco.ecoNumber}</div>
                                        <div className="text-[11px] font-medium text-slate-700 line-clamp-2">{eco.description.en}</div>
                                    </div>
                                    {context.linkedEcoId === eco.id && <Check size={16} className="text-emerald-500 mt-1" />}
                                </button>
                            )) : <div className="text-center py-8 text-slate-400 italic text-sm">No open ECOs found</div>}
                        </div>
                        <button onClick={() => setView('MAIN')} className="w-full mt-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600">Go Back</button>
                    </div>
                ) : (
                    <div className="p-6 space-y-4">
                        <div className="space-y-2">
                            {versions.map((v: string) => (
                                <button key={v} onClick={() => setSelectedVersion(v)} className={`w-full py-3 px-4 rounded-xl border text-sm font-bold transition-all text-left flex items-center justify-between ${selectedVersion === v ? 'bg-slate-900 text-white border-slate-800' : 'bg-slate-50 border-slate-100 hover:bg-white'}`}>
                                    {v} {v === currentProductVersion && <span className="text-[10px] font-normal opacity-60">(Current)</span>}
                                    {selectedVersion === v && <Check size={16} />}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => onCreateEco(selectedVersion)} className="w-full py-3 bg-intenza-600 text-white font-bold rounded-xl shadow-lg hover:bg-intenza-700 transition-colors mt-2">Proceed</button>
                        <button onClick={() => setView('MAIN')} className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 text-center">Cancel</button>
                    </div>
                )}
            </div>
        </div>
    );
};

const FeedbackModal = ({ isOpen, onClose, onSave, feedback, product }: any) => {
    const [formData, setFormData] = useState<any>(feedback || { date: new Date().toISOString().split('T')[0], category: 'Experience', content: { en: '', zh: '' }, source: '' });
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-lg font-bold mb-4">{feedback ? 'Edit Feedback' : 'Add Feedback'}</h3>
                <div className="space-y-4">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Source (Customer)</label><input type="text" value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg"/></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                        <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                            <option value="Resistance profile">Resistance profile</option>
                            <option value="Experience">Experience</option>
                            <option value="Stroke">Stroke</option>
                            <option value="Other Suggestion">Other Suggestion</option>
                        </select>
                    </div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Content</label><textarea value={formData.content.en} onChange={e => setFormData({...formData, content: { en: e.target.value, zh: e.target.value }})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg" rows={3}/></div>
                </div>
                <div className="flex gap-2 mt-6"><button onClick={onClose} className="flex-1 py-2 text-slate-500">Cancel</button><button onClick={() => onSave(formData, false)} className="flex-1 py-2 bg-slate-900 text-white rounded-lg">Save</button></div>
            </div>
        </div>
    );
};

const FeedbackStatusDecisionModal = ({ isOpen, onClose, feedback, onUpdateStatus, onCreateEco, onLinkEco, activeEcos, versions, currentProductVersion }: any) => {
    const [view, setView] = useState<'MAIN' | 'LINK_ECO' | 'SELECT_VERSION'>('MAIN');
    const [selectedVersion, setSelectedVersion] = useState(currentProductVersion);

    const handleStartNewEco = () => {
        if (versions.length > 1) {
            setView('SELECT_VERSION');
        } else {
            onCreateEco(currentProductVersion);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm animate-slide-up overflow-hidden text-center">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-lg font-bold">
                        {view === 'MAIN' ? 'Feedback Status' : view === 'LINK_ECO' ? 'Link to Open ECO' : 'Select Target Version'}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                </div>
                
                {view === 'MAIN' ? (
                    <div className="p-6 space-y-3">
                        <button onClick={handleStartNewEco} className="w-full py-4 px-4 bg-intenza-600 text-white rounded-2xl flex items-center gap-4 hover:bg-intenza-700 transition-all group text-left">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform"><Plus size={20}/></div>
                            <div>
                                <div className="font-bold text-sm">Start New ECO</div>
                                <div className="text-[10px] text-white/60">Address this complaint via ECO</div>
                            </div>
                        </button>
                        
                        <button onClick={() => setView('LINK_ECO')} className="w-full py-4 px-4 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl flex items-center gap-4 hover:bg-slate-100 transition-all group text-left">
                            <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center group-hover:scale-110 transition-transform"><LinkIcon size={20}/></div>
                            <div>
                                <div className="font-bold text-sm">Link Existing ECO</div>
                                <div className="text-[10px] text-slate-400">Attach to existing design change</div>
                            </div>
                        </button>

                        <div className="grid grid-cols-1 gap-2 mt-4 border-t border-slate-50 pt-4">
                            {['PENDING', 'DISCUSSION', 'IGNORED'].map((status: any) => (
                                <button 
                                    key={status} 
                                    onClick={() => onUpdateStatus(feedback.id, status)} 
                                    className={`py-3 rounded-xl border text-xs font-bold transition-all uppercase tracking-widest ${feedback.status === status ? 'bg-slate-900 text-white border-slate-800 shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-white hover:border-slate-200'}`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : view === 'LINK_ECO' ? (
                    <div className="p-6">
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                            {activeEcos.length > 0 ? activeEcos.map((eco: any) => (
                                <button key={eco.id} onClick={() => onLinkEco(eco.id)} className={`w-full p-4 rounded-xl border transition-all text-left flex items-start gap-3 ${feedback.linkedEcoId === eco.id ? 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-500/10' : 'border-slate-100 hover:border-intenza-200 hover:bg-intenza-50/50'}`}>
                                    <div className="flex-1">
                                        <div className="text-xs font-bold text-intenza-600 mb-1">{eco.ecoNumber}</div>
                                        <div className="text-[11px] font-medium text-slate-700 line-clamp-2">{eco.description.en}</div>
                                    </div>
                                    {feedback.linkedEcoId === eco.id && <Check size={16} className="text-emerald-500 mt-1" />}
                                </button>
                            )) : <div className="text-center py-8 text-slate-400 italic text-sm">No open ECOs found</div>}
                        </div>
                        <button onClick={() => setView('MAIN')} className="w-full mt-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 text-center">Go Back</button>
                    </div>
                ) : (
                    <div className="p-6 space-y-4">
                        <div className="space-y-2">
                            {versions.map((v: string) => (
                                <button key={v} onClick={() => setSelectedVersion(v)} className={`w-full py-3 px-4 rounded-xl border text-sm font-bold transition-all text-left flex items-center justify-between ${selectedVersion === v ? 'bg-slate-900 text-white border-slate-800' : 'bg-slate-50 border-slate-100 hover:bg-white'}`}>
                                    {v} {v === currentProductVersion && <span className="text-[10px] font-normal opacity-60">(Current)</span>}
                                    {selectedVersion === v && <Check size={16} />}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => onCreateEco(selectedVersion)} className="w-full py-3 bg-intenza-600 text-white font-bold rounded-xl shadow-lg hover:bg-intenza-700 transition-colors mt-2">Proceed</button>
                        <button onClick={() => setView('MAIN')} className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 text-center">Cancel</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductDetail;