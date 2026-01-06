
import React, { useState, useMemo, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, GitCommit, UserCheck, Activity, AlertTriangle, CheckCircle, Clock, Calendar, Layers, Users, Plus, X, Pencil, Trash2, Upload, MessageSquare, ChevronsRight, ChevronsLeft, Tag, FileText, User, Database, Mars, Venus, Link as LinkIcon, Search, ClipboardList, ListPlus, Check, ChevronDown, RefreshCw, HelpCircle, BarChart3, AlertCircle, PlayCircle, Loader2, StickyNote, Lightbulb, Paperclip, Video, Image as ImageIcon, Save, Star, Info, Truck } from 'lucide-react';
import { ProductModel, TestStatus, DesignChange, LocalizedString, TestResult, EcoStatus, ErgoFeedback, ErgoProject, Tester, ErgoProjectCategory, NgReason, ProjectOverallStatus, Gender, NgDecisionStatus, EvaluationTask } from '../types';
import GeminiInsight from '../components/GeminiInsight';
import { LanguageContext } from '../App';
import { api } from '../services/api';

const isVideo = (url: string) => url?.startsWith('data:video') || url?.match(/\.(mp4|webm|ogg)$/i);

interface ProductDetailProps {
  products: ProductModel[];
  testers: Tester[];
  onUpdateProduct: (p: ProductModel) => Promise<void>;
  showAiInsights: boolean;
}

