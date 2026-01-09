
export type Language = 'en' | 'zh';

export interface LocalizedString {
  en: string;
  zh: string;
}

export type ProductSeries = LocalizedString;

export const DEFAULT_SERIES: LocalizedString[] = [
  { en: 'DL Series (Entertainment)', zh: 'DL 系列 (娛樂)' },
  { en: 'SL Series (Standard)', zh: 'SL 系列 (標準)' },
  { en: 'Cardio Series', zh: '有氧系列' },
  { en: 'Strength Series', zh: '力量系列' }
];

// 細分權限定義
export interface ModulePermissions {
  canEdit: boolean;
  canSync: boolean;
}

export interface UserPermissions {
  canSyncShipments: boolean; // 出貨資料上傳同步權限
  seriesAccess: {
    [seriesName: string]: ModulePermissions;
  };
  skuAccess: {
    [sku: string]: {
      design: ModulePermissions;
      ergo: ModulePermissions;
      durability: ModulePermissions;
    };
  };
}

export interface UserAccount {
  id: string;
  username: string;
  password: string;
  role: 'admin' | 'user' | 'uploader' | 'viewer';
  lastLogin?: string;
  permissions?: UserPermissions; // 新增權限欄位
}

export enum TestStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  PENDING = 'PENDING',
  ONGOING = 'ONGOING'
}

export enum EcoStatus {
  EVALUATING = 'Evaluating',
  DESIGNING = 'Designing',
  DESIGN_COMPLETE = 'Design Complete',
  IN_PRODUCTION = 'In Production',
}

export type FeedbackType = 'EVALUATION' | 'COMPLAINT';
export type ErgoProjectCategory = 'Resistance profile' | 'Experience' | 'Stroke' | 'Other Suggestion';
export type Gender = 'Male' | 'Female';

export interface ErgoFeedback {
  id: string;
  date: string;
  type: 'COMPLAINT';
  category: ErgoProjectCategory;
  content: LocalizedString;
  source: string;
  status?: 'PENDING' | 'DISCUSSION' | 'IGNORED';
  attachmentUrls?: string[];
  linkedEcoId?: string; // Track linked design changes
}

export enum NgDecisionStatus {
  PENDING = 'PENDING',
  NEEDS_IMPROVEMENT = 'NEEDS_IMPROVEMENT',
  DISCUSSION = 'DISCUSSION',
  IGNORED = 'IGNORED',
  IDEA = 'IDEA'
}

export interface NgReason {
  testerId: string;
  reason: LocalizedString;
  attachmentUrls?: string[];
  decisionStatus?: NgDecisionStatus;
  linkedEcoId?: string;
}

export interface EvaluationTask {
    id: string;
    name: LocalizedString;
    passTesterIds: string[];
    ngReasons: NgReason[];
}

export enum ProjectOverallStatus {
  PENDING = 'PENDING',
  PASS = 'PASS',
  NG = 'NG'
}

export interface ErgoProject {
  id: string;
  name: LocalizedString;
  date: string;
  testerIds: string[];
  tasks: { [key in ErgoProjectCategory]: EvaluationTask[] };
  overallStatus: ProjectOverallStatus;
  uniqueNgReasons: { [key in ErgoProjectCategory]?: LocalizedString[] };
}

export interface DesignChange {
  id: string;
  ecrNumber?: string;
  ecrDate?: string;
  ecoNumber: string;
  date: string;
  version: string;
  description: LocalizedString;
  affectedBatches: string[];
  affectedCustomers: string[];
  imageUrls?: string[];
  status: EcoStatus;
  implementationDate?: string;
  sourceFeedbacks?: {
    projectId?: string;
    category: ErgoProjectCategory;
    taskId?: string;
    testerId?: string;
    feedbackId?: string;
  }[];
}

export interface TestResult {
  id: string;
  category: string;
  testName: LocalizedString;
  version?: string;
  score: number;
  status: TestStatus;
  details: LocalizedString;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  updatedDate?: string;
  attachmentUrls?: string[];
  startDate?: string;
  estimatedCompletionDate?: string;
}

export interface ProductModel {
  id: string;
  series: LocalizedString;
  modelName: LocalizedString;
  sku: string;
  imageUrl: string;
  currentVersion: string;
  description: LocalizedString;
  designHistory: DesignChange[];
  ergoTests: TestResult[];
  ergoProjects: ErgoProject[];
  customerFeedback: ErgoFeedback[];
  uniqueFeedbackTags: { [key in ErgoProjectCategory]?: LocalizedString[] };
  durabilityTests: TestResult[];
  isWatched: boolean;
  customSortOrder: number;
  safetyCert?: string;
  // Status Light Properties
  statusOverride?: 'RED' | 'BLUE' | 'GREEN' | 'AUTO';
  statusLightSize?: 'SMALL' | 'NORMAL' | 'LARGE';
}

export interface ShipmentData {
  id: string;
  modelId: string;
  shipDate: string;
  buyer: string;
  deliveryNo: string;
  item: string;
  pi: string;
  pn: string;
  description: string;
  sku: string;
  quantity: number;
  sn: string;
  version: string;
  category: string;
  series: string;
  country?: string; // Pre-reserved for future use
}

export type ChartViewType = 'PIE' | 'BAR';
export type DrillLevel = 'CATEGORY' | 'SERIES' | 'SKU' | 'VERSION' | 'BUYER' | 'COUNTRY' | 'CUSTOMER';

export interface AuditLog {
  id: string;
  username: string;
  loginTime: string;
  logoutTime?: string;
  durationMinutes?: number;
}

export interface AppState {
  products: ProductModel[];
  seriesList: LocalizedString[];
  shipments: ShipmentData[];
  testers: Tester[]; 
  testerGroups?: TesterGroup[];
  users: UserAccount[];
  auditLogs?: AuditLog[];
  language: Language;
  maxHistorySteps?: number;
  showAiInsights?: boolean;
  customLogoUrl?: string;
  globalStatusLightSize?: 'SMALL' | 'NORMAL' | 'LARGE';
  dashboardColumns?: number;
  cardAspectRatio?: string;
  chartColorStyle?: 'COLORFUL' | 'MONOCHROME' | 'SLATE';
  analyticsTooltipScale?: number;
  analyticsTooltipPosition?: 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT' | 'FOLLOW';
  evaluationModalYOffset?: number;
}

export interface Tester {
  id: string;
  name: string;
  gender: Gender;
  imageUrl: string;
  height: number;
  experienceYears: number;
  rating: number;
  bio?: LocalizedString; // For Education/Work Experience
}

export interface TesterGroup {
  id: string;
  name: LocalizedString;
  testerIds: string[];
}
