
import React, { useState, useMemo, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, GitCommit, UserCheck, Activity, AlertTriangle, CheckCircle, Clock, Calendar, Layers, Users, Plus, X, Pencil, Trash2, Upload, MessageSquare, ChevronsRight, ChevronsLeft, Tag, FileText, User, Database, Mars, Venus, Link as LinkIcon, Search, ClipboardList, ListPlus, Check, ChevronDown, RefreshCw, HelpCircle, BarChart3, AlertCircle, PlayCircle, Loader2, StickyNote, Lightbulb, Paperclip, Video, Image as ImageIcon, Save } from 'lucide-react';
import { ProductModel, TestStatus, DesignChange, LocalizedString, TestResult, EcoStatus, ErgoFeedback, ErgoProject, Tester, ErgoProjectCategory, NgReason, ProjectOverallStatus, Gender, NgDecisionStatus, EvaluationTask } from '../types';
import GeminiInsight from '../components/GeminiInsight';
import { LanguageContext } from '../App';
import { api } from '../services/api';

// Helper to determine if a URL is a video
const isVideo = (url: string) => {
    if (!url) return false;
    return url.startsWith('data:video') || url.match(/\.(mp4|webm|ogg)$/i);
};

// Main Product Detail Page Component
const ProductDetail: React.FC<ProductDetailProps> = ({ products, testers = [], onUpdateProduct, showAiInsights }) => {
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

  const ergoSectionRef = useRef<HTMLDivElement>(null);
  const [highlightedFeedback, setHighlightedFeedback] = useState<{projectId: string, taskId: string, testerId: string} | null>(null);

  const pendingNgCount = useMemo(() => {
    if (!product) return 0;
    let count = 0;
    product.ergoProjects.forEach(p => {
        (['Strength Curve', 'Experience', 'Stroke', 'Other Suggestion'] as ErgoProjectCategory[]).forEach(cat => {
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
        setHighlightedFeedback(location.state.highlightFeedback);
        navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  useEffect(() => {
    if (highlightedFeedback && ergoSectionRef.current) {
        const element = ergoSectionRef.current.querySelector(`[data-feedback-id="${highlightedFeedback.projectId}-${highlightedFeedback.taskId}-${highlightedFeedback.testerId}"]`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => setHighlightedFeedback(null), 3500);
        }
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
      if (editingEco) {
          updatedDesignHistory = product.designHistory.map(eco => 
              eco.id === editingEco.id ? { ...eco, ...ecoData } : eco
          );
      } else {
          const newEco = { ...ecoData, id: `eco-${Date.now()}` };
          updatedDesignHistory = [...product.designHistory, newEco];
      }
      await onUpdateProduct({ ...product, designHistory: updatedDesignHistory });
      handleCloseEcoModal();
  };

  const handleDeleteEco = (ecoId: string) => {
    const updatedDesignHistory = product.designHistory.filter(eco => eco.id !== ecoId);
    onUpdateProduct({ ...product, designHistory: updatedDesignHistory });
  };
  
  const handleDeleteVersion = (versionToDelete: string) => {
    const updatedDesignHistory = product.designHistory.filter(eco => eco.version !== versionToDelete);
    onUpdateProduct({ ...product, designHistory: updatedDesignHistory });
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

  const handleSaveTest = async (testData: Omit<TestResult, 'id'>) => {
      let updatedTests;
      if (editingTest) {
          updatedTests = product.durabilityTests.map(t => t.id === editingTest.id ? { ...editingTest, ...testData } : t);
      } else {
          const newTest = { ...testData, id: `test-${Date.now()}` };
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
                <span className="text-xs font-bold tracking-wider text-intenza-600 uppercase mb-1 block">{t(product.series)}</span>
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
             {activeTab === 'DESIGN' && <DesignSection product={product} onAddEco={() => handleOpenEcoModal()} onEditEco={handleOpenEcoModal} onDeleteEco={handleDeleteEco} onDeleteVersion={handleDeleteVersion} />}
             {activeTab === 'ERGO' && <div ref={ergoSectionRef}><ErgoSection product={product} testers={testers} onUpdateProduct={onUpdateProduct} highlightedFeedback={highlightedFeedback} /></div>}
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
                      <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-900/20 group-hover:scale-105 transition-transform"><Database size={24} /></div>
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
      {isTestModalOpen && <TestModal isOpen={isTestModalOpen} onClose={handleCloseTestModal} onSave={handleSaveTest} test={editingTest} />}
    </div>
  );
};

export default ProductDetail;

// --- Sub-components & Modals ---

interface ProductDetailProps {
  products: ProductModel[];
  testers?: Tester[];
  onUpdateProduct: (product: ProductModel) => Promise<void>;
  showAiInsights: boolean;
}

const TabButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
    {icon}{label}
  </button>
);

const ecoStatusStyles: { [key in EcoStatus]: string } = {
    [EcoStatus.EVALUATING]: 'bg-blue-100 text-blue-800 border-blue-200',
    [EcoStatus.DESIGNING]: 'bg-amber-100 text-amber-800 border-amber-200',
    [EcoStatus.DESIGN_COMPLETE]: 'bg-green-100 text-green-800 border-green-200',
    [EcoStatus.IN_PRODUCTION]: 'bg-slate-200 text-slate-800 border-slate-300',
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
    [NgDecisionStatus.PENDING]: '待審查',
    [NgDecisionStatus.NEEDS_IMPROVEMENT]: '需改進',
    [NgDecisionStatus.DISCUSSION]: '討論中',
    [NgDecisionStatus.IGNORED]: '已忽略',
    [NgDecisionStatus.IDEA]: '點子'
};

const categoryStyles: Record<ErgoProjectCategory, { bg: string, border: string, text: string }> = {
  'Strength Curve': { bg: 'bg-[#eef2ff]', border: 'border-indigo-100', text: 'text-indigo-900' },
  'Experience': { bg: 'bg-[#f0fdfa]', border: 'border-teal-100', text: 'text-teal-900' },
  'Stroke': { bg: 'bg-[#fff7ed]', border: 'border-orange-100', text: 'text-orange-900' },
  'Other Suggestion': { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700' }
};

// Design Section
const DesignSection = ({ product, onAddEco, onEditEco, onDeleteEco, onDeleteVersion }: { product: ProductModel, onAddEco: () => void, onEditEco: (eco: DesignChange) => void, onDeleteEco: (id: string) => void, onDeleteVersion: (version: string) => void }) => {
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

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold text-slate-900">Design Version History</h2><button onClick={onAddEco} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors"><Plus size={16} /> Add ECO</button></div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        <div className="flex items-center gap-8 px-6 border-b border-slate-100 overflow-x-auto bg-slate-50/50">
          {versions.map((version) => (
            <div key={version} className="relative group flex items-center">
              <button onClick={() => setSelectedVersion(version)} className={`py-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap px-2 ${selectedVersion === version ? 'border-intenza-600 text-intenza-600' : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'}`}>{version}</button>
              {version !== product.currentVersion && (<button onClick={(e) => { e.stopPropagation(); onDeleteVersion(version); }} title={`Delete Version ${version}`} className="absolute -right-2 top-1/2 -translate-y-1/2 ml-2 p-1 rounded-full text-slate-300 hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><X size={14} /></button>)}
            </div>
          ))}
        </div>
        <div className="p-8 bg-white">
          <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-3 mb-6">{selectedVersion}<span className={`text-xs font-normal text-white px-2 py-1 rounded-md uppercase tracking-wider ${selectedVersion === product.currentVersion ? 'bg-slate-900' : 'bg-slate-400'}`}>{selectedVersion === product.currentVersion ? 'Current' : 'Archived'}</span></h3>
          {activeChanges.length === 0 ? (<div className="flex flex-col items-center justify-center py-12 text-center"><div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300"><GitCommit size={32} /></div><h4 className="text-slate-900 font-medium">No Change Records</h4><p className="text-slate-500 text-sm mt-1 max-w-sm">No Engineering Change Orders (ECO) recorded for this version.</p></div>) : (<div className="space-y-6">{activeChanges.map((change) => (<div key={change.id} className="group relative rounded-lg transition-colors hover:bg-slate-50/50 -m-3 p-3"><div className="flex flex-col md:flex-row gap-6"><div className="md:w-48 flex-shrink-0"><div className="flex items-center gap-3 mb-2"><span className="font-mono text-sm font-bold text-intenza-600 bg-intenza-50 px-2 py-1 rounded border border-intenza-100">{change.ecoNumber}</span></div><div className="flex items-center gap-2 text-slate-500 text-sm mt-2"><Calendar size={14} />{change.date}</div></div><div className="flex-1"><div className="flex items-start justify-between"><h4 className="text-lg font-medium text-slate-900 mb-3 leading-snug pr-4">{t(change.description)}</h4><div className="flex flex-col items-end gap-1"><span className={`px-2 py-0.5 text-xs font-semibold rounded-full border whitespace-nowrap ${ecoStatusStyles[change.status]}`}>{language === 'en' ? change.status : ecoStatusTranslations[change.status]}</span>{change.status === EcoStatus.IN_PRODUCTION && change.implementationDate && (<span className="text-xs text-slate-500 font-mono">{change.implementationDate}</span>)}</div></div>{change.imageUrls && change.imageUrls.length > 0 && (<div className="mb-4 flex flex-wrap gap-2">{change.imageUrls.map((url, imgIndex) => (
             <div key={imgIndex} className="inline-block group/image relative">
                {isVideo(url) ? (
                    <video src={url} controls className="h-32 w-auto rounded-lg border border-slate-200 shadow-sm" />
                ) : (
                    <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="" className="h-32 w-auto rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x200?text=Error'; }} /></a>
                )}
             </div>
          ))}</div>)}<div className="bg-slate-50 rounded-xl p-4 border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 transition-colors group-hover:border-slate-200"><div><div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2"><Layers size={14} /> Affected Batches</div><div className="flex flex-wrap gap-2">{change.affectedBatches.map((b) => (<span key={b} className="text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded-md text-slate-700 font-mono shadow-sm">{b}</span>))}</div></div><div><div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2"><Users size={14} /> Impacted Customers</div><p className="text-sm text-slate-600 leading-relaxed">{change.affectedCustomers.join(', ')}</p></div></div>{change.sourceFeedback && (<button onClick={() => handleLinkBack(change.sourceFeedback)} className="mt-2 text-xs text-blue-600 font-semibold flex items-center gap-1 hover:underline"><LinkIcon size={12}/> View Source Feedback</button>)}
          {change.sourceFeedbacks && change.sourceFeedbacks.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                  {change.sourceFeedbacks.map((fb, idx) => (
                      <button key={idx} onClick={() => handleLinkBack(fb)} className="text-xs text-blue-600 font-semibold flex items-center gap-1 hover:underline w-fit">
                          <LinkIcon size={12}/> View Feedback Source #{idx + 1}
                      </button>
                  ))}
              </div>
          )}
          </div></div><div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => onEditEco(change)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800"><Pencil size={14} /></button><button onClick={() => onDeleteEco(change.id)} className="p-2 bg-red-50 rounded-full text-red-500 hover:bg-red-100 hover:text-red-700"><Trash2 size={14} /></button></div></div>))}</div>)}
        </div>
      </div>
    </div>
  );
};

// Ergonomics Section
const ErgoSection = ({ product, testers, onUpdateProduct, highlightedFeedback }: { product: ProductModel, testers: Tester[], onUpdateProduct: (p: ProductModel) => void, highlightedFeedback: any }) => {
  const { t, language } = useContext(LanguageContext);
  const navigate = useNavigate();
  const [isFeedbackPanelOpen, setIsFeedbackPanelOpen] = useState(false);
  
  const [isStartEvaluationModalOpen, setStartEvaluationModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ErgoProject | null>(null);

  const [addTaskModalState, setAddTaskModalState] = useState<{ isOpen: boolean, context: { projectId: string, category: ErgoProjectCategory } | null }>({ isOpen: false, context: null });
  const [editTaskModalState, setEditTaskModalState] = useState<{ isOpen: boolean, context: { projectId: string, category: ErgoProjectCategory, taskId: string, currentName: string } | null }>({ isOpen: false, context: null });

  const [taskResultModalState, setTaskResultModalState] = useState<{ isOpen: boolean; context: { projectId: string, category: ErgoProjectCategory, taskId: string } | null }>({ isOpen: false, context: null });
  const [feedbackModalState, setFeedbackModalState] = useState<{ isOpen: boolean, feedback: ErgoFeedback | null }>({ isOpen: false, feedback: null });
  const [ngReasonModalState, setNgReasonModalState] = useState<{ isOpen: boolean, context: { projectId: string, category: ErgoProjectCategory, taskId: string, testerId: string } | null }>({ isOpen: false, context: null });
  const [statusModalState, setStatusModalState] = useState<{ isOpen: boolean, context: { projectId: string, category: ErgoProjectCategory, taskId: string, testerId: string, currentStatus: NgDecisionStatus, linkedEcoId?: string } | null }>({ isOpen: false, context: null });
  
  const [feedbackStatusModal, setFeedbackStatusModal] = useState<{ isOpen: boolean, feedback: ErgoFeedback | null }>({ isOpen: false, feedback: null });

  const handleStartProject = (name: LocalizedString, selectedTesterIds: string[]) => {
    const newProject: ErgoProject = {
      id: `proj-${Date.now()}`,
      name: name,
      date: new Date().toISOString().split('T')[0],
      testerIds: selectedTesterIds,
      overallStatus: ProjectOverallStatus.PENDING,
      tasks: { 'Strength Curve': [], 'Experience': [], 'Stroke': [], 'Other Suggestion': [] },
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

  const handleCreateEcoFromFeedback = (projectId: string, category: ErgoProjectCategory, taskId: string, testerId: string) => {
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
          version: product.currentVersion,
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

  const handleLinkExistingEco = (projectId: string, category: ErgoProjectCategory, taskId: string, testerId: string, ecoId: string) => {
      const updatedDesignHistory = product.designHistory.map(eco => {
          if (eco.id === ecoId) {
              const currentSources = eco.sourceFeedbacks || [];
              const newSource = { projectId, category, taskId, testerId };
              const exists = currentSources.some(s => s.projectId === projectId && s.taskId === taskId && s.testerId === testerId);
              if (!exists) return { ...eco, sourceFeedbacks: [...currentSources, newSource] };
          }
          return eco;
      });
      const updatedProjects = product.ergoProjects.map(p => {
          if (p.id === projectId) {
              const updatedTasks = p.tasks[category].map(t => {
                  if (t.id === taskId) {
                      const updatedNgReasons = t.ngReasons.map(ng => ng.testerId === testerId ? { ...ng, linkedEcoId: ecoId, decisionStatus: NgDecisionStatus.NEEDS_IMPROVEMENT } : ng);
                      return { ...t, ngReasons: updatedNgReasons };
                  }
                  return t;
              });
              return { ...p, tasks: { ...p.tasks, [category]: updatedTasks } };
          }
          return p;
      });
      onUpdateProduct({ ...product, designHistory: updatedDesignHistory, ergoProjects: updatedProjects });
      setStatusModalState({ isOpen: false, context: null });
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

  const categoryTranslations: Record<ErgoProjectCategory, string> = { 'Strength Curve': 'Strength Curve', 'Experience': 'Ergonomic Operation Experience', 'Stroke': 'Exercise Stroke', 'Other Suggestion': 'Other Suggestions' };
  const activeEcosList = product.designHistory.filter(e => e.status !== EcoStatus.IN_PRODUCTION && e.status !== EcoStatus.DESIGN_COMPLETE);

  return (
    <div className="relative animate-fade-in">
      <div className={`transition-all duration-500 ease-in-out ${isFeedbackPanelOpen ? 'pr-[40%]' : 'pr-14'}`}>
        <div className="flex items-center justify-between mb-6">
          {product.ergoProjects.length === 0 && <h2 className="text-2xl font-bold text-intenza-600">Human Factors Evaluation Projects</h2>}
          <div className={product.ergoProjects.length > 0 ? "w-full flex justify-end" : ""}>
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
                    {(['Strength Curve', 'Experience', 'Stroke', 'Other Suggestion'] as ErgoProjectCategory[]).map(cat => (
                        <div key={cat}>
                             <h4 className="font-semibold text-xs text-slate-400 mb-3 uppercase tracking-wider pl-1 border-l-2 border-slate-300">{language === 'en' ? cat : categoryTranslations[cat]}</h4>
                             <div className="space-y-3">
                                {(product.customerFeedback || []).filter(f => f.category === cat).map(fb => (
                                    <CustomerFeedbackCard 
                                        key={fb.id}
                                        feedback={fb}
                                        category={cat}
                                        onStatusClick={() => setFeedbackStatusModal({ isOpen: true, feedback: fb })}
                                        onEdit={() => setFeedbackModalState({ isOpen: true, feedback: fb })}
                                        onDelete={() => handleDeleteFeedback(fb.id)}
                                    />
                                ))}
                             </div>
                        </div>
                    ))}
                    {(product.customerFeedback || []).length === 0 && <div className="text-center py-12 text-slate-400">No customer feedback.</div>}
                </div>
            </div>
          )}
        </div>
      </div>
      
      {isStartEvaluationModalOpen && <StartEvaluationModal isOpen={isStartEvaluationModalOpen} onClose={() => { setStartEvaluationModalOpen(false); setEditingProject(null); }} onStartProject={editingProject ? handleEditProject : handleStartProject} allTesters={testers} project={editingProject} />}

      {addTaskModalState.isOpen && addTaskModalState.context && 
          <AddTaskModal 
              isOpen={addTaskModalState.isOpen}
              onClose={() => setAddTaskModalState({ isOpen: false, context: null })}
              onSave={handleSaveTask}
          />
      }

      {editTaskModalState.isOpen && editTaskModalState.context &&
          <EditTaskNameModal
            isOpen={editTaskModalState.isOpen}
            onClose={() => setEditTaskModalState({ isOpen: false, context: null })}
            currentName={editTaskModalState.context.currentName}
            onSave={(newName) => handleUpdateTaskName(editTaskModalState.context!.projectId, editTaskModalState.context!.category, editTaskModalState.context!.taskId, newName)}
          />
      }

      {taskResultModalState.isOpen && taskResultModalState.context && 
        <SetTaskResultsModal 
            isOpen={taskResultModalState.isOpen} 
            onClose={() => setTaskResultModalState({ isOpen: false, context: null })}
            onSave={(passIds) => handleUpdateTaskResults(taskResultModalState.context!.projectId, taskResultModalState.context!.category, taskResultModalState.context!.taskId, passIds)}
            context={taskResultModalState.context}
            project={product.ergoProjects.find(p => p.id === taskResultModalState.context!.projectId)!}
            testers={testers}
        />
      }
      
      {ngReasonModalState.isOpen && ngReasonModalState.context &&
        <SetPassNgModal 
            isOpen={ngReasonModalState.isOpen}
            onClose={() => setNgReasonModalState({ isOpen: false, context: null })}
            onSet={handleSetNgReason}
            context={ngReasonModalState.context}
            project={product.ergoProjects.find(p => p.id === ngReasonModalState.context!.projectId)!}
            existingReason={product.ergoProjects.find(p => p.id === ngReasonModalState.context!.projectId)?.tasks[ngReasonModalState.context!.category].find(t => t.id === ngReasonModalState.context!.taskId)?.ngReasons.find(ng => ng.testerId === ngReasonModalState.context!.testerId)}
        />
      }

      {statusModalState.isOpen && statusModalState.context &&
          <StatusDecisionModal 
             isOpen={statusModalState.isOpen}
             onClose={() => setStatusModalState({ isOpen: false, context: null })}
             context={statusModalState.context}
             onSetStatus={(status) => handleSetNgDecision(statusModalState.context!.projectId, statusModalState.context!.category, statusModalState.context!.taskId, statusModalState.context!.testerId, status)}
             onLinkEco={(ecoId) => handleLinkExistingEco(statusModalState.context!.projectId, statusModalState.context!.category, statusModalState.context!.taskId, statusModalState.context!.testerId, ecoId)}
             onCreateEco={() => handleCreateEcoFromFeedback(statusModalState.context!.projectId, statusModalState.context!.category, statusModalState.context!.taskId, statusModalState.context!.testerId)}
             activeEcos={activeEcosList}
          />
      }

      {feedbackModalState.isOpen && <FeedbackModal isOpen={feedbackModalState.isOpen} onClose={() => setFeedbackModalState({ isOpen: false, feedback: null })} onSave={handleSaveFeedback} feedback={feedbackModalState.feedback} product={product} />}

      {feedbackStatusModal.isOpen && feedbackStatusModal.feedback && (
          <FeedbackStatusDecisionModal 
              isOpen={feedbackStatusModal.isOpen}
              onClose={() => setFeedbackStatusModal({ isOpen: false, feedback: null })}
              feedback={feedbackStatusModal.feedback}
              onUpdateStatus={handleUpdateFeedbackStatus}
          />
      )}

    </div>
  );
};

// Durability Section Component
const LifeSection = ({ product, onAddTest, onEditTest, onDeleteTest }: { product: ProductModel, onAddTest: () => void, onEditTest: (t: TestResult) => void, onDeleteTest: (id: string) => void }) => {
  const { t } = useContext(LanguageContext);
  const STATUS_TEXT_COLORS: Record<TestStatus, string> = {
    [TestStatus.PASS]: 'text-emerald-600 border-emerald-200 bg-emerald-50',
    [TestStatus.FAIL]: 'text-red-600 border-red-200 bg-red-50',
    [TestStatus.WARNING]: 'text-amber-600 border-amber-200 bg-amber-50',
    [TestStatus.ONGOING]: 'text-blue-600 border-blue-200 bg-blue-50',
    [TestStatus.PENDING]: 'text-slate-500 border-slate-200 bg-slate-50',
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">Durability & Reliability Tests</h2>
        <button onClick={onAddTest} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-sm">
          <Plus size={16} /> Add Test Result
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {product.durabilityTests.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400 bg-white border border-dashed border-slate-200 rounded-2xl">No durability tests recorded.</div>
        ) : (
          product.durabilityTests.map(test => (
            <div key={test.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative group hover:border-intenza-200 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{test.category}</span>
                  <h4 className="font-bold text-slate-900 mt-1">{t(test.testName)}</h4>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${STATUS_TEXT_COLORS[test.status]}`}>{test.status}</span>
              </div>
              <p className="text-sm text-slate-500 mb-4 line-clamp-2 leading-relaxed">{t(test.details)}</p>
              <div className="flex items-center justify-between pt-4 border-t border-slate-50 mt-auto">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-slate-400"/>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700">{test.score}% Completion</span>
                    <div className="w-24 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                       <div className="h-full bg-intenza-500" style={{ width: `${test.score}%` }}></div>
                    </div>
                  </div>
                </div>
                {test.updatedDate && <span className="text-[10px] text-slate-400 italic">Updated: {test.updatedDate}</span>}
              </div>
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEditTest(test)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800"><Pencil size={14}/></button>
                <button onClick={() => onDeleteTest(test.id)} className="p-2 bg-red-50 rounded-full text-red-500 hover:bg-red-100 hover:text-red-700"><Trash2 size={14}/></button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Start Evaluation Project Modal
const StartEvaluationModal = ({ isOpen, onClose, onStartProject, allTesters, project }: any) => {
  const { language } = useContext(LanguageContext);
  const [name, setName] = useState<LocalizedString>(project?.name || { en: '', zh: '' });
  const [selectedTesterIds, setSelectedTesterIds] = useState<string[]>(project?.testerIds || []);

  const toggleTester = (id: string) => {
    setSelectedTesterIds(prev => prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xl font-bold">{project ? 'Edit Project' : 'New Evaluation Project'}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400"><X size={20}/></button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Project Name</label>
            <input 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20"
              value={name[language]}
              onChange={(e) => setName({ ...name, [language]: e.target.value })}
              placeholder="e.g. Prototype v2 Verification"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Select Testers ({selectedTesterIds.length})</label>
            <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {allTesters.map((tester: Tester) => (
                <button 
                  key={tester.id}
                  onClick={() => toggleTester(tester.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${selectedTesterIds.includes(tester.id) ? 'bg-intenza-50 border-intenza-200 ring-1 ring-intenza-200' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200">
                    <img src={tester.imageUrl} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">{tester.name}</div>
                    <div className="text-[10px] text-slate-500">{tester.height}cm / {tester.experienceYears}y</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-6 bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg">Cancel</button>
          <button 
            disabled={!name[language] || selectedTesterIds.length === 0}
            onClick={() => onStartProject(name, selectedTesterIds)} 
            className="px-5 py-2 bg-slate-900 text-white font-bold rounded-lg disabled:opacity-50"
          >
            {project ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Add Task Modal
const AddTaskModal = ({ isOpen, onClose, onSave }: any) => {
  const [name, setName] = useState('');
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-slide-up">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">Add New Task</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>
        <input autoFocus className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg mb-4 outline-none focus:ring-2 focus:ring-intenza-500/20" placeholder="Task name (e.g. Reachability)..." value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSave(name)} />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Cancel</button>
          <button onClick={() => onSave(name)} disabled={!name} className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg disabled:opacity-50">Add Task</button>
        </div>
      </div>
    </div>
  );
};

// Edit Task Name Modal
const EditTaskNameModal = ({ isOpen, onClose, currentName, onSave }: any) => {
  const [name, setName] = useState(currentName);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-slide-up">
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">Edit Task Name</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button></div>
        <input autoFocus className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg mb-4 outline-none focus:ring-2 focus:ring-intenza-500/20" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSave(name)} />
        <div className="flex gap-2 justify-end"><button onClick={onClose} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Cancel</button><button onClick={() => onSave(name)} className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg">Save</button></div>
      </div>
    </div>
  );
};

// Set Task Results Modal
const SetTaskResultsModal = ({ isOpen, onClose, onSave, project, testers }: any) => {
  const [passTesterIds, setPassTesterIds] = useState<string[]>([]);
  useEffect(() => { if (isOpen) setPassTesterIds([]); }, [isOpen]);
  if (!isOpen) return null;
  const projectTesters = testers.filter((t: any) => project.testerIds.includes(t.id));
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-slide-up">
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">Task Evaluation</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button></div>
        <p className="text-sm text-slate-500 mb-4">Select testers who <span className="text-emerald-600 font-bold uppercase tracking-wider">PASSED</span> this task.</p>
        <div className="grid grid-cols-2 gap-3 mb-6">
           {projectTesters.map((t: any) => (
               <button key={t.id} onClick={() => setPassTesterIds(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${passTesterIds.includes(t.id) ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                   <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200"><img src={t.imageUrl} className="w-full h-full object-cover" /></div>
                   <span className="text-xs font-bold">{t.name}</span>
               </button>
           ))}
        </div>
        <div className="flex gap-2 justify-end"><button onClick={onClose} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Cancel</button><button onClick={() => onSave(passTesterIds)} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg shadow-lg">Submit Results</button></div>
      </div>
    </div>
  );
};

// Project Card Component
const ProjectCard = ({ project, testers, product, onOpenAddTask, onEditTaskName, onDeleteTask, onOpenTaskResults, onDeleteProject, onEditProject, categoryTranslations, onStatusClick, onEditNgReason, highlightedFeedback }: any) => {
  const { t, language } = useContext(LanguageContext);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div>
          <h3 className="font-bold text-slate-900 flex items-center gap-3">{t(project.name)}<span className="text-xs font-normal text-slate-400 font-mono bg-white px-2 py-0.5 rounded border border-slate-100">{project.date}</span></h3>
          <div className="flex -space-x-2 mt-2">
            {project.testerIds.map((tid: any) => {
              const tester = testers.find((t: any) => t.id === tid);
              return tester ? (<div key={tid} className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-slate-200" title={tester.name}><img src={tester.imageUrl} className="w-full h-full object-cover" /></div>) : null;
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={onEditProject} className="p-2 text-slate-400 hover:text-slate-800 transition-colors"><Pencil size={18} /></button>
           <button onClick={() => window.confirm('Delete this project?') && onDeleteProject()} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
        </div>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         {(['Strength Curve', 'Experience', 'Stroke', 'Other Suggestion'] as ErgoProjectCategory[]).map(cat => (
             <div key={cat} className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-4"><h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{language === 'en' ? cat : categoryTranslations[cat]}</h4><button onClick={() => onOpenAddTask(project.id, cat)} className="text-slate-400 hover:text-slate-900"><Plus size={16}/></button></div>
                <div className="space-y-3 flex-1">
                   {project.tasks[cat]?.map((task: any) => (
                      <div key={task.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                         <div className="flex justify-between items-start mb-3">
                            <span className="text-sm font-bold text-slate-700">{t(task.name)}</span>
                            <div className="flex items-center gap-1">
                               <button onClick={() => onEditTaskName(project.id, cat, task.id, t(task.name))} className="p-1 text-slate-400 hover:text-slate-700"><Pencil size={12}/></button>
                               <button onClick={() => onDeleteTask(project.id, cat, task.id)} className="p-1 text-slate-400 hover:text-red-500"><X size={12}/></button>
                            </div>
                         </div>
                         {task.ngReasons.length > 0 ? (
                            <div className="space-y-2">
                               {task.ngReasons.map((ng: any) => {
                                  const tester = testers.find((ts: any) => ts.id === ng.testerId);
                                  const isHighlighted = highlightedFeedback?.projectId === project.id && highlightedFeedback?.taskId === task.id && highlightedFeedback?.testerId === ng.testerId;
                                  return (
                                     <div key={ng.testerId} data-feedback-id={`${project.id}-${task.id}-${ng.testerId}`} className={`flex flex-col gap-2 p-2 rounded-lg border transition-all ${isHighlighted ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200 scale-105 shadow-md' : 'bg-white border-slate-100 shadow-sm'}`}>
                                        <div className="flex items-center gap-2">
                                           <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-200"><img src={tester?.imageUrl} className="w-full h-full object-cover" /></div>
                                           <span className="text-[10px] font-bold text-slate-800">{tester?.name}</span>
                                           <button onClick={() => onStatusClick(project.id, cat, task.id, ng.testerId, ng.decisionStatus || NgDecisionStatus.PENDING, ng.linkedEcoId)} className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-md border uppercase tracking-wider transition-colors ${ngDecisionStyles[ng.decisionStatus as NgDecisionStatus || NgDecisionStatus.PENDING]}`}>{language === 'en' ? (ng.decisionStatus || 'PENDING') : ngDecisionTranslations[ng.decisionStatus as NgDecisionStatus || NgDecisionStatus.PENDING]}</button>
                                        </div>
                                        <div className="flex items-start justify-between gap-2">
                                           <p className={`text-[10px] leading-tight flex-1 ${ng.decisionStatus === NgDecisionStatus.IDEA ? 'text-sky-700 italic' : 'text-slate-500'}`}>{t(ng.reason) || 'No reason specified'}</p>
                                           <button onClick={() => onEditNgReason(cat, task.id, ng.testerId)} className="text-slate-300 hover:text-slate-600"><Pencil size={10}/></button>
                                        </div>
                                        {ng.linkedEcoId && (<div className="flex items-center gap-1 text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-md w-fit"><Check size={10}/> Linked to {product.designHistory.find(e => e.id === ng.linkedEcoId)?.ecoNumber}</div>)}
                                     </div>
                                  );
                               })}
                            </div>
                         ) : (
                            <button onClick={() => onOpenTaskResults(cat, task.id)} className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-slate-300 text-xs font-bold hover:bg-slate-100 hover:border-slate-300 transition-all">Set Pass/NG</button>
                         )}
                      </div>
                   ))}
                   {(!project.tasks[cat] || project.tasks[cat].length === 0) && <div className="text-[10px] text-slate-300 italic text-center py-4">No tasks defined</div>}
                </div>
             </div>
         ))}
      </div>
    </div>
  );
};

// Customer Feedback Card Component
const CustomerFeedbackCard = ({ feedback, onStatusClick, onEdit, onDelete }: any) => {
  const { t, language } = useContext(LanguageContext);
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group hover:border-intenza-200 transition-all">
      <div className="flex justify-between items-start mb-2">
         <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 uppercase tracking-widest">{feedback.source}</span>
         <button onClick={onStatusClick} className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${feedback.status === 'PENDING' ? 'bg-amber-100 text-amber-800 border-amber-200' : feedback.status === 'DISCUSSION' ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{feedback.status}</button>
      </div>
      <p className="text-xs text-slate-700 leading-relaxed pr-6">{t(feedback.content)}</p>
      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
         <span>{feedback.date}</span>
         <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="text-slate-400 hover:text-slate-800"><Pencil size={12}/></button>
            <button onClick={() => window.confirm('Delete feedback?') && onDelete()} className="text-slate-400 hover:text-red-500"><Trash2 size={12}/></button>
         </div>
      </div>
    </div>
  );
};

// Set Pass/NG Detail Modal
const SetPassNgModal = ({ isOpen, onClose, onSet, context, project, existingReason }: any) => {
  const { language, t } = useContext(LanguageContext);
  const [reason, setReason] = useState<LocalizedString>(existingReason?.reason || { en: '', zh: '' });
  const [attachments, setAttachments] = useState<string[]>(existingReason?.attachmentUrls || []);
  const [isUploading, setIsUploading] = useState(false);
  const [type, setType] = useState<'ISSUE' | 'IDEA'>(existingReason?.decisionStatus === NgDecisionStatus.IDEA ? 'IDEA' : 'ISSUE');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const url = await api.uploadImage(file);
        setAttachments(prev => [...prev, url]);
      } catch (err) { alert('Upload failed'); }
      finally { setIsUploading(false); }
    }
  };

  if (!isOpen) return null;
  const tester = project.testerIds.find((id: string) => id === context.testerId);

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-slide-up">
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">NG Reason Details</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button></div>
        <div className="flex gap-2 mb-4 p-1 bg-slate-100 rounded-lg">
          <button onClick={() => setType('ISSUE')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${type === 'ISSUE' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}>Issue / Failure</button>
          <button onClick={() => setType('IDEA')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${type === 'IDEA' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500'}`}>Design Idea / UX Improvement</button>
        </div>
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason / Observation</label>
          <textarea className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm resize-none" rows={4} value={reason[language]} onChange={(e) => setReason({ ...reason, [language]: e.target.value })} placeholder="Describe the NG observation or the design idea..." />
        </div>
        <div className="mb-6">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Attachments</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((url, i) => (
               <div key={i} className="w-16 h-16 rounded border bg-slate-50 relative group overflow-hidden">
                  <img src={url} className="w-full h-full object-cover" />
                  <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 opacity-0 group-hover:opacity-100"><X size={10}/></button>
               </div>
            ))}
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-16 h-16 rounded border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:border-slate-400 hover:text-slate-400 transition-all">{isUploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={20}/>}</button>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />
          </div>
        </div>
        <div className="flex gap-2 justify-end"><button onClick={onClose} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Cancel</button><button onClick={() => onSet(reason, false, attachments, type)} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg">Save Reason</button></div>
      </div>
    </div>
  );
};

// Status Decision Modal for NG Items
const StatusDecisionModal = ({ isOpen, onClose, context, onSetStatus, onLinkEco, onCreateEco, activeEcos }: any) => {
  const { language } = useContext(LanguageContext);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center"><h2 className="text-xl font-bold">Review NG Item</h2><button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={20}/></button></div>
        <div className="p-6 space-y-4">
           <div className="grid grid-cols-2 gap-3">
              {(['PENDING', 'DISCUSSION', 'IGNORED', 'IDEA'] as NgDecisionStatus[]).map(status => (
                 <button key={status} onClick={() => onSetStatus(status)} className={`p-4 rounded-xl border-2 text-left transition-all ${context.currentStatus === status ? 'border-intenza-600 bg-intenza-50' : 'border-slate-100 hover:border-slate-200 bg-slate-50'}`}>
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">{status === 'IDEA' ? 'Strategy' : 'Decision'}</div>
                    <div className="text-sm font-bold text-slate-800">{ngDecisionTranslations[status]}</div>
                 </button>
              ))}
           </div>
           <div className="pt-4 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Escalate to Design Change (ECO)</label>
              <div className="space-y-3">
                 <button onClick={onCreateEco} className="w-full p-4 rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50 text-emerald-700 flex items-center justify-between hover:bg-emerald-100 transition-all">
                    <div className="text-left"><div className="font-bold text-sm">Create New ECO</div><div className="text-[10px] opacity-70">Initialize a design modification based on this NG</div></div>
                    <Plus size={20}/>
                 </button>
                 <div className="space-y-2">
                    <div className="text-xs text-slate-400 font-medium">Or Link to Existing Active ECO:</div>
                    <div className="max-h-[150px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                       {activeEcos.length === 0 ? <div className="text-[10px] text-slate-400 italic">No active ECOs found.</div> : activeEcos.map((eco: any) => (
                          <button key={eco.id} onClick={() => onLinkEco(eco.id)} className={`w-full p-3 rounded-lg border text-left flex items-center justify-between group ${context.linkedEcoId === eco.id ? 'bg-emerald-100 border-emerald-500' : 'bg-slate-50 border-slate-200 hover:bg-white'}`}>
                             <div className="overflow-hidden"><div className="text-xs font-bold text-slate-800 font-mono truncate">{eco.ecoNumber}</div><div className="text-[10px] text-slate-500 truncate">V{eco.version}</div></div>
                             <LinkIcon size={14} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
                          </button>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

// Feedback Creation/Edit Modal
const FeedbackModal = ({ isOpen, onClose, onSave, feedback, product }: any) => {
  const { language } = useContext(LanguageContext);
  const [date, setDate] = useState(feedback?.date || new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<ErgoProjectCategory>(feedback?.category || 'Experience');
  const [content, setContent] = useState<LocalizedString>(feedback?.content || { en: '', zh: '' });
  const [source, setSource] = useState(feedback?.source || 'Customer Service');
  const [isNewTag, setIsNewTag] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center"><h2 className="text-xl font-bold">{feedback ? 'Edit Feedback' : 'New Customer Feedback'}</h2><button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={20}/></button></div>
        <div className="p-6 space-y-5">
           <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm" /></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Source</label><input type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Equinox NYC" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm" /></div>
           </div>
           <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as ErgoProjectCategory)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm">
                 <option value="Strength Curve">Strength Curve</option><option value="Experience">Experience</option><option value="Stroke">Stroke</option><option value="Other Suggestion">Other Suggestion</option>
              </select>
           </div>
           <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Feedback Content</label><textarea rows={4} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm resize-none" value={content[language]} onChange={(e) => setContent({ ...content, [language]: e.target.value })} placeholder="Enter detailed customer feedback..." /></div>
           <div className="flex items-center gap-2 pt-2"><input type="checkbox" id="tagCheck" checked={isNewTag} onChange={(e) => setIsNewTag(e.target.checked)} className="rounded border-slate-300 text-intenza-600 focus:ring-intenza-500" /><label htmlFor="tagCheck" className="text-xs font-medium text-slate-600 cursor-pointer">Register as a unique feedback tag for this product</label></div>
        </div>
        <div className="p-6 bg-slate-50 flex justify-end gap-3"><button onClick={onClose} className="px-5 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg">Cancel</button><button onClick={() => onSave({ date, category, content, source }, isNewTag)} className="px-5 py-2 bg-slate-900 text-white font-bold rounded-lg shadow-lg">Save Feedback</button></div>
      </div>
    </div>
  );
};

// ECO Management Modal
const EcoModal = ({ isOpen, onClose, onSave, eco, productVersions, product }: any) => {
  const { language } = useContext(LanguageContext);
  const [formData, setFormData] = useState({
    ecoNumber: eco?.ecoNumber || `ECO-${new Date().getFullYear()}-000`,
    date: eco?.date || new Date().toISOString().split('T')[0],
    version: eco?.version || product.currentVersion,
    description: eco?.description || { en: '', zh: '' },
    affectedBatches: eco?.affectedBatches || [],
    affectedCustomers: eco?.affectedCustomers || [],
    imageUrls: eco?.imageUrls || [],
    status: eco?.status || EcoStatus.EVALUATING,
    implementationDate: eco?.implementationDate || ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (file) {
        setIsUploading(true);
        try {
           const url = await api.uploadImage(file);
           setFormData(prev => ({ ...prev, imageUrls: [...prev.imageUrls, url] }));
        } catch (err) { alert('Image upload failed'); }
        finally { setIsUploading(false); }
     }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
       <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
             <h2 className="text-xl font-bold">{eco ? 'Edit ECO' : 'Add New ECO'}</h2>
             <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={20}/></button>
          </div>
          <div className="p-6 overflow-y-auto space-y-6">
             <div className="grid grid-cols-2 gap-6">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">ECO Number</label><input type="text" value={formData.ecoNumber} onChange={e => setFormData({...formData, ecoNumber: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm font-mono" /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm" /></div>
             </div>
             <div className="grid grid-cols-2 gap-6">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Version</label>
                   <select value={formData.version} onChange={e => setFormData({...formData, version: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm">
                      {productVersions.map((v: string) => <option key={v} value={v}>{v}</option>)}
                      <option value={`v${(parseFloat(product.currentVersion.replace('v', '')) + 0.1).toFixed(1)}`}>New Version</option>
                   </select>
                </div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                   <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as EcoStatus})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm">
                      {Object.values(EcoStatus).map(s => <option key={s} value={s}>{s}</option>)}
                   </select>
                </div>
             </div>
             <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label><textarea rows={3} value={formData.description[language]} onChange={e => setFormData({...formData, description: {...formData.description, [language]: e.target.value}})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm resize-none" placeholder="Details of the design change..." /></div>
             <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Attachments (Images/Videos)</label>
                <div className="flex flex-wrap gap-2 mt-2">
                   {formData.imageUrls.map((url, i) => (
                      <div key={i} className="w-20 h-20 rounded border bg-slate-50 relative group overflow-hidden">
                         {isVideo(url) ? <Video size={24} className="absolute inset-0 m-auto text-slate-400" /> : <img src={url} className="w-full h-full object-cover" />}
                         <button onClick={() => setFormData(prev => ({...prev, imageUrls: prev.imageUrls.filter((_, idx) => idx !== i)}))} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 opacity-0 group-hover:opacity-100"><X size={12}/></button>
                      </div>
                   ))}
                   <button onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 hover:border-slate-400 hover:text-slate-400 transition-all">{isUploading ? <Loader2 className="animate-spin" size={20}/> : <Plus size={24}/>}</button>
                   <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} />
                </div>
             </div>
          </div>
          <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 sticky bottom-0">
             <button onClick={onClose} className="px-5 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg">Cancel</button>
             <button onClick={() => onSave(formData)} className="px-5 py-2 bg-slate-900 text-white font-bold rounded-lg shadow-lg">Save ECO</button>
          </div>
       </div>
    </div>
  )
}

// Durability Test Modal
const TestModal = ({ isOpen, onClose, onSave, test }: any) => {
  const { language } = useContext(LanguageContext);
  const [formData, setFormData] = useState({
    testName: test?.testName || { en: '', zh: '' },
    category: test?.category || 'Mechanical',
    score: test?.score || 0,
    status: test?.status || TestStatus.PENDING,
    details: test?.details || { en: '', zh: '' },
    updatedDate: test?.updatedDate || new Date().toISOString().split('T')[0]
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
       <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center"><h2 className="text-xl font-bold">{test ? 'Edit Test' : 'New Test Result'}</h2><button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={20}/></button></div>
          <div className="p-6 space-y-4">
             <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Test Name</label><input type="text" value={formData.testName[language]} onChange={e => setFormData({...formData, testName: {...formData.testName, [language]: e.target.value}})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm" /></div>
             <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label><input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm" /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                   <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as TestStatus})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm">
                      {Object.values(TestStatus).map(s => <option key={s} value={s}>{s}</option>)}
                   </select>
                </div>
             </div>
             <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Completion % ({formData.score}%)</label><input type="range" min="0" max="100" value={formData.score} onChange={e => setFormData({...formData, score: Number(e.target.value)})} className="w-full accent-intenza-600" /></div>
             <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Details</label><textarea rows={3} value={formData.details[language]} onChange={e => setFormData({...formData, details: {...formData.details, [language]: e.target.value}})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm resize-none" /></div>
          </div>
          <div className="p-6 bg-slate-50 flex justify-end gap-3"><button onClick={onClose} className="px-5 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg">Cancel</button><button onClick={() => onSave(formData)} className="px-5 py-2 bg-slate-900 text-white font-bold rounded-lg shadow-lg">Save Test</button></div>
       </div>
    </div>
  )
}

// Feedback Status Decision Modal
const FeedbackStatusDecisionModal = ({ isOpen, onClose, feedback, onUpdateStatus }: any) => {
    if (!isOpen || !feedback) return null;
    return (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up p-6">
                <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-lg">Update Feedback Status</h3><button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={20}/></button></div>
                <div className="space-y-3">
                    {(['PENDING', 'DISCUSSION', 'IGNORED'] as const).map(status => (
                        <button key={status} onClick={() => onUpdateStatus(feedback.id, status)} className={`w-full p-4 rounded-xl border-2 text-left font-bold transition-all ${feedback.status === status ? 'border-intenza-600 bg-intenza-50 text-intenza-900' : 'border-slate-50 bg-slate-50 text-slate-500 hover:border-slate-200'}`}>
                            {status}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
