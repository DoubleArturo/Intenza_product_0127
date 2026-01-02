
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Star, Upload, Ruler, Clock, User, X, Filter, Search, RotateCcw, Pencil, Trash2, CheckCircle, Loader2 } from 'lucide-react';
import { Tester, Gender } from '../types';
import { api } from '../services/api';

interface TesterDatabaseProps {
  testers: Tester[];
  onAddTester: (tester: Omit<Tester, 'id'>) => void;
  onUpdateTester: (tester: Tester) => void;
  onDeleteTester: (id: string) => void;
}

const TesterDatabase: React.FC<TesterDatabaseProps> = ({ testers, onAddTester, onUpdateTester, onDeleteTester }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTester, setEditingTester] = useState<Tester | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Selection Mode State
  const selectionMode = location.state?.selectionMode || false;
  const [selectedTesterIds, setSelectedTesterIds] = useState<string[]>([]);
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'Male' | 'Female'>('ALL');
  const [minHeight, setMinHeight] = useState<number | ''>('');
  const [maxHeight, setMaxHeight] = useState<number | ''>('');
  const [minExp, setMinExp] = useState<number | ''>('');
  const [minRating, setMinRating] = useState<number | ''>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    gender: 'Male' as Gender,
    height: 170,
    experienceYears: 1,
    rating: 5,
    imageUrl: ''
  });
  
  const resetForm = () => {
      setFormData({
        name: '',
        gender: 'Male',
        height: 170,
        experienceYears: 1,
        rating: 5,
        imageUrl: ''
      });
      setEditingTester(null);
  };
  
  const resetFilters = () => {
      setSearchQuery('');
      setGenderFilter('ALL');
      setMinHeight('');
      setMaxHeight('');
      setMinExp('');
      setMinRating('');
  };

  useEffect(() => {
      if (isModalOpen && editingTester) {
          setFormData({
              name: editingTester.name,
              gender: editingTester.gender || 'Male',
              height: editingTester.height,
              experienceYears: editingTester.experienceYears,
              rating: editingTester.rating,
              imageUrl: editingTester.imageUrl
          });
      } else if (isModalOpen && !editingTester) {
          resetForm();
      }
  }, [isModalOpen, editingTester]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsUploading(true);
        // 將檔案上傳至 Vercel Blob 獲取永久 URL
        const blobUrl = await api.uploadImage(file);
        setFormData(prev => ({ ...prev, imageUrl: blobUrl }));
      } catch (err) {
        console.error("Tester photo upload failed:", err);
        alert("照片上傳失敗，請檢查網路連線");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) {
      alert("照片正在上傳中，請稍候");
      return;
    }
    if (editingTester) {
        onUpdateTester({ ...editingTester, ...formData });
    } else {
        onAddTester(formData);
    }
    setIsModalOpen(false);
    resetForm();
  };
  
  const handleEditClick = (tester: Tester) => {
      if (selectionMode) return; // Disable edit in selection mode
      setEditingTester(tester);
      setIsModalOpen(true);
  };
  
  const filteredTesters = testers.filter(t => {
      const matchName = t.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchGender = genderFilter === 'ALL' || t.gender === genderFilter;
      const matchHeightMin = minHeight === '' || t.height >= minHeight;
      const matchHeightMax = maxHeight === '' || t.height <= maxHeight;
      const matchExp = minExp === '' || t.experienceYears >= minExp;
      const matchRating = minRating === '' || t.rating >= minRating;
      
      return matchName && matchGender && matchHeightMin && matchHeightMax && matchExp && matchRating;
  });

  const handleToggleSelection = (testerId: string) => {
    if (!selectionMode) return;
    setSelectedTesterIds(prev =>
      prev.includes(testerId) ? prev.filter(id => id !== testerId) : [...prev, testerId]
    );
  };

  const handleConfirmSelection = () => {
    const returnTo = location.state?.returnTo || '/';
    const activeTab = location.state?.activeTab || 'DESIGN';
    navigate(returnTo, { state: { selectedTesterIds, activeTab } });
  };

  return (
    <div className="min-h-screen bg-slate-50 w-full p-8 animate-fade-in flex flex-col md:flex-row gap-8">
      {/* Sidebar Filters */}
      <aside className="w-full md:w-72 flex-shrink-0 space-y-6">
         <div className="mb-6">
            <button 
                onClick={() => navigate(selectionMode ? location.state.returnTo : -1)}
                className="flex items-center text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors"
            >
                <ArrowLeft size={16} className="mr-1" /> {selectionMode ? 'Cancel Selection' : 'Back'}
            </button>
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">Tester Database</h1>
            <p className="text-slate-500 text-sm mt-1">{selectionMode ? 'Select testers for your project.' : 'Manage human factors subjects.'}</p>
         </div>
         
         <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5 sticky top-24">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-2"><Filter size={18}/> Filters</h3>
                <button onClick={resetFilters} className="text-xs text-slate-400 hover:text-intenza-600 flex items-center gap-1"><RotateCcw size={12}/> Reset</button>
            </div>
            
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Search name..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-intenza-500/20 focus:border-intenza-500 outline-none"
                />
            </div>
            
            <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase">Gender</label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {['ALL', 'Male', 'Female'].map(g => (
                        <button 
                            key={g} 
                            onClick={() => setGenderFilter(g as any)}
                            className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${genderFilter === g ? 'bg-white shadow text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {g}
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase">Height (cm)</label>
                <div className="flex gap-2">
                    <input type="number" placeholder="Min" value={minHeight} onChange={e => setMinHeight(e.target.value ? Number(e.target.value) : '')} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                    <input type="number" placeholder="Max" value={maxHeight} onChange={e => setMaxHeight(e.target.value ? Number(e.target.value) : '')} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                </div>
            </div>
            
            <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase">Min Experience</label>
                <div className="flex items-center gap-2">
                    <Clock size={16} className="text-slate-400"/>
                    <input type="number" placeholder="Years" value={minExp} onChange={e => setMinExp(e.target.value ? Number(e.target.value) : '')} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                </div>
            </div>
            
            <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase">Min Rating</label>
                <div className="flex gap-1">
                    {[1,2,3,4,5].map(star => (
                        <button 
                            key={star} 
                            onClick={() => setMinRating(minRating === star ? '' : star)}
                            className={`p-1.5 rounded-md transition-all ${minRating !== '' && star <= minRating ? 'bg-amber-100 text-amber-500' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}
                        >
                            <Star size={16} fill="currentColor"/>
                        </button>
                    ))}
                </div>
            </div>
            
            {!selectionMode && (
                <button 
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="w-full py-2.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10"
                >
                    <Plus size={18} /> Add Tester
                </button>
            )}
         </div>
      </aside>

      {/* Main Grid */}
      <div className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {filteredTesters.length > 0 ? (
                filteredTesters.map(tester => (
                <TesterCard 
                    key={tester.id} 
                    tester={tester} 
                    onDelete={() => onDeleteTester(tester.id)} 
                    onEdit={() => handleEditClick(tester)}
                    isSelected={selectionMode && selectedTesterIds.includes(tester.id)}
                    onSelect={() => handleToggleSelection(tester.id)}
                    selectionMode={selectionMode}
                />
                ))
            ) : (
                <div className="col-span-full h-64 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
                    <User size={48} className="mb-4 opacity-20"/>
                    <p>No testers found matching criteria.</p>
                </div>
            )}
          </div>
      </div>
      
      {/* Selection Confirmation Bar */}
      {selectionMode && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
            <div className="bg-slate-900 text-white rounded-xl shadow-2xl p-4 flex items-center gap-6 animate-slide-up border border-slate-800">
                <span className="font-medium text-sm">{selectedTesterIds.length} tester(s) selected</span>
                <button 
                    onClick={handleConfirmSelection} 
                    disabled={selectedTesterIds.length === 0}
                    className="px-5 py-2 bg-intenza-600 hover:bg-intenza-700 font-bold rounded-lg transition-all disabled:bg-intenza-400 disabled:cursor-not-allowed"
                >
                    Confirm Selection
                </button>
            </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">{editingTester ? 'Edit Profile' : 'New Tester Profile'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
               <div className="flex justify-center">
                  <div 
                     onClick={() => !isUploading && fileInputRef.current?.click()}
                     className="relative w-32 h-32 rounded-full border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:border-intenza-400 hover:bg-intenza-50 transition-all overflow-hidden group"
                   >
                     {formData.imageUrl ? (
                       <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                     ) : (
                       <div className="text-center text-slate-400 group-hover:text-intenza-500">
                         {isUploading ? <Loader2 size={32} className="animate-spin mx-auto text-intenza-600" /> : <User size={32} />}
                         <span className="text-xs mt-1 block">{isUploading ? 'Uploading...' : 'Upload'}</span>
                       </div>
                     )}
                     
                     {formData.imageUrl && isUploading && (
                        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                           <Loader2 size={24} className="animate-spin text-intenza-600" />
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

               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                 <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-intenza-500/20 text-slate-900" placeholder="e.g. Jane Doe"/>
               </div>

               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                  <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="gender" value="Male" checked={formData.gender === 'Male'} onChange={() => setFormData({...formData, gender: 'Male'})} className="text-intenza-600 focus:ring-intenza-500" />
                          <span className="text-sm text-slate-700">Male</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="gender" value="Female" checked={formData.gender === 'Female'} onChange={() => setFormData({...formData, gender: 'Female'})} className="text-intenza-600 focus:ring-intenza-500" />
                          <span className="text-sm text-slate-700">Female</span>
                      </label>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Height (cm)</label>
                    <input type="number" required value={formData.height} onChange={e => setFormData({...formData, height: Number(e.target.value)})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-intenza-500/20 text-slate-900"/>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Exp (Years)</label>
                    <input type="number" required value={formData.experienceYears} onChange={e => setFormData({...formData, experienceYears: Number(e.target.value)})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-intenza-500/20 text-slate-900"/>
                 </div>
               </div>

               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Rating</label>
                 <div className="flex gap-2">
                   {[1, 2, 3, 4, 5].map(star => (
                     <button 
                       key={star}
                       type="button"
                       onClick={() => setFormData({...formData, rating: star})}
                       className={`p-2 rounded-lg transition-all ${formData.rating >= star ? 'text-amber-400 bg-amber-50' : 'text-slate-300 bg-slate-100'}`}
                     >
                       <Star size={20} fill="currentColor" />
                     </button>
                   ))}
                 </div>
               </div>

               <button 
                type="submit" 
                disabled={isUploading}
                className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 mt-2 disabled:opacity-50 disabled:bg-slate-400"
               >
                 {editingTester ? 'Save Changes' : 'Create Profile'}
               </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const TesterCard: React.FC<{ tester: Tester, onDelete: () => void, onEdit: () => void, isSelected: boolean, onSelect: () => void, selectionMode: boolean }> = ({ tester, onDelete, onEdit, isSelected, onSelect, selectionMode }) => {
  const cardAction = selectionMode ? onSelect : onEdit;

  return (
    <div 
      className={`group bg-white rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden flex flex-col ${isSelected ? 'border-intenza-500 shadow-xl ring-2 ring-intenza-500/20' : 'border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1'}`} 
      onClick={cardAction}
    >
      <div className="relative h-64 bg-slate-100 overflow-hidden">
        <img 
            src={tester.imageUrl} 
            alt={tester.name} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
            onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x600?text=No+Photo'; }}
        />
        
        {isSelected && (
            <div className="absolute inset-0 bg-intenza-500/10 backdrop-blur-[1px] flex items-center justify-center z-10 animate-fade-in">
                <div className="bg-intenza-600 text-white rounded-full h-12 w-12 flex items-center justify-center shadow-lg animate-slide-up">
                    <CheckCircle size={24} strokeWidth={3} />
                </div>
            </div>
        )}

        {!selectionMode && (
          <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
             <button 
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white transition-all shadow-sm"
                title="Edit"
             >
                <Pencil size={16} />
             </button>
             <button 
                onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete this profile?')) onDelete(); }}
                className="w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-white transition-all shadow-sm"
                title="Delete"
             >
                <Trash2 size={16} />
             </button>
          </div>
        )}
        
        <div className="absolute bottom-4 left-4">
             <span className={`text-[10px] px-2.5 py-1 rounded-full uppercase font-bold tracking-wider shadow-sm backdrop-blur-md ${tester.gender === 'Male' ? 'bg-blue-600 text-white' : 'bg-pink-600 text-white'}`}>
                {tester.gender}
             </span>
        </div>
      </div>
      
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-intenza-600 transition-colors">
                {tester.name}
            </h3>
            <div className="flex gap-0.5 pt-1">
                {[...Array(5)].map((_, i) => (
                    <Star 
                        key={i} 
                        size={14} 
                        fill={i < tester.rating ? "#fbbf24" : "none"} 
                        stroke={i < tester.rating ? "#fbbf24" : "#cbd5e1"} 
                    />
                ))}
            </div>
        </div>
        
        <div className="mt-auto grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Ruler size={12}/> Height</span>
                <span className="text-sm font-semibold text-slate-700">{tester.height} cm</span>
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Clock size={12}/> Experience</span>
                <span className="text-sm font-semibold text-slate-700">{tester.experienceYears} Years</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TesterDatabase;
