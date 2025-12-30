

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
    rating: 5
  },
  {
    id: 't2',
    name: 'Mike Ross',
    gender: 'Male',
    imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80',
    height: 182,
    experienceYears: 2,
    rating: 4
  },
  {
    id: 't3',
    name: 'Jessica Lee',
    gender: 'Female',
    imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80',
    height: 158,
    experienceYears: 6,
    rating: 5
  },
  {
    id: 't4',
    name: 'David Kim',
    gender: 'Male',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80',
    height: 175,
    experienceYears: 1,
    rating: 3
  }
];

export const MOCK_PRODUCTS: ProductModel[] = [
  {
    id: 'p1',
    series: ls('DL Series (Entertainment)', 'DL 系列 (娛樂)'),
    modelName: ls('550Te2 Treadmill', '550Te2 跑步機'),
    sku: 'TR-550-DL',
    imageUrl: 'https://picsum.photos/400/300?random=1',
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
        imageUrls: ['https://picsum.photos/seed/eco1/400/200'],
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
      },
      {
        id: 'eco-linked',
        ecoNumber: 'EVAL-9876',
        date: new Date().toISOString().split('T')[0],
        version: 'v2.4',
        description: ls('[Needs Improvement] Knee clearance issue during full incline.', '[需要改進] 全坡度時膝蓋活動空間不足。'),
        affectedBatches: [],
        affectedCustomers: [],
        status: EcoStatus.EVALUATING,
        imageUrls: [],
        sourceFeedbacks: [{ projectId: 'proj1', category: 'Strength Curve', taskId: 'task1', testerId: 't2' }]
      }
    ],
    ergoTests: [],
    ergoProjects: [
      {
        id: 'proj1',
        name: ls('Phase 1 Ergonomic Study', '第一階段人因工程研究'),
        date: '2024-02-20',
        testerIds: ['t1', 't2', 't4'], // Sarah, Mike, David
        overallStatus: ProjectOverallStatus.PENDING,
        uniqueNgReasons: {
          'Strength Curve': [ls('Knee clearance issue during full incline.', '全坡度時膝蓋活動空間不足。')],
          'Experience': [ls('Emergency stop button is slightly too recessed.', '緊急停止按鈕稍微有些凹陷，不易按壓。'), ls('Console glare under direct light', '主控台在直射光下會反光')],
        },
        tasks: {
          'Strength Curve': [
              {
                  id: 'task1',
                  name: ls('Knee Clearance Test (Max Incline)', '膝蓋空間測試 (最大坡度)'),
                  passTesterIds: ['t1', 't4'],
                  ngReasons: [
                      { testerId: 't2', reason: ls('Knee clearance issue during full incline.', '全坡度時膝蓋活動空間不足。'), decisionStatus: NgDecisionStatus.NEEDS_IMPROVEMENT, linkedEcoId: 'eco-linked' }
                  ]
              }
          ],
          'Experience': [
              {
                  id: 'task2',
                  name: ls('Emergency Stop Accessibility', '緊急停止按鈕易用性'),
                  passTesterIds: ['t1', 't2'],
                  ngReasons: [
                      { testerId: 't4', reason: ls('Emergency stop button is slightly too recessed.', '緊急停止按鈕稍微有些凹陷，不易按壓。'), decisionStatus: NgDecisionStatus.PENDING }
                  ]
              }
          ],
          'Stroke': [],
          'Other Suggestion': []
        }
      }
    ],
    customerFeedback: [
      {
        id: 'ef2',
        date: '2023-12-12',
        type: 'COMPLAINT',
        category: 'Experience',
        source: 'Equinox Customer',
        content: ls('Emergency stop button is slightly too recessed.', '緊急停止按鈕稍微有些凹陷，不易按壓。')
      },
       {
        id: 'ef3',
        date: '2024-01-05',
        type: 'COMPLAINT',
        category: 'Strength Curve',
        source: 'McFit Member',
        content: ls('At max incline, my knees sometimes hit the front motor housing. I am 185cm tall.', '在最大坡度時，我的膝蓋有時會碰到前方的馬達外殼。我身高185公分。')
      }
    ],
    uniqueFeedbackTags: {
        'Experience': [ls('Emergency stop button is slightly too recessed.', '緊急停止按鈕稍微有些凹陷，不易按壓。')],
        'Strength Curve': [ls('At max incline, my knees sometimes hit the front motor housing. I am 185cm tall.', '在最大坡度時，我的膝蓋有時會碰到前方的馬達外殼。我身高185公分。')]
    },
    durabilityTests: [
      { id: 'd1', category: 'Durability', testName: ls('Belt Life (20k km)', '跑帶壽命 (2萬公里)'), score: 92, status: TestStatus.PASS, details: ls('Minimal wear observed.', '僅觀察到輕微磨損。') },
      { id: 'd2', category: 'Reliability', testName: ls('Incline Motor Cycles', '坡度電機循環測試'), score: 78, status: TestStatus.WARNING, details: ls('Heat variance detected after 5000 cycles.', '5000次循環後檢測到溫度變化。') },
    ]
  },
  {
    id: 'p2',
    series: ls('SL Series (Standard)', 'SL 系列 (標準)'),
    modelName: ls('450ET Elliptical', '450ET 橢圓機'),
    sku: 'EL-450-SL',
    imageUrl: 'https://picsum.photos/400/300?random=2',
    currentVersion: 'v1.2',
    description: ls('Compact elliptical for hotel usage.', '適用於飯店的緊湊型橢圓機。'),
    isWatched: false,
    customSortOrder: 1,
    designHistory: [
      {
        id: 'ec3',
        ecoNumber: 'ECO-2024-002',
        date: '2024-01-10',
        version: 'v1.2',
        description: ls('Pedal linkage reinforcement.', '踏板連桿加固。'),
        affectedBatches: ['B2024-01'],
        affectedCustomers: ['Hilton Group'],
        status: EcoStatus.DESIGNING,
      }
    ],
    ergoTests: [],
    ergoProjects: [],
    customerFeedback: [],
    uniqueFeedbackTags: {},
    durabilityTests: [
      { id: 'd3', category: 'Durability', testName: ls('Bearing Load Test', '軸承負載測試'), score: 99, status: TestStatus.PASS, details: ls('Exceeded expected lifecycle by 20%.', '超出預期生命週期20%。') },
    ]
  },
  {
    id: 'p3',
    series: ls('Cardio Series', '有氧系列'),
    modelName: ls('GC3 Indoor Cycle', 'GC3 室內健身車'),
    sku: 'BK-GC3',
    imageUrl: 'https://picsum.photos/400/300?random=3',
    currentVersion: 'v3.0',
    description: ls('High performance indoor cycle with power meter.', '配備功率計的高性能室內健身車。'),
    isWatched: false,
    customSortOrder: 2,
    designHistory: [],
    ergoTests: [],
    ergoProjects: [],
    customerFeedback: [],
    uniqueFeedbackTags: {},
    durabilityTests: [
        { id: 'd4', category: 'Durability', testName: ls('Rust Resistance', '防鏽能力'), score: 60, status: TestStatus.FAIL, details: ls('Salt spray test failure at 48hrs.', '鹽霧測試在48小時後失敗。') },
    ]
  }
];

