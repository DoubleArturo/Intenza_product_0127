
import { ProductModel, TestStatus, ShipmentData, LocalizedString, EcoStatus, Tester, ErgoProject, ProjectOverallStatus, NgDecisionStatus } from '../types';

const ls = (en: string, zh: string): LocalizedString => ({ en, zh });

export const MOCK_TESTERS: Tester[] = [
  {
    id: 't1',
    name: 'Sarah Chen',
    gender: 'Female',
    imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80',
    height: 165,
    experienceYears: 4,
    rating: 5,
    bio: {
      en: "Master of Sports Science - NTNU\n4 years Professional Fitness Instructor\nHuman Factors Certification (HFES)\nSpecialist in Lower Limb Biomechanics",
      zh: "運動科學碩士 - 國立台灣師範大學\n4年專業健身教練經驗\n人因工程學會認證專家\n下肢生物力學分析專家"
    }
  },
  {
    id: 't2',
    name: 'Mike Ross',
    gender: 'Male',
    imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80',
    height: 182,
    experienceYears: 2,
    rating: 4,
    bio: {
      en: "B.S. in Mechanical Engineering\nAmateur Triathlete\nFocus on ergonomic grip comfort\n2 years QA testing experience",
      zh: "機械工程學士\n業餘鐵人三項選手\n專注於握把人體工學舒適度\n2年品質保證測試經驗"
    }
  },
  {
    id: 't3',
    name: 'Jessica Lee',
    gender: 'Female',
    imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80',
    height: 158,
    experienceYears: 6,
    rating: 5,
    bio: {
      en: "Doctor of Physical Therapy\nCertified Ergonomist\n6 years Clinical Experience in Sports Rehab\nExpert in seated equipment posture",
      zh: "物理治療博士\n認證人因工程師\n6年運動康復臨床經驗\n坐姿器材姿勢分析專家"
    }
  },
  {
    id: 't4',
    name: 'David Kim',
    gender: 'Male',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80',
    height: 175,
    experienceYears: 1,
    rating: 3,
    bio: {
      en: "Gym Enthusiast\n1 year Fitness Equipment Beta Tester\nProvides valuable subjective user feedback\nAvid runner",
      zh: "健身愛好者\n1年健身器材測試員\n提供具價值的用戶主觀回饋\n長跑愛好者"
    }
  }
];

export const MOCK_PRODUCTS: ProductModel[] = [
  {
    id: 'p1',
    series: ls('DL Series (Entertainment)', 'DL 系列 (娛樂)'),
    modelName: ls('550Te2 Treadmill', '550Te2 跑步機'),
    sku: 'TR-550-DL',
    imageUrl: '',
    currentVersion: 'v2.4',
    description: ls('Flagship treadmill with 19" touch console.', '配備19英寸觸控螢幕的旗艦跑步機。'),
    isWatched: false,
    customSortOrder: 0,
    designHistory: [
      {
        id: 'ec1',
        ecoNumber: 'ECO-2023-001',
        date: '2023-11-15',
        version: 'v2.4',
        description: ls('Motor controller cooling optimization.', '電機控制器散熱優化。'),
        affectedBatches: ['B2023-11', 'B2023-12'],
        affectedCustomers: ['Gold\'s Gym US', 'Equinox UK'],
        imageUrls: [],
        status: EcoStatus.DESIGN_COMPLETE,
      },
      {
        id: 'ec2',
        ecoNumber: 'ECR-2023-089',
        date: '2023-06-20',
        version: 'v2.3',
        description: ls('Side rail material upgrade to prevent sweat corrosion.', '升級側扶手材質以防止汗水侵蝕。'),
        affectedBatches: ['B2023-01', 'B2023-05'],
        affectedCustomers: ['Anytime Fitness JP'],
        status: EcoStatus.IN_PRODUCTION,
        implementationDate: '2023-07-01'
      }
    ],
    ergoTests: [],
    ergoProjects: [],
    customerFeedback: [],
    uniqueFeedbackTags: {},
    durabilityTests: []
  },
  {
    id: 'p2',
    series: ls('SL Series (Standard)', 'SL 系列 (標準)'),
    modelName: ls('450ET Elliptical', '450ET 橢圓機'),
    sku: 'EL-450-SL',
    imageUrl: '',
    currentVersion: 'v1.2',
    description: ls('Compact elliptical for hotel usage.', '適用於飯店的緊湊型橢圓機。'),
    isWatched: false,
    customSortOrder: 1,
    designHistory: [],
    ergoTests: [],
    ergoProjects: [],
    customerFeedback: [],
    uniqueFeedbackTags: {},
    durabilityTests: []
  },
  {
    id: 'p3',
    series: ls('Cardio Series', '有氧系列'),
    modelName: ls('GC3 Indoor Cycle', 'GC3 室內健身車'),
    sku: 'BK-GC3',
    imageUrl: '',
    currentVersion: 'v3.0',
    description: ls('High performance indoor cycle with power meter.', '配備功率計的高性能室內健身車。'),
    isWatched: false,
    customSortOrder: 2,
    designHistory: [],
    ergoTests: [],
    ergoProjects: [],
    customerFeedback: [],
    uniqueFeedbackTags: {},
    durabilityTests: []
  }
];

export const MOCK_SHIPMENTS: ShipmentData[] = [
  { 
    id: 's1', 
    modelId: 'p1', 
    version: 'v2.4', 
    buyer: 'Gold\'s Gym', 
    country: 'USA', 
    quantity: 150, 
    shipDate: '2023-12-01',
    deliveryNo: 'DN-001',
    item: 'Treadmill',
    pi: 'PI-2023-01',
    pn: 'PN-12345',
    description: '550Te2 Treadmill DL',
    sku: 'TR-550-DL',
    sn: 'SN-P1-001',
    category: 'Cardio',
    series: 'DL Series'
  },
  { 
    id: 's5', 
    modelId: 'p2', 
    version: 'v1.2', 
    buyer: 'Hilton Group', 
    country: 'Global', 
    quantity: 500, 
    shipDate: '2024-01-20',
    deliveryNo: 'DN-002',
    item: 'Elliptical',
    pi: 'PI-2024-05',
    pn: 'PN-67890',
    description: '450ET Elliptical SL',
    sku: 'EL-450-SL',
    sn: 'SN-P2-001',
    category: 'Cardio',
    series: 'SL Series'
  },
  { 
    id: 's7', 
    modelId: 'p3', 
    version: 'v3.0', 
    buyer: 'Les Mills', 
    country: 'New Zealand', 
    quantity: 1000, 
    shipDate: '2023-11-01',
    deliveryNo: 'DN-003',
    item: 'Indoor Cycle',
    pi: 'PI-2023-07',
    pn: 'PN-11223',
    description: 'GC3 Indoor Cycle',
    sku: 'BK-GC3',
    sn: 'SN-P3-001',
    category: 'Cardio',
    series: 'Cardio Series'
  },
];
