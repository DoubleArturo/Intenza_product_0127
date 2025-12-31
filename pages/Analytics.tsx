
import React, { useState, useMemo, useRef, useContext } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { ArrowLeft, PieChart as PieIcon, BarChart as BarIcon, Search, FileSpreadsheet, Users, Truck, Activity, AlertTriangle, ChevronDown, Filter, LayoutGrid, Image as ImageIcon, Loader2, ClipboardList, Info } from 'lucide-react';
import { ShipmentData, ChartViewType, DrillLevel, ProductModel, TestStatus, ErgoProjectCategory, Tester } from '../types';
import GeminiInsight from '../components/GeminiInsight';
import * as XLSX from 'xlsx';
import { LanguageContext } from '../App';

const COLORS = ['#0f172a', '#e3261b', '#94a3b8', '#fbbf24', '#f63e32', '#475569', '#3b82f6', '#10b981', '#8b5cf6'];

interface AnalyticsProps {
  products: ProductModel[];
  shipments: ShipmentData[];
  testers?: Tester[];
  onImportData: (data: ShipmentData[]) => void;
  onBatchAddProducts: (products: any[]) => void;
  showAiInsights: boolean;
  searchDisplayFields: Record<string, boolean>;
}

type MainView = 'SHIPMENT' | 'ERGO' | 'PRODUCT_TEST';
type DisplayMode = 'NAME' | 'SKU';
type ViewDimension = 'PRODUCT' | 'CUSTOMER';

