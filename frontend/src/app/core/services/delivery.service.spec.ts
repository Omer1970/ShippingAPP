import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DeliveryService } from './delivery.service';
import { environment } from '../../../environments/environment';

import { 
  DeliveryConfirmation, 
  DeliveryUpdate, 
  SignatureData, 
  PhotoUploadData, 
  DeliveryStats 
} from '../models/delivery.model';

describe('DeliveryService', () => {
  let service: DeliveryService;
  let httpMock: HttpTestingController;
  let baseUrl: string;

  const mockDelivery: DeliveryConfirmation = {
    id: 1,
    shipment_id: 123,
    user_id: 456,
    delivered_at: '2025-09-15T14:30:00Z',
    recipient_name: 'John Customer',
    status: 'delivered',
    gps_latitude: 40.7128,
    gps_longitude: -74.0060,
    gps_accuracy: 5.0,
    synced_to_erp: true,
    erp_sync_timestamp: '2025-09-15T14:31:30Z',
    verification_hash: 'hash123'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DeliveryService]
    });
    
    service = TestBed.inject(DeliveryService);
    httpMock = TestBed.inject(HttpTestingController);
    baseUrl = environment.apiUrl + environment.apiPrefix;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getDeliveryConfirmation', () => {
    it('should retrieve delivery confirmation by shipment ID', () => {
      const shipmentId = 123;

      service.getDeliveryConfirmation(shipmentId).subscribe({
        next: (response) => {
          expect(response.success).toBeTrue();
          expect(response.data.delivery_confirmation.shipment_id).toBe(shipmentId);
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/deliveries/${shipmentId}`);
      expect(req.request.method).toBe('GET');
      
      req.flush({
        success: true,
        data: { delivery_confirmation: mockDelivery }
      });
    });

    it('should handle 404 error when delivery not found', () => {
      const shipmentId = 999;

      service.getDeliveryConfirmation(shipmentId).subscribe({
        next: (response) => {
          expect(response.success).toBeFalse();
          expect(response.message).toContain('not found');
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/deliveries/${shipmentId}`);
      req.flush(
        { success: false, message: 'Delivery confirmation not found' },
        { status: 404, statusText: 'Not Found' }
      );
    });
  });

  describe('confirmDelivery', () => {
    it('should create new delivery confirmation', () => {
      const shipmentId = 123;
      const deliveryData = {
        delivered_at: '2025-09-15T14:30:00Z',
        recipient_name: 'Jane Customer',
        gps_latitude: 40.7128,
        gps_longitude: -74.0060
      };

      service.confirmDelivery(shipmentId, deliveryData).subscribe({
        next: (response) => {
          expect(response.success).toBeTrue();
          expect(response.data.delivery_confirmation.recipient_name).toBe('Jane Customer');
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/deliveries/${shipmentId}/confirm`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(deliveryData);
      
      req.flush({
        success: true,
        data: { delivery_confirmation: mockDelivery },
        message: 'Delivery confirmation created successfully'
      });
    });

    it('should handle validation errors', () => {
      const shipmentId = 123;
      const invalidData = { invalid: 'data' };

      service.confirmDelivery(shipmentId, invalidData).subscribe({
        next: (response) => {
          expect(response.success).toBeFalse();
          expect(response.message).toContain('Validation failed');
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/deliveries/${shipmentId}/confirm`);
      req.flush(
        { success: false, message: 'Validation failed', errors: {} },
        { status: 422, statusText: 'Unprocessable Entity' }
      );
    });
  });

  describe('updateDeliveryStatus', () => {
    it('should update delivery status', () => {
      const deliveryId = 123;
      const statusData = {
        status: 'failed',
        delivery_notes: 'Unable to locate customer'
      };

      service.updateDeliveryStatus(deliveryId, statusData).subscribe({
        next: (response) => {
          expect(response.success).toBeTrue();
          expect(response.data.delivery_confirmation.status).toBe('failed');
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/deliveries/${deliveryId}/status`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(statusData);
      
      req.flush({
        success: true,
        data: {
          delivery_confirmation: { ...mockDelivery, status: 'failed' }
        },
        message: 'Delivery status updated successfully'
      });
    });

    it('should validate status field', () => {
      const deliveryId = 123;
      const invalidStatus = { status: 'invalid_status' };

      service.updateDeliveryStatus(deliveryId, invalidStatus).subscribe({
        next: (response) => {
          expect(response.success).toBeFalse();
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/deliveries/${deliveryId}/status`);
      req.flush(null, { status: 422, statusText: 'Validation Error' });
    });
  });

  describe('uploadDeliveryPhoto', () => {
    it('should upload delivery photo successfully', () => {
      const deliveryId = 123;
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const photoData = {
        photo: file,
        photo_type: 'delivery_proof',
        gps_latitude: 40.7128,
        gps_longitude: -74.0060
      };

      service.uploadDeliveryPhoto(deliveryId, photoData).subscribe({
        next: (response) => {
          expect(response.success).toBeTrue();
          expect(response.data.photo.photo_type).toBe('delivery_proof');
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/deliveries/${deliveryId}/photo`);
      expect(req.request.method).toBe('POST');
      
      req.flush({
        success: true,
        data: {
          photo: {
            id: 1,
            photo_url: '/storage/delivery_photos/123/test.jpg',
            photo_type: 'delivery_proof',
            file_size: 1024
          }
        },
        message: 'Photo uploaded successfully'
      });
    });

    it('should validate file size and type', () => {
      const deliveryId = 123;
      const file = new File(['large content'.repeat(100000)], 'large.jpg', { type: 'image/jpeg' });
      const photoData = { photo: file, photo_type: 'delivery_proof' };

      service.uploadDeliveryPhoto(deliveryId, photoData).subscribe({
        next: (response) => {
          expect(response.success).toBeFalse();
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/deliveries/${deliveryId}/photo`);
      req.flush(
        { success: false, message: 'File too large' },
        { status: 422, statusText: 'Validation Error' }
      );
    });
  });

  describe('deleteDeliveryPhoto', () => {
    it('should delete delivery photo', () => {
      const deliveryId = 123;
      const photoId = 456;

      service.deleteDeliveryPhoto(deliveryId, photoId).subscribe({
        next: (response) => {
          expect(response.success).toBeTrue();
          expect(response.message).toContain('Photo deleted successfully');
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/deliveries/${deliveryId}/photo/${photoId}`);
      expect(req.request.method).toBe('DELETE');
      
      req.flush({
        success: true,
        message: 'Photo deleted successfully'
      });
    });

    it('should handle unauthorized deletion', () => {
      const deliveryId = 123;
      const photoId = 456;

      service.deleteDeliveryPhoto(deliveryId, photoId).subscribe({
        next: (response) => {
          expect(response.success).toBeFalse();
          expect(response.message).toContain('Unauthorized');
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/deliveries/${deliveryId}/photo/${photoId}`);
      req.flush(
        { success: false, message: 'Unauthorized to delete photos' },
        { status: 403, statusText: 'Forbidden' }
      );
    });
  });

  describe('getUserDeliveries', () => {
    it('should retrieve deliveries for authenticated user', () => {
      const userId = 456;
      const page = 1;
      const per_page = 10;

      service.getUserDeliveries(userId, page, per_page).subscribe({
        next: (response) => {
          expect(response.success).toBeTrue();
          expect(response.data.deliveries).toBeDefined();
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/deliveries/user/${userId}?page=${page}&per_page=${per_page}`);
      expect(req.request.method).toBe('GET');
      
      req.flush({
        success: true,
        data: {
          deliveries: {
            data: [mockDelivery],
            current_page: 1,
            last_page: 1,
            per_page: 10,
            total: 1
          }
        }
      });
    });

    it('should filter deliveries by status', () => {
      const userId = 456;
      const status = 'delivered';

      service.getUserDeliveries(userId, 1, 10, status).subscribe({
        next: (response) => {
          expect(response.success).toBeTrue();
          expect(response.data.deliveries.data).toEqual(jasmine.arrayContaining([
            jasmine.objectContaining({ status: 'delivered' })
          ]));
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/deliveries/user/${userId}?status=${status}&page=1&per_page=10`);
      req.flush({
        success: true,
        data: {
          deliveries: {
            data: [{ ...mockDelivery, status: 'delivered' }],
            current_page: 1,
            last_page: 1,
            per_page: 10
          }
        }
      });
    });
  });

  describe('getDeliveryStats', () => {
    it('should retrieve delivery statistics', () => {
      const params = {
        user_id: 456,
        date_from: '2025-09-01',
        date_to: '2025-09-30'
      };

      service.getDeliveryStats(params).subscribe({
        next: (response) => {
          expect(response.success).toBeTrue();
          expect(response.data.statistics).toBeDefined();
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/deliveries/stats?user_id=${params.user_id}&date_from=${params.date_from}&date_to=${params.date_to}`);
      expect(req.request.method).toBe('GET');
      
      req.flush({
        success: true,
        data: {
          statistics: {
            total_deliveries: 10,
            successful_deliveries: 8,
            success_rate: 80.0,
            avg_delivery_time_minutes: 15.5
          }
        }
      });
    });

    it('should handle empty statistics', () => {
      const params = { user_id: 999 };

      service.getDeliveryStats(params).subscribe({
        next: (response) => {
          expect(response.success).toBeTrue();
          expect(response.data.statistics.total_deliveries).toBe(0);
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/deliveries/stats?user_id=${params.user_id}`);
      req.flush({
        success: true,
        data: {
          statistics: {
            total_deliveries: 0,
            successful_deliveries: 0,
            success_rate: 0,
            avg_delivery_time_minutes: null
          }
        }
      });
    });
  });

  describe('generateDeliveryNote', () => {
    it('should generate delivery note PDF', () => {
      const deliveryId = 123;

      service.generateDeliveryNote(deliveryId).subscribe({
        next: (response) => {
          expect(response.success).toBeTrue();
          expect(response.data.delivery_note_url).toContain('.pdf');
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/deliveries/${deliveryId}/note`);
      expect(req.request.method).toBe('GET');
      
      req.flush({
        success: true,
        data: {
          delivery_note_url: '/storage/delivery_notes/123_doc.pdf'
        }
      });
    });
  });

  describe('uploadSignature', () => {
    it('should upload signature data', () => {
      const deliveryId = 123;
      const signatureData: SignatureData = {
        signature_data: 'data:image/png;base64,iVBORw0KGgoAAAANSUg==',
        signature_quality: 0.95,
        signature_type: 'touch',
        canvas_width: 400,
        canvas_height: 200,
        signature_strokes: [{ x: 10, y: 20 }]
      };

      service.uploadSignature(deliveryId, signatureData).subscribe({
        next: (response) => {
          expect(response.success).toBeTrue();
          expect(response.data.signature.signature_quality).toBe(0.95);
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/deliveries/${deliveryId}/signature`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(signatureData);
      
      req.flush({
        success: true,
        data: {
          signature: {
            id: 1,
            signature_quality: 0.95,
            signature_hash: 'hash123'
          }
        },
        message: 'Signature uploaded successfully'
      });
    });
  });

  describe('getSignatureValidation', () => {
    it('should validate signature data', () => {
      const signatureData = 'data:image/png;base64,iVBORw0KGgoAAAANSUg==';

      service.getSignatureValidation(signatureData).subscribe({
        next: (response) => {
          expect(response.success).toBeTrue();
          expect(response.data.valid).toBeTrue();
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/signatures/validate`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ signature_data: signatureData });
      
      req.flush({
        success: true,
        data: {
          valid: true,
          quality_score: 0.95,
          legal_compliance: true
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', () => {
      service.getDeliveryConfirmation(123).subscribe({
        next: () => fail('Should have thrown error'),
        error: (error) => {
          expect(error.status).toBe(500);
          expect(error.statusText).toContain('Server Error');
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/deliveries/123`);
      req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });
    });

    it('should handle timeout errors', () => {
      service.getDeliveryConfirmation(123).subscribe({
        next: () => fail('Should have thrown error'),
        error: (error) => {
          expect(error.name).toBe('TimeoutError');
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/deliveries/123`);
      req.flush(null, { status: 0, statusText: 'Timeout' });
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple concurrent API requests', () => {
      const shipmentIds = [123, 456, 789];
      const results: any[] = [];

      // Make concurrent requests
      Promise.all(
        shipmentIds.map(id => 
          service.getDeliveryConfirmation(id).toPromise().then(result => {
            results.push({ id, result });
          })
        )
      );

      // Verify each request was made
      shipmentIds.forEach(id => {
        const req = httpMock.expectOne(`${baseUrl}/deliveries/${id}`);
        req.flush({ success: true, data: { delivery_confirmation: { ...mockDelivery, id } } });
      });

      expect(results.length).toBe(3);
    });
  });
});