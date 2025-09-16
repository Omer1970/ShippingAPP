/**
 * Delivery Status Enum
 */
export enum DeliveryStatus {
  CONFIRMED = 'confirmed',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETURNED = 'returned'
}

/**
 * GPS Location Interface
 */
export interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp?: string;
}

/**
 * Digital Signature Interface
 */
export interface DeliverySignature {
  id: number;
  delivery_id: number;
  signature_data: string; // Base64 encoded signature image
  signature_hash: string; // SHA-256 hash for verification
  signature_type: 'touch' | 'stylus';
  signature_strokes?: any[]; // Drawing stroke data
  signature_quality: number; // Quality score 0-1
  canvas_width: number;
  canvas_height: number;
  device_name?: string; // Device identification
  ip_address?: string; // Audit trail
  user_agent?: string; // Device info
  created_at?: string;
  updated_at?: string;
}

/**
 * Delivery Photo Interface
 */
export interface DeliveryPhoto {
  id: number;
  delivery_confirmation_id: number;
  photo_path: string; // Original photo file path
  thumbnail_path?: string; // Thumbnail file path
  photo_type: 'delivery_proof' | 'site_photo' | 'issue_documentation';
  photo_url?: string; // Public URL for original photo
  thumbnail_url?: string; // Public URL for thumbnail
  gps_latitude?: number;
  gps_longitude?: number;
  photo_metadata?: any; // EXIF data, camera info, etc.
  file_size?: number;
  image_dimensions?: {
    width: number;
    height: number;
  };
  has_gps_data?: boolean; // Computed property
  getFileSizeFormatted?: () => string; // Computed property
  created_at?: string;
}

/**
 * User Interface (minimal representation)
 */
export interface DeliveryUser {
  id: number;
  name: string;
  email: string;
}

/**
 * Shipment Interface (minimal representation for delivery context)
 */
export interface DeliveryShipment {
  id: number;
  shipment_number?: string;
  address?: string;
  customer_name?: string;
  planned_date?: string;
  status?: string;
}

/**
 * Delivery Confirmation Interface
 */
export interface DeliveryConfirmation {
  id: number;
  shipment_id: number;
  user_id: number;
  user?: DeliveryUser;
  shipment?: DeliveryShipment;
  delivered_at: string;
  recipient_name: string;
  signature?: DeliverySignature;
  signature_id?: number;
  photos?: DeliveryPhoto[];
  photo_ids?: number[];
  gps_latitude: number;
  gps_longitude: number;
  gps_accuracy: number;
  delivery_notes?: string;
  status: DeliveryStatus;
  synced_to_erp: boolean;
  erp_sync_timestamp?: string;
  verification_hash?: string;
  created_at?: string;
  updated_at?: string;
  // Metadata computed by API
  metadata?: {
    delivery_time_seconds: number;
    signature_confidence: number;
    photo_count: number;
    gps_accuracy_meters: number;
  };
}

/**
 * Delivery Statistics Interface
 */
export interface DeliveryStats {
  total_deliveries: number;
  successful_deliveries: number;
  success_rate: number;
  avg_delivery_time_minutes?: number;
  signature_statistics: {
    total_with_signature: number;
    valid_signatures: number;
    signature_usage_rate: number;
  };
  photo_statistics: {
    total_with_photos: number;
    avg_photos_per_delivery: number;
    photo_usage_rate: number;
  };
}

/**
 * Delivery Confirmation Form Data Interface
 */
export interface DeliveryFormData {
  delivered_at: string; // ISO format
  recipient_name: string;
  delivery_notes?: string;
  gps_latitude: number;
  gps_longitude: number;
  gps_accuracy: number;
  signature_data?: string; // Base64 encoded
  signature_quality?: number;
  canvas_width?: number;
  canvas_height?: number;
  photo_ids?: number[];
}

/**
 * Signature Validation Result Interface
 */
export interface SignatureValidationResult {
  valid: boolean;
  quality: number;
  issues: string[];
  recommendations: string[];
}

/**
 * Photo Upload Options Interface
 */
export interface PhotoUploadOptions {
  photo_type: 'delivery_proof' | 'site_photo' | 'issue_documentation';
  gps_latitude?: number;
  gps_longitude?: number;
  photo_metadata?: any;
}

/**
 * Real-time Delivery Update Interface
 */
export interface DeliveryUpdate {
  type: 'created' | 'updated' | 'completed' | 'failed';
  delivery_id: number;
  shipment_id: number;
  timestamp: string;
  data: Partial<DeliveryConfirmation>;
}

/**
 * Error Interface for Delivery Operations
 */
export interface DeliveryError {
  error: string;
  message: string;
  details?: any;
}