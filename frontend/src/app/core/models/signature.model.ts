/**
 * Signature Type Enum
 */
export enum SignatureType {
  TOUCH = 'touch',
  STYLUS = 'stylus'
}

/**
 * Signature Stroke Data Interface
 * Represents a single drawing stroke/point
 */
export interface SignatureStroke {
  x: number;
  y: number;
  pressure?: number;
  time?: number;
}

/**
 * Signature Path Segment Interface
 * Represents a continuous drawing path
 */
export interface SignaturePath {
  points: SignatureStroke[];
  color: string;
  width: number;
  timestamp: number;
}

/**
 * Signature Validation Data Interface
 */
export interface SignatureValidationData {
  total_strokes: number;
  total_points: number;
  avg_points_per_stroke: number;
  total_distance: number;
  bounding_box: {
    min_x: number;
    min_y: number;
    max_x: number;
    max_y: number;
    center_x: number;
    center_y: number;
  };
  aspect_ratio: number;
  area_covered: number;
  drawing_time: number;
  pressure_range: {
    min: number;
    max: number;
    avg: number;
  };
  velocity_analysis: {
    avg_velocity: number;
    min_velocity: number;
    max_velocity: number;
  };
}

/**
 * Signature Canvas Configuration Interface
 */
export interface SignatureCanvasConfig {
  width: number;
  height: number;
  backgroundColor: string;
  penColor: string;
  penWidth: number;
  minPenWidth: number;
  maxPenWidth: number;
  smoothingFactor: number;
  velocityFilterWeight: number;
  enablePressure: boolean;
  enableVelocity: boolean;
  enableSmoothing: boolean;
}

/**
 * Signature Capture Result Interface
 */
export interface SignatureCaptureResult {
  data: string; // Base64 encoded image data
  quality: number; // Quality score 0-1
  validation: SignatureValidationData;
  metadata: {
    width: number;
    height: number;
    capture_time: number;
    stroke_count: number;
    total_points: number;
    device_type: string;
    touch_points: SignatureStroke[];
    canvas_data: any;
  };
}

/**
 * Signature Validation Result Interface
 */
export interface SignatureValidationResult {
  valid: boolean;
  quality: number;
  score: number; // Detailed quality score
  issues: string[];
  warnings: string[];
  recommendations: string[];
  criteria: {
    coverage_score: number;
    stroke_complexity_score: number;
    pressure_score: number;
    velocity_score: number;
    aspect_ratio_score: number;
    time_score: number;
  };
  summary: {
    confidence: number;
    risk_level: 'low' | 'medium' | 'high';
    quality_tier: 'poor' | 'fair' | 'good' | 'excellent';
  };
}

/**
 * Signature Template Optimization Interface
 */
export interface SignatureTemplate {
  name: string;
  description: string;
  config: SignatureCanvasConfig;
  validation_criteria: {
    min_quality_threshold: number;
    min_coverage_percent: number;
    min_stroke_count: number;
    max_stroke_count: number;
    preferred_aspect_ratio: [number, number];
    min_drawing_time_ms: number;
  };
  guidelines: string[];
  examples: {
    good_signature: string;
    poor_signature: string;
  };
}

/**
 * Real-time Signature Drawing Event Interface
 */
export interface SignatureDrawEvent {
  type: 'start' | 'draw' | 'end';
  point?: SignatureStroke;
  path?: SignaturePath;
  timestamp: number;
  pressure?: number;
  velocity?: number;
}

/**
 * Signature Service Configuration Interface
 */
export interface SignatureServiceConfig {
  apiEndpoint: string;
  validationEnabled: boolean;
  realTimeValidation: boolean;
  qualityThreshold: number;
  canvasTemplatesAvailable: boolean;
  allowTemplateSwitching: boolean;
  maxRetries: number;
  timeout: number;
  storageKey: string;
}