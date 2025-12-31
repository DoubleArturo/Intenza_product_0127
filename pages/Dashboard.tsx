import React, { useState, useRef, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronRight, X, Upload, Pencil, Save, Star, ArrowLeft, ArrowRight, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';
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

export const Dashboard: React.FC<DashboardProps> = ({ products, seriesList, onAddProduct, onUpdateProduct, onToggleWatch, onMoveProduct, onDeleteProduct }) => {
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


  const filteredProducts = products.filter(p => {
    const matchesSearch = t(p.modelName).toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeries = selectedSeries === 'ALL' || t(p.series) === selectedSeries;
    return matchesSearch && matchesSeries;
  }).sort((a, b) => {
    // 按照型號名稱由小至大排序，使用 numeric: true 確保數字部分正確比較 (例如 450 < 550)
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
        modelName: { en: '', zh: '', [language]: formData.modelName },
        sku: formData.sku,
        imageUrl: formData.imageUrl,
        currentVersion: formData.version,
        description: { en: '', zh: '', [language]: formData.description || 'No description available.' },
      };
      await onAddProduct(newProductData as any);
    }
    setIsSubmitting(false);
    handleCloseModal();
  };

  return (
    <div className="p-8 w-full mx-auto relative">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t({ en: 'Product Portfolio', zh: '產品組合'})}</h1>
          <p className="text-slate-500 mt-1">{t({ en: 'Manage design quality across all series.', zh: '管理所有系列的設計品質。'})}</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-slate-900/20"
        >
          <Plus size={18} />
          {t({ en: 'New Product', zh: '新增產品'})}
        </button>
      </header>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-6 mb-8 items-start md:items-center">
        <div className="flex items-center bg-slate-100 rounded-lg p-1 overflow-x-auto max-w-full no-scrollbar">
          {seriesTabs.map((s) => (
            <button
              key={s}
              onClick={() => setSelectedSeries(s)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
                selectedSeries === s 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {s === 'ALL' ? t({ en: 'All Series', zh: '所有系列'}) : s}
            </button>
          ))}
        </div>
        
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder={t({ en: 'Search by model or SKU...', zh: '搜尋型號或 SKU...'})}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-intenza-500/20 transition-all shadow-sm text-sm"
          />
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {filteredProducts.map((p) => (
          <div 
            key={p.id} 
            className="group bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-300 overflow-hidden flex flex-col cursor-pointer"
            onClick={() => navigate(`/product/${p.id}`)}
          >
            {/* Image Container */}
            <div className="relative h-56 bg-slate-100 overflow-hidden">
              {p.imageUrl ? (
                <img 
                  src={p.imageUrl} 
                  alt={t(p.modelName)} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                  <ImageIcon size={48} className="opacity-20 mb-2" />
                  <span className="text-xs font-medium uppercase tracking-widest opacity-40">No Image</span>
                </div>
              )}
              
              {/* Removed Series Tag from Top-Left as requested */}

              <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                <button 
                  onClick={(e) => { e.stopPropagation(); onToggleWatch(p.id); }}
                  className={`p-2 rounded-full transition-all shadow-sm ${p.isWatched ? 'bg-amber-400 text-white' : 'bg-white/90 text-slate-400 hover:text-amber-500'}`}
                >
                  <Star size={16} fill={p.isWatched ? 'currentColor' : 'none'} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleStartEdit(p); }}
                  className="p-2 bg-white/90 backdrop-blur-sm rounded-full text-slate-400 hover:text-slate-900 transition-all shadow-sm"
                >
                  <Pencil size={16} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete product?')) onDeleteProduct(p.id); }}
                  className="p-2 bg-white/90 backdrop-blur-sm rounded-full text-slate-400 hover:text-red-500 transition-all shadow-sm"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/60 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                 <span className="text-[10px] font-bold text-white uppercase tracking-widest">{t({en: 'View Details', zh: '查看詳情'})}</span>
              </div>
            </div>

            {/* Content Container */}
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-intenza-600 transition-colors line-clamp-1">{t(p.modelName)}</h3>
                <span className="text-[10px] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-500">{p.currentVersion}</span>
              </div>
              
              <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed flex-1">
                {t(p.description)}
              </p>

              <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">SKU ID</span>
                  <span className="text-[11px] font-mono text-slate-700">{p.sku}</span>
                </div>
                <div className="flex items-center text-slate-300 group-hover:text-intenza-600 transition-colors">
                  <ChevronRight size={20} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl animate-slide-up overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white sticky top-0 z-10">
              <h2 className="text-xl font-bold text-slate-900">{editingProduct ? t({en: 'Edit Product', zh: '編輯產品'}) : t({en: 'Create New Product', zh: '新增產品'})}</h2>
              <button onClick={handleCloseModal} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Image Upload Area */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative h-48 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-intenza-400 hover:bg-intenza-50 transition-all group overflow-hidden"
              >
                {formData.imageUrl ? (
                  <>
                    <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Upload className="text-white" size={32} />
                    </div>
                  </>
                ) : (
                  <div className="text-center text-slate-400">
                    {isUploading ? <Loader2 size={32} className="animate-spin text-intenza-600 mx-auto" /> : <Upload className="mx-auto mb-2" size={32} />}
                    <span className="text-sm font-medium">Click to upload product image</span>
                    <span className="text-[10px] block mt-1">Recommended 800x600px</span>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Model Name ({language.toUpperCase()})</label>
                  <input required type="text" value={formData.modelName} onChange={(e) => setFormData({...formData, modelName: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-intenza-500/20 outline-none transition-all" placeholder="e.g. 550Te2 Treadmill" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">SKU ID</label>
                  <input required type="text" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-intenza-500/20 outline-none transition-all" placeholder="e.g. TR-550-DL" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Product Series</label>
                  <select 
                    value={t(formData.series)} 
                    onChange={(e) => {
                      const series = seriesList.find(s => t(s) === e.target.value);
                      if (series) setFormData({...formData, series});
                    }}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-intenza-500/20 outline-none transition-all"
                  >
                    {seriesList.map(s => <option key={t(s)} value={t(s)}>{t(s)}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Initial Version</label>
                  <input required type="text" value={formData.version} onChange={(e) => setFormData({...formData, version: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-intenza-500/20 outline-none transition-all" placeholder="e.g. v1.0" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Product Description</label>
                <textarea rows={4} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-intenza-500/20 outline-none transition-all resize-none" placeholder="Provide a brief overview of the product's design target..." />
              </div>

              <div className="flex gap-4 pt-4 sticky bottom-0 bg-white">
                <button type="button" onClick={handleCloseModal} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-all border border-transparent">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2">
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {editingProduct ? 'Save Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};