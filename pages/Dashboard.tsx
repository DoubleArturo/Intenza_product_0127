
import React, { useState, useRef, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronRight, X, Upload, Pencil, Save, Star, Trash2, Image as ImageIcon, Loader2, ArrowUpDown, Calendar, Info, Settings2, Check, ShieldCheck } from 'lucide-react';
import { ProductModel, LocalizedString, EcoStatus, UserAccount } from '../types';
import { LanguageContext } from '../App';
import { api } from '../services/api';

interface DashboardProps {
  products: ProductModel[];
  seriesList: LocalizedString[];
  userRole?: 'admin' | 'user' | 'uploader' | 'viewer';
  currentUser?: UserAccount | null;
  globalStatusLightSize: 'SMALL' | 'NORMAL' | 'LARGE';
  dashboardColumns: number;
  cardAspectRatio: string;
  onAddProduct: (productData: Omit<ProductModel, 'id' | 'ergoProjects' | 'customerFeedback' | 'designHistory' | 'ergoTests' | 'durabilityTests'>) => Promise<void>;
  onUpdateProduct: (product: ProductModel) => Promise<void>;
  onToggleWatch: (id: string) => void;
  onMoveProduct: (id: string, direction: 'left' | 'right') => void;
  onDeleteProduct: (id: string) => void;
}

type SortType = 'NAME_ASC' | 'SKU_ASC' | 'SKU_DESC';

// Map for Tailwind grid-cols classes for dynamic layout
const gridColsClassMap: Record<number, string> = {
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4',
  5: 'xl:grid-cols-5',
  6: 'xl:grid-cols-6',
};

// Map for Tailwind aspect ratio classes
const aspectClassMap: Record<string, string> = {
  '1/1': 'aspect-square',
  '3/4': 'aspect-[3/4]',
  '4/3': 'aspect-[4/3]',
  '16/9': 'aspect-video',
};

