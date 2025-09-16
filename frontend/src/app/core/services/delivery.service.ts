import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { DeliveryConfirmation, DeliveryStatus, DeliveryStats } from '../models/delivery.model';
import { ApiResponse } from '../models/api.model';

@Injectable({
  providedIn: 'root'
})
export class DeliveryService {
  private apiUrl = `${environment.apiUrl}/deliveries`;
  private deliveryUpdates$ = new BehaviorSubject<DeliveryConfirmation | null>(null);

  constructor(private http: HttpClient) {}

  /**
   * Get delivery status for a shipment
   */
  getDelivery(shipmentId: number): Observable<DeliveryConfirmation | null> {
    return this.http.get<ApiResponse>(`${this.apiUrl}/${shipmentId}`)
      .pipe(
        map(response => {
          if (response.success && response.data?.delivery_confirmation) {
            return this.transformDeliveryData(response.data.delivery_confirmation);
          }
          return null;
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Confirm delivery
   */
  confirmDelivery(shipmentId: number, deliveryData: any): Observable<DeliveryConfirmation> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/${shipmentId}/confirm`, deliveryData)
      .pipe(
        map(response => {
          if (response.success && response.data?.delivery_confirmation) {
            const delivery = this.transformDeliveryData(response.data.delivery_confirmation);
            this.deliveryUpdates$.next(delivery);
            return delivery;
          }
          throw new Error(response.message || 'Failed to confirm delivery');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Update delivery status
   */
  updateDeliveryStatus(deliveryId: number, status: DeliveryStatus, notes?: string): Observable<DeliveryConfirmation> {
    return this.http.put<ApiResponse>(`${this.apiUrl}/${deliveryId}/status`, {
      status,
      delivery_notes: notes,
      gps_latitude: null, // Optional: could pass current location
      gps_longitude: null,
      gps_accuracy: null
    }).pipe(
        map(response => {
          if (response.success && response.data?.delivery_confirmation) {
            const delivery = this.transformDeliveryData(response.data.delivery_confirmation);
            this.deliveryUpdates$.next(delivery);
            return delivery;
          }
          throw new Error(response.message || 'Failed to update delivery status');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get user's deliveries
   */
  getUserDeliveries(userId: number, options: {
    page?: number;
    perPage?: number;
    status?: DeliveryStatus;
  } = {}): Observable<{ deliveries: DeliveryConfirmation[]; pagination: any }> {
    const params = new URLSearchParams();
    if (options.page) params.append('page', options.page.toString());
    if (options.perPage) params.append('per_page', options.perPage.toString());
    if (options.status) params.append('status', options.status);

    return this.http.get<ApiResponse>(`${this.apiUrl}/user/${userId}?${params}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return {
              deliveries: response.data.deliveries.map((d: any) => this.transformDeliveryData(d)),
              pagination: response.data.pagination
            };
          }
          throw new Error(response.message || 'Failed to fetch user deliveries');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get delivery statistics
   */
  getDeliveryStats(options: {
    userId?: number;
    dateFrom?: string;
    dateTo?: string;
  } = {}): Observable<DeliveryStats> {
    const params = new URLSearchParams();
    if (options.userId) params.append('user_id', options.userId.toString());
    if (options.dateFrom) params.append('date_from', options.dateFrom);
    if (options.dateTo) params.append('date_to', options.dateTo);

    return this.http.get<ApiResponse>(`${this.apiUrl}?${params}`)
      .pipe(
        map(response => {
          if (response.success && response.data?.statistics) {
            return response.data.statistics as DeliveryStats;
          }
          throw new Error(response.message || 'Failed to fetch delivery statistics');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get delivery updates observable
   */
  getDeliveryUpdates(): Observable<DeliveryConfirmation | null> {
    return this.deliveryUpdates$.asObservable();
  }

  /**
   * Transform API delivery data to DeliveryConfirmation model
   */
  private transformDeliveryData(data: any): DeliveryConfirmation {
    return {
      id: data.id,
      shipment_id: data.shipment_id,
      user_id: data.user_id,
      user: data.user,
      delivered_at: data.delivered_at,
      recipient_name: data.recipient_name,
      signature: data.signature,
      photos: data.photos || [],
      photo_ids: data.photo_ids || [],
      gps_latitude: data.gps_latitude,
      gps_longitude: data.gps_longitude,
      gps_accuracy: data.gps_accuracy,
      delivery_notes: data.delivery_notes,
      status: data.status as DeliveryStatus,
      synced_to_erp: data.synced_to_erp,
      erp_sync_timestamp: data.erp_sync_timestamp,
      verification_hash: data.verification_hash,
      shipment: data.shipment,
      created_at: data.created_at,
      updated_at: data.updated_at,
      // Metadata for display
      metadata: data.metadata || {
        delivery_time_seconds: 0,
        signature_confidence: 0,
        photo_count: data.photos?.length || 0,
        gps_accuracy_meters: data.gps_accuracy || 0
      }
    };
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error
      if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.status === 401) {
        errorMessage = 'Authentication required';
      } else if (error.status === 403) {
        errorMessage = 'Access denied';
      } else if (error.status === 404) {
        errorMessage = 'Delivery not found';
      } else if (error.status === 422) {
        errorMessage = 'Validation error';
      } else if (error.status >= 500) {
        errorMessage = 'Server error occurred';
      }
    }
    
    console.error('DeliveryService Error:', error);
    return throwError(() => new Error(errorMessage));
  }
}