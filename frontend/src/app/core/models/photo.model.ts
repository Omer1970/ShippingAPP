/**
 * Photo Type Enum for delivery documentation
 */
export enum PhotoType {
  DELIVERY_PROOF = 'delivery_proof',
  SITE_PHOTO = 'site_photo',
  ISSUE_DOCUMENTATION = 'issue_documentation'
}

/**
 * Camera Capture Configuration Interface
 */
export interface CameraConfig {
  maxPhotos: number;
  allowGallery: boolean;
  allowCamera: boolean;
  photoQuality: number; // 0-1, affects file size
  maxFileSize: number; // bytes
  targetWidth: number; // pixels
  targetHeight: number; // pixels
  enableCompression: boolean;
  enableGPS: boolean;
  enableMetadata: boolean;
  autoUpload: boolean;
  uploadOnCapture: boolean;
}

/**
 * Photo Capture Result Interface
 */
export interface PhotoCaptureResult {
  file: File;
  dataUrl: string;
  metadata: {
    width: number;
    height: number;
    size: number;
    type: string;
    lastModified: number;
    gps?: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      timestamp?: string;
    };
    exif?: any; // EXIF data if available
  };
  quality: number; // Quality score 0-1
  compressionRatio: number; // Compression applied
}

/**
 * Photo Upload Options Interface
 */
export interface PhotoUploadOptions {
  photo_type: PhotoType;
  gps_latitude?: number;
  gps_longitude?: number;
  gps_accuracy?: number;
  photo_metadata?: any;
  compress?: boolean;
  create_thumbnail?: boolean;
}

/**
 * Photo Upload Progress Interface
 */
export interface PhotoUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  message?: string;
}

/**
 * Photo Upload Result Interface
 */
export interface PhotoUploadResult {
  id: number;
  photo_url: string;
  thumbnail_url?: string;
  photo_type: PhotoType;
  file_size: number;
  image_dimensions: {
    width: number;
    height: number;
  };
  has_gps: boolean;
  upload_time: number;
  metadata?: any;
}

/**
 * Camera Error Interface
 */
export interface CameraError {
  type: 'permission' | 'device' | 'capture' | 'processing' | 'upload' | 'validation';
  message: string;
  code?: string;
  details?: any;
  recoverable: boolean;
}

/**
 * Camera Permission Status Interface
 */
export interface CameraPermissionStatus {
  camera: 'granted' | 'denied' | 'prompt';
  microphone?: 'granted' | 'denied' | 'prompt';
  location?: 'granted' | 'denied' | 'prompt';
  storage?: 'granted' | 'denied' | 'prompt';
}

/**
 * Photo Gallery Item Interface
 */
export interface PhotoGalleryItem {
  id: string;
  file: File;
  dataUrl: string;
  thumbnailUrl?: string;
  metadata: PhotoCaptureResult['metadata'];
  uploadStatus: 'pending' | 'uploading' | 'completed' | 'error';
  uploadProgress?: PhotoUploadProgress;
  uploadResult?: PhotoUploadResult;
  error?: CameraError;
  timestamp: number;
}

/**
 * Photo Processing Options Interface
 */
export interface PhotoProcessingOptions {
  resize?: {
    width: number;
    height: number;
    maintainAspectRatio: boolean;
  };
  compress?: {
    quality: number; // 0-1
    format: 'jpeg' | 'png' | 'webp';
  };
  enhance?: {
    brightness: number; // -1 to 1
    contrast: number; // -1 to 1
    saturation: number; // -1 to 1
    sharpness: number; // 0 to 1
  };
  metadata?: {
    preserveGPS: boolean;
    preserveEXIF: boolean;
    addTimestamp: boolean;
  };
}

/**
 * Batch Upload Configuration Interface
 */
export interface BatchUploadConfig {
  maxConcurrent: number;
  retryAttempts: number;
  retryDelay: number; // milliseconds
  timeout: number; // milliseconds
  onProgress?: (progress: PhotoUploadProgress, item: PhotoGalleryItem) => void;
  onComplete?: (result: PhotoUploadResult, item: PhotoGalleryItem) => void;
  onError?: (error: CameraError, item: PhotoGalleryItem) => void;
}

/**
 * Photo Service Configuration Interface
 */
export interface PhotoServiceConfig {
  apiEndpoint: string;
  maxFileSize: number;
  allowedFormats: string[];
  compressionEnabled: boolean;
  gpsEnabled: boolean;
  metadataEnabled: boolean;
  autoUpload: boolean;
  batchUpload: boolean;
  offlineSupport: boolean;
  storageKey: string;
}