import React, { useState, useRef, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronRight, X, Upload, Pencil, Save, Star, ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import { ProductModel, LocalizedString, EcoStatus } from '../types';
import { LanguageContext } from '../App';

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
  
  // Effect to populate form for editing or reset for adding
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
    // 1. Sort by Watch status (Pinned to top)
    if (a.isWatched !== b.isWatched) {
        return a.isWatched ? -1 : 1;
    }
    // 2. Sort by Custom Sort Order
    if (a.customSortOrder !== b.customSortOrder) {
        return a.customSortOrder - b.customSortOrder;
    }
    // 3. Fallback to Name
    return t(a.modelName).localeCompare(t(b.modelName));
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setFormData({ ...formData, imageUrl: url });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    if (editingProduct) {
      // Create updated localized strings
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
              {s === 'ALL' ? t({ en: 'All Series', zh: '所有系列'}) : s.replace(' Series', '').replace(' 系列','')}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder={t({ en: "Search SKU or Model...", zh: "搜索 SKU 或型號..."})} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-intenza-500/20 focus:border-intenza-500 transition-all"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 animate-fade-in">
        {filteredProducts.map((product) => (
          <ProductCard 
            key={product.id} 
            product={product} 
            onClick={() => navigate(`/product/${product.id}`)}
            onEdit={(e) => {
              e.stopPropagation();
              handleStartEdit(product);
            }}
            onToggleWatch={(e) => {
              e.stopPropagation();
              onToggleWatch(product.id);
            }}
            onMove={(dir) => onMoveProduct(product.id, dir)}
            onDelete={() => onDeleteProduct(product.id)}
          />
        ))}
      </div>

      {/* Add/Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white sticky top-0 z-10">
              <h2 className="text-xl font-bold text-slate-900">
                {editingProduct ? t({ en: 'Edit Product', zh: '編輯產品'}) : t({ en: 'Add New Product', zh: '新增產品'})}
              </h2>
              <button 
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6">
              <form id="productForm" onSubmit={handleSubmit} className="space-y-6">
                 <div>
                   <label className="block text-sm font-medium text-slate-900 mb-2">{t({ en: 'Product Visualization', zh: '產品視覺化'})}</label>
                   <div 
                     onClick={() => fileInputRef.current?.click()}
                     className="relative h-48 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:border-intenza-400 hover:bg-intenza-50 transition-all overflow-hidden group"
                   >
                     {formData.imageUrl ? (
                       <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                     ) : (
                       <div className="text-center p-4">
                         <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-3 text-slate-400 group-hover:text-intenza-500 transition-colors">
                           <Upload size={20} />
                         </div>
                         <p className="text-sm font-medium text-slate-600">{t({ en: 'Click to upload product image', zh: '點擊上傳產品圖片'})}</p>
                         <p className="text-xs text-slate-400 mt-1">{t({ en: 'Supports JPG, PNG (Max 2MB)', zh: '支援 JPG, PNG (最大 2MB)'})}</p>
                       </div>
                     )}
                     <input 
                       ref={fileInputRef}
                       type="file" 
                       accept="image/*"
                       className="hidden"
                       onChange={handleImageUpload}
                     />
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-900 mb-1">{t({ en: 'Series', zh: '系列'})}</label>
                      <select 
                        value={t(formData.series)}
                        onChange={(e) => {
                          const selected = seriesList.find(s => t(s) === e.target.value);
                          if(selected) setFormData({...formData, series: selected});
                        }}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-intenza-500/20 text-slate-900"
                      >
                        {seriesList.map(s => (
                          <option key={t(s)} value={t(s)}>{t(s)}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-900 mb-1">{t({ en: 'Model Name', zh: '型號名稱'})}</label>
                      <input 
                        required
                        type="text" 
                        placeholder={t({ en: 'e.g. 550Te2 Treadmill', zh: '例如 550Te2 跑步機'})}
                        value={formData.modelName}
                        onChange={(e) => setFormData({...formData, modelName: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-intenza-500/20 text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                     <div>
                      <label className="block text-sm font-medium text-slate-900 mb-1">{t({ en: 'SKU', zh: 'SKU'})}</label>
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. TR-550-DL"
                        value={formData.sku}
                        onChange={(e) => setFormData({...formData, sku: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-intenza-500/20 text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-900 mb-1">{t({ en: 'Initial Version', zh: '初始版本'})}</label>
                      <input 
                        type="text" 
                        placeholder="v1.0"
                        value={formData.version}
                        onChange={(e) => setFormData({...formData, version: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-intenza-500/20 text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">{t({ en: 'Description', zh: '描述'})}</label>
                  <textarea 
                    rows={3}
                    placeholder={t({ en: 'Brief product description and key features...', zh: '簡要產品描述和主要特點...'})}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-intenza-500/20 resize-none text-slate-900"
                  />
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 sticky bottom-0">
              <button 
                type="button"
                onClick={handleCloseModal}
                className="px-5 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
              >
                {t({ en: 'Cancel', zh: '取消'})}
              </button>
              <button 
                form="productForm"
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-intenza-600 hover:bg-intenza-700 text-white font-medium rounded-lg shadow-lg shadow-intenza-500/30 transition-all flex items-center gap-2 disabled:bg-intenza-300"
              >
                {isSubmitting ? <span className="animate-spin">⌛</span> : (editingProduct ? <Save size={18} /> : <Plus size={18} />)}
                {editingProduct ? t({ en: 'Save Changes', zh: '儲存變更'}) : t({ en: 'Create Product', zh: '建立產品'})}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ProductCardProps {
  product: ProductModel;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onToggleWatch: (e: React.MouseEvent) => void;
  onMove: (direction: 'left' | 'right') => void;
  onDelete: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onClick, onEdit, onToggleWatch, onMove, onDelete }) => {
  const { t } = useContext(LanguageContext);
  const activeIssues = product.designHistory.filter(
    (eco) => eco.status !== EcoStatus.IN_PRODUCTION
  ).length;
  
  const currentVerEco = product.designHistory.find(
      h => h.version === product.currentVersion && h.status === EcoStatus.IN_PRODUCTION
  );

  return (
    <div 
      onClick={onClick}
      className={`group bg-white rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden flex flex-col ${product.isWatched ? 'border-amber-200 shadow-lg shadow-amber-500/10' : 'border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1'}`}
    >
      <div className="relative h-56 bg-slate-50 overflow-hidden">
        {product.imageUrl ? (
          <img 
            src={product.imageUrl} 
            alt={t(product.modelName)} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
             <div className="text-center">
               <p className="text-xs font-bold">{t(product.modelName)}</p>
               <p className="text-xs">{product.sku}</p>
             </div>
          </div>
        )}
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-slate-700 shadow-sm">
          {t(product.series).split(' ')[0]}
        </div>
        
        {/* Sort/Move Controls - Only visible when watched */}
        {product.isWatched && (
          <div className="absolute top-4 left-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                  onClick={(e) => { e.stopPropagation(); onMove('left'); }}
                  className="w-7 h-7 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white"
                  title="Move Left"
              >
                  <ArrowLeft size={14} />
              </button>
              <button
                  onClick={(e) => { e.stopPropagation(); onMove('right'); }}
                  className="w-7 h-7 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white"
                  title="Move Right"
              >
                  <ArrowRight size={14} />
              </button>
          </div>
        )}
        
        {/* Watch Button */}
        <button
          onClick={onToggleWatch}
          title={product.isWatched ? "Unwatch" : "Watch"}
          className={`absolute top-4 right-4 w-9 h-9 backdrop-blur-sm rounded-full flex items-center justify-center transition-all ${product.isWatched ? 'bg-amber-400 text-white' : 'bg-white/80 text-slate-400 hover:text-amber-500 hover:bg-white'}`}
        >
          <Star size={16} fill={product.isWatched ? "currentColor" : "none"} />
        </button>
        
        <div className="absolute top-4 right-16 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {/* Edit Button */}
            <button
            onClick={onEdit}
            title="Edit Product"
            className="w-9 h-9 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white transition-all scale-90 group-hover:scale-100"
            >
            <Pencil size={16} />
            </button>

            {/* Delete Button */}
            <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete Product"
            className="w-9 h-9 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-white transition-all scale-90 group-hover:scale-100"
            >
            <Trash2 size={16} />
            </button>
        </div>

        <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-white flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          Details <ChevronRight size={12} />
        </div>
      </div>
      
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-bold text-slate-900 group-hover:text-intenza-600 transition-colors">
            {t(product.modelName)}
          </h3>
          <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">
            {product.sku}
          </span>
        </div>
        
        <p className="text-slate-500 text-sm mb-4 line-clamp-2">{t(product.description)}</p>
        
        <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
          <div className="flex flex-col">
             <span className="text-slate-400 text-xs">Current Ver</span>
             <span className="font-semibold text-slate-700">
                {product.currentVersion}
                {currentVerEco?.implementationDate && 
                    <span className="text-xs text-slate-400 font-normal ml-1">({currentVerEco.implementationDate})</span>
                }
             </span>
          </div>
          <div className="flex flex-col items-end">
             <span className="text-slate-400 text-xs">Issues</span>
             <div className={`flex items-baseline gap-1 font-semibold ${activeIssues > 0 ? 'text-amber-500' : 'text-green-500'}`}>
               <span className="text-4xl font-bold leading-none">{activeIssues}</span>
               <span className="text-sm">Active</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};