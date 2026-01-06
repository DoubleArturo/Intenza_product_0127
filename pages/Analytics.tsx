
import React, { useState, useMemo, useRef, useContext, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Label
} from 'recharts';
import { 
  ArrowLeft, PieChart as PieIcon, BarChart as BarIcon, Search, FileSpreadsheet, 
  Palette, Box, Activity, ChevronDown, 
  Image as ImageIcon, ClipboardList, User, ShieldCheck, Zap, ArrowRight,
  CheckCircle, AlertCircle, Clock, Info, Users, Filter, Download
} from 'lucide-react';
import { ShipmentData, ChartViewType, ProductModel, Tester, TestStatus } from '../types';
import GeminiInsight from '../components/GeminiInsight';
import * as XLSX from 'xlsx';
import { LanguageContext } from '../App';
import { useNavigate, useLocation } from 'react-router-dom';

const COLORS = ['#0f172a', '#e3261b', '#94a3b8', '#fbbf24', '#f63e32', '#475569', '#3b82f6', '#10b981', '#8b5cf6', '#d946ef', '#06b6d4'];

interface AnalyticsProps {
  products: ProductModel[];
  shipments: ShipmentData[];
  testers?: Tester[];
  onImportData: (data: ShipmentData[]) => void;
  onBatchAddProducts: (products: any[]) => void;
  showAiInsights: boolean;
  userRole?: 'admin' | 'user' | 'uploader';
}

type DimensionFilter = 'DATA_DRILL' | 'BUYER' | 'COLOR';

