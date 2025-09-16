import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { DeliveryConfirmationComponent } from './delivery-confirmation.component';
import { DeliveryService } from '../../core/services/delivery.service';
import { GeolocationService } from '../../core/services/geolocation.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { OfflineQueueService } from '../../core/services/offline-queue.service';
import { of, throwError, Subject, BehaviorSubject } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';

// Mock Classes
class MockDeliveryService {
  getDeliveryConfirmation = jasmine.createSpy('getDeliveryConfirmation');
  confirmDelivery = jasmine.createSpy('confirmDelivery').and.returnValue(of({ id: 456, status: 'delivered' }));
  getDelivery = jasmine.createSpy('getDelivery').and.returnValue(of({ id: 123, shipment_id: 456, status: 'pending', recipient_name: 'John Doe' }));
  updateDeliveryStatus = jasmine.createSpy('updateDeliveryStatus');
}

class MockGeolocationService {
  getCurrentLocation = jasmine.createSpy('getCurrentLocation').and.returnValue(Promise.resolve({
    latitude: 40.7128,
    longitude: -74.0060,
    accuracy: 10
  }));
  locationUpdate$ = new Subject<any>();
}

class MockWebSocketService {
  subscribeToDeliveryUpdates = jasmine.createSpy('subscribeToDeliveryUpdates').and.returnValue(of({}));
  subscribeToSignatureProgress = jasmine.createSpy('subscribeToSignatureProgress').and.returnValue(of({}));
  subscribeToShipmentTracking = jasmine.createSpy('subscribeToShipmentTracking').and.returnValue(of({}));
  getConnectionStatus = jasmine.createSpy('getConnectionStatus').and.returnValue(of({ connected: true }));
  sendDeliveryUpdate = jasmine.createSpy('sendDeliveryUpdate').and.returnValue(of(true));
  sendSignatureProgress = jasmine.createSpy('sendSignatureProgress').and.returnValue(of(true));
  unsubscribeAll = jasmine.createSpy('unsubscribeAll');
  reconnect = jasmine.createSpy('reconnect');
  disconnect = jasmine.createSpy('disconnect');
  deliveryUpdates$ = new Subject<any>();
  signatureProgress$ = new Subject<any>();
  connectionStatus$ = new BehaviorSubject({ connected: true });
}

class MockOfflineQueueService {
  queueDeliveryConfirmation = jasmine.createSpy('queueDeliveryConfirmation').and.returnValue(of('queue-id'));
  queuePhotoUpload = jasmine.createSpy('queuePhotoUpload').and.returnValue(of('photo-queue-id'));
  processAllPendingItems = jasmine.createSpy('processAllPendingItems').and.returnValue(of({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    expired: 0
  }));
  getDeliveryQueueItems = jasmine.createSpy('getDeliveryQueueItems').and.returnValue([]);
}

class MockActivatedRoute {
  params = of({ shipmentId: '123' });
  snapshot = { params: { shipmentId: '123' } };
}

