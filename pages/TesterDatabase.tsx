
import React, { useState, useRef, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Star, Upload, Ruler, Clock, User, X, Filter, Search, RotateCcw, Pencil, Trash2, CheckCircle, Loader2, Users2, ListChecks, ChevronRight, Save, Image as ImageIcon } from 'lucide-react';
import { Tester, Gender, TesterGroup } from '../types';
import { api } from '../services/api';
import { LanguageContext } from '../App';

interface TesterDatabaseProps {
  testers: Tester[];
  testerGroups?: TesterGroup[];
  cardAspectRatio: string;
  userRole?: 'admin' | 'user' | 'uploader' | 'viewer';
  onAddTester: (tester: Omit<Tester, 'id'>) => void;
  onUpdateTester: (tester: Tester) => void;
  onDeleteTester: (id: string) => void;
  onAddGroup?: (group: Omit<TesterGroup, 'id'>) => void;
  onUpdateGroup?: (group: TesterGroup) => void;
  onDeleteGroup?: (id: string) => void;
}

const aspectClassMap: Record<string, string> = {
  '1/1': 'aspect-square',
  '3/4': 'aspect-[3/4]',
  '4/3': 'aspect-[4/3]',
  '16/9': 'aspect-video',
};

const TesterDatabase: React.FC<TesterDatabaseProps> = ({ 
  testers, testerGroups = [], cardAspectRatio, userRole, 
  onAddTester, onUpdateTester, onDeleteTester,
  onAddGroup, onUpdateGroup, onDeleteGroup
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language } = useContext(LanguageContext);

  const [activeTab, setActiveTab] = useState<'TESTERS' | 'GROUPS'>('TESTERS');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingTester, setEditingTester] = useState<Tester | null>(null);
  const [editingGroup, setEditingGroup] = useState<TesterGroup | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const isViewer = userRole === 'viewer';

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
    imageUrl: '',
    bio: { en: '', zh: '' }
  });

  const [groupFormData, setGroupFormData] = useState({
    name: { en: '', zh: '' },
    testerIds: [] as string[]
  });
  
  const resetForm = () => {
      setFormData({
        name: '',
        gender: 'Male',
        height: 170,
        experienceYears: 1,
        rating: 5,
        imageUrl: '',
        bio: { en: '', zh: '' }
      });
      setEditingTester(null);
  };

  const resetGroupForm = () => {
      setGroupFormData({
        name: { en: '', zh: '' },
        testerIds: []
      });
      setEditingGroup(null);
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
              imageUrl: editingTester.imageUrl,
              bio: editingTester.bio || { en: '', zh: '' }
          });
      } else if (isModalOpen && !editingTester) {
          resetForm();
      }
  }, [isModalOpen, editingTester]);

  useEffect(() => {
    if (isGroupModalOpen && editingGroup) {
        setGroupFormData({
            name: editingGroup.name,
            testerIds: editingGroup.testerIds
        });
    } else if (isGroupModalOpen && !editingGroup) {
        resetGroupForm();
    }
  }, [isGroupModalOpen, editingGroup]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isViewer) return;
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsUploading(true);
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
    if (isViewer) return;
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

  const handleGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer || !onAddGroup || !onUpdateGroup) return;
    if (editingGroup) {
        onUpdateGroup({ ...editingGroup, ...groupFormData });
    } else {
        onAddGroup(groupFormData);
    }
    setIsGroupModalOpen(false);
    resetGroupForm();
  };
  
  const handleEditClick = (tester: Tester) => {
      if (selectionMode || isViewer) return;
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
            <h1 className="text-2xl font-black text-slate-900 leading-tight">Tester Database</h1>
            <p className="text-slate-500 text-sm mt-1">{selectionMode ? 'Select testers for your project.' : 'Manage human factors subjects.'}</p>
         </div>

         <div className="bg-slate-200/50 rounded-xl p-1 flex gap-1 shadow-inner mb-4">
            <button onClick={() => setActiveTab('TESTERS')} className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${activeTab === 'TESTERS' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>{t({ en: 'Individual', zh: '人員清單' })}</button>
            <button onClick={() => setActiveTab('GROUPS')} className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${activeTab === 'GROUPS' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>{t({ en: 'Groups', zh: '測試分組' })}</button>
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
            
            {!selectionMode && !isViewer && (
                <div className="space-y-2">
                    <button 
                        onClick={() => { resetForm(); setIsModalOpen(true); }}
                        className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 active:scale-95"
                    >
                        <Plus size={18} /> Add Tester
                    </button>
                    <button 
                        onClick={() => { resetGroupForm(); setIsGroupModalOpen(true); }}
                        className="w-full py-2.5 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:border-slate-400 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
                    >
                        <Users2 size={18} className="text-indigo-500" /> Create Group
                    </button>
                </div>
            )}
         </div>
      </aside>

      {/* Main Grid */}
      <div className="flex-1">
          {activeTab === 'TESTERS' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {filteredTesters.length > 0 ? (
                    filteredTesters.map(tester => (
                    <TesterCard 
                        key={tester.id} 
                        tester={tester} 
                        userRole={userRole}
                        aspectRatioClass={aspectClassMap[cardAspectRatio] || 'aspect-[3/4]'}
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
          ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {testerGroups.length > 0 ? (
                      testerGroups.map(group => (
                          <div key={group.id} className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm flex flex-col group/card hover:shadow-xl transition-all">
                              <div className="flex justify-between items-start mb-6">
                                  <div className="flex items-center gap-4">
                                      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100"><Users2 size={24} /></div>
                                      <div><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{t(group.name)}</h3><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{group.testerIds.length} Members</span></div>
                                  </div>
                                  {!isViewer && (
                                      <div className="flex gap-2">
                                          <button onClick={() => { setEditingGroup(group); setIsGroupModalOpen(true); }} className="p-2.5 text-slate-400 hover:text-slate-900 transition-colors"><Pencil size={18} /></button>
                                          <button onClick={() => { if(window.confirm('Delete group?')) onDeleteGroup?.(group.id); }} className="p-2.5 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                                      </div>
                                  )}
                              </div>
                              <div className="flex-1 space-y-4">
                                  <div className="flex -space-x-3 overflow-hidden">
                                      {group.testerIds.slice(0, 8).map(tid => {
                                          const tr = testers.find(t => t.id === tid);
                                          return <img key={tid} src={tr?.imageUrl} className="inline-block h-10 w-10 rounded-full ring-2 ring-white object-cover bg-slate-100" title={tr?.name} />;
                                      })}
                                      {group.testerIds.length > 8 && <div className="flex items-center justify-center h-10 w-10 rounded-full bg-slate-100 ring-2 ring-white text-[10px] font-black text-slate-400">+{group.testerIds.length - 8}</div>}
                                  </div>
                              </div>
                              <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Active Group</span>
                                  <button onClick={() => { setEditingGroup(group); setIsGroupModalOpen(true); }} className="text-xs font-black text-indigo-600 hover:underline flex items-center gap-1">Manage Members <ChevronRight size={14} /></button>
                              </div>
                          </div>
                      ))
                  ) : (
                    <div className="col-span-full h-64 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
                        <Users2 size={48} className="mb-4 opacity-20"/>
                        <p>No test groups created yet.</p>
                        <button onClick={() => setIsGroupModalOpen(true)} className="mt-4 text-indigo-600 font-bold hover:underline">Start your first group</button>
                    </div>
                  )}
              </div>
          )}
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

      {/* Tester Edit Modal */}
      {isModalOpen && !isViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl animate-slide-up overflow-hidden border border-white/20">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white">
              <h2 className="text-xl font-black text-slate-900">{editingTester ? 'Edit Profile' : 'New Tester Profile'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
               <div className="flex justify-center mb-4">
                  <div 
                     onClick={() => !isUploading && fileInputRef.current?.click()}
                     className="relative w-32 h-32 rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:border-intenza-400 hover:bg-intenza-50 transition-all overflow-hidden group shadow-inner"
                   >
                     {formData.imageUrl ? (
                       <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                     ) : (
                       <div className="text-center text-slate-400 group-hover:text-intenza-500">
                         {isUploading ? <Loader2 size={32} className="animate-spin mx-auto text-intenza-600" /> : <User size={32} />}
                         <span className="text-[10px] font-black uppercase tracking-widest mt-1 block">{isUploading ? 'Uploading...' : 'Avatar'}</span>
                       </div>
                     )}
                     <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                   </div>
               </div>

               <div className="grid grid-cols-2 gap-6">
                 <div className="col-span-2">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
                   <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-intenza-500/20 focus:border-intenza-600 outline-none text-slate-900 font-bold" placeholder="Subject name..."/>
                 </div>

                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Gender</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        {(['Male', 'Female'] as const).map(g => (
                            <button key={g} type="button" onClick={() => setFormData({...formData, gender: g})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${formData.gender === g ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}>{g}</button>
                        ))}
                    </div>
                 </div>

                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Rating</label>
                    <div className="flex gap-1.5 pt-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button key={star} type="button" onClick={() => setFormData({...formData, rating: star})} className={`transition-all ${formData.rating >= star ? 'text-amber-400' : 'text-slate-200 hover:text-slate-300'}`}><Star size={20} fill={formData.rating >= star ? "currentColor" : "none"} strokeWidth={3} /></button>
                      ))}
                    </div>
                 </div>

                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Height (cm)</label>
                    <input type="number" required value={formData.height} onChange={e => setFormData({...formData, height: Number(e.target.value)})} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:border-intenza-600 outline-none text-slate-900 font-bold"/>
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Exp (Years)</label>
                    <input type="number" required value={formData.experienceYears} onChange={e => setFormData({...formData, experienceYears: Number(e.target.value)})} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:border-intenza-600 outline-none text-slate-900 font-bold"/>
                 </div>

                 <div className="col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t({ en: 'Education / Work Experience', zh: '學經歷' })}</label>
                    <textarea rows={4} value={formData.bio.en} onChange={e => setFormData({...formData, bio: { en: e.target.value, zh: e.target.value }})} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:border-intenza-600 outline-none text-slate-900 font-medium resize-none" placeholder="Experience details..."/>
                 </div>
               </div>

               <div className="flex gap-4 pt-4 border-t border-slate-50">
                   <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all">Cancel</button>
                   <button type="submit" disabled={isUploading} className="flex-1 py-4 bg-slate-900 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 disabled:opacity-50 flex items-center justify-center gap-2"><Save size={18} /> {editingTester ? 'Update' : 'Create'}</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Modal */}
      {isGroupModalOpen && !isViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl animate-slide-up overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{editingGroup ? 'Edit Group Members' : 'Create Test Group'}</h2>
                    <button onClick={() => setIsGroupModalOpen(false)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"><X size={20} /></button>
                </div>
                <form onSubmit={handleGroupSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-8 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Group Name</label>
                            <input type="text" required value={groupFormData.name.en} onChange={e => setGroupFormData({...groupFormData, name: {en: e.target.value, zh: e.target.value}})} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 outline-none text-slate-900 font-black" placeholder="Group name..."/>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Group Members ({groupFormData.testerIds.length})</label>
                                <div className="text-[10px] text-slate-400 font-bold uppercase">Click to toggle</div>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                                {testers.map(tester => {
                                    const isSelected = groupFormData.testerIds.includes(tester.id);
                                    return (
                                        <div 
                                            key={tester.id} 
                                            onClick={() => isSelected ? setGroupFormData({...groupFormData, testerIds: groupFormData.testerIds.filter(id => id !== tester.id)}) : setGroupFormData({...groupFormData, testerIds: [...groupFormData.testerIds, tester.id]})}
                                            className={`relative aspect-square rounded-2xl overflow-hidden cursor-pointer border-2 transition-all ${isSelected ? 'border-indigo-600 scale-105 shadow-lg' : 'border-transparent opacity-60 grayscale hover:opacity-100 hover:grayscale-0'}`}
                                        >
                                            <img src={tester.imageUrl} className="w-full h-full object-cover" alt={tester.name} />
                                            <div className="absolute inset-x-0 bottom-0 p-2 bg-black/60 backdrop-blur-sm text-center">
                                                <div className="text-[9px] font-black text-white truncate uppercase">{tester.name}</div>
                                            </div>
                                            {isSelected && <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-1 shadow-md"><CheckCircle size={14} strokeWidth={3} /></div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-4">
                        <button type="button" onClick={() => setIsGroupModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest hover:bg-slate-100 rounded-2xl transition-all">Cancel</button>
                        <button type="submit" disabled={!groupFormData.name.en || groupFormData.testerIds.length === 0} className="flex-1 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-50">Save Group</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

const TesterCard: React.FC<{ tester: Tester, userRole?: string, aspectRatioClass: string, onDelete: () => void, onEdit: () => void, isSelected: boolean, onSelect: () => void, selectionMode: boolean }> = ({ tester, userRole, aspectRatioClass, onDelete, onEdit, isSelected, onSelect, selectionMode }) => {
  const isViewer = userRole === 'viewer';
  const { t } = useContext(LanguageContext);
  const cardAction = selectionMode ? onSelect : (!isViewer ? onEdit : () => {});

  return (
    <div 
      className={`group bg-white rounded-[2rem] border-2 transition-all duration-300 overflow-hidden flex flex-col ${isSelected ? 'border-intenza-500 shadow-xl ring-2 ring-intenza-500/20' : 'border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-slate-200/60 hover:border-slate-200'} ${isViewer && !selectionMode ? 'cursor-default' : 'cursor-pointer hover:-translate-y-1'}`} 
      onClick={cardAction}
    >
      <div className={`relative ${aspectRatioClass} bg-slate-100 overflow-hidden border-b border-slate-50`}>
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

        {!selectionMode && !isViewer && (
          <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
             <button 
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="w-10 h-10 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 transition-all shadow-lg border border-slate-100"
                title="Edit"
             >
                <Pencil size={18} strokeWidth={2.5} />
             </button>
             <button 
                onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete this profile?')) onDelete(); }}
                className="w-10 h-10 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center text-slate-500 hover:text-red-600 transition-all shadow-lg border border-slate-100"
                title="Delete"
             >
                <Trash2 size={18} strokeWidth={2.5} />
             </button>
          </div>
        )}
        
        <div className="absolute bottom-4 left-4">
             <span className={`text-[9px] px-3 py-1 rounded-full uppercase font-black tracking-[0.2em] shadow-lg backdrop-blur-md ${tester.gender === 'Male' ? 'bg-blue-600 text-white' : 'bg-pink-600 text-white'}`}>
                {tester.gender}
             </span>
        </div>
      </div>
      
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex flex-col gap-1 mb-4">
            <h3 className={`text-xl font-black text-slate-900 transition-colors uppercase tracking-tight ${!isViewer ? 'group-hover:text-intenza-600' : ''}`}>
                {tester.name}
            </h3>
            <div className="flex gap-0.5 pt-1">
                {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} fill={i < tester.rating ? "#fbbf24" : "none"} stroke={i < tester.rating ? "#fbbf24" : "#e2e8f0"} strokeWidth={3} />
                ))}
            </div>
        </div>

        {tester.bio?.en && (
            <p className="text-xs text-slate-400 line-clamp-2 italic mb-6 leading-relaxed flex-1 font-medium">
               "{t(tester.bio)}"
            </p>
        )}
        
        <div className="mt-auto grid grid-cols-2 gap-4 pt-5 border-t-2 border-slate-50">
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-300 font-black uppercase tracking-[0.2em] mb-1 flex items-center gap-1"><Ruler size={10}/> Height</span>
                <span className="text-sm font-bold text-slate-800 font-mono">{tester.height}cm</span>
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-300 font-black uppercase tracking-[0.2em] mb-1 flex items-center gap-1"><Clock size={10}/> Exp</span>
                <span className="text-sm font-bold text-slate-800 font-mono">{tester.experienceYears}y</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TesterDatabase;
