import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import {
  CalendarData,
  DailyOverview,
  DriverAvailability,
  ScheduleConflicts,
  CalendarSummary
} from '../models/schedule.model';
import { ApiResponse } from '../models/api.model';

@Injectable({
  providedIn: 'root'
})
export class CalendarService {
  private apiUrl = `${environment.apiUrl}/calendar`;
  private calendarUpdates$ = new BehaviorSubject<CalendarData[] | null>(null);

  constructor(private http: HttpClient) {}

  /**
   * Get calendar data for a specific date range
   */
  getCalendarData(params: {
    start_date: string;
    end_date: string;
    driver_ids?: number[];
    status?: 'planned' | 'in_progress' | 'completed' | 'cancelled' | 'all';
  }): Observable<CalendarData[]> {
    const queryParams = new URLSearchParams();
    queryParams.append('start_date', params.start_date);
    queryParams.append('end_date', params.end_date);
    if (params.status) queryParams.append('status', params.status);
    if (params.driver_ids) {
      params.driver_ids.forEach(id => queryParams.append('driver_ids[]', id.toString()));
    }

    return this.http.get<ApiResponse>(`${this.apiUrl}?${queryParams}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data.data as CalendarData[];
          }
          return [];
        }),
        tap(calendarData => {
          this.calendarUpdates$.next(calendarData);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get daily overview for dashboard
   */
  getDailyOverview(date: string): Observable<DailyOverview> {
    const params = new URLSearchParams();
    params.append('date', date);

    return this.http.get<ApiResponse>(`${this.apiUrl}/daily-overview?${params}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data as DailyOverview;
          }
          throw new Error(response.message || 'Failed to fetch daily overview');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get weekly calendar view
   */
  getWeeklyCalendar(weekStart: string, driverIds?: number[]): Observable<CalendarData[]> {
    const params = new URLSearchParams();
    params.append('week_start', weekStart);
    if (driverIds) {
      driverIds.forEach(id => params.append('driver_ids[]', id.toString()));
    }

    return this.http.get<ApiResponse>(`${this.apiUrl}/weekly?${params}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data.data as CalendarData[];
          }
          return [];
        }),
        tap(calendarData => {
          this.calendarUpdates$.next(calendarData);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get monthly calendar view
   */
  getMonthlyCalendar(month: string, driverIds?: number[]): Observable<CalendarData[]> {
    const params = new URLSearchParams();
    params.append('month', month);
    if (driverIds) {
      driverIds.forEach(id => params.append('driver_ids[]', id.toString()));
    }

    return this.http.get<ApiResponse>(`${this.apiUrl}/monthly?${params}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data.data as CalendarData[];
          }
          return [];
        }),
        tap(calendarData => {
          this.calendarUpdates$.next(calendarData);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get driver availability for calendar
   */
  getDriverAvailability(driverId: number, startDate: string, endDate: string): Observable<DriverAvailability> {
    const params = new URLSearchParams();
    params.append('driver_id', driverId.toString());
    params.append('start_date', startDate);
    params.append('end_date', endDate);

    return this.http.get<ApiResponse>(`${this.apiUrl}/driver-availability?${params}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data as DriverAvailability;
          }
          throw new Error(response.message || 'Failed to fetch driver availability');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get schedule conflicts for calendar view
   */
  getScheduleConflicts(date: string, driverIds?: number[]): Observable<ScheduleConflicts> {
    const params = new URLSearchParams();
    params.append('date', date);
    if (driverIds) {
      driverIds.forEach(id => params.append('driver_ids[]', id.toString()));
    }

    return this.http.get<ApiResponse>(`${this.apiUrl}/conflicts?${params}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data as ScheduleConflicts;
          }
          throw new Error(response.message || 'Failed to fetch schedule conflicts');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Refresh calendar data
   */
  refreshCalendarData(dateRange: {
    start_date: string;
    end_date: string;
    driver_ids?: number[];
    status?: 'planned' | 'in_progress' | 'completed' | 'cancelled' | 'all';
  }): Observable<CalendarData[]> {
    return this.getCalendarData(dateRange);
  }

  /**
   * Get calendar updates observable
   */
  getCalendarUpdates(): Observable<CalendarData[] | null> {
    return this.calendarUpdates$.asObservable();
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else {
      if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.status === 401) {
        errorMessage = 'Authentication required';
      } else if (error.status === 403) {
        errorMessage = 'Access denied';
      } else if (error.status === 404) {
        errorMessage = 'Calendar data not found';
      } else if (error.status === 409) {
        errorMessage = 'Schedule conflict detected';
      } else if (error.status === 422) {
        errorMessage = 'Validation error';
      } else if (error.status >= 500) {
        errorMessage = 'Server error occurred';
      }
    }

    console.error('CalendarService Error:', error);
    return throwError(() => new Error(errorMessage));
  }
}