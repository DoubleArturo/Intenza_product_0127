
import React, { useState, useMemo, useRef, useContext } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line 
} from 'recharts';
import { ArrowLeft, PieChart as PieIcon, BarChart as BarIcon, Search, FileSpreadsheet, Layers, Palette, Tag, Globe, Users, Box, Truck, Activity, BrainCircuit, AlertTriangle, CheckCircle, Clock, ChevronDown, Filter, LayoutGrid, Image as ImageIcon } from 'lucide-react';
import { ShipmentData, ChartViewType, DrillLevel, ProductModel, LocalizedString, TestStatus, ErgoProjectCategory, NgDecisionStatus, Tester } from '../types';
import GeminiInsight from '../components/GeminiInsight';
import * as XLSX from 'xlsx';
import { LanguageContext } from '../App';

const COLORS = ['#0f172a', '#e3261b', '#94a3b8', '#fbbf24', '#f63e32', '#475569', '#3b82f6', '#10b981', '#8b5cf6'];
const STATUS_COLORS = {
  [TestStatus.PASS]: '#10b981', // Emerald 500
  [TestStatus.FAIL]: '#ef4444', // Red 500
  [TestStatus.WARNING]: '#f59e0b', // Amber 500
  [TestStatus.ONGOING]: '#3b82f6', // Blue 500
  [TestStatus.PENDING]: '#94a3b8', // Slate 400
};

