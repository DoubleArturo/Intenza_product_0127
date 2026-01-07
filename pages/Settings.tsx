
import React, { useState, useRef, useContext, useEffect, useMemo } from 'react';
import { Plus, X, Save, Download, Upload, AlertTriangle, CheckCircle, Pencil, History, Sparkles, Shield, User, Trash2, Eye, EyeOff, Key, Database, HardDrive, Info, Cloud, LogOut, Loader2, Link as LinkIcon, Activity, Layers, Image as ImageIcon, RotateCcw, Settings2, LayoutGrid, Maximize, Palette, MousePointer2 } from 'lucide-react';
import { AppState, LocalizedString, UserAccount } from '../types';
import { LanguageContext } from '../App';
import { api } from '../services/api';

interface SettingsProps {
  seriesList: LocalizedString[];
  onAddSeries: (seriesName: string) => Promise<void>;
  onUpdateSeriesList: (series: LocalizedString[]) => void;
  onRenameSeries: (index: number, newName: string) => void;
  currentAppState: AppState;
  onLoadProject: (state: AppState) => void;
  onUpdateMaxHistory: (steps: number) => void;
  onToggleAiInsights: (enabled: boolean) => void;
  onUpdateLogo: (url: string | undefined) => void;
  onUpdateStatusLightSize: (size: 'SMALL' | 'NORMAL' | 'LARGE') => void;
  onUpdateDashboardColumns: (count: number) => void;
  onUpdateCardAspectRatio: (ratio: string) => void;
  
  // Advanced configs
  onUpdateChartThemeStyle: (style: 'COLORFUL_CUSTOM' | 'MONOCHROME_CUSTOM' | 'MULTI_SYSTEM') => void;
  onUpdateCustomPaletteColors: (colors: string[]) => void;
  onUpdatePieTooltipScale: (scale: number) => void;
  onUpdatePieTooltipPosition: (pos: 'TOP_RIGHT' | 'TOP_LEFT' | 'BOTTOM_RIGHT' | 'BOTTOM_LEFT') => void;

