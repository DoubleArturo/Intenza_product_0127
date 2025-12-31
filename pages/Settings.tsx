
import React, { useState, useRef, useContext, useEffect, useMemo } from 'react';
/* Added missing Loader2 import */
import { Plus, X, Save, Download, Upload, AlertTriangle, CheckCircle, Pencil, History, Sparkles, Shield, User, Trash2, Eye, EyeOff, Key, Database, HardDrive, Info, Cloud, LogOut, Loader2 } from 'lucide-react';
import { AppState, LocalizedString, UserAccount } from '../types';
import { LanguageContext } from '../App';

interface SettingsProps {
  seriesList: LocalizedString[];
  onAddSeries: (seriesName: string) => Promise<void>;
  onUpdateSeriesList: (series: LocalizedString[]) => void;
  onRenameSeries: (index: number, newName: string) => void;
  currentAppState: AppState;
  onLoadProject: (state: AppState) => void;
  onUpdateMaxHistory: (steps: number) => void;
  onToggleAiInsights: (enabled: boolean) => void;
  onAddUser: (user: Omit<UserAccount, 'id'>) => void;
  onUpdateUser: (user: UserAccount) => void;
  onDeleteUser: (id: string) => void;
  onSyncCloud: () => Promise<void>;
  onLogout: () => void;
  syncStatus: 'idle' | 'saving' | 'success' | 'error';
}

