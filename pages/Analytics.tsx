
import React, { useState, useMemo, useRef, useContext } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line 
} from 'recharts';
// Added missing Loader2 import to the lucide-react list
import { ArrowLeft, PieChart as PieIcon, BarChart as BarIcon, Search, FileSpreadsheet, Layers, Palette, Tag, Globe, Users, Box, Truck, Activity, BrainCircuit, AlertTriangle, CheckCircle, Clock, ChevronDown, Filter, LayoutGrid, Image as ImageIcon, Loader2 } from 'lucide-react';
import { ShipmentData, ChartViewType, DrillLevel, ProductModel, LocalizedString, TestStatus, ErgoProjectCategory, NgDecisionStatus, Tester } from '../types';
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
}

type MainView = 'SHIPMENT' | 'ERGO' | 'PRODUCT_TEST';
type DisplayMode = 'NAME' | 'SKU' | 'COLOR_SPLIT';
type ViewDimension = 'PRODUCT' | 'CUSTOMER' | 'COUNTRY';
type ErgoChartMode = 'BAR' | 'PIE';
type ErgoBreakdown = 'OVERVIEW' | 'GENDER' | 'HEIGHT';

const Analytics: React.FC<AnalyticsProps> = ({ products, shipments, testers = [], onImportData, onBatchAddProducts, showAiInsights }) => {
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
  const [ergoChartMode, setErgoChartMode] = useState<ErgoChartMode>('BAR');
  const [ergoBreakdown, setErgoBreakdown] = useState<ErgoBreakdown>('OVERVIEW');
  const [selectedLabSeries, setSelectedLabSeries] = useState<string>('ALL');

  // --- 數據安全計算: 人因工程 ---
  const ergoAggregates = useMemo(() => {
    try {
      let targetProducts = products || [];
      if (selectedErgoProductId !== 'ALL') {
          targetProducts = products.filter(p => p.id === selectedErgoProductId);
      }
      
      let totalProjects = 0;
      let totalTestersUnique = new Set<string>();
      
      const categoryStats: Record<ErgoProjectCategory, any> = {
          'Strength Curve': { totalTasks: 0, passCount: 0, ngCount: 0, genderNg: { Male: 0, Female: 0 }, heightNg: { '<160': 0, '160-170': 0, '170-180': 0, '>180': 0 } },
          'Experience': { totalTasks: 0, passCount: 0, ngCount: 0, genderNg: { Male: 0, Female: 0 }, heightNg: { '<160': 0, '160-170': 0, '170-180': 0, '>180': 0 } },
          'Stroke': { totalTasks: 0, passCount: 0, ngCount: 0, genderNg: { Male: 0, Female: 0 }, heightNg: { '<160': 0, '160-170': 0, '170-180': 0, '>180': 0 } },
          'Other Suggestion': { totalTasks: 0, passCount: 0, ngCount: 0, genderNg: { Male: 0, Female: 0 }, heightNg: { '<160': 0, '160-170': 0, '170-180': 0, '>180': 0 } }
      };

      const ngReasonsMap: Record<string, any> = {};

      targetProducts.forEach(p => {
          const projects = p.ergoProjects || [];
          totalProjects += projects.length;
          projects.forEach(proj => {
              (proj.testerIds || []).forEach(tid => totalTestersUnique.add(tid));
              
              (['Strength Curve', 'Experience', 'Stroke', 'Other Suggestion'] as ErgoProjectCategory[]).forEach(cat => {
                  const tasks = proj.tasks?.[cat] || [];
                  const projectTesterCount = (proj.testerIds || []).length;
                  const totalPossibleChecks = tasks.length * projectTesterCount;

                  if (totalPossibleChecks > 0) {
                      categoryStats[cat].totalTasks += totalPossibleChecks;
                      tasks.forEach(task => {
                          const passCount = (task.passTesterIds || []).length;
                          categoryStats[cat].passCount += passCount;
                          (task.ngReasons || []).forEach(ng => {
                               const reasonText = t(ng.reason) || "Unknown Issue";
                               if (!ngReasonsMap[reasonText]) {
                                   ngReasonsMap[reasonText] = { count: 0, category: cat, products: [] };
                               }
                               ngReasonsMap[reasonText].count += 1;
                               const modelNameText = t(p.modelName);
                               if (!ngReasonsMap[reasonText].products.includes(modelNameText)) {
                                   ngReasonsMap[reasonText].products.push(modelNameText);
                               }
                               categoryStats[cat].ngCount += 1;
                               const tester = (testers || []).find(t => t.id === ng.testerId);
                               if (tester) {
                                   if (tester.gender === 'Male') categoryStats[cat].genderNg.Male++;
                                   else categoryStats[cat].genderNg.Female++;
                                   const h = tester.height;
                                   if (h < 160) categoryStats[cat].heightNg['<160']++;
                                   else if (h < 170) categoryStats[cat].heightNg['160-170']++;
                                   else if (h < 180) categoryStats[cat].heightNg['170-180']++;
                                   else categoryStats[cat].heightNg['>180']++;
                               }
                          });
                      });
                  }
              });
          });
      });

      const chartData = Object.keys(categoryStats).map(cat => {
          const c = cat as ErgoProjectCategory;
          const stats = categoryStats[c];
          const total = stats.totalTasks;
          const pass = stats.passCount;
          const ng = stats.ngCount;
          const passRate = total === 0 ? 0 : Math.round((pass / total) * 100);
          const ngRate = total === 0 ? 0 : 100 - passRate;
          return {
              name: t({ en: c, zh: c === 'Strength Curve' ? '強度曲線' : c === 'Experience' ? '操作體驗' : c === 'Stroke' ? '運動行程' : '其他建議' }),
              passRate, ngRate, passCount: pass, ngCount: ng, totalChecks: total,
              maleNg: stats.genderNg.Male, femaleNg: stats.genderNg.Female,
              h1: stats.heightNg['<160'], h2: stats.heightNg['160-170'], h3: stats.heightNg['170-180'], h4: stats.heightNg['>180'],
          };
      });

      const topNgReasons = Object.entries(ngReasonsMap)
          .map(([reason, data]: [string, any]) => ({ reason, ...data }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

      return { totalProjects, totalTesters: totalTestersUnique.size, chartData, topNgReasons, selectedProduct: selectedErgoProductId === 'ALL' ? null : products.find(p => p.id === selectedErgoProductId) };
    } catch (e) {
      console.error("Ergo aggregation failed", e);
      return { totalProjects: 0, totalTesters: 0, chartData: [], topNgReasons: [], selectedProduct: null };
    }
  }, [products, t, selectedErgoProductId, testers]);

  // --- 數據安全計算: 實驗室測試 ---
  const testAggregates = useMemo(() => {
     try {
       const productsInScope = selectedLabSeries === 'ALL' 
          ? (products || []) 
          : products.filter(p => t(p.series) === selectedLabSeries);

       let totalTests = 0;
       const categoryScores: Record<string, { total: number, count: number }> = {};
       
       const skuStatusData = productsInScope.map(p => {
           const pCounts: any = { [TestStatus.PASS]: 0, [TestStatus.FAIL]: 0, [TestStatus.WARNING]: 0, [TestStatus.ONGOING]: 0, [TestStatus.PENDING]: 0 };
           const pCritical: any[] = [];
           const durabilityTests = p.durabilityTests || [];
           
           durabilityTests.forEach(test => {
               pCounts[test.status] = (pCounts[test.status] || 0) + 1;
               if (test.status === TestStatus.FAIL || test.status === TestStatus.WARNING) {
                   pCritical.push({ testName: t(test.testName), status: test.status, details: t(test.details) });
               }
           });
           
           return { product: p, totalTests: durabilityTests.length, counts: pCounts, criticalTests: pCritical };
       });

       productsInScope.forEach(p => {
           (p.durabilityTests || []).forEach(test => {
               totalTests++;
               let pct = test.score || 0;
               if (test.targetValue && test.currentValue !== undefined && test.targetValue > 0) {
                   pct = (test.currentValue / test.targetValue) * 100;
               }
               pct = Math.min(100, Math.max(0, pct)); 
               if (!categoryScores[test.category]) categoryScores[test.category] = { total: 0, count: 0 };
               categoryScores[test.category].total += pct;
               categoryScores[test.category].count += 1;
           });
       });

       const categoryChartData = Object.entries(categoryScores)
          .map(([cat, data]) => ({ name: cat, avgScore: Math.round(data.total / data.count) }))
          .sort((a, b) => a.avgScore - b.avgScore);

       return { totalTests, skuStatusData, categoryChartData };
     } catch (e) {
       console.error("Test aggregation failed", e);
       return { totalTests: 0, skuStatusData: [], categoryChartData: [] };
     }
  }, [products, t, selectedLabSeries]);

  // --- 檔案上傳解析修正 ---
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
            const sku = (row['Spec.'] || row['SKU'] || '').toString().trim();
            if (!sku || seenSkus.has(sku) || newSkuMap.has(sku)) return;

            const newId = `p-imported-${sku.replace(/[^a-zA-Z0-9]/g, '-')}`;
            newSkuMap.set(sku, newId);

            const rawSeries = (row['Series'] || 'General').toString();
            let mappedSeries: LocalizedString;
            if (rawSeries.includes('DL')) mappedSeries = { en: 'DL Series (Entertainment)', zh: 'DL 系列 (娛樂)' };
            else if (rawSeries.includes('SL')) mappedSeries = { en: 'SL Series (Standard)', zh: 'SL 系列 (標準)' };
            else if (rawSeries.includes('Cardio')) mappedSeries = { en: 'Cardio Series', zh: '有氧系列' };
            else if (rawSeries.includes('Strength')) mappedSeries = { en: 'Strength Series', zh: '力量系列' };
            else mappedSeries = { en: `${rawSeries} Series`, zh: `${rawSeries} 系列` };

            const rawDesc = (row['Description'] || 'Unknown Model').toString();
            const modelName = rawDesc.replace(/\(Brown\)|\(Black\)|\(Brn\)|\(Blk\)|（咖啡色）|（黑色）/gi, '').trim();

            // 重要：建立完整的產品物件，包含所有陣列欄位的初始化
            productsToCreate.push({
                id: newId, 
                sku: sku,
                series: mappedSeries,
                modelName: { en: modelName, zh: modelName },
                description: { en: rawDesc, zh: rawDesc },
                currentVersion: row['Version'] ? row['Version'].toString().startsWith('v') ? row['Version'] : `v${row['Version']}` : 'v1.0',
                imageUrl: '',
                designHistory: [],
                ergoProjects: [],
                customerFeedback: [],
                ergoTests: [],
                durabilityTests: [],
                uniqueFeedbackTags: {},
                isWatched: false,
                customSortOrder: products.length + productsToCreate.length
            });
        });

        if (productsToCreate.length > 0) {
            onBatchAddProducts(productsToCreate);
        }

        const newShipments: ShipmentData[] = jsonData.map((row: any, index: number) => {
            const sku = (row['Spec.'] || row['SKU'] || '').toString().trim();
            const matchedModelId = products.find(p => p.sku === sku)?.id || newSkuMap.get(sku) || 'unknown';

            return {
                id: `s-${Date.now()}-${index}`,
                modelId: matchedModelId,
                version: row['Version'] ? row['Version'].toString().startsWith('v') ? row['Version'] : `v${row['Version']}` : 'v1.0',
                buyer: (row['Buyer'] || 'Unknown').toString(),
                country: 'Global',
                quantity: Number(row['QTY'] || row['Quantity'] || 0),
                shipDate: (row['Shipped date'] || new Date().toISOString().split('T')[0]).toString(),
                variant: (row['Description'] || '').toString(),
                deliveryNo: (row['Delivery No.'] || '').toString(),
                itemNo: (row['Item'] || '').toString(),
                pi: (row['P/I'] || '').toString(),
                pn: (row['P/N'] || '').toString(),
                sn: (row['S/N'] || '').toString(),
                category: (row['Category'] || '').toString()
            };
        });

        if (newShipments.length > 0) {
            onImportData(newShipments);
            alert(`成功！建立了 ${productsToCreate.length} 個新產品並匯入了 ${newShipments.length} 筆出貨記錄。`);
        } else {
            alert('未找到有效的出貨記錄。');
        }

      } catch (error) { 
          console.error(error);
          alert('解析檔案時出錯，請確保檔案格式正確。'); 
      } finally { 
          setIsUploading(false); 
          if(fileInputRef.current) fileInputRef.current.value = ''; 
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const currentLevel = (() => {
    const depth = drillPath.length;
    if (viewDimension === 'PRODUCT') {
        if (depth === 0) return 'SERIES';
        if (depth === 1) return 'MODEL';
        return 'BUYER';
    } else if (viewDimension === 'CUSTOMER') {
        if (depth === 0) return 'CUSTOMER';
        if (depth === 1) return 'MODEL';
        return 'VERSION';
    } else {
        if (depth === 0) return 'COUNTRY';
        if (depth === 1) return 'CUSTOMER';
        return 'MODEL';
    }
  })();

  const handleDimensionChange = (dim: ViewDimension) => {
    setViewDimension(dim);
    setDrillPath([]);
    setDisplayMode('NAME');
  };

  const handleDrill = (entry: any) => {
     if (drillPath.length >= (viewDimension === 'COUNTRY' ? 3 : 2)) return;
     if (displayMode === 'COLOR_SPLIT') return;
     const nextFilterVal = entry.id || entry.name;
     setDrillPath([...drillPath, { level: currentLevel as DrillLevel, label: entry.name, filterVal: nextFilterVal }]);
  };

  const handleBack = () => {
    setDrillPath(drillPath.slice(0, -1));
  };

  const filteredShipments = useMemo(() => {
    let data = [...(shipments || [])];
    drillPath.forEach((step, index) => {
        const filterVal = step.filterVal;
        if (viewDimension === 'PRODUCT') {
            if (index === 0) {
               const modelsInSeries = products.filter(p => t(p.series) === filterVal).map(p => p.id);
               data = data.filter(s => modelsInSeries.includes(s.modelId));
            } else if (index === 1) { data = data.filter(s => s.modelId === filterVal); }
        } else if (viewDimension === 'CUSTOMER') {
            if (index === 0) { data = data.filter(s => s.buyer === filterVal); }
            else if (index === 1) { data = data.filter(s => s.modelId === filterVal); }
        } else if (viewDimension === 'COUNTRY') {
            if (index === 0) { data = data.filter(s => s.country === filterVal); }
            else if (index === 1) { data = data.filter(s => s.buyer === filterVal); }
            else if (index === 2) { data = data.filter(s => s.modelId === filterVal); }
        }
    });
    return data;
  }, [shipments, drillPath, products, t, viewDimension]);

  const chartData = useMemo(() => {
    if (displayMode === 'COLOR_SPLIT' && currentLevel === 'MODEL' && viewDimension === 'PRODUCT') return [];
    const aggregated: Record<string, number> = {};
    const idMap: Record<string, string> = {}; 
    filteredShipments.forEach(item => {
      let key = '', id = '';
      const product = products.find(p => p.id === item.modelId);
      if (viewDimension === 'PRODUCT') {
          if (currentLevel === 'SERIES') { key = product ? t(product.series) : 'Unknown'; id = key; } 
          else if (currentLevel === 'MODEL') { 
              key = displayMode === 'SKU' ? (product ? product.sku : 'Unknown') : (product ? t(product.modelName) : 'Unknown'); 
              id = product ? product.id : '';
          } else { key = item.buyer; id = key; }
      } else if (viewDimension === 'CUSTOMER') {
          if (currentLevel === 'CUSTOMER') { key = item.buyer; id = key; } 
          else if (currentLevel === 'MODEL') { key = product ? t(product.modelName) : 'Unknown'; id = product ? product.id : ''; } 
          else { key = item.version; id = key; }
      } else if (viewDimension === 'COUNTRY') {
          if (currentLevel === 'COUNTRY') { key = item.country; id = key; } 
          else if (currentLevel === 'CUSTOMER') { key = item.buyer; id = key; } 
          else { key = product ? t(product.modelName) : 'Unknown'; id = product ? product.id : ''; }
      }
      aggregated[key] = (aggregated[key] || 0) + item.quantity;
      if (id) idMap[key] = id;
    });
    return Object.keys(aggregated).map(key => ({ name: key, value: aggregated[key], id: idMap[key] || key })).sort((a, b) => b.value - a.value);
  }, [filteredShipments, currentLevel, displayMode, products, t, viewDimension]);

  const traceabilityResults = useMemo(() => {
    if(!searchQuery) return [];
    const affected: any[] = [];
    products.forEach(p => {
       const ecoMatch = (p.designHistory || []).find(eco => eco.ecoNumber.toLowerCase().includes(searchQuery.toLowerCase()));
       if(ecoMatch) {
          const productShipments = (shipments || []).filter(s => s.modelId === p.id && (ecoMatch.affectedBatches || []).some(b => s.buyer.toLowerCase().includes(b.toLowerCase())));
          affected.push({ product: p, eco: ecoMatch, shipments: productShipments });
       }
    });
    return affected;
  }, [searchQuery, products, shipments]);

  const renderSingleChart = (data: any[]) => {
    if (data.length === 0) return <div className="h-full flex items-center justify-center text-slate-300"><BarIcon size={32} className="mb-2 opacity-20" /><p className="text-sm">暫無數據</p></div>;
    const total = data.reduce((acc, cur) => acc + (cur.value || 0), 0);
    return (
        <ResponsiveContainer width="100%" height="100%">
            {chartType === 'PIE' ? (
            <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius="50%" outerRadius="75%" paddingAngle={4} dataKey="value" onClick={handleDrill} cursor="pointer">
                  {data.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-slate-900 font-bold" style={{ fontSize: '24px' }}>{total}</text>
                <Tooltip />
                <Legend />
            </PieChart>
            ) : (
            <BarChart data={data} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} interval={0} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} onClick={handleDrill} cursor="pointer">
                   {data.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Bar>
            </BarChart>
            )}
        </ResponsiveContainer>
    );
  };

  return (
    <div className="w-full p-8 min-h-screen">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-3xl font-bold text-slate-900">{t({ en: 'Product Dashboard', zh: '產品數據總覽' })}</h1>
           <p className="text-slate-500 mt-1">{t({ en: 'Integrated analytics for shipments, human factors, and lab testing.', zh: '整合出貨、人因測試與實驗室壽命測試之數據分析。' })}</p>
        </div>
        {activeView === 'SHIPMENT' && (
            <div>
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all shadow-sm">
                {isUploading ? <Loader2 className="animate-spin" size={18} /> : <FileSpreadsheet size={18} className="text-green-600" />}
                {t({ en: 'Upload Shipment Data', zh: '上傳出貨數據檔案' })}
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
            </div>
        )}
      </header>

      <div className="flex p-1 bg-slate-200/50 rounded-2xl mb-8 w-fit mx-auto md:mx-0">
          <button onClick={() => setActiveView('SHIPMENT')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeView === 'SHIPMENT' ? 'bg-white shadow-md text-slate-900' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
              <Truck size={18} /> {t({ en: 'Shipment Data', zh: '出貨數據' })}
          </button>
          <button onClick={() => setActiveView('ERGO')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeView === 'ERGO' ? 'bg-white shadow-md text-slate-900' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
              <Users size={18} /> {t({ en: 'Ergonomics Database', zh: '人因數據庫' })}
          </button>
          <button onClick={() => setActiveView('PRODUCT_TEST')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeView === 'PRODUCT_TEST' ? 'bg-white shadow-md text-slate-900' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
              <Activity size={18} /> {t({ en: 'Lab Testing (All SKUs)', zh: '實驗室測試 (全型號)' })}
          </button>
      </div>
      
      {activeView === 'SHIPMENT' ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 w-full animate-fade-in">
             <div className="lg:col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col h-[600px]">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        {drillPath.length > 0 && <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft size={18}/></button>}
                        <h2 className="text-lg font-bold text-slate-900">{drillPath.length === 0 ? t({ en: 'Global Overview', zh: '全球出貨概覽' }) : drillPath[drillPath.length-1].label}</h2>
                    </div>
                    <div className="flex bg-slate-100 rounded-lg p-1">
                        <button onClick={() => setChartType('PIE')} className={`p-2 rounded-md ${chartType === 'PIE' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}><PieIcon size={18} /></button>
                        <button onClick={() => setChartType('BAR')} className={`p-2 rounded-md ${chartType === 'BAR' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}><BarIcon size={18} /></button>
                    </div>
                </div>
                <div className="flex-1">{renderSingleChart(chartData)}</div>
             </div>
             <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Search size={18}/> {t({ en: 'Traceability', zh: '品質追溯' })}</h3>
                    <input type="text" placeholder="ECO ID..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-intenza-500/20" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                {showAiInsights && <GeminiInsight context="Shipment analysis" data={chartData} />}
             </div>
          </div>
      ) : activeView === 'ERGO' ? (
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm h-[600px] flex flex-col">
              <h2 className="text-xl font-bold text-slate-900 mb-6">{t({ en: 'Ergonomics Pass Rates', zh: '人因測試通過率' })}</h2>
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ergoAggregates.chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9"/>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12, fontWeight: 700}} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="passRate" name="Pass %" fill="#10b981" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="ngRate" name="NG %" fill="#f87171" radius={[0, 4, 4, 0]} />
                  </BarChart>
              </ResponsiveContainer>
          </div>
      ) : (
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm h-[600px] flex flex-col">
              <h2 className="text-xl font-bold text-slate-900 mb-6">{t({ en: 'Test Completion rates', zh: '各類別測試完成率' })}</h2>
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={testAggregates.categoryChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                      <XAxis dataKey="name" />
                      <YAxis unit="%" />
                      <Tooltip />
                      <Bar dataKey="avgScore" name="Avg %" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
              </ResponsiveContainer>
          </div>
      )}
    </div>
  );
};

export default Analytics;
