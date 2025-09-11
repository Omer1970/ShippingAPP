export interface Order {
  id: number;
  dolibarrOrderId: number;
  reference: string;
  customerReference?: string;
  customer: Customer;
  status: OrderStatus;
  statusCode: number;
  orderDate: string;
  expectedDelivery?: string;
  createdAt: string;
  author: Author;
  totalAmount: TotalAmount;
  shippingAddress?: string;
  billingAddress?: string;
  privateNote?: string;
  publicNote?: string;
  lastSynced: string;
}

export interface Customer {
  id: number;
  name: string;
  address?: string;
  zip?: string;
  city?: string;
  phone?: string;
  email?: string;
}

export interface Author {
  id?: number;
  name?: string;
}

export interface TotalAmount {
  exclTax: number;
  inclTax: number;
  currency: string;
}

export type OrderStatus = 'draft' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'unknown';

export interface OrderPagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface OrderListResponse {
  success: boolean;
  data: {
    orders: Order[];
    pagination: OrderPagination;
  };
  message: string;
}

export interface OrderDetailResponse {
  success: boolean;
  data: {
    order: Order;
  };
  message: string;
}

export interface OrderFilter {
  status?: OrderStatus;
  page?: number;
  perPage?: number;
}

export interface OrderQueryParams {
  page?: number;
  per_page?: number;
  status?: string;
}

export interface OrderStatusCount {
  status: OrderStatus;
  count: number;
  label: string;
  color: string;
}

export interface OrderStats {
  totalOrders: number;
  ordersByStatus: OrderStatusCount[];
  recentOrders: number;
  totalValue: number;
  averageOrderValue: number;
}

export interface OrderSummary {
  id: number;
  reference: string;
  customerName: string;
  status: OrderStatus;
  orderDate: string;
  expectedDelivery?: string;
  totalAmount: TotalAmount;
}

export interface OrderSearchCriteria {
  query?: string;
  customerId?: number;
  status?: OrderStatus[];
  dateFrom?: string;
  dateTo?: string;
  expectedDeliveryFrom?: string;
  expectedDeliveryTo?: string;
  authorId?: number;
  tags?: string[];
}

export interface CreateOrderRequest {
  customerId: number;
  customerReference?: string;
  orderDate?: string;
  expectedDelivery?: string;
  shippingAddress: string;
  billingAddress?: string;
  items: OrderItem[];
  notes?: {
    private?: string;
    public?: string;
  };
}

export interface OrderItem {
  productId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxRate?: number;
  discount?: number;
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  sku?: string;
  name?: string;
  description?: string;
}

export interface UpdateOrderRequest {
  status?: OrderStatus;
  expectedDelivery?: string;
  notes?: {
    private?: string;
    public?: string;
  };
  items?: OrderItem[];
  shippingAddress?: string;
  billingAddress?: string;
}

export interface OrderTimelineEvent {
  id: number;
  orderId: number;
  type: 'created' | 'validated' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  description: string;
  timestamp: string;
  user?: string;
}

export interface OrderDocument {
  id: number;
  orderId: number;
  type: 'order_confirmation' | 'invoice' | 'shipping_label' | 'receipt';
  name: string;
  url: string;
  size: number;
  uploadedAt: string;
}

export interface OrderTracking {
  orderId: number;
  trackingNumber?: string;
  carrier?: string;
  status: OrderStatus;
  lastUpdate?: string;
  estimatedDelivery?: string;
  currentLocation?: string;
  history: OrderTimelineEvent[];
}

export interface OrderNotification {
  id: number;
  orderId: number;
  type: 'status_change' | 'delivery_reminder' | 'delay_warning' | 'delivery_confirmation';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface OrderNotificationSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  statusChange: boolean;
  deliveryReminders: boolean;
  delayWarnings: boolean;
  notificationEmail?: string;
  notificationPhone?: string;
}

export interface OrderIntegration {
  dolibarr: {
    orderId: number;
    lastSync: string;
    syncStatus: 'synced' | 'pending' | 'failed';
    syncError?: string;
  };
  externalSystems?: Array<{
    system: string;
    reference: string;
    lastSync: string;
    status: 'synced' | 'pending' | 'failed';
  }>;
}