export const Dashboard: React.FC<DashboardProps> = ({ 
  products, seriesList, userRole, currentUser, globalStatusLightSize, dashboardColumns, cardAspectRatio,
  onAddProduct, onUpdateProduct, onToggleWatch, onDeleteProduct 
}) => {
  const navigate = useNavigate();
  const { language, t } = useContext(LanguageContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeries, setSelectedSeries] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<SortType>('SKU_ASC');
  
  // Tooltip State
  const [hoveredLightId, setHoveredLightId] = useState<string | null>(null);
  const [hoveredSafetyId, setHoveredSafetyId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Direct Selection State
  const [selectorProductId, setSelectorProductId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductModel | null>(null);
  const [formData, setFormData] = useState({
    series: seriesList[0] || { en: '', zh: '' },
    modelName: '',
    sku: '',
    version: 'v1.0',
    description: '',
    imageUrl: '',
    safetyCert: '',
    statusOverride: 'AUTO' as 'RED' | 'BLUE' | 'GREEN' | 'AUTO'
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isViewer = userRole === 'viewer';
  const isAdmin = userRole === 'admin';
  const isUploader = userRole === 'uploader';
  const isStandard = userRole === 'user';
  
  // Helper to check permission for a specific SKU/Series
  const canModifyProduct = (p: ProductModel) => {
    if (isAdmin) return true;
    if (isViewer) return false;
    
    const perms = currentUser?.granularPermissions;
    if (!perms) return isAdmin || isStandard || isUploader; // Default to old behavior if no perms set
    
    // Series permission
    const seriesName = t(p.series);
    if (perms.allowedSeries.includes(seriesName)) return true;
    
    // SKU module permission (Any module access granted means they can edit basic info)
    const skuPerm = perms.skuPermissions[p.sku];
    if (skuPerm && (skuPerm.design || skuPerm.ergo || skuPerm.durability)) return true;
    
    return false;
  };

  const canAddProduct = isAdmin || isStandard || isUploader; // Keeping basic role check for adding new ones

  const canEditLight = isAdmin || isStandard;
  
  useEffect(() => {
    if (isModalOpen) {
      if (editingProduct) {
        setFormData({
          series: editingProduct.series,
          modelName: t(editingProduct.modelName),
          sku: editingProduct.sku,
          version: editingProduct.currentVersion,
          description: t(editingProduct.description),
          imageUrl: editingProduct.imageUrl,
          safetyCert: editingProduct.safetyCert || '',
          statusOverride: editingProduct.statusOverride || 'AUTO'
        });
      } else {
        setFormData({
          series: seriesList[0] || { en: 'Uncategorized', zh: '未分類' },
          modelName: '',
          sku: '',
          version: 'v1.0',
          description: '',
          imageUrl: '',
          safetyCert: '',
          statusOverride: 'AUTO'
        });
      }
    }
  }, [isModalOpen, editingProduct, seriesList, t]);

  const filteredProducts = products.filter(p => {
    const modelStr = t(p.modelName).toLowerCase();
    const skuStr = p.sku.toLowerCase();
    const searchStr = searchTerm.toLowerCase();
    
    const matchesSearch = modelStr.includes(searchStr) || skuStr.includes(searchStr);
    const matchesSeries = selectedSeries === 'ALL' || t(p.series) === selectedSeries;
    
    return matchesSearch && matchesSeries;
  }).sort((a, b) => {
    if (a.isWatched && !b.isWatched) return -1;
    if (!a.isWatched && b.isWatched) return 1;

    if (sortOrder === 'SKU_ASC') {
      return a.sku.localeCompare(b.sku, undefined, { numeric: true });
    } else if (sortOrder === 'SKU_DESC') {
      return b.sku.localeCompare(a.sku, undefined, { numeric: true });
    }
    return t(a.modelName).localeCompare(t(b.modelName), undefined, { numeric: true, sensitivity: 'base' });
  });

  const seriesTabs = ['ALL', ...seriesList.map(s => t(s))];
  
  const handleStartEdit = (product: ProductModel) => {
    if (isViewer) return;
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isViewer) return;
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsUploading(true);
        const blobUrl = await api.uploadImage(file);
        setFormData({ ...formData, imageUrl: blobUrl });
      } catch (err) {
        console.error("Image upload failed", err);
        alert("圖片上傳失敗，請檢查網路連線");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) return;
    setIsSubmitting(true);
    
    if (editingProduct) {
      const updatedModelName = { en: formData.modelName, zh: formData.modelName };
      const updatedDescription = { en: formData.description, zh: formData.description };

      await onUpdateProduct({
        ...editingProduct,
        series: formData.series,
        modelName: updatedModelName,
        description: updatedDescription,
        sku: formData.sku,
        imageUrl: formData.imageUrl || editingProduct.imageUrl,
        currentVersion: formData.version,
        safetyCert: formData.safetyCert,
        statusOverride: formData.statusOverride
      });
    } else {
      const newProductData = {
        series: formData.series,
        modelName: { en: formData.modelName, zh: formData.modelName },
        sku: formData.sku,
        imageUrl: formData.imageUrl,
        currentVersion: formData.version,
        description: { en: formData.description, zh: formData.description },
        safetyCert: formData.safetyCert,
        statusOverride: formData.statusOverride
      };
      await onAddProduct(newProductData as any);
    }
    setIsSubmitting(false);
    handleCloseModal();
  };

  const getProductStatusColor = (p: ProductModel): 'red' | 'blue' | 'green' => {
    if (p.statusOverride && p.statusOverride !== 'AUTO') {
        if (p.statusOverride === 'RED') return 'red';
        if (p.statusOverride === 'BLUE') return 'blue';
        return 'green';
    }

    const pendingEcos = p.designHistory.filter(h => h.status !== EcoStatus.IN_PRODUCTION && h.status !== EcoStatus.DESIGN_COMPLETE);
    if (pendingEcos.length === 0) return 'green';
    
    const isMajor = pendingEcos.some(eco => {
      const desc = (t(eco.description)).toLowerCase();
      const hasSource = (eco.sourceFeedbacks && eco.sourceFeedbacks.length > 0);
      return hasSource || 
             desc.includes('safety') || desc.includes('安全') || 
             desc.includes('major') || desc.includes('重大') || 
             desc.includes('ergo') || desc.includes('人因');
    });
    
    return isMajor ? 'red' : 'blue';
  };

  const handleMouseEnterLight = (id: string) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredLightId(id);
    }, 1000);
  };

  const handleMouseLeaveLight = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setHoveredLightId(null);
  };

  const handleStatusLightClick = (e: React.MouseEvent, p: ProductModel) => {
    e.stopPropagation();
    // Check permission to modify the status light for this specific SKU
    if (!canModifyProduct(p) || !canEditLight) {
        navigate(`/product/${p.id}`);
        return;
    }
    setSelectorProductId(p.id);
  };

  const updateProductStatusDirectly = async (p: ProductModel, status: 'RED' | 'BLUE' | 'GREEN' | 'AUTO') => {
    await onUpdateProduct({ ...p, statusOverride: status });
    setSelectorProductId(null);
  };

  const getCurrentProductionInfo = (p: ProductModel) => {
    return (p.designHistory || []).find(
      h => h.version === p.currentVersion && 
      h.status === EcoStatus.IN_PRODUCTION && 
      h.implementationDate
    );
  };

  return (
    <div className="p-8 w-full mx-auto relative">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">{t({ en: 'Product Design Status', zh: '產品設計狀態'})}</h1>
          <p className="text-slate-500 mt-2 font-medium">{t({ en: 'Manage design quality across all series.', zh: '管理所有系列的設計品質。'})}</p>
        </div>
        {canAddProduct && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-xl shadow-slate-900/20 active:scale-95"
          >
            <Plus size={20} strokeWidth={3} />
            {t({ en: 'New Product', zh: '新增產品'})}
          </button>
        )}
      </header>

      <div className="flex flex-col xl:flex-row gap-6 mb-10 items-start xl:items-center">
        <div className="flex items-center bg-slate-200/50 rounded-xl p-1.5 overflow-x-auto max-w-full no-scrollbar shadow-inner">
          {seriesTabs.map((s) => (
            <button
              key={s}
              onClick={() => setSelectedSeries(s)}
              className={`px-5 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                selectedSeries === s 
                  ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-200' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {s === 'ALL' ? t({ en: 'All Series', zh: '所有系列'}) : s}
            </button>
          ))}
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 flex-1 w-full">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder={t({ en: 'Search by model or SKU...', zh: '搜尋型號或 SKU...'})}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-slate-900 transition-all shadow-sm text-sm font-medium"
            />
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner shrink-0">
            <button 
              onClick={() => setSortOrder('NAME_ASC')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${sortOrder === 'NAME_ASC' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}
            >
              Name
            </button>
            <button 
              onClick={() => setSortOrder(sortOrder === 'SKU_ASC' ? 'SKU_DESC' : 'SKU_ASC')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${sortOrder.startsWith('SKU') ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}
            >
              SKU {sortOrder.startsWith('SKU') && <ArrowUpDown size={12} className={sortOrder === 'SKU_DESC' ? 'rotate-180 transition-transform' : 'transition-transform'} />}
            </button>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gridColsClassMap[dashboardColumns] || 'xl:grid-cols-4'} gap-8`}>
        {filteredProducts.map((p) => {
          const productionInfo = getCurrentProductionInfo(p);
          const displayVersion = p.currentVersion;
          const statusColor = getProductStatusColor(p);
          const canEditThisProduct = canModifyProduct(p);
          
          const dotSizeClass = globalStatusLightSize === 'SMALL' ? 'w-3 h-3' : globalStatusLightSize === 'LARGE' ? 'w-6 h-6' : 'w-4 h-4';
          
          const descriptionLines = t(p.description).split('\n').filter(l => l.trim().length > 0);
          const safetyCertLines = (p.safetyCert || '').split('\n').filter(l => l.trim().length > 0);

          return (
            <div 
              key={p.id} 
              className="group bg-white rounded-[2rem] border-2 border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-slate-200/60 hover:border-slate-200 transition-all duration-300 overflow-hidden flex flex-col cursor-pointer active:scale-[0.98] relative"
              onClick={() => navigate(`/product/${p.id}`)}
            >
              {hoveredSafetyId === p.id && safetyCertLines.length > 0 && (
                <div className="absolute inset-x-0 bottom-0 top-0 bg-slate-900/95 backdrop-blur-md z-[60] p-8 animate-fade-in flex flex-col pointer-events-none">
                  <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                      <ShieldCheck size={24} className="text-blue-400" />
                      <h4 className="text-lg font-black text-white uppercase tracking-wider">{t({ en: 'Certification Details', zh: '安規認證詳情' })}</h4>
                    </div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Intenza Verified</div>
                  </div>
                  <ul className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pr-2">
                    {safetyCertLines.map((line, idx) => (
                      <li key={idx} className="flex items-start gap-4 p-3 bg-white/5 rounded-xl border border-white/5 group/item">
                        <div className="mt-1 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                          <Check size={12} className="text-emerald-500" strokeWidth={4} />
                        </div>
                        <span className="text-sm font-bold text-slate-100 leading-relaxed">{line}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 pt-4 border-t border-white/5 text-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Move cursor away to close</p>
                  </div>
                </div>
              )}

              <div className={`relative ${aspectClassMap[cardAspectRatio] || 'aspect-[3/4]'} bg-slate-50 p-6 flex items-center justify-center overflow-hidden border-b border-slate-50`}>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={t(p.modelName)} className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-100 rounded-2xl">
                    <ImageIcon size={64} className="opacity-10 mb-2" />
                    <span className="text-xs font-black uppercase tracking-widest opacity-30">No Preview</span>
                  </div>
                )}
                
                {canEditThisProduct && (
                  <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                    <button onClick={(e) => { e.stopPropagation(); onToggleWatch(p.id); }} className={`p-2.5 rounded-full transition-all shadow-lg border ${p.isWatched ? 'bg-amber-400 text-white border-amber-300' : 'bg-white/95 text-slate-400 border-slate-100 hover:text-amber-500'}`}>
                      <Star size={18} fill={p.isWatched ? 'currentColor' : 'none'} strokeWidth={2.5} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleStartEdit(p); }} className="p-2.5 bg-white/95 backdrop-blur-sm rounded-full text-slate-400 border border-slate-100 hover:text-slate-900 transition-all shadow-lg">
                      <Pencil size={18} strokeWidth={2.5} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete product?')) onDeleteProduct(p.id); }} className="p-2.5 bg-white/95 backdrop-blur-sm rounded-full text-slate-400 border border-slate-100 hover:text-red-500 transition-all shadow-lg">
                      <Trash2 size={18} strokeWidth={2.5} />
                    </button>
                  </div>
                )}
              </div>

              <div className="p-6 flex-1 flex flex-col">
                <div className="flex flex-col gap-2 mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-black text-slate-900 group-hover:text-intenza-600 transition-colors leading-tight">{t(p.modelName)}</h3>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-black bg-slate-900 text-white px-2.5 py-1 rounded-lg shadow-sm">{displayVersion}</span>
                      {productionInfo && productionInfo.implementationDate && (
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100"><Calendar size={10} /> {productionInfo.implementationDate}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 mb-6">
                  {descriptionLines.length > 0 ? (
                    <ul className="space-y-1">
                      {descriptionLines.map((line, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-500 font-medium leading-relaxed">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-200 mt-1.5 shrink-0" />
                          <span className="line-clamp-2">{line}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-300 italic font-medium">No description provided.</p>
                  )}
                </div>

                <div className="pt-5 border-t-2 border-slate-50 flex items-center justify-between relative">
                  <div className="flex flex-col"><span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">SKU Identity</span><span className="text-sm font-bold text-slate-800 font-mono tracking-tight">{p.sku}</span></div>
                  
                  <div className="flex items-center gap-3">
                    {p.safetyCert && (
                      <div 
                        onMouseEnter={() => setHoveredSafetyId(p.id)}
                        onMouseLeave={() => setHoveredSafetyId(null)}
                        className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 hover:bg-blue-100 transition-colors shadow-sm cursor-help relative z-10"
                      >
                        <ShieldCheck size={20} strokeWidth={2.5} />
                      </div>
                    )}

                    <div className="relative">
                      <button 
                        onClick={(e) => handleStatusLightClick(e, p)}
                        onMouseEnter={() => handleMouseEnterLight(p.id)}
                        onMouseLeave={handleMouseLeaveLight}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-inner relative z-20 ${
                          (canEditThisProduct && canEditLight) ? 'hover:scale-110 active:scale-95' : 'cursor-pointer'
                        } ${
                          statusColor === 'red' ? 'bg-rose-50 hover:bg-rose-100 shadow-rose-200' :
                          statusColor === 'blue' ? 'bg-blue-50 hover:bg-blue-100 shadow-blue-200' :
                          'bg-emerald-50 hover:bg-emerald-100 shadow-emerald-200'
                        }`}
                      >
                        <div className={`${dotSizeClass} rounded-full shadow-lg animate-pulse-slow ${
                          statusColor === 'red' ? 'bg-rose-500 shadow-rose-500/50' :
                          statusColor === 'blue' ? 'bg-blue-500 shadow-blue-500/50' :
                          'bg-emerald-500 shadow-emerald-500/50'
                        }`} />
                      </button>

                      {selectorProductId === p.id && (
                          <div className="absolute bottom-full right-0 mb-4 bg-white border border-slate-200 shadow-2xl rounded-2xl p-2 z-[70] min-w-[140px] animate-slide-up flex flex-col gap-1">
                              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 py-1 border-b border-slate-50 mb-1">Change Status</div>
                              {(['AUTO', 'RED', 'BLUE', 'GREEN'] as const).map(mode => (
                                  <button 
                                      key={mode}
                                      onClick={(e) => { e.stopPropagation(); updateProductStatusDirectly(p, mode); }}
                                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all text-left group/btn ${
                                          (p.statusOverride === mode || (mode === 'AUTO' && !p.statusOverride)) 
                                          ? 'bg-slate-900 text-white' 
                                          : 'bg-white text-slate-600 hover:bg-slate-50'
                                      }`}
                                  >
                                      <span className="flex items-center gap-2">
                                          <div className={`w-2 h-2 rounded-full ${
                                              mode === 'RED' ? 'bg-rose-500' : 
                                              mode === 'BLUE' ? 'bg-blue-500' : 
                                              mode === 'GREEN' ? 'bg-emerald-500' : 'bg-slate-400'
                                          }`} />
                                          {mode === 'AUTO' ? t({ en: 'Auto', zh: '系統自動' }) : mode}
                                      </span>
                                      {(p.statusOverride === mode || (mode === 'AUTO' && !p.statusOverride)) && <Check size={12} />}
                                  </button>
                              ))}
                              <button 
                                  onClick={(e) => { e.stopPropagation(); setSelectorProductId(null); }}
                                  className="mt-1 px-3 py-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-600 text-center"
                              >
                                  {t({ en: 'Cancel', zh: '取消' })}
                              </button>
                          </div>
                      )}

                      {hoveredLightId === p.id && selectorProductId !== p.id && (
                          <div className="absolute bottom-full right-0 mb-4 w-64 p-4 bg-slate-900 text-white rounded-2xl shadow-2xl z-[60] animate-fade-in border border-slate-700/50 backdrop-blur-md">
                          <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2">
                              <Info size={14} className="text-slate-400" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{t({ en: 'Status Guide', zh: '燈號狀態說明' })}</span>
                          </div>
                          <div className="space-y-3">
                              <div className="flex items-start gap-3">
                              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1 shadow-lg shadow-blue-500/40" />
                              <div className="flex-1">
                                  <div className="text-[11px] font-bold text-white leading-none">{t({ en: 'General ECO', zh: '一般設變中' })}</div>
                                  <div className="text-[10px] text-slate-400 mt-1">{t({ en: 'ECO in progress', zh: '設計變更進行中' })}</div>
                              </div>
                              </div>
                              <div className="flex items-start gap-3">
                              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1 shadow-lg shadow-rose-500/40" />
                              <div className="flex-1">
                                  <div className="text-[11px] font-bold text-white leading-none">{t({ en: 'Major ECO', zh: '重大設變中' })}</div>
                                  <div className="text-[10px] text-slate-400 mt-1">{t({ en: 'Safety or Ergonomic changes', zh: '安全、人因重大設變中' })}</div>
                              </div>
                              </div>
                              <div className="flex items-start gap-3">
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shadow-lg shadow-emerald-500/40" />
                              <div className="flex-1">
                                  <div className="text-[11px] font-bold text-white leading-none">{t({ en: 'Ready for Production', zh: '可量產' })}</div>
                                  <div className="text-[10px] text-slate-400 mt-1">{t({ en: 'No pending critical changes', zh: '目前無待處理重大設變' })}</div>
                              </div>
                              </div>
                          </div>
                          </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && canAddProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl animate-slide-up overflow-hidden border border-white/20">
            <div className="flex justify-between items-center p-8 border-b border-slate-100 bg-white sticky top-0 z-10">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{editingProduct ? t({en: 'Edit Product', zh: '編輯產品'}) : t({en: 'Create New Product', zh: '新增產品'})}</h2>
              <button onClick={handleCloseModal} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors active:scale-90"><X size={24} strokeWidth={3} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div onClick={() => fileInputRef.current?.click()} className="relative h-56 bg-slate-50 rounded-3xl border-4 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-slate-400 hover:bg-slate-100 transition-all group overflow-hidden shadow-inner">
                {formData.imageUrl ? (
                  <>
                    <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-contain p-4" />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm">
                      <div className="bg-white text-slate-900 p-3 rounded-full shadow-2xl scale-75 group-hover:scale-100 transition-transform"><Upload size={24} strokeWidth={3} /></div>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-slate-400">
                    {isUploading ? <Loader2 size={40} className="animate-spin text-slate-600 mx-auto" /> : <Upload className="mx-auto mb-3" size={40} strokeWidth={1.5} />}
                    <span className="text-sm font-black uppercase tracking-widest">Upload Image</span>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100">
                   <div className="flex items-center gap-2 mb-4 text-slate-900">
                      <Settings2 size={18} />
                      <h3 className="text-sm font-black uppercase tracking-widest">{t({ en: 'Product Attributes', zh: '產品屬性設定' })}</h3>
                   </div>
                   <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t({ en: 'Safety Cert (Supports Multi-line)', zh: '安規認證詳情 (可換行輸入條列)' })}</label>
                        <textarea 
                          rows={3}
                          placeholder={t({ en: 'e.g. CE / ISO 9001\nPassed Oct 2023', zh: '例如：CE / ISO 9001\n通過日期：2023年10月' })}
                          value={formData.safetyCert} 
                          onChange={(e) => setFormData({...formData, safetyCert: e.target.value})} 
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-intenza-600 outline-none text-xs font-bold resize-none"
                        />
                      </div>

                      {canEditLight && (
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t({ en: 'Light Override', zh: '指示燈狀態手動覆蓋' })}</label>
                          <div className="grid grid-cols-4 gap-2">
                              {['AUTO', 'RED', 'BLUE', 'GREEN'].map(mode => (
                                <button 
                                  key={mode}
                                  type="button"
                                  onClick={() => setFormData({...formData, statusOverride: mode as any})}
                                  className={`py-2 px-1 rounded-xl text-[10px] font-bold border-2 transition-all ${
                                      formData.statusOverride === mode 
                                      ? 'bg-slate-900 text-white border-slate-900' 
                                      : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'
                                  }`}
                                >
                                    {mode === 'AUTO' ? t({ en: 'Auto', zh: '自動' }) : mode}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                   </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="col-span-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Model Name</label>
                  <input required type="text" value={formData.modelName} onChange={(e) => setFormData({...formData, modelName: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 focus:bg-white outline-none transition-all font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">SKU ID</label>
                  <input required type="text" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 focus:bg-white outline-none transition-all font-bold font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Product Series</label>
                  <select value={t(formData.series)} onChange={(e) => { const series = seriesList.find(s => t(s) === e.target.value); if (series) setFormData({...formData, series}); }} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 focus:bg-white outline-none transition-all font-bold">
                    {seriesList.map(s => <option key={t(s)} value={t(s)}>{t(s)}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Product Description</label>
                <textarea rows={6} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 focus:bg-white outline-none transition-all resize-none font-medium" placeholder="Describe main features..." />
              </div>

              <div className="flex gap-4 pt-6 sticky bottom-0 bg-white/80 backdrop-blur-md">
                <button type="button" onClick={handleCloseModal} className="flex-1 py-4 text-slate-600 font-black uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-4 bg-slate-900 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all shadow-2xl shadow-slate-900/30 flex items-center justify-center gap-2 disabled:opacity-50">
                  {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} strokeWidth={3} />}
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
