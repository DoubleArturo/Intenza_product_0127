
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
      let newCurrentVersion = product.currentVersion;

      // If the ECO is marked as IN_PRODUCTION, update the product's current version
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

      await onUpdateProduct({ 
        ...product, 
        designHistory: updatedDesignHistory,
        currentVersion: newCurrentVersion 
      });
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
          ))}</div>)}<div className="bg-slate-50 rounded-xl p-4 border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 transition-colors group-hover:border-slate-200"><div><div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2"><Layers size={14} /> Affected Batches</div><div className="flex flex-wrap gap-2">{change.affectedBatches.map((b) => (<span key={b} className="text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded-md text-slate-700 font-mono shadow-sm">{b}</span>))}</div></div><div><div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2"><Users size={14} /> Impacted Customers</div><p className="text-sm text-slate-600 leading-relaxed">{change.affectedCustomers.join(', ')}</p></div></div>{change.sourceFeedbacks && change.sourceFeedbacks.length > 0 && (
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

// Ergonomics Section - Fixed missing component
const ErgoSection = ({ product, testers, onUpdateProduct, highlightedFeedback }: any) => {
  const { t, language } = useContext(LanguageContext);
  return (
    <div className="animate-fade-in space-y-10">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Ergonomics & Human Factors</h2>
      </div>

      <div className="space-y-6">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <ClipboardList size={16}/> Evaluation Projects ({product.ergoProjects.length})
        </h3>
        {product.ergoProjects.map((project: ErgoProject) => (
           <ProjectCard key={project.id} project={project} testers={testers} />
        ))}
        {product.ergoProjects.length === 0 && (
          <div className="py-12 bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
            <UserCheck size={32} className="opacity-20 mb-2" />
            <p className="text-sm font-medium">No ergonomics projects initiated.</p>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <MessageSquare size={16}/> Customer Feedback ({product.customerFeedback.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {product.customerFeedback.map((feedback: ErgoFeedback) => (
             <CustomerFeedbackCard key={feedback.id} feedback={feedback} />
          ))}
        </div>
        {product.customerFeedback.length === 0 && (
          <div className="py-12 bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
            <StickyNote size={32} className="opacity-20 mb-2" />
            <p className="text-sm font-medium">No customer feedback recorded.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Durability Section Component - Fixed missing component
const LifeSection = ({ product, onAddTest, onEditTest, onDeleteTest }: any) => {
  const { t } = useContext(LanguageContext);
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">Durability & Life Cycle</h2>
        <button onClick={onAddTest} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors">
          <Plus size={16} /> Add Test Result
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {product.durabilityTests.map((test: TestResult) => (
          <div key={test.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group relative">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[10px] font-bold text-intenza-600 uppercase tracking-widest bg-intenza-50 px-2 py-0.5 rounded border border-intenza-100">{test.category}</span>
                <h4 className="font-bold text-slate-800 mt-2">{t(test.testName)}</h4>
              </div>
              <div className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                test.status === TestStatus.PASS ? 'bg-green-100 text-green-800 border-green-200' :
                test.status === TestStatus.FAIL ? 'bg-red-100 text-red-800 border-red-200' :
                'bg-slate-100 text-slate-600 border-slate-200'
              }`}>{test.status}</div>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Progress</span>
              <span className="text-sm font-bold text-slate-900">{test.score}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
              <div className="h-full bg-intenza-500 transition-all duration-1000" style={{ width: `${test.score}%` }}></div>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-slate-400 font-medium">
              <div className="flex items-center gap-1"><Clock size={12}/> {test.updatedDate}</div>
            </div>
            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onEditTest(test)} className="p-1.5 bg-slate-50 rounded-lg text-slate-400 hover:text-slate-900 border border-slate-100"><Pencil size={14}/></button>
              <button onClick={() => onDeleteTest(test.id)} className="p-1.5 bg-red-50 rounded-lg text-red-400 hover:text-red-600 border border-red-100"><Trash2 size={14}/></button>
            </div>
          </div>
        ))}
        {product.durabilityTests.length === 0 && (
          <div className="col-span-full py-12 bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
            <Activity size={32} className="opacity-20 mb-2" />
            <p className="text-sm font-medium">No durability tests recorded.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Project Card Component - Fixed missing component
const ProjectCard = ({ project, testers }: { project: ErgoProject, testers: Tester[] }) => {
    const { t } = useContext(LanguageContext);
    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <h4 className="text-lg font-bold text-slate-900">{t(project.name)}</h4>
                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                    project.overallStatus === ProjectOverallStatus.PASS ? 'bg-green-100 text-green-800' :
                    project.overallStatus === ProjectOverallStatus.NG ? 'bg-red-100 text-red-800' :
                    'bg-slate-100 text-slate-600'
                }`}>{project.overallStatus}</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {project.testerIds.map(tid => {
                    const tester = testers.find(ts => ts.id === tid);
                    return tester ? (
                        <div key={tid} className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                            <img src={tester.imageUrl} className="w-5 h-5 rounded-full object-cover" alt="" />
                            <span className="text-xs font-medium text-slate-600">{tester.name}</span>
                        </div>
                    ) : null;
                })}
            </div>
        </div>
    );
};

// Customer Feedback Card Component - Fixed missing component
const CustomerFeedbackCard = ({ feedback }: { feedback: ErgoFeedback }) => {
    const { t } = useContext(LanguageContext);
    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase">{feedback.category}</span>
                <span className="text-[10px] font-mono text-slate-400">{feedback.date}</span>
            </div>
            <p className="text-sm text-slate-700 mb-4">{t(feedback.content)}</p>
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">Source: {feedback.source}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    feedback.status === 'PENDING' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'
                }`}>{feedback.status}</span>
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
  const [error, setError] = useState('');
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

  const handleSave = () => {
    // If status is IN_PRODUCTION, implementation date is mandatory
    if (formData.status === EcoStatus.IN_PRODUCTION && !formData.implementationDate) {
        setError(language === 'zh' ? '導入量產時必須填寫出貨日期' : 'Implementation date is required for In Production status');
        return;
    }
    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
       <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
             <h2 className="text-xl font-bold">{eco ? 'Edit ECO' : 'Add New ECO'}</h2>
             <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={20}/></button>
          </div>
          <div className="p-6 overflow-y-auto space-y-6">
             {error && (
                 <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-lg flex items-center gap-2">
                     <AlertCircle size={14}/> {error}
                 </div>
             )}
             <div className="grid grid-cols-2 gap-6">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">ECO Number</label><input type="text" value={formData.ecoNumber} onChange={e => setFormData({...formData, ecoNumber: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm font-mono" /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm" /></div>
             </div>
             <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Version (Custom)</label>
                  <input 
                    type="text" 
                    value={formData.version} 
                    onChange={e => setFormData({...formData, version: e.target.value})} 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm font-bold"
                    placeholder="e.g. v2.5"
                  />
                </div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                   <select value={formData.status} onChange={e => {
                       const newStatus = e.target.value as EcoStatus;
                       setFormData({...formData, status: newStatus});
                   }} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm font-bold">
                      {Object.values(EcoStatus).map(s => <option key={s} value={s}>{language === 'zh' ? ecoStatusTranslations[s] : s}</option>)}
                   </select>
                </div>
             </div>
             {formData.status === EcoStatus.IN_PRODUCTION && (
                 <div className="animate-fade-in">
                    <label className="block text-xs font-bold text-intenza-600 uppercase mb-1 flex items-center gap-1">
                        <Calendar size={14} /> Implementation / Ship Date (Required)
                    </label>
                    <input 
                        type="date" 
                        value={formData.implementationDate} 
                        onChange={e => setFormData({...formData, implementationDate: e.target.value})} 
                        className="w-full px-4 py-2 bg-intenza-50/50 border border-intenza-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm font-bold" 
                    />
                 </div>
             )}
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
             <button onClick={handleSave} className="px-5 py-2 bg-slate-900 text-white font-bold rounded-lg shadow-lg">Save ECO</button>
          </div>
       </div>
    </div>
  )
}

// Durability Test Modal - Fixed missing component
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
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <h2 className="text-xl font-bold">{test ? 'Edit Test' : 'Add Test Result'}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={20}/></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Test Name</label>
            <input type="text" value={formData.testName[language]} onChange={e => setFormData({...formData, testName: {...formData.testName, [language]: e.target.value}})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
            <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Score (%)</label>
              <input type="number" value={formData.score} onChange={e => setFormData({...formData, score: Number(e.target.value)})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
              <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as TestStatus})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm font-bold">
                {Object.values(TestStatus).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Details</label>
            <textarea value={formData.details[language]} onChange={e => setFormData({...formData, details: {...formData.details, [language]: e.target.value}})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20 text-sm resize-none" rows={3} />
          </div>
        </div>
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 sticky bottom-0">
          <button onClick={onClose} className="px-5 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg">Cancel</button>
          <button onClick={() => onSave(formData)} className="px-5 py-2 bg-slate-900 text-white font-bold rounded-lg shadow-lg">Save Test</button>
        </div>
      </div>
    </div>
  );
};
