
import React, { useState, useMemo, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, GitCommit, UserCheck, Activity, AlertTriangle, CheckCircle, Clock, Calendar, Layers, Users, Plus, X, Pencil, Trash2, Upload, MessageSquare, ChevronsRight, ChevronsLeft, Tag, FileText, User, Database, Mars, Venus, Link as LinkIcon, Search, ClipboardList, ListPlus, Check, ChevronDown, RefreshCw, HelpCircle, BarChart3, AlertCircle, PlayCircle, Loader2, StickyNote, Lightbulb, Paperclip, Video, Image as ImageIcon } from 'lucide-react';
import { ProductModel, TestStatus, DesignChange, LocalizedString, TestResult, EcoStatus, ErgoFeedback, ErgoProject, Tester, ErgoProjectCategory, NgReason, ProjectOverallStatus, Gender, NgDecisionStatus, EvaluationTask } from '../types';
import GeminiInsight from '../components/GeminiInsight';
import { LanguageContext } from '../App';
import { api } from '../services/api';


interface ProductDetailProps {
  products: ProductModel[];
  testers?: Tester[];
  onUpdateProduct: (product: ProductModel) => Promise<void>;
  showAiInsights: boolean;
}

const isVideo = (url: string) => {
    if (!url) return false;
    return url.startsWith('data:video') || url.match(/\.(mp4|webm|ogg)$/i);
};

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
  
  const handleSaveEco = async (ecoData: Omit<DesignChange, 'id' | 'description'> & { description: LocalizedString, imageUrls?: string[], status: EcoStatus, implementationDate?: string }) => {
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
              <div className="w-24 h-24 rounded-xl overflow-hidden shadow-md border border-slate-100 flex-shrink-0 bg-slate-100">
                 <img src={product.imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x200?text=No+Img'; }} />
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

const LifeSection: React.FC<{ product: ProductModel; onAddTest: () => void; onEditTest: (test: TestResult) => void; onDeleteTest: (id: string) => void; }> = ({ product, onAddTest, onEditTest, onDeleteTest }) => {
  const { t } = useContext(LanguageContext);
  
  const overallPercentage = useMemo(() => {
    if (product.durabilityTests.length === 0) return 0;
    const sum = product.durabilityTests.reduce((acc, test) => {
        let pct = test.score;
        if (test.targetValue && test.currentValue !== undefined && test.targetValue > 0) {
            pct = (test.currentValue / test.targetValue) * 100;
        }
        return acc + Math.min(100, Math.max(0, pct));
    }, 0);
    return Math.round(sum / product.durabilityTests.length);
  }, [product.durabilityTests]);
  
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold text-slate-900">Durability & Reliability</h2><button onClick={onAddTest} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors"><Plus size={16} /> Add Test Result</button></div>
      
      <div className="bg-slate-900 text-white p-6 rounded-2xl mb-6 shadow-xl shadow-slate-900/10">
          <div className="flex justify-between items-end mb-2">
              <span className="text-slate-400 font-medium">{t({en: 'Life Test Percentage', zh: '壽命測試百分比'})}</span>
              <span className="text-3xl font-bold">{overallPercentage}<span className="text-lg text-slate-500">%</span></span>
          </div>
          <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-3">
              <div className="bg-gradient-to-r from-intenza-500 to-orange-400 h-full transition-all duration-1000" style={{width: `${overallPercentage}%`}}></div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-xs text-slate-400">
              {product.durabilityTests.length === 1 && product.durabilityTests[0].targetValue ? (
                  <>
                      <span>{t({en: 'Target', zh: '目標值'})}: <strong className="text-white">{product.durabilityTests[0].targetValue} {product.durabilityTests[0].unit}</strong></span>
                      <span>{t({en: 'Current', zh: '現在值'})}: <strong className="text-white">{product.durabilityTests[0].currentValue} {product.durabilityTests[0].unit}</strong></span>
                      {product.durabilityTests[0].updatedDate && <span>{t({en: 'Updated', zh: '更新日期'})}: <strong className="text-white">{product.durabilityTests[0].updatedDate}</strong></span>}
                  </>
              ) : (
                  <span>Average completion of {product.durabilityTests.length} tests</span>
              )}
          </div>
      </div>
      
      <div className="space-y-4">
          {product.durabilityTests.length > 0 ? product.durabilityTests.map((test) => (<TestResultCard key={test.id} test={test} onEdit={() => onEditTest(test)} onDelete={() => onDeleteTest(test.id)}/>)) : (<div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400">No durability test data available.</div>)}
      </div>
    </div>
  );
};

interface TestResultCardProps { test: TestResult; onEdit?: () => void; onDelete?: () => void; }
const TestResultCard: React.FC<TestResultCardProps> = ({ test, onEdit, onDelete }) => {
  const { t } = useContext(LanguageContext);
  const getStatusColor = (status: TestStatus) => {
    switch (status) {
      case TestStatus.PASS: return 'text-green-600 bg-green-50 border-green-100';
      case TestStatus.WARNING: return 'text-amber-600 bg-amber-50 border-amber-100';
      case TestStatus.FAIL: return 'text-red-600 bg-red-50 border-red-100';
      case TestStatus.ONGOING: return 'text-blue-600 bg-blue-50 border-blue-100';
      default: return 'text-slate-600 bg-slate-50 border-slate-100';
    }
  };
  const getIcon = (status: TestStatus) => {
     switch (status) {
      case TestStatus.PASS: return <CheckCircle size={18} />;
      case TestStatus.WARNING: return <Clock size={18} />;
      case TestStatus.FAIL: return <AlertTriangle size={18} />;
      case TestStatus.ONGOING: return <Loader2 size={18} className="animate-spin" />;
      default: return <Activity size={18} />;
    }
  };
  
  const displayScore = (test.targetValue && test.currentValue !== undefined) 
      ? Math.round((test.currentValue / test.targetValue) * 100)
      : test.score;

  return (
      <div className="group relative bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className={`p-3 rounded-xl border ${getStatusColor(test.status)}`}>{getIcon(test.status)}</div>
          <div className="flex-1">
              <div className="flex justify-between items-start">
                  <h4 className="font-bold text-slate-900">{t(test.testName)}</h4>
                  <span className="font-mono font-bold text-slate-700">{displayScore}%</span>
              </div>
              
              {test.targetValue ? (
                  <div className="mt-1 text-sm text-slate-600 font-mono">
                      {test.currentValue} / {test.targetValue} <span className="text-xs text-slate-400">{test.unit}</span>
                  </div>
              ) : (
                  <div className="mt-1 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-slate-400 h-full" style={{width: `${displayScore}%`}}></div>
                  </div>
              )}

              {(test.startDate || test.estimatedCompletionDate) && (
                  <div className="flex items-center gap-4 text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded-lg w-fit">
                      {test.startDate && <div className="flex items-center gap-1"><Calendar size={12}/> Start: {test.startDate}</div>}
                      {test.estimatedCompletionDate && <div className="flex items-center gap-1"><Clock size={12}/> Est. Finish: {test.estimatedCompletionDate}</div>}
                  </div>
              )}

              <p className="text-sm text-slate-500 mt-2">{t(test.details)}</p>
              
              {test.attachmentUrls && test.attachmentUrls.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                      {test.attachmentUrls.map((url, i) => (
                           <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block relative h-10 w-10 rounded overflow-hidden border border-slate-200 hover:border-slate-400 transition-colors">
                              {isVideo(url) ? <video src={url} className="w-full h-full object-cover"/> : <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100x100?text=Error'; }} />}
                              {isVideo(url) && <div className="absolute inset-0 flex items-center justify-center bg-black/20"><PlayCircle size={12} className="text-white"/></div>}
                           </a>
                      ))}
                  </div>
              )}
              
              <div className="mt-3 flex items-center justify-between text-xs">
                  <div className="font-semibold text-slate-400 uppercase tracking-wider">{test.category}</div>
                  {test.updatedDate && <div className="text-slate-400">Updated: {test.updatedDate}</div>}
              </div>
          </div>
          {(onEdit || onDelete) && (<div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">{onEdit && <button onClick={onEdit} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800"><Pencil size={14} /></button>}{onDelete && <button onClick={onDelete} className="p-2 bg-red-50 rounded-full text-red-500 hover:bg-red-100 hover:text-red-700"><Trash2 size={14} /></button>}</div>)}
      </div>
  );
};

const TestModal: React.FC<{ isOpen: boolean; onClose: () => void; onSave: (data: Omit<TestResult, 'id'>) => void; test: TestResult | null; }> = ({ isOpen, onClose, onSave, test }) => {
    const { language, t } = useContext(LanguageContext);
    const [isUploading, setIsUploading] = useState(false);
    const [formData, setFormData] = useState({ 
        category: 'Durability',
        testName: '', 
        score: 0, 
        status: TestStatus.PASS, 
        details: '',
        targetValue: '',
        currentValue: '',
        unit: '',
        updatedDate: new Date().toISOString().split('T')[0],
        startDate: '',
        estimatedCompletionDate: '',
        attachmentUrls: [] as string[]
    });
    
    const [isCustomCategory, setIsCustomCategory] = useState(false);
    const predefinedCategories = ['Durability', 'Reliability'];
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { 
        if (isOpen) { 
            if (test) { 
                const isCustom = !predefinedCategories.includes(test.category);
                setIsCustomCategory(isCustom);
                setFormData({ 
                    category: test.category, 
                    testName: t(test.testName), 
                    score: test.score, 
                    status: test.status, 
                    details: t(test.details),
                    targetValue: test.targetValue?.toString() || '',
                    currentValue: test.currentValue?.toString() || '',
                    unit: test.unit || '',
                    updatedDate: test.updatedDate || new Date().toISOString().split('T')[0],
                    startDate: test.startDate || '',
                    estimatedCompletionDate: test.estimatedCompletionDate || '',
                    attachmentUrls: test.attachmentUrls || []
                }); 
            } else { 
                setIsCustomCategory(false);
                setFormData({ 
                    category: 'Durability', 
                    testName: '', 
                    score: 0, 
                    status: TestStatus.PASS, 
                    details: '', 
                    targetValue: '',
                    currentValue: '',
                    unit: '',
                    updatedDate: new Date().toISOString().split('T')[0],
                    startDate: '',
                    estimatedCompletionDate: '',
                    attachmentUrls: []
                }); 
            } 
        } 
    }, [isOpen, test, t]);

    const handleSubmit = (e: React.FormEvent) => { 
        e.preventDefault(); 
        const testNameLS = test ? { ...test.testName, [language]: formData.testName } : { en: '', zh: '', [language]: formData.testName }; 
        const detailsLS = test ? { ...test.details, [language]: formData.details } : { en: '', zh: '', [language]: formData.details }; 
        
        let calculatedScore = formData.score;
        const target = Number(formData.targetValue);
        const current = Number(formData.currentValue);
        
        if (!isNaN(target) && target > 0 && !isNaN(current)) {
            calculatedScore = (current / target) * 100;
        }

        onSave({ 
            category: formData.category, 
            testName: testNameLS, 
            score: Math.min(100, Math.max(0, Math.round(calculatedScore))), 
            status: formData.status, 
            details: detailsLS,
            targetValue: formData.targetValue ? Number(formData.targetValue) : undefined,
            currentValue: formData.currentValue ? Number(formData.currentValue) : undefined,
            unit: formData.unit,
            updatedDate: formData.updatedDate,
            startDate: formData.startDate,
            estimatedCompletionDate: formData.estimatedCompletionDate,
            attachmentUrls: formData.attachmentUrls
        }); 
    };
    
    const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === '__NEW__') {
            setIsCustomCategory(true);
            setFormData({...formData, category: ''});
        } else {
            setIsCustomCategory(false);
            setFormData({...formData, category: val});
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files) as File[];
            setIsUploading(true);
            try {
              const newUrls: string[] = [];
              for (const file of files) {
                  const url = await api.uploadImage(file);
                  newUrls.push(url);
              }
              setFormData(prev => ({ ...prev, attachmentUrls: [...prev.attachmentUrls, ...newUrls] }));
            } catch (err) {
              console.error(err);
              alert("檔案上傳失敗");
            } finally {
              setIsUploading(false);
            }
        }
    }

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-slide-up flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b border-slate-100"><h2 className="text-xl font-bold text-slate-900">{test ? 'Edit Test Result' : 'Add Test Result'}</h2><button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><X size={20} /></button></div>
                <div className="p-6 overflow-y-auto">
                    <form id="testForm" onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                                {isCustomCategory ? (
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            autoFocus
                                            placeholder="Enter category name"
                                            value={formData.category} 
                                            onChange={(e) => setFormData({...formData, category: e.target.value})} 
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => { setIsCustomCategory(false); setFormData({...formData, category: 'Durability'})}}
                                            className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded text-slate-600"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <select 
                                        value={formData.category} 
                                        onChange={handleCategoryChange} 
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                                    >
                                        <option value="Durability">Durability</option>
                                        <option value="Reliability">Reliability</option>
                                        <option value="__NEW__" className="font-bold text-intenza-600">+ Create New Category</option>
                                    </select>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as TestStatus })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                                    {Object.values(TestStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Test Name</label><input type="text" required placeholder="e.g. Belt Life Test" value={formData.testName} onChange={e => setFormData({ ...formData, testName: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900" /></div>
                        
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Life Test Metrics</h4>
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className="block text-xs font-medium text-slate-700 mb-1">Current</label><input type="number" value={formData.currentValue} onChange={e => setFormData({ ...formData, currentValue: e.target.value })} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm" placeholder="15000" /></div>
                                <div><label className="block text-xs font-medium text-slate-700 mb-1">Target</label><input type="number" value={formData.targetValue} onChange={e => setFormData({ ...formData, targetValue: e.target.value })} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm" placeholder="20000" /></div>
                                <div><label className="block text-xs font-medium text-slate-700 mb-1">Unit</label><input type="text" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm" placeholder="km" /></div>
                            </div>
                            <div><label className="block text-xs font-medium text-slate-700 mb-1">Update Date</label><input type="date" value={formData.updatedDate} onChange={e => setFormData({ ...formData, updatedDate: e.target.value })} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm" /></div>
                        </div>

                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Scheduling</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
                                    <input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Est. Completion</label>
                                    <input type="date" value={formData.estimatedCompletionDate} onChange={e => setFormData({...formData, estimatedCompletionDate: e.target.value})} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"/>
                                </div>
                            </div>
                        </div>

                        {!formData.targetValue && (
                             <div><label className="block text-sm font-medium text-slate-700 mb-1">Manual Score %</label><input type="number" min="0" max="100" value={formData.score} onChange={e => setFormData({ ...formData, score: Number(e.target.value) })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900" /></div>
                        )}

                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Details</label><textarea rows={3} value={formData.details} onChange={e => setFormData({ ...formData, details: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg resize-none text-slate-900" /></div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Attachments</label>
                            <div onClick={() => !isUploading && fileInputRef.current?.click()} className="relative h-20 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:border-intenza-400 hover:bg-intenza-50">
                                <div className="flex items-center gap-2 text-slate-500">
                                    {isUploading ? <Loader2 className="animate-spin" size={14}/> : <Upload size={14} />} 
                                    <span className="text-xs">{isUploading ? 'Uploading to Blob...' : 'Upload images/videos'}</span>
                                </div>
                                <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />
                            </div>
                            {formData.attachmentUrls.length > 0 && <div className="grid grid-cols-4 gap-2 mt-2">{formData.attachmentUrls.map((url, i) => <div key={i} className="relative h-16 bg-slate-100 rounded overflow-hidden">
                                {isVideo(url) ? <video src={url} className="w-full h-full object-cover"/> : <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100x100?text=Error'; }} />}
                                <button type="button" onClick={() => setFormData(p => ({...p, attachmentUrls: p.attachmentUrls.filter((_, idx) => idx !== i)}))} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-full z-10"><X size={10}/></button>
                            </div>)}</div>}
                        </div>

                    </form>
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl"><button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg">Cancel</button><button form="testForm" type="submit" disabled={isUploading} className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 disabled:bg-slate-300">Save</button></div>
            </div>
        </div>
    );
};

const EcoModal: React.FC<{ isOpen: boolean; onClose: () => void; onSave: (data: any) => void; eco: DesignChange | null; productVersions: string[]; product: ProductModel; }> = ({ isOpen, onClose, onSave, eco, productVersions, product }) => {
    const { language, t } = useContext(LanguageContext);
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [formData, setFormData] = useState({ ecoNumber: '', date: new Date().toISOString().split('T')[0], version: productVersions[0] || 'v1.0', description: '', status: EcoStatus.EVALUATING, affectedBatches: '', affectedCustomers: '', implementationDate: '', imageUrls: [] as string[] });
    
    useEffect(() => { if (isOpen) { if (eco) { setFormData({ ecoNumber: eco.ecoNumber, date: eco.date, version: eco.version, description: t(eco.description), status: eco.status, affectedBatches: eco.affectedBatches.join(', '), affectedCustomers: eco.affectedCustomers.join(', '), implementationDate: eco.implementationDate || '', imageUrls: eco.imageUrls || [] }); } else { setFormData({ ecoNumber: '', date: new Date().toISOString().split('T')[0], version: productVersions[0] || 'v1.0', description: '', status: EcoStatus.EVALUATING, affectedBatches: '', affectedCustomers: '', implementationDate: '', imageUrls: [] }); } } }, [isOpen, eco, t, productVersions]);
    
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files) as File[];
            setIsUploading(true);
            try {
              const newUrls: string[] = [];
              for (const file of files) {
                  const url = await api.uploadImage(file);
                  newUrls.push(url);
              }
              setFormData(prev => ({ ...prev, imageUrls: [...prev.imageUrls, ...newUrls] }));
            } catch (err) {
              console.error(err);
              alert("上傳失敗");
            } finally {
              setIsUploading(false);
            }
        }
    }

    const removeImage = (index: number) => { setFormData(prev => ({ ...prev, imageUrls: prev.imageUrls.filter((_, i) => i !== index) })); };
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); const descriptionLS = eco ? { ...eco.description, [language]: formData.description } : { en: '', zh: '', [language]: formData.description }; onSave({ ...eco, ecoNumber: formData.ecoNumber, date: formData.date, version: formData.version, description: descriptionLS, status: formData.status, affectedBatches: formData.affectedBatches.split(',').map(s => s.trim()).filter(Boolean), affectedCustomers: formData.affectedCustomers.split(',').map(s => s.trim()).filter(Boolean), implementationDate: formData.status === EcoStatus.IN_PRODUCTION ? formData.implementationDate : undefined, imageUrls: formData.imageUrls }); };
    if (!isOpen) return null;
    return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-slide-up flex flex-col max-h-[90vh]"><div className="flex justify-between items-center p-6 border-b border-slate-100"><h2 className="text-xl font-bold text-slate-900">{eco ? 'Edit ECO' : 'New Engineering Change'}</h2><button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><X size={20} /></button></div><div className="p-6 overflow-y-auto"><form id="ecoForm" onSubmit={handleSubmit} className="space-y-6"><div className="grid grid-cols-2 gap-6"><div><label className="block text-sm font-medium text-slate-700 mb-1">ECO Number</label><input type="text" required placeholder="ECO-2024-XXX" value={formData.ecoNumber} onChange={e => setFormData({...formData, ecoNumber: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900" /></div><div><label className="block text-sm font-medium text-slate-700 mb-1">Date</label><input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900" /></div></div><div className="grid grid-cols-2 gap-6"><div><label className="block text-sm font-medium text-slate-700 mb-1">Version</label><div className="relative"><input list="versions" type="text" required value={formData.version} onChange={e => setFormData({...formData, version: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900" /><datalist id="versions">{productVersions.map(v => <option key={v} value={v} />)}</datalist></div></div><div><label className="block text-sm font-medium text-slate-700 mb-1">Status</label><div className="flex bg-slate-100 p-1 rounded-lg">{Object.values(EcoStatus).map((s) => (<button key={s} type="button" onClick={() => setFormData({...formData, status: s})} className={`flex-1 py-1.5 text-[10px] sm:text-xs font-semibold rounded-md transition-all ${formData.status === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{language === 'en' ? s : ecoStatusTranslations[s]}</button>))}</div></div></div><div><label className="block text-sm font-medium text-slate-700 mb-1">Description</label><textarea required rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 resize-none" />{eco?.sourceFeedback && (<button type="button" onClick={() => { onClose(); navigate(`/product/${product.id}`, { state: { highlightFeedback: eco.sourceFeedback } }); }} className="mt-2 text-xs text-blue-600 font-semibold flex items-center gap-1 hover:underline"><LinkIcon size={12}/> View Source Feedback</button>)}</div><div className="grid grid-cols-2 gap-6"><div><label className="block text-sm font-medium text-slate-700 mb-1">Affected Batches</label><input type="text" placeholder="B2024-01, B2024-02" value={formData.affectedBatches} onChange={e => setFormData({...formData, affectedBatches: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900" /><p className="text-xs text-slate-400 mt-1">Comma separated</p></div><div><label className="block text-sm font-medium text-slate-700 mb-1">Affected Customers</label><input type="text" placeholder="Gym A, Hotel B" value={formData.affectedCustomers} onChange={e => setFormData({...formData, affectedCustomers: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900" /><p className="text-xs text-slate-400 mt-1">Comma separated</p></div></div>{formData.status === EcoStatus.IN_PRODUCTION && (<div className="bg-amber-50 p-4 rounded-xl border border-amber-100"><label className="block text-sm font-bold text-amber-800 mb-1">Implementation Date (Required)</label><input type="date" required value={formData.implementationDate} onChange={e => setFormData({...formData, implementationDate: e.target.value})} className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-slate-900 focus:ring-amber-500" /><p className="text-xs text-amber-600 mt-1">This date will appear on the product dashboard.</p></div>)}<div><label className="block text-sm font-medium text-slate-700 mb-2">Visual Aids</label><div onClick={() => !isUploading && fileInputRef.current?.click()} className="relative h-24 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:border-intenza-400 hover:bg-intenza-50 transition-all">
                <div className="flex items-center gap-2 text-slate-500">
                    {isUploading ? <Loader2 className="animate-spin" size={16}/> : <Upload size={16} />} 
                    <span className="text-xs">{isUploading ? 'Uploading...' : 'Upload images/videos'}</span>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileUpload} />
              </div>
              {formData.imageUrls.length > 0 && (<div className="grid grid-cols-4 gap-3 mt-3">{formData.imageUrls.map((url, idx) => (<div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200 h-20 w-full">
                {isVideo(url) ? <video src={url} className="w-full h-full object-cover"/> : <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100x100?text=Error'; }} />}
                <button type="button" onClick={() => removeImage(idx)} className="absolute top-0 right-0 p-1 bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
              </div>))}</div>)}</div></form></div><div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl"><button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg">Cancel</button><button form="ecoForm" type="submit" disabled={isUploading} className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 disabled:bg-slate-300">Save Changes</button></div></div></div>);
};

const ProjectCard: React.FC<any> = ({ project, testers, product, onOpenAddTask, onEditTaskName, onDeleteTask, onOpenTaskResults, onDeleteProject, onEditProject, categoryTranslations, onStatusClick, onEditNgReason, highlightedFeedback }) => {
    const { t, language } = useContext(LanguageContext);
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

    const getTester = (id: string) => testers.find((t: Tester) => t.id === id);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                    <h3 className="font-bold text-lg text-slate-900">{t(project.name)}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <Calendar size={12}/> {project.date}
                        <span>•</span>
                        <Users size={12}/> {project.testerIds.length} Testers
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     <button onClick={onEditProject} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><Pencil size={16}/></button>
                     <button onClick={onDeleteProject} className="p-2 hover:bg-red-100 rounded-full text-red-500"><Trash2 size={16}/></button>
                </div>
            </div>
            
            <div className="p-5 space-y-6">
                {(['Strength Curve', 'Experience', 'Stroke', 'Other Suggestion'] as ErgoProjectCategory[]).map(cat => {
                    const tasks = project.tasks[cat] || [];
                    const theme = categoryStyles[cat];
                    const isExpanded = expandedCategory === cat;
                    
                    return (
                        <div key={cat} className={`rounded-xl border transition-all ${theme.bg} ${theme.border}`}>
                            <div className="p-3 flex items-center justify-between cursor-pointer" onClick={() => setExpandedCategory(isExpanded ? null : cat)}>
                                <div className="flex items-center gap-2">
                                    {isExpanded ? <ChevronDown size={16} className={theme.text}/> : <ChevronsRight size={16} className={theme.text}/>}
                                    <h4 className={`font-bold text-sm ${theme.text}`}>{language === 'en' ? cat : categoryTranslations[cat]}</h4>
                                    <span className="bg-white/50 px-2 py-0.5 rounded-full text-xs font-semibold text-slate-600">{tasks.length}</span>
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onOpenAddTask(project.id, cat); }}
                                    className="p-1.5 hover:bg-white rounded-lg text-slate-500 transition-colors"
                                >
                                    <Plus size={16}/>
                                </button>
                            </div>
                            
                            {isExpanded && (
                                <div className="p-3 pt-0 space-y-3 animate-fade-in">
                                    {tasks.length === 0 && <div className="text-center py-4 text-xs text-slate-400 italic">No tasks defined.</div>}
                                    {tasks.map((task: any) => {
                                        const passCount = task.passTesterIds.length;
                                        const totalTesters = project.testerIds.length;
                                        const ngCount = totalTesters - passCount;
                                        
                                        return (
                                            <div key={task.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 group/title">
                                                            <h5 className="font-bold text-slate-800">{t(task.name)}</h5>
                                                            <button onClick={() => onEditTaskName(project.id, cat, task.id, t(task.name))} className="opacity-0 group-hover/title:opacity-100 text-slate-400 hover:text-slate-600"><Pencil size={12}/></button>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs mt-1">
                                                            <span className="text-green-600 font-semibold">{passCount} Pass</span>
                                                            <span className="text-slate-300">|</span>
                                                            <span className="text-red-500 font-semibold">{ngCount} NG / Feedback</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button 
                                                            onClick={() => onOpenTaskResults(cat, task.id)} 
                                                            className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors"
                                                        >
                                                            Set Results
                                                        </button>
                                                        <button onClick={() => onDeleteTask(project.id, cat, task.id)} className="p-1.5 text-slate-300 hover:text-red-500"><X size={16}/></button>
                                                    </div>
                                                </div>

                                                {task.ngReasons.length > 0 && (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-50">
                                                        {task.ngReasons.map((ng: any) => {
                                                            const tester = getTester(ng.testerId);
                                                            if (!tester) return null;
                                                            const linkedEco = ng.linkedEcoId ? product.designHistory.find((e: any) => e.id === ng.linkedEcoId) : undefined;
                                                            const isHighlighted = highlightedFeedback && highlightedFeedback.projectId === project.id && highlightedFeedback.taskId === task.id && highlightedFeedback.testerId === ng.testerId;
                                                            
                                                            return (
                                                                <div key={ng.testerId} data-feedback-id={`${project.id}-${task.id}-${ng.testerId}`} className={isHighlighted ? 'ring-2 ring-intenza-500 rounded-xl' : ''}>
                                                                    <ProjectTesterCard 
                                                                        tester={tester} 
                                                                        ngReason={ng}
                                                                        linkedEco={linkedEco}
                                                                        onClick={() => onEditNgReason(cat, task.id, ng.testerId)}
                                                                        onStatusClick={() => onStatusClick(project.id, cat, task.id, ng.testerId, ng.decisionStatus || NgDecisionStatus.PENDING, ng.linkedEcoId)}
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const ProjectTesterCard: React.FC<{ tester: Tester, ngReason: NgReason, linkedEco?: DesignChange, onClick: () => void, onStatusClick: () => void }> = ({ tester, ngReason, linkedEco, onClick, onStatusClick }) => {
    const { t, language } = useContext(LanguageContext);
    const decisionStatus = ngReason.decisionStatus || NgDecisionStatus.PENDING;
    const isIdea = decisionStatus === NgDecisionStatus.IDEA;
    const handleStatusTagClick = (e: React.MouseEvent) => { e.stopPropagation(); onStatusClick(); };
    return (
        <div onClick={onClick} className={`group/card relative rounded-xl border cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col p-3 h-auto ${isIdea ? 'bg-sky-50 border-sky-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-3 mb-3"><img src={tester.imageUrl} className="w-10 h-10 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100x100?text=Tester'; }} /><div><p className="font-bold text-slate-900 text-sm">{tester.name}</p><p className="text-xs text-slate-500">{tester.height} cm</p></div><div className={`ml-auto font-bold px-2 py-1 rounded text-xs ${isIdea ? 'bg-sky-100 text-sky-600 flex items-center gap-1' : 'bg-red-50 text-red-600'}`}>{isIdea ? <><Lightbulb size={10}/> IDEA</> : 'NG'}</div></div>
            <div className={`pt-2 border-t flex-1 flex flex-col ${isIdea ? 'border-sky-200' : 'border-slate-200'}`}>
                 <div className="mb-2"><button onClick={handleStatusTagClick} className={`text-[10px] font-bold whitespace-nowrap px-2 py-1 rounded-full transition-colors flex items-center gap-1 w-fit hover:opacity-80 ${linkedEco ? ngDecisionStyles[NgDecisionStatus.NEEDS_IMPROVEMENT] : ngDecisionStyles[decisionStatus]}`}>{linkedEco ? (<><LinkIcon size={10}/> {linkedEco.ecoNumber} ({language === 'en' ? linkedEco.status : ecoStatusTranslations[linkedEco.status]})</>) : (language === 'en' ? decisionStatus.replace('_', ' ') : ngDecisionTranslations[decisionStatus])}<ChevronDown size={10} className="ml-1 opacity-50"/></button></div>
                <p className="text-xs text-slate-600 leading-relaxed pr-2 mb-2 break-words whitespace-pre-wrap">{t(ngReason.reason) || 'No feedback recorded.'}</p>
                {ngReason.attachmentUrls && ngReason.attachmentUrls.length > 0 && <div className="flex gap-1 mt-auto pt-1 flex-wrap">
                    {ngReason.attachmentUrls.map((url, i) => (
                        <a key={i} href={url} onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" className="block relative h-8 w-8 rounded overflow-hidden border border-slate-200">
                             {isVideo(url) ? <video src={url} className="w-full h-full object-cover" /> : <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/50x50?text=X'; }} />}
                             {isVideo(url) && <div className="absolute inset-0 flex items-center justify-center bg-black/20"><PlayCircle size={10} className="text-white/80"/></div>}
                        </a>
                    ))}
                </div>}
            </div>
        </div>
    )
}

const StartEvaluationModal: React.FC<{ isOpen: boolean, onClose: () => void, onStartProject: (name: LocalizedString, testers: string[]) => void, allTesters: Tester[], project: ErgoProject | null }> = ({ isOpen, onClose, onStartProject, allTesters, project }) => {
    const { language } = useContext(LanguageContext);
    const [name, setName] = useState('');
    const [selectedTesters, setSelectedTesters] = useState<string[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        if (isOpen) {
            if (project) {
                setName(project.name[language] || project.name.en);
                setSelectedTesters(project.testerIds);
            } else {
                setName('');
                setSelectedTesters([]);
            }
        }
    }, [isOpen, project, language]);

    const handleToggleTester = (id: string) => {
        setSelectedTesters(prev => prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]);
    };

    const handleSelectTestersFromDB = () => {
         onClose();
         navigate('/testers', { state: { selectionMode: true, returnTo: window.location.pathname, activeTab: 'ERGO' } });
    };
    
    const location = useLocation();
    useEffect(() => {
        if (location.state?.selectedTesterIds) {
            setSelectedTesters(prev => Array.from(new Set([...prev, ...location.state.selectedTesterIds])));
            navigate(location.pathname, { replace: true, state: { ...location.state, selectedTesterIds: undefined } });
        }
    }, [location.state, navigate, location.pathname]);


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-slide-up flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900">{project ? 'Edit Project' : 'Start New Evaluation'}</h2>
                    <button onClick={onClose}><X size={20}/></button>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg" placeholder="e.g. Phase 2 Ergonomics"/>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-2">
                             <label className="block text-sm font-medium text-slate-700">Select Testers ({selectedTesters.length})</label>
                             <button onClick={handleSelectTestersFromDB} className="text-xs text-intenza-600 font-bold hover:underline">Select from DB</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {allTesters.map(t => (
                                <div key={t.id} onClick={() => handleToggleTester(t.id)} className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all ${selectedTesters.includes(t.id) ? 'bg-intenza-50 border-intenza-200 ring-1 ring-intenza-500' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                    <img src={t.imageUrl} className="w-8 h-8 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/50x50?text=U'; }} />
                                    <div>
                                        <p className="text-xs font-bold text-slate-900">{t.name}</p>
                                        <p className="text-[10px] text-slate-500">{t.height}cm</p>
                                    </div>
                                    {selectedTesters.includes(t.id) && <CheckCircle size={16} className="ml-auto text-intenza-600"/>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium">Cancel</button>
                    <button onClick={() => onStartProject({ en: name, zh: name }, selectedTesters)} disabled={!name || selectedTesters.length === 0} className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg disabled:bg-slate-300">
                        {project ? 'Save Changes' : 'Start Project'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AddTaskModal: React.FC<{ isOpen: boolean, onClose: () => void, onSave: (name: string) => void }> = ({ isOpen, onClose, onSave }) => {
    const [name, setName] = useState('');
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Add Evaluation Task</h3>
                <input type="text" autoFocus value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg mb-4" placeholder="Task Name"/>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium">Cancel</button>
                    <button onClick={() => onSave(name)} disabled={!name.trim()} className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg disabled:bg-slate-300">Add</button>
                </div>
            </div>
        </div>
    );
};

const EditTaskNameModal: React.FC<{ isOpen: boolean, onClose: () => void, currentName: string, onSave: (name: string) => void }> = ({ isOpen, onClose, currentName, onSave }) => {
    const [name, setName] = useState(currentName);
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Rename Task</h3>
                <input type="text" autoFocus value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg mb-4"/>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium">Cancel</button>
                    <button onClick={() => onSave(name)} disabled={!name.trim()} className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg disabled:bg-slate-300">Save</button>
                </div>
            </div>
        </div>
    );
};

const SetTaskResultsModal: React.FC<{ isOpen: boolean, onClose: () => void, onSave: (passIds: string[]) => void, context: any, project: ErgoProject, testers: Tester[] }> = ({ isOpen, onClose, onSave, context, project, testers }) => {
    const task = project.tasks[context.category as ErgoProjectCategory].find(t => t.id === context.taskId);
    const [passIds, setPassIds] = useState<string[]>(task?.passTesterIds || []);
    
    const projectTesters = testers.filter(t => project.testerIds.includes(t.id));

    const togglePass = (id: string) => {
        setPassIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    };

    if (!isOpen || !task) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900">Set Results</h2>
                    <button onClick={onClose}><X size={20}/></button>
                </div>
                <div className="p-6 overflow-y-auto">
                    <p className="text-sm text-slate-500 mb-4">Check testers who <strong>PASSED</strong> this task. Unchecked testers will be marked as NG.</p>
                    <div className="space-y-3">
                        {projectTesters.map(t => (
                            <div key={t.id} onClick={() => togglePass(t.id)} className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all ${passIds.includes(t.id) ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${passIds.includes(t.id) ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-300'}`}>
                                    {passIds.includes(t.id) && <Check size={14}/>}
                                </div>
                                <img src={t.imageUrl} className="w-10 h-10 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/50x50?text=U'; }} />
                                <div className="flex-1">
                                    <p className="font-bold text-slate-900">{t.name}</p>
                                    <p className="text-xs text-slate-500">{t.height}cm</p>
                                </div>
                                <span className={`text-xs font-bold px-2 py-1 rounded ${passIds.includes(t.id) ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
                                    {passIds.includes(t.id) ? 'PASS' : 'NG'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
                     <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium">Cancel</button>
                     <button onClick={() => onSave(passIds)} className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg">Save Results</button>
                </div>
            </div>
        </div>
    );
};

const SetPassNgModal: React.FC<{ isOpen: boolean, onClose: () => void, onSet: (reason: LocalizedString, isNew: boolean, attachments: string[], type: 'ISSUE' | 'IDEA') => void, context: any, project: ErgoProject, existingReason?: NgReason }> = ({ isOpen, onClose, onSet, context, project, existingReason }) => {
    const { language } = useContext(LanguageContext);
    const [reasonText, setReasonText] = useState("");
    const [attachments, setAttachments] = useState<string[]>([]);
    const [type, setType] = useState<'ISSUE' | 'IDEA'>('ISSUE');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const availableTags = project.uniqueNgReasons?.[context.category as ErgoProjectCategory] || [];
    
    useEffect(() => { 
        if (isOpen) { 
            setReasonText(existingReason?.reason.en || ""); 
            setAttachments(existingReason?.attachmentUrls || []); 
            if (existingReason?.decisionStatus === NgDecisionStatus.IDEA) {
                setType('IDEA');
            } else if (context.category === 'Other Suggestion') {
                setType('IDEA');
            } else {
                setType('ISSUE');
            }
        } 
    }, [isOpen, existingReason, context.category]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { 
        if (e.target.files) { 
            const files = Array.from(e.target.files) as File[];
            setIsUploading(true);
            try {
              const newUrls: string[] = [];
              for (const file of files) {
                  const url = await api.uploadImage(file);
                  newUrls.push(url);
              }
              setAttachments(prev => [...prev, ...newUrls]); 
            } catch (err) {
              console.error(err);
              alert("檔案上傳失敗");
            } finally {
              setIsUploading(false);
            }
        } 
    };

    if (!isOpen) return null;
    return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up"><div className="p-6 border-b border-slate-100"><h2 className="text-xl font-bold text-slate-900">Feedback / Note</h2><p className="text-sm text-slate-500">Provide details for this entry.</p></div><div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
        <div className="flex bg-slate-100 p-1 rounded-lg">
             <button onClick={() => setType('ISSUE')} className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1 transition-all ${type === 'ISSUE' ? 'bg-white shadow text-red-600' : 'text-slate-500 hover:text-slate-700'}`}><AlertTriangle size={12}/> Issue / Defect</button>
             <button onClick={() => setType('IDEA')} className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1 transition-all ${type === 'IDEA' ? 'bg-white shadow text-sky-600' : 'text-slate-500 hover:text-slate-700'}`}><Lightbulb size={12}/> Idea / Feature</button>
        </div>
        <div><label className="text-sm font-medium text-slate-700 mb-2 block">Quick Tags</label><div className="flex flex-wrap gap-2">{availableTags.map((tag, i) => (<button key={i} onClick={() => setReasonText(tag.en)} className="flex items-center gap-1.5 bg-slate-100 text-slate-600 px-3 py-1.5 text-xs rounded-full hover:bg-intenza-100 hover:text-intenza-700"><Tag size={12}/>{language === 'en' ? tag.en : tag.zh}</button>))}{availableTags.length === 0 && <span className="text-xs text-slate-400 italic">No tags available.</span>}</div></div><div><label className="text-sm font-medium text-slate-700 mb-1 block">Description</label><textarea value={reasonText} onChange={(e) => setReasonText(e.target.value)} rows={4} className="w-full p-2 border border-slate-200 rounded-lg text-slate-900 bg-slate-50" placeholder="Describe..."/></div><div><label className="block text-sm font-medium text-slate-700 mb-2">Attachments</label><div onClick={() => !isUploading && fileInputRef.current?.click()} className="relative h-20 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:border-intenza-400 hover:bg-intenza-50">
          <div className="flex items-center gap-2 text-slate-500">
            {isUploading ? <Loader2 className="animate-spin" size={14}/> : <Upload size={14} />} 
            <span className="text-xs">{isUploading ? 'Uploading...' : 'Upload images/videos'}</span>
          </div>
          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />
        </div>{attachments.length > 0 && <div className="grid grid-cols-4 gap-2 mt-2">{attachments.map((url, i) => <div key={i} className="relative h-16 bg-slate-100 rounded overflow-hidden">
        {isVideo(url) ? <video src={url} className="w-full h-full object-cover"/> : <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/50x50?text=X'; }} />}
        {isVideo(url) && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><PlayCircle size={16} className="text-white/80"/></div>}
        <button onClick={() => setAttachments(p => p.filter((_ , idx) => idx !== i))} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-full z-10"><X size={10}/></button></div>)}</div>}</div></div><div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3"><button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg">Cancel</button><button onClick={() => onSet({en: reasonText, zh: reasonText}, true, attachments, type)} disabled={!reasonText.trim() || isUploading} className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 disabled:bg-slate-400">Save</button></div></div></div>)
}

const StatusDecisionModal: React.FC<{ isOpen: boolean, onClose: () => void, context: any, onSetStatus: (s: NgDecisionStatus) => void, onLinkEco: (id: string) => void, onCreateEco: () => void, activeEcos: DesignChange[] }> = ({ isOpen, onClose, context, onSetStatus, onLinkEco, onCreateEco, activeEcos }) => {
    const [selectedEco, setSelectedEco] = useState('');
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up p-6">
                 <h3 className="text-lg font-bold text-slate-900 mb-4">Set Status Decision</h3>
                 <div className="space-y-2">
                     <button onClick={() => onSetStatus(NgDecisionStatus.PENDING)} className={`w-full p-3 rounded-lg text-left font-medium transition-all ${context.currentStatus === NgDecisionStatus.PENDING ? 'bg-slate-100 border border-slate-300' : 'bg-white border border-slate-200 hover:bg-slate-50'}`}>Pending Review</button>
                     <button onClick={() => onSetStatus(NgDecisionStatus.DISCUSSION)} className={`w-full p-3 rounded-lg text-left font-medium transition-all ${context.currentStatus === NgDecisionStatus.DISCUSSION ? 'bg-purple-100 border border-purple-300 text-purple-700' : 'bg-white border border-slate-200 hover:bg-purple-50 text-purple-600'}`}>Under Discussion</button>
                     <button onClick={() => onSetStatus(NgDecisionStatus.IGNORED)} className={`w-full p-3 rounded-lg text-left font-medium transition-all ${context.currentStatus === NgDecisionStatus.IGNORED ? 'bg-zinc-100 border border-zinc-300 text-zinc-600' : 'bg-white border border-slate-200 hover:bg-zinc-50 text-zinc-500'}`}>Ignore / Not an Issue</button>
                 </div>
                 <div className="my-4 border-t border-slate-100 pt-4">
                     <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Needs Improvement / Action</h4>
                     <button onClick={onCreateEco} className="w-full p-3 rounded-lg bg-intenza-600 text-white font-bold hover:bg-intenza-700 mb-2 flex items-center justify-center gap-2"><Plus size={16}/> Create New ECO</button>
                     <div className="mt-2">
                         <label className="text-xs text-slate-500 mb-1 block">Or Link Existing ECO:</label>
                         <div className="flex gap-2">
                             <select value={selectedEco} onChange={e => setSelectedEco(e.target.value)} className="flex-1 text-sm border border-slate-200 rounded-lg px-2 bg-slate-50">
                                 <option value="">Select ECO...</option>
                                 {activeEcos.map(e => <option key={e.id} value={e.id}>{e.ecoNumber}</option>)}
                             </select>
                             <button onClick={() => selectedEco && onLinkEco(selectedEco)} disabled={!selectedEco} className="px-3 py-2 bg-slate-200 rounded-lg text-slate-700 font-bold text-xs disabled:opacity-50">Link</button>
                         </div>
                     </div>
                 </div>
                 <button onClick={onClose} className="w-full py-2 text-slate-400 hover:text-slate-600">Cancel</button>
             </div>
        </div>
    );
};

const FeedbackModal: React.FC<{ isOpen: boolean, onClose: () => void, onSave: (data: Omit<ErgoFeedback, 'id' | 'type'>, isNewTag: boolean) => void, feedback: ErgoFeedback | null, product: ProductModel }> = ({ isOpen, onClose, onSave, feedback, product }) => {
    const { language, t } = useContext(LanguageContext);
    const [isUploading, setIsUploading] = useState(false);
    const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], category: 'Experience' as ErgoProjectCategory, source: '', content: '', attachmentUrls: [] as string[] });
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if (isOpen) { if (feedback) { setFormData({ date: feedback.date, category: feedback.category, source: feedback.source, content: t(feedback.content), attachmentUrls: feedback.attachmentUrls || [] }); } else { setFormData({ date: new Date().toISOString().split('T')[0], category: 'Experience' as ErgoProjectCategory, source: '', content: '', attachmentUrls: [] }); } } }, [isOpen, feedback, t]);
    const handleSaveWithTag = (isNewTag: boolean, selectedContent?: LocalizedString) => { const contentToSave = selectedContent || { en: formData.content, zh: formData.content }; onSave({ date: formData.date, category: formData.category, source: formData.source, content: contentToSave, attachmentUrls: formData.attachmentUrls }, isNewTag); };
    
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files) as File[];
            setIsUploading(true);
            try {
              const newUrls: string[] = [];
              for (const file of files) {
                  const url = await api.uploadImage(file);
                  newUrls.push(url);
              }
              setFormData(prev => ({ ...prev, attachmentUrls: [...prev.attachmentUrls, ...newUrls] }));
            } catch (err) {
              console.error(err);
              alert("上傳失敗");
            } finally {
              setIsUploading(false);
            }
        }
    }

    if (!isOpen) return null;
    const availableTags = product.uniqueFeedbackTags?.[formData.category] || [];
    return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-slide-up max-h-[90vh] flex flex-col"><div className="p-6 border-b border-slate-100 flex justify-between items-center"><h2 className="text-xl font-bold text-slate-900">{feedback ? 'Edit' : 'Add'} Customer Feedback</h2><button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><X size={20} /></button></div><div className="p-6 space-y-4 overflow-y-auto"><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-slate-700 mb-1">Date</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900" /></div><div><label className="block text-sm font-medium text-slate-700 mb-1">Source</label><input type="text" placeholder="e.g. Equinox Member" value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900" /></div></div><div><label className="block text-sm font-medium text-slate-700 mb-1">Category</label><select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as ErgoProjectCategory})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">{(['Strength Curve', 'Experience', 'Stroke', 'Other Suggestion'] as ErgoProjectCategory[]).map(c => <option key={c} value={c}>{language === 'en' ? c : { 'Strength Curve': '力量曲線', 'Experience': '體驗', 'Stroke': '行程', 'Other Suggestion': '其他建議' }[c]}</option>)}</select></div><div><label className="text-sm font-medium text-slate-700 mb-2 block">Select Existing Feedback (Tag)</label><div className="flex flex-wrap gap-2">{availableTags.map((tag, i) => (<button key={i} onClick={() => handleSaveWithTag(false, tag)} className="flex items-center gap-1.5 bg-slate-100 text-slate-600 px-3 py-1.5 text-xs rounded-full hover:bg-intenza-100 hover:text-intenza-700"><Tag size={12}/>{t(tag)}</button>))}{availableTags.length === 0 && <span className="text-xs text-slate-400 italic">No existing tags for this category.</span>}</div></div><div className="flex items-center gap-4"><div className="flex-1 h-px bg-slate-200"></div><span className="text-xs text-slate-400">OR</span><div className="flex-1 h-px bg-slate-200"></div></div><div><label className="block text-sm font-medium text-slate-700 mb-1">Add New Feedback</label><textarea value={formData.content} onChange={(e) => setFormData({...formData, content: e.target.value})} rows={3} className="w-full p-2 border border-slate-200 rounded-lg text-slate-900 bg-slate-50" placeholder="Describe the customer's feedback..."/></div>
    <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Attachments</label>
        <div onClick={() => !isUploading && fileInputRef.current?.click()} className="relative h-20 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:border-intenza-400 hover:bg-intenza-50">
          <div className="flex items-center gap-2 text-slate-500">
            {isUploading ? <Loader2 className="animate-spin" size={14}/> : <Upload size={14} />} 
            <span className="text-xs">{isUploading ? 'Uploading...' : 'Upload images/videos'}</span>
          </div>
          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />
        </div>
        {formData.attachmentUrls.length > 0 && <div className="grid grid-cols-4 gap-2 mt-2">{formData.attachmentUrls.map((url, i) => <div key={i} className="relative h-16 bg-slate-100 rounded overflow-hidden">
            {isVideo(url) ? <video src={url} className="w-full h-full object-cover"/> : <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100x100?text=Error'; }} />}
            <button onClick={() => setFormData(p => ({...p, attachmentUrls: p.attachmentUrls.filter((_ , idx) => idx !== i)}))} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-full z-10"><X size={10}/></button>
        </div>)}</div>}
    </div>
    </div><div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3"><button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg">Cancel</button><button onClick={() => handleSaveWithTag(true)} disabled={isUploading} className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 disabled:bg-slate-300">Save New Feedback</button></div></div></div>)
}

const CustomerFeedbackCard: React.FC<{ feedback: ErgoFeedback, category: ErgoProjectCategory, onStatusClick: () => void, onEdit: () => void, onDelete: () => void }> = ({ feedback, category, onStatusClick, onEdit, onDelete }) => {
    const { t } = useContext(LanguageContext);
    const getStatusStyle = (status?: string) => { switch(status) { case 'DISCUSSION': return 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200'; case 'IGNORED': return 'bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200'; default: return 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'; } };
    const getStatusLabel = (status?: string) => { switch(status) { case 'DISCUSSION': return 'Under Discussion'; case 'IGNORED': return 'Ignored'; default: return 'Pending Review'; } }
    const theme = categoryStyles[category];
    return (
        <div className={`group relative rounded-xl shadow-sm border p-4 transition-all hover:shadow-md ${theme.bg} ${theme.border}`}>
             <div className="flex items-start justify-between mb-3"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-500 border border-slate-100 shadow-sm"><User size={16} /></div><div><p className="text-sm font-bold text-slate-800 leading-none mb-1">{feedback.source}</p><p className="text-[10px] text-slate-500 flex items-center gap-1 font-mono uppercase tracking-wide"><Calendar size={10}/> {feedback.date}</p></div></div></div>
             <div className="mb-4">
                 <p className={`text-sm leading-relaxed p-3 rounded-lg border bg-white/60 mb-2 ${theme.border} ${theme.text}`}>{t(feedback.content)}</p>
                 {feedback.attachmentUrls && feedback.attachmentUrls.length > 0 && <div className="flex gap-1 flex-wrap">
                     {feedback.attachmentUrls.map((url, i) => (
                         <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block relative h-10 w-10 rounded overflow-hidden border border-slate-200">
                             {isVideo(url) ? <video src={url} className="w-full h-full object-cover"/> : <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100x100?text=Error'; }} />}
                             {isVideo(url) && <div className="absolute inset-0 flex items-center justify-center bg-black/20"><PlayCircle size={12} className="text-white"/></div>}
                         </a>
                     ))}
                 </div>}
             </div>
             <div className={`flex items-center justify-between mt-2 pt-2 border-t border-slate-200/50`}><button onClick={onStatusClick} className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all flex items-center gap-1 ${getStatusStyle(feedback.status)}`}>{getStatusLabel(feedback.status)} <ChevronDown size={10}/></button></div>
             <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={onEdit} title="Edit" className="p-1.5 bg-white border border-slate-100 shadow-sm rounded-lg text-slate-400 hover:text-blue-500 hover:border-blue-100 transition-colors"><Pencil size={14}/></button><button onClick={onDelete} title="Delete" className="p-1.5 bg-white border border-slate-100 shadow-sm rounded-lg text-slate-400 hover:text-red-500 hover:border-red-100 transition-colors"><Trash2 size={14}/></button></div>
        </div>
    )
}

const FeedbackStatusDecisionModal: React.FC<{ isOpen: boolean, onClose: () => void, feedback: ErgoFeedback, onUpdateStatus: (id: string, status: 'PENDING' | 'DISCUSSION' | 'IGNORED') => void }> = ({ isOpen, onClose, feedback, onUpdateStatus }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up p-6">
                 <h3 className="text-lg font-bold text-slate-900 mb-4">Set Feedback Status</h3>
                 <div className="space-y-2">
                     <button onClick={() => onUpdateStatus(feedback.id, 'PENDING')} className={`w-full p-3 rounded-lg text-left font-medium transition-all ${feedback.status === 'PENDING' || !feedback.status ? 'bg-slate-100 border border-slate-300' : 'bg-white border border-slate-200 hover:bg-slate-50'}`}>Pending Review</button>
                     <button onClick={() => onUpdateStatus(feedback.id, 'DISCUSSION')} className={`w-full p-3 rounded-lg text-left font-medium transition-all ${feedback.status === 'DISCUSSION' ? 'bg-purple-100 border border-purple-300 text-purple-700' : 'bg-white border border-slate-200 hover:bg-purple-50 text-purple-600'}`}>Under Discussion</button>
                     <button onClick={() => onUpdateStatus(feedback.id, 'IGNORED')} className={`w-full p-3 rounded-lg text-left font-medium transition-all ${feedback.status === 'IGNORED' ? 'bg-zinc-100 border border-zinc-300 text-zinc-600' : 'bg-white border border-slate-200 hover:bg-zinc-50 text-zinc-500'}`}>Ignore / Duplicate</button>
                 </div>
                 <button onClick={onClose} className="w-full mt-4 py-2 text-slate-400 hover:text-slate-600">Cancel</button>
             </div>
        </div>
    );
};