describe('DeliveryConfirmationComponent', () => {
  let component: DeliveryConfirmationComponent;
  let fixture: ComponentFixture<DeliveryConfirmationComponent>;
  let deliveryService: MockDeliveryService;
  let geolocationService: MockGeolocationService;
  let webSocketService: MockWebSocketService;
  let offlineQueueService: MockOfflineQueueService;

  beforeEach(async () => {
    deliveryService = new MockDeliveryService();
    geolocationService = new MockGeolocationService();
    webSocketService = new MockWebSocketService();
    offlineQueueService = new MockOfflineQueueService();

    await TestBed.configureTestingModule({
      imports: [
        DeliveryConfirmationComponent,
        HttpClientTestingModule
      ],
      providers: [
        { provide: DeliveryService, useValue: deliveryService },
        { provide: GeolocationService, useValue: geolocationService },
        { provide: WebSocketService, useValue: webSocketService },
        { provide: OfflineQueueService, useValue: offlineQueueService },
        { provide: ActivatedRoute, useValue: new MockActivatedRoute() }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DeliveryConfirmationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Component Initialization', () => {
    it('should load delivery confirmation on init', () => {
      const mockDelivery = {
        id: 123,
        shipment_id: 456,
        status: 'pending',
        recipient_name: 'John Doe'
      };
      deliveryService.getDelivery.and.returnValue(of(mockDelivery));

      // Simulate component initialization
      component.ngOnInit();

      expect(deliveryService.getDelivery).toHaveBeenCalledWith(123);
    });

    it('should initialize with correct default values', () => {
      expect(component.currentStep).toBe('details');
      expect(component.isOffline).toBe(false);
      expect(component.isSubmitting).toBe(false);
      expect(component.isLoading).toBe(false);
    });

    it('should check offline status on init', () => {
      component.ngOnInit();

      expect(component.isOffline).toBe(navigator.onLine === false);
    });

    it('should subscribe to WebSocket connection status', () => {
      component.ngOnInit();

      expect(webSocketService.getConnectionStatus).toHaveBeenCalled();
    });
  });

  describe('Location Tracking', () => {
    it('should get current location', fakeAsync(() => {
      const mockLocation = {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10
      };
      geolocationService.getCurrentLocation.and.returnValue(Promise.resolve(mockLocation));

      component.getCurrentLocation();
      tick();

      expect(geolocationService.getCurrentLocation).toHaveBeenCalled();
      expect(component.gpsLocation).toEqual(mockLocation);
      expect(component.isLoading).toBe(false);
    }));

    it('should handle location capture failure', fakeAsync(() => {
      geolocationService.getCurrentLocation.and.returnValue(Promise.reject(new Error('GPS unavailable')));

      component.getCurrentLocation();
      tick();

      expect(component.error).toContain('GPS unavailable');
      expect(component.gpsLocation).toBe(null);
      expect(component.isLoading).toBe(false);
    }));
  });

  describe('Step Navigation', () => {
    it('should handle step navigation', () => {
      component.goToStep('signature');
      expect(component.currentStep).toBe('signature');
      expect(component.error).toBeNull();

      component.nextStep();
      expect(component.currentStep).toBe('photos');

      component.previousStep();
      expect(component.currentStep).toBe('signature');
    });

    it('should validate step progression for details step', () => {
      component.currentStep = 'details';
      component.recipientName = 'John Doe';
      component.gpsLocation = { latitude: 40.7128, longitude: -74.0060, accuracy: 10 };

      expect(component.canProceedToNextStep()).toBeTrue();

      component.recipientName = '';
      expect(component.canProceedToNextStep()).toBeFalse();

      component.recipientName = 'John Doe';
      component.gpsLocation = null;
      expect(component.canProceedToNextStep()).toBeFalse();
    });

    it('should validate step progression for signature step', () => {
      component.currentStep = 'signature';
      component.signatureData = 'base64data';
      component.signatureQuality = 0.8;

      expect(component.canProceedToNextStep()).toBeTrue();

      // Test with insufficient quality
      component.signatureQuality = 0.5;
      expect(component.canProceedToNextStep()).toBeFalse();

      // Test with no signature data
      component.signatureData = null;
      component.signatureQuality = 0.8;
      expect(component.canProceedToNextStep()).toBeFalse();
    });
  });

  describe('Delivery Submission', () => {
    beforeEach(() => {
      // Setup valid form data
      component.shipmentId = 123;
      component.recipientName = 'John Doe';
      component.deliveryNotes = 'Delivered to front door';
      component.gpsLocation = { latitude: 40.7128, longitude: -74.0060, accuracy: 10 };
      component.signatureData = 'base64data';
      component.signatureQuality = 0.9;
    });

    it('should successfully submit delivery confirmation', fakeAsync(() => {
      component.ngOnInit();
      component.submitDeliveryConfirmation();
      tick();

      expect(deliveryService.confirmDelivery).toHaveBeenCalledWith(123, jasmine.objectContaining({
        delivered_at: jasmine.any(String),
        recipient_name: 'John Doe',
        delivery_notes: 'Delivered to front door',
        gps_latitude: 40.7128,
        gps_longitude: -74.0060,
        gps_accuracy: 10,
        signature_data: 'base64data',
        signature_quality: 0.9
      }));
      expect(webSocketService.sendDeliveryUpdate).toHaveBeenCalled();
    }));

    it('should handle offline delivery submission', fakeAsync(() => {
      component.isOffline = true;
      component.ngOnInit();
      component.submitDeliveryConfirmation();
      tick();

      expect(offlineQueueService.queueDeliveryConfirmation).toHaveBeenCalled();
      expect(component.success).toBeFalse(); // Since photos are not uploaded, success stays false
      expect(component.isSubmitting).toBeFalsy();
    }));

    it('should handle submission errors', fakeAsync(() => {
      const networkError = { status: 0, message: 'Network error' };
      deliveryService.confirmDelivery.and.returnValue(throwError(networkError));
      component.isOffline = false;
      component.ngOnInit();

      component.submitDeliveryConfirmation();
      tick();

      expect(component.error).toContain('Failed to submit delivery');
      expect(component.isSubmitting).toBeFalse();
    }));
  });

  describe('WebSocket Integration', () => {
    it('should handle delivery status updates from WebSocket', () => {
      const updateEvent = {
        delivery_id: 123,
        shipment_id: 456,
        status: 'delivered',
        synced_to_erp: true,
        erp_sync_at: new Date().toISOString()
      };

      component.shipmentId = 123;
      component.delivery = {
        id: 456,
        shipment_id: 123,
        status: 'pending' as any,
        synced_to_erp: false
      } as any;

      // Simulate WebSocket update
      component['handleDeliveryUpdate'](updateEvent);

      expect(component.isSynced).toBeTrue();
      expect(component.syncStatus).toBe('ErpSynced');
      expect(component.delivery!.synced_to_erp).toBeTrue();
      expect(component.delivery!.status).toBe('delivered' as any);
    });

    it('should not process WebSocket updates when offline', () => {
      component.isOffline = true;
      component.isConnected = false;

      // Initialize WebSocket subscriptions (should skip when offline)
      component['initializeWebSocketSubscriptions']();

      expect(webSocketService.subscribeToDeliveryUpdates).not.toHaveBeenCalled();
      expect(webSocketService.subscribeToShipmentTracking).not.toHaveBeenCalled();
    });
  });

  describe('Component Lifecycle', () => {
    it('should clean up subscriptions on destroy', () => {
      spyOn(component.destroy$, 'next');
      spyOn(component.destroy$, 'complete');

      component.ngOnDestroy();

      expect(component.destroy$.next).toHaveBeenCalled();
      expect(component.destroy$.complete).toHaveBeenCalled();
    });

    it('should unsubscribe WebSocket channels on destroy', () => {
      component.delivery = { id: 123 } as any;
      component.isConnected = true;

      component.ngOnDestroy();

      expect(webSocketService.unsubscribeAll).toHaveBeenCalled();
    });
  });

  describe('Offline Queue Management', () => {
    it('should process offline queue when coming back online', fakeAsync(() => {
      component.isOffline = false; // Simulate online

      component['processOfflineQueue']();
      tick();

      expect(offlineQueueService.processAllPendingItems).toHaveBeenCalled();
    }));

    it('should send WebSocket events when online and connected', fakeAsync(() => {
      component.isConnected = true;
      component.isOffline = false;
      component.shipmentId = 123;

      component.ngOnInit();
      component.submitDeliveryConfirmation();
      tick();

      expect(webSocketService.sendDeliveryUpdate).toHaveBeenCalled();
    }));
  });
});