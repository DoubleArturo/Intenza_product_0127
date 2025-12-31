import React, { useState, useRef, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronRight, X, Upload, Pencil, Save, Star, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { ProductModel, LocalizedString, EcoStatus } from '../types';
import { LanguageContext } from '../App';
import { api } from '../services/api';

interface DashboardProps {
  products: ProductModel[];
  seriesList: LocalizedString[];
  onAddProduct: (productData: Omit<ProductModel, 'id' | 'ergoProjects' | 'customerFeedback' | 'designHistory' | 'ergoTests' | 'durabilityTests'>) => Promise<void>;
  onUpdateProduct: (product: ProductModel) => Promise<void>;
  onToggleWatch: (id: string) => void;
  onMoveProduct: (id: string, direction: 'left' | 'right') => void;
  onDeleteProduct: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ products, seriesList, onAddProduct, onUpdateProduct, onToggleWatch, onDeleteProduct }) => {
  const navigate = useNavigate();
  const { language, t } = useContext(LanguageContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeries, setSelectedSeries] = useState<string>('ALL');
  
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
    imageUrl: ''
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (isModalOpen) {
      if (editingProduct) {
        setFormData({
          series: editingProduct.series,
          modelName: t(editingProduct.modelName),
          sku: editingProduct.sku,
          version: editingProduct.currentVersion,
          description: t(editingProduct.description),
          imageUrl: editingProduct.imageUrl
        });
      } else {
        setFormData({
          series: seriesList[0] || { en: 'Uncategorized', zh: '未分類' },
          modelName: '',
          sku: '',
          version: 'v1.0',
          description: '',
          imageUrl: ''
        });
      }
    }
  }, [isModalOpen, editingProduct, seriesList, t]);

  // 優化篩選與排序邏輯
  const filteredProducts = products.filter(p => {
    const modelStr = t(p.modelName).toLowerCase();
    const skuStr = p.sku.toLowerCase();
    const searchStr = searchTerm.toLowerCase();
    
    const matchesSearch = modelStr.includes(searchStr) || skuStr.includes(searchStr);
    const matchesSeries = selectedSeries === 'ALL' || t(p.series) === selectedSeries;
    
    return matchesSearch && matchesSeries;
  }).sort((a, b) => {
    // 嚴格按照型號名稱由小到大排序 (A-Z, 0-9)
    return t(a.modelName).localeCompare(t(b.modelName), undefined, { numeric: true, sensitivity: 'base' });
  });

  const seriesTabs = ['ALL', ...seriesList.map(s => t(s))];
  
  const handleStartEdit = (product: ProductModel) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setIsSubmitting(true);
    
    if (editingProduct) {
      const updatedModelName = { ...editingProduct.modelName, [language]: formData.modelName };
      const updatedDescription = { ...editingProduct.description, [language]: formData.description };

      await onUpdateProduct({
        ...editingProduct,
        series: formData.series,
        modelName: updatedModelName,
        description: updatedDescription,
        sku: formData.sku,
        imageUrl: formData.imageUrl || editingProduct.imageUrl,
        currentVersion: formData.version,
      });
    } else {
      const newProductData = {
        series: formData.series,
        modelName: { en: formData.modelName, zh: formData.modelName, [language]: formData.modelName },
        sku: formData.sku,
        imageUrl: formData.imageUrl,
        currentVersion: formData.version,
        description: { en: formData.description, zh: formData.description, [language]: formData.description || 'No description available.' },
      };
      await onAddProduct(newProductData as any);
    }
    setIsSubmitting(false);
    handleCloseModal();
  };

  return (
    <div className="p-8 w-full mx-auto relative">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">{t({ en: 'Product Portfolio', zh: '產品組合'})}</h1>
          <p className="text-slate-500 mt-2 font-medium">{t({ en: 'Manage design quality across all series.', zh: '管理所有系列的設計品質。'})}</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-xl shadow-slate-900/20 active:scale-95"
        >
          <Plus size={20} strokeWidth={3} />
          {t({ en: 'New Product', zh: '新增產品'})}
        </button>
      </header>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-6 mb-10 items-start md:items-center">
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
        
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder={t({ en: 'Search by model or SKU...', zh: '搜尋型號或 SKU...'})}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-slate-900 transition-all shadow-sm text-sm font-medium"
          />
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {filteredProducts.map((p) => (
          <div 
            key={p.id} 
            className="group bg-white rounded-[2rem] border-2 border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-slate-200/60 hover:border-slate-200 transition-all duration-300 overflow-hidden flex flex-col cursor-pointer active:scale-[0.98]"
            onClick={() => navigate(`/product/${p.id}`)}
          >
            {/* Image Container - Use object-contain to prevent cutting */}
            <div className="relative h-64 bg-slate-50 p-6 flex items-center justify-center overflow-hidden border-b border-slate-50">
              {p.imageUrl ? (
                <img 
                  src={p.imageUrl} 
                  alt={t(p.modelName)} 
                  className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105" 
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-100 rounded-2xl">
                  <ImageIcon size={64} className="opacity-10 mb-2" />
                  <span className="text-xs font-black uppercase tracking-widest opacity-30">No Preview</span>
                </div>
              )}
              
              <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                <button 
                  onClick={(e) => { e.stopPropagation(); onToggleWatch(p.id); }}
                  className={`p-2.5 rounded-full transition-all shadow-lg border ${p.isWatched ? 'bg-amber-400 text-white border-amber-300' : 'bg-white/95 text-slate-400 border-slate-100 hover:text-amber-500'}`}
                >
                  <Star size={18} fill={p.isWatched ? 'currentColor' : 'none'} strokeWidth={2.5} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleStartEdit(p); }}
                  className="p-2.5 bg-white/95 backdrop-blur-sm rounded-full text-slate-400 border border-slate-100 hover:text-slate-900 transition-all shadow-lg"
                >
                  <Pencil size={18} strokeWidth={2.5} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete product?')) onDeleteProduct(p.id); }}
                  className="p-2.5 bg-white/95 backdrop-blur-sm rounded-full text-slate-400 border border-slate-100 hover:text-red-500 transition-all shadow-lg"
                >
                  <Trash2 size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Content Container */}
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex flex-col gap-2 mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-black text-slate-900 group-hover:text-intenza-600 transition-colors leading-tight">
                    {t(p.modelName)}
                  </h3>
                  <span className="text-[11px] font-black bg-slate-900 text-white px-2.5 py-1 rounded-lg shadow-sm">
                    {p.currentVersion}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                  {t(p.series)}
                </span>
              </div>
              
              <p className="text-sm text-slate-500 line-clamp-2 mb-6 leading-relaxed flex-1 font-medium">
                {t(p.description)}
              </p>

              <div className="pt-5 border-t-2 border-slate-50 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">SKU Identity</span>
                  <span className="text-sm font-bold text-slate-800 font-mono tracking-tight">{p.sku}</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-intenza-500 group-hover:text-white transition-all shadow-inner group-hover:shadow-lg group-hover:shadow-intenza-500/30">
                  <ChevronRight size={24} strokeWidth={3} />
                </div>
              </div>
            </div>
          </div>
        ))}
        {filteredProducts.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 animate-fade-in">
             <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Search size={32} className="opacity-20" />
             </div>
             <p className="font-bold text-lg">No products found</p>
             <p className="text-sm">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>

      {/* Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl animate-slide-up overflow-hidden border border-white/20">
            <div className="flex justify-between items-center p-8 border-b border-slate-100 bg-white sticky top-0 z-10">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{editingProduct ? t({en: 'Edit Product', zh: '編輯產品'}) : t({en: 'Create New Product', zh: '新增產品'})}</h2>
              <button onClick={handleCloseModal} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors active:scale-90"><X size={24} strokeWidth={3} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {/* Image Upload Area */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative h-56 bg-slate-50 rounded-3xl border-4 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-slate-400 hover:bg-slate-100 transition-all group overflow-hidden shadow-inner"
              >
                {formData.imageUrl ? (
                  <>
                    <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-contain p-4" />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm">
                      <div className="bg-white text-slate-900 p-3 rounded-full shadow-2xl scale-75 group-hover:scale-100 transition-transform">
                        <Upload size={24} strokeWidth={3} />
                      </div>
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

              <div className="grid grid-cols-2 gap-8">
                <div className="col-span-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Model Name</label>
                  <input required type="text" value={formData.modelName} onChange={(e) => setFormData({...formData, modelName: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 focus:bg-white outline-none transition-all font-bold" placeholder="e.g. 550Te2 Treadmill" />
                </div>
                
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">SKU ID</label>
                  <input required type="text" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 focus:bg-white outline-none transition-all font-bold font-mono" placeholder="TR-550-DL" />
                </div>
                
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Product Series</label>
                  <select 
                    value={t(formData.series)} 
                    onChange={(e) => {
                      const series = seriesList.find(s => t(s) === e.target.value);
                      if (series) setFormData({...formData, series});
                    }}
                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 focus:bg-white outline-none transition-all font-bold"
                  >
                    {seriesList.map(s => <option key={t(s)} value={t(s)}>{t(s)}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Initial Version</label>
                  <input required type="text" value={formData.version} onChange={(e) => setFormData({...formData, version: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 focus:bg-white outline-none transition-all font-bold" placeholder="v1.0" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Product Description</label>
                <textarea rows={4} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 focus:bg-white outline-none transition-all resize-none font-medium" placeholder="Describe the design target..." />
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