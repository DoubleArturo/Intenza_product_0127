
import React, { useState, useMemo, useRef, useContext } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Label
} from 'recharts';
import { 
  ArrowLeft, PieChart as PieIcon, BarChart as BarIcon, Search, FileSpreadsheet, 
  Palette, Box, Activity, ChevronDown, 
  Image as ImageIcon, ClipboardList, User, LayoutDashboard, UserCheck, ShieldCheck, Timer, Zap, CheckCircle2, Clock, AlertCircle
} from 'lucide-react';
import { ShipmentData, ChartViewType, ProductModel, Tester, TestStatus, ErgoProjectCategory, NgDecisionStatus } from '../types';
import GeminiInsight from '../components/GeminiInsight';
import * as XLSX from 'xlsx';
import { LanguageContext } from '../App';

const COLORS = ['#0f172a', '#e3261b', '#94a3b8', '#fbbf24', '#f63e32', '#475569', '#3b82f6', '#10b981', '#8b5cf6', '#d946ef', '#06b6d4'];

const COLOR_MAP: Record<string, string> = {
  'Brown': '#78350f',
  'Black': '#020617',
  'White': '#f8fafc',
  'Red': '#ef4444',
  'Silver': '#94a3b8',
  'Others': '#e2e8f0'
};

const TEST_STATUS_COLORS: Record<string, string> = {
  [TestStatus.PASS]: 'bg-emerald-500',
  [TestStatus.FAIL]: 'bg-red-500',
  [TestStatus.WARNING]: 'bg-amber-500',
  [TestStatus.ONGOING]: 'bg-blue-500',
  [TestStatus.PENDING]: 'bg-slate-300',
};

interface AnalyticsProps {
  products: ProductModel[];
  shipments: ShipmentData[];
  testers?: Tester[];
  onImportData: (data: ShipmentData[]) => void;
  onBatchAddProducts: (products: any[]) => void;
  showAiInsights: boolean;
}

type MainTab = 'SHIPMENT' | 'ERGONOMICS' | 'DURABILITY';
type DimensionFilter = 'DATA_DRILL' | 'BUYER' | 'COLOR';

