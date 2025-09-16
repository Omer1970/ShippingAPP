import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { DeliveryService } from '../../core/services/delivery.service';
import { SignatureService } from '../../core/services/signature.service';
import { PhotoService } from '../../core/services/photo.service';
import { DeliveryConfirmation, DeliveryStatus } from '../../core/models/delivery.model';
import { SignatureCanvasComponent } from '../../shared/components/signature-canvas/signature-canvas.component';
import { CameraCaptureComponent } from '../../shared/components/camera-capture/camera-capture.component';
import { GeolocationService } from '../../core/services/geolocation.service';
import { WebSocketService, DeliveryUpdateEvent, SignatureProgressEvent } from '../../core/services/websocket.service';
import { OfflineQueueService } from '../../core/services/offline-queue.service';

@Component({
  selector: 'app-delivery-confirmation',
  templateUrl: './delivery-confirmation.component.html',
  styleUrls: ['./delivery-confirmation.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    SignatureCanvasComponent,
    CameraCaptureComponent
  ],
  standalone: true
})
export class DeliveryConfirmationComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  shipmentId!: number;
  delivery: DeliveryConfirmation | null = null;
  isLoading = false;
  isSubmitting = false;
  error: string | null = null;
  success = false;
  
  recipientName = '';
  deliveryNotes = '';
  gpsLocation: { latitude: number; longitude: number; accuracy: number } | null = null;
  
  photos: File[] = [];
  photoUrls: string[] = [];
  isUploadingPhotos = false;
  
  signatureData: string | null = null;
  signatureQuality = 0;
  
  currentStep: 'details' | 'signature' | 'photos' | 'confirm' = 'details';
  steps = [
    { key: 'details', label: 'Delivery Details', icon: 'info' },
    { key: 'signature', label: 'Signature', icon: 'draw' },
    { key: 'photos', label: 'Photos', icon: 'photo_camera' },
    { key: 'confirm', label: 'Confirm', icon: 'check_circle' }
  ];

  // WebSocket and offline state
  isOffline = false;
  isConnected = false;
  signatureProgress = 0;
  signatureStrokeCount = 0;
  isSynced = false;
  syncStatus: 'Pending' | 'Synced' | 'ErpSynced' = 'Pending';
  wsConnectionStatus = { connected: false, subscriptionCount: 0 };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private deliveryService: DeliveryService,
    private signatureService: SignatureService,
    private photoService: PhotoService,
    private geolocationService: GeolocationService,
    private webSocketService: WebSocketService,
    private offlineQueueService: OfflineQueueService
  ) {}

  ngOnInit(): void {
    // Initialize offline status
    this.checkOfflineStatus();

    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.shipmentId = +params['shipmentId'];
        this.loadDeliveryData();

        // Start WebSocket subscriptions
        if (this.shipmentId) {
          this.initializeWebSocketSubscriptions();
        }
      });

    // Monitor connection status
    this.webSocketService.getConnectionStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.wsConnectionStatus = status;
        this.isConnected = status.connected;
      });

    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnlineStatus());
    window.addEventListener('offline', () => this.handleOnlineStatus());

    // Process offline queue when coming back online
    this.processOfflineQueue();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    // Remove event listeners
    window.removeEventListener('online', () => this.handleOnlineStatus());
    window.removeEventListener('offline', () => this.handleOnlineStatus());

    // Unsubscribe from delivery and tracking channels
    if (this.delivery?.id) {
      this.webSocketService.unsubscribeAll();
    }
  }

  /**
   * Initialize WebSocket subscriptions for real-time updates
   */
  private initializeWebSocketSubscriptions(): void {
    // Skip if in development/offline mode
    if (this.isOffline || !this.isConnected) {
      return;
    }

    // Subscribe to delivery updates
    this.webSocketService.subscribeToDeliveryUpdates(this.shipmentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (update: DeliveryUpdateEvent) => {
          this.handleDeliveryUpdate(update);
        },
        error: (error) => {
          console.error('WebSocket delivery update error:', error);
        }
      });

    // Subscribe to shipment tracking if available
    this.webSocketService.subscribeToShipmentTracking(this.shipmentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (locationEvent) => {
          console.log('Delivery location updated:', locationEvent);
          // Could update UI with real-time location if needed
        },
        error: (error) => {
          console.error('WebSocket tracking error:', error);
        }
      });
  }

  /**
   * Handle real-time delivery updates
   */
  private handleDeliveryUpdate(update: DeliveryUpdateEvent): void {
    console.log('Received delivery update:', update);

    // Update sync status
    if (update.synced_to_erp) {
      this.isSynced = true;
      this.syncStatus = 'ErpSynced';
      this.showNotification('Delivery synced to ERP', 'info');
    }

    // Update delivery data if status changed
    if (this.delivery && this.delivery.status !== update.status) {
      this.delivery.status = update.status as DeliveryStatus;
      this.delivery.synced_to_erp = update.synced_to_erp;
      this.delivery.erp_sync_timestamp = update.erp_sync_at;
    }
  }

  /**
   * Check if application is offline
   */
  private checkOfflineStatus(): void {
    this.isOffline = !navigator.onLine;
  }

  /**
   * Handle online/offline status changes
   */
  private handleOnlineStatus(): void {
    this.checkOfflineStatus();
    this.showNotification(
      this.isOffline ? 'You are now offline' : 'Connection restored',
      this.isOffline ? 'warning' : 'success'
    );

    if (!this.isOffline) {
      // Reconnect WebSocket when coming online
      if (!this.isConnected) {
        this.webSocketService.reconnect();
      }
      // Process offline queue
      this.processOfflineQueue();
    }
  }

  /**
   * Process offline queue items
   */
  private processOfflineQueue(): void {
    if (!this.isOffline) {
      this.offlineQueueService.processAllPendingItems().subscribe({
        next: (status) => {
          if (status.pending > 0) {
            this.showNotification(`${status.pending} items queued for sync`, 'info');
          }
        },
        error: (error) => {
          console.error('Failed to process offline queue:', error);
        }
      });
    }
  }

  /**
   * Show notification to user
   */
  private showNotification(message: string, severity: string): void {
    // For now, just log - implement proper notification service integration
    console.log(`[${severity.toUpperCase()}] ${message}`);
  }

  /**
   * Queue delivery confirmation for offline processing
   */
  private queueOfflineDelivery(deliveryData: any): void {
    this.offlineQueueService.queueDeliveryConfirmation(this.shipmentId, deliveryData)
      .subscribe({
        next: (queueId) => {
          this.showNotification('Delivery saved offline and will sync when online', 'info');
          this.completeDelivery();
          console.log('Delivery queued for offline sync:', queueId);
        },
        error: (error) => {
          this.error = 'Failed to queue offline delivery';
          this.isSubmitting = false;
          console.error('Failed to queue offline delivery:', error);
        }
      });
  }

  private loadDeliveryData(): void {
    this.isLoading = true;
    this.deliveryService.getDelivery(this.shipmentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (delivery) => {
          this.delivery = delivery;
          this.isLoading = false;
          if (delivery?.recipient_name) {
            this.recipientName = delivery.recipient_name;
          }
        },
        error: (error) => {
          this.error = error.message || 'Failed to load delivery data';
          this.isLoading = false;
        }
      });
  }

  getCurrentLocation(): void {
    this.isLoading = true;
    this.geolocationService.getCurrentLocation()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (location) => {
          this.gpsLocation = location;
          this.isLoading = false;
        },
        error: (error) => {
          this.error = 'Unable to get GPS location: ' + error.message;
          this.isLoading = false;
        }
      });
  }

  onSignatureComplete(signatureData: { data: string; quality: number }): void {
    this.signatureData = signatureData.data;
    this.signatureQuality = signatureData.quality;

    // Send WebSocket signature progress event if connected
    if (this.delivery?.id && this.isConnected && !this.isOffline) {
      this.webSocketService.sendSignatureProgress(
        this.delivery.id,
        'completed',
        {
          signature_quality: this.signatureQuality,
          is_legally_valid: this.signatureQuality >= 0.7
        }
      ).subscribe({
        error: (error) => console.error('Failed to send signature progress:', error)
      });
    }
  }

  onPhotosSelected(photos: File[]): void {
    this.photos = photos;
    this.photoUrls = [];
  }

  onPhotoUploaded(photoUrl: string): void {
    this.photoUrls.push(photoUrl);
  }

  goToStep(step: 'details' | 'signature' | 'photos' | 'confirm'): void {
    this.currentStep = step;
    this.error = null;
  }

  nextStep(): void {
    const currentIndex = this.steps.findIndex(step => step.key === this.currentStep);
    if (currentIndex < this.steps.length - 1) {
      this.currentStep = this.steps[currentIndex + 1].key as any;
      this.error = null;
    }
  }

  previousStep(): void {
    const currentIndex = this.steps.findIndex(step => step.key === this.currentStep);
    if (currentIndex > 0) {
      this.currentStep = this.steps[currentIndex - 1].key as any;
      this.error = null;
    }
  }

  canProceedToNextStep(): boolean {
    switch (this.currentStep) {
      case 'details':
        return !!this.recipientName.trim() && this.gpsLocation !== null;
      case 'signature':
        return !!this.signatureData && this.signatureQuality >= 0.7;
      case 'photos':
        return true;
      case 'confirm':
        return true;
      default:
        return false;
    }
  }

  submitDeliveryConfirmation(): void {
    if (!this.shipmentId) {
      this.error = 'Invalid shipment ID';
      return;
    }

    this.isSubmitting = true;
    this.error = null;

    const deliveryData = {
      delivered_at: new Date().toISOString(),
      recipient_name: this.recipientName,
      delivery_notes: this.deliveryNotes,
      gps_latitude: this.gpsLocation!.latitude,
      gps_longitude: this.gpsLocation!.longitude,
      gps_accuracy: this.gpsLocation!.accuracy,
      signature_data: this.signatureData,
      signature_quality: this.signatureQuality
    };

    // Check if we're offline
    if (this.isOffline) {
      // Queue for offline processing
      this.queueOfflineDelivery(deliveryData);
      return;
    }

    // Check if there are pending offline queue items to include
    const offlineDeliveryItems = this.offlineQueueService.getDeliveryQueueItems(this.shipmentId);
    if (offlineDeliveryItems.length > 0) {
      console.log('Processing with existing offline items:', offlineDeliveryItems.length);
    }

    this.deliveryService.confirmDelivery(this.shipmentId, deliveryData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Send WebSocket event for successful confirmation
          if (this.isConnected && !this.isOffline) {
            this.webSocketService.sendDeliveryUpdate(
              response.id,
              'delivery.confirmed',
              {
                shipment_id: this.shipmentId,
                has_signature: !!this.signatureData,
                signature_quality: this.signatureQuality,
                photo_count: this.photos.length
              }
            ).subscribe({
              error: (error) => console.error('Failed to send delivery update:', error)
            });
          }

          // Queue photos for upload
          if (this.photos.length > 0) {
            this.uploadPhotos(response.id);
          } else {
            this.completeDelivery();
          }
        },
        error: (error) => {
          this.error = error.message || 'Failed to submit delivery confirmation';

          // If it's a network error, queue for offline processing
          if (error.status === 0 || error.status >= 500) {
            console.log('Network error detected, attempting offline queue...');
            this.queueOfflineDelivery(deliveryData);
          } else {
            this.isSubmitting = false;
          }
        }
      });
  }

  private uploadPhotos(deliveryId: number): void {
    this.isUploadingPhotos = true;

    // If offline, queue photos for offline upload
    if (this.isOffline) {
      this.photos.forEach((photo, index) => {
        this.offlineQueueService.queuePhotoUpload(deliveryId, photo).subscribe({
          next: (queueId) => {
            console.log(`Photo ${index + 1} queued for offline sync:`, queueId);
            // Continue with completion even if photos are queued
            if (index === this.photos.length - 1) {
              this.completeDelivery();
            }
          },
          error: (error) => {
            console.error(`Failed to queue photo ${index + 1}:`, error);
            if (index === this.photos.length - 1) {
              this.error = 'Some photos failed to queue for upload';
              this.isUploadingPhotos = false;
              this.isSubmitting = false;
            }
          }
        });
      });
      return;
    }

    // Online: upload photos normally
    const uploadPromises = this.photos.map(photo =>
      this.photoService.uploadDeliveryPhoto(deliveryId, photo)
    );

    Promise.all(uploadPromises)
      .then(() => {
        this.completeDelivery();
      })
      .catch((error) => {
        this.error = 'Some photos failed to upload: ' + error.message;
        this.isUploadingPhotos = false;
        this.isSubmitting = false;
      });
  }

  private completeDelivery(): void {
    this.success = true;
    this.isSubmitting = false;
    this.isUploadingPhotos = false;
    
    // Navigate to success page or dashboard after delay
    setTimeout(() => {
      this.router.navigate(['/dashboard']);
    }, 3000);
  }

  getStepIcon(stepKey: string): string {
    const step = this.steps.find(s => s.key === stepKey);
    return step ? step.icon : 'check';
  }

  getStepLabel(stepKey: string): string {
    const step = this.steps.find(s => s.key === stepKey);
    return step ? step.label : 'Step';
  }

  isStepCompleted(stepIndex: number): boolean {
    return this.currentStep !== 'details' && stepIndex < this.getCurrentStepIndex();
  }

  isStepActive(stepIndex: number): boolean {
    return this.getCurrentStepIndex() === stepIndex;
  }

  private getCurrentStepIndex(): number {
    return this.steps.findIndex(step => step.key === this.currentStep);
  }
}