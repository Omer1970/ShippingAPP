import { 
  Component, 
  ElementRef, 
  ViewChild, 
  AfterViewInit, 
  OnDestroy, 
  Input, 
  Output, 
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { PhotoService } from '../../../core/services/photo.service';
import { GeolocationService } from '../../../core/services/geolocation.service';
import { PhotoGalleryItem, PhotoType, CameraConfig, PhotoCaptureResult, PhotoUploadProgress, CameraError, CameraPermissionStatus } from '../../../core/models/photo.model';
import { GPSLocation } from '../../../core/models/delivery.model';

@Component({
  selector: 'app-camera-capture',
  templateUrl: './camera-capture.component.html',
  styleUrls: ['./camera-capture.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressBarModule,
    MatDialogModule,
    MatSlideToggleModule
  ],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CameraCaptureComponent implements AfterViewInit, OnDestroy {
  @ViewChild('cameraVideo', { static: false }) cameraVideo!: ElementRef<HTMLVideoElement>;
  
  @Input() config: Partial<CameraConfig> = {};
  @Input() maxPhotos = 5;
  @Input() allowCamera = true;
  @Input() allowGallery = true;
  @Input() autoUpload = false;
  @Input() uploadUrl?: string;
  @Input() photoType = PhotoType.DELIVERY_PROOF as PhotoType;
  @Input() showGallery = true;
  @Input() showControls = true;
  @Input() enableGPS = true;
  
  @Output() photosSelected = new EventEmitter<File[]>();
  @Output() photoCaptured = new EventEmitter<PhotoCaptureResult>();
  @Output() photoUploaded = new EventEmitter<any>();
  @Output() uploadProgress = new EventEmitter<PhotoUploadProgress>();
  @Output() captureError = new EventEmitter<CameraError>();
  
  // Camera state
  stream: MediaStream | null = null;
  cameraActive = false;
  captureMode: 'camera' | 'gallery' = 'camera';
  currentFacingMode = 'environment'; // 'environment' = back camera, 'user' = front camera
  
  // UI state
  currentPhoto: PhotoCaptureResult | null = null;
  photoGallery: PhotoGalleryItem[] = [];
  isCapturing = false;
  isUploading = false;
  
  // Permissions
  permissions: CameraPermissionStatus = {
    camera: 'prompt',
    location: 'prompt',
    storage: 'prompt'
  };
  hasCameraAccess = false;
  hasLocationAccess = false;
  
  // Location tracking
  currentLocation: GPSLocation | null = null;
  locationTracking = true;
  
  // Configuration
  private cameraConfig: CameraConfig;
  private locationWatchId: number | null = null;
  private uploadSubscriptions: any[] = [];

  constructor(
    private photoService: PhotoService,
    private geolocationService: GeolocationService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog
  ) {
    this.cameraConfig = this.getDefaultConfig();
    this.updateCameraConfig();
  }

  ngAfterViewInit(): void {
    this.checkPermissions();
    this.initializeCamera();
  }

  ngOnDestroy(): void {
    this.stopCamera();
    this.cleanup();
  }

  /**
   * Initialize camera and location services
   */
  private async initializeCamera(): Promise<void> {
    try {
      if (this.allowCamera) {
        await this.checkCameraPermissions();
      }
      
      if (this.enableGPS) {
        await this.startLocationTracking();
      }
      
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Failed to initialize camera services:', error);
      this.handleError({
        type: 'device',
        message: 'Failed to initialize camera services',
        recoverable: true,
        details: error
      });
    }
  }

  /**
   * Check all required permissions
   */
  private async checkPermissions(): Promise<void> {
    try {
      this.permissions = await this.photoService.getCameraPermissions().toPromise() || {
        camera: 'prompt',
        location: 'prompt',
        storage: 'prompt'
      };
      
      this.hasCameraAccess = this.permissions.camera === 'granted';
      this.hasLocationAccess = this.permissions.location === 'granted';
      
      this.cdr.detectChanges();
    } catch (error) {
      console.warn('Permission check failed:', error);
      this.permissions = {
        camera: 'denied',
        location: 'denied',
        storage: 'denied'
      };
    }
  }

  /**
   * Check camera permissions and request if needed
   */
  private async checkCameraPermissions(): Promise<void> {
    if (!this.hasCameraAccess) {
      if (this.permissions.camera === 'denied') {
        this.handleError({
          type: 'permission',
          message: 'Camera access denied. Please enable camera permissions in your browser settings.',
          recoverable: false,
          details: null
        });
        return;
      }
      
      try {
        await this.requestCameraAccess();
      } catch (error) {
        this.handleError({
          type: 'permission',
          message: 'Failed to access camera. Please enable camera permissions.',
          recoverable: true,
          details: error
        });
      }
    }
  }

  /**
   * Request camera access
   */
  private async requestCameraAccess(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: this.currentFacingMode as ConstrainDOMString,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      
      this.stream = stream;
      this.hasCameraAccess = true;
      this.permissions.camera = 'granted';
      
      this.startCameraPreview();
      
    } catch (error) {
      console.error('Camera access denied:', error);
      this.hasCameraAccess = false;
      this.permissions.camera = 'denied';
      throw error;
    }
  }

  /**
   * Start camera preview
   */
  private startCameraPreview(): void {
    if (!this.stream || !this.cameraVideo) return;
    
    const video = this.cameraVideo.nativeElement;
    
    video.srcObject = this.stream;
    video.playsInline = true;
    video.autoplay = true;
    
    video.onloadedmetadata = () => {
      this.cameraActive = true;
      this.cdr.detectChanges();
    };
    
    video.onended = () => {
      this.cameraActive = false;
      this.cdr.detectChanges();
    };
  }

  /**
   * Stop camera preview
   */
  private stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.cameraVideo) {
      this.cameraVideo.nativeElement.srcObject = null;
    }
    
    this.cameraActive = false;
    this.cdr.detectChanges();
  }

  /**
   * Start location tracking
   */
  private async startLocationTracking(): Promise<void> {
    try {
      if (this.permissions.location !== 'denied') {
        const watchId = this.geolocationService.watchLocation(
          (location) => {
            this.currentLocation = location;
            this.cdr.detectChanges();
          },
          (error) => {
            console.warn('Location tracking error:', error);
            this.currentLocation = null;
          },
          {
            enableHighAccuracy: false, // Use standard GPS to save battery
            timeout: 10000,
            maximumAge: 30000
          }
        );
        
        this.locationWatchId = watchId;
        
        // Get initial location
        const initialLocation = await this.geolocationService.getStandardLocation().toPromise();
        this.currentLocation = initialLocation;
        this.hasLocationAccess = true;
        
      } else {
        console.warn('Location permission denied');
        this.hasLocationAccess = false;
      }
      
    } catch (error) {
      console.warn('Failed to start location tracking:', error);
      this.hasLocationAccess = false;
      this.currentLocation = null;
    }
  }

  /**
   * Stop location tracking
   */
  private stopLocationTracking(): void {
    if (this.locationWatchId !== null) {
      this.geolocationService.clearWatch(this.locationWatchId);
      this.locationWatchId = null;
    }
  }

  /**
   * Switch camera (front/back)
   */
  async switchCamera(): Promise<void> {
    if (!this.hasCameraAccess) return;
    
    const newFacingMode = this.currentFacingMode === 'environment' ? 'user' : 'environment';
    
    try {
      this.stopCamera(); 
      this.currentFacingMode = newFacingMode;
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: newFacingMode as ConstrainDOMString,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      
      this.stream = stream;
      this.startCameraPreview();
      
    } catch (error) {
      console.error('Failed to switch camera:', error);
      this.handleError({
        type: 'device',
        message: 'Failed to switch camera. Please close this dialog and try again.',
        recoverable: true,
        details: error
      });
    }
  }

  /**
   * Take photo
   */
  takePhoto(): void {
    if (!this.stream || !this.cameraVideo) return;
    
    this.isCapturing = true;
    this.cdr.detectChanges();
    
    try {
      const video = this.cameraVideo.nativeElement;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('Canvas context not available');
      }
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Add location metadata to the image if available
      if (this.currentLocation && this.enableGPS) {
        this.addLocationOverlay(context, this.currentLocation, canvas.width, canvas.height);
      }
      
      // Convert to file with quality settings
      canvas.toBlob((blob) => {
        this.isCapturing = false;
        
        if (!blob) {
          this.handleError({
            type: 'capture',
            message: 'Failed to create photo blob',
            recoverable: true,
            details: null
          });
          return;
        }
        
        const timestamp = new Date().toISOString();
        const filename = `delivery_photo_${timestamp}.jpg`;
        const file = new File([blob], filename, { type: 'image/jpeg' });
        
        // Process the photo
        this.processCapturedPhoto(file);
        
      }, 'image/jpeg', 0.9);
      
    } catch (error) {
      this.isCapturing = false;
      console.error('Photo capture failed:', error);
      this.handleError({
        type: 'capture',
        message: 'Failed to capture photo',
        recoverable: true,
        details: error
      });
    }
  }

  /**
   * Process captured photo
   */
  private processCapturedPhoto(file: File): void {
    // Get location data for photo processing
    const location = this.currentLocation || undefined;
    
    // Add to gallery
    const galleryItem: PhotoGalleryItem = {
      id: `camera_${Date.now()}`,
      file: file,
      dataUrl: '', // Will be set when read as data URL
      uploadStatus: 'pending',
      timestamp: Date.now()
    };
    
    this.photoGallery.push(galleryItem);
    
    // Read file as data URL for preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      galleryItem.dataUrl = dataUrl;
      this.currentPhoto = {
        file: file,
        dataUrl: dataUrl,
        metadata: {
          width: 1920, // These would be actual image dimensions
          height: 1080,
          size: file.size,
          type: 'image/jpeg',
          lastModified: file.lastModified,
          gps: location ? {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            timestamp: location.timestamp
          } : undefined
        },
        quality: 0.9,
        compressionRatio: 1.0
      };
      
      this.photoCaptured.emit(this.currentPhoto);
      this.cdr.detectChanges();
    };
    
    reader.readAsDataURL(file);
  }

  /**
   * Select photos from gallery
   */
  browseGallery(): void {
    if (!this.allowGallery) return;
    
    this.photoService.selectPhoto({
      multiple: true,
      accept: 'image/*',
      maxFileSize: this.cameraConfig.maxFileSize
    }).subscribe({
      next: (files) => {
        this.processSelectedPhotos(Array.from(files));
        this.captureMode = 'gallery';
      },
      error: (error) => {
        this.handleError({
          type: 'capture',
          message: 'Failed to select photos from gallery',
          recoverable: true,
          details: error
        });
      }
    });
  }

  /**
   * Process selected photos from gallery
   */
  private processSelectedPhotos(files: File[]): void {
    const photos: File[] = [];
    
    files.slice(0, this.maxPhotos - this.photoGallery.length).forEach(file => {
      // Add to gallery
      const galleryItem: PhotoGalleryItem = {
        id: `gallery_${Date.now()}_${Math.random()}`,
        file: file,
        dataUrl: '',
        uploadStatus: 'pending',
        timestamp: Date.now()
      };
      
      this.photoGallery.push(galleryItem);
      
      // Read file as data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        galleryItem.dataUrl = e.target?.result as string;
        this.cdr.detectChanges();
      };
      
      reader.readAsDataURL(file);
      photos.push(file);
    });
    
    this.photosSelected.emit(photos);
  }

  /**
   * Upload photo(s) to server
   */
  uploadPhotos(): void {
    if (this.isUploading) return;
    
    const pendingPhotos = this.photoGallery.filter(photo => photo.uploadStatus === 'pending');
    if (pendingPhotos.length === 0) return;
    
    this.isUploading = true;
    
    // For demo purposes, assuming we have a delivery ID
    const deliveryId = 1; // This would come from delivery confirmation object
    
    pendingPhotos.forEach((galleryItem, index) => {
      galleryItem.uploadStatus = 'uploading';
      
      const location = this.currentLocation ? {
        gps_latitude: this.currentLocation.latitude,
        gps_longitude: this.currentLocation.longitude,
        gps_accuracy: this.currentLocation.accuracy
      } : {};
      
      const subscription = this.photoService.uploadDeliveryPhoto(deliveryId, galleryItem.file, {
        photo_type: this.photoType,
        ...location,
        compress: true,
        create_thumbnail: true
      }).subscribe({
        next: (result) => {
          galleryItem.uploadResult = result;
          galleryItem.uploadStatus = 'completed';
          this.photoUploaded.emit(result);
          this.cdr.detectChanges();
          
          // Complete upload if this was the last photo
          if (index === pendingPhotos.length - 1) {
            this.isUploading = false;
          }
        },
        error: (error) => {
          galleryItem.uploadStatus = 'error';
          galleryItem.error = {
            type: 'upload',
            message: error.message,
            recoverable: true,
            details: error
          };
          this.captureError.emit(galleryItem.error as CameraError);
          this.cdr.detectChanges();
          
          // Still complete upload process
          if (index === pendingPhotos.length - 1) {
            this.isUploading = false;
          }
        }
      });
      
      this.uploadSubscriptions.push(subscription);
    });
  }

  /**
   * Remove photo from gallery
   */
  removePhoto(index: number): void {
    const photo = this.photoGallery[index];
    if (photo.uploadStatus === 'uploading') return;
    
    this.photoGallery.splice(index, 1);
    this.cdr.detectChanges();
  }

  /**
   * Retake photo
   */
  retakePhoto(): void {
    this.currentPhoto = null;
    this.cdr.detectChanges();
  }

  /**
   * Save current photo to gallery
   */
  saveCurrentPhoto(): void {
    if (!this.currentPhoto) return;
    
    // Current photo is already in gallery, just emit it
    this.photosSelected.emit([this.currentPhoto.file]);
    this.retakePhoto();
  }

  /**
   * Toggle location tracking
   */
  toggleLocationTracking(): void {
    this.locationTracking = !this.locationTracking;
    
    if (this.locationTracking) {
      this.startLocationTracking();
    } else {
      this.stopLocationTracking();
      this.currentLocation = null;
    }
    
    this.cdr.detectChanges();
  }

  /**
   * Get status text for upload status
   */
  getStatusText(status: string): string {
    const statusMap = {
      pending: 'Pending',
      uploading: 'Uploading',
      completed: 'Uploaded',
      error: 'Failed'
    };
    return statusMap[status as keyof typeof statusMap] || status;
  }

  /**
   * Preview photo
   */
  previewPhoto(photo: PhotoGalleryItem): void {
    if (!photo.dataUrl) return;
    
    // Simple dialog-based preview
    // In a full implementation, this would open a proper image viewer
    console.log('Previewing photo:', photo.id);
  }

  /**
   * Add location overlay to captured image
  private addLocationOverlay(context: CanvasRenderingContext2D, location: GPSLocation, canvasWidth: number, canvasHeight: number): void {
    // Add subtle location overlay in bottom-right corner
    const overlayX = canvasWidth - 250;
    const overlayY = canvasHeight - 60;
    
    // Semi-transparent background
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(overlayX, overlayY, 240, 50);
    
    // Location text
    context.fillStyle = '#ffffff';
    context.font = '12px Arial';
    context.textAlign = 'left';
    
    context.fillText(`Lat: ${location.latitude.toFixed(6)}, Lng: ${location.longitude.toFixed(6)}`, overlayX + 10, overlayY + 20);
    context.fillText(`Accuracy: ±${location.accuracy.toFixed(1)}m`, overlayX + 10, overlayY + 40);
    context.fillText(`Time: ${new Date().toLocaleTimeString()}`, overlayX + 10, overlayY + 35);
  }

  /**
   * Update camera configuration with input values
   */
  private updateCameraConfig(): void {
    this.cameraConfig = {
      ...this.cameraConfig,
      ...this.config,
      maxPhotos: this.maxPhotos,
      allowCamera: this.allowCamera,
      allowGallery: this.allowGallery,
      photoQuality: this.config.photoQuality || 0.9,
      maxFileSize: this.config.maxFileSize || 5 * 1024 * 1024, // 5MB
      targetWidth: this.config.targetWidth || 1920,
      targetHeight: this.config.targetHeight || 1080,
      enableCompression: this.config.enableCompression !== false,
      enableGPS: this.enableGPS,
      enableMetadata: this.config.enableMetadata !== false,
      autoUpload: this.autoUpload,
      uploadOnCapture: this.config.uploadOnCapture !== false
    };
  }

  /**
   * Get default camera configuration
   */
  private getDefaultConfig(): CameraConfig {
    return {
      maxPhotos: 5,
      allowCamera: true,
      allowGallery: true,
      photoQuality: 0.9,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      targetWidth: 1920,
      targetHeight: 1080,
      enableCompression: true,
      enableGPS: true,
      enableMetadata: true,
      autoUpload: false,
      uploadOnCapture: false
    };
  }

  /**
   * Handle errors
   */
  private handleError(error: CameraError): void {
    console.error('Camera capture error:', error);
    this.captureError.emit(error);
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.stopCamera();
    this.stopLocationTracking();
    
    // Unsubscribe from all upload operations
    this.uploadSubscriptions.forEach(subscription => subscription.unsubscribe());
    this.uploadSubscriptions = [];
  }

  /**
   * Public method to clear all photos
   */
  clearAllPhotos(): void {
    this.photoGallery = [];
    this.currentPhoto = null;
    this.cdr.detectChanges();
  }

  /**
   * Public method to get gallery count
   */
  getGalleryCount(): number {
    return this.photoGallery.length;
  }

  /**
   * Public method to get uploaded photo count
   */
  getUploadedCount(): number {
    return this.photoGallery.filter(p => p.uploadStatus === 'completed').length;
  }