const Analytics: React.FC<AnalyticsProps> = ({ products, shipments, onImportData, onBatchAddProducts, showAiInsights, userRole }) => {
  const { language, t } = useContext(LanguageContext);
  const navigate = useNavigate();
  const location = useLocation();
  
  const [chartType, setChartType] = useState<ChartViewType>('BAR');
  const [drillPath, setDrillPath] = useState<{ level: string, label: string, filterVal: string }[]>([]);
  const [dimension, setDimension] = useState<DimensionFilter>('DATA_DRILL');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle auto-drill down from external state (e.g. from ProductDetail)
  useEffect(() => {
    if (location.state?.autoDrill) {
        const auto = location.state.autoDrill; 
        const newPath: any[] = [];
        
        // Find Category and Series to build a valid full path
        const skuInfo = auto.find((a: any) => a.level === 'SKU');
        if (skuInfo) {
            const firstShip = shipments.find(s => s.sku === skuInfo.val);
            if (firstShip) {
                newPath.push({ level: 'CATEGORY', label: firstShip.category, filterVal: firstShip.category });
                newPath.push({ level: 'SERIES', label: firstShip.series, filterVal: firstShip.series });
                newPath.push({ level: 'SKU', label: firstShip.sku, filterVal: firstShip.sku });
                
                const versionInfo = auto.find((a: any) => a.level === 'VERSION');
                if (versionInfo) {
                    newPath.push({ level: 'VERSION', label: versionInfo.val, filterVal: versionInfo.val });
                }
            }
        }
        
        if (newPath.length > 0) {
            setDrillPath(newPath);
            setDimension('DATA_DRILL');
        }
    }
  }, [location.state, shipments]);

  const formatVersion = (v: string) => {
    const clean = (v || '1.0').toUpperCase().replace('V', '');
    return `V${clean}`;
  };

  const currentLevel = useMemo(() => {
    const depth = drillPath.length;
    switch (depth) {
      case 0: return 'CATEGORY';
      case 1: return 'SERIES';
      case 2: return 'SKU';
      case 3: return 'VERSION'; 
      case 4: return 'BUYER'; 
      default: return 'BUYER';
    }
  }, [drillPath]);

  const filteredShipments = useMemo(() => {
    let data = [...shipments];
    drillPath.forEach((step) => {
      if (step.level === 'CATEGORY') data = data.filter(s => s.category === step.filterVal);
      if (step.level === 'SERIES') data = data.filter(s => s.series === step.filterVal);
      if (step.level === 'SKU') data = data.filter(s => s.sku === step.filterVal);
      if (step.level === 'VERSION') data = data.filter(s => formatVersion(s.version) === step.filterVal);
      if (step.level === 'BUYER') data = data.filter(s => s.buyer === step.filterVal);
    });
    return data;
  }, [shipments, drillPath]);

  const chartData = useMemo(() => {
    const aggregated: Record<string, number> = {};
    filteredShipments.forEach(item => {
      let key = '';
      switch (currentLevel) {
        case 'CATEGORY': key = item.category || 'N/A'; break;
        case 'SERIES': key = item.series || 'N/A'; break;
        case 'SKU': key = item.sku || 'N/A'; break;
        case 'VERSION': key = formatVersion(item.version); break;
        case 'BUYER': key = item.buyer || 'N/A'; break;
        default: key = item.category;
      }
      aggregated[key] = (aggregated[key] || 0) + item.quantity;
    });

    return Object.keys(aggregated).map(key => ({
      name: key,
      value: aggregated[key]
    })).sort((a, b) => b.value - a.value);
  }, [filteredShipments, currentLevel]);

  // Fix: Adding handleDrill function to allow interactive exploration of data dimensions through chart clicks
  const handleDrill = (data: any) => {
    if (!data || !data.name || drillPath.length >= 5) return;
    
    setDrillPath([
      ...drillPath, 
      { 
        level: currentLevel, 
        label: data.name, 
        filterVal: data.name 
      }
    ]);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      const mappedData: ShipmentData[] = data.map((row: any, idx) => ({
        id: `imp-${Date.now()}-${idx}`,
        modelId: '', 
        shipDate: row['Ship Date'] || row['日期'] || '',
        buyer: row['Buyer'] || row['客戶'] || 'Unknown',
        deliveryNo: row['Delivery No'] || '',
        item: row['Item'] || '',
        pi: row['PI'] || '',
        pn: row['PN'] || '',
        description: row['Description'] || '',
        sku: row['SKU'] || row['型號'] || 'N/A',
        quantity: Number(row['Quantity'] || row['數量'] || 0),
        sn: row['SN'] || '',
        version: String(row['Version'] || row['版本'] || '1.0'),
        category: row['Category'] || row['品類'] || 'Cardio',
        series: row['Series'] || row['系列'] || 'Unknown'
      }));
      
      onImportData(mappedData);
      alert(`${mappedData.length} shipment records imported successfully.`);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto animate-fade-in">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <div className="flex items-center gap-2 text-intenza-600 mb-2">
             <Activity size={20} />
             <span className="text-xs font-black uppercase tracking-widest">Global Analytics</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Product Dashboard</h1>
          <p className="text-slate-500 mt-2 font-medium">Track shipment volumes and distribution across versions.</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
           {(userRole === 'admin' || userRole === 'uploader') && (
             <>
               <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-white border-2 border-slate-200 px-5 py-2.5 rounded-2xl font-bold text-slate-700 hover:border-slate-900 transition-all shadow-sm">
                 <FileSpreadsheet size={20} /> Import Shipment Data
               </button>
               <input ref={fileInputRef} type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
             </>
           )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
           {/* Chart Card */}
           <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 p-8 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                 <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setDrillPath([])} className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors text-slate-600"><RotateCcw size={18}/></button>
                    {drillPath.map((step, idx) => (
                       <React.Fragment key={idx}>
                          <ChevronRight size={16} className="text-slate-300" />
                          <button 
                            onClick={() => setDrillPath(drillPath.slice(0, idx + 1))}
                            className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
                          >
                            {step.label}
                          </button>
                       </React.Fragment>
                    ))}
                    <span className="ml-2 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-black uppercase tracking-widest">{currentLevel}</span>
                 </div>

                 <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner">
                    <button onClick={() => setChartType('PIE')} className={`p-2.5 rounded-xl transition-all ${chartType === 'PIE' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}><PieIcon size={20}/></button>
                    <button onClick={() => setChartType('BAR')} className={`p-2.5 rounded-xl transition-all ${chartType === 'BAR' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}><BarIcon size={20}/></button>
                 </div>
              </div>

              <div className="h-[500px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'PIE' ? (
                       <PieChart>
                          <Pie
                             data={chartData}
                             cx="50%"
                             cy="50%"
                             innerRadius={120}
                             outerRadius={180}
                             paddingAngle={5}
                             dataKey="value"
                             onClick={handleDrill}
                             className="cursor-pointer outline-none"
                          >
                             {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                             ))}
                          </Pie>
                          <Tooltip 
                             contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                          />
                          <Legend verticalAlign="bottom" height={36}/>
                       </PieChart>
                    ) : (
                       <BarChart data={chartData} onClick={(state) => state && state.activePayload && handleDrill(state.activePayload[0].payload)}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                          <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                          <Bar dataKey="value" fill="#0f172a" radius={[10, 10, 0, 0]} barSize={40}>
                             {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                             ))}
                          </Bar>
                       </BarChart>
                    )}
                 </ResponsiveContainer>
              </div>
           </div>
        </div>

        <div className="space-y-6">
           {showAiInsights && <GeminiInsight context="Shipment analysis for quality tracking." data={chartData} />}
           
           <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-slate-900/30">
              <h3 className="text-sm font-black uppercase tracking-widest opacity-50 mb-6 flex items-center gap-2">
                 <ShieldCheck size={16}/> Filtered Summary
              </h3>
              <div className="space-y-8">
                 <div>
                    <div className="text-4xl font-black mb-1">{filteredShipments.reduce((acc, curr) => acc + curr.quantity, 0).toLocaleString()}</div>
                    <div className="text-xs font-bold opacity-40 uppercase tracking-widest">Total Units Shipped</div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                       <div className="text-xl font-bold mb-1">{new Set(filteredShipments.map(s => s.buyer)).size}</div>
                       <div className="text-[10px] font-black opacity-40 uppercase tracking-tighter">Unique Buyers</div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                       <div className="text-xl font-bold mb-1">{new Set(filteredShipments.map(s => s.sku)).size}</div>
                       <div className="text-[10px] font-black opacity-40 uppercase tracking-tighter">Active SKUs</div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const RotateCcw = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
);
const ChevronRight = ({ size, className }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m9 18 6-6-6-6"/></svg>
);

export default Analytics;