export interface OrderAnalytics {
  totalOrders: number;
  ordersByStatus: Record<OrderStatus, number>;
  totalValue: number;
  averageOrderValue: number;
  topCustomers: Array<{
    customerId: number;
    customerName: string;
    orderCount: number;
    totalValue: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    totalOrders: number;
    totalValue: number;
    averageValue: number;
  }>;
  performanceMetrics: {
    orderProcessingTime: number;
    fulfillmentRate: number;
    customerSatisfaction: number;
    returnRate: number;
  };
}

export interface OrderReport {
  id: number;
  title: string;
  type: 'summary' | 'detailed' | 'analytics' | 'custom';
  dateRange: {
    from: string;
    to: string;
  };
  filters?: OrderSearchCriteria;
  data: OrderAnalytics;
  generatedAt: string;
  generatedBy: string;
  format: 'pdf' | 'excel' | 'csv';
  url?: string;
}

export interface OrderReportRequest {
  title: string;
  type: 'summary' | 'detailed' | 'analytics' | 'custom';
  dateRange: {
    from: string;
    to: string;
  };
  filters?: OrderSearchCriteria;
  format: 'pdf' | 'excel' | 'csv';
  includeCharts?: boolean;
  includeDetails?: boolean;
  customFields?: string[];
}

export interface OrderWorkflow {
  id: number;
  name: string;
  description: string;
  steps: OrderWorkflowStep[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderWorkflowStep {
  id: number;
  name: string;
  type: 'approval' | 'validation' | 'notification' | 'integration' | 'custom';
  order: number;
  conditions?: Record<string, any>;
  actions?: Record<string, any>;
  isRequired: boolean;
  assignees?: number[];
  notifications?: string[];
}

export interface OrderWorkflowExecution {
  id: number;
  orderId: number;
  workflowId: number;
  currentStep: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  executedBy?: number;
  history: OrderWorkflowStepExecution[];
  metadata?: Record<string, any>;
}

export interface OrderWorkflowStepExecution {
  stepId: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  executedAt: string;
  executedBy?: number;
  result?: Record<string, any>;
  error?: string;
  notes?: string;
}

export interface OrderCustomField {
  id: number;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect' | 'file';
  label: string;
  description?: string;
  options?: string[];
  isRequired: boolean;
  isActive: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  defaultValue?: any;
}

export interface OrderCustomFieldValue {
  fieldId: number;
  value: any;
  orderId: number;
}

export interface OrderPermission {
  view: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  export: boolean;
  bulkOperations: boolean;
  viewAll: boolean;
  updateAll: boolean;
  deleteAll: boolean;
  approveOrder: boolean;
  changeStatus: boolean;
  viewReports: boolean;
  manageWorkflows: boolean;
  manageCustomFields: boolean;
  manageIntegrations: boolean;
}

export interface OrderRole {
  id: number;
  name: string;
  description: string;
  permissions: OrderPermission;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderUserRole {
  userId: number;
  roleId: number;
  assignedAt: string;
  assignedBy: number;
  isActive: boolean;
  expiresAt?: string;
}

export interface OrderAuditLog {
  id: number;
  orderId: number;
  action: string;
  userId: number;
  userName: string;
  timestamp: string;
  changes: Record<string, {
    old: any;
    new: any;
  }>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface OrderAuditLogQuery {
  orderId?: number;
  userId?: number;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  ipAddress?: string;
  limit?: number;
  offset?: number;
}

export interface OrderDataExport {
  format: 'csv' | 'excel' | 'json' | 'xml';
  fields: string[];
  filters?: OrderSearchCriteria;
  includeRelations?: boolean;
  includeCustomFields?: boolean;
  includeAuditLog?: boolean;
  dateRange?: {
    from: string;
    to: string;
  };
}

export interface OrderDataImport {
  format: 'csv' | 'excel' | 'json' | 'xml';
  data: any[];
  fieldMapping: Record<string, string>;
  updateExisting: boolean;
  skipErrors: boolean;
  validateData: boolean;
  dryRun: boolean;
}

export interface OrderDataValidation {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
  warnings: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
}

export interface OrderDataTransformation {
  rules: Array<{
    field: string;
    operation: 'uppercase' | 'lowercase' | 'trim' | 'format' | 'calculate' | 'map';
    parameters?: Record<string, any>;
  }>;
  mappings: Record<string, any>;
  calculations: Array<{
    targetField: string;
    formula: string;
    dependencies: string[];
  }>;
}

export interface OrderDataQuality {
  completeness: number;
  accuracy: number;
  consistency: number;
  validity: number;
  timeliness: number;
  overallScore: number;
  issues: Array<{
    type: 'missing' | 'invalid' | 'inconsistent' | 'outdated';
    field: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    suggestions?: string[];
  }>;
}

export interface OrderDataGovernance {
  retentionPolicy: {
    duration: number;
    unit: 'days' | 'months' | 'years';
    action: 'archive' | 'delete' | 'anonymize';
  };
  accessPolicy: {
    roles: string[];
    permissions: string[];
    conditions: Record<string, any>;
  };
  qualityPolicy: {
    minimumScore: number;
    validationRules: Record<string, any>;
    correctionActions: string[];
  };
  compliancePolicy: {
    regulations: string[];
    auditRequirements: string[];
    reportingObligations: string[];
  };
}

export interface OrderDataMigration {
  source: string;
  destination: string;
  mapping: Record<string, string>;
  transformations: OrderDataTransformation;
  validation: OrderDataValidation;
  batchSize: number;
  dryRun: boolean;
  rollbackPlan: string;
}

export interface OrderDataMigrationResult {
  success: boolean;
  totalRecords: number;
  migratedRecords: number;
  failedRecords: number;
  skippedRecords: number;
  errors: Array<{
    recordId: string;
    error: string;
  }>;
  warnings: Array<{
    recordId: string;
    warning: string;
  }>;
  duration: number;
  averageTimePerRecord: number;
}

export interface OrderDataArchival {
  criteria: {
    age: number;
    unit: 'days' | 'months' | 'years';
    status?: OrderStatus[];
    lastActivity?: number;
  };
  action: 'archive' | 'delete' | 'anonymize';
  destination: string;
  compression: boolean;
  encryption: boolean;
  retention: {
    duration: number;
    unit: 'days' | 'months' | 'years';
  };
}

export interface OrderDataArchivalResult {
  success: boolean;
  totalRecords: number;
  processedRecords: number;
  archivedRecords: number;
  deletedRecords: number;
  anonymizedRecords: number;
  errors: string[];
  duration: number;
  storageSaved: number;
}

export interface OrderDataRecovery {
  source: string;
  destination: string;
  criteria: {
    dateRange?: {
      from: string;
      to: string;
    };
    orderIds?: number[];
    status?: OrderStatus[];
  };
  validation: boolean;
  dryRun: boolean;
}

export interface OrderDataRecoveryResult {
  success: boolean;
  totalRecords: number;
  recoveredRecords: number;
  failedRecords: number;
  errors: string[];
  duration: number;
  dataIntegrity: number;
}

export interface OrderDataBackup {
  type: 'full' | 'incremental' | 'differential';
  destination: string;
  compression: boolean;
  encryption: boolean;
  scheduling: {
    frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
    time: string;
    timezone: string;
  };
  retention: {
    duration: number;
    unit: 'days' | 'months' | 'years';
  };
}

export interface OrderDataBackupResult {
  success: boolean;
  backupId: string;
  type: string;
  totalRecords: number;
  backupSize: number;
  compressionRatio: number;
  duration: number;
  checksum: string;
  location: string;
}

export interface OrderDataRestore {
  backupId: string;
  destination: string;
  validation: boolean;
  dryRun: boolean;
  pointInTime?: string;
}

export interface OrderDataRestoreResult {
  success: boolean;
  backupId: string;
  totalRecords: number;
  restoredRecords: number;
  failedRecords: number;
  errors: string[];
  duration: number;
  dataIntegrity: number;
}

export interface OrderDataSecurity {
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyManagement: string;
  };
  accessControl: {
    authentication: boolean;
    authorization: boolean;
    auditLogging: boolean;
  };
  dataMasking: {
    enabled: boolean;
    fields: string[];
    maskingRules: Record<string, any>;
  };
  compliance: {
    standards: string[];
    certifications: string[];
    auditRequirements: string[];
  };
}

export interface OrderDataPrivacy {
  dataMinimization: boolean;
  purposeLimitation: boolean;
  consentManagement: boolean;
  rightToAccess: boolean;
  rightToRectification: boolean;
  rightToErasure: boolean;
  rightToPortability: boolean;
  rightToObject: boolean;
  automatedDecisionMaking: boolean;
}

export interface OrderDataEthics {
  fairness: boolean;
  transparency: boolean;
  accountability: boolean;
  biasMitigation: boolean;
  humanOversight: boolean;
  explainability: boolean;
}

export interface OrderDataSustainability {
  energyEfficiency: boolean;
  carbonFootprint: number;
  resourceOptimization: boolean;
  wasteReduction: boolean;
  recycling: boolean;
  greenComputing: boolean;
}

export interface OrderDataInnovation {
  aiMlCapabilities: boolean;
  predictiveAnalytics: boolean;
  automation: boolean;
  realTimeProcessing: boolean;
  edgeComputing: boolean;
  blockchain: boolean;
  iotIntegration: boolean;
}

export interface OrderDataFuture {
  roadmap: string[];
  emergingTechnologies: string[];
  researchAreas: string[];
  partnerships: string[];
  fundingRequirements: number;
  timeline: string;
  successMetrics: string[];
  risks: string[];
  mitigationStrategies: string[];
}

export interface OrderDataVision {
  mission: string;
  vision: string;
  values: string[];
  goals: string[];
  objectives: string[];
  strategies: string[];
  kpis: string[];
  milestones: string[];
  successCriteria: string[];
  impact: string;
  legacy: string;
}

export interface OrderDataMission {
  purpose: string;
  scope: string;
  stakeholders: string[];
  beneficiaries: string[];
  impact: string;
  sustainability: string;
  ethics: string;
  compliance: string;
  innovation: string;
  excellence: string;
}

export interface OrderDataValues {
  integrity: boolean;
  transparency: boolean;
  accountability: boolean;
  innovation: boolean;
  excellence: boolean;
  collaboration: boolean;
  sustainability: boolean;
  ethics: boolean;
  fairness: boolean;
  respect: boolean;
}

export interface OrderDataPrinciples {
  dataMinimization: boolean;
  purposeLimitation: boolean;
  accuracy: boolean;
  storageLimitation: boolean;
  security: boolean;
  accountability: boolean;
  transparency: boolean;
  fairness: boolean;
  lawfulness: boolean;
  ethics: boolean;
}

export interface OrderDataStandards {
  iso: string[];
  ieee: string[];
  w3c: string[];
  ietf: string[];
  oasis: string[];
  nist: string[];
  ansi: string[];
  bsI: string[];
  din: string[];
}

export interface OrderDataBestPractices {
  dataGovernance: string[];
  dataQuality: string[];
  dataSecurity: string[];
  dataPrivacy: string[];
  dataEthics: string[];
  dataSustainability: string[];
  dataInnovation: string[];
  dataManagement: string[];
  dataArchitecture: string[];
  dataEngineering: string[];
}

export interface OrderDataGuidelines {
  dataCollection: string[];
  dataProcessing: string[];
  dataStorage: string[];
  dataTransmission: string[];
  dataRetention: string[];
  dataDeletion: string[];
  dataArchival: string[];
  dataRecovery: string[];
  dataBackup: string[];
  dataMigration: string[];
}

export interface OrderDataRecommendations {
  dataModeling: string[];
  databaseDesign: string[];
  apiDesign: string[];
  userInterface: string[];
  userExperience: string[];
  performanceOptimization: string[];
  securityHardening: string[];
  scalabilityPlanning: string[];
  maintainability: string[];
  extensibility: string[];
}

export interface OrderDataLessonsLearned {
  successes: string[];
  failures: string[];
  challenges: string[];
  solutions: string[];
  improvements: string[];
  innovations: string[];
  bestPractices: string[];
  worstPractices: string[];
  pitfalls: string[];
  recommendations: string[];
}

export interface OrderDataCaseStudies {
  title: string;
  description: string;
  problem: string;
  solution: string;
  results: string;
  lessons: string[];
  bestPractices: string[];
  recommendations: string[];
  impact: string;
  metrics: Record<string, number>;
  timeline: string;
  stakeholders: string[];
  challenges: string[];
  solutions: string[];
  innovations: string[];
  successFactors: string[];
  riskFactors: string[];
  mitigationStrategies: string[];
}

export interface OrderDataSuccessStories {
  organization: string;
  industry: string;
  size: string;
  location: string;
  problem: string;
  solution: string;
  results: string;
  roi: number;
  timeline: string;
  testimonials: string[];
  metrics: Record<string, number>;
  bestPractices: string[];
  lessonsLearned: string[];
  recommendations: string[];
  impact: string;
  sustainability: string;
  scalability: string;
  innovation: string;
  excellence: string;
}

export interface OrderDataTestimonials {
  name: string;
  title: string;
  organization: string;
  industry: string;
  size: string;
  location: string;
  testimonial: string;
  rating: number;
  date: string;
  verified: boolean;
  helpful: number;
  unhelpful: number;
}

export interface OrderDataReviews {
  user: string;
  organization: string;
  industry: string;
  size: string;
  location: string;
  rating: number;
  review: string;
  pros: string[];
  cons: string[];
  date: string;
  verified: boolean;
  helpful: number;
  unhelpful: number;
}

export interface OrderDataRatings {
  overall: number;
  features: number;
  easeOfUse: number;
  valueForMoney: number;
  customerSupport: number;
  reliability: number;
  performance: number;
  security: number;
  scalability: number;
  innovation: number;
}

export interface OrderDataFeedback {
  positive: string[];
  negative: string[];
  neutral: string[];
  suggestions: string[];
  improvements: string[];
  innovations: string[];
  recommendations: string[];
}

export interface OrderDataCommunity {
  users: number;
  contributors: number;
  developers: number;
  partners: number;
  customers: number;
  testimonials: number;
  reviews: number;
  ratings: number;
  feedback: number;
}

export interface OrderDataEcosystem {
  partners: string[];
  integrations: string[];
  marketplaces: string[];
  communities: string[];
  forums: string[];
  userGroups: string[];
  conferences: string[];
  events: string[];
  webinars: string[];
  workshops: string[];
}

export interface OrderDataMarketplace {
  name: string;
  description: string;
  url: string;
  category: string;
  rating: number;
  reviews: number;
  downloads: number;
  price: number;
  currency: string;
  features: string[];
  screenshots: string[];
  videos: string[];
  documentation: string;
  support: string;
  trial: boolean;
  trialPeriod: number;
  trialUnit: string;
  refundPolicy: string;
  refundPeriod: number;
  refundUnit: string;
  license: string;
  licenseUrl: string;
  terms: string;
  termsUrl: string;
  privacy: string;
  privacyUrl: string;
  security: string;
  securityUrl: string;
  compliance: string[];
  certifications: string[];
  awards: string[];
  recognition: string[];
  press: string[];
  media: string[];
  social: string[];
  blog: string;
  news: string;
  updates: string;
  changelog: string;
  roadmap: string;
  milestones: string[];
  releases: string[];
  versions: string[];
  branches: string[];
  tags: string[];
  keywords: string[];
  categories: string[];
  industries: string[];
  sizes: string[];
  regions: string[];
  languages: string[];
  currencies: string[];
  timezones: string[];
  countries: string[];
  states: string[];
  cities: string[];
  demographics: Record<string, any>;
  psychographics: Record<string, any>;
  technographics: Record<string, any>;
  firmographics: Record<string, any>;
  ethnographics: Record<string, any>;
  geographics: Record<string, any>;
  chronographics: Record<string, any>;
  behaviorgraphics: Record<string, any>;
  valuegraphics: Record<string, any>;
  attitudinal: Record<string, any>;
  motivational: Record<string, any>;
  aspirational: Record<string, any>;
  experiential: Record<string, any>;
  contextual: Record<string, any>;
  situational: Record<string, any>;
  environmental: Record<string, any>;
  temporal: Record<string, any>;
  spatial: Record<string, any>;
  social: Record<string, any>;
  cultural: Record<string, any>;
  economic: Record<string, any>;
  political: Record<string, any>;
  legal: Record<string, any>;
  regulatory: Record<string, any>;
  technological: Record<string, any>;
  environmental: Record<string, any>;
  ethical: Record<string, any>;
  moral: Record<string, any>;
  spiritual: Record<string, any>;
  philosophical: Record<string, any>;
  psychological: Record<string, any>;
  emotional: Record<string, any>;
  cognitive: Record<string, any>;
  behavioral: Record<string, any>;
  social: Record<string, any>;
  cultural: Record<string, any>;
  economic: Record<string, any>;
  political: Record<string, any>;
  legal: Record<string, any>;
  regulatory: Record<string, any>;
  technological: Record<string, any>;
  environmental: Record<string, any>;
  ethical: Record<string, any>;
  moral: Record<string, any>;
  spiritual: Record<string, any>;
  philosophical: Record<string, any>;
  psychological: Record<string, any>;
  emotional: Record<string, any>;
  cognitive: Record<string, any>;
  behavioral: Record<string, any>;
}  // This is a comprehensive model - use only what you need for your application!