export const MOCK_SHIPMENTS: ShipmentData[] = [
  // 550Te2 Shipments
  { id: 's1', modelId: 'p1', version: 'v2.4', buyer: 'Gold\'s Gym', country: 'USA', quantity: 150, shipDate: '2023-12-01' },
  { id: 's2', modelId: 'p1', version: 'v2.4', buyer: 'Equinox', country: 'UK', quantity: 80, shipDate: '2023-12-15' },
  { id: 's3', modelId: 'p1', version: 'v2.3', buyer: 'Anytime Fitness', country: 'Japan', quantity: 200, shipDate: '2023-07-01' },
  { id: 's4', modelId: 'p1', version: 'v2.3', buyer: 'McFit', country: 'Germany', quantity: 120, shipDate: '2023-08-01' },
  
  // 450ET Shipments
  { id: 's5', modelId: 'p2', version: 'v1.2', buyer: 'Hilton Group', country: 'Global', quantity: 500, shipDate: '2024-01-20' },
  { id: 's6', modelId: 'p2', version: 'v1.1', buyer: 'Marriott', country: 'USA', quantity: 300, shipDate: '2023-10-10' },

  // GC3 Shipments
  { id: 's7', modelId: 'p3', version: 'v3.0', buyer: 'Les Mills', country: 'New Zealand', quantity: 1000, shipDate: '2023-11-01' },
  { id: 's8', modelId: 'p3', version: 'v2.9', buyer: 'Virgin Active', country: 'South Africa', quantity: 400, shipDate: '2023-05-01' },
];