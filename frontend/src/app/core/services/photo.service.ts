import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, forkJoin, from } from 'rxjs';
import { map, catchError, tap, switchMap, scan } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { PhotoUploadOptions, PhotoUploadResult, PhotoUploadProgress, BatchUploadConfig, CameraError, PhotoServiceConfig } from '../models/photo.model';
import { ApiResponse } from '../models/api.model';

@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  private apiUrl = `${environment.apiUrl}/deliveries`;
  private photoGallery$ = new BehaviorSubject<any[]>([]);
  private uploadProgress$ = new BehaviorSubject<PhotoUploadProgress | null>(null);
  
  private config: PhotoServiceConfig = {
    apiEndpoint: this.apiUrl,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedFormats: ['image/jpeg', 'image/png', 'image/jpg'],
    compressionEnabled: true,
    gpsEnabled: true,
    metadataEnabled: true,
    autoUpload: false,
    batchUpload: false,
    offlineSupport: true,
    storageKey: 'shipmentapp_photos'
  };

  constructor(private http: HttpClient) {
    this.loadConfigFromStorage();
  }

  /**
   * Upload delivery photo
   */
  uploadDeliveryPhoto(deliveryId: number, file: File, options: PhotoUploadOptions = {
    photo_type: 'delivery_proof'
  }): Observable<PhotoUploadResult> {
    // First validate the file
    const validation = this.validatePhoto(file);
    if (!validation.valid) {
      return throwError(() => new Error(validation.error));
    }

    return this.processPhoto(file, options).pipe(
      switchMap(processedFile => {
        const formData = new FormData();
        formData.append('photo', processedFile);
        formData.append('photo_type', options.photo_type);
        
        if (options.gps_latitude) formData.append('gps_latitude', options.gps_latitude.toString());
        if (options.gps_longitude) formData.append('gps_longitude', options.gps_longitude.toString());
        if (options.gps_accuracy) formData.append('gps_accuracy', options.gps_accuracy.toString());
        if (options.photo_metadata) formData.append('photo_metadata', JSON.stringify(options.photo_metadata));

        return this.http.post<ApiResponse>(`${this.apiUrl}/${deliveryId}/photo`, formData, {
          reportProgress: true,
          observe: 'events'
        }).pipe(
          tap(event => {
            if (event.type === HttpEventType.UploadProgress) {
              const progress: PhotoUploadProgress = {
                loaded: event.loaded || 0,
                total: event.total || 100,
                percentage: Math.round((event.loaded * 100) / (event.total || 100)),
                status: 'uploading',
                message: `Uploading... ${this.formatBytes(event.loaded || 0)} of ${this.formatBytes(event.total || 0)}`
              };
              this.uploadProgress$.next(progress);
            }
          }),
          map(event => {
            if (event.type === HttpEventType.Response) {
              const response = event.body as ApiResponse;
              if (response.success && response.data?.photo) {
                this.uploadProgress$.next({
                  loaded: 100,
                  total: 100,
                  percentage: 100,
                  status: 'completed',
                  message: 'Upload completed successfully'
                });
                return response.data.photo as PhotoUploadResult;
              }
              throw new Error(response.message || 'Photo upload failed');
            }
            throw new Error('Unexpected response type');
          }),
          catchError(this.handlePhotoUploadError)
        );
      })
    );
  }

  /**
   * Take photo from camera (placeholder for camera integration)
   */
  takePhoto(options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    video?: boolean;
  } = {}): Observable<File> {
    return new Observable(observer => {
      // This would integrate with MediaDevices API
      // For now, we'll simulate camera access
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        observer.error(new Error('Camera not supported'));
        return;
      }

      navigator.mediaDevices.getUserMedia({
        video: options.video !== false,
        audio: false
      })
      .then(stream => {
        try {
          // Simulate photo capture
          // In a real implementation, this would capture from video stream
          this.simulatePhotoCapture(options).subscribe({
            next: (file) => {
              // Stop camera stream
              stream.getTracks().forEach(track => track.stop());
              observer.next(file);
              observer.complete();
            },
            error: (error) => {
              stream.getTracks().forEach(track => track.stop());
              observer.error(error);
            }
          });
        } catch (error) {
          stream.getTracks().forEach(track => track.stop());
          observer.error(error);
        }
      })
      .catch(error => {
        observer.error(new Error(`Camera access denied: ${error.message}`));
      });
    }).pipe(
      catchError(this.handleCameraError)
    );
  }

  /**
   * Select photo from gallery
   */
  selectPhoto(options: {
    multiple?: boolean;
    accept?: string;
    maxFileSize?: number;
  } = {}): Observable<FileList> {
    return new Observable(observer => {
      // Create file input element
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = options.accept || 'image/*';
      input.multiple = options.multiple || false;
      input.style.display = 'none';
      
      document.body.appendChild(input);
      
      // Handle file selection
      const handleChange = (event: Event) => {
        const target = event.target as HTMLInputElement;
        const files = target.files;
        
        if (files && files.length > 0) {
          // Validate all files
          const validFiles: File[] = [];
          const errors: string[] = [];
          
          Array.from(files).forEach(file => {
            const validation = this.validatePhoto(file, options.maxFileSize);
            if (validation.valid) {
              validFiles.push(file);
            } else {
              errors.push(`${file.name}: ${validation.error}`);
            }
          });
          
          if (validFiles.length > 0) {
            // Create new FileList-like object with valid files
            const dataTransfer = new DataTransfer();
            validFiles.forEach(file => dataTransfer.items.add(file));
            observer.next(dataTransfer.files);
          } else {
            observer.error(new Error(errors.join('\n')));
          }
        } else {
          observer.error(new Error('No files selected'));
        }
        
        // Cleanup
        document.body.removeChild(input);
        observer.complete();
      };
      
      input.addEventListener('change', handleChange);
      
      // Trigger click to show file picker
      input.click();
      
      // Cleanup if file picker is canceled
      setTimeout(() => {
        if (document.body.contains(input)) {
          document.body.removeChild(input);
          observer.error(new Error('Selection canceled'));
        }
      }, 1000);
    }).pipe(
      catchError(this.handleSelectionError)
    );
  }

  /**
   * Process photo (resize, compress, etc.)
   */
  processPhoto(file: File, options: PhotoUploadOptions): Observable<File> {
    return new Observable(observer => {
      // Initialize processing pipeline
      from(this.readFileAsDataURL(file))
        .pipe(
          switchMap(dataUrl => this.processImageData(dataUrl, file.type, options)),
          map(processedData => {
            const newFile = this.dataURLToFile(processedData.dataUrl, file.name, file.type);
            return newFile;
          })
        )
        .subscribe({
          next: processedFile => observer.next(processedFile),
          error: error => observer.error(error),
          complete: () => observer.complete()
        });
    }).pipe(
      catchError(this.handleProcessingError)
    );
  }

  /**
   * Batch upload multiple photos
   */
  batchUploadPhotos(deliveryId: number, files: File[], config: BatchUploadConfig = {}): Observable<PhotoUploadProgress[]> {
    const mergedConfig: BatchUploadConfig = {
      maxConcurrent: 3,
      retryAttempts: 2,
      retryDelay: 1000,
      timeout: 30000,
      ...config
    };

    return this.createBatchUploadObservable(files, mergedConfig).pipe(
      scan((uploadResults, result) => {
        const updatedResults = [...uploadResults];
        const index = updatedResults.findIndex(r => r.fileName === result.fileName);
        
        if (index !== -1) {
          updatedResults[index] = result;
        } else {
          updatedResults.push(result);
        }
        
        return updatedResults;
      }, [] as PhotoUploadProgress[]),
      tap(progressResults => {
        // Call progress callbacks
        progressResults.forEach(result => {
          if (mergedConfig.onProgress) {
            mergedConfig.onProgress(result as any, {} as any);
          }
        });
      }),
      catchError(error => {
        console.error('Batch upload error:', error);
        return throwError(() => new Error('Batch upload failed'));
      })
    );
  }

  /**
   * Get camera permissions status
   */
  getCameraPermissions(): Observable<CameraPermissionStatus> {
    return new Observable(observer => {
      this.checkDevicePermissions().then(permissions => {
        observer.next(permissions);
        observer.complete();
      }).catch(error => {
        observer.error(new Error(`Permission check failed: ${error.message}`));
      });
    });
  }

  /**
   * Photo validation
   */
  validatePhoto(file: File, maxSize?: number): { valid: boolean; error?: string } {
    const maxFileSize = maxSize || this.config.maxFileSize;
    
    if (!file) {
      return { valid: false, error: 'Please select a file' };
    }
    
    if (!this.config.allowedFormats.includes(file.type)) {
      return { valid: false, error: `Unsupported file type. Allowed: ${this.config.allowedFormats.join(', ')}` };
    }
    
    if (file.size > maxFileSize) {
      return { valid: false, error: `File too large. Maximum size: ${this.formatBytes(maxFileSize)}` };
    }
    
    return { valid: true };
  }

  /**
   * Get upload progress observable
   */
  getUploadProgress(): Observable<PhotoUploadProgress | null> {
    return this.uploadProgress$.asObservable();
  }

  /**
   * Generate photo thumbnail
   */
  generateThumbnail(photoUrl: string, maxWidth = 150, maxHeight = 150): Observable<string> {
    return new Observable(observer => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            observer.error(new Error('Canvas context not available'));
            return;
          }
          
          // Calculate thumbnail dimensions
          const { width, height } = this.calculateThumbnailDimensions(
            img.width, img.height, maxWidth, maxHeight
          );
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw image
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to data URL
          const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          observer.next(thumbnailDataUrl);
          observer.complete();
          
        } catch (error) {
          observer.error(error);
        }
      };
      
      img.onerror = () => {
        observer.error(new Error('Failed to load image for thumbnail generation'));
      };
      
      // Handle CORS
      if (photoUrl.startsWith('http')) {
        img.crossOrigin = 'anonymous';
      }
      
      img.src = photoUrl;
    });
  }

  // Private helper methods

  private async checkDevicePermissions(): Promise<CameraPermissionStatus> {
    const permissions: CameraPermissionStatus = {
      camera: 'prompt',
      microphone: 'prompt',
      location: 'prompt',
      storage: 'prompt'
    };
    
    if ('permissions' in navigator) {
      const permissionsAPI = navigator.permissions;
      
      try {
        // Check camera permission
        const cameraPermission = await permissionsAPI.query({ name: 'camera'} as any);
        permissions.camera = cameraPermission.state as any;
        
        // Check microphone permission (optional)
        const micPermission = await permissionsAPI.query({ name: 'microphone'} as any);
        permissions.microphone = micPermission.state as any;
        
        // Check geolocation permission
        const geoPermission = await permissionsAPI.query({ name: 'geolocation'} as any);
        permissions.location = geoPermission.state as any;
        
      } catch (error) {
        console.warn('Permission API not fully supported, checking gracefully:', error);
      }
    }
    
    return permissions;
  }

  private readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  private dataURLToFile(dataUrl: string, filename: string, type: string): File {
    const base64Data = dataUrl.split(',')[1];
    const binaryString = atob(base64Data);
    const binaryArray = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      binaryArray[i] = binaryString.charCodeAt(i);
    }
    
    return new File([binaryArray], filename, { type });
  }

  private async processImageData(dataUrl: string, fileType: string, options: PhotoUploadOptions): Promise<{ dataUrl: string; metadata: any }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }
          
          // Set canvas dimensions
          canvas.width = img.width;
          canvas.height = img.height;
          
          // Draw original image
          ctx.drawImage(img, 0, 0);
          
          // Get current timestamp for metadata
          const timestamp = new Date().toISOString();
          
          // Extract EXIF data if available
          const metadata = this.extractImageMetadata(img, dataUrl, timestamp);
          
          // Apply processing options
          if (options.compress) {
            // Reduce quality for JPEG
            canvas.width = Math.min(img.width, 1920); // Max width 1920px
            canvas.height = Math.min(img.height, 1080); // Max height 1080px
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          }
          
          // Convert back to data URL with optimized settings
          const mimeType = fileType === 'image/png' ? 'image/png' : 'image/jpeg';
          const quality = options.compress ? 0.8 : 0.9;
          const newDataUrl = canvas.toDataURL(mimeType, quality);
          
          resolve({
            dataUrl: newDataUrl,
            metadata
          });
          
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = dataUrl;
    });
  }

  private extractImageMetadata(img: HTMLImageElement, dataUrl: string, timestamp: string): any {
    return {
      width: img.width,
      height: img.height,
      size: this.getDataUrlSize(dataUrl),
      type: 'image/jpeg',
      lastModified: new Date(timestamp).getTime(),
      gps: null, // Would extract GPS from EXIF if available
      exif: null, // Would extract full EXIF data
      processedAt: timestamp
    };
  }

  private getDataUrlSize(dataUrl: string): number {
    const base64String = dataUrl.split(',')[1];
    const padding = base64String.length % 4;
    const stringLength = base64String.length + (4 - padding) % 4;
    return Math.ceil(stringLength * 0.75);
  }

  private calculateThumbnailDimensions(originalWidth: number, originalHeight: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
    let width = originalWidth;
    let height = originalHeight;
    
    // Calculate aspect ratio
    const aspectRatio = width / height;
    
    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }
    
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
    
    return { width: Math.round(width), height: Math.round(height) };
  }

  private formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  private simulatePhotoCapture(options: any): Observable<File> {
    // For development - create a sample image
    return new Observable(observer => {
      const canvas = document.createElement('canvas');
      canvas.width = options.maxWidth || 640;
      canvas.height = options.maxHeight || 480;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        observer.error(new Error('Canvas not supported'));
        return;
      }
      
      // Create a simple test pattern
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add some visual elements
      ctx.fillStyle = '#007bff';
      ctx.fillRect(50, 50, canvas.width - 100, canvas.height - 100);
      
      ctx.fillStyle = '#fff';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Sample Photo', canvas.width / 2, canvas.height / 2);
      ctx.fillText(new Date().toLocaleString(), canvas.width / 2, canvas.height / 2 + 30);
      
      // Convert to file
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
          observer.next(file);
          observer.complete();
        } else {
          observer.error(new Error('Failed to create sample photo'));
        }
      }, 'image/jpeg', 0.9);
    });
  }

  private createBatchUploadObservable(files: File[], config: BatchUploadConfig): Observable<any> {
    // This is a placeholder - would implement actual concurrent photo upload logic
    return new Observable(observer => {
      const uploadPromises = files.map(file => this.uploadDeliveryPhoto(1, file)); // deliveryId=1 placeholder
      
      from(uploadPromises).subscribe({
        next: (result) => observer.next({ success: true, result }),
        error: (error) => observer.error(error),
        complete: () => observer.complete()
      });
    });
  }

  private handlePhotoUploadError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'Photo upload failed';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else {
      if (error.status === 401) {
        errorMessage = 'Authentication required';
      } else if (error.status === 403) {
        errorMessage = 'Access denied';
      } else if (error.status === 413) {
        errorMessage = 'File too large';
      } else if (error.status === 415) {
        errorMessage = 'Unsupported file type';
      } else if (error.status === 422) {
        errorMessage = 'Validation failed';
      } else if (error.status >= 500) {
        errorMessage = 'Server error';
      }
    }
    
    console.error('Photo upload error:', error);
    return throwError(() => new Error(errorMessage));
  }

  private handleCameraError = (error: Error): Observable<never> => {
    console.error('Camera access error:', error);
    return throwError(() => new Error(`Camera error: ${error.message}`));
  }

  private handleSelectionError = (error: Error): Observable<never> => {
    console.error('Photo selection error:', error);
    return throwError(() => new Error(`Selection error: ${error.message}`));
  }

  private handleProcessingError = (error: Error): Observable<never> => {
    console.error('Photo processing error:', error);
    return throwError(() => new Error(`Processing error: ${error.message}`));
  }

  private loadConfigFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (stored) {
        const config = JSON.parse(stored);
        this.config = { ...this.config, ...config };
      }
    } catch (error) {
      console.warn('Failed to load photo service config from storage:', error);
    }
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<PhotoServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(this.config));
    } catch (error) {
      console.warn('Failed to save photo service config to storage:', error);
    }
  }

  /**
   * Get current service configuration
   */
  getConfig(): PhotoServiceConfig {
    return { ...this.config };
  }
}