const Analytics: React.FC<AnalyticsProps> = ({ products, shipments, onImportData, onBatchAddProducts, showAiInsights }) => {
  const { language, t } = useContext(LanguageContext);
  
  const [activeTab, setActiveTab] = useState<MainTab>('SHIPMENT');
  const [chartType, setChartType] = useState<ChartViewType>('PIE');
  const [drillPath, setDrillPath] = useState<{ level: string, label: string, filterVal: string }[]>([]);
  const [dimension, setDimension] = useState<DimensionFilter>('DATA_DRILL');
  const [traceSearchQuery, setTraceSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatVersion = (v: string) => {
    const clean = (v || '1.0').toUpperCase().replace('V', '');
    return `V${clean}`;
  };

  /**
   * Shipment Drill-Down Calculations
   */
  const currentLevel = useMemo(() => {
    const depth = drillPath.length;
    if (dimension === 'BUYER') return depth === 0 ? 'BUYER' : depth === 1 ? 'SERIES' : depth === 2 ? 'SKU' : 'VERSION';
    if (dimension === 'COLOR') return depth === 0 ? 'COLOR' : depth === 1 ? 'SERIES' : depth === 2 ? 'SKU' : 'VERSION';
    switch (depth) {
      case 0: return 'CATEGORY';
      case 1: return 'SERIES';
      case 2: return 'SKU';
      case 3: return 'BUYER'; 
      case 4: return 'VERSION'; 
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
        meta[key] = { sku: prod.sku, imageUrl: prod.imageUrl, fullName: t(prod.modelName) };
      }
    });
    return Object.keys(aggregated).map(key => ({ name: key, value: aggregated[key], ...meta[key] })).sort((a, b) => b.value - a.value);
  }, [filteredShipments, currentLevel, products, t]);

  const totalQuantity = useMemo(() => chartData.reduce((acc, curr) => acc + curr.value, 0), [chartData]);

  /**
   * Ergonomics Progress Calculations
   */
  const ergoProgressData = useMemo(() => {
    return products.map(p => {
      let totalTasks = 0;
      let completedTasks = 0;
      let passedTestersCount = 0;
      let totalTestersPossible = 0;

      p.ergoProjects.forEach(proj => {
        const categories: ErgoProjectCategory[] = ['Strength Curve', 'Experience', 'Stroke', 'Other Suggestion'];
        categories.forEach(cat => {
          proj.tasks[cat]?.forEach(task => {
            totalTasks++;
            if (task.passTesterIds.length > 0) completedTasks++;
            passedTestersCount += task.passTesterIds.length;
            totalTestersPossible += proj.testerIds.length;
          });
        });
      });

      const progress = totalTestersPossible > 0 ? (passedTestersCount / totalTestersPossible) * 100 : 0;

      return {
        id: p.id,
        name: t(p.modelName),
        sku: p.sku,
        imageUrl: p.imageUrl,
        progress: Math.round(progress),
        projectCount: p.ergoProjects.length,
        taskCount: totalTasks
      };
    }).filter(p => p.projectCount > 0).sort((a, b) => b.progress - a.progress);
  }, [products, t]);

  /**
   * Durability Progress Calculations
   */
  const durabilityProgressData = useMemo(() => {
    return products.map(p => {
      const tests = p.durabilityTests || [];
      const avgScore = tests.length > 0 ? tests.reduce((acc, curr) => acc + curr.score, 0) / tests.length : 0;
      return {
        id: p.id,
        name: t(p.modelName),
        sku: p.sku,
        imageUrl: p.imageUrl,
        progress: Math.round(avgScore),
        testCount: tests.length,
        tests
      };
    }).filter(p => p.testCount > 0).sort((a, b) => b.progress - a.progress);
  }, [products, t]);

  const handleDrill = (entry: any) => {
    if (currentLevel === 'VERSION') return;
    setDrillPath([...drillPath, { level: currentLevel, label: entry.name, filterVal: entry.name }]);
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
      s.buyer?.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [traceSearchQuery, shipments]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-slate-200 shadow-2xl rounded-2xl min-w-[200px]">
          {data.imageUrl && <img src={data.imageUrl} className="w-full h-28 object-contain rounded-lg mb-3 bg-slate-50 border border-slate-100 p-2" alt="" />}
          <p className="font-black text-slate-900 text-sm mb-1 uppercase tracking-tight">{data.name}</p>
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qty Count</span>
            <span className="text-intenza-600 font-black text-base">{data.value.toLocaleString()}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-8 w-full min-h-screen bg-slate-50/30">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Product Dashboard</h1>
          <p className="text-slate-500 mt-2 font-medium">Global fleet intelligence and verification tracking.</p>
        </div>
        <div className="flex items-center gap-4 bg-slate-100 p-1.5 rounded-2xl shadow-inner">
          <button 
            onClick={() => setActiveTab('SHIPMENT')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'SHIPMENT' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}
          >
            <LayoutDashboard size={16} /> Shipments
          </button>
          <button 
            onClick={() => setActiveTab('ERGONOMICS')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'ERGONOMICS' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}
          >
            <UserCheck size={16} /> Ergo Progress
          </button>
          <button 
            onClick={() => setActiveTab('DURABILITY')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'DURABILITY' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}
          >
            <ShieldCheck size={16} /> Durability
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          
          {activeTab === 'SHIPMENT' && (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  {drillPath.length > 0 && (
                    <button onClick={() => setDrillPath(drillPath.slice(0, -1))} className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition-colors">
                      <ArrowLeft size={20} strokeWidth={3} />
                    </button>
                  )}
                  <div>
                    <h2 className="text-lg font-black text-slate-900">{drillPath.length === 0 ? "Global Market Map" : drillPath[drillPath.length-1].label}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] uppercase font-black text-white px-2 py-0.5 bg-slate-900 rounded-md">Level: {currentLevel}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
                    <button onClick={() => { setDimension('DATA_DRILL'); setDrillPath([]); }} className={`px-4 py-2 rounded-lg text-xs font-black ${dimension === 'DATA_DRILL' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>BY METRIC</button>
                    <button onClick={() => { setDimension('BUYER'); setDrillPath([]); }} className={`px-4 py-2 rounded-lg text-xs font-black ${dimension === 'BUYER' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>BY BUYER</button>
                    <button onClick={() => { setDimension('COLOR'); setDrillPath([]); }} className={`px-4 py-2 rounded-lg text-xs font-black ${dimension === 'COLOR' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>BY COLOR</button>
                  </div>
                  <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
                    <button onClick={() => setChartType('PIE')} className={`p-2 rounded-lg ${chartType === 'PIE' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}><PieIcon size={18}/></button>
                    <button onClick={() => setChartType('BAR')} className={`p-2 rounded-lg ${chartType === 'BAR' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}><BarIcon size={18}/></button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm min-h-[550px] flex flex-col relative">
                <ResponsiveContainer width="100%" height={500}>
                  {chartType === 'PIE' ? (
                    <PieChart>
                      <Pie data={chartData} cx="50%" cy="50%" innerRadius="65%" outerRadius="90%" dataKey="value" onClick={handleDrill} cursor="pointer" stroke="#fff" strokeWidth={4} paddingAngle={2}>
                        {chartData.map((entry, i) => <Cell key={`c-${i}`} fill={dimension === 'COLOR' ? (COLOR_MAP[entry.name] || COLORS[i % COLORS.length]) : COLORS[i % COLORS.length]} />)}
                        <Label content={({ viewBox }: any) => (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="central">
                            <tspan x={viewBox.cx} y={viewBox.cy - 12} className="text-5xl font-black fill-slate-900 tracking-tighter">{totalQuantity.toLocaleString()}</tspan>
                            <tspan x={viewBox.cx} y={viewBox.cy + 25} className="text-[10px] font-black uppercase tracking-widest fill-slate-300">Filtered Units</tspan>
                          </text>
                        )} />
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#cbd5e1', fontWeight: 'bold' }} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="value" radius={[12, 12, 0, 0]} onClick={handleDrill} cursor="pointer" barSize={50}>
                        {chartData.map((entry, i) => <Cell key={`b-${i}`} fill={dimension === 'COLOR' ? (COLOR_MAP[entry.name] || COLORS[i % COLORS.length]) : COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'ERGONOMICS' && (
            <div className="space-y-6 animate-fade-in">
               <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-8">
                     <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-600/20"><UserCheck size={24} /></div>
                     <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Ergonomic Verification Fleet</h3>
                        <p className="text-slate-400 text-sm font-medium">Tracking verification pass rates across human factor evaluation projects.</p>
                     </div>
                  </div>
                  <div className="space-y-4">
                    {ergoProgressData.length === 0 ? (
                      <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                         <Timer className="mx-auto text-slate-200 mb-3" size={48} />
                         <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No Ergonomic Projects Recorded</p>
                      </div>
                    ) : ergoProgressData.map(item => (
                      <div key={item.id} className="p-6 bg-slate-50/50 hover:bg-white rounded-[1.5rem] border border-slate-100 hover:border-slate-300 transition-all flex items-center gap-8">
                         <div className="w-16 h-16 bg-white rounded-xl border border-slate-200 p-1 flex-shrink-0">
                            {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-contain" alt="" /> : <Box className="w-full h-full p-3 text-slate-200" />}
                         </div>
                         <div className="flex-1">
                            <div className="flex justify-between items-end mb-2">
                               <div>
                                  <h4 className="font-black text-slate-900 uppercase tracking-tight">{item.name}</h4>
                                  <p className="text-[10px] font-mono font-bold text-slate-400">{item.sku}</p>
                               </div>
                               <div className="text-right">
                                  <span className="text-2xl font-black text-slate-900">{item.progress}%</span>
                                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Verification Pass</p>
                               </div>
                            </div>
                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                               <div className="h-full bg-indigo-600 transition-all duration-1000" style={{ width: `${item.progress}%` }}></div>
                            </div>
                            <div className="flex gap-4 mt-4">
                               <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest"><LayoutDashboard size={10}/> {item.projectCount} Projects</div>
                               <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest"><Timer size={10}/> {item.taskCount} Tasks</div>
                            </div>
                         </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'DURABILITY' && (
            <div className="space-y-6 animate-fade-in">
               <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-8">
                     <div className="p-3 bg-emerald-600 rounded-2xl text-white shadow-lg shadow-emerald-600/20"><ShieldCheck size={24} /></div>
                     <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Durability Testing Registry</h3>
                        <p className="text-slate-400 text-sm font-medium">Monitoring fleet-wide mechanical and durability testing progress.</p>
                     </div>
                  </div>
                  <div className="space-y-4">
                    {durabilityProgressData.length === 0 ? (
                      <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                         <Zap className="mx-auto text-slate-200 mb-3" size={48} />
                         <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No Durability Tests Recorded</p>
                      </div>
                    ) : durabilityProgressData.map(item => (
                      <div key={item.id} className="p-6 bg-slate-50/50 hover:bg-white rounded-[1.5rem] border border-slate-100 hover:border-slate-300 transition-all">
                         <div className="flex items-center gap-8 mb-4">
                            <div className="w-16 h-16 bg-white rounded-xl border border-slate-200 p-1 flex-shrink-0">
                               {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-contain" alt="" /> : <Box className="w-full h-full p-3 text-slate-200" />}
                            </div>
                            <div className="flex-1">
                               <div className="flex justify-between items-end mb-2">
                                  <div>
                                     <h4 className="font-black text-slate-900 uppercase tracking-tight">{item.name}</h4>
                                     <p className="text-[10px] font-mono font-bold text-slate-400">{item.sku}</p>
                                  </div>
                                  <div className="text-right">
                                     <span className="text-2xl font-black text-slate-900">{item.progress}%</span>
                                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Progress</p>
                                  </div>
                               </div>
                               <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-600 transition-all duration-1000" style={{ width: `${item.progress}%` }}></div>
                               </div>
                            </div>
                         </div>
                         <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                            {item.tests.map(t => (
                              <div key={t.id} className="px-3 py-1.5 bg-white border border-slate-100 rounded-lg flex items-center gap-2 group/t">
                                 <div className={`w-1.5 h-1.5 rounded-full ${TEST_STATUS_COLORS[t.status]}`}></div>
                                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter truncate max-w-[100px]">{t.testName.en}</span>
                                 <span className="text-[9px] font-mono font-bold text-slate-400">{t.score}%</span>
                              </div>
                            ))}
                         </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          )}

        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col h-full max-h-[600px]">
            <h3 className="font-black text-xl text-slate-900 mb-6 flex items-center gap-3"><ClipboardList size={22} className="text-intenza-600" /> Trace Records</h3>
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="SN or Buyer..." value={traceSearchQuery} onChange={(e) => setTraceSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl text-sm font-bold focus:border-slate-900 focus:bg-white outline-none transition-all shadow-inner" />
            </div>
            <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
              {traceResults.map(r => (
                <div key={r.id} className="p-4 bg-white border-2 border-slate-50 rounded-2xl hover:border-slate-200 transition-all cursor-default">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-1 rounded-md">SN: {r.sn}</span>
                    <span className="text-[9px] text-slate-400 font-black">{r.shipDate}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-black text-slate-800 line-clamp-1 uppercase">{r.description}</div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>{r.buyer}</span>
                      <span className="font-bold">{formatVersion(r.version)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
             <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
             <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6">System Health</h4>
             <div className="space-y-6">
               <div>
                  <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">Active Fleet Units</div>
                  <div className="text-5xl font-black tracking-tighter">{totalQuantity.toLocaleString()}</div>
               </div>
               <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/10">
                  <div className="flex flex-col gap-1">
                     <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Products</span>
                     <span className="text-lg font-black">{products.length}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                     <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Records</span>
                     <span className="text-lg font-black">{shipments.length}</span>
                  </div>
               </div>
             </div>
          </div>
          
          {showAiInsights && <GeminiInsight context={`Market Intelligence Dashboard. Fleet Units: ${totalQuantity}. Active View: ${activeTab}.`} data={{ products, shipments }} />}
          
          <div className="p-4">
             <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 bg-white border-2 border-slate-100 text-slate-700 px-6 py-4 rounded-[1.5rem] font-black text-sm shadow-sm hover:border-slate-900 transition-all active:scale-95">
               <FileSpreadsheet size={20} className="text-emerald-500" /> Batch Import (XLSX)
             </button>
             <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