const Settings: React.FC<SettingsProps> = ({ 
  seriesList, onAddSeries, onUpdateSeriesList, onRenameSeries, 
  currentAppState, onLoadProject, onUpdateMaxHistory, onToggleAiInsights,
  onAddUser, onUpdateUser, onDeleteUser, onSyncCloud, onLogout, syncStatus
}) => {
  const { t } = useContext(LanguageContext);
  const [newSeriesName, setNewSeriesName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  // --- 容量計算邏輯 ---
  const storageStats = useMemo(() => {
    const rowCount = 
      (currentAppState.products?.length || 0) + 
      (currentAppState.shipments?.length || 0) + 
      (currentAppState.testers?.length || 0) + 
      (currentAppState.users?.length || 0);
    const rowLimit = 10000;
    const rowPercent = Math.min(100, (rowCount / rowLimit) * 100);

    let totalBytes = 0;
    const countBytes = (str?: string) => {
      if (!str || !str.startsWith('data:')) return 0;
      return (str.length * 3) / 4;
    };

    currentAppState.products?.forEach(p => {
      totalBytes += countBytes(p.imageUrl);
      p.designHistory?.forEach(eco => eco.imageUrls?.forEach(url => totalBytes += countBytes(url)));
      p.durabilityTests?.forEach(test => test.attachmentUrls?.forEach(url => totalBytes += countBytes(url)));
      p.ergoProjects?.forEach(proj => {
        (Object.values(proj.tasks).flat() as any[]).forEach(task => {
          task.ngReasons.forEach((ng: any) => ng.attachmentUrls?.forEach((url: string) => totalBytes += countBytes(url)));
        });
      });
    });

    const mbUsed = totalBytes / (1024 * 1024);
    const mbLimit = 250;
    const mbPercent = Math.min(100, (mbUsed / mbLimit) * 100);

    return { rowCount, rowLimit, rowPercent, mbUsed, mbLimit, mbPercent };
  }, [currentAppState]);

  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [localMaxHistory, setLocalMaxHistory] = useState(currentAppState.maxHistorySteps || 10);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAddSeries = async () => {
    if (newSeriesName.trim()) {
      setIsSubmitting(true);
      await onAddSeries(newSeriesName.trim());
      setNewSeriesName('');
      showNotification('Series added successfully', 'success');
      setIsSubmitting(false);
    }
  };
  
  const handleRemoveSeries = (index: number) => {
    const newList = [...seriesList];
    newList.splice(index, 1);
    onUpdateSeriesList(newList);
    showNotification('Series removed', 'success');
    cancelDelete();
  };

  const startDeleteProcess = (index: number) => {
    setDeletingIndex(index);
    setEditingIndex(null); 
    setConfirmText('');
  };
  
  const cancelDelete = () => {
    setDeletingIndex(null);
    setConfirmText('');
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(t(seriesList[index]));
    setDeletingIndex(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  const handleSaveEdit = (index: number) => {
    if (editValue.trim()) {
      onRenameSeries(index, editValue.trim());
      setEditingIndex(null);
      setEditValue('');
      showNotification('Series renamed successfully', 'success');
    }
  };

  const handleDownloadProject = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentAppState, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `intenza-project-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showNotification('Project exported successfully', 'success');
  };

  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.products && json.seriesList) {
          onLoadProject(json);
          showNotification('Project loaded successfully', 'success');
        } else {
          showNotification('Invalid project file format', 'error');
        }
      } catch (err) {
        showNotification('Failed to parse JSON', 'error');
      }
    };
    reader.readAsText(file);
  };
  
  const saveHistorySettings = () => {
      onUpdateMaxHistory(localMaxHistory);
      showNotification('History settings updated', 'success');
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswordMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in space-y-8">
      <header className="border-b border-slate-100 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">System Settings</h1>
          <p className="text-slate-500 mt-1">Configure global parameters, manage users, and project data.</p>
        </div>
        <button 
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
        >
          <LogOut size={18} /> Logout
        </button>
      </header>

      {notification && (
        <div className={`fixed top-8 right-8 px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slide-up z-50 ${
          notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span className="font-medium">{notification.msg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Accounts & Series */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* User Management Section */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <Shield className="text-intenza-600" size={20} />
                    <h2 className="text-xl font-bold text-slate-900">User Management</h2>
                </div>
                <button 
                  onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }}
                  className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors"
                >
                  <Plus size={16} /> New User
                </button>
             </div>
             
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Username</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Password</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentAppState.users?.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                <User size={16} />
                              </div>
                              <span className="font-bold text-slate-700">{user.username}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                             user.role === 'admin' ? 'bg-intenza-100 text-intenza-700' : 'bg-slate-100 text-slate-600'
                           }`}>
                             {user.role}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-2 font-mono text-sm text-slate-400">
                              <span>{showPasswordMap[user.id] ? user.password : '••••••••'}</span>
                              <button onClick={() => togglePasswordVisibility(user.id)} className="hover:text-slate-600 transition-colors">
                                {showPasswordMap[user.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                           </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <div className="flex items-center justify-end gap-1">
                              <button 
                                onClick={() => { setEditingUser(user); setIsUserModalOpen(true); }}
                                className="p-2 text-slate-400 hover:text-intenza-600 transition-colors rounded-lg hover:bg-white"
                              >
                                <Pencil size={16} />
                              </button>
                              <button 
                                onClick={() => { if(window.confirm(`Delete user ${user.username}?`)) onDeleteUser(user.id); }}
                                className="p-2 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-white"
                              >
                                <Trash2 size={16} />
                              </button>
                           </div>
                        </td>
                      </tr>
                    ))}
                    {!currentAppState.users?.length && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No user accounts found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
             </div>
          </section>

          {/* Series Configuration Section */}
          <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Product Series Configuration</h2>
            <p className="text-sm text-slate-500 mb-6">Define the product families available in the dashboard.</p>
            <div className="flex gap-3 mb-6">
              <input type="text" value={newSeriesName} onChange={(e) => setNewSeriesName(e.target.value)} placeholder="Enter new series name..." className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-intenza-500/20 bg-slate-50 text-slate-900" onKeyPress={(e) => e.key === 'Enter' && handleAddSeries()}/>
              <button onClick={handleAddSeries} disabled={isSubmitting} className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:bg-slate-400">
                {isSubmitting ? <span className="animate-spin">⌛</span> : <Plus size={18} />} Add
              </button>
            </div>
            <div className="space-y-3">
              {seriesList.map((series, index) => (
                <div key={index} className={`flex items-center justify-between p-3 rounded-lg border group transition-all duration-300 ${deletingIndex === index ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                  {editingIndex === index ? (
                     <div className="w-full flex items-center gap-3 animate-fade-in">
                        <input 
                          type="text" 
                          value={editValue} 
                          onChange={(e) => setEditValue(e.target.value)} 
                          autoFocus
                          className="flex-1 px-3 py-1 border border-intenza-300 rounded-md focus:outline-none focus:ring-2 focus:ring-intenza-500/20 text-slate-900 bg-slate-50"
                          onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit(index)}
                        />
                        <div className="flex gap-2">
                           <button onClick={cancelEdit} className="px-3 py-1 text-sm text-slate-600 font-medium hover:bg-slate-200 rounded-md">Cancel</button>
                           <button onClick={() => handleSaveEdit(index)} className="px-4 py-1 text-sm bg-intenza-600 text-white font-medium rounded-md hover:bg-intenza-700">Save</button>
                        </div>
                     </div>
                  ) : deletingIndex === index ? (
                    <div className="w-full flex flex-col sm:flex-row items-center gap-3 animate-fade-in">
                      <span className="font-medium text-red-800 flex-shrink-0">Type 'D' to confirm:</span>
                      <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} maxLength={1} autoFocus className="w-12 text-center px-2 py-1 border border-red-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-400" onKeyPress={(e) => e.key === 'Enter' && confirmText.toUpperCase() === 'D' && handleRemoveSeries(index)} />
                      <div className="flex gap-2 ml-auto">
                         <button onClick={cancelDelete} className="px-3 py-1 text-sm text-slate-600 font-medium hover:bg-slate-200 rounded-md">Cancel</button>
                         <button onClick={() => handleRemoveSeries(index)} disabled={confirmText.trim().toUpperCase() !== 'D'} className="px-4 py-1 text-sm bg-red-600 text-white font-medium rounded-md hover:bg-red-700 disabled:bg-red-300">Confirm</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium text-slate-700">{t(series)}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(index)} title="Rename Series" className="text-slate-400 hover:text-intenza-600 p-2 rounded-lg transition-opacity"><Pencil size={16} /></button>
                        <button onClick={() => startDeleteProcess(index)} title="Delete Series" className="text-slate-400 hover:text-red-600 p-2 rounded-lg transition-opacity"><X size={18} /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Global Settings & Capacity */}
        <div className="space-y-8">
           {/* Cloud Sync Management Section */}
           <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                 <Cloud className="text-intenza-600" size={20} />
                 <h2 className="text-xl font-bold text-slate-900">Cloud Data Sync</h2>
              </div>
              <p className="text-sm text-slate-500 mb-6">Manually synchronize all project data to the cloud database for persistence.</p>
              
              <button 
                onClick={onSyncCloud}
                disabled={syncStatus === 'saving'}
                className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
                  syncStatus === 'saving' 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                    : 'bg-intenza-600 text-white hover:bg-intenza-700 shadow-intenza-600/20'
                }`}
              >
                {syncStatus === 'saving' ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Cloud size={18} />
                )}
                {syncStatus === 'saving' ? 'Syncing...' : 'Sync to Cloud Now'}
              </button>
              
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 px-1">
                <Info size={12} />
                <span>Tip: You can also use <kbd className="font-sans px-1 bg-slate-100 border rounded">Ctrl+S</kbd> anywhere.</span>
              </div>
           </section>

           {/* Capacity Monitoring Section */}
           <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Storage Usage</h2>
              <p className="text-sm text-slate-500 mb-6">Monitoring Vercel resources usage.</p>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Database size={14} className="text-indigo-500" />
                      Postgres (Metadata)
                    </div>
                    <span className={storageStats.rowPercent > 80 ? 'text-amber-600' : 'text-slate-400'}>
                      {storageStats.rowCount.toLocaleString()} / {storageStats.rowLimit.toLocaleString()} Rows
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${storageStats.rowPercent > 80 ? 'bg-amber-500' : 'bg-indigo-500'}`} 
                      style={{ width: `${storageStats.rowPercent}%` }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2 text-slate-500">
                      <HardDrive size={14} className="text-emerald-500" />
                      Blob (Attachments)
                    </div>
                    <span className={storageStats.mbPercent > 80 ? 'text-amber-600' : 'text-slate-400'}>
                      {storageStats.mbUsed.toFixed(2)} MB / {storageStats.mbLimit} MB
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${storageStats.mbPercent > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                      style={{ width: `${storageStats.mbPercent}%` }}
                    ></div>
                  </div>
                </div>
              </div>
           </section>

           <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-2">AI & Interface</h2>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                     <Sparkles size={18} className="text-intenza-500" />
                     <span className="font-bold text-slate-700 text-sm">AI Insights</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                     <input 
                       type="checkbox" 
                       className="sr-only peer" 
                       checked={currentAppState.showAiInsights !== false} 
                       onChange={(e) => {
                           onToggleAiInsights(e.target.checked);
                           showNotification(`AI Insights ${e.target.checked ? 'Enabled' : 'Disabled'}`, 'success');
                       }}
                     />
                     <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-intenza-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                   </label>
              </div>
           </section>
           
           <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
             <h2 className="text-xl font-bold text-slate-900 mb-4">Local Project Backup</h2>
             <div className="grid grid-cols-1 gap-4">
               <button onClick={handleDownloadProject} className="flex items-center justify-center gap-2 w-full py-2.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-all">
                 <Download size={18} /> Export JSON
               </button>
               <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-all">
                 <Upload size={18} /> Import JSON
               </button>
               <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportProject} />
             </div>
           </section>
        </div>
      </div>

      {/* User Add/Edit Modal */}
      {isUserModalOpen && (
        <UserAccountModal 
          isOpen={isUserModalOpen}
          onClose={() => setIsUserModalOpen(false)}
          onSave={(data) => {
            if (editingUser) onUpdateUser({ ...editingUser, ...data } as any);
            else onAddUser(data as any);
            setIsUserModalOpen(false);
          }}
          user={editingUser}
        />
      )}
    </div>
  );
};

const UserAccountModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: (data: Omit<UserAccount, 'id'>) => void;
  user: UserAccount | null;
}> = ({ isOpen, onClose, onSave, user }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'user' as 'admin' | 'user'
  });

  useEffect(() => {
    if (user) {
      setFormData({ username: user.username, password: user.password, role: user.role });
    } else {
      setFormData({ username: '', password: '', role: 'user' });
    }
  }, [user, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">{user ? 'Edit User' : 'Add New User'}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
           <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-intenza-500/20 outline-none"
                    placeholder="e.g. jason_hsu"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-intenza-500/20 outline-none"
                    placeholder="Enter password"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Role</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                   <button 
                     type="button"
                     onClick={() => setFormData({ ...formData, role: 'admin' })}
                     className={`py-2 text-xs font-bold rounded-md transition-all ${formData.role === 'admin' ? 'bg-white shadow text-intenza-600' : 'text-slate-500'}`}
                   >
                     Admin
                   </button>
                   <button 
                     type="button"
                     onClick={() => setFormData({ ...formData, role: 'user' })}
                     className={`py-2 text-xs font-bold rounded-md transition-all ${formData.role === 'user' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                   >
                     Standard User
                   </button>
                </div>
              </div>
           </div>

           <div className="pt-4 flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-2 text-slate-600 font-bold hover:bg-slate-50 rounded-lg transition-all">Cancel</button>
              <button type="submit" className="flex-1 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10">
                {user ? 'Save Changes' : 'Create Account'}
              </button>
           </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
