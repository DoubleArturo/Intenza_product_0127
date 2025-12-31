import React, { useState, useMemo, useRef, useContext } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Label
} from 'recharts';
import { 
  ArrowLeft, PieChart as PieIcon, BarChart as BarIcon, Search, FileSpreadsheet, 
  Layers, Palette, Box, Activity, ChevronDown, 
  Image as ImageIcon, ClipboardList, User
} from 'lucide-react';
import { ShipmentData, ChartViewType, ProductModel, Tester } from '../types';
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

interface AnalyticsProps {
  products: ProductModel[];
  shipments: ShipmentData[];
  testers?: Tester[];
  onImportData: (data: ShipmentData[]) => void;
  onBatchAddProducts: (products: any[]) => void;
  showAiInsights: boolean;
}

type DimensionFilter = 'DATA_DRILL' | 'BUYER';

const Analytics: React.FC<AnalyticsProps> = ({ products, shipments, onImportData, onBatchAddProducts, showAiInsights }) => {
  const { language, t } = useContext(LanguageContext);
  
  const [chartType, setChartType] = useState<ChartViewType>('PIE');
  const [drillPath, setDrillPath] = useState<{ level: string, label: string, filterVal: string }[]>([]);
  const [dimension, setDimension] = useState<DimensionFilter>('DATA_DRILL');
  const [traceSearchQuery, setTraceSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    drillPath.forEach((step) => {
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
      
      const prod = products.find(p => p.sku === item.sku);
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
  }, [filteredShipments, currentLevel, dimension, products, t]);

  const totalQuantity = useMemo(() => chartData.reduce((acc, curr) => acc + curr.value, 0), [chartData]);

  const handleDrill = (entry: any) => {
    if (dimension === 'BUYER' || currentLevel === 'VERSION') return;
    setDrillPath([...drillPath, { level: currentLevel, label: entry.name, filterVal: entry.name }]);
  };

  const handleBack = () => {
    setDrillPath(drillPath.slice(0, -1));
  };

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
          series: row['Series'] || 'General'
        }));

        onImportData(newShipments);
        alert(`Successfully imported ${newShipments.length} records.`);
      } catch (err) {
        alert('File parsing error.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-slate-200 shadow-2xl rounded-2xl min-w-[200px]">
          {data.imageUrl && (
            <img src={data.imageUrl} className="w-full h-28 object-contain rounded-lg mb-3 bg-slate-50 border border-slate-100 p-2" alt={data.name} />
          )}
          <p className="font-black text-slate-900 text-sm mb-1">{data.name}</p>
          {data.fullName && <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase">{data.fullName}</p>}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Qty</span>
            <span className="text-intenza-600 font-black text-base">{data.value.toLocaleString()}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // 自定義 X 軸刻度，在型號下方顯示縮圖
  const CustomXAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const dataItem = chartData.find(d => d.name === payload.value);
    const showImage = currentLevel === 'SKU' || currentLevel === 'VERSION' || currentLevel === 'BUYER';
    
    return (
      <g transform={`translate(${x},${y})`}>
        <text 
          x={0} 
          y={0} 
          dy={showImage ? 70 : 16} 
          textAnchor="middle" 
          fill="#64748b" 
          fontSize={10} 
          fontWeight="900"
          className="uppercase tracking-tighter"
        >
          {payload.value.length > 12 ? payload.value.substring(0, 10) + '...' : payload.value}
        </text>
        {showImage && dataItem?.imageUrl && (
          <g transform="translate(-25, 10)">
            <defs>
              <clipPath id={`clip-${payload.value}`}>
                <rect width="50" height="50" rx="12" ry="12" />
              </clipPath>
            </defs>
            <rect width="50" height="50" rx="12" ry="12" fill="#fff" stroke="#f1f5f9" strokeWidth="2" className="shadow-sm" />
            <image
              width="44"
              height="44"
              x="3"
              y="3"
              href={dataItem.imageUrl}
              preserveAspectRatio="xMidYMid meet"
              clipPath={`url(#clip-${payload.value})`}
            />
          </g>
        )}
      </g>
    );
  };

  return (
    <div className="p-8 w-full min-h-screen bg-slate-50/30">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Product Dashboard</h1>
          <p className="text-slate-500 mt-2 font-medium">Visualizing equipment distribution & shipment trends.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-white border-2 border-slate-100 text-slate-700 px-6 py-3 rounded-2xl font-black text-sm shadow-sm hover:border-slate-900 transition-all active:scale-95">
            <FileSpreadsheet size={20} className="text-emerald-500" /> Import Records
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          {/* Breadcrumbs & Controls */}
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
                  <span className="text-[10px] uppercase font-black text-white px-2 py-0.5 bg-slate-900 rounded-md">Depth: {currentLevel}</span>
                  {drillPath.map((p, i) => (
                    <span key={i} className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                      <ChevronDown size={10} className="-rotate-90" /> {p.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
                <button onClick={() => setDimension('DATA_DRILL')} className={`px-5 py-2 rounded-lg text-xs font-black transition-all ${dimension === 'DATA_DRILL' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>BY METRIC</button>
                <button onClick={() => setDimension('BUYER')} className={`px-5 py-2 rounded-lg text-xs font-black transition-all ${dimension === 'BUYER' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>BY BUYER</button>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
                <button onClick={() => setChartType('PIE')} className={`p-2 rounded-lg transition-all ${chartType === 'PIE' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}><PieIcon size={18}/></button>
                <button onClick={() => setChartType('BAR')} className={`p-2 rounded-lg transition-all ${chartType === 'BAR' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}><BarIcon size={18}/></button>
              </div>
            </div>
          </div>

          {/* Main Chart Area */}
          <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm min-h-[550px] flex flex-col">
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={500}>
                {chartType === 'PIE' ? (
                  <PieChart>
                    <Pie 
                      data={chartData} 
                      cx="50%" cy="50%" 
                      innerRadius="65%" outerRadius="90%" 
                      dataKey="value" 
                      onClick={handleDrill}
                      cursor="pointer"
                      stroke="#fff"
                      strokeWidth={4}
                      paddingAngle={2}
                    >
                      {chartData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} className="hover:opacity-80 transition-opacity" />)}
                      <Label 
                        content={({ viewBox }: any) => {
                          const { cx, cy } = viewBox;
                          return (
                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
                              <tspan x={cx} y={cy - 12} className="text-5xl font-black fill-slate-900 tracking-tighter">{totalQuantity.toLocaleString()}</tspan>
                              <tspan x={cx} y={cy + 25} className="text-xs font-black uppercase tracking-[0.2em] fill-slate-300">Total Units Shipped</tspan>
                            </text>
                          );
                        }}
                      />
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={40} iconType="circle" wrapperStyle={{ paddingTop: '20px', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                  </PieChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 90 }}>
                    <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      interval={0}
                      height={100}
                      tick={<CustomXAxisTick />}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#cbd5e1', fontWeight: 'bold' }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Bar 
                      dataKey="value" 
                      radius={[12, 12, 0, 0]} 
                      onClick={handleDrill} 
                      cursor="pointer"
                      barSize={50}
                    >
                      {chartData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} className="hover:brightness-95 transition-all" />)}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Color Analysis */}
          <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-slate-900 rounded-lg text-white">
                <Palette size={20} />
              </div>
              <h3 className="font-black text-xl text-slate-900 tracking-tight">Finishing Distribution</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
               {colorData.map(c => (
                 <div key={c.name} className="flex flex-col items-center p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-white hover:shadow-xl transition-all group">
                    <div className="w-12 h-12 rounded-full mb-4 shadow-xl ring-4 ring-white transition-transform group-hover:scale-110" style={{ backgroundColor: COLOR_MAP[c.name] || '#e2e8f0' }} />
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">{c.name}</span>
                    <span className="text-2xl font-black text-slate-900">{c.value.toLocaleString()}</span>
                 </div>
               ))}
            </div>
          </div>
        </div>

        {/* Sidebar Analytics */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col h-full max-h-[700px]">
            <h3 className="font-black text-xl text-slate-900 mb-6 flex items-center gap-3">
              <ClipboardList size={22} className="text-intenza-600" /> Trace Records
            </h3>
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Serial, PI or Buyer..." 
                value={traceSearchQuery}
                onChange={(e) => setTraceSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl text-sm font-bold focus:border-slate-900 focus:bg-white outline-none transition-all shadow-inner"
              />
            </div>
            
            <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
              {traceSearchQuery && traceResults.length === 0 && (
                <div className="text-center py-10">
                   <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Search size={24} className="opacity-10" />
                   </div>
                   <p className="text-xs font-bold text-slate-300 italic uppercase">No matches found</p>
                </div>
              )}
              {traceResults.map(r => (
                <div key={r.id} className="p-4 bg-white border-2 border-slate-50 rounded-2xl hover:border-slate-200 transition-all cursor-default">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-1 rounded-md tracking-wider">SN: {r.sn}</span>
                    <span className="text-[9px] text-slate-400 font-black font-mono">{r.shipDate}</span>
                  </div>
                  <div className="space-y-3">
                    <div className="text-xs font-black text-slate-800 line-clamp-1 uppercase">{r.description}</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] text-slate-500 border-t border-slate-50 pt-3">
                      <div><span className="text-slate-300 font-black uppercase block text-[8px] mb-0.5">Buyer</span> <span className="font-bold text-slate-700">{r.buyer}</span></div>
                      <div><span className="text-slate-300 font-black uppercase block text-[8px] mb-0.5">Deliv</span> <span className="font-bold text-slate-700">{r.deliveryNo}</span></div>
                      <div><span className="text-slate-300 font-black uppercase block text-[8px] mb-0.5">SKU</span> <span className="font-bold text-slate-700 font-mono">{r.sku}</span></div>
                      <div><span className="text-slate-300 font-black uppercase block text-[8px] mb-0.5">Ver</span> <span className="font-bold text-slate-700">v{r.version}</span></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {showAiInsights && (
            <GeminiInsight 
              context={`Inventory Analysis. Level: ${currentLevel}. Focus: Shipment Trends and Buyer Distribution. Level path: ${drillPath.map(p=>p.label).join(' > ')}`} 
              data={chartData} 
            />
          )}

          <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] shadow-2xl shadow-slate-900/30 relative overflow-hidden group">
             <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl transition-transform group-hover:scale-150"></div>
             <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6">Inventory Summary</h4>
             <div className="space-y-6">
               <div>
                  <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">Global Shipment</div>
                  <div className="text-5xl font-black tracking-tighter">{shipments.reduce((acc,s)=>acc+s.quantity, 0).toLocaleString()}</div>
               </div>
               <div className="flex justify-between items-center pt-6 border-t border-white/10">
                  <div className="flex items-center gap-3">
                     <div className="p-1.5 bg-white/10 rounded-lg"><Box size={16} className="text-intenza-500" /></div>
                     <span className="text-xs font-bold uppercase tracking-wider">Unique SKUs</span>
                  </div>
                  <span className="text-base font-black font-mono">{new Set(shipments.map(s=>s.sku)).size}</span>
               </div>
               <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                     <div className="p-1.5 bg-white/10 rounded-lg"><User size={16} className="text-blue-400" /></div>
                     <span className="text-xs font-bold uppercase tracking-wider">Key Accounts</span>
                  </div>
                  <span className="text-base font-black font-mono">{new Set(shipments.map(s=>s.buyer)).size}</span>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;