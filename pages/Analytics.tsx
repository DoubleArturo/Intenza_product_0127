
import React, { useState, useMemo, useRef, useContext } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { 
  ArrowLeft, PieChart as PieIcon, BarChart as BarIcon, Search, FileSpreadsheet, 
  Layers, Palette, Tag, Globe, Users, Box, Truck, Activity, 
  BrainCircuit, AlertTriangle, CheckCircle, Clock, ChevronDown, Filter, LayoutGrid, 
  Image as ImageIcon, ClipboardList, ListFilter, User
} from 'lucide-react';
import { ShipmentData, ChartViewType, DrillLevel, ProductModel, TestStatus, ErgoProjectCategory, Tester } from '../types';
import GeminiInsight from '../components/GeminiInsight';
import * as XLSX from 'xlsx';
import { LanguageContext } from '../App';

const COLORS = ['#0f172a', '#e3261b', '#94a3b8', '#fbbf24', '#f63e32', '#475569', '#3b82f6', '#10b981', '#8b5cf6', '#d946ef', '#06b6d4'];

// Palettes for color split
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

type MainView = 'SHIPMENT' | 'ERGO' | 'PRODUCT_TEST';
type DimensionFilter = 'DATA_DRILL' | 'BUYER';

const Analytics: React.FC<AnalyticsProps> = ({ products, shipments, onImportData, onBatchAddProducts, showAiInsights }) => {
  const { language, t } = useContext(LanguageContext);
  
  // NAVIGATION STATE
  const [activeView, setActiveView] = useState<MainView>('SHIPMENT');

  // SHIPMENT VIEW STATES
  const [chartType, setChartType] = useState<ChartViewType>('PIE');
  const [drillPath, setDrillPath] = useState<{ level: string, label: string, filterVal: string }[]>([]);
  const [dimension, setDimension] = useState<DimensionFilter>('DATA_DRILL');
  const [isUploading, setIsUploading] = useState(false);
  const [traceSearchQuery, setTraceSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // DRILL-DOWN LOGIC (Category > Series > SKU > Version)
  const currentLevel = useMemo(() => {
    const depth = drillPath.length;
    if (dimension === 'BUYER') return 'BUYER';
    
    switch (depth) {
      case 0: return 'CATEGORY';
      case 1: return 'SERIES';
      case 2: return 'SKU';
      case 3: return 'VERSION';
      default: return 'VERSION';
    }
  }, [drillPath, dimension]);

  const filteredShipments = useMemo(() => {
    let data = [...shipments];
    drillPath.forEach((step, index) => {
      if (step.level === 'CATEGORY') data = data.filter(s => s.category === step.filterVal);
      if (step.level === 'SERIES') data = data.filter(s => s.series === step.filterVal);
      if (step.level === 'SKU') data = data.filter(s => s.sku === step.filterVal);
    });
    return data;
  }, [shipments, drillPath]);

  const chartData = useMemo(() => {
    const aggregated: Record<string, number> = {};
    const meta: Record<string, { sku?: string, imageUrl?: string, fullName?: string }> = {};

    filteredShipments.forEach(item => {
      let key = '';
      if (dimension === 'BUYER') {
        key = item.buyer;
      } else {
        switch (currentLevel) {
          case 'CATEGORY': key = item.category || 'N/A'; break;
          case 'SERIES': key = item.series || 'N/A'; break;
          case 'SKU': key = item.sku || 'N/A'; break;
          case 'VERSION': key = item.version || 'v1.0'; break;
          default: key = item.category;
        }
      }

      aggregated[key] = (aggregated[key] || 0) + item.quantity;
      
      // Attach metadata for the "SKU" or "VERSION" level to show thumbnails
      if (currentLevel === 'SKU' || currentLevel === 'VERSION') {
        const prod = products.find(p => p.sku === item.sku);
        if (prod) {
          meta[key] = {
            sku: prod.sku,
            imageUrl: prod.imageUrl,
            fullName: t(prod.modelName)
          };
        }
      }
    });

    return Object.keys(aggregated).map(key => ({
      name: key,
      value: aggregated[key],
      ...meta[key]
    })).sort((a, b) => b.value - a.value);
  }, [filteredShipments, currentLevel, dimension, products, t]);

  // COLOR ANALYSIS LOGIC
  const colorData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredShipments.forEach(s => {
      const desc = (s.description || '').toLowerCase();
      let color = 'Others';
      if (desc.includes('brown') || desc.includes('咖啡')) color = 'Brown';
      else if (desc.includes('black') || desc.includes('黑')) color = 'Black';
      else if (desc.includes('white') || desc.includes('白')) color = 'White';
      else if (desc.includes('red') || desc.includes('紅')) color = 'Red';
      else if (desc.includes('silver') || desc.includes('銀')) color = 'Silver';
      
      counts[color] = (counts[color] || 0) + s.quantity;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredShipments]);

  // TRACEABILITY / SEARCH LOGIC
  const traceResults = useMemo(() => {
    if (!traceSearchQuery) return [];
    const q = traceSearchQuery.toLowerCase();
    return shipments.filter(s => 
      s.sn?.toLowerCase().includes(q) || 
      s.deliveryNo?.toLowerCase().includes(q) || 
      s.pi?.toLowerCase().includes(q) || 
      s.pn?.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [traceSearchQuery, shipments]);

  const handleDrill = (entry: any) => {
    if (dimension === 'BUYER' || currentLevel === 'VERSION') return;
    setDrillPath([...drillPath, { level: currentLevel, label: entry.name, filterVal: entry.name }]);
  };

  const handleBack = () => {
    setDrillPath(drillPath.slice(0, -1));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws);
        
        const newShipments: ShipmentData[] = jsonData.map((row: any, i) => ({
          id: `imp-${Date.now()}-${i}`,
          modelId: 'imported', // Logic to map to actual product if exists
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
          series: row['Series'] || 'General'
        }));

        onImportData(newShipments);
        alert(`Successfully imported ${newShipments.length} records.`);
      } catch (err) {
        alert('File parsing error.');
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-slate-200 shadow-2xl rounded-2xl min-w-[180px]">
          {data.imageUrl && (
            <img src={data.imageUrl} className="w-full h-24 object-cover rounded-lg mb-3 bg-slate-50 border border-slate-100" />
          )}
          <p className="font-bold text-slate-900 text-sm mb-1">{data.name}</p>
          {data.fullName && <p className="text-[10px] text-slate-500 mb-2">{data.fullName}</p>}
          <div className="flex items-center justify-between border-t border-slate-50 pt-2">
            <span className="text-xs text-slate-400">Total QTY</span>
            <span className="text-intenza-600 font-bold">{data.value.toLocaleString()}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-8 w-full min-h-screen">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Inventory Dashboard</h1>
          <p className="text-slate-500 mt-1">Multi-level data visualization & traceability.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 transition-all">
            <FileSpreadsheet size={18} className="text-green-600" /> Import Data
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
        </div>
      </header>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left: Charts Column */}
        <div className="lg:col-span-3 space-y-8">
          
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              {drillPath.length > 0 && (
                <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                  <ArrowLeft size={18} />
                </button>
              )}
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  {drillPath.length === 0 ? "Global Distribution" : drillPath[drillPath.length-1].label}
                </h2>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] uppercase font-bold text-intenza-600 px-1.5 py-0.5 bg-intenza-50 rounded">Level: {currentLevel}</span>
                  {drillPath.length > 0 && <span className="text-[10px] text-slate-300">/</span>}
                  {drillPath.map((p, i) => (
                    <span key={i} className="text-[10px] text-slate-400 font-medium">{p.label}{i < drillPath.length -1 ? ' > ' : ''}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setDimension('DATA_DRILL')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dimension === 'DATA_DRILL' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}>By Metric</button>
                <button onClick={() => setDimension('BUYER')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dimension === 'BUYER' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}>By Buyer</button>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setChartType('PIE')} className={`p-1.5 rounded-lg ${chartType === 'PIE' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}><PieIcon size={16}/></button>
                <button onClick={() => setChartType('BAR')} className={`p-1.5 rounded-lg ${chartType === 'BAR' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}><BarIcon size={16}/></button>
              </div>
            </div>
          </div>

          {/* Main Chart Area */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm min-h-[500px] flex flex-col">
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={450}>
                {chartType === 'PIE' ? (
                  <PieChart>
                    <Pie 
                      data={chartData} 
                      cx="50%" cy="50%" 
                      innerRadius="40%" outerRadius="75%" 
                      dataKey="value" 
                      onClick={handleDrill}
                      cursor="pointer"
                    >
                      {chartData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Bar 
                      dataKey="value" 
                      radius={[8, 8, 0, 0]} 
                      onClick={handleDrill} 
                      cursor="pointer"
                      barSize={40}
                    >
                      {chartData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Color Split Row */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Palette className="text-intenza-600" size={18} />
              <h3 className="font-bold text-slate-900">Color Variation Analysis</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
               {colorData.map(c => (
                 <div key={c.name} className="flex flex-col items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-8 h-8 rounded-full mb-3 shadow-sm ring-2 ring-white" style={{ backgroundColor: COLOR_MAP[c.name] || '#e2e8f0' }} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{c.name}</span>
                    <span className="text-lg font-bold text-slate-900 mt-1">{c.value.toLocaleString()}</span>
                    <span className="text-[9px] text-slate-400">units</span>
                 </div>
               ))}
            </div>
          </div>
        </div>

        {/* Right: Traceability & AI Sidebar */}
        <div className="space-y-6">
          
          {/* Traceability Search */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ClipboardList size={18} className="text-intenza-600" /> Data Traceability
            </h3>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search S/N, Delivery No..." 
                value={traceSearchQuery}
                onChange={(e) => setTraceSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-intenza-500/20 outline-none"
              />
            </div>
            
            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
              {traceSearchQuery && traceResults.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs italic">No matching records.</div>
              )}
              {traceResults.map(r => (
                <div key={r.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-white hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[9px] font-bold bg-intenza-600 text-white px-1.5 py-0.5 rounded">S/N: {r.sn}</span>
                    <span className="text-[8px] text-slate-400 font-mono">{r.shipDate}</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-800 line-clamp-1">{r.description}</div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] text-slate-500 border-t border-slate-100 pt-1.5">
                      <div><span className="text-slate-400 uppercase">Buyer:</span> {r.buyer}</div>
                      <div><span className="text-slate-400 uppercase">Deliv:</span> {r.deliveryNo}</div>
                      <div><span className="text-slate-400 uppercase">PI:</span> {r.pi}</div>
                      <div><span className="text-slate-400 uppercase">PN:</span> {r.pn}</div>
                      <div><span className="text-slate-400 uppercase">SKU:</span> {r.sku}</div>
                      <div><span className="text-slate-400 uppercase">Ver:</span> {r.version}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {showAiInsights && (
            <GeminiInsight 
              context={`Inventory Analyst view. Current Level: ${currentLevel}. Dimension: ${dimension}. Level path: ${drillPath.map(p=>p.label).join(' > ')}`} 
              data={chartData} 
            />
          )}

          {/* Quick Stats Summary */}
          <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
             <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Total Inventory Summary</h4>
             <div className="space-y-4">
               <div>
                  <div className="text-xs text-slate-400 mb-1">Total Shipped Quantity</div>
                  <div className="text-3xl font-bold">{shipments.reduce((acc,s)=>acc+s.quantity, 0).toLocaleString()}</div>
               </div>
               <div className="flex justify-between items-center pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2">
                     <Box size={14} className="text-intenza-500" />
                     <span className="text-xs font-medium">SKUs Tracked</span>
                  </div>
                  <span className="text-sm font-bold">{new Set(shipments.map(s=>s.sku)).size}</span>
               </div>
               <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                     <User size={14} className="text-blue-400" />
                     <span className="text-xs font-medium">Active Buyers</span>
                  </div>
                  <span className="text-sm font-bold">{new Set(shipments.map(s=>s.buyer)).size}</span>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
