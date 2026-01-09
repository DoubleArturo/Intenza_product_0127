
import React, { useState, useRef, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronRight, X, Upload, Pencil, Save, Star, Trash2, Image as ImageIcon, Loader2, ArrowUpDown, Calendar, Info, Settings2, Check, ShieldCheck } from 'lucide-react';
import { ProductModel, LocalizedString, EcoStatus, UserAccount } from '../types';
import { LanguageContext } from '../App';
import { api } from '../services/api';

interface DashboardProps {
  products: ProductModel[];
  seriesList: LocalizedString[];
  user?: {username: string, role: 'admin' | 'user' | 'uploader' | 'viewer', permissions?: UserAccount['permissions']};
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
  products, seriesList, user, globalStatusLightSize, dashboardColumns, cardAspectRatio,
  onAddProduct, onUpdateProduct, onToggleWatch, onDeleteProduct 
}) => {
  const navigate = useNavigate();
  const { language, t } = useContext(LanguageContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeries, setSelectedSeries] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<SortType>('SKU_ASC');
  
  const [hoveredLightId, setHoveredLightId] = useState<string | null>(null);
  const [hoveredSafetyId, setHoveredSafetyId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectorProductId, setSelectorProductId] = useState<string | null>(null);

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

  // 權限檢查輔助函數
  const checkPermission = (product: ProductModel | null, action: 'EDIT' | 'SYNC'): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'viewer') return false;
    if (!user.permissions) return user.role !== 'viewer';

    const seriesName = product ? t(product.series) : t(formData.series);
    const sku = product ? product.sku : formData.sku;

    // 優先檢查 SKU 權限
    const skuPerm = user.permissions.skuAccess[sku];
    if (skuPerm) {
      // 在 Dashboard 層級，如果三個模組任一有權限即視為可進入，但具體操作受限
      if (action === 'EDIT') return skuPerm.design.canEdit || skuPerm.ergo.canEdit || skuPerm.durability.canEdit;
      if (action === 'SYNC') return skuPerm.design.canSync || skuPerm.ergo.canSync || skuPerm.durability.canSync;
    }

    // 檢查系列權限
    const seriesPerm = user.permissions.seriesAccess[seriesName];
    if (seriesPerm) {
      if (action === 'EDIT') return seriesPerm.canEdit;
      if (action === 'SYNC') return seriesPerm.canSync;
    }

    return user.role === 'uploader' || user.role === 'user';
  };

  const isViewer = user?.role === 'viewer';
  const isAdmin = user?.role === 'admin';
  const canCreate = isAdmin || (user?.role !== 'viewer' && user?.role !== 'uploader'); // 保持簡化，管理者權限可進一步調整
  
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
    const matchesSearch = t(p.modelName).toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeries = selectedSeries === 'ALL' || t(p.series) === selectedSeries;
    return matchesSearch && matchesSeries;
  }).sort((a, b) => {
    if (a.isWatched && !b.isWatched) return -1;
    if (!a.isWatched && b.isWatched) return 1;
    if (sortOrder === 'SKU_ASC') return a.sku.localeCompare(b.sku, undefined, { numeric: true });
    if (sortOrder === 'SKU_DESC') return b.sku.localeCompare(a.sku, undefined, { numeric: true });
    return t(a.modelName).localeCompare(t(b.modelName), undefined, { numeric: true, sensitivity: 'base' });
  });

  const seriesTabs = ['ALL', ...seriesList.map(s => t(s))];
  const handleStartEdit = (product: ProductModel) => {
    if (!checkPermission(product, 'EDIT')) return;
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => { setIsModalOpen(false); setEditingProduct(null); };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try { const blobUrl = await api.uploadImage(file); setFormData({ ...formData, imageUrl: blobUrl }); } finally { setIsUploading(false); }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (editingProduct) {
      await onUpdateProduct({
        ...editingProduct,
        series: formData.series,
        modelName: { en: formData.modelName, zh: formData.modelName },
        description: { en: formData.description, zh: formData.description },
        sku: formData.sku,
        imageUrl: formData.imageUrl || editingProduct.imageUrl,
        currentVersion: formData.version,
        safetyCert: formData.safetyCert,
        statusOverride: formData.statusOverride
      });
    } else {
      await onAddProduct({
        series: formData.series,
        modelName: { en: formData.modelName, zh: formData.modelName },
        sku: formData.sku,
        imageUrl: formData.imageUrl,
        currentVersion: formData.version,
        description: { en: formData.description, zh: formData.description },
        safetyCert: formData.safetyCert,
        statusOverride: formData.statusOverride
      } as any);
    }
    setIsSubmitting(false);
    handleCloseModal();
  };

  const getProductStatusColor = (p: ProductModel): 'red' | 'blue' | 'green' => {
    if (p.statusOverride && p.statusOverride !== 'AUTO') return p.statusOverride.toLowerCase() as any;
    const pendingEcos = p.designHistory.filter(h => h.status !== EcoStatus.IN_PRODUCTION && h.status !== EcoStatus.DESIGN_COMPLETE);
    if (pendingEcos.length === 0) return 'green';
    const isMajor = pendingEcos.some(eco => {
      const desc = t(eco.description).toLowerCase();
      return (eco.sourceFeedbacks && eco.sourceFeedbacks.length > 0) || desc.includes('safety') || desc.includes('安全') || desc.includes('major') || desc.includes('重大') || desc.includes('ergo') || desc.includes('人因');
    });
    return isMajor ? 'red' : 'blue';
  };

  return (
    <div className="p-8 w-full mx-auto relative">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">{t({ en: 'Product Design Status', zh: '產品設計狀態'})}</h1>
          <p className="text-slate-500 mt-2 font-medium">{t({ en: 'Manage design quality across all series.', zh: '管理所有系列的設計品質。'})}</p>
        </div>
        {canCreate && (
          <button onClick={() => setIsModalOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-xl active:scale-95">
            <Plus size={20} strokeWidth={3} /> {t({ en: 'New Product', zh: '新增產品'})}
          </button>
        )}
      </header>

      <div className="flex flex-col xl:flex-row gap-6 mb-10 items-start xl:items-center">
        <div className="flex items-center bg-slate-200/50 rounded-xl p-1.5 overflow-x-auto max-w-full no-scrollbar shadow-inner">
          {seriesTabs.map((s) => (
            <button key={s} onClick={() => setSelectedSeries(s)} className={`px-5 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${selectedSeries === s ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
              {s === 'ALL' ? t({ en: 'All Series', zh: '所有系列'}) : s}
            </button>
          ))}
        </div>
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input type="text" placeholder={t({ en: 'Search by model or SKU...', zh: '搜尋型號或 SKU...'})} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-slate-900 transition-all text-sm font-medium" />
        </div>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${gridColsClassMap[dashboardColumns] || 'xl:grid-cols-4'} gap-8`}>
        {filteredProducts.map((p) => {
          const statusColor = getProductStatusColor(p);
          const dotSizeClass = globalStatusLightSize === 'SMALL' ? 'w-3 h-3' : globalStatusLightSize === 'LARGE' ? 'w-6 h-6' : 'w-4 h-4';
          const descriptionLines = t(p.description).split('\n').filter(l => l.trim().length > 0);
          const safetyCertLines = (p.safetyCert || '').split('\n').filter(l => l.trim().length > 0);
          const canEditThis = checkPermission(p, 'EDIT');

          return (
            <div key={p.id} className="group bg-white rounded-[2rem] border-2 border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-300 overflow-hidden flex flex-col cursor-pointer relative" onClick={() => navigate(`/product/${p.id}`)}>
              {/* 安規懸停滿版顯示 - 修復 pointer-events-none */}
              {hoveredSafetyId === p.id && safetyCertLines.length > 0 && (
                <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-md z-[60] p-8 animate-fade-in flex flex-col pointer-events-none">
                  <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4"><ShieldCheck size={24} className="text-blue-400" /><h4 className="text-lg font-black text-white uppercase tracking-wider">{t({ en: 'Certification Details', zh: '安規認證詳情' })}</h4></div>
                  <ul className="space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                    {safetyCertLines.map((line, idx) => (
                      <li key={idx} className="flex items-start gap-4 p-3 bg-white/5 rounded-xl border border-white/5"><div className="mt-1 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center"><Check size={12} className="text-emerald-500" strokeWidth={4} /></div><span className="text-sm font-bold text-slate-100">{line}</span></li>
                    ))}
                  </ul>
                </div>
              )}

              <div className={`relative ${aspectClassMap[cardAspectRatio] || 'aspect-[3/4]'} bg-slate-50 p-6 flex items-center justify-center overflow-hidden border-b border-slate-50`}>
                {p.imageUrl ? <img src={p.imageUrl} alt={t(p.modelName)} className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105" /> : <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-100 rounded-2xl"><ImageIcon size={64} className="opacity-10 mb-2" /><span className="text-xs font-black uppercase tracking-widest opacity-30">No Preview</span></div>}
                
                <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button onClick={(e) => { e.stopPropagation(); onToggleWatch(p.id); }} className={`p-2.5 rounded-full shadow-lg border ${p.isWatched ? 'bg-amber-400 text-white border-amber-300' : 'bg-white/95 text-slate-400 border-slate-100 hover:text-amber-500'}`}><Star size={18} fill={p.isWatched ? 'currentColor' : 'none'} strokeWidth={2.5} /></button>
                  {canEditThis && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); handleStartEdit(p); }} className="p-2.5 bg-white/95 rounded-full text-slate-400 border border-slate-100 hover:text-slate-900 shadow-lg"><Pencil size={18} strokeWidth={2.5} /></button>
                      <button onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete?')) onDeleteProduct(p.id); }} className="p-2.5 bg-white/95 rounded-full text-slate-400 border border-slate-100 hover:text-red-500 shadow-lg"><Trash2 size={18} strokeWidth={2.5} /></button>
                    </>
                  )}
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col">
                <div className="flex flex-col gap-2 mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-black text-slate-900 group-hover:text-intenza-600 transition-colors leading-tight">{t(p.modelName)}</h3>
                    <span className="text-[11px] font-black bg-slate-900 text-white px-2.5 py-1 rounded-lg">{p.currentVersion}</span>
                  </div>
                </div>
                <div className="flex-1 mb-6">
                  {descriptionLines.length > 0 ? (
                    <ul className="space-y-1">
                      {descriptionLines.map((line, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-500 font-medium leading-relaxed"><div className="w-1.5 h-1.5 rounded-full bg-slate-200 mt-1.5 shrink-0" /><span className="line-clamp-2">{line}</span></li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-slate-300 italic font-medium">No description.</p>}
                </div>

                <div className="pt-5 border-t-2 border-slate-50 flex items-center justify-between relative">
                  <div className="flex flex-col"><span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">SKU Identity</span><span className="text-sm font-bold text-slate-800 font-mono">{p.sku}</span></div>
                  <div className="flex items-center gap-3">
                    {p.safetyCert && (
                      <div onMouseEnter={() => setHoveredSafetyId(p.id)} onMouseLeave={() => setHoveredSafetyId(null)} className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 hover:bg-blue-100 shadow-sm cursor-help relative z-10"><ShieldCheck size={20} strokeWidth={2.5} /></div>
                    )}
                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); if (canEditThis) setSelectorProductId(p.id); }} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-inner ${canEditThis ? 'hover:scale-110' : 'cursor-default'} ${statusColor === 'red' ? 'bg-rose-50' : statusColor === 'blue' ? 'bg-blue-50' : 'bg-emerald-50'}`}>
                        <div className={`${dotSizeClass} rounded-full shadow-lg ${statusColor === 'red' ? 'bg-rose-500 shadow-rose-500/50' : statusColor === 'blue' ? 'bg-blue-500 shadow-blue-500/50' : 'bg-emerald-500 shadow-emerald-500/50'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && !isViewer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl animate-slide-up overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <h2 className="text-2xl font-black text-slate-900">{editingProduct ? t({en: 'Edit Product', zh: '編輯產品'}) : t({en: 'Create New Product', zh: '新增產品'})}</h2>
              <button onClick={handleCloseModal} className="p-2 rounded-full hover:bg-slate-100 text-slate-500"><X size={24} strokeWidth={3} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div onClick={() => fileInputRef.current?.click()} className="relative h-56 bg-slate-50 rounded-3xl border-4 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-slate-400 group overflow-hidden">
                {formData.imageUrl ? <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-contain p-4" /> : <div className="text-center text-slate-400"><Upload className="mx-auto mb-3" size={40} strokeWidth={1.5} /><span className="text-sm font-black uppercase tracking-widest">Upload Image</span></div>}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">安規認證詳情 (可換行輸入)</label>
                  <textarea rows={3} value={formData.safetyCert} onChange={(e) => setFormData({...formData, safetyCert: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-xs font-bold resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-3">Model Name</label>
                  <input required type="text" value={formData.modelName} onChange={(e) => setFormData({...formData, modelName: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div><label className="block text-xs font-black text-slate-400 uppercase mb-3">SKU ID</label><input required type="text" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold font-mono" /></div>
                  <div><label className="block text-xs font-black text-slate-400 uppercase mb-3">Product Series</label><select value={t(formData.series)} onChange={(e) => { const s = seriesList.find(sl => t(sl) === e.target.value); if (s) setFormData({...formData, series: s}); }} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold">{seriesList.map(s => <option key={t(s)} value={t(s)}>{t(s)}</option>)}</select></div>
                </div>
                <div><label className="block text-xs font-black text-slate-400 uppercase mb-3">Product Description</label><textarea rows={6} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none resize-none" /></div>
              </div>
              <div className="flex gap-4 pt-6 sticky bottom-0 bg-white/80 backdrop-blur-md">
                <button type="button" onClick={handleCloseModal} className="flex-1 py-4 text-slate-600 font-black uppercase hover:bg-slate-50 rounded-2xl transition-all">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-4 bg-slate-900 text-white font-black uppercase rounded-2xl shadow-2xl flex items-center justify-center gap-2">
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
