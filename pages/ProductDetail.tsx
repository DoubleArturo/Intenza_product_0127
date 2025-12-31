
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
      if (window.confirm(t({ en: 'Are you sure you want to delete this test result?', zh: '確定要刪除此項測試結果嗎？' }))) {
          const updatedTests = product.durabilityTests.filter(t => t.id !== testId);
          onUpdateProduct({ ...product, durabilityTests: updatedTests });
      }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 w-full">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 animate-fade-in">
        <div className="w-full px-8 py-6">
          <button onClick={() => navigate('/')} className="flex items-center text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors">
            <ArrowLeft size={16} className="mr-1" /> {t({ en: 'Back to Portfolio', zh: '返回產品組合' })}
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
                  <span>{t({ en: 'Latest:', zh: '當前版本：' })} {product.currentVersion}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <TabButton active={activeTab === 'DESIGN'} onClick={() => setActiveTab('DESIGN')} icon={<GitCommit size={16} />} label={t({ en: 'Design & ECO', zh: '設計與 ECO' })} />
              <TabButton active={activeTab === 'ERGO'} onClick={() => setActiveTab('ERGO')} icon={<UserCheck size={16} />} label={t({ en: 'Ergonomics', zh: '人因工程' })} />
              <TabButton active={activeTab === 'LIFE'} onClick={() => setActiveTab('LIFE')} icon={<Activity size={16} />} label={t({ en: 'Durability', zh: '耐久測試' })} />
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
                                  <AlertCircle size={14} className="text-slate-400"/> {t({en: 'NG Tracking (Pending)', zh: 'NG 追蹤項 (待處理)'})}
                              </span>
                              <span className={`font-mono font-bold ${pendingNgCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{pendingNgCount}</span>
                          </div>
                          <div className="flex justify-between items-center">
                              <span className="text-slate-600 text-sm flex items-center gap-2">
                                  <MessageSquare size={14} className="text-slate-400"/> {t({en: 'Customer NG (Pending)', zh: '客戶反饋 (待處理)'})}
                              </span>
                              <span className={`font-mono font-bold ${pendingFeedbackCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{pendingFeedbackCount}</span>
                          </div>
                      </div>
                  </div>

                  <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100">{t({en: 'Product Testing', zh: '產品測試項資訊'})}</h4>
                      <div className="flex justify-between items-center">
                          <span className="text-slate-600 text-sm flex items-center gap-2">
                              <Activity size={14} className="text-slate-400"/> {t({en: 'Durability Tests', zh: '耐久測試任務數'})}
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
                         <h4 className="font-bold text-slate-900 group-hover:text-intenza-600 transition-colors">{t({ en: 'Tester Database', zh: '測試員資料庫' })}</h4>
                         <p className="text-xs text-slate-500">{t({ en: 'Manage test subjects', zh: '管理測試人員名單' })}</p>
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

// FIX: Define TabButton for shared use in the file
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">{t({ en: 'Design Version History', zh: '設計版本歷程' })}</h2>
        <button onClick={onAddEco} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors">
          <Plus size={16} /> {t({ en: 'Add ECO', zh: '新增 ECO' })}
        </button>
      </div>
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
          <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-3 mb-6">
            {selectedVersion}
            <span className={`text-xs font-normal text-white px-2 py-1 rounded-md uppercase tracking-wider ${selectedVersion === product.currentVersion ? 'bg-slate-900' : 'bg-slate-400'}`}>
              {selectedVersion === product.currentVersion ? t({ en: 'Current', zh: '當前版本' }) : t({ en: 'Archived', zh: '歷史存檔' })}
            </span>
          </h3>
          {activeChanges.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300"><GitCommit size={32} /></div>
              <h4 className="text-slate-900 font-medium">{t({ en: 'No Change Records', zh: '查無工程變更記錄' })}</h4>
              <p className="text-slate-500 text-sm mt-1 max-w-sm">{t({ en: 'No Engineering Change Orders (ECO) recorded for this version.', zh: '此版本目前沒有任何工程變更記錄 (ECO)。' })}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {activeChanges.map((change) => (
                <div key={change.id} className="group relative rounded-lg transition-colors hover:bg-slate-50/50 -m-3 p-3">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="md:w-48 flex-shrink-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm font-bold text-intenza-600 bg-intenza-50 px-2 py-1 rounded border border-intenza-100">{change.ecoNumber}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500 text-sm mt-2"><Calendar size={14} />{change.date}</div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <h4 className="text-lg font-medium text-slate-900 mb-3 leading-snug pr-4">{t(change.description)}</h4>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border whitespace-nowrap ${ecoStatusStyles[change.status]}`}>{language === 'en' ? change.status : ecoStatusTranslations[change.status]}</span>
                          {change.status === EcoStatus.IN_PRODUCTION && change.implementationDate && (<span className="text-xs text-slate-500 font-mono">{change.implementationDate}</span>)}
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
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 transition-colors group-hover:border-slate-200">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2"><Layers size={14} /> {t({ en: 'Affected Batches', zh: '受影響批次' })}</div>
                          <div className="flex flex-wrap gap-2">{change.affectedBatches.map((b) => (<span key={b} className="text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded-md text-slate-700 font-mono shadow-sm">{b}</span>))}</div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2"><Users size={14} /> {t({ en: 'Impacted Customers', zh: '受影響客戶' })}</div>
                          <p className="text-sm text-slate-600 leading-relaxed">{change.affectedCustomers.join(', ')}</p>
                        </div>
                      </div>
                      {change.sourceFeedbacks && change.sourceFeedbacks.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1">
                              {change.sourceFeedbacks.map((fb, idx) => (
                                  <button key={idx} onClick={() => handleLinkBack(fb)} className="text-xs text-blue-600 font-semibold flex items-center gap-1 hover:underline w-fit">
                                      <LinkIcon size={12}/> {t({ en: 'View Feedback Source', zh: '查看反饋來源' })} #{idx + 1}
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

// FIX: Define ErgoSection to fix line 186 error
const ErgoSection = ({ product, testers, onUpdateProduct, highlightedFeedback }: any) => {
    const { t } = useContext(LanguageContext);
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">{t({ en: 'Ergonomics & Human Factors', zh: '人因工程與評估' })}</h2>
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                <p className="text-slate-500">{t({ en: 'Ergonomics evaluation details for this product.', zh: '此產品的人因工程評估詳情。' })}</p>
                {/* Simplified placeholder for actual ergo content */}
                <div className="mt-6 p-4 border border-dashed border-slate-200 rounded-xl text-center text-slate-400">
                    <Users size={32} className="mx-auto mb-2 opacity-20" />
                    <p>{t({ en: 'Human factors assessment records will appear here.', zh: '人因評估記錄將顯示於此。' })}</p>
                </div>
            </div>
        </div>
    );
};

// FIX: Define LifeSection to fix line 187 error
const LifeSection = ({ product, onAddTest, onEditTest, onDeleteTest }: any) => {
    const { t } = useContext(LanguageContext);
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">{t({ en: 'Durability & Lab Testing', zh: '耐久性與實驗室測試' })}</h2>
                <button onClick={onAddTest} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors">
                    <Plus size={16} /> {t({ en: 'Add Test Result', zh: '新增測試結果' })}
                </button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                {product.durabilityTests.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <Activity size={48} className="mx-auto mb-4 opacity-10" />
                        <p>{t({ en: 'No durability test results recorded.', zh: '尚未記錄任何耐久測試結果。' })}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {product.durabilityTests.map((test: any) => (
                            <div key={test.id} className="p-4 border border-slate-100 rounded-xl bg-slate-50 hover:border-slate-300 transition-colors relative group">
                                <h4 className="font-bold text-slate-900">{t(test.testName)}</h4>
                                <div className="text-xs text-slate-500 mt-1">{test.category}</div>
                                <div className="mt-4 flex items-center justify-between">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${test.status === 'PASS' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{test.status}</span>
                                    <span className="text-sm font-mono font-bold text-slate-900">{test.score}%</span>
                                </div>
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <button onClick={() => onEditTest(test)} className="p-1.5 bg-white rounded shadow-sm hover:text-indigo-600"><Pencil size={12}/></button>
                                    <button onClick={() => onDeleteTest(test.id)} className="p-1.5 bg-white rounded shadow-sm hover:text-red-600"><Trash2 size={12}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// FIX: Define EcoModal to fix line 241 error
const EcoModal = ({ isOpen, onClose, onSave, eco, productVersions, product }: any) => {
    const { t } = useContext(LanguageContext);
    const [formData, setFormData] = useState(eco || {
        ecoNumber: '',
        date: new Date().toISOString().split('T')[0],
        version: productVersions[0] || 'v1.0',
        description: { en: '', zh: '' },
        affectedBatches: [],
        affectedCustomers: [],
        status: EcoStatus.EVALUATING,
        imageUrls: []
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-slate-900">{eco ? t({ en: 'Edit ECO', zh: '編輯 ECO' }) : t({ en: 'Add New ECO', zh: '新增 ECO' })}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                </div>
                <div className="p-6 overflow-y-auto">
                    <form id="ecoForm" onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">ECO Number</label>
                            <input type="text" value={formData.ecoNumber} onChange={e => setFormData({ ...formData, ecoNumber: e.target.value })} required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-intenza-500/20 outline-none" placeholder="e.g. ECO-2023-001" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">{t({ en: 'Description (EN)', zh: '描述 (英文)' })}</label>
                            <textarea value={formData.description.en} onChange={e => setFormData({ ...formData, description: { ...formData.description, en: e.target.value } })} required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-intenza-500/20 outline-none h-24" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">{t({ en: 'Description (ZH)', zh: '描述 (中文)' })}</label>
                            <textarea value={formData.description.zh} onChange={e => setFormData({ ...formData, description: { ...formData.description, zh: e.target.value } })} required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-intenza-500/20 outline-none h-24" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Date</label>
                                <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-intenza-500/20 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Status</label>
                                <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as EcoStatus })} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-intenza-500/20 outline-none">
                                    {Object.values(EcoStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                    </form>
                </div>
                <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 sticky bottom-0">
                    <button onClick={onClose} className="px-5 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg">{t({ en: 'Cancel', zh: '取消' })}</button>
                    <button form="ecoForm" type="submit" className="px-5 py-2 bg-intenza-600 text-white font-bold rounded-lg shadow-lg hover:bg-intenza-700">{t({ en: 'Save', zh: '儲存' })}</button>
                </div>
            </div>
        </div>
    );
};

// FIX: Define TestModal to fix line 242 error
const TestModal = ({ isOpen, onClose, onSave, test }: any) => {
    const { t } = useContext(LanguageContext);
    const [formData, setFormData] = useState(test || {
        category: 'General',
        testName: { en: '', zh: '' },
        score: 0,
        status: TestStatus.PENDING,
        details: { en: '', zh: '' }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                    <h2 className="text-xl font-bold text-slate-900">{test ? t({ en: 'Edit Test', zh: '編輯測試' }) : t({ en: 'Add Test Result', zh: '新增測試結果' })}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                </div>
                <div className="p-6">
                    <form id="testForm" onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Test Name (EN)</label>
                            <input type="text" value={formData.testName.en} onChange={e => setFormData({ ...formData, testName: { ...formData.testName, en: e.target.value } })} required className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Category</label>
                            <input type="text" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} required className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Score (%)</label>
                                <input type="number" value={formData.score} onChange={e => setFormData({ ...formData, score: Number(e.target.value) })} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Status</label>
                                <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as TestStatus })} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-intenza-500/20">
                                    {Object.values(TestStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                    </form>
                </div>
                <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                    <button onClick={onClose} className="px-5 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg">{t({ en: 'Cancel', zh: '取消' })}</button>
                    <button form="testForm" type="submit" className="px-5 py-2 bg-slate-900 text-white font-bold rounded-lg shadow-lg hover:bg-slate-800">{t({ en: 'Save Result', zh: '儲存結果' })}</button>
                </div>
            </div>
        </div>
    );
};

export default ProductDetail;
