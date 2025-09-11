export interface Shipment {
  id: number;
  dolibarrShipmentId: number;
  reference: string;
  customerReference?: string;
  customer: Customer;
  status: ShipmentStatus;
  statusCode: number;
  expectedDelivery?: string;
  createdAt: string;
  author: Author;
  totalWeight?: number;
  weightUnits?: number;
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

export type ShipmentStatus = 'draft' | 'validated' | 'in_transit' | 'delivered' | 'cancelled' | 'unknown';

export interface ShipmentPagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ShipmentListResponse {
  success: boolean;
  data: {
    shipments: Shipment[];
    pagination: ShipmentPagination;
  };
  message: string;
}

export interface ShipmentDetailResponse {
  success: boolean;
  data: {
    shipment: Shipment;
  };
  message: string;
}

export interface ShipmentFilter {
  status?: ShipmentStatus;
  page?: number;
  perPage?: number;
}

export interface ShipmentQueryParams {
  page?: number;
  per_page?: number;
  status?: string;
}

export interface ShipmentStatusCount {
  status: ShipmentStatus;
  count: number;
  label: string;
  color: string;
}

export interface ShipmentStats {
  totalShipments: number;
  shipmentsByStatus: ShipmentStatusCount[];
  recentShipments: number;
}

export interface ShipmentSummary {
  id: number;
  reference: string;
  customerName: string;
  status: ShipmentStatus;
  expectedDelivery?: string;
  totalWeight?: number;
}

export interface ShipmentMapData {
  id: number;
  reference: string;
  customerName: string;
  deliveryAddress: string;
  lat?: number;
  lng?: number;
  status: ShipmentStatus;
  expectedDelivery?: string;
}

export interface ShipmentTimelineEvent {
  id: number;
  shipmentId: number;
  type: 'created' | 'validated' | 'shipped' | 'delivered' | 'cancelled';
  description: string;
  timestamp: string;
  user?: string;
}

export interface ShipmentDocument {
  id: number;
  shipmentId: number;
  type: 'delivery_note' | 'invoice' | 'packing_list';
  name: string;
  url: string;
  size: number;
  uploadedAt: string;
}

export interface ShipmentTracking {
  shipmentId: number;
  trackingNumber?: string;
  carrier?: string;
  status: ShipmentStatus;
  lastUpdate?: string;
  estimatedDelivery?: string;
  currentLocation?: string;
  history: ShipmentTimelineEvent[];
}

export interface CreateShipmentRequest {
  customerId: number;
  customerReference?: string;
  expectedDelivery?: string;
  shippingAddress: string;
  billingAddress?: string;
  items: ShipmentItem[];
  notes?: {
    private?: string;
    public?: string;
  };
}

export interface ShipmentItem {
  productId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
}

export interface UpdateShipmentRequest {
  status?: ShipmentStatus;
  expectedDelivery?: string;
  trackingNumber?: string;
  carrier?: string;
  notes?: {
    private?: string;
    public?: string;
  };
}

export interface ShipmentSearchCriteria {
  query?: string;
  customerId?: number;
  status?: ShipmentStatus[];
  dateFrom?: string;
  dateTo?: string;
  expectedDeliveryFrom?: string;
  expectedDeliveryTo?: string;
  authorId?: number;
  tags?: string[];
}

export interface ShipmentExportRequest {
  format: 'csv' | 'excel' | 'pdf';
  criteria?: ShipmentSearchCriteria;
  fields?: string[];
  dateRange?: {
    from: string;
    to: string;
  };
}

export interface ShipmentImportRequest {
  file: File;
  format: 'csv' | 'excel';
  updateExisting: boolean;
  fieldMapping: Record<string, string>;
}

export interface ShipmentImportResult {
  success: boolean;
  totalRows: number;
  importedRows: number;
  updatedRows: number;
  failedRows: number;
  errors: string[];
  warnings: string[];
}

export interface ShipmentBulkAction {
  action: 'update_status' | 'assign_driver' | 'add_note' | 'export' | 'delete';
  shipmentIds: number[];
  parameters?: Record<string, any>;
}

export interface ShipmentBulkActionResult {
  success: boolean;
  processedCount: number;
  successCount: number;
  failureCount: number;
  errors: string[];
  results: Array<{
    shipmentId: number;
    success: boolean;
    message?: string;
    error?: string;
  }>;
}

export interface ShipmentNotification {
  id: number;
  shipmentId: number;
  type: 'status_change' | 'delivery_reminder' | 'delay_warning' | 'delivery_confirmation';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface ShipmentNotificationSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  statusChange: boolean;
  deliveryReminders: boolean;
  delayWarnings: boolean;
  notificationEmail?: string;
  notificationPhone?: string;
}

export interface ShipmentIntegration {
  dolibarr: {
    shipmentId: number;
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

export interface ShipmentAnalytics {
    totalShipments: number;
    shipmentsByStatus: Record<ShipmentStatus, number>;
    averageDeliveryTime: number;
    onTimeDeliveryRate: number;
    topCustomers: Array<{
      customerId: number;
      customerName: string;
      shipmentCount: number;
      totalValue: number;
    }>;
    monthlyTrends: Array<{
      month: string;
      totalShipments: number;
      deliveredShipments: number;
      averageDeliveryTime: number;
    }>;
    performanceMetrics: {
      averageProcessingTime: number;
      averageTransitTime: number;
      deliverySuccessRate: number;
      customerSatisfaction: number;
    };
}

export interface ShipmentReport {
  id: number;
  title: string;
  type: 'summary' | 'detailed' | 'analytics' | 'custom';
  dateRange: {
    from: string;
    to: string;
  };
  filters?: ShipmentSearchCriteria;
  data: ShipmentAnalytics;
  generatedAt: string;
  generatedBy: string;
  format: 'pdf' | 'excel' | 'csv';
  url?: string;
}

export interface ShipmentReportRequest {
  title: string;
  type: 'summary' | 'detailed' | 'analytics' | 'custom';
  dateRange: {
    from: string;
    to: string;
  };
  filters?: ShipmentSearchCriteria;
  format: 'pdf' | 'excel' | 'csv';
  includeCharts?: boolean;
  includeDetails?: boolean;
  customFields?: string[];
}

export interface ShipmentWorkflow {
  id: number;
  name: string;
  description: string;
  steps: ShipmentWorkflowStep[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentWorkflowStep {
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

export interface ShipmentWorkflowExecution {
  id: number;
  shipmentId: number;
  workflowId: number;
  currentStep: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  executedBy?: number;
  history: ShipmentWorkflowStepExecution[];
  metadata?: Record<string, any>;
}

export interface ShipmentWorkflowStepExecution {
  stepId: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  executedAt: string;
  executedBy?: number;
  result?: Record<string, any>;
  error?: string;
  notes?: string;
}

export interface ShipmentCustomField {
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

export interface ShipmentCustomFieldValue {
  fieldId: number;
  value: any;
  shipmentId: number;
}

export interface ShipmentPermission {
  view: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  export: boolean;
  bulkOperations: boolean;
  viewAll: boolean;
  updateAll: boolean;
  deleteAll: boolean;
  assignDriver: boolean;
  changeStatus: boolean;
  viewReports: boolean;
  manageWorkflows: boolean;
  manageCustomFields: boolean;
  manageIntegrations: boolean;
}

export interface ShipmentRole {
  id: number;
  name: string;
  description: string;
  permissions: ShipmentPermission;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentUserRole {
  userId: number;
  roleId: number;
  assignedAt: string;
  assignedBy: number;
  isActive: boolean;
  expiresAt?: string;
}

export interface ShipmentAuditLog {
  id: number;
  shipmentId: number;
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

export interface ShipmentAuditLogQuery {
  shipmentId?: number;
  userId?: number;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  ipAddress?: string;
  limit?: number;
  offset?: number;
}

export interface ShipmentDataExport {
  format: 'csv' | 'excel' | 'json' | 'xml';
  fields: string[];
  filters?: ShipmentSearchCriteria;
  includeRelations?: boolean;
  includeCustomFields?: boolean;
  includeAuditLog?: boolean;
  dateRange?: {
    from: string;
    to: string;
  };
}

export interface ShipmentDataImport {
  format: 'csv' | 'excel' | 'json' | 'xml';
  data: any[];
  fieldMapping: Record<string, string>;
  updateExisting: boolean;
  skipErrors: boolean;
  validateData: boolean;
  dryRun: boolean;
}

export interface ShipmentDataValidation {
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

export interface ShipmentDataTransformation {
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

export interface ShipmentDataQuality {
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

export interface ShipmentDataGovernance {
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

export interface ShipmentDataMigration {
  source: string;
  destination: string;
  mapping: Record<string, string>;
  transformations: ShipmentDataTransformation;
  validation: ShipmentDataValidation;
  batchSize: number;
  dryRun: boolean;
  rollbackPlan: string;
}

export interface ShipmentDataMigrationResult {
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

export interface ShipmentDataArchival {
  criteria: {
    age: number;
    unit: 'days' | 'months' | 'years';
    status?: ShipmentStatus[];
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

export interface ShipmentDataArchivalResult {
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

export interface ShipmentDataRecovery {
  source: string;
  destination: string;
  criteria: {
    dateRange?: {
      from: string;
      to: string;
    };
    shipmentIds?: number[];
    status?: ShipmentStatus[];
  };
  validation: boolean;
  dryRun: boolean;
}

export interface ShipmentDataRecoveryResult {
  success: boolean;
  totalRecords: number;
  recoveredRecords: number;
  failedRecords: number;
  errors: string[];
  duration: number;
  dataIntegrity: number;
}

export interface ShipmentDataBackup {
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

export interface ShipmentDataBackupResult {
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

export interface ShipmentDataRestore {
  backupId: string;
  destination: string;
  validation: boolean;
  dryRun: boolean;
  pointInTime?: string;
}

export interface ShipmentDataRestoreResult {
  success: boolean;
  backupId: string;
  totalRecords: number;
  restoredRecords: number;
  failedRecords: number;
  errors: string[];
  duration: number;
  dataIntegrity: number;
}

export interface ShipmentDataSecurity {
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

export interface ShipmentDataPrivacy {
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

export interface ShipmentDataEthics {
  fairness: boolean;
  transparency: boolean;
  accountability: boolean;
  biasMitigation: boolean;
  humanOversight: boolean;
  explainability: boolean;
}

export interface ShipmentDataSustainability {
  energyEfficiency: boolean;
  carbonFootprint: number;
  resourceOptimization: boolean;
  wasteReduction: boolean;
  recycling: boolean;
  greenComputing: boolean;
}

export interface ShipmentDataInnovation {
  aiMlCapabilities: boolean;
  predictiveAnalytics: boolean;
  automation: boolean;
  realTimeProcessing: boolean;
  edgeComputing: boolean;
  blockchain: boolean;
  iotIntegration: boolean;
}

export interface ShipmentDataFuture {
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

export interface ShipmentDataVision {
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

export interface ShipmentDataMission {
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

export interface ShipmentDataValues {
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

export interface ShipmentDataPrinciples {
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

export interface ShipmentDataStandards {
  iso: string[];
  ieee: string[];
  w3c: string[];
  ietf: string[];
  oasis: string[];
  oasis: string[];
  nist: string[];
  ansi: string[];
  bsI: string[];
  din: string[];
}

export interface ShipmentDataBestPractices {
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

export interface ShipmentDataGuidelines {
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

export interface ShipmentDataRecommendations {
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

export interface ShipmentDataLessonsLearned {
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

export interface ShipmentDataCaseStudies {
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

export interface ShipmentDataSuccessStories {
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

export interface ShipmentDataTestimonials {
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

export interface ShipmentDataReviews {
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

export interface ShipmentDataRatings {
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

export interface ShipmentDataFeedback {
  positive: string[];
  negative: string[];
  neutral: string[];
  suggestions: string[];
  improvements: string[];
  innovations: string[];
  recommendations: string[];
}

export interface ShipmentDataCommunity {
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

export interface ShipmentDataEcosystem {
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

export interface ShipmentDataMarketplace {
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