  onAddUser: (user: Omit<UserAccount, 'id'>) => void;
  onUpdateUser: (user: UserAccount) => void;
  onDeleteUser: (id: string) => void;
  onSyncCloud: () => Promise<void>;
  onLogout: () => void;
  syncStatus: 'idle' | 'saving' | 'success' | 'error';
  onResetDashboard?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ 
  seriesList, onAddSeries, onUpdateSeriesList, onRenameSeries, 
  currentAppState, onLoadProject, onUpdateMaxHistory, onToggleAiInsights,
  onUpdateLogo, onUpdateStatusLightSize, onUpdateDashboardColumns, onUpdateCardAspectRatio,
  onUpdateChartThemeStyle, onUpdateCustomPaletteColors, onUpdatePieTooltipScale, onUpdatePieTooltipPosition,
  onAddUser, onUpdateUser, onDeleteUser, onSyncCloud, onLogout, syncStatus, onResetDashboard
}) => {
  const { t, language } = useContext(LanguageContext);
  const [newSeriesName, setNewSeriesName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const storageStats = useMemo(() => {
    const rowCount = (currentAppState.products?.length || 0) + (currentAppState.shipments?.length || 0) + (currentAppState.testers?.length || 0) + (currentAppState.users?.length || 0);
    const jsonString = JSON.stringify(currentAppState);
    const sizeInMB = jsonString.length / (1024 * 1024);
    const sizeLimitMB = 4.5;
    const sizePercent = Math.min(100, (sizeInMB / sizeLimitMB) * 100);
    return { rowCount, sizeInMB, sizePercent };
  }, [currentAppState]);

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      const url = await api.uploadImage(file);
      onUpdateLogo(url);
      showNotification('Logo Updated', 'success');
    } catch (err) {
      showNotification('Upload Failed', 'error');
    } finally {
      setIsUploadingLogo(false);
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
  };

  const handleColorChange = (index: number, color: string) => {
    const newColors = [...(currentAppState.customPaletteColors || [])];
    newColors[index] = color;
    onUpdateCustomPaletteColors(newColors);
  };

  const addColor = () => {
    onUpdateCustomPaletteColors([...(currentAppState.customPaletteColors || []), '#cccccc']);
  };

  const removeColor = (index: number) => {
    const newColors = (currentAppState.customPaletteColors || []).filter((_, i) => i !== index);
    onUpdateCustomPaletteColors(newColors);
  };

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in space-y-8 pb-32">
      <header className="border-b border-slate-100 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">System Settings</h1>
          <p className="text-slate-500 mt-1">Configure global UI, chart themes, and accounts.</p>
        </div>
        <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100">
          <LogOut size={18} /> Logout
        </button>
      </header>

      {notification && (
        <div className={`fixed top-8 right-8 px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slide-up z-50 ${notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span className="font-medium">{notification.msg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          
          {/* ADVANCED DATA VISUALIZATION SECTION */}
          <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
             <div className="flex items-center gap-2 mb-6">
                 <Palette className="text-intenza-600" size={20} />
                 <h2 className="text-xl font-bold text-slate-900">儀表板數據視覺化設置</h2>
             </div>
             
             <div className="space-y-10">
                {/* Chart Theme Selector */}
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">圖表顏色風格</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['COLORFUL_CUSTOM', 'MONOCHROME_CUSTOM', 'MULTI_SYSTEM'] as const).map(style => (
                      <button 
                        key={style}
                        onClick={() => onUpdateChartThemeStyle(style)}
                        className={`py-3 px-4 rounded-xl text-xs font-bold border-2 transition-all ${
                          currentAppState.chartThemeStyle === style 
                          ? 'bg-slate-900 text-white border-slate-900 shadow-lg' 
                          : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'
                        }`}
                      >
                        {style === 'COLORFUL_CUSTOM' ? '多彩 (自訂)' : style === 'MONOCHROME_CUSTOM' ? '同色系 (自訂)' : '多主色系'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Palette Editor */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">自定義色票池</label>
                    <button onClick={addColor} className="text-xs font-bold text-intenza-600 hover:underline flex items-center gap-1"><Plus size={14}/> 新增顏色</button>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {(currentAppState.customPaletteColors || []).map((color, i) => (
                      <div key={i} className="group relative flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                        <input 
                          type="color" 
                          value={color} 
                          onChange={(e) => handleColorChange(i, e.target.value)}
                          className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-none"
                        />
                        <input 
                          type="text" 
                          value={color} 
                          onChange={(e) => handleColorChange(i, e.target.value)}
                          className="w-20 bg-transparent text-[10px] font-mono font-bold uppercase outline-none"
                        />
                        <button onClick={() => removeColor(i)} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={10}/></button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-4">
                    {currentAppState.chartThemeStyle === 'MONOCHROME_CUSTOM' ? '※ 同色系模式將僅使用第一個色票作為基底。' : '※ 多彩模式將依序輪替色票池中的顏色。'}
                  </p>
                </div>

                <hr className="border-slate-100" />

                {/* Tooltip Card Configuration */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <MousePointer2 className="text-intenza-600" size={18} />
                    <h3 className="font-bold text-slate-800">懸浮資料卡 (Data Card) 配置</h3>
                  </div>

                  <div>
                    <label className="flex justify-between text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                      顯示尺寸倍率
                      <span className="text-intenza-600 font-black">{currentAppState.pieTooltipScale?.toFixed(1)}x</span>
                    </label>
                    <input 
                      type="range" min="1.0" max="3.0" step="0.1" 
                      value={currentAppState.pieTooltipScale || 2.0} 
                      onChange={(e) => onUpdatePieTooltipScale(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-intenza-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">資料卡固定位置 (避免遮蓋圓餅圖)</label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['TOP_RIGHT', 'TOP_LEFT', 'BOTTOM_RIGHT', 'BOTTOM_LEFT'] as const).map(pos => (
                        <button 
                          key={pos}
                          onClick={() => onUpdatePieTooltipPosition(pos)}
                          className={`py-3 px-4 rounded-xl text-[10px] font-black border-2 transition-all ${
                            currentAppState.pieTooltipPosition === pos 
                            ? 'bg-intenza-600 text-white border-intenza-600 shadow-lg' 
                            : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'
                          }`}
                        >
                          {pos.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
             </div>
          </section>

          {/* OTHER SECTIONS MAINTAINED FOR GUI CONSISTENCY */}
          <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
             <div className="flex items-center gap-2 mb-6"><ImageIcon className="text-intenza-600" size={20} /><h2 className="text-xl font-bold text-slate-900">品牌視覺配置</h2></div>
             <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="w-32 h-32 rounded-2xl bg-slate-900 border-2 border-slate-800 flex items-center justify-center overflow-hidden relative group shadow-inner">
                    {currentAppState.customLogoUrl ? <img src={currentAppState.customLogoUrl} alt="Logo" className="w-full h-full object-contain p-2" /> : <div className="text-white font-bold text-4xl">I</div>}
                    {isUploadingLogo && <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>}
                </div>
                <div className="flex-1 space-y-4">
                    <p className="text-sm text-slate-500">上傳您的公司 Logo。此 Logo 將取代登入介面的預設圖示。</p>
                    <div className="flex gap-3">
                        <button onClick={() => logoInputRef.current?.click()} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors flex items-center gap-2"><Upload size={16} /> 上傳新 Logo</button>
                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </div>
                </div>
             </div>
          </section>
        </div>

        <div className="space-y-8">
           <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-6"><Cloud className="text-intenza-600" size={20} /><h2 className="text-xl font-bold text-slate-900">雲端同步狀態</h2></div>
              <button onClick={onSyncCloud} disabled={syncStatus === 'saving'} className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${syncStatus === 'saving' ? 'bg-slate-100 text-slate-400' : 'bg-intenza-600 text-white hover:bg-intenza-700 shadow-intenza-600/20'}`}>
                {syncStatus === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <Cloud size={18} />} {syncStatus === 'saving' ? 'Syncing...' : 'Save to Cloud'}
              </button>
           </section>

           <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold text-slate-900">Storage Usage</h2></div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400"><span>Project Volume</span><span>{storageStats.sizeInMB.toFixed(2)} MB</span></div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div className="h-full bg-intenza-500 transition-all" style={{ width: `${storageStats.sizePercent}%` }}></div></div>
                </div>
              </div>
           </section>
        </div>
      </div>
    </div>
  );
};

export default Settings;
