
import React, { useState, useMemo, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, GitCommit, UserCheck, Activity, AlertTriangle, CheckCircle, Clock, Calendar, Layers, Users, Plus, X, Pencil, Trash2, Upload, MessageSquare, ChevronsRight, ChevronsLeft, Tag, FileText, User, Database, Mars, Venus, Link as LinkIcon, Search, ClipboardList, ListPlus, Check, ChevronDown, RefreshCw, HelpCircle, BarChart3, AlertCircle, PlayCircle, Loader2, StickyNote, Lightbulb, Paperclip, Video, Image as ImageIcon, Save, Star, Info, Truck } from 'lucide-react';
import { ProductModel, TestStatus, DesignChange, LocalizedString, TestResult, EcoStatus, ErgoFeedback, ErgoProject, Tester, ErgoProjectCategory, NgReason, ProjectOverallStatus, Gender, NgDecisionStatus, EvaluationTask } from '../types';
import GeminiInsight from '../components/GeminiInsight';
import { LanguageContext } from '../App';
import { api } from '../services/api';

// Helper to determine if a URL is a video
const isVideo = (url: string) => {
    if (!url) return false;
    return url.startsWith('data:video') || url.match(/\.(mp4|webm|ogg)$/i);
};

// Define the interface for ProductDetail props
interface ProductDetailProps {
  products: ProductModel[];
  testers: Tester[];
  onUpdateProduct: (p: ProductModel) => Promise<void>;
  showAiInsights: boolean;
}

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
                 onAddEco={() => handleOpenEcoModal()} 
                 onEditEco={handleOpenEcoModal} 
                 onDeleteEco={handleDeleteEco} 
                 onDeleteVersion={handleDeleteVersion} 
                 onSetCurrentVersion={handleSetCurrentVersion}
               />
             )}
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
    [NgDecisionStatus.PENDING]: '待審查',
    [NgDecisionStatus.NEEDS_IMPROVEMENT]: '需改進',
    [NgDecisionStatus.DISCUSSION]: '討論中',
    [NgDecisionStatus.IGNORED]: '已忽略',
    [NgDecisionStatus.IDEA]: '點子'
};

