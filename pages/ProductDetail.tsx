
import React, { useState, useMemo, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, GitCommit, UserCheck, Activity, AlertTriangle, CheckCircle, Clock, Calendar, Layers, Users, Plus, X, Pencil, Trash2, Upload, MessageSquare, ChevronsRight, ChevronsLeft, Tag, FileText, User, Database, Mars, Venus, Link as LinkIcon, Search, ClipboardList, ListPlus, Check, ChevronDown, RefreshCw, HelpCircle, BarChart3, AlertCircle, PlayCircle, Loader2, StickyNote, Lightbulb, Paperclip, Video, Image as ImageIcon, Save, Star, Info } from 'lucide-react';
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

      // Ensure that if this ECO marks a version as production, the master currentVersion is updated
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

// Fix for missing ProjectCard component
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
                        <div className="flex items-center justify-between border-l-4 border-indigo-500 pl-3">
                            <h4 className="font-bold text-sm text-slate-800 uppercase tracking-tight">{language === 'en' ? cat : categoryTranslations[cat]}</h4>
                            <button onClick={() => onOpenAddTask(project.id, cat)} className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 hover:underline"><Plus size={10}/> Add Task</button>
                        </div>
                        
                        <div className="space-y-3 pl-4">
                            {project.tasks[cat]?.map((task: any) => (
                                <div key={task.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100 group/task">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <h5 className="font-bold text-slate-700 text-sm">{t(task.name)}</h5>
                                            <button onClick={() => onEditTaskName(project.id, cat, task.id, t(task.name))} className="opacity-0 group-hover/task:opacity-100 p-1 text-slate-400 hover:text-slate-600 transition-opacity"><Pencil size={12}/></button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => onOpenTaskResults(cat, task.id)} className="text-[10px] font-bold bg-white border border-slate-200 text-slate-600 px-3 py-1 rounded-lg hover:border-slate-400 transition-all">Set Pass/NG</button>
                                            <button onClick={() => { if(window.confirm('Delete task?')) onDeleteTask(project.id, cat, task.id); }} className="opacity-0 group-hover/task:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-opacity"><Trash2 size={12}/></button>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {project.testerIds.map((tid: string) => {
                                            const tester = testers.find((ts: any) => ts.id === tid);
                                            const isPass = task.passTesterIds.includes(tid);
                                            const ngReason = task.ngReasons.find((r: any) => r.testerId === tid);
                                            const isHighlighted = highlightedFeedback?.projectId === project.id && highlightedFeedback?.taskId === task.id && highlightedFeedback?.testerId === tid;
                                            
                                            return (
                                                <div 
                                                    key={tid} 
                                                    data-feedback-id={`${project.id}-${task.id}-${tid}`}
                                                    className={`p-3 rounded-xl border transition-all ${
                                                        isPass ? 'bg-white border-slate-100 opacity-60' : 
                                                        isHighlighted ? 'bg-indigo-50 border-indigo-400 shadow-md ring-2 ring-indigo-500/10' :
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
                                                            <p className="text-[10px] text-slate-600 line-clamp-2 min-h-[1.5rem] italic">"{ngReason?.reason ? t(ngReason.reason) : 'No description provided'}"</p>
                                                            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                                                <button 
                                                                    onClick={() => onEditNgReason(cat, task.id, tid)}
                                                                    className="text-[9px] font-bold text-indigo-600 hover:underline"
                                                                >
                                                                    Edit Reason
                                                                </button>
                                                                <button 
                                                                    onClick={() => onStatusClick(project.id, cat, task.id, tid, ngReason?.decisionStatus || NgDecisionStatus.PENDING, ngReason?.linkedEcoId)}
                                                                    className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase border transition-colors ${ngDecisionStyles[ngReason?.decisionStatus || NgDecisionStatus.PENDING]}`}
                                                                >
                                                                    {ngDecisionTranslations[ngReason?.decisionStatus || NgDecisionStatus.PENDING]}
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
                            {project.tasks[cat].length === 0 && <div className="text-center py-4 text-[11px] text-slate-400 italic">No tasks added to this category.</div>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Fix for missing CustomerFeedbackCard component
const CustomerFeedbackCard = ({ feedback, onStatusClick, onEdit, onDelete }: any) => {
    const { t } = useContext(LanguageContext);
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm group hover:border-slate-300 transition-all">
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
                        feedback.status === 'PENDING' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                        feedback.status === 'DISCUSSION' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                        'bg-zinc-50 text-zinc-500 border-zinc-200'
                    }`}
                >
                    {feedback.status || 'PENDING'}
                </button>
            </div>
        </div>
    );
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
                <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                    {selectedVersion}
                    <span className={`text-xs font-normal text-white px-2 py-1 rounded-md uppercase tracking-wider ${selectedVersion === product.currentVersion ? 'bg-slate-900' : 'bg-slate-400'}`}>
                    {selectedVersion === product.currentVersion ? 'Current Production' : 'Archived Version'}
                    </span>
                </h3>
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
                              {/* SMART DISPLAY: ECO PRIORITY OVER ECR */}
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
                           {/* Updated Info Block: Only showing affected customers/batches if they exist, but fields are removed from modal */}
                           {(change.affectedBatches.length > 0 || change.affectedCustomers.length > 0) && (
                              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 transition-colors group-hover:border-slate-200">
                                 {change.affectedBatches.length > 0 && (
                                   <div>
                                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2"><Layers size={14} /> Affected Batches</div>
                                      <div className="flex flex-wrap gap-2">{change.affectedBatches.map((b) => (<span key={b} className="text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded-md text-slate-700 font-mono shadow-sm">{b}</span>))}</div>
                                   </div>
                                 )}
                                 {change.affectedCustomers.length > 0 && (
                                   <div>
                                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2"><Users size={14} /> Impacted Customers</div>
                                      <p className="text-sm text-slate-600 leading-relaxed">{change.affectedCustomers.join(', ')}</p>
                                   </div>
                                 )}
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

  const categoryTranslations: Record<ErgoProjectCategory, string> = { 'Resistance profile': 'Resistance profile', 'Experience': 'Ergonomic Operation Experience', 'Stroke': 'Exercise Stroke', 'Other Suggestion': 'Other Suggestions' };
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
                    {(['Resistance profile', 'Experience', 'Stroke', 'Other Suggestion'] as ErgoProjectCategory[]).map(cat => (
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
             onSetStatus={(status) => handleSetNgDecision(statusModalState.context!.projectId, statusModalState.context!.category, statusModalState.context!.testerId, status)}
             onLinkEco={(ecoId) => handleLinkExistingEco(statusModalState.context!.projectId, statusModalState.context!.category, statusModalState.context!.taskId, statusModalState.context!.testerId, ecoId)}
             // Fix for taskId and testerId scoping errors
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

// --- Sub-components & Modals ---

// Fix for missing LifeSection component
const LifeSection = ({ product, onAddTest, onEditTest, onDeleteTest }: { product: ProductModel, onAddTest: () => void, onEditTest: (test: TestResult) => void, onDeleteTest: (id: string) => void }) => {
  const { t } = useContext(LanguageContext);
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">Durability & Reliability Tests</h2>
        <button onClick={onAddTest} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors"><Plus size={16} /> Add Test</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {product.durabilityTests.map((test) => (
          <div key={test.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm group relative">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 mb-1 inline-block">{test.category}</span>
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
            <p className="text-xs text-slate-500 line-clamp-2">{t(test.details)}</p>
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEditTest(test)} className="p-1.5 bg-slate-100 rounded-md text-slate-500 hover:text-slate-900 transition-colors"><Pencil size={12} /></button>
                <button onClick={() => onDeleteTest(test.id)} className="p-1.5 bg-red-50 rounded-md text-red-500 hover:text-red-700 transition-colors"><Trash2 size={12} /></button>
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

const EcoModal = ({ isOpen, onClose, onSave, eco, productVersions, product }: any) => {
    const { t } = useContext(LanguageContext);
    const [isUploading, setIsUploading] = useState(false);
    const ecoFileInputRef = useRef<HTMLInputElement>(null);

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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                setIsUploading(true);
                const url = await api.uploadImage(file);
                setFormData(prev => ({ ...prev, imageUrls: [...prev.imageUrls, url] }));
            } catch (err) {
                console.error("Upload failed", err);
                alert("照片上傳失敗");
            } finally {
                setIsUploading(false);
            }
        }
    };

    const removePhoto = (urlToRemove: string) => {
        setFormData(prev => ({ ...prev, imageUrls: prev.imageUrls.filter((u: string) => u !== urlToRemove) }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...formData,
            description: { en: formData.description, zh: formData.description },
            affectedBatches: eco?.affectedBatches || [], // Preserving existing if editing, but removing from form as requested
            affectedCustomers: eco?.affectedCustomers || []
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
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Initiation Date</label>
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
                    
                    {formData.status === EcoStatus.IN_PRODUCTION && (
                        <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Implementation Date</label><input type="date" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-intenza-500/20" value={formData.implementationDate} onChange={e => setFormData({...formData, implementationDate: e.target.value})} /></div>
                    )}

                    {/* Image Upload Integration into EcoModal */}
                    <div className="pt-4 border-t border-slate-50">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Attached References (Images/Videos)</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {formData.imageUrls.map((url: string, idx: number) => (
                                <div key={idx} className="relative w-20 h-20 rounded-lg border border-slate-200 overflow-hidden group">
                                    {isVideo(url) ? (
                                        <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white"><Video size={20}/></div>
                                    ) : (
                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                    )}
                                    <button 
                                        type="button" 
                                        onClick={() => removePhoto(url)} 
                                        className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={20} strokeWidth={3} />
                                    </button>
                                </div>
                            ))}
                            <button 
                                type="button" 
                                onClick={() => ecoFileInputRef.current?.click()}
                                disabled={isUploading}
                                className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all bg-slate-50/50"
                            >
                                {isUploading ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
                                <span className="text-[10px] font-bold mt-1 uppercase">Upload</span>
                            </button>
                        </div>
                        <input ref={ecoFileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />
                    </div>

                    <div className="flex gap-4 pt-4 border-t border-slate-100">
                        <button type="button" onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
                        <button type="submit" className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20">Save Record</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const TEST_NAME_OPTIONS = ['Durability Test', 'Salt Spray Test', 'Packaging Test'];

const TestModal = ({ isOpen, onClose, onSave, test }: any) => {
    const { t } = useContext(LanguageContext);
    const [isUploading, setIsUploading] = useState(false);
    const durabilityFileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        category: test?.category || 'Mechanical',
        testName: test ? t(test.testName) : '',
        version: test?.version || '',
        score: test?.score || 0,
        status: test?.status || TestStatus.PENDING,
        details: test ? t(test.details) : '',
        attachmentUrls: test?.attachmentUrls || [],
        updatedDate: test?.updatedDate || new Date().toISOString().split('T')[0]
    });

    const [testNameType, setTestNameType] = useState<string>(
        test ? (TEST_NAME_OPTIONS.includes(t(test.testName)) ? t(test.testName) : 'Other') : 'Durability Test'
    );

    useEffect(() => {
        if (testNameType !== 'Other') {
            setFormData(prev => ({ ...prev, testName: testNameType }));
        }
    }, [testNameType]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                setIsUploading(true);
                const url = await api.uploadImage(file);
                setFormData(prev => ({
                    ...prev,
                    attachmentUrls: [...prev.attachmentUrls, url]
                }));
            } catch (err) {
                console.error("Upload failed", err);
                alert("照片上傳失敗");
            } finally {
                setIsUploading(false);
            }
        }
    };

    const removePhoto = (urlToRemove: string) => {
        setFormData(prev => ({
            ...prev,
            attachmentUrls: prev.attachmentUrls.filter((u: string) => u !== urlToRemove)
        }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg animate-slide-up">
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <h2 className="text-xl font-bold">{test ? 'Edit Test Result' : 'Add Test Result'}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><X size={20} /></button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); onSave({...formData, testName: {en: formData.testName, zh: formData.testName}, details: {en: formData.details, zh: formData.details}}); }} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Category</label>
                            <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                                <option value="Mechanical">Mechanical</option>
                                <option value="Electrical">Electrical</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Test Version</label>
                            <input className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.version} onChange={e => setFormData({...formData, version: e.target.value})} placeholder="e.g. Prototype v2" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Test Name</label>
                        <div className="space-y-2">
                            <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20" value={testNameType} onChange={e => setTestNameType(e.target.value)}>
                                {TEST_NAME_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                <option value="Other">Other (Custom input)</option>
                            </select>
                            {testNameType === 'Other' && (
                                <input required className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg ring-1 ring-intenza-100 focus:outline-none focus:ring-2 focus:ring-intenza-500/20" value={formData.testName} onChange={e => setFormData({...formData, testName: e.target.value})} placeholder="Enter custom test name" />
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Progress (%)</label><input type="number" min="0" max="100" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.score} onChange={e => setFormData({...formData, score: Number(e.target.value)})} /></div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Status</label>
                            <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as TestStatus})}>
                                {Object.values(TestStatus).filter(s => s !== TestStatus.WARNING).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                    <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Details / Notes</label><textarea className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20" rows={3} value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} /></div>
                    
                    {/* Durability Photo Upload Area */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Test Photos / Reference</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {formData.attachmentUrls.map((url: string, idx: number) => (
                                <div key={idx} className="relative w-16 h-16 rounded-lg border border-slate-200 overflow-hidden group">
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                    <button 
                                        type="button" 
                                        onClick={() => removePhoto(url)} 
                                        className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={16} strokeWidth={3} />
                                    </button>
                                </div>
                            ))}
                            <button 
                                type="button" 
                                onClick={() => durabilityFileInputRef.current?.click()}
                                disabled={isUploading}
                                className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all bg-slate-50/50"
                            >
                                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                <span className="text-[8px] font-bold mt-1 uppercase">Add</span>
                            </button>
                        </div>
                        <input ref={durabilityFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </div>

                    <div className="flex gap-4 pt-4 border-t border-slate-100">
                        <button type="button" onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
                        <button type="submit" className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg shadow-slate-900/10">Save Record</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Missing Modals Implementation ---

const StartEvaluationModal = ({ isOpen, onClose, onStartProject, allTesters, project }: any) => {
    const { t } = useContext(LanguageContext);
    const [name, setName] = useState(project ? t(project.name) : '');
    const [selectedTesterIds, setSelectedTesterIds] = useState<string[]>(project?.testerIds || []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onStartProject({ en: name, zh: name }, selectedTesterIds);
    };

    const toggleTester = (id: string) => {
        setSelectedTesterIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg animate-slide-up overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <h2 className="text-xl font-bold">{project ? 'Edit Evaluation' : 'Start New Evaluation'}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Project Name</label>
                        <input required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-intenza-500/20" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 550Te2 Handlebar Ergo Review" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-3">Select Testers</label>
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {allTesters.map((tester: any) => (
                                <button key={tester.id} type="button" onClick={() => toggleTester(tester.id)} className={`flex items-center gap-3 p-2 rounded-xl border transition-all text-left ${selectedTesterIds.includes(tester.id) ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-slate-100"><img src={tester.imageUrl} className="w-full h-full object-cover" /></div>
                                    <span className="text-xs font-bold truncate">{tester.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-4 pt-4 border-t border-slate-100">
                        <button type="button" onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
                        <button type="submit" disabled={selectedTesterIds.length === 0} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg disabled:opacity-50">{project ? 'Save Changes' : 'Create Project'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AddTaskModal = ({ isOpen, onClose, onSave }: any) => {
    const [name, setName] = useState('');
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-lg font-bold">Add Test Task</h2>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); onSave(name); }} className="p-6 space-y-4">
                    <input required autoFocus className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-intenza-500/20" value={name} onChange={e => setName(e.target.value)} placeholder="Task name..." />
                    <button type="submit" className="w-full py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors">Add Task</button>
                </form>
            </div>
        </div>
    );
};

const EditTaskNameModal = ({ isOpen, onClose, currentName, onSave }: any) => {
    const [name, setName] = useState(currentName);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-lg font-bold">Edit Task Name</h2>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); onSave(name); }} className="p-6 space-y-4">
                    <input required autoFocus className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-intenza-500/20" value={name} onChange={e => setName(e.target.value)} />
                    <button type="submit" className="w-full py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors">Save Name</button>
                </form>
            </div>
        </div>
    );
};

const SetTaskResultsModal = ({ isOpen, onClose, onSave, project, testers }: any) => {
    const [passTesterIds, setPassTesterIds] = useState<string[]>([]);
    
    const projectTesters = testers.filter((t: any) => project.testerIds.includes(t.id));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-900">Batch Set Pass/NG</h2>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                </div>
                <div className="p-6 space-y-4">
                   <p className="text-xs text-slate-500 mb-2">Select testers who <span className="text-emerald-600 font-bold uppercase">Passed</span> this task. Unselected testers will be marked as NG.</p>
                   <div className="grid grid-cols-2 gap-2">
                       {projectTesters.map((t: any) => (
                          <button 
                            key={t.id} 
                            onClick={() => setPassTesterIds(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])}
                            className={`flex items-center gap-3 p-2 rounded-xl border transition-all text-left ${passTesterIds.includes(t.id) ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'}`}
                          >
                             <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-200"><img src={t.imageUrl} className="w-full h-full object-cover" /></div>
                             <span className="text-xs font-bold truncate">{t.name}</span>
                          </button>
                       ))}
                   </div>
                   <div className="flex gap-4 pt-4 border-t border-slate-50">
                       <button onClick={onClose} className="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                       <button onClick={() => onSave(passTesterIds)} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all">Submit Results</button>
                   </div>
                </div>
            </div>
        </div>
    );
};

const SetPassNgModal = ({ isOpen, onClose, onSet, existingReason, project }: any) => {
    const { t } = useContext(LanguageContext);
    const [reason, setReason] = useState(existingReason ? t(existingReason.reason) : '');
    const [type, setType] = useState<'ISSUE' | 'IDEA'>(existingReason?.decisionStatus === NgDecisionStatus.IDEA ? 'IDEA' : 'ISSUE');
    const [attachments, setAttachments] = useState<string[]>(existingReason?.attachmentUrls || []);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                setIsUploading(true);
                const url = await api.uploadImage(file);
                setAttachments(prev => [...prev, url]);
            } catch (err) {
                alert("Upload failed");
            } finally {
                setIsUploading(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-lg font-bold">Feedback Details</h2>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); onSet({ en: reason, zh: reason }, false, attachments, type); }} className="p-6 space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Category Type</label>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button type="button" onClick={() => setType('ISSUE')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${type === 'ISSUE' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>NG / Issue</button>
                            <button type="button" onClick={() => setType('IDEA')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${type === 'IDEA' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-400'}`}>UX Idea</button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Detailed Description</label>
                        <textarea required autoFocus rows={4} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-intenza-500/20" value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe the findings..." />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Evidence Photos</label>
                        <div className="flex flex-wrap gap-2">
                            {attachments.map((url, i) => (
                                <div key={i} className="relative w-12 h-12 rounded-lg overflow-hidden group">
                                    <img src={url} className="w-full h-full object-cover" />
                                    <button type="button" onClick={() => setAttachments(prev => prev.filter(u => u !== url))} className="absolute inset-0 bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100"><X size={14} className="text-white"/></button>
                                </div>
                            ))}
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-12 h-12 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:border-slate-400 transition-colors">
                                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16}/>}
                            </button>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                        </div>
                    </div>
                    <button type="submit" className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10">Save Record</button>
                </form>
            </div>
        </div>
    );
};

const StatusDecisionModal = ({ isOpen, onClose, context, onSetStatus, onLinkEco, onCreateEco, activeEcos }: any) => {
  const [view, setView] = useState<'MAIN' | 'LINK_ECO'>('MAIN');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm animate-slide-up overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-lg font-bold">{view === 'MAIN' ? 'Manage Decision' : 'Link to Open ECO'}</h2>
                <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full"><X size={20}/></button>
            </div>
            
            {view === 'MAIN' ? (
                <div className="p-6 space-y-3">
                    <button onClick={onCreateEco} className="w-full py-4 px-4 bg-intenza-600 text-white rounded-2xl flex items-center gap-4 hover:bg-intenza-700 transition-all group">
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

                    <div className="grid grid-cols-2 gap-2 mt-4">
                        {[NgDecisionStatus.PENDING, NgDecisionStatus.DISCUSSION, NgDecisionStatus.IGNORED].map(status => (
                            <button key={status} onClick={() => onSetStatus(status)} className="py-2 text-[10px] font-bold rounded-xl border border-slate-100 bg-slate-50 hover:bg-white transition-all uppercase tracking-widest text-slate-500">{status}</button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="p-6">
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                        {activeEcos.length > 0 ? activeEcos.map((eco: any) => (
                            <button key={eco.id} onClick={() => onLinkEco(eco.id)} className="w-full p-4 rounded-xl border border-slate-100 hover:border-intenza-200 hover:bg-intenza-50/50 transition-all text-left">
                                <div className="text-xs font-bold text-intenza-600 mb-1">{eco.ecoNumber}</div>
                                <div className="text-[11px] font-medium text-slate-700 line-clamp-2">{eco.description.en}</div>
                            </button>
                        )) : <div className="text-center py-8 text-slate-400 italic text-sm">No open ECOs found</div>}
                    </div>
                    <button onClick={() => setView('MAIN')} className="w-full mt-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600">Go Back</button>
                </div>
            )}
        </div>
    </div>
  );
};

const FeedbackModal = ({ isOpen, onClose, onSave, feedback, product }: any) => {
    const { t } = useContext(LanguageContext);
    const [formData, setFormData] = useState({
        date: feedback?.date || new Date().toISOString().split('T')[0],
        category: feedback?.category || 'Resistance profile',
        content: feedback ? t(feedback.content) : '',
        source: feedback?.source || ''
    });

    const categories: ErgoProjectCategory[] = ['Resistance profile', 'Experience', 'Stroke', 'Other Suggestion'];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-slide-up">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-lg font-bold">{feedback ? 'Edit Feedback' : 'Add Customer Complaint'}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); onSave({ ...formData, content: { en: formData.content, zh: formData.content } }, false); }} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date</label><input type="date" required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
                        <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Source</label><input required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg" value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} placeholder="e.g. Sales, Gym Owner" /></div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Category</label>
                        <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as ErgoProjectCategory})}>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Content</label>
                        <textarea required rows={4} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg resize-none" value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} placeholder="What was the complaint?" />
                    </div>
                    <button type="submit" className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-intenza-900/10">Save Feedback</button>
                </form>
            </div>
        </div>
    );
};

const FeedbackStatusDecisionModal = ({ isOpen, onClose, feedback, onUpdateStatus }: any) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm animate-slide-up overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-lg font-bold">Feedback Status</h2>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                </div>
                <div className="p-6 space-y-2">
                    {['PENDING', 'DISCUSSION', 'IGNORED'].map((status: any) => (
                        <button 
                            key={status} 
                            onClick={() => onUpdateStatus(feedback.id, status)} 
                            className={`w-full py-3 px-4 rounded-xl border text-sm font-bold transition-all text-left ${feedback.status === status ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-white hover:border-slate-300'}`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
