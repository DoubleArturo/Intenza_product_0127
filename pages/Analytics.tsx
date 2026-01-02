
import React, { useState, useMemo, useRef, useContext } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Label
} from 'recharts';
import { 
  ArrowLeft, PieChart as PieIcon, BarChart as BarIcon, Search, FileSpreadsheet, 
  Palette, Box, Activity, ChevronDown, 
  Image as ImageIcon, ClipboardList, User, ShieldCheck, Thermometer, List, 
  CheckCircle2, AlertCircle, Clock, ChevronRight, LayoutGrid
} from 'lucide-react';
import { ShipmentData, ChartViewType, ProductModel, Tester, TestStatus, ProjectOverallStatus } from '../types';
import GeminiInsight from '../components/GeminiInsight';
import * as XLSX from 'xlsx';
import { LanguageContext } from '../App';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#0f172a', '#e3261b', '#94a3b8', '#fbbf24', '#f63e32', '#475569', '#3b82f6', '#10b981', '#8b5cf6', '#d946ef', '#06b6d4'];

const COLOR_MAP: Record<string, string> = {
  'Brown': '#78350f',
  'Black': '#020617',
  'White': '#f8fafc',
  'Red': '#ef4444',
  'Silver': '#94a3b8',
  'Others': '#e2e8f0'
};

interface AnalyticsProps {
  products: ProductModel[];
  shipments: ShipmentData[];
  testers?: Tester[];
  onImportData: (data: ShipmentData[]) => void;
  onBatchAddProducts: (products: any[]) => void;
  showAiInsights: boolean;
}

type DimensionFilter = 'DATA_DRILL' | 'BUYER' | 'COLOR';
type ActiveTab = 'MARKET' | 'QUALITY' | 'LIST';

