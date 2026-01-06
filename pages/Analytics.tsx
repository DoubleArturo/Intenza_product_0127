import React, { useState, useMemo, useRef, useContext, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Label
} from 'recharts';
import { 
  ArrowLeft, PieChart as PieIcon, BarChart as BarIcon, Search, FileSpreadsheet, 
  Palette, Box, Activity, ChevronDown, 
  Image as ImageIcon, ClipboardList, User, ShieldCheck, Zap, ArrowRight,
  CheckCircle, AlertCircle, Clock, Info
} from 'lucide-react';
import { ShipmentData, ChartViewType, ProductModel, Tester, TestStatus } from '../types';
import GeminiInsight from '../components/GeminiInsight';
import * as XLSX from 'xlsx';
import { LanguageContext } from '../App';
import { useNavigate, useLocation } from 'react-router-dom';

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
  userRole?: 'admin' | 'user' | 'uploader';
}

type DimensionFilter = 'DATA_DRILL' | 'BUYER' | 'COLOR';
type ViewMode = 'SHIPMENTS' | 'ERGONOMICS' | 'DURABILITY';

const Analytics: React.FC<AnalyticsProps> = ({ products, shipments, onImportData, onBatchAddProducts, showAiInsights, userRole }) => {
  const { language, t } = useContext(LanguageContext);
  const navigate = useNavigate();
  const location = useLocation();
  
  const [chartType, setChartType] = useState<ChartViewType>('PIE');
  const [viewMode, setViewMode] = useState<ViewMode>('SHIPMENTS');
  const [drillPath, setDrillPath] = useState<{ level: string, label: string, filterVal: string }[]>([]);
  const [dimension, setDimension] = useState<DimensionFilter>('DATA_DRILL');
  const [traceSearchQuery, setTraceSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canImport = userRole === 'admin' || userRole === 'uploader';

  /**
   * Helper to format version string
   */
  const formatVersion = (v: string) => {
    const clean = (v || '1.0').toUpperCase().replace('V', '');
    return `V${clean}`;
  };

  /**
   * Handle incoming autoDrill state from Product Detail
   */
  useEffect(() => {
    if (location.state?.autoDrill) {
      const { sku, version } = location.state.autoDrill;
      const shipment = shipments.find(s => s.sku === sku);
      if (shipment) {
        setViewMode('SHIPMENTS');
        setDimension('DATA_DRILL');
        setDrillPath([
            { level: 'CATEGORY', label: shipment.category, filterVal: shipment.category },
            { level: 'SERIES', label: shipment.series, filterVal: shipment.series },
            { level: 'SKU', label: sku, filterVal: sku }
        ]);
        // Note: The filteredShipments logic below will handle the version filtering 
        // if an autoDrill is active to show only that version's customers.
      }
      // Clear location state after handling to prevent loops or persistent filters
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, shipments, navigate, location.pathname]);

  /**
   * Enhanced Drill-Down Logic
   */
  const currentLevel = useMemo(() => {
    const depth = drillPath.length;
    
    if (dimension === 'BUYER') {
      switch (depth) {
        case 0: return 'BUYER';
        case 1: return 'SERIES';
        case 2: return 'SKU';
        case 3: return 'VERSION';
        default: return 'VERSION';
      }
    }

    if (dimension === 'COLOR') {
      switch (depth) {
        case 0: return 'COLOR';
        case 1: return 'SERIES';
        case 2: return 'SKU';
        case 3: return 'VERSION';
        default: return 'VERSION';
      }
    }
    
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

  // Derive filtered products based on the selection path
  const filteredProducts = useMemo(() => {
    const visibleSkus = new Set(filteredShipments.map(s => s.sku));
    if (drillPath.length === 0) return products;
    return products.filter(p => visibleSkus.has(p.sku));
  }, [products, filteredShipments, drillPath]);

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

  const totalQuantity = useMemo(() => chartData.reduce((acc, curr) => acc + curr.value, 0), [chartData]);

  const handleDrill = (entry: any) => {
    if (currentLevel === 'VERSION') return;
    setDrillPath([...drillPath, { level: currentLevel, label: entry.name, filterVal: entry.name }]);
  };

  const handleBack = () => {
    setDrillPath(drillPath.slice(0, -1));
  };

  const handleResetDrill = (dim: DimensionFilter) => {
    setDimension(dim);
    setDrillPath([]);
    setViewMode('SHIPMENTS');
  };

  const colorData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredShipments.forEach(s => {
      const color = getEntryColor(s.description);
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
      s.pn?.toLowerCase().includes(q) ||
      s.buyer?.toLowerCase().includes(q)
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
          series: row['Series'] || 'General',
          country: row['Country'] || row['Region'] || 'Global'
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
          <p className="font-black text-slate-900 text-sm mb-1 uppercase tracking-tight">{data.name}</p>
          {data.fullName && <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase">{data.fullName}</p>}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qty Count</span>
            <span className="text-intenza-600 font-black text-base">{data.value.toLocaleString()}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomXAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const dataItem = chartData.find(d => d.name === payload.value);
    const showImage = currentLevel === 'SKU' || currentLevel === 'VERSION';
    
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
          {payload.value.length > 15 ? payload.value.substring(0, 12) + '...' : payload.value}
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

  // Custom Segment Label for Pie Chart with Images
  const renderCustomizedPieLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, name, imageUrl } = props;
    const showImage = (currentLevel === 'SKU' || currentLevel === 'VERSION') && imageUrl;
    
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + (showImage ? 40 : 25);
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const textAnchor = x > cx ? 'start' : 'end';

    return (
      <g>
        <text 
          x={x} 
          y={showImage ? y - 12 : y} 
          fill="#0f172a" 
          textAnchor={textAnchor} 
          dominantBaseline="central" 
          fontSize={9} 
          fontWeight="900" 
          className="uppercase tracking-tighter"
        >
          {name.length > 12 ? name.substring(0, 10) + '..' : name}
        </text>
        {showImage && (
          <g transform={`translate(${textAnchor === 'start' ? x : x - 30}, ${y - 5})`}>
            <defs>
              <clipPath id={`pie-clip-${name}`}>
                <rect width="30" height="30" rx="8" ry="8" />
              </clipPath>
            </defs>
            <rect width="30" height="30" rx="8" ry="8" fill="#fff" stroke="#f1f5f9" strokeWidth="1" className="shadow-sm" />
            <image
              width="26"
              height="26"
              x="2"
              y="2"
              href={imageUrl}
              preserveAspectRatio="xMidYMid meet"
              clipPath={`url(#pie-clip-${name})`}
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
          <p className="text-slate-500 mt-2 font-medium">Quality metrics and shipment analytics at a glance.</p>
        </div>
        {canImport && (
          <div className="flex gap-3">
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-white border-2 border-slate-100 text-slate-700 px-6 py-3 rounded-2xl font-black text-sm shadow-sm hover:border-slate-900 transition-all active:scale-95">
              <FileSpreadsheet size={20} className="text-emerald-500" /> Import Data
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          {/* Controls & Breadcrumbs */}
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
                  {drillPath.map((p, i) => (
                    <span key={i} className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                      <ChevronDown size={10} className="-rotate-90" /> {p.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Main View Mode Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner mr-4">
                <button 
                  onClick={() => setViewMode('SHIPMENTS')} 
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${viewMode === 'SHIPMENTS' ? 'bg-white shadow-md text-intenza-600' : 'text-slate-400'}`}
                >
                  <BarIcon size={14}/> SHIPMENTS
                </button>
                <button 
                  onClick={() => setViewMode('ERGONOMICS')} 
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${viewMode === 'ERGONOMICS' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400'}`}
                >
                  <ShieldCheck size={14}/> ERGO
                </button>
                <button 
                  onClick={() => setViewMode('DURABILITY')} 
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${viewMode === 'DURABILITY' ? 'bg-white shadow-md text-emerald-600' : 'text-slate-400'}`}
                >
                  <Zap size={14}/> DURABILITY
                </button>
              </div>

              {viewMode === 'SHIPMENTS' && (
                <>
                  <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
                    <button onClick={() => handleResetDrill('DATA_DRILL')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${dimension === 'DATA_DRILL' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>BY METRIC</button>
                    <button onClick={() => handleResetDrill('BUYER')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${dimension === 'BUYER' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>BY BUYER</button>
                    <button onClick={() => handleResetDrill('COLOR')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${dimension === 'COLOR' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>BY COLOR</button>
                  </div>
                  <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
                    <button onClick={() => setChartType('PIE')} className={`p-2 rounded-lg transition-all ${chartType === 'PIE' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}><PieIcon size={18}/></button>
                    <button onClick={() => setChartType('BAR')} className={`p-2 rounded-lg transition-all ${chartType === 'BAR' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}><BarIcon size={18}/></button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm min-h-[550px] flex flex-col relative overflow-hidden">
            
            {viewMode === 'SHIPMENTS' && (
              <>
                <div className="absolute top-10 right-10 flex flex-col items-end">
                   <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Active Metric</span>
                   <span className="text-xs font-black text-intenza-600 uppercase tracking-tight">Units Shipped</span>
                </div>
                
                <div className="flex-1 mt-6 animate-fade-in">
                  <ResponsiveContainer width="100%" height={500}>
                    {chartType === 'PIE' ? (
                      <PieChart margin={{ top: 40, bottom: 40, left: 40, right: 40 }}>
                        <Pie 
                          data={chartData} 
                          cx="50%" cy="50%" 
                          innerRadius="55%" outerRadius="75%" 
                          dataKey="value" 
                          onClick={handleDrill}
                          cursor="pointer"
                          stroke="#fff"
                          strokeWidth={4}
                          paddingAngle={2}
                          label={renderCustomizedPieLabel}
                          labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                        >
                          {chartData.map((entry, i) => (
                            <Cell 
                              key={`cell-${i}`} 
                              fill={currentLevel === 'COLOR' ? (COLOR_MAP[entry.name] || COLORS[i % COLORS.length]) : COLORS[i % COLORS.length]} 
                              className="hover:opacity-80 transition-opacity" 
                            />
                          ))}
                          <Label 
                            content={({ viewBox }: any) => {
                              const { cx, cy } = viewBox;
                              return (
                                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
                                  <tspan x={cx} y={cy - 12} className="text-4xl font-black fill-slate-900 tracking-tighter">{totalQuantity.toLocaleString()}</tspan>
                                  <tspan x={cx} y={cy + 25} className="text-[10px] font-black uppercase tracking-[0.2em] fill-slate-300">Total Units</tspan>
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
                          {chartData.map((entry, i) => (
                            <Cell 
                              key={`cell-${i}`} 
                              fill={currentLevel === 'COLOR' ? (COLOR_MAP[entry.name] || COLORS[i % COLORS.length]) : COLORS[i % COLORS.length]} 
                              className="hover:brightness-95 transition-all" 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {viewMode === 'ERGONOMICS' && (
              <div className="flex-1 animate-fade-in">
                <div className="mb-10 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Human Factors Verification Progress</h3>
                    <p className="text-sm text-slate-400 font-medium">Tracking PASS/NG ratios and decision statuses for active projects.</p>
                  </div>
                  <ShieldCheck className="text-indigo-600 opacity-20" size={48} />
                </div>
                
                <div className="space-y-4">
                  {filteredProducts.map(p => {
                    const totalTasks = (p.ergoProjects || []).reduce((acc: number, proj) => {
                      const taskLists = Object.values(proj.tasks || {}) as any[][];
                      return acc + taskLists.reduce((taskAcc: number, taskList) => taskAcc + taskList.length, 0);
                    }, 0);
                    
                    const passedTasks = (p.ergoProjects || []).reduce((acc: number, proj) => {
                      const taskLists = Object.values(proj.tasks || {}) as any[][];
                      return acc + taskLists.reduce((taskAcc: number, taskList) => {
                        return taskAcc + taskList.filter(t => t.ngReasons.length === 0 && t.passTesterIds.length > 0).length;
                      }, 0);
                    }, 0);

                    const progress = totalTasks > 0 ? (passedTasks / totalTasks) * 100 : 0;

                    return (
                      <div key={p.id} onClick={() => navigate(`/product/${p.id}`, { state: { activeTab: 'ERGO' }})} className="group p-6 bg-slate-50 hover:bg-white border-2 border-transparent hover:border-indigo-100 rounded-3xl transition-all cursor-pointer flex items-center gap-6">
                        <div className="w-16 h-16 bg-white rounded-2xl border border-slate-100 overflow-hidden flex-shrink-0">
                          {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-contain p-1" /> : <div className="w-full h-full flex items-center justify-center text-slate-200"><ImageIcon size={20}/></div>}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-black text-slate-800 uppercase text-sm tracking-tight">{t(p.modelName)}</h4>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.sku}</span>
                            </div>
                            <div className="flex items-center gap-4">
                               <div className="text-right">
                                  <div className="text-[10px] font-black text-slate-300 uppercase">Verification Rate</div>
                                  <div className="text-sm font-black text-indigo-600">{Math.round(progress)}%</div>
                               </div>
                               <ArrowRight size={16} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                            <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                          </div>
                        </div>
                        <div className="w-32 grid grid-cols-2 gap-2 text-center">
                          <div className="bg-white rounded-xl p-2 border border-slate-100">
                             <div className="text-[9px] font-black text-emerald-500 uppercase">Pass</div>
                             <div className="text-base font-black text-slate-900">{passedTasks}</div>
                          </div>
                          <div className="bg-white rounded-xl p-2 border border-slate-100">
                             <div className="text-[9px] font-black text-rose-500 uppercase">NG</div>
                             <div className="text-base font-black text-slate-900">{totalTasks - passedTasks}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredProducts.length === 0 && <div className="py-20 text-center text-slate-300 font-bold uppercase tracking-widest">No evaluation projects found</div>}
                </div>
              </div>
            )}

            {viewMode === 'DURABILITY' && (
              <div className="flex-1 animate-fade-in">
                <div className="mb-10 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Mechanical Durability Tracking</h3>
                    <p className="text-sm text-slate-400 font-medium">Monitoring completion rates and structural test cycles grouped by product.</p>
                  </div>
                  <Zap className="text-emerald-500 opacity-20" size={48} />
                </div>
                
                <div className="space-y-12">
                   {filteredProducts.filter(p => (p.durabilityTests || []).length > 0).map(p => (
                      <div key={p.id} className="space-y-6">
                        <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                           <div className="w-16 h-16 bg-white rounded-2xl border border-slate-100 overflow-hidden flex-shrink-0 shadow-sm">
                              {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-contain p-1" /> : <div className="w-full h-full flex items-center justify-center text-slate-200 bg-slate-50"><ImageIcon size={20}/></div>}
                           </div>
                           <div>
                              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{t(p.modelName)}</h4>
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{p.sku}</span>
                           </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                           {/* SORTED BY UPDATED DATE (NEWEST FIRST) */}
                           {[...(p.durabilityTests || [])]
                             .sort((a, b) => new Date(b.updatedDate || 0).getTime() - new Date(a.updatedDate || 0).getTime())
                             .map((test, idx) => (
                              <div key={idx} onClick={() => navigate(`/product/${p.id}`, { state: { activeTab: 'LIFE' }})} className="group bg-slate-50 hover:bg-white p-4 rounded-2xl border-2 border-transparent hover:border-emerald-100 transition-all cursor-pointer shadow-sm">
                                 <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1 min-w-0">
                                       <div className="flex items-center gap-1.5 mb-1">
                                          <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 whitespace-nowrap">{test.category}</span>
                                          {test.version && <span className="text-[8px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 whitespace-nowrap">{test.version}</span>}
                                       </div>
                                       <h4 className="font-black text-slate-800 uppercase text-[11px] tracking-tight truncate" title={t(test.testName)}>{t(test.testName)}</h4>
                                    </div>
                                    {/* MINIMIZED NG/FAIL STATUS */}
                                    <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border transition-colors ${
                                      test.status === TestStatus.PASS ? 'bg-emerald-500 text-white border-emerald-400' :
                                      test.status === TestStatus.FAIL ? 'bg-white text-rose-500 border-rose-200 shadow-sm' : // MINIMIZED NG: White bg, rose text
                                      'bg-slate-100 text-slate-500 border-slate-200'
                                    }`}>{test.status}</div>
                                 </div>
                                 
                                 <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Progress</span>
                                    <span className="text-[11px] font-black text-slate-900">{test.score}%</span>
                                 </div>
                                 <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner mb-3">
                                    <div className={`h-full transition-all duration-1000 ${test.status === TestStatus.PASS ? 'bg-emerald-500' : test.status === TestStatus.FAIL ? 'bg-rose-400' : 'bg-blue-400'}`} style={{ width: `${test.score}%` }}></div>
                                 </div>
                                 <div className="flex items-center justify-between text-[8px] font-bold text-slate-300 uppercase tracking-widest border-t border-slate-100 pt-2">
                                    <div className="flex items-center gap-1"><Clock size={9}/> {test.updatedDate}</div>
                                    <ArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                                 </div>
                              </div>
                           ))}
                        </div>
                      </div>
                   ))}
                   {filteredProducts.every(p => (p.durabilityTests || []).length === 0) && (
                     <div className="py-20 text-center text-slate-300 font-bold uppercase tracking-widest">No durability tests found</div>
                   )}
                </div>
              </div>
            )}
          </div>

          {viewMode === 'SHIPMENTS' && (
            <div className="grid grid-cols-1 gap-8 animate-fade-in">
              {/* Color Analysis Section */}
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-slate-900 rounded-lg text-white">
                    <Palette size={20} />
                  </div>
                  <h3 className="font-black text-xl text-slate-900 tracking-tight">Finishing Distribution</h3>
                </div>
                <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={colorData}
                          innerRadius={50}
                          outerRadius={85}
                          dataKey="value"
                          paddingAngle={5}
                        >
                          {colorData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLOR_MAP[entry.name] || COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 self-center">
                    {colorData.map(c => (
                      <div key={c.name} className="flex flex-col items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white transition-all group">
                          <div className="w-10 h-10 rounded-full mb-2 shadow-sm border border-slate-200" style={{ backgroundColor: COLOR_MAP[c.name] || '#e2e8f0' }} />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{c.name}</span>
                          <span className="text-xl font-black text-slate-900">{c.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
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
              {traceResults.map(r => (
                <div key={r.id} className="p-4 bg-white border-2 border-slate-50 rounded-2xl hover:border-slate-200 transition-all cursor-default">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-1 rounded-md tracking-wider">SN: {r.sn}</span>
                    <span className="text-[9px] text-slate-400 font-black font-mono">{r.shipDate}</span>
                  </div>
                  <div className="space-y-3">
                    <div className="text-xs font-black text-slate-800 line-clamp-1 uppercase">{r.description}</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] text-slate-500 border-t border-slate-50 pt-3">
                      <div><span className="text-slate-300 font-black uppercase block text-[8px] mb-0.5">Buyer</span> <span className="font-bold text-slate-700 truncate block">{r.buyer}</span></div>
                      <div><span className="text-slate-300 font-black uppercase block text-[8px] mb-0.5">Country</span> <span className="font-bold text-slate-700 truncate block">{r.country || 'N/A'}</span></div>
                      <div><span className="text-slate-300 font-black uppercase block text-[8px] mb-0.5">SKU</span> <span className="font-bold text-slate-700 font-mono">{r.sku}</span></div>
                      <div><span className="text-slate-300 font-black uppercase block text-[8px] mb-0.5">Ver</span> <span className="font-bold text-slate-700">{formatVersion(r.version)}</span></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {showAiInsights && (
            <GeminiInsight 
              context={`Quality Analytics Review. Active View: ${viewMode}. Filtered Products: ${filteredProducts.length}. Drill Path: ${drillPath.map(p=>`${p.level}:${p.label}`).join(', ')}.`} 
              data={{ shipments: filteredShipments, products: filteredProducts }} 
            />
          )}

          <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] shadow-2xl shadow-slate-900/30 relative overflow-hidden group">
             <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl transition-transform group-hover:scale-150"></div>
             <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6">Live Status</h4>
             <div className="space-y-6">
               <div>
                  <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">Active Total</div>
                  <div className="text-5xl font-black tracking-tighter">{totalQuantity.toLocaleString()}</div>
               </div>
               <div className="flex justify-between items-center pt-6 border-t border-white/10">
                  <div className="flex items-center gap-3">
                     <div className="p-1.5 bg-white/10 rounded-lg"><Box size={16} className="text-intenza-500" /></div>
                     <span className="text-xs font-bold uppercase tracking-wider">SKUs in View</span>
                  </div>
                  <span className="text-base font-black font-mono">{new Set(filteredShipments.map(s=>s.sku)).size}</span>
               </div>
               <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                     <div className="p-1.5 bg-white/10 rounded-lg"><User size={16} className="text-blue-400" /></div>
                     <span className="text-xs font-bold uppercase tracking-wider">Buyers in View</span>
                  </div>
                  <span className="text-base font-black font-mono">{new Set(filteredShipments.map(s=>s.buyer)).size}</span>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;