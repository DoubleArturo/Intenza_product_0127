
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
  
  // Initialize drill path from state if available
  const [drillPath, setDrillPath] = useState<{ level: string, label: string, filterVal: string }[]>([]);
  const [dimension, setDimension] = useState<DimensionFilter>('DATA_DRILL');
  const [traceSearchQuery, setTraceSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canImport = userRole === 'admin' || userRole === 'uploader';

  // Handle auto-drill down from external state
  useEffect(() => {
    if (location.state?.autoDrill) {
        const auto = location.state.autoDrill; // Array of {level, val}
        const newPath: any[] = [];
        
        // Find Category and Series if only SKU is provided
        const skuInfo = auto.find((a: any) => a.level === 'SKU');
        if (skuInfo) {
            const firstShip = shipments.find(s => s.sku === skuInfo.val);
            if (firstShip) {
                newPath.push({ level: 'CATEGORY', label: firstShip.category, filterVal: firstShip.category });
                newPath.push({ level: 'SERIES', label: firstShip.series, filterVal: firstShip.series });
            }
        }
        
        auto.forEach((step: any) => {
            newPath.push({ level: step.level, label: step.val, filterVal: step.val });
        });
        
        setDrillPath(newPath);
        setDimension('DATA_DRILL');
        setViewMode('SHIPMENTS');
    }
  }, [location.state, shipments]);

  /**
   * Helper to format version string
   */
  const formatVersion = (v: string) => {
    const clean = (v || '1.0').toUpperCase().replace('V', '');
    return `V${clean}`;
  };

  /**
   * Optimized Drill-Down Sequence:
   * CATEGORY -> SERIES -> SKU -> VERSION -> BUYER
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
    
    // UPDATED DRILL SEQUENCE: SKU -> VERSION -> BUYER
    switch (depth) {
      case 0: return 'CATEGORY';
      case 1: return 'SERIES';
      case 2: return 'SKU';
      case 3: return 'VERSION'; 
      case 4: return 'BUYER'; 
      default: return 'BUYER';
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
    if (currentLevel === 'BUYER') return;
    setDrillPath([...drillPath, { level: currentLevel, label: entry.name, filterVal: entry.name }]);
  };
  
  // Rest of UI logic same as before...