const Analytics: React.FC<AnalyticsProps> = ({ products, shipments, onImportData, onBatchAddProducts, showAiInsights }) => {
  const { language, t } = useContext(LanguageContext);
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<ActiveTab>('MARKET');
  const [chartType, setChartType] = useState<ChartViewType>('PIE');
  const [drillPath, setDrillPath] = useState<{ level: string, label: string, filterVal: string }[]>([]);
  const [dimension, setDimension] = useState<DimensionFilter>('DATA_DRILL');
  const [traceSearchQuery, setTraceSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Helper to format version string with uppercase V
   */
  const formatVersion = (v: string) => {
    const clean = (v || '1.0').toUpperCase().replace('V', '');
    return `V${clean}`;
  };

  /**
   * Enhanced Drill-Down Logic for Market Tab
   */
  const currentLevel = useMemo(() => {
    const depth = drillPath.length;
    if (dimension === 'BUYER') {
      switch (depth) {
        case 0: return 'BUYER';
        case 1: return 'SERIES';
        case 2: return 'SKU';
        default: return 'VERSION';
      }
    }
    if (dimension === 'COLOR') {
      switch (depth) {
        case 0: return 'COLOR';
        case 1: return 'SERIES';
        case 2: return 'SKU';
        default: return 'VERSION';
      }
    }
    switch (depth) {
      case 0: return 'CATEGORY';
      case 1: return 'SERIES';
      case 2: return 'SKU';
      case 3: return 'BUYER'; 
      default: return 'VERSION';
    }
  }, [drillPath, dimension]);

  const getEntryColor = (description: string = '') => {
    const desc = description.toLowerCase();
    if (desc.includes('brown') || desc.includes('咖啡')) return 'Brown';
    if (desc.includes('black') || desc.includes('黑')) return 'Black';
    if (desc.includes('white') || desc.includes('白')) return 'White';
    if (desc.includes('red') || desc.includes('紅')) return 'Red';
    if (desc.includes('silver') || desc.includes('銀')) return 'Silver';
    return 'Others';
  };

  const filteredShipments = useMemo(() => {
    let data = [...shipments];
    drillPath.forEach((step) => {
      if (step.level === 'CATEGORY') data = data.filter(s => s.category === step.filterVal);
      if (step.level === 'SERIES') data = data.filter(s => s.series === step.filterVal);
      if (step.level === 'SKU') data = data.filter(s => s.sku === step.filterVal);
      if (step.level === 'BUYER') data = data.filter(s => s.buyer === step.filterVal);
      if (step.level === 'VERSION') data = data.filter(s => formatVersion(s.version) === step.filterVal);
      if (step.level === 'COLOR') data = data.filter(s => getEntryColor(s.description) === step.filterVal);
    });
    return data;
  }, [shipments, drillPath]);

  const chartData = useMemo(() => {
    const aggregated: Record<string, number> = {};
    const meta: Record<string, { sku?: string, imageUrl?: string, fullName?: string }> = {};

    filteredShipments.forEach(item => {
      let key = '';
      switch (currentLevel) {
        case 'CATEGORY': key = item.category || 'N/A'; break;
        case 'SERIES': key = item.series || 'N/A'; break;
        case 'SKU': key = item.sku || 'N/A'; break;
        case 'BUYER': key = item.buyer || 'N/A'; break;
        case 'VERSION': key = formatVersion(item.version); break;
        case 'COLOR': key = getEntryColor(item.description); break;
        default: key = item.category;
      }

      aggregated[key] = (aggregated[key] || 0) + item.quantity;
      
      const prod = products.find(p => p.sku === (currentLevel === 'SKU' ? key : item.sku));
      if (prod) {
        meta[key] = {
          sku: prod.sku,
          imageUrl: prod.imageUrl,
          fullName: t(prod.modelName)
        };
      }
    });

    return Object.keys(aggregated).map(key => ({
      name: key,
      value: aggregated[key],
      ...meta[key]
    })).sort((a, b) => b.value - a.value);
  }, [filteredShipments, currentLevel, products, t]);

  // Quality Tab Data Aggregation
  const qualitySeriesData = useMemo(() => {
    const seriesMap: Record<string, { durabilitySum: number, durabilityCount: number, ergoTotal: number, ergoPass: number }> = {};
    
    products.forEach(p => {
      const sName = t(p.series);
      if (!seriesMap[sName]) seriesMap[sName] = { durabilitySum: 0, durabilityCount: 0, ergoTotal: 0, ergoPass: 0 };
      
      // Durability
      p.durabilityTests.forEach(test => {
        seriesMap[sName].durabilitySum += test.score;
        seriesMap[sName].durabilityCount++;
      });

      // Ergo
      p.ergoProjects.forEach(proj => {
        seriesMap[sName].ergoTotal++;
        if (proj.overallStatus === ProjectOverallStatus.PASS) seriesMap[sName].ergoPass++;
      });
    });

    return Object.entries(seriesMap).map(([name, data]) => ({
      name,
      durabilityAvg: data.durabilityCount > 0 ? Math.round(data.durabilitySum / data.durabilityCount) : 0,
      ergoPassRate: data.ergoTotal > 0 ? Math.round((data.ergoPass / data.ergoTotal) * 100) : 0,
      ergoCount: data.ergoTotal
    }));
  }, [products, t]);

  const totalQuantity = useMemo(() => chartData.reduce((acc, curr) => acc + curr.value, 0), [chartData]);

  const handleDrill = (entry: any) => {
    if (currentLevel === 'VERSION') return;
    setDrillPath([...drillPath, { level: currentLevel, label: entry.name, filterVal: entry.name }]);
  };

  const handleBack = () => setDrillPath(drillPath.slice(0, -1));

  const handleResetDrill = (dim: DimensionFilter) => {
    setDimension(dim);
    setDrillPath([]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws);
        const newShipments: ShipmentData[] = jsonData.map((row: any, i) => ({
          id: `imp-${Date.now()}-${i}`,
          modelId: 'imported',
          shipDate: row['Shipped date'] || '',
          buyer: row['Buyer'] || 'Unknown',
          deliveryNo: String(row['Delivery No.'] || ''),
          item: String(row['Item'] || ''),
          pi: String(row['P/I'] || ''),
          pn: String(row['P/N'] || ''),
          description: row['Description'] || '',
          sku: row['Sku'] || row['SKU'] || 'N/A',
          quantity: Number(row['QTY'] || row['Quantity'] || 0),
          sn: String(row['S/N'] || ''),
          version: String(row['Version'] || '1'),
          category: row['Category'] || 'Other',
          series: row['Series'] || 'General',
          country: row['Country'] || row['Region'] || 'Global'
        }));
        onImportData(newShipments);
        alert(`Successfully imported ${newShipments.length} records.`);
      } catch (err) { alert('File parsing error.'); }
    };
    reader.readAsArrayBuffer(file);
  };

  const traceResults = useMemo(() => {
    if (!traceSearchQuery) return [];
    const q = traceSearchQuery.toLowerCase();
    return shipments.filter(s => 
      s.sn?.toLowerCase().includes(q) || 
      s.deliveryNo?.toLowerCase().includes(q) || 
      s.pi?.toLowerCase().includes(q) || 
      s.pn?.toLowerCase().includes(q) ||
      s.buyer?.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [traceSearchQuery, shipments]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-slate-200 shadow-2xl rounded-2xl min-w-[200px]">
          {data.imageUrl && <img src={data.imageUrl} className="w-full h-28 object-contain rounded-lg mb-3 bg-slate-50 border border-slate-100 p-2" alt={data.name} />}
          <p className="font-black text-slate-900 text-sm mb-1 uppercase tracking-tight">{data.name}</p>
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Metric Value</span>
            <span className="text-intenza-600 font-black text-base">{data.value.toLocaleString()}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-8 w-full min-h-screen bg-slate-50/30">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-slate-500 mt-2 font-medium">Global shipment insights combined with design quality metrics.</p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-slate-200/50 p-1.5 rounded-2xl shadow-inner border border-slate-200">
           <button 
              onClick={() => setActiveTab('MARKET')} 
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'MARKET' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
           >
              <LayoutGrid size={18} /> {t({en: 'Market Map', zh: '市場分布'})}
           </button>
           <button 
              onClick={() => setActiveTab('QUALITY')} 
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'QUALITY' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
           >
              <ShieldCheck size={18} /> {t({en: 'Quality Matrix', zh: '品質矩陣'})}
           </button>
           <button 
              onClick={() => setActiveTab('LIST')} 
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'LIST' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
           >
              <List size={18} /> {t({en: 'Asset Registry', zh: '資產清單'})}
           </button>
        </div>
      </header>

      {activeTab === 'MARKET' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-fade-in">
          <div className="lg:col-span-3 space-y-8">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                {drillPath.length > 0 && (
                  <button onClick={handleBack} className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition-colors">
                    <ArrowLeft size={20} strokeWidth={3} />
                  </button>
                )}
                <div>
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    {drillPath.length === 0 ? "Global Market Map" : drillPath[drillPath.length-1].label}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] uppercase font-black text-white px-2 py-0.5 bg-slate-900 rounded-md">Level: {currentLevel}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
                  <button onClick={() => handleResetDrill('DATA_DRILL')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${dimension === 'DATA_DRILL' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>BY METRIC</button>
                  <button onClick={() => handleResetDrill('BUYER')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${dimension === 'BUYER' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>BY BUYER</button>
                  <button onClick={() => handleResetDrill('COLOR')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${dimension === 'COLOR' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>BY COLOR</button>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
                  <button onClick={() => setChartType('PIE')} className={`p-2 rounded-lg transition-all ${chartType === 'PIE' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}><PieIcon size={18}/></button>
                  <button onClick={() => setChartType('BAR')} className={`p-2 rounded-lg transition-all ${chartType === 'BAR' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}><BarIcon size={18}/></button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm min-h-[550px] flex flex-col relative overflow-hidden">
              <div className="flex-1 mt-6">
                <ResponsiveContainer width="100%" height={500}>
                  {chartType === 'PIE' ? (
                    <PieChart>
                      <Pie data={chartData} cx="50%" cy="50%" innerRadius="65%" outerRadius="90%" dataKey="value" onClick={handleDrill} cursor="pointer" stroke="#fff" strokeWidth={4} paddingAngle={2}>
                        {chartData.map((entry, i) => <Cell key={`cell-${i}`} fill={currentLevel === 'COLOR' ? (COLOR_MAP[entry.name] || COLORS[i % COLORS.length]) : COLORS[i % COLORS.length]} />)}
                        <Label content={({ viewBox }: any) => {
                          const { cx, cy } = viewBox;
                          return (
                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
                              <tspan x={cx} y={cy - 12} className="text-5xl font-black fill-slate-900 tracking-tighter">{totalQuantity.toLocaleString()}</tspan>
                              <tspan x={cx} y={cy + 25} className="text-xs font-black uppercase tracking-[0.2em] fill-slate-300">Total Units</tspan>
                            </text>
                          );
                        }} />
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} height={100} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#cbd5e1', fontWeight: 'bold' }} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="value" radius={[12, 12, 0, 0]} onClick={handleDrill} cursor="pointer" barSize={50}>
                        {chartData.map((entry, i) => <Cell key={`cell-${i}`} fill={currentLevel === 'COLOR' ? (COLOR_MAP[entry.name] || COLORS[i % COLORS.length]) : COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
             <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm h-full max-h-[700px] flex flex-col">
                <h3 className="font-black text-xl text-slate-900 mb-6 flex items-center gap-3">
                  <ClipboardList size={22} className="text-intenza-600" /> Trace Records
                </h3>
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" placeholder="Serial, PI or Buyer..." value={traceSearchQuery} onChange={(e) => setTraceSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl text-sm font-bold focus:border-slate-900 focus:bg-white outline-none transition-all shadow-inner" />
                </div>
                <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                  {traceResults.map(r => (
                    <div key={r.id} className="p-4 bg-white border-2 border-slate-50 rounded-2xl hover:border-slate-200 transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-1 rounded-md">SN: {r.sn}</span>
                        <span className="text-[9px] text-slate-400 font-black">{r.shipDate}</span>
                      </div>
                      <div className="text-xs font-black text-slate-800 uppercase line-clamp-1">{r.description}</div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] text-slate-500 border-t border-slate-50 pt-3 mt-3">
                        <div><span className="text-slate-300 font-black uppercase block text-[8px]">Buyer</span> <span className="font-bold text-slate-700">{r.buyer}</span></div>
                        <div><span className="text-slate-300 font-black uppercase block text-[8px]">Qty</span> <span className="font-bold text-slate-700">{r.quantity}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
             {showAiInsights && <GeminiInsight context="Shipment analysis for global executive review." data={chartData} />}
          </div>
        </div>
      )}

      {activeTab === 'QUALITY' && (
        <div className="animate-fade-in space-y-8">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Durability Benchmarking */}
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm">
                 <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-slate-900 rounded-lg text-white"><Thermometer size={20} /></div>
                    <h3 className="font-black text-2xl text-slate-900">Durability Benchmark</h3>
                 </div>
                 <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={qualitySeriesData} layout="vertical" margin={{ left: 40, right: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                          <XAxis type="number" domain={[0, 100]} hide />
                          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 'bold', fill: '#64748b' }} />
                          <Tooltip cursor={{ fill: '#f8fafc' }} content={({ payload }) => {
                             if (!payload || !payload.length) return null;
                             const d = payload[0].payload;
                             return (
                                <div className="bg-slate-900 text-white p-3 rounded-xl text-xs font-bold shadow-2xl">
                                   <div>Average Score: {d.durabilityAvg}%</div>
                                </div>
                             )
                          }} />
                          <Bar dataKey="durabilityAvg" radius={[0, 12, 12, 0]} fill="#e3261b" barSize={30}>
                             {qualitySeriesData.map((entry, i) => <Cell key={`cell-${i}`} fill={entry.durabilityAvg > 90 ? '#10b981' : entry.durabilityAvg > 70 ? '#fbbf24' : '#e3261b'} />)}
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
                 <div className="mt-6 flex justify-between px-10">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">0% Failure</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">100% Passed</span>
                 </div>
              </div>

              {/* Ergo Validation Status */}
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm">
                 <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-slate-900 rounded-lg text-white"><ShieldCheck size={20} /></div>
                    <h3 className="font-black text-2xl text-slate-900">Human Factors Validation</h3>
                 </div>
                 <div className="space-y-6">
                    {qualitySeriesData.map(s => (
                       <div key={s.name} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black text-slate-400">
                                {s.ergoCount}
                             </div>
                             <div>
                                <div className="text-sm font-black text-slate-900 uppercase tracking-tight">{s.name}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Projects Evaluated</div>
                             </div>
                          </div>
                          <div className="text-right">
                             <div className="text-2xl font-black text-slate-900">{s.ergoPassRate}%</div>
                             <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Pass Rate</div>
                          </div>
                       </div>
                    ))}
                 </div>
                 {qualitySeriesData.length === 0 && <div className="text-center py-20 text-slate-400 font-bold">No validation projects found.</div>}
              </div>
           </div>
           {showAiInsights && <GeminiInsight context="Quality metrics summary for management review." data={qualitySeriesData} />}
        </div>
      )}

      {activeTab === 'LIST' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
           <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight">Product Status Registry</h3>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{products.length} Products Registered</div>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left">
                 <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                    <tr>
                       <th className="px-8 py-5">Product Identity</th>
                       <th className="px-8 py-5">Series</th>
                       <th className="px-8 py-5">Version</th>
                       <th className="px-8 py-5">Durability</th>
                       <th className="px-8 py-5">Human Factors</th>
                       <th className="px-8 py-5 text-right">Action</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    {products.map(p => {
                       const durScore = p.durabilityTests.length > 0 ? Math.round(p.durabilityTests.reduce((a,b)=>a+b.score, 0) / p.durabilityTests.length) : 0;
                       const ergoStatus = p.ergoProjects.length > 0 ? p.ergoProjects[p.ergoProjects.length-1].overallStatus : 'NONE';
                       
                       return (
                          <tr key={p.id} className="hover:bg-slate-50/80 transition-all group">
                             <td className="px-8 py-6">
                                <div className="flex items-center gap-4">
                                   <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 p-2 flex items-center justify-center overflow-hidden">
                                      {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-contain" /> : <ImageIcon size={20} className="text-slate-300" />}
                                   </div>
                                   <div>
                                      <div className="text-sm font-black text-slate-900 group-hover:text-intenza-600 transition-colors">{t(p.modelName)}</div>
                                      <div className="text-[10px] font-bold text-slate-400 font-mono mt-0.5">{p.sku}</div>
                                   </div>
                                </div>
                             </td>
                             <td className="px-8 py-6">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">{t(p.series)}</span>
                             </td>
                             <td className="px-8 py-6">
                                <span className="px-2 py-1 bg-slate-900 text-white text-[10px] font-black rounded uppercase">{p.currentVersion}</span>
                             </td>
                             <td className="px-8 py-6">
                                <div className="w-32">
                                   <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest mb-1.5 text-slate-400">
                                      <span>Progress</span>
                                      <span>{durScore}%</span>
                                   </div>
                                   <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-intenza-500 transition-all duration-1000" style={{ width: `${durScore}%` }}></div>
                                   </div>
                                </div>
                             </td>
                             <td className="px-8 py-6">
                                {ergoStatus === 'PASS' ? (
                                   <div className="flex items-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest">
                                      <CheckCircle2 size={14} /> Certified
                                   </div>
                                ) : ergoStatus === 'NG' ? (
                                   <div className="flex items-center gap-2 text-red-500 font-black text-[10px] uppercase tracking-widest">
                                      <AlertCircle size={14} /> Failed
                                   </div>
                                ) : (
                                   <div className="flex items-center gap-2 text-slate-300 font-black text-[10px] uppercase tracking-widest">
                                      <Clock size={14} /> Pending
                                   </div>
                                )}
                             </td>
                             <td className="px-8 py-6 text-right">
                                <button 
                                   onClick={() => navigate(`/product/${p.id}`)}
                                   className="p-2.5 rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                                >
                                   <ChevronRight size={18} />
                                </button>
                             </td>
                          </tr>
                       );
                    })}
                 </tbody>
              </table>
           </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
