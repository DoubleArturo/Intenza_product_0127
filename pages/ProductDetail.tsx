
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
  userRole?: 'admin' | 'user' | 'uploader' | 'viewer';
  currentUser?: UserAccount | null;
  onUpdateProduct: (p: ProductModel) => Promise<void>;
  showAiInsights: boolean;
  evaluationModalYOffset?: number;
  tabMap: Record<string, 'DESIGN' | 'ERGO' | 'LIFE'>;
  onTabChange: (id: string, tab: 'DESIGN' | 'ERGO' | 'LIFE') => void;
}

const ProductDetail: React.FC<ProductDetailProps> = ({ products, shipments = [], testers = [], testerGroups = [], userRole, currentUser, onUpdateProduct, showAiInsights, evaluationModalYOffset = 100, tabMap, onTabChange }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language } = useContext(LanguageContext);

  const product = products.find(p => p.id === id);
  const activeTab = (id && tabMap[id]) || location.state?.activeTab || 'DESIGN';
  const setActiveTab = (tab: 'DESIGN' | 'ERGO' | 'LIFE') => { if (id) onTabChange(id, tab); };
  
  const [isEcoModalOpen, setIsEcoModalOpen] = useState(false);
  const [editingEco, setEditingEco] = useState<DesignChange | null>(null);
  
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<TestResult | null>(null);
  
  const [isNoShipmentModalOpen, setIsNoShipmentModalOpen] = useState(false);
  const [selectedVersionForModal, setSelectedVersionForModal] = useState('');

  const ergoSectionRef = useRef<HTMLDivElement>(null);
  const [highlightedFeedback, setHighlightedFeedback] = useState<{projectId?: string, taskId?: string, testerId?: string, feedbackId?: string} | null>(null);
  const [isFeedbackPanelOpen, setIsFeedbackPanelOpen] = useState(false);

  const [lightboxState, setLightboxState] = useState<{isOpen: boolean, ecoId?: string, testId?: string, feedbackId?: string, testerId?: string, taskId?: string, projectId?: string, imgUrl?: string, imgIndex?: number, category?: string} | null>(null);

  const isViewer = userRole === 'viewer';
  const isAdmin = userRole === 'admin';

  const checkPerm = (module: 'design' | 'ergo' | 'durability') => {
    if (isAdmin) return true;
    if (isViewer) return false;
    if (!product) return false;
    
    const perms = currentUser?.granularPermissions;
    if (!perms) return userRole === 'admin' || userRole === 'user' || userRole === 'uploader';
    
    if (perms.allowedSeries.includes(t(product.series))) return true;
    
    const skuPerm = perms.skuPermissions[product.sku];
    return skuPerm?.[module] || false;
  };

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

  const handleOpenEcoModal = (eco: DesignChange | null = null) => {
    if (isViewer || !checkPerm('design')) return;
    setEditingEco(eco);
    setIsEcoModalOpen(true);
  };
  
  const handleCloseEcoModal = () => {
    setIsEcoModalOpen(false);
    setEditingEco(null);
  };
  
  const handleSaveEco = async (ecoData: any) => {
      if (isViewer || !checkPerm('design')) return;
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

  const handleUpdateImageCaption = async (id: string, imgIndex: number, caption: string, type: 'eco' | 'test' | 'ng' | 'feedback', extra?: any) => {
    const module = (type === 'eco' ? 'design' : (type === 'test' ? 'durability' : 'ergo'));
    if (isViewer || !checkPerm(module)) return;
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    if (type === 'eco') {
        const updatedHistory = product.designHistory.map(eco => {
            if (eco.id === id) {
                const captions = [...(eco.imageCaptions || [])];
                while (captions.length <= imgIndex) captions.push('');
                captions[imgIndex] = caption;
                return { ...eco, imageCaptions: captions, updatedAt: timestamp };
            }
            return eco;
        });
        await onUpdateProduct({ ...product, designHistory: updatedHistory });
    } else if (type === 'test') {
        const updatedTests = product.durabilityTests.map(test => {
            if (test.id === id) {
                const captions = [...(test.attachmentCaptions || [])];
                while (captions.length <= imgIndex) captions.push('');
                captions[imgIndex] = caption;
                return { ...test, attachmentCaptions: captions, updatedDate: timestamp.split(' ')[0] };
            }
            return test;
        });
        await onUpdateProduct({ ...product, durabilityTests: updatedTests });
    } else if (type === 'feedback') {
        const updatedFeedbacks = product.customerFeedback.map(f => {
            if (f.id === id) {
                const captions = [...(f.attachmentCaptions || [])];
                while (captions.length <= imgIndex) captions.push('');
                captions[imgIndex] = caption;
                return { ...f, attachmentCaptions: captions };
            }
            return f;
        });
        await onUpdateProduct({ ...product, customerFeedback: updatedFeedbacks });
    } else if (type === 'ng') {
        const { projectId, category, taskId, testerId } = extra;
        const updatedProjects = product.ergoProjects.map(p => {
            if (p.id === projectId) {
                return {
                    ...p,
                    tasks: {
                        ...p.tasks,
                        [category]: p.tasks[category].map((t: any) => {
                            if (t.id === taskId) {
                                return {
                                    ...t,
                                    ngReasons: t.ngReasons.map((ng: any) => {
                                        if (ng.testerId === testerId) {
                                            const captions = [...(ng.attachmentCaptions || [])];
                                            while (captions.length <= imgIndex) captions.push('');
                                            captions[imgIndex] = caption;
                                            return { ...ng, attachmentCaptions: captions };
                                        }
                                        return ng;
                                    })
                                };
                            }
                            return t;
                        })
                    }
                };
            }
            return p;
        });
        await onUpdateProduct({ ...product, ergoProjects: updatedProjects });
    }
  };

  const handleDeleteEco = (ecoId: string) => {
    if (isViewer || !checkPerm('design')) return;
    if (window.confirm('確定要刪除此 ECO 記錄嗎？')) {
      const updatedDesignHistory = product.designHistory.filter(eco => eco.id !== ecoId);
      onUpdateProduct({ ...product, designHistory: updatedDesignHistory });
    }
  };

  const handleOpenTestModal = (test: TestResult | null = null) => {
    if (isViewer || !checkPerm('durability')) return;
    setEditingTest(test);
    setIsTestModalOpen(true);
  };

  const handleCloseTestModal = () => {
    setIsTestModalOpen(false);
    setEditingTest(null);
  };

  const handleSaveTest = async (testData: any) => {
    if (isViewer || !checkPerm('durability')) return;
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
    if (isViewer || !checkPerm('durability')) return;
    if (window.confirm('確定要刪除此測試記錄嗎？')) {
      const updatedDurabilityTests = product.durabilityTests.filter(t => t.id !== testId);
      onUpdateProduct({ ...product, durabilityTests: updatedDurabilityTests });
    }
  };
  
  const handleDeleteVersion = (versionToDelete: string) => {
    if (isViewer || !checkPerm('design')) return;
    if (window.confirm(`⚠️ 警告：這將會刪除版本 ${versionToDelete} 下的所有 ECO 資訊，此動作無法復原。確定要繼續嗎？`)) {
      const updatedDesignHistory = product.designHistory.filter(eco => eco.version !== versionToDelete);
      onUpdateProduct({ ...product, currentVersion: product.currentVersion === versionToDelete ? '' : product.currentVersion, designHistory: updatedDesignHistory });
    }
  };

  const handleSetCurrentVersion = (version: string) => {
    if (isViewer || !checkPerm('design')) return;
    onUpdateProduct({ ...product, currentVersion: version });
  };

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
          <button 
            onClick={() => window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate('/')} 
            className="flex items-center text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors"
          >
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
                 canEdit={checkPerm('design')}
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
                        canEdit={checkPerm('ergo')}
                        evaluationModalYOffset={evaluationModalYOffset}
                        onOpenLightbox={(type: 'ng' | 'feedback', id: string, url: string, idx: number, extra?: any) => {
                            if (type === 'feedback') setLightboxState({ isOpen: true, feedbackId: id, imgUrl: url, imgIndex: idx });
                            else setLightboxState({ isOpen: true, projectId: extra.projectId, category: extra.category, taskId: extra.taskId, testerId: id, imgUrl: url, imgIndex: idx });
                        }}
                    />
                </div>
             )}
             {activeTab === 'LIFE' && <LifeSection product={product} userRole={userRole} canEdit={checkPerm('durability')} onAddTest={() => handleOpenTestModal()} onEditTest={handleOpenTestModal} onDeleteTest={handleDeleteTest} onOpenLightbox={(testId: string, url: string, idx: number) => setLightboxState({isOpen: true, testId, imgUrl: url, imgIndex: idx})} />}
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
      
      {lightboxState && lightboxState.isOpen && (
        <ImageLightbox 
            imgUrl={lightboxState.imgUrl!} 
            onClose={() => setLightboxState(null)} 
            caption={
              lightboxState.ecoId 
                ? (product.designHistory.find(e => e.id === lightboxState.ecoId))?.imageCaptions?.[lightboxState.imgIndex!] || ''
                : lightboxState.testId
                ? (product.durabilityTests.find(t => t.id === lightboxState.testId))?.attachmentCaptions?.[lightboxState.imgIndex!] || ''
                : lightboxState.feedbackId
                ? (product.customerFeedback.find(f => f.id === lightboxState.feedbackId))?.attachmentCaptions?.[lightboxState.imgIndex!] || ''
                : (product.ergoProjects.find(p => p.id === lightboxState.projectId)?.tasks[lightboxState.category as any].find((t: any) => t.id === lightboxState.taskId)?.ngReasons.find((r: any) => r.testerId === lightboxState.testerId))?.attachmentCaptions?.[lightboxState.imgIndex!] || ''
            }
            onSaveCaption={(caption: string) => handleUpdateImageCaption(
                lightboxState.ecoId || lightboxState.testId || lightboxState.feedbackId || lightboxState.testerId!, 
                lightboxState.imgIndex!, 
                caption,
                lightboxState.ecoId ? 'eco' : (lightboxState.testId ? 'test' : (lightboxState.feedbackId ? 'feedback' : 'ng')),
                lightboxState.testerId ? { projectId: lightboxState.projectId, category: lightboxState.category, taskId: lightboxState.taskId, testerId: lightboxState.testerId } : undefined
            )}
            isViewer={isViewer || (lightboxState.ecoId ? !checkPerm('design') : (lightboxState.testId ? !checkPerm('durability') : !checkPerm('ergo')))}
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

const LifeSection = ({ product, userRole, canEdit, onAddTest, onEditTest, onDeleteTest, onOpenLightbox }: any) => {
  const { t } = useContext(LanguageContext);
  const isViewer = userRole === 'viewer' || !canEdit;
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
                    {test.attachmentUrls.map((url: string, i: number) => (
                        <div 
                          key={i} 
                          onClick={() => onOpenLightbox(test.id, url, i)}
                          className="w-8 h-8 rounded border border-slate-100 overflow-hidden cursor-pointer hover:scale-110 transition-transform relative group/thumb"
                        >
                            <img src={url} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center">
                                <Maximize2 size={10} className="text-white" />
                            </div>
                        </div>
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
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pointer-events-auto">
                    {test.details?.en || test.details?.zh ? (
                        <p className="text-sm text-slate-700 leading-relaxed font-medium">{t(test.details)}</p>
                    ) : (
                        <p className="text-xs text-slate-400 italic">No additional details recorded.</p>
                    )}
                </div>
                {test.attachmentUrls && test.attachmentUrls.length > 0 && (
                    <div className="mt-4 flex gap-2 overflow-x-auto pb-2 pointer-events-auto">
                        {test.attachmentUrls.map((url: string, i: number) => (
                            <div key={i} className="relative group/overlay-img flex-shrink-0" onClick={() => onOpenLightbox(test.id, url, i)}>
                                <img src={url} className="h-16 w-16 rounded-lg object-cover border border-slate-200 shadow-sm cursor-pointer" />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/overlay-img:opacity-100 rounded-lg flex items-center justify-center transition-opacity">
                                    <Maximize2 size={14} className="text-white" />
                                </div>
                            </div>
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

// Fix: Complete truncated ProjectCard component
const ProjectCard = ({ project, testers, product, onOpenAddTask, onEditTaskName, onDeleteTask, onOpenTaskResults, onDeleteProject, onEditProject, categoryTranslations, onStatusClick, onEditNgReason, highlightedFeedback, userRole, canEdit, onOpenLightbox }: any) => {
    const { t, language } = useContext(LanguageContext);
    const categories: ErgoProjectCategory[] = ['Resistance profile', 'Experience', 'Stroke', 'Other Suggestion'];
    const isViewer = userRole === 'viewer' || !canEdit;
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in group mb-6">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-slate-900">{t(project.name)}</h3>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-400 flex items-center gap-1"><Calendar size={12}/> {project.date}</span>
                        {project.version && <span className="text-xs font-bold text-intenza-600 bg-intenza-50 px-2 py-0.5 rounded border border-intenza-100 ml-2">{project.version}</span>}
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
                                        <div className="flex items-center gap-2">
                                            {!isViewer && (
                                              <>
                                                <button onClick={() => onOpenTaskResults(cat, task.id)} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors">Edit Results</button>
                                                <button onClick={() => { if(window.confirm('Delete this task?')) onDeleteTask(project.id, cat, task.id); }} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                                              </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {task.passTesterIds.map((tid: string) => {
                                            const tester = testers.find((t: any) => t.id === tid);
                                            return tester ? (
                                                <div key={tid} className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg shadow-sm">
                                                    <img src={tester.imageUrl} className="w-4 h-4 rounded-full object-cover" />
                                                    <span className="text-[10px] font-bold text-emerald-700">{tester.name}</span>
                                                    <Check size={10} className="text-emerald-500" />
                                                </div>
                                            ) : null;
                                        })}
                                        {task.ngReasons.map((ng: NgReason) => {
                                            const tester = testers.find((t: any) => t.id === ng.testerId);
                                            const isHighlighted = highlightedFeedback?.projectId === project.id && highlightedFeedback?.taskId === task.id && highlightedFeedback?.testerId === ng.testerId;
                                            return tester ? (
                                                <div 
                                                  key={ng.testerId} 
                                                  data-feedback-id={`${project.id}-${task.id}-${ng.testerId}`}
                                                  className={`flex flex-col gap-1 p-2 rounded-xl border-2 transition-all cursor-pointer ${isHighlighted ? 'bg-amber-100 border-amber-500 shadow-lg scale-105' : 'bg-rose-50 border-rose-100 hover:bg-white hover:border-rose-200'}`}
                                                  onClick={() => onEditNgReason(project.id, cat, task.id, ng)}
                                                >
                                                    <div className="flex items-center gap-1.5">
                                                        <img src={tester.imageUrl} className="w-4 h-4 rounded-full object-cover" />
                                                        <span className="text-[10px] font-black text-rose-700">{tester.name}</span>
                                                        <AlertTriangle size={10} className="text-rose-500" />
                                                    </div>
                                                    <div className="text-[9px] text-rose-600 font-bold line-clamp-1 max-w-[120px]">{t(ng.reason)}</div>
                                                    {ng.decisionStatus && (
                                                      <div className={`mt-1 text-[8px] font-black px-1.5 py-0.5 rounded-md self-start border ${ngDecisionStyles[ng.decisionStatus]}`}>
                                                          {ngDecisionTranslations[ng.decisionStatus]}
                                                      </div>
                                                    )}
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                            ))}
                            {(!project.tasks[cat] || project.tasks[cat].length === 0) && (
                                <p className="text-[11px] text-slate-400 italic">No tasks added to this category.</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-1.5">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Decision</span>
                       <button 
                         onClick={() => !isViewer && onStatusClick()}
                         className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${
                            project.overallStatus === ProjectOverallStatus.PASS ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/20 shadow-lg' :
                            project.overallStatus === ProjectOverallStatus.NG ? 'bg-rose-500 text-white border-rose-400 shadow-rose-500/20 shadow-lg' :
                            'bg-white text-slate-400 border-slate-200'
                         }`}
                       >
                           {project.overallStatus}
                       </button>
                   </div>
                </div>
                <div className="flex -space-x-2 overflow-hidden">
                    {project.testerIds.slice(0, 5).map((tid: string) => {
                        const tester = testers.find((t: any) => t.id === tid);
                        return tester ? <img key={tid} src={tester.imageUrl} className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover" /> : null;
                    })}
                    {project.testerIds.length > 5 && <div className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-200 ring-2 ring-white text-[8px] font-bold text-slate-500">+{project.testerIds.length - 5}</div>}
                </div>
            </div>
        </div>
    );
};

// Fix: Add missing DesignSection component
const DesignSection = ({ product, shipments, userRole, canEdit, onAddEco, onEditEco, onDeleteEco, onDeleteVersion, onSetCurrentVersion, onNavigateToSource, onOpenLightbox, onNoShipment }: any) => {
  const { t } = useContext(LanguageContext);
  const versions = useMemo(() => {
    const vSet = new Set([product.currentVersion, ...product.designHistory.map(h => h.version)]);
    return Array.from(vSet).sort().reverse();
  }, [product]);

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">Design History & Engineering Changes</h2>
          {canEdit && (
            <button onClick={onAddEco} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors">
              <Plus size={16} /> New ECO
            </button>
          )}
      </div>

      <div className="space-y-12">
          {versions.map(v => {
            const versionEcos = product.designHistory.filter(e => e.version === v);
            const isLatest = v === product.currentVersion;
            const hasShipment = shipments.some(s => s.sku === product.sku && formatVersion(s.version) === formatVersion(v));

            return (
              <div key={v} className="relative pl-8 border-l-2 border-slate-200 last:border-l-0">
                  <div className={`absolute top-0 left-[-11px] w-5 h-5 rounded-full border-4 ${isLatest ? 'bg-intenza-600 border-intenza-100 shadow-lg shadow-intenza-600/30' : 'bg-slate-300 border-white shadow-sm'}`} />
                  <div className="flex items-center gap-4 mb-6">
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Version {v}</h3>
                      {isLatest && <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm uppercase">Live</span>}
                      {canEdit && (
                        <div className="flex gap-1 ml-auto">
                            {!isLatest && <button onClick={() => onSetCurrentVersion(v)} className="text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded transition-colors uppercase">Set as Current</button>}
                            <button onClick={() => onDeleteVersion(v)} className="text-[10px] font-bold text-rose-500 hover:bg-rose-50 px-2 py-1 rounded transition-colors uppercase">Delete Version</button>
                        </div>
                      )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {versionEcos.map(eco => (
                      <div key={eco.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group">
                        <div className="flex justify-between items-start mb-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${ecoStatusStyles[eco.status]}`}>
                            {language === 'zh' ? ecoStatusTranslations[eco.status] : eco.status}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-400">{eco.ecoNumber}</span>
                        </div>
                        <h4 className="font-bold text-slate-800 mb-2 leading-tight">{t(eco.description)}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
                            <Calendar size={12}/> {eco.date}
                        </div>
                        {eco.imageUrls && eco.imageUrls.length > 0 && (
                          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                            {eco.imageUrls.map((url, i) => (
                              <div key={i} onClick={() => onOpenLightbox(eco.id, url, i)} className="w-12 h-12 rounded-lg border border-slate-100 overflow-hidden cursor-pointer hover:scale-105 transition-transform">
                                <img src={url} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        )}
                        {eco.sourceFeedbacks && eco.sourceFeedbacks.length > 0 && (
                          <div className="pt-4 border-t border-slate-50 flex gap-2">
                             {eco.sourceFeedbacks.map((source, idx) => (
                               <button 
                                 key={idx} 
                                 onClick={() => onNavigateToSource(source)} 
                                 className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md text-[10px] font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors"
                               >
                                 <LinkIcon size={10} /> {source.projectId ? 'Ergo Source' : 'Feedback Source'}
                               </button>
                             ))}
                          </div>
                        )}
                        {canEdit && (
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => onEditEco(eco)} className="p-1.5 bg-white border border-slate-100 rounded-md text-slate-500 hover:text-slate-900 shadow-sm"><Pencil size={12}/></button>
                            <button onClick={() => onDeleteEco(eco.id)} className="p-1.5 bg-white border border-slate-100 rounded-md text-red-500 hover:text-red-700 shadow-sm"><Trash2 size={12}/></button>
                          </div>
                        )}
                      </div>
                    ))}
                    {versionEcos.length === 0 && <p className="text-sm text-slate-400 italic">No engineering changes recorded for this version.</p>}
                  </div>

                  <div className="mt-6 flex gap-4">
                      {hasShipment ? (
                        <button 
                          onClick={() => navigate('/analytics', { state: { autoDrill: { sku: product.sku, version: v } } })}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
                        >
                            <Ship size={14}/> Track Global Shipments
                        </button>
                      ) : (
                        <button 
                          onClick={() => onNoShipment(v)}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-400 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-200"
                        >
                            <Info size={14}/> No Registered Shipments
                        </button>
                      )}
                  </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

// Fix: Add missing ErgoSection component
const ErgoSection = ({ product, testers, testerGroups, onUpdateProduct, highlightedFeedback, isFeedbackPanelOpen, setIsFeedbackPanelOpen, userRole, canEdit, evaluationModalYOffset, onOpenLightbox }: any) => {
    const { t, language } = useContext(LanguageContext);
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<ErgoProject | null>(null);
    const isViewer = userRole === 'viewer' || !canEdit;

    const categoryTranslations: Record<ErgoProjectCategory, string> = {
        'Resistance profile': '阻力曲線',
        'Experience': '使用者體驗',
        'Stroke': '運動軌跡',
        'Other Suggestion': '其他建議'
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-slate-900">Ergonomics & Human Factors Verification</h2>
                    <button onClick={() => setIsFeedbackPanelOpen(true)} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold border border-indigo-100 hover:bg-indigo-100 transition-all relative">
                        <MessageSquare size={14} /> Customer Feedback Panel
                        {(product.customerFeedback || []).length > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white">{product.customerFeedback.length}</span>
                        )}
                    </button>
                </div>
                {!isViewer && (
                    <button onClick={() => { setEditingProject(null); setIsProjectModalOpen(true); }} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors">
                        <Plus size={16} /> New Verification Project
                    </button>
                )}
            </div>

            <div className="space-y-6">
                {product.ergoProjects.map((project: ErgoProject) => (
                    <ProjectCard 
                        key={project.id} 
                        project={project} 
                        testers={testers} 
                        product={product} 
                        userRole={userRole}
                        canEdit={canEdit}
                        categoryTranslations={categoryTranslations}
                        onDeleteProject={() => onUpdateProduct({ ...product, ergoProjects: product.ergoProjects.filter(p => p.id !== project.id) })}
                        onOpenLightbox={onOpenLightbox}
                    />
                ))}
                {product.ergoProjects.length === 0 && (
                    <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                        <Users2 size={48} className="mx-auto mb-4 opacity-10" />
                        <p className="font-medium uppercase tracking-widest text-xs">No ergonomic verification projects yet.</p>
                    </div>
                )}
            </div>
            
            {isFeedbackPanelOpen && (
              <FeedbackPanel 
                isOpen={isFeedbackPanelOpen} 
                onClose={() => setIsFeedbackPanelOpen(false)} 
                product={product} 
                onUpdateProduct={onUpdateProduct} 
                highlightedFeedbackId={highlightedFeedback?.feedbackId}
                canEdit={canEdit}
                onOpenLightbox={(id: string, url: string, idx: number) => onOpenLightbox('feedback', id, url, idx)}
              />
            )}
        </div>
    );
};

// Fix: Add placeholder for components used in ErgoSection
const FeedbackPanel = ({ isOpen, onClose, product, onUpdateProduct, highlightedFeedbackId, canEdit, onOpenLightbox }: any) => {
    const { t } = useContext(LanguageContext);
    return (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="w-full max-w-xl bg-white h-full relative z-10 shadow-2xl flex flex-col animate-slide-left">
                <header className="p-8 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Customer Feedbacks</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={24} /></button>
                </header>
                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                    {product.customerFeedback.map((fb: ErgoFeedback) => (
                        <div key={fb.id} data-customer-feedback-id={fb.id} className={`p-6 rounded-2xl border-2 transition-all ${highlightedFeedbackId === fb.id ? 'bg-amber-50 border-amber-500 shadow-xl' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <span className="text-[10px] font-black uppercase bg-slate-900 text-white px-2 py-1 rounded tracking-widest">{fb.category}</span>
                                <span className="text-[10px] font-bold text-slate-400">{fb.date}</span>
                            </div>
                            <p className="text-slate-700 font-medium leading-relaxed mb-4">{t(fb.content)}</p>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">— {fb.source}</div>
                        </div>
                    ))}
                    {product.customerFeedback.length === 0 && <p className="text-center text-slate-400 italic">No feedbacks recorded.</p>}
                </div>
            </div>
        </div>
    );
};

// Fix: Add missing Modal components
const EcoModal = ({ isOpen, onClose, onSave, eco, productVersions, product }: any) => {
    const { t } = useContext(LanguageContext);
    const [formData, setFormData] = useState({
        ecoNumber: eco?.ecoNumber || '',
        date: eco?.date || new Date().toISOString().split('T')[0],
        version: eco?.version || product.currentVersion,
        description: eco?.description?.en || '',
        status: eco?.status || EcoStatus.EVALUATING,
        imageUrls: eco?.imageUrls || [],
        imageCaptions: eco?.imageCaptions || []
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...formData, description: { en: formData.description, zh: formData.description } });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg animate-slide-up">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold">{eco ? 'Edit ECO' : 'New Engineering Change'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">ECO / ECR Number</label>
                            <input required type="text" value={formData.ecoNumber} onChange={e => setFormData({...formData, ecoNumber: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-900 outline-none font-bold" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Target Version</label>
                            <input required type="text" value={formData.version} onChange={e => setFormData({...formData, version: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-900 outline-none font-bold" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Change Description</label>
                        <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-900 outline-none min-h-[100px]" />
                    </div>
                    <div className="flex gap-4">
                        <button type="button" onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
                        <button type="submit" className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-xl shadow-slate-900/20">Save Record</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const TestModal = ({ isOpen, onClose, onSave, test, productVersions }: any) => {
    const { t } = useContext(LanguageContext);
    const [formData, setFormData] = useState({
        testName: test?.testName?.en || '',
        category: test?.category || 'Mechanical',
        status: test?.status || TestStatus.PENDING,
        score: test?.score || 0,
        details: test?.details?.en || '',
        version: test?.version || ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...formData, testName: { en: formData.testName, zh: formData.testName }, details: { en: formData.details, zh: formData.details } });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg animate-slide-up">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold">{test ? 'Edit Test' : 'New Durability Test'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Test Name</label>
                        <input required type="text" value={formData.testName} onChange={e => setFormData({...formData, testName: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Status</label>
                            <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                                {Object.values(TestStatus).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Score / Progress (%)</label>
                            <input type="number" min="0" max="100" value={formData.score} onChange={e => setFormData({...formData, score: Number(e.target.value)})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl" />
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button type="button" onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
                        <button type="submit" className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl">Save Test</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const NoShipmentModal = ({ isOpen, onClose, version }: any) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
        <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-sm text-center animate-slide-up">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6"><Info size={32} /></div>
            <h3 className="text-xl font-bold mb-2">No Shipment Data</h3>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">Version {version} has not been associated with any global shipments in the registry yet.</p>
            <button onClick={onClose} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg">Acknowledged</button>
        </div>
    </div>
);

const ImageLightbox = ({ imgUrl, onClose, caption, onSaveCaption, isViewer }: any) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempCaption, setTempCaption] = useState(caption || '');
    const isVid = isVideo(imgUrl);

    return (
        <div className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-md flex flex-col p-4 md:p-12 animate-fade-in">
            <button onClick={onClose} className="absolute top-8 right-8 text-white/40 hover:text-white transition-colors z-30"><X size={32} /></button>
            <div className="flex-1 flex items-center justify-center overflow-hidden">
                {isVid ? (
                    <video src={imgUrl} controls autoPlay className="max-w-full max-h-full rounded-2xl shadow-2xl" />
                ) : (
                    <img src={imgUrl} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
                )}
            </div>
            <div className="w-full max-w-2xl mx-auto mt-8 bg-white/10 p-6 rounded-2xl border border-white/10 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Documentation Asset</span>
                    {!isViewer && (
                        <button 
                            onClick={() => isEditing ? (onSaveCaption(tempCaption), setIsEditing(false)) : setIsEditing(true)}
                            className="text-xs font-bold text-white hover:text-emerald-400 transition-colors flex items-center gap-2"
                        >
                            {isEditing ? <><Save size={14}/> Save</> : <><Pencil size={14}/> Edit Caption</>}
                        </button>
                    )}
                </div>
                {isEditing ? (
                    <textarea 
                        value={tempCaption} 
                        onChange={e => setTempCaption(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-white/30 resize-none h-24"
                    />
                ) : (
                    <p className="text-white text-sm font-medium leading-relaxed italic">{caption || 'No description recorded for this asset.'}</p>
                )}
            </div>
        </div>
    );
};