const categoryStyles: Record<ErgoProjectCategory, { bg: string, border: string, text: string }> = {
  'Resistance profile': { bg: 'bg-[#eef2ff]', border: 'border-indigo-100', text: 'text-indigo-900' },
  'Experience': { bg: 'bg-[#f0fdfa]', border: 'border-teal-100', text: 'text-teal-900' },
  'Stroke': { bg: 'bg-[#fff7ed]', border: 'border-orange-100', text: 'text-orange-900' },
  'Other Suggestion': { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700' }
};

// Design Section
const DesignSection = ({ product, onAddEco, onEditEco, onDeleteEco, onDeleteVersion, onSetCurrentVersion }: { product: ProductModel, onAddEco: () => void, onEditEco: (eco: DesignChange) => void, onDeleteEco: (id: string) => void, onDeleteVersion: (version: string) => void, onSetCurrentVersion: (version: string) => void }) => {
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

  // Jump to Analytics with Version filter
  const handleTrackShipments = () => {
    // We try to find category/series from existing shipments or default to placeholders
    // This assumes Analytics is set up to receive this state
    navigate('/analytics', { 
        state: { 
            autoDrill: [
                { level: 'SKU', val: product.sku },
                { level: 'VERSION', val: selectedVersion }
            ]
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
                        onClick={handleTrackShipments}
                        className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm flex items-center gap-2 text-xs font-bold"
                        title="查看此版本出貨客戶分佈"
                    >
                        <Users size={16} /> {t({en: 'Track Customers', zh: '查看出貨分佈'})}
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

// ErgoSection Component
const ErgoSection = ({ product, testers, onUpdateProduct, highlightedFeedback }: { product: ProductModel, testers: Tester[], onUpdateProduct: (p: ProductModel) => Promise<void>, highlightedFeedback: any }) => {
  const { t } = useContext(LanguageContext);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
      <h2 className="text-xl font-bold text-slate-900 mb-6">Human Factors & Ergonomics Evaluation</h2>
      <p className="text-slate-500">Ergonomics projects and tester feedback summary.</p>
      <div className="mt-6 space-y-4">
        {product.ergoProjects.map(project => (
          <div key={project.id} className="p-4 border rounded-xl">
            <h3 className="font-bold">{t(project.name)}</h3>
            <span className="text-xs text-slate-400">{project.date}</span>
          </div>
        ))}
        {product.ergoProjects.length === 0 && (
          <div className="text-center py-10 text-slate-400 italic">No ergonomics projects recorded yet.</div>
        )}
      </div>
    </div>
  );
};

// LifeSection Component
const LifeSection = ({ product, onAddTest, onEditTest, onDeleteTest }: { product: ProductModel, onAddTest: () => void, onEditTest: (t: TestResult) => void, onDeleteTest: (id: string) => void }) => {
  const { t } = useContext(LanguageContext);
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">Durability & Life Testing</h2>
        <button onClick={onAddTest} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors">
          <Plus size={16} /> Add Test Result
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {product.durabilityTests.map(test => (
          <div key={test.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800">{t(test.testName)}</h3>
              <p className="text-sm text-slate-500">{t(test.details)}</p>
              <div className="flex gap-2 mt-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${test.status === TestStatus.PASS ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{test.status}</span>
                <span className="text-[10px] text-slate-400 font-medium">Score: {test.score}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onEditTest(test)} className="p-2 text-slate-400 hover:text-slate-600"><Pencil size={16}/></button>
              <button onClick={() => onDeleteTest(test.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
            </div>
          </div>
        ))}
        {product.durabilityTests.length === 0 && (
          <div className="bg-white py-12 text-center rounded-2xl border border-dashed border-slate-200 text-slate-400">
            No durability tests recorded.
          </div>
        )}
      </div>
    </div>
  );
};

// Updated EcoModal
const EcoModal = ({ isOpen, onClose, onSave, eco, productVersions, product }: any) => {
    const { t } = useContext(LanguageContext);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        ecrNumber: eco?.ecrNumber || '',
        ecrDate: eco?.ecrDate || '',
        ecoNumber: eco?.ecoNumber || '',
        date: eco?.date || new Date().toISOString().split('T')[0],
        version: eco?.version || product.currentVersion,
        description: eco ? t(eco.description) : '',
        status: eco?.status || EcoStatus.EVALUATING,
        imageUrls: eco?.imageUrls || [],
        implementationDate: eco?.implementationDate || ''
    });

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        setIsUploading(true);
        try {
            const newUrls = [...formData.imageUrls];
            for (let i = 0; i < files.length; i++) {
                const url = await api.uploadImage(files[i]);
                newUrls.push(url);
            }
            setFormData(prev => ({ ...prev, imageUrls: newUrls }));
        } catch (err) {
            alert("圖片上傳失敗");
        } finally {
            setIsUploading(false);
        }
    };

    const removeImage = (url: string) => {
        setFormData(prev => ({ ...prev, imageUrls: prev.imageUrls.filter((u: string) => u !== url) }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...formData,
            description: { en: formData.description, zh: formData.description },
            affectedBatches: [],
            affectedCustomers: []
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl animate-slide-up overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <h2 className="text-xl font-bold">{eco ? 'Edit ECO Record' : 'Add New ECO'}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Target Version</label>
                            <input 
                                list="version-suggestions"
                                required 
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-intenza-500/20" 
                                value={formData.version} 
                                onChange={e => setFormData({...formData, version: e.target.value})} 
                                placeholder="e.g. v2.5"
                            />
                            <datalist id="version-suggestions">
                                {productVersions.map((v: string) => <option key={v} value={v} />)}
                            </datalist>
                        </div>
                        <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Status</label><select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-intenza-500/20" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as EcoStatus})}>{Object.values(EcoStatus).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ECR Information (Engineering Change Request)</div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">ECR Number</label>
                            <input className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/20" value={formData.ecrNumber} onChange={e => setFormData({...formData, ecrNumber: e.target.value})} placeholder="ECR-202X-XXX" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Initiation Date (啟動時間)</label>
                            <input type="date" className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/20" value={formData.ecrDate} onChange={e => setFormData({...formData, ecrDate: e.target.value})} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 p-4 bg-indigo-50/30 rounded-xl border border-indigo-100/50">
                        <div className="col-span-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">ECO Information (Engineering Change Order)</div>
                        <div>
                            <label className="block text-[10px] font-bold text-indigo-500 uppercase mb-1">ECO Number</label>
                            <input className="w-full px-4 py-2 bg-white border border-indigo-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.ecoNumber} onChange={e => setFormData({...formData, ecoNumber: e.target.value})} placeholder="ECO-202X-XXX" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-indigo-500 uppercase mb-1">Completion Date (ECO Date)</label>
                            <input type="date" className="w-full px-4 py-2 bg-white border border-indigo-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                        </div>
                    </div>

                    <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Description</label><textarea required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-intenza-500/20" rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-3">Supporting Documentation / Images</label>
                        <div className="flex flex-wrap gap-3 mb-4">
                            {formData.imageUrls.map((url: string, i: number) => (
                                <div key={i} className="relative w-20 h-20 rounded-xl border border-slate-200 overflow-hidden group">
                                    <img src={url} className="w-full h-full object-cover" />
                                    <button 
                                        type="button" 
                                        onClick={() => removeImage(url)} 
                                        className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            <button 
                                type="button" 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-intenza-400 hover:text-intenza-600 transition-all bg-slate-50"
                            >
                                {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                                <span className="text-[10px] font-bold mt-1">Upload</span>
                            </button>
                            <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleUpload} />
                        </div>
                    </div>

                    {formData.status === EcoStatus.IN_PRODUCTION && (
                        <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Implementation Date</label><input type="date" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-intenza-500/20" value={formData.implementationDate} onChange={e => setFormData({...formData, implementationDate: e.target.value})} /></div>
                    )}
                    <div className="flex gap-4 pt-4 border-t border-slate-100">
                        <button type="button" onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
                        <button type="submit" disabled={isUploading} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 disabled:opacity-50">Save Record</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// TestModal Component
const TestModal = ({ isOpen, onClose, onSave, test }: { isOpen: boolean, onClose: () => void, onSave: (data: any) => Promise<void>, test: TestResult | null }) => {
  const { t } = useContext(LanguageContext);
  const [formData, setFormData] = useState({
    testName: test ? t(test.testName) : '',
    details: test ? t(test.details) : '',
    status: test ? test.status : TestStatus.PENDING,
    score: test ? test.score : 0,
    category: test ? test.category : 'General'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      testName: { en: formData.testName, zh: formData.testName },
      details: { en: formData.details, zh: formData.details }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg animate-slide-up overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold">{test ? 'Edit Test Result' : 'Add Test Result'}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Test Name</label>
            <input required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg" value={formData.testName} onChange={e => setFormData({...formData, testName: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Status</label>
            <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as TestStatus})}>
              {Object.values(TestStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Details</label>
            <textarea className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg resize-none" rows={3} value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} />
          </div>
          <div className="flex gap-4 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
            <button type="submit" className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg">Save Result</button>
          </div>
        </form>
      </div>
    </div>
  );
};