// Color Palettes for the "Split by Color" view
const BROWN_PALETTE = ['#78350f', '#92400e', '#b45309', '#d97706', '#f59e0b', '#fbbf24']; // Dark to Light Brown/Orange
const BLACK_PALETTE = ['#020617', '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8']; // Dark to Light Slate

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
  
  // MAIN VIEW STATE
  const [activeView, setActiveView] = useState<MainView>('SHIPMENT');

  // --- SHIPMENT STATE ---
  const [chartType, setChartType] = useState<ChartViewType>('PIE');
  const [viewDimension, setViewDimension] = useState<ViewDimension>('PRODUCT');
  const [drillPath, setDrillPath] = useState<{ level: DrillLevel, label: string, filterVal: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('NAME');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- ERGO STATE ---
  const [selectedErgoProductId, setSelectedErgoProductId] = useState<string>('ALL');
  const [ergoChartMode, setErgoChartMode] = useState<ErgoChartMode>('BAR');
  const [ergoBreakdown, setErgoBreakdown] = useState<ErgoBreakdown>('OVERVIEW');
  
  // --- LAB TESTING STATE ---
  const [selectedLabSeries, setSelectedLabSeries] = useState<string>('ALL');

  // --- AGGREGATION LOGIC: ERGONOMICS (SINGLE or ALL SKUs) ---
  const ergoAggregates = useMemo(() => {
    let targetProducts = products;
    
    if (selectedErgoProductId !== 'ALL') {
        targetProducts = products.filter(p => p.id === selectedErgoProductId);
    }
    
    let totalProjects = 0;
    let totalTestersUnique = new Set<string>();
    
    // Category Stats Containers
    const categoryStats: Record<ErgoProjectCategory, { 
        totalTasks: number, 
        passCount: number, 
        ngCount: number,
        genderNg: { Male: number, Female: number },
        heightNg: { '<160': number, '160-170': number, '170-180': number, '>180': number }
    }> = {
        'Strength Curve': { totalTasks: 0, passCount: 0, ngCount: 0, genderNg: { Male: 0, Female: 0 }, heightNg: { '<160': 0, '160-170': 0, '170-180': 0, '>180': 0 } },
        'Experience': { totalTasks: 0, passCount: 0, ngCount: 0, genderNg: { Male: 0, Female: 0 }, heightNg: { '<160': 0, '160-170': 0, '170-180': 0, '>180': 0 } },
        'Stroke': { totalTasks: 0, passCount: 0, ngCount: 0, genderNg: { Male: 0, Female: 0 }, heightNg: { '<160': 0, '160-170': 0, '170-180': 0, '>180': 0 } },
        'Other Suggestion': { totalTasks: 0, passCount: 0, ngCount: 0, genderNg: { Male: 0, Female: 0 }, heightNg: { '<160': 0, '160-170': 0, '170-180': 0, '>180': 0 } }
    };

    const ngReasonsMap: Record<string, { count: number, category: string, products: string[] }> = {};

    targetProducts.forEach(p => {
        totalProjects += p.ergoProjects.length;
        p.ergoProjects.forEach(proj => {
            proj.testerIds.forEach(tid => totalTestersUnique.add(tid));
            
            (['Strength Curve', 'Experience', 'Stroke', 'Other Suggestion'] as ErgoProjectCategory[]).forEach(cat => {
                const tasks = proj.tasks[cat] || [];
                const projectTesterCount = proj.testerIds.length;
                const totalPossibleChecks = tasks.length * projectTesterCount;

                if (totalPossibleChecks > 0) {
                    categoryStats[cat].totalTasks += totalPossibleChecks;
                    
                    tasks.forEach(task => {
                        const passCount = task.passTesterIds.length;
                        categoryStats[cat].passCount += passCount;
                        
                        task.ngReasons.forEach(ng => {
                             const reasonText = t(ng.reason);
                             if (!ngReasonsMap[reasonText]) {
                                 ngReasonsMap[reasonText] = { count: 0, category: cat, products: [] };
                             }
                             ngReasonsMap[reasonText].count += 1;
                             if (!ngReasonsMap[reasonText].products.includes(t(p.modelName))) {
                                 ngReasonsMap[reasonText].products.push(t(p.modelName));
                             }
                             
                             categoryStats[cat].ngCount += 1;

                             const tester = testers.find(t => t.id === ng.testerId);
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
            name: c,
            passRate: passRate,
            ngRate: ngRate,
            passCount: pass,
            ngCount: ng,
            totalChecks: total,
            maleNg: stats.genderNg.Male,
            femaleNg: stats.genderNg.Female,
            h1: stats.heightNg['<160'],
            h2: stats.heightNg['160-170'],
            h3: stats.heightNg['170-180'],
            h4: stats.heightNg['>180'],
        };
    });

    const topNgReasons = Object.entries(ngReasonsMap)
        .map(([reason, data]) => ({ reason, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    return { totalProjects, totalTesters: totalTestersUnique.size, chartData, topNgReasons, selectedProduct: selectedErgoProductId === 'ALL' ? null : products.find(p => p.id === selectedErgoProductId) };
  }, [products, t, selectedErgoProductId, testers]);


  // --- AGGREGATION LOGIC: PRODUCT TESTING (ALL SKUs) ---
  const testAggregates = useMemo(() => {
     const productsInScope = selectedLabSeries === 'ALL' 
        ? products 
        : products.filter(p => t(p.series) === selectedLabSeries);

     let totalTests = 0;
     const statusCounts = {
         [TestStatus.PASS]: 0,
         [TestStatus.FAIL]: 0,
         [TestStatus.WARNING]: 0,
         [TestStatus.ONGOING]: 0,
         [TestStatus.PENDING]: 0
     };
     
     const categoryScores: Record<string, { total: number, count: number }> = {};
     
     const skuStatusData = productsInScope.map(p => {
         const pCounts = {
             [TestStatus.PASS]: 0,
             [TestStatus.FAIL]: 0,
             [TestStatus.WARNING]: 0,
             [TestStatus.ONGOING]: 0,
             [TestStatus.PENDING]: 0
         };
         const pCritical: { testName: string, status: TestStatus, details: string }[] = [];
         
         p.durabilityTests.forEach(test => {
             pCounts[test.status] = (pCounts[test.status] || 0) + 1;
             if (test.status === TestStatus.FAIL || test.status === TestStatus.WARNING) {
                 pCritical.push({ testName: t(test.testName), status: test.status, details: t(test.details) });
             }
         });
         
         return {
             product: p,
             totalTests: p.durabilityTests.length,
             counts: pCounts,
             criticalTests: pCritical
         };
     });


     productsInScope.forEach(p => {
         p.durabilityTests.forEach(test => {
             totalTests++;
             statusCounts[test.status] = (statusCounts[test.status] || 0) + 1;
             
             let pct = test.score;
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
  }, [products, t, selectedLabSeries]);


  // --- HELPER: SHIPMENT VIEW LOGIC ---
  const getCurrentLevel = (): DrillLevel => {
    const depth = drillPath.length;
    if (viewDimension === 'PRODUCT') {
        if (depth === 0) return 'SERIES';
        if (depth === 1) return 'MODEL';
        if (depth === 2) return 'BUYER';
    } else if (viewDimension === 'CUSTOMER') {
        if (depth === 0) return 'CUSTOMER';
        if (depth === 1) return 'MODEL';
        if (depth === 2) return 'VERSION';
    } else if (viewDimension === 'COUNTRY') {
        if (depth === 0) return 'COUNTRY';
        if (depth === 1) return 'CUSTOMER';
        if (depth === 2) return 'MODEL';
    }
    return 'SERIES';
  };
  const currentLevel = getCurrentLevel();

  const handleDimensionChange = (dim: ViewDimension) => {
    setViewDimension(dim);
    setDrillPath([]);
    setDisplayMode('NAME');
  };

  const handleDrill = (entry: any) => {
     if (drillPath.length >= (viewDimension === 'COUNTRY' ? 3 : 2)) return;
     if (displayMode === 'COLOR_SPLIT') return;
     const nextFilterVal = entry.id || entry.name;
     setDrillPath([...drillPath, { level: currentLevel, label: entry.name, filterVal: nextFilterVal }]);
     setDisplayMode('NAME');
  };

  const handleBack = () => {
    setDrillPath(drillPath.slice(0, -1));
    setDisplayMode('NAME');
  };

  const filteredShipments = useMemo(() => {
    let data = [...shipments];
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
    
    return Object.keys(aggregated).map(key => {
        const id = idMap[key] || key;
        const product = products.find(p => p.id === id);
        return { 
            name: key, 
            value: aggregated[key], 
            id: id,
            sku: product ? product.sku : '', 
            imageUrl: product ? product.imageUrl : '',
            fullName: product ? t(product.modelName) : key
        };
    }).sort((a, b) => b.value - a.value);
  }, [filteredShipments, currentLevel, displayMode, products, t, viewDimension]);

  const colorSplitData = useMemo(() => {
      if (displayMode !== 'COLOR_SPLIT' || currentLevel !== 'MODEL' || viewDimension !== 'PRODUCT') return { brown: [], black: [] };
      const brownMap: Record<string, any> = {};
      const blackMap: Record<string, any> = {};
      
      filteredShipments.forEach(item => {
          const product = products.find(p => p.id === item.modelId);
          if (!product) return;
          const descToCheck = item.variant || t(product.modelName) + ' ' + t(product.description);
          const fullText = descToCheck.toLowerCase();
          
          const isBrown = fullText.includes('brown') || fullText.includes('咖啡') || fullText.includes('brn');
          const isBlack = fullText.includes('black') || fullText.includes('黑') || fullText.includes('blk');
          
          // Use SKU as primary label for Color Split
          const key = product.sku;
          const details = { sku: product.sku, imageUrl: product.imageUrl, fullName: t(product.modelName) };

          if (isBrown) { 
              if (!brownMap[key]) brownMap[key] = { value: 0, ...details };
              brownMap[key].value += item.quantity;
          } else if (isBlack) { 
              if (!blackMap[key]) blackMap[key] = { value: 0, ...details };
              blackMap[key].value += item.quantity;
          }
      });
      
      return {
          brown: Object.values(brownMap).map((d: any) => ({ name: d.sku, value: d.value, ...d })),
          black: Object.values(blackMap).map((d: any) => ({ name: d.sku, value: d.value, ...d }))
      };
  }, [filteredShipments, currentLevel, displayMode, products, t, viewDimension]);

  // Traceability
  const traceabilityResults = useMemo(() => {
    if(!searchQuery) return [];
    const affected: any[] = [];
    products.forEach(p => {
       const ecoMatch = p.designHistory.find(eco => eco.ecoNumber.toLowerCase().includes(searchQuery.toLowerCase()));
       if(ecoMatch) {
          const productShipments = shipments.filter(s => s.modelId === p.id && ecoMatch.affectedBatches.some(b => s.buyer.toLowerCase().includes(b.toLowerCase())));
          affected.push({ product: p, eco: ecoMatch, shipments: productShipments });
       }
    });
    return affected;
  }, [searchQuery, products, shipments]);

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
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws, { raw: false });
        
        const productsToCreate: any[] = [];
        const seenSkus = new Set(products.map(p => p.sku)); 
        const newSkuMap = new Map<string, string>(); 

        jsonData.forEach((row: any) => {
            const sku = row['SKU'];
            if (!sku || seenSkus.has(sku) || newSkuMap.has(sku)) return;

            const newId = `p-imported-${sku.replace(/[^a-zA-Z0-9]/g, '-')}`;
            newSkuMap.set(sku, newId);

            const rawSeries = row['Series'] || 'General';
            let mappedSeries: LocalizedString;
            if (rawSeries.includes('DL')) mappedSeries = { en: 'DL Series (Entertainment)', zh: 'DL 系列 (娛樂)' };
            else if (rawSeries.includes('SL')) mappedSeries = { en: 'SL Series (Standard)', zh: 'SL 系列 (標準)' };
            else if (rawSeries.includes('Cardio')) mappedSeries = { en: 'Cardio Series', zh: '有氧系列' };
            else if (rawSeries.includes('Strength')) mappedSeries = { en: 'Strength Series', zh: '力量系列' };
            else mappedSeries = { en: `${rawSeries} Series`, zh: `${rawSeries} 系列` };

            const rawDesc = row['Description'] || 'Unknown Model';
            const modelName = rawDesc.replace(/\(Brown\)|\(Black\)|\(Brn\)|\(Blk\)|（咖啡色）|（黑色）/gi, '').trim();

            productsToCreate.push({
                id: newId, 
                sku: sku,
                series: mappedSeries,
                modelName: { en: modelName, zh: modelName },
                description: { en: rawDesc, zh: rawDesc },
                currentVersion: row['Version'] ? (row['Version'].toString().startsWith('v') ? row['Version'] : `v${row['Version']}`) : 'v1.0',
                imageUrl: '' // Clear default image for imported products
            });
        });

        if (productsToCreate.length > 0) {
            onBatchAddProducts(productsToCreate);
        }

        const newShipments: ShipmentData[] = jsonData.map((row: any, index: number) => {
            const sku = row['SKU'];
            let matchedModelId = '';
            const existingP = products.find(p => p.sku === sku);
            if (existingP) {
                matchedModelId = existingP.id;
            } else {
                matchedModelId = newSkuMap.get(sku) || 'unknown';
            }

            return {
                id: `s-${Date.now()}-${index}`,
                modelId: matchedModelId,
                version: row['Version'] ? (row['Version'].toString().startsWith('v') ? row['Version'] : `v${row['Version']}`) : 'v1.0',
                buyer: row['Buyer'] || 'Unknown',
                country: 'Global',
                quantity: Number(row['QTY'] || row['Quantity'] || 0),
                shipDate: row['Shipped date'] || new Date().toISOString().split('T')[0],
                variant: row['Description'] 
            };
        });

        if (newShipments.length > 0) {
            onImportData(newShipments);
            alert(`Success! Created ${productsToCreate.length} new products and imported ${newShipments.length} shipment records.`);
        } else {
            alert('No valid records found.');
        }

      } catch (error) { 
          console.error(error);
          alert('Error processing file. Please ensure it is a valid Excel file.'); 
      } finally { 
          setIsUploading(false); 
          if(fileInputRef.current) fileInputRef.current.value = ''; 
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
          const dataPoint = payload[0].payload;
          return (
              <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-xl z-50 min-w-[150px]">
                  {dataPoint.imageUrl && (
                      <div className="w-full h-24 mb-2 rounded-lg overflow-hidden bg-slate-50">
                          <img src={dataPoint.imageUrl} className="w-full h-full object-cover" />
                      </div>
                  )}
                  <p className="font-bold text-slate-900 text-sm leading-tight mb-1">{dataPoint.fullName || label}</p>
                  {dataPoint.sku && <p className="text-xs text-slate-500 font-mono mb-2 bg-slate-50 px-1 py-0.5 rounded w-fit">{dataPoint.sku}</p>}
                  <p className="text-intenza-600 font-bold text-xl flex items-baseline gap-1">
                      {payload[0].value.toLocaleString()} <span className="text-xs text-slate-400 font-normal">units</span>
                  </p>
              </div>
          );
      }
      return null;
  };

  const renderSingleChart = (data: any[], title?: string, palette: string[] = COLORS) => {
    if (data.length === 0) return <div className="h-full flex flex-col items-center justify-center text-slate-300"><BarIcon size={32} className="mb-2 opacity-20" /><p className="text-sm">No data</p></div>;
    const total = data.reduce((acc, cur) => acc + (cur.value || 0), 0);

    const RenderCustomTick = (tickProps: any) => {
        const { x, y, payload, index } = tickProps;
        const item = data[index];
        // Only show rich tick for Product Model level where images exist
        if (item && item.imageUrl && viewDimension === 'PRODUCT' && currentLevel === 'MODEL') {
             return (
                <g transform={`translate(${x},${y})`}>
                    <foreignObject x={-12} y={5} width={24} height={24}>
                        <div className="w-6 h-6 rounded-md overflow-hidden border border-slate-200 bg-white">
                            <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                    </foreignObject>
                    <text x={0} y={40} dy={0} textAnchor="middle" fill="#64748b" fontSize={9} fontWeight={600}>
                        {item.sku || payload.value.substring(0,8)}
                    </text>
                </g>
             );
        }
        return (
            <g transform={`translate(${x},${y})`}>
                <text x={0} y={0} dy={16} textAnchor="middle" fill="#64748b" fontSize={10}>
                    {payload.value && payload.value.length > 10 ? payload.value.substring(0,8)+'...' : payload.value}
                </text>
            </g>
        )
    };

    return (
        <ResponsiveContainer width="100%" height="100%">
            {chartType === 'PIE' ? (
            <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius="50%" outerRadius="75%" paddingAngle={4} dataKey="value" onClick={handleDrill} cursor="pointer">
                  {data.map((entry, index) => <Cell key={`cell-${index}`} fill={palette[index % palette.length]} stroke="none" />)}
                </Pie>
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-slate-900 font-bold" style={{ fontSize: '3.5vw' }}>{total.toLocaleString()}</text>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
            ) : (
            <BarChart data={data} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={<RenderCustomTick />} 
                    interval={0} 
                    height={50}
                />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                <Tooltip cursor={{fill: '#f8fafc'}} content={<CustomTooltip />} />
                <Bar dataKey="value" fill={palette[1]} radius={[6, 6, 0, 0]} onClick={handleDrill} cursor="pointer">
                   {data.map((entry, index) => <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />)}
                </Bar>
            </BarChart>
            )}
        </ResponsiveContainer>
    );
  };

  const uniqueSeries = useMemo(() => {
     const seriesSet = new Set(products.map(p => t(p.series)));
     return Array.from(seriesSet);
  }, [products, t]);

  const renderContent = () => {
    switch (activeView) {
      case 'SHIPMENT':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 w-full animate-fade-in">
             <div className="lg:col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col">
                <div className="flex flex-col gap-4 mb-6">
                    <div className="flex justify-between items-start mt-2">
                        <div className="flex items-center gap-2">
                            {drillPath.length > 0 && <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft size={18} className="text-slate-600"/></button>}
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    {drillPath.length === 0 ? 'Global Overview' : drillPath[drillPath.length-1].label}
                                    {drillPath.length > 0 && <span className="text-xs font-normal text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">Filtered</span>}
                                </h2>
                                <p className="text-xs text-slate-400">Level: <span className="font-semibold text-intenza-600">{currentLevel}</span></p>
                            </div>
                        </div>
                        <div className="flex bg-slate-100 rounded-lg p-1">
                            <button onClick={() => setChartType('PIE')} className={`p-2 rounded-md transition-all ${chartType === 'PIE' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}><PieIcon size={18} /></button>
                            <button onClick={() => setChartType('BAR')} className={`p-2 rounded-md transition-all ${chartType === 'BAR' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}><BarIcon size={18} /></button>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 items-center justify-between bg-slate-50 p-3 rounded-xl">
                         {/* Dimensions */}
                         <div className="flex gap-2">
                             {(['PRODUCT', 'CUSTOMER', 'COUNTRY'] as ViewDimension[]).map(d => (
                                 <button key={d} onClick={() => handleDimensionChange(d)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${viewDimension === d ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                                     {d === 'PRODUCT' ? 'By Product' : d === 'CUSTOMER' ? 'By Customer' : 'By Country'}
                                 </button>
                             ))}
                         </div>
                         {/* View Mode (Model Level only) */}
                         {viewDimension === 'PRODUCT' && currentLevel === 'MODEL' && (
                             <div className="flex gap-2">
                                 <button onClick={() => setDisplayMode('NAME')} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${displayMode === 'NAME' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}>Standard</button>
                                 <button onClick={() => setDisplayMode('SKU')} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${displayMode === 'SKU' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}>SKU</button>
                                 <button onClick={() => setDisplayMode('COLOR_SPLIT')} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${displayMode === 'COLOR_SPLIT' ? 'bg-white ring-1 ring-intenza-100 text-intenza-700' : 'text-slate-400'}`}>Color Split</button>
                             </div>
                         )}
                    </div>
                </div>

                <div className="flex-1 min-h-[400px]">
                    {displayMode === 'COLOR_SPLIT' && currentLevel === 'MODEL' && viewDimension === 'PRODUCT' ? (
                        <div className="grid grid-cols-2 gap-4 h-full">
                            <div className="bg-amber-50/30 rounded-2xl p-4 border border-amber-100 flex flex-col"><h4 className="text-amber-800 font-bold text-sm mb-2 text-center uppercase">Brown Edition</h4><div className="flex-1 min-h-[300px]">{renderSingleChart(colorSplitData.brown, 'Brown', BROWN_PALETTE)}</div></div>
                            <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 flex flex-col"><h4 className="text-slate-700 font-bold text-sm mb-2 text-center uppercase">Black Edition</h4><div className="flex-1 min-h-[300px]">{renderSingleChart(colorSplitData.black, 'Black', BLACK_PALETTE)}</div></div>
                        </div>
                    ) : (chartData.length > 0 ? renderSingleChart(chartData) : <div className="h-full flex flex-col items-center justify-center text-slate-400"><BarIcon size={48} className="mb-2 opacity-20" /><p>No data available.</p></div>)}
                </div>
             </div>
             
             <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Search size={18} className="text-intenza-600"/> Traceability</h3>
                    <input type="text" placeholder="ECO ID (e.g., ECO-2023-001)..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-intenza-500/20" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    <div className="max-h-[300px] overflow-y-auto space-y-3 pt-4 custom-scrollbar">
                        {searchQuery && traceabilityResults.length === 0 && <div className="text-sm text-slate-400 text-center">No records found</div>}
                        {traceabilityResults.map((res, idx) => (
                            <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div className="flex justify-between items-start mb-1"><span className="font-bold text-xs text-slate-800">{t(res.product.modelName)}</span><span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono">{res.eco.ecoNumber}</span></div>
                                <div className="text-[10px] text-slate-500">Affected Clients: {Array.from(new Set(res.shipments.map((s: ShipmentData) => s.buyer))).join(', ') || 'None'}</div>
                            </div>
                        ))}
                    </div>
                </div>
                {showAiInsights && <GeminiInsight context={`Viewing shipment data. Dimension: ${viewDimension}. Level: ${currentLevel}. Filters: ${JSON.stringify(drillPath)}.`} data={displayMode === 'COLOR_SPLIT' ? colorSplitData : chartData} />}
             </div>
          </div>
        );
      
      case 'ERGO':
        return (
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 w-full animate-fade-in">
              <div className="lg:col-span-4">
                  {/* Controls Header */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-center gap-4 w-full md:w-auto">
                          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Users size={24}/></div>
                          <div className="flex-1">
                              <h2 className="text-xl font-bold text-slate-900">Ergonomics Analytics</h2>
                              <p className="text-sm text-slate-500">Human Factors Pass Rate & Demographics</p>
                          </div>
                      </div>
                      
                      <div className="flex items-center gap-3 w-full md:w-auto">
                           <div className="relative flex-1 md:w-64">
                               <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                               <select 
                                   value={selectedErgoProductId}
                                   onChange={(e) => setSelectedErgoProductId(e.target.value)}
                                   className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer hover:bg-slate-100 transition-colors"
                               >
                                   <option value="ALL">Company Overview (All Products)</option>
                                   {products.map(p => (
                                       <option key={p.id} value={p.id}>{t(p.modelName)} ({p.sku})</option>
                                   ))}
                               </select>
                               <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                           </div>
                      </div>
                  </div>

                  {/* Stats & Charts Area */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* Left Side: KPIs & Top Issues */}
                      <div className="space-y-6">
                         <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="text-2xl font-bold text-slate-900">{ergoAggregates.totalTesters}</div>
                                <div className="text-xs text-slate-500 uppercase font-bold tracking-wide mt-1">Total Testers</div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="text-2xl font-bold text-slate-900">{ergoAggregates.totalProjects}</div>
                                <div className="text-xs text-slate-500 uppercase font-bold tracking-wide mt-1">Active Projects</div>
                            </div>
                         </div>
                         
                         {/* Top Issues */}
                         <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-[400px]">
                            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-wide"><AlertTriangle size={16} className="text-amber-500"/> Top Issues {selectedErgoProductId !== 'ALL' && <span className="text-xs text-slate-400 font-normal">({t(ergoAggregates.selectedProduct?.modelName || {en:'',zh:''})})</span>}</h3>
                            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                                {ergoAggregates.topNgReasons.length === 0 ? <div className="text-center text-slate-400 py-10">No NG data recorded</div> : 
                                ergoAggregates.topNgReasons.map((item, idx) => (
                                    <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-xs text-slate-800 leading-tight flex-1">{item.reason}</span>
                                        <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-2">{item.count}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1">{item.category}</div>
                                    </div>
                                ))
                                }
                            </div>
                         </div>
                      </div>

                      {/* Right Side: Main Charts */}
                      <div className="lg:col-span-2 space-y-6">
                          {/* Chart Controls */}
                          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
                              <div className="flex gap-2">
                                  <button onClick={() => setErgoChartMode('BAR')} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${ergoChartMode === 'BAR' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}><BarIcon size={14}/> Bar</button>
                                  <button onClick={() => setErgoChartMode('PIE')} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${ergoChartMode === 'PIE' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}><PieIcon size={14}/> Pie</button>
                              </div>
                              <div className="flex gap-2">
                                  <button onClick={() => setErgoBreakdown('OVERVIEW')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${ergoBreakdown === 'OVERVIEW' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Overall</button>
                                  <button onClick={() => setErgoBreakdown('GENDER')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${ergoBreakdown === 'GENDER' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>By Gender (NG)</button>
                                  <button onClick={() => setErgoBreakdown('HEIGHT')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${ergoBreakdown === 'HEIGHT' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>By Height (NG)</button>
                              </div>
                          </div>

                          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-[400px]">
                             {ergoChartMode === 'BAR' ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={ergoAggregates.chartData} layout="vertical" margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9"/>
                                        <XAxis type="number" hide={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 11, fontWeight: 700}} width={80}/>
                                        <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                        <Legend verticalAlign="top" iconType="circle" height={36}/>
                                        
                                        {ergoBreakdown === 'OVERVIEW' && <Bar dataKey="passRate" name="Pass Rate %" stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} barSize={32} />}
                                        {ergoBreakdown === 'OVERVIEW' && <Bar dataKey="ngRate" name="NG Rate %" stackId="a" fill="#f87171" radius={[0, 4, 4, 0]} barSize={32} />}

                                        {ergoBreakdown === 'GENDER' && <Bar dataKey="maleNg" name="Male NG Count" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} barSize={32} />}
                                        {ergoBreakdown === 'GENDER' && <Bar dataKey="femaleNg" name="Female NG Count" stackId="a" fill="#ec4899" radius={[0, 4, 4, 0]} barSize={32} />}

                                        {ergoBreakdown === 'HEIGHT' && <Bar dataKey="h1" name="<160cm NG" stackId="a" fill="#fca5a5" radius={[0, 0, 0, 0]} barSize={32} />}
                                        {ergoBreakdown === 'HEIGHT' && <Bar dataKey="h2" name="160-170cm NG" stackId="a" fill="#f87171" radius={[0, 0, 0, 0]} barSize={32} />}
                                        {ergoBreakdown === 'HEIGHT' && <Bar dataKey="h3" name="170-180cm NG" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} barSize={32} />}
                                        {ergoBreakdown === 'HEIGHT' && <Bar dataKey="h4" name=">180cm NG" stackId="a" fill="#b91c1c" radius={[0, 4, 4, 0]} barSize={32} />}
                                    </BarChart>
                                </ResponsiveContainer>
                             ) : (
                                <div className="h-full w-full flex flex-col">
                                    <div className="flex-1 grid grid-cols-3 gap-2">
                                        {ergoAggregates.chartData.map((catData, i) => (
                                            <div key={i} className="flex flex-col items-center justify-center relative">
                                                <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">{catData.name}</h4>
                                                <div className="w-full h-full min-h-[150px]">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie 
                                                                data={[{name: 'Pass', value: catData.passCount}, {name: 'NG', value: catData.ngCount}]} 
                                                                dataKey="value" 
                                                                cx="50%" cy="50%" 
                                                                innerRadius="60%" outerRadius="80%" 
                                                                paddingAngle={5}
                                                            >
                                                                <Cell fill="#10b981" />
                                                                <Cell fill="#ef4444" />
                                                            </Pie>
                                                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none pt-6">
                                                    <span className="text-xl font-bold text-slate-800">{catData.passRate}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-center gap-6 mt-4 pb-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Pass</div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600"><div className="w-3 h-3 rounded-full bg-red-500"></div> NG</div>
                                    </div>
                                </div>
                             )}
                          </div>
                      </div>
                  </div>
              </div>
           </div>
        );

      case 'PRODUCT_TEST':
        return (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full animate-fade-in">
               
               {/* Controls Header */}
               <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Activity size={24}/></div>
                      <div className="flex-1">
                          <h2 className="text-xl font-bold text-slate-900">Lab Testing Status</h2>
                          <p className="text-sm text-slate-500">Durability & Reliability per SKU</p>
                      </div>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full md:w-auto">
                       <div className="relative flex-1 md:w-64">
                           <LayoutGrid size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                           <select 
                               value={selectedLabSeries}
                               onChange={(e) => setSelectedLabSeries(e.target.value)}
                               className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none cursor-pointer hover:bg-slate-100 transition-colors"
                           >
                               <option value="ALL">All Series</option>
                               {uniqueSeries.map(s => (
                                   <option key={s} value={s}>{s}</option>
                               ))}
                           </select>
                           <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                       </div>
                  </div>
               </div>

               {/* SKU Status Grid (Health Matrix) */}
               <div className="lg:col-span-3">
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                       {testAggregates.skuStatusData.length === 0 && <div className="col-span-full text-center py-12 text-slate-400">No products found in this series.</div>}
                       {testAggregates.skuStatusData.map((item) => {
                           const { product, totalTests, counts, criticalTests } = item;
                           const passW = totalTests > 0 ? (counts[TestStatus.PASS] / totalTests) * 100 : 0;
                           const failW = totalTests > 0 ? (counts[TestStatus.FAIL] / totalTests) * 100 : 0;
                           const warnW = totalTests > 0 ? (counts[TestStatus.WARNING] / totalTests) * 100 : 0;
                           const ongoingW = totalTests > 0 ? (counts[TestStatus.ONGOING] / totalTests) * 100 : 0;
                           const pendingW = totalTests > 0 ? (counts[TestStatus.PENDING] / totalTests) * 100 : 0;

                           return (
                               <div key={product.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md hover:-translate-y-1">
                                    <div className="relative h-32 bg-slate-100 flex items-center justify-center overflow-hidden">
                                        {product.imageUrl ? (
                                            <img src={product.imageUrl} className="w-full h-full object-cover opacity-90"/>
                                        ) : (
                                            <ImageIcon size={32} className="text-slate-300 opacity-30" />
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                        <div className="absolute bottom-3 left-4 text-white">
                                            <div className="text-xs font-semibold opacity-80 mb-0.5">{t(product.series).split(' ')[0]}</div>
                                            <div className="font-bold leading-tight">{t(product.modelName)}</div>
                                            <div className="text-[10px] font-mono opacity-80">{product.sku}</div>
                                        </div>
                                        {criticalTests.length > 0 && (
                                            <div className="absolute top-3 right-3 bg-red-500 text-white p-1.5 rounded-full shadow-sm animate-pulse">
                                                <AlertTriangle size={14}/>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="p-4 flex-1 flex flex-col">
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-xs font-bold text-slate-500 uppercase">Test Health</span>
                                            <span className="text-xs font-bold text-slate-900">{totalTests} Tests</span>
                                        </div>
                                        
                                        {/* Segmented Health Bar */}
                                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex mb-4">
                                            {passW > 0 && <div style={{width: `${passW}%`}} className="h-full bg-emerald-500" title={`Pass: ${counts[TestStatus.PASS]}`}/>}
                                            {ongoingW > 0 && <div style={{width: `${ongoingW}%`}} className="h-full bg-blue-500" title={`Ongoing: ${counts[TestStatus.ONGOING]}`}/>}
                                            {pendingW > 0 && <div style={{width: `${pendingW}%`}} className="h-full bg-slate-400" title={`Pending: ${counts[TestStatus.PENDING]}`}/>}
                                            {warnW > 0 && <div style={{width: `${warnW}%`}} className="h-full bg-amber-500" title={`Warning: ${counts[TestStatus.WARNING]}`}/>}
                                            {failW > 0 && <div style={{width: `${failW}%`}} className="h-full bg-red-500" title={`Fail: ${counts[TestStatus.FAIL]}`}/>}
                                        </div>

                                        {/* Legend / Counts */}
                                        <div className="flex justify-between text-[10px] text-slate-500 mb-4 border-b border-slate-50 pb-2">
                                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"/> {counts[TestStatus.PASS]} Pass</div>
                                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"/> {counts[TestStatus.FAIL]} Fail</div>
                                        </div>

                                        {/* Critical Alerts List */}
                                        <div className="mt-auto space-y-2">
                                            {criticalTests.length > 0 ? (
                                                criticalTests.slice(0, 2).map((crt, idx) => (
                                                    <div key={idx} className="bg-red-50 p-2 rounded-lg border border-red-100 flex items-start gap-2">
                                                        <Activity size={12} className="text-red-500 mt-0.5 shrink-0"/>
                                                        <div className="overflow-hidden">
                                                            <div className="text-[10px] font-bold text-slate-800 truncate">{crt.testName}</div>
                                                            <div className="text-[10px] text-red-600 truncate">{crt.details}</div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-xs text-slate-400 italic text-center py-2">No critical issues</div>
                                            )}
                                            {criticalTests.length > 2 && <div className="text-[10px] text-center text-slate-400">+{criticalTests.length - 2} more issues</div>}
                                        </div>
                                    </div>
                               </div>
                           )
                       })}
                   </div>
               </div>

               {/* Category Performance (Bottom Aggregate) */}
               <div className="lg:col-span-3 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm mt-4">
                   <h3 className="text-lg font-bold text-slate-900 mb-6">Average Completion % by Category ({selectedLabSeries === 'ALL' ? 'Company Wide' : selectedLabSeries})</h3>
                   <ResponsiveContainer width="100%" height={250}>
                       <BarChart data={testAggregates.categoryChartData}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                           <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} unit="%"/>
                           <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                           <Bar dataKey="avgScore" name="Avg Completion" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={50} />
                       </BarChart>
                   </ResponsiveContainer>
               </div>
           </div>
        );
      default: return null;
    }
  };

  return (
    <div className="w-full p-8 min-h-screen">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-3xl font-bold text-slate-900">Product Dashboard</h1>
           <p className="text-slate-500 mt-1">Integrated analytics for shipments, human factors, and lab testing.</p>
        </div>
        {activeView === 'SHIPMENT' && (
            <div>
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all shadow-sm">
                {isUploading ? <span className="animate-spin">⌛</span> : <FileSpreadsheet size={18} className="text-green-600" />}
                Upload Shipment Data
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
            </div>
        )}
      </header>

      {/* Main Tab Switcher */}
      <div className="flex p-1 bg-slate-200/50 rounded-2xl mb-8 w-fit mx-auto md:mx-0">
          <button 
             onClick={() => setActiveView('SHIPMENT')}
             className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeView === 'SHIPMENT' ? 'bg-white shadow-md text-slate-900' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
              <Truck size={18} className={activeView === 'SHIPMENT' ? 'text-intenza-600' : ''}/> Shipment Data
          </button>
          <button 
             onClick={() => setActiveView('ERGO')}
             className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeView === 'ERGO' ? 'bg-white shadow-md text-slate-900' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
              <Users size={18} className={activeView === 'ERGO' ? 'text-indigo-600' : ''}/> Ergonomics Database
          </button>
          <button 
             onClick={() => setActiveView('PRODUCT_TEST')}
             className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeView === 'PRODUCT_TEST' ? 'bg-white shadow-md text-slate-900' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
              <Activity size={18} className={activeView === 'PRODUCT_TEST' ? 'text-emerald-600' : ''}/> Lab Testing (All SKUs)
          </button>
      </div>
      
      {renderContent()}

    </div>
  );
};

export default Analytics;
