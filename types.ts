
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

export interface UserAccount {
  id: string;
  username: string;
  password: string;
  role: 'admin' | 'user';
  lastLogin?: string;
}

export enum TestStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  WARNING = 'WARNING',
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
export type ErgoProjectCategory = 'Strength Curve' | 'Experience' | 'Stroke' | 'Other Suggestion';
export type Gender = 'Male' | 'Female';

// Simplified for Customer Feedback
export interface ErgoFeedback {
  id: string;
  date: string;
  type: 'COMPLAINT';
  category: ErgoProjectCategory;
  content: LocalizedString;
  source: string; // Customer, etc.
  status?: 'PENDING' | 'DISCUSSION' | 'IGNORED'; // Updated status field
  attachmentUrls?: string[];
}

export enum NgDecisionStatus {
  PENDING = 'PENDING',
  NEEDS_IMPROVEMENT = 'NEEDS_IMPROVEMENT',
  DISCUSSION = 'DISCUSSION',
  IGNORED = 'IGNORED',
  IDEA = 'IDEA'
}

// New Project-Based Structure for Internal Evaluation
export interface NgReason {
  testerId: string;
  reason: LocalizedString;
  attachmentUrls?: string[];
  decisionStatus?: NgDecisionStatus;
  linkedEcoId?: string; // CHANGED: Use ID for robust dynamic linking
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
  ecoNumber: string; // ECO/ECR
  date: string;
  version: string;
  description: LocalizedString;
  affectedBatches: string[];
  affectedCustomers: string[];
  imageUrls?: string[]; // Updated to support multiple images/videos
  status: EcoStatus;
  implementationDate?: string;
  sourceFeedbacks?: {
    projectId: string;
    category: ErgoProjectCategory;
    taskId: string;
    testerId: string;
  }[];
  // Deprecated single sourceFeedback for backward compatibility if needed, but array preferred
  sourceFeedback?: {
    projectId: string;
    category: ErgoProjectCategory;
    testerId: string;
  }
}

export interface TestResult {
  id: string;
  category: string; // Changed from fixed union to string to allow custom categories
  testName: LocalizedString;
  score: number; // 0-100 or percentage
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
  ergoTests: TestResult[]; // Retained for legacy or simple tests
  
  // New project-based ergonomics
  ergoProjects: ErgoProject[];
  customerFeedback: ErgoFeedback[];
  uniqueFeedbackTags: { [key in ErgoProjectCategory]?: LocalizedString[] };


  durabilityTests: TestResult[];
  isWatched: boolean;
  customSortOrder: number;
}

export interface ShipmentData {
  id: string;
  modelId: string;
  version: string;
  buyer: string;
  country: string;
  quantity: number;
  shipDate: string;
  variant?: string; // Stores the raw description/color (e.g. "Chest Press (Brown)")
}

export interface Tester {
  id: string;
  name: string;
  gender: Gender;
  imageUrl: string;
  height: number; // in cm
  experienceYears: number;
  rating: number; // 1-5 stars
}

// Data Visualization Types
export type ChartViewType = 'PIE' | 'BAR';
export type DrillLevel = 'SERIES' | 'MODEL' | 'VERSION' | 'BUYER' | 'COUNTRY' | 'CUSTOMER';

export interface AppState {
  products: ProductModel[];
  seriesList: LocalizedString[];
  shipments: ShipmentData[];
  testers: Tester[]; 
  users: UserAccount[]; // 加入帳號列表
  language: Language;
  maxHistorySteps?: number;
  showAiInsights?: boolean;
  customLogoUrl?: string; // 加入自定義 Logo
}
