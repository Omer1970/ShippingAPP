import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import {
  DeliveryTimeSlot,
  TimeSlotAvailability,
  BulkTimeSlotUpdate,
  RecurringTimeSlotRequest
} from '../models/schedule.model';
import { ApiResponse } from '../models/api.model';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class TimeSlotService {
  private apiUrl = `${environment.apiUrl}/time-slots`;

  constructor(private http: HttpClient) {}

  /**
   * Get time slots for a specific driver and date range
   */
  getTimeSlotsForDateRange(
    startDate: Date,
    endDate: Date,
    driverIds?: number[]
  ): Observable<DeliveryTimeSlot[]> {
    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];

    const params: any = {
      start_date: formattedStartDate,
      end_date: formattedEndDate
    };

    if (driverIds && driverIds.length > 0) {
      driverIds.forEach(id => params[`driver_ids[]`] = id.toString());
    }

    return this.http.get<ApiResponse>(this.apiUrl, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data.data as DeliveryTimeSlot[];
          }
          return [];
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get time slots for a specific driver
   */
  getTimeSlotsByDriver(
    driverId: number,
    startDate?: Date,
    endDate?: Date,
    availability?: 'available' | 'limited' | 'full' | 'blocked' | 'all'
  ): Observable<DeliveryTimeSlot[]> {
    const params: any = {};

    if (startDate) params.start_date = startDate.toISOString().split('T')[0];
    if (endDate) params.end_date = endDate.toISOString().split('T')[0];
    if (availability && availability !== 'all') params.availability = availability;

    return this.http.get<ApiResponse>(`${this.apiUrl}/${driverId}`, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data.data as DeliveryTimeSlot[];
          }
          return [];
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Create a new time slot
   */
  createTimeSlot(timeSlot: Partial<DeliveryTimeSlot>): Observable<DeliveryTimeSlot> {
    const payload = {
      driver_id: timeSlot.driver_id,
      slot_date: timeSlot.slot_date,
      start_time: timeSlot.start_time,
      end_time: timeSlot.end_time,
      slot_label: timeSlot.slot_label || this.generateSlotLabel(timeSlot.start_time, timeSlot.end_time),
      capacity: timeSlot.capacity || 4,
      availability: timeSlot.availability || 'available',
      is_recurring: timeSlot.is_recurring || false,
      recurrence_pattern: timeSlot.recurrence_pattern
    };

    return this.http.post<ApiResponse>(this.apiUrl, payload)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data.data as DeliveryTimeSlot;
          }
          throw new Error('Failed to create time slot');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Update time slot availability
   */
  updateTimeSlotAvailability(
    slotId: number,
    availability: 'available' | 'limited' | 'full' | 'blocked',
    capacity?: number
  ): Observable<DeliveryTimeSlot> {
    const payload: any = { availability };
    if (capacity !== undefined) payload.capacity = capacity;

    return this.http.put<ApiResponse>(`${this.apiUrl}/${slotId}/availability`, payload)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data.data as DeliveryTimeSlot;
          }
          throw new Error('Failed to update time slot availability');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Book a time slot
   */
  bookTimeSlot(slotId: number): Observable<DeliveryTimeSlot> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/${slotId}/book`, {})
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data.data as DeliveryTimeSlot;
          }
          throw new Error('Failed to book time slot');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Update multiple time slots in bulk
   */
  bulkUpdateTimeSlots(updates: BulkTimeSlotUpdate[]): Observable<DeliveryTimeSlot[]> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/bulk-update`, { updates })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data.data as DeliveryTimeSlot[];
          }
          throw new Error('Failed to bulk update time slots');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Generate recurring time slots
   */
  generateRecurringTimeSlots(request: RecurringTimeSlotRequest): Observable<DeliveryTimeSlot[]> {
    const payload = {
      driver_id: request.driver_id,
      start_date: request.start_date,
      end_date: request.end_date,
      start_time: request.start_time,
      end_time: request.end_time,
      recurrence_pattern: request.recurrence_pattern || 'weekly',
      capacity: request.capacity || 4,
      recurrence_days: request.recurrence_days,
      recurrence_interval: request.recurrence_interval || 1
    };

    return this.http.post<ApiResponse>(`${this.apiUrl}/generate-recurring`, payload)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data.data as DeliveryTimeSlot[];
          }
          throw new Error('Failed to generate recurring time slots');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get time slot configuration for a driver
   */
  getDriverTimeSlotConfig(driverId: number): Observable<any> {
    return this.http.get<ApiResponse>(`${this.apiUrl}/config/${driverId}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error('Failed to get driver time slot configuration');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Configure time slot settings for a driver
   */
  configureTimeSlots(driverId: number, config: {
    default_capacity: number;
    default_start_time: string;
    default_end_time: string;
    availability_rules?: any[];
    recurrence_patterns?: string[];
  }): Observable<any> {
    const payload = { driver_id: driverId, ...config };

    return this.http.post<ApiResponse>(`${this.apiUrl}/config`, payload)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error('Failed to configure time slots');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Check time slot availability
   */
  checkAvailability(
    driverId: number,
    date: Date,
    startTime: string,
    endTime: string
  ): Observable<TimeSlotAvailability> {
    const params = {
      driver_id: driverId.toString(),
      date: date.toISOString().split('T')[0],
      start_time: startTime,
      end_time: endTime
    };

    return this.http.get<ApiResponse>(`${this.apiUrl}/availability/check`, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data as TimeSlotAvailability;
          }
          throw new Error('Failed to check time slot availability');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Generate slot label from start and end time
   */
  private generateSlotLabel(startTime: string, endTime: string): string {
    return `${startTime} - ${endTime}`;
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    if (error.error && error.error.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    console.error('TimeSlotService Error:', errorMessage);
    return throwError(errorMessage);
  }
}