const Analytics: React.FC<AnalyticsProps> = ({ products, shipments, testers = [], onImportData, onBatchAddProducts, showAiInsights, searchDisplayFields }) => {
  const { language, t } = useContext(LanguageContext);
  
  const [activeView, setActiveView] = useState<MainView>('SHIPMENT');
  const [chartType, setChartType] = useState<ChartViewType>('PIE');
  const [viewDimension, setViewDimension] = useState<ViewDimension>('PRODUCT');
  const [drillPath, setDrillPath] = useState<{ level: DrillLevel, label: string, filterVal: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('NAME');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedErgoProductId, setSelectedErgoProductId] = useState<string>('ALL');
  const [selectedLabSeries, setSelectedLabSeries] = useState<string>('ALL');

  // --- S/N 貨蹤查詢邏輯 ---
  const lookupResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 3) return [];
    const lowerQuery = searchQuery.toLowerCase();
    return shipments.filter(s => 
      s.sn.toLowerCase().includes(lowerQuery) || 
      s.pn.toLowerCase().includes(lowerQuery) || 
      s.deliveryNo.toLowerCase().includes(lowerQuery)
    );
  }, [searchQuery, shipments]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error("File is empty");
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws, { raw: false }) as any[];
        
        const productsToCreate: ProductModel[] = [];
        const seenSkus = new Set(products.map(p => p.sku)); 
        const newSkuMap = new Map<string, string>(); 

        jsonData.forEach((row: any) => {
            // 匹配照片欄位: "Sku"
            const sku = (row['Sku'] || row['SKU'] || '').toString().trim();
            if (!sku || seenSkus.has(sku) || newSkuMap.has(sku)) return;

            const newId = `p-imported-${sku.replace(/[^a-zA-Z0-9]/g, '-')}`;
            newSkuMap.set(sku, newId);

            // 匹配照片欄位: "Series"
            const rawSeries = (row['Series'] || 'General').toString();
            let mappedSeries = { en: `${rawSeries} Series`, zh: `${rawSeries} 系列` };

            // 匹配照片欄位: "Description"
            const rawDesc = (row['Description'] || 'Unknown Model').toString();
            const modelName = rawDesc.replace(/\(Brown\)|\(Black\)/gi, '').trim();

            productsToCreate.push({
                id: newId, sku, series: mappedSeries,
                modelName: { en: modelName, zh: modelName },
                description: { en: rawDesc, zh: rawDesc },
                currentVersion: row['Version'] ? `v${row['Version']}` : 'v1.0',
                imageUrl: '', designHistory: [], ergoProjects: [], customerFeedback: [],
                ergoTests: [], durabilityTests: [], uniqueFeedbackTags: {}, isWatched: false,
                customSortOrder: products.length + productsToCreate.length
            });
        });

        if (productsToCreate.length > 0) onBatchAddProducts(productsToCreate);

        const newShipments: ShipmentData[] = jsonData.map((row: any, index: number) => {
            const sku = (row['Sku'] || row['SKU'] || '').toString().trim();
            const matchedModelId = products.find(p => p.sku === sku)?.id || newSkuMap.get(sku) || 'unknown';

            // Fix: Added country mapping from Excel row
            return {
                id: `s-${Date.now()}-${index}`,
                modelId: matchedModelId,
                shipDate: (row['Shipped date'] || '').toString(),
                buyer: (row['Buyer'] || '').toString(),
                country: (row['Country'] || '').toString(),
                deliveryNo: (row['Delivery No.'] || '').toString(),
                itemNo: (row['Item'] || '').toString(),
                pi: (row['P/I'] || '').toString(),
                pn: (row['P/N'] || '').toString(),
                variant: (row['Description'] || '').toString(),
                sku: sku,
                quantity: Number(row['QTY'] || 0),
                sn: (row['S/N'] || '').toString(),
                version: (row['Version'] || '').toString(),
                category: (row['Category'] || '').toString(),
                series: (row['Series'] || '').toString()
            };
        });

        if (newShipments.length > 0) {
            onImportData(newShipments);
            alert(`成功！匯入了 ${newShipments.length} 筆出貨記錄。`);
        }
      } catch (error) { 
          alert('解析錯誤'); 
      } finally { 
          setIsUploading(false); 
          if(fileInputRef.current) fileInputRef.current.value = ''; 
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const chartData = useMemo(() => {
    const aggregated: Record<string, number> = {};
    shipments.forEach(item => {
      let key = viewDimension === 'PRODUCT' ? item.sku : item.buyer;
      aggregated[key] = (aggregated[key] || 0) + item.quantity;
    });
    return Object.keys(aggregated).map(key => ({ name: key, value: aggregated[key] })).sort((a, b) => b.value - a.value);
  }, [shipments, viewDimension]);

  return (
    <div className="w-full p-8 min-h-screen">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-3xl font-bold text-slate-900">{t({ en: 'Global Logistics Dashboard', zh: '全球物流數據儀表板' })}</h1>
           <p className="text-slate-500 mt-1">{t({ en: 'Visualizing shipments based on uploaded data structure.', zh: '基於上傳資料結構的自動化視覺化分析。' })}</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm">
                {isUploading ? <Loader2 className="animate-spin" size={18} /> : <FileSpreadsheet size={18} className="text-green-600" />}
                上傳 Shipping Data (Excel)
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
           <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm h-[500px] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                 <div className="flex bg-slate-100 rounded-lg p-1">
                    <button onClick={() => setViewDimension('PRODUCT')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewDimension === 'PRODUCT' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}>依型號 (SKU)</button>
                    <button onClick={() => setViewDimension('CUSTOMER')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewDimension === 'CUSTOMER' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}>依客戶 (Buyer)</button>
                 </div>
                 <div className="flex gap-2">
                    <button onClick={() => setChartType('PIE')} className={`p-2 rounded-lg ${chartType === 'PIE' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}><PieIcon size={18} /></button>
                    <button onClick={() => setChartType('BAR')} className={`p-2 rounded-lg ${chartType === 'BAR' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}><BarIcon size={18} /></button>
                 </div>
              </div>
              <div className="flex-1">
                 <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'PIE' ? (
                       <PieChart>
                          <Pie data={chartData} dataKey="value" cx="50%" cy="50%" innerRadius="60%" outerRadius="80%" paddingAngle={5}>
                             {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                          <Legend />
                       </PieChart>
                    ) : (
                       <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                          <YAxis axisLine={false} tickLine={false} />
                          <Tooltip />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                             {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Bar>
                       </BarChart>
                    )}
                 </ResponsiveContainer>
              </div>
           </div>
        </div>

        <div className="space-y-6">
           {/* S/N 貨蹤追溯系統 */}
           <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Search size={18} className="text-intenza-600"/> S/N 貨蹤追溯系統</h3>
              <div className="relative mb-4">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input 
                   type="text" 
                   placeholder="搜尋 S/N, P/N 或 送貨單號..." 
                   className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-intenza-500/20 outline-none"
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                 />
              </div>

              <div className="max-h-[400px] overflow-y-auto space-y-4 custom-scrollbar pr-2">
                 {searchQuery && lookupResults.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-xs italic">未找到匹配的物流記錄。</div>
                 )}
                 {lookupResults.map((res) => (
                    <div key={res.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-intenza-200 transition-colors">
                       <div className="flex justify-between items-start mb-3">
                          <span className="text-xs font-bold text-intenza-600 bg-intenza-50 px-2 py-1 rounded">S/N: {res.sn}</span>
                          <span className="text-[10px] text-slate-400 font-mono">Ver: {res.version}</span>
                       </div>
                       
                       <div className="space-y-2">
                          {searchDisplayFields.variant && <div className="text-sm font-bold text-slate-800">{res.variant}</div>}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
                             {searchDisplayFields.shipDate && <div><label className="text-[9px] font-bold text-slate-400 uppercase">出貨日期</label><div className="text-[11px] text-slate-600">{res.shipDate}</div></div>}
                             {searchDisplayFields.buyer && <div><label className="text-[9px] font-bold text-slate-400 uppercase">客戶名稱</label><div className="text-[11px] text-slate-600">{res.buyer}</div></div>}
                             {searchDisplayFields.deliveryNo && <div><label className="text-[9px] font-bold text-slate-400 uppercase">送貨單號</label><div className="text-[11px] text-slate-600 font-mono">{res.deliveryNo}</div></div>}
                             {searchDisplayFields.pn && <div><label className="text-[9px] font-bold text-slate-400 uppercase">P/N (料號)</label><div className="text-[11px] text-slate-600 font-mono">{res.pn}</div></div>}
                             {searchDisplayFields.pi && <div><label className="text-[9px] font-bold text-slate-400 uppercase">P/I</label><div className="text-[11px] text-slate-600 font-mono">{res.pi}</div></div>}
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
           {showAiInsights && <GeminiInsight context="Logistics data analysis" data={chartData} />}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