const ProductDetail: React.FC<ProductDetailProps> = ({ products, testers = [], onUpdateProduct, showAiInsights }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useContext(LanguageContext);

  const product = products.find(p => p.id === id);
  const [activeTab, setActiveTab] = useState<'DESIGN' | 'ERGO' | 'LIFE'>(location.state?.activeTab || 'DESIGN');
  
  const [isEcoModalOpen, setIsEcoModalOpen] = useState(false);
  const [editingEco, setEditingEco] = useState<DesignChange | null>(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<TestResult | null>(null);

  if (!product) return <div className="p-10 text-center text-slate-500">Product not found.</div>;

  const handleSaveEco = async (ecoData: any) => {
      let updatedDesignHistory;
      let newCurrentVersion = product.currentVersion;
      if (ecoData.status === EcoStatus.IN_PRODUCTION) newCurrentVersion = ecoData.version;

      if (editingEco) {
          updatedDesignHistory = product.designHistory.map(eco => eco.id === editingEco.id ? { ...eco, ...ecoData } : eco);
      } else {
          updatedDesignHistory = [...product.designHistory, { ...ecoData, id: `eco-${Date.now()}` }];
      }
      await onUpdateProduct({ ...product, designHistory: updatedDesignHistory, currentVersion: newCurrentVersion });
      setIsEcoModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 w-full">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="w-full px-8 py-6">
          <button onClick={() => navigate('/')} className="flex items-center text-sm text-slate-500 hover:text-slate-800 mb-4">
            <ArrowLeft size={16} className="mr-1" /> Back to Portfolio
          </button>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex items-start gap-6">
              <div className="w-24 h-24 rounded-xl overflow-hidden shadow-md bg-slate-100 flex items-center justify-center">
                 {product.imageUrl ? <img src={product.imageUrl} className="w-full h-full object-cover" /> : <ImageIcon size={40} className="text-slate-300" />}
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

      <div className="w-full px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
             {activeTab === 'DESIGN' && <DesignSection product={product} onAddEco={() => { setEditingEco(null); setIsEcoModalOpen(true); }} onEditEco={(e) => { setEditingEco(e); setIsEcoModalOpen(true); }} onDeleteEco={(id) => onUpdateProduct({...product, designHistory: product.designHistory.filter(h => h.id !== id)})} onSetCurrentVersion={(v) => onUpdateProduct({...product, currentVersion: v})} />}
             {activeTab === 'ERGO' && <div className="p-10 bg-white border border-slate-200 rounded-3xl text-center text-slate-400">Human factors evaluation module loaded.</div>}
             {activeTab === 'LIFE' && <div className="p-10 bg-white border border-slate-200 rounded-3xl text-center text-slate-400">Durability testing module loaded.</div>}
          </div>
          <div className="space-y-6">
             {showAiInsights && <GeminiInsight context={`Analyzing product ${product.sku}`} data={product} />}
          </div>
        </div>
      </div>
      
      {isEcoModalOpen && <EcoModal isOpen={isEcoModalOpen} onClose={() => setIsEcoModalOpen(false)} onSave={handleSaveEco} eco={editingEco} product={product}/>}
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
    {icon}{label}
  </button>
);

const DesignSection = ({ product, onAddEco, onEditEco, onDeleteEco, onSetCurrentVersion }: any) => {
  const { t } = useContext(LanguageContext);
  const navigate = useNavigate();
  const versions = useMemo(() => Array.from(new Set([product.currentVersion, ...product.designHistory.map((h:any) => h.version)])).sort().reverse(), [product]);
  const [selectedVersion, setSelectedVersion] = useState<string>(versions[0]);
  
  useEffect(() => { if (!versions.includes(selectedVersion)) setSelectedVersion(versions[0]); }, [versions]);

  const activeChanges = useMemo(() => product.designHistory.filter((h: any) => h.version === selectedVersion), [product.designHistory, selectedVersion]);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">Design Version History</h2>
        <button onClick={onAddEco} className="flex items-center gap-2 text-sm bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800"><Plus size={16} /> Add ECO</button>
      </div>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-6 px-6 border-b border-slate-100 bg-slate-50/50 overflow-x-auto">
          {versions.map((v) => (
            <button key={v} onClick={() => setSelectedVersion(v)} className={`py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap px-2 ${selectedVersion === v ? 'border-intenza-600 text-intenza-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>{v}</button>
          ))}
        </div>
        <div className="p-8">
          <div className="flex items-center justify-between mb-8 border-b border-slate-50 pb-6">
             <div className="flex items-center gap-4">
                <h3 className="text-2xl font-bold text-slate-800">{selectedVersion}</h3>
                <button 
                  onClick={() => navigate('/analytics', { state: { autoDrill: [{ level: 'SKU', val: product.sku }, { level: 'VERSION', val: selectedVersion }] } })}
                  className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm flex items-center gap-2 text-xs font-bold"
                >
                  <Users size={16} /> {t({en: 'Track Shipments', zh: '查看出貨客戶'})}
                </button>
             </div>
          </div>
          
          <div className="space-y-8">
            {activeChanges.map((change: any) => (
               <div key={change.id} className="relative group p-6 rounded-2xl border border-slate-100 bg-slate-50/30 hover:bg-white hover:shadow-lg transition-all">
                  <div className="flex flex-col md:flex-row gap-8">
                     <div className="md:w-48 shrink-0">
                        <span className="font-mono text-sm font-black text-intenza-600 bg-intenza-50 px-3 py-1 rounded-lg border border-intenza-100">{change.ecoNumber || change.ecrNumber}</span>
                        <div className="mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex flex-col gap-2">
                           <div className="flex items-center gap-2"><Calendar size={12}/> ECO: {change.date}</div>
                           {change.implementationDate && <div className="flex items-center gap-2 text-emerald-600"><Check size={12}/> PROD: {change.implementationDate}</div>}
                        </div>
                     </div>
                     <div className="flex-1">
                        <div className="flex justify-between items-start mb-4">
                           <h4 className="text-lg font-bold text-slate-900">{t(change.description)}</h4>
                           <span className="text-[10px] font-black px-3 py-1 rounded-full border bg-white shadow-sm uppercase tracking-wider">{change.status}</span>
                        </div>
                        {change.imageUrls && change.imageUrls.length > 0 && (
                           <div className="flex flex-wrap gap-2 mb-4">
                              {change.imageUrls.map((url: string, i: number) => (
                                 <img key={i} src={url} className="h-24 w-auto rounded-xl border border-slate-100 shadow-sm hover:scale-105 transition-transform cursor-zoom-in" />
                              ))}
                           </div>
                        )}
                     </div>
                  </div>
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => onEditEco(change)} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-900 shadow-md"><Pencil size={14} /></button>
                     <button onClick={() => onDeleteEco(change.id)} className="p-2 bg-white rounded-full text-red-400 hover:text-red-600 shadow-md"><Trash2 size={14} /></button>
                  </div>
               </div>
            ))}
            {activeChanges.length === 0 && <div className="text-center py-12 text-slate-400 italic">No change records for this version.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

const EcoModal = ({ isOpen, onClose, onSave, eco, product }: any) => {
    const { t } = useContext(LanguageContext);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [formData, setFormData] = useState({
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
        if (!files) return;
        setIsUploading(true);
        const newUrls = [...formData.imageUrls];
        for (let i = 0; i < files.length; i++) {
            try { const url = await api.uploadImage(files[i]); newUrls.push(url); } catch (err) { alert("Upload failed"); }
        }
        setFormData(prev => ({ ...prev, imageUrls: newUrls }));
        setIsUploading(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl animate-slide-up overflow-hidden">
                <div className="flex justify-between items-center p-8 border-b border-slate-100">
                    <h2 className="text-2xl font-bold">{eco ? 'Edit ECO' : 'New ECO'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={24} /></button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); onSave({...formData, description: { en: formData.description, zh: formData.description }, affectedBatches: [], affectedCustomers: []}); }} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-6">
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Version</label><input required className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-2xl" value={formData.version} onChange={e => setFormData({...formData, version: e.target.value})} /></div>
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Status</label><select className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-2xl" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as EcoStatus})}>{Object.values(EcoStatus).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    </div>
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Description</label><textarea required className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl resize-none" rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Supporting Images</label>
                        <div className="flex flex-wrap gap-3">
                            {formData.imageUrls.map((url: string, i: number) => (
                                <div key={i} className="relative w-20 h-20 rounded-2xl border border-slate-200 overflow-hidden group">
                                    <img src={url} className="w-full h-full object-cover" />
                                    <button type="button" onClick={() => setFormData({...formData, imageUrls: formData.imageUrls.filter((u:string)=>u!==url)})} className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                                </div>
                            ))}
                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-slate-400 bg-slate-50 transition-all">
                                {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                            </button>
                            <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleUpload} />
                        </div>
                    </div>
                    <div className="flex gap-4 pt-6">
                        <button type="button" onClick={onClose} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl uppercase tracking-widest">Cancel</button>
                        <button type="submit" disabled={isUploading} className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl disabled:opacity-50 uppercase tracking-widest">Save Record</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
