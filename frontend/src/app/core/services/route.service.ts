import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import {
  RoutePlan,
  RouteOptimizationRequest,
  RouteWaypoint,
  RouteReorderRequest,
  RouteOptimizationResult,
  AlternativeRoute
} from '../models/schedule.model';
import { ApiResponse } from '../models/api.model';

@Injectable({
  providedIn: 'root'
})
export class RouteService {
  private apiUrl = `${environment.apiUrl}/routes`;

  constructor(private http: HttpClient) {}

  /**
   * Get route plans for a specific date range
   */
  getRoutePlans(startDate: string, endDate: string, driverIds?: number[]): Observable<RoutePlan[]> {
    const params: any = {
      start_date: startDate,
      end_date: endDate
    };

    if (driverIds && driverIds.length > 0) {
      driverIds.forEach(id => params[`driver_ids[]`] = id.toString());
    }

    return this.http.get<ApiResponse>(this.apiUrl, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data.data as RoutePlan[];
          }
          return [];
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get a specific route plan
   */
  getRoutePlan(routeId: number): Observable<RoutePlan> {
    return this.http.get<ApiResponse>(`${this.apiUrl}/${routeId}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data.data as RoutePlan;
          }
          throw new Error('Route plan not found');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get today's route for a driver
   */
  getTodayRoute(driverId: number): Observable<RoutePlan | null> {
    const today = new Date().toISOString().split('T')[0];
    const params = {
      driver_id: driverId.toString(),
      start_date: today,
      end_date: today
    };

    return this.http.get<ApiResponse>(`${this.apiUrl}/today`, { params })
      .pipe(
        map(response => {
          if (response.success && response.data && response.data.data) {
            const routes = response.data.data as RoutePlan[];
            return routes.length > 0 ? routes[0] : null;
          }
          return null;
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Create or optimize a route
   */
  createOptimizedRoute(request: RouteOptimizationRequest): Observable<RouteOptimizationResult> {
    const payload = {
      driver_id: request.driver_id,
      delivery_ids: request.delivery_ids,
      optimization_criteria: request.optimization_criteria || 'time',
      constraints: request.constraints || {max_distance: 100, max_time_hours: 8},
      algorithm: request.algorithm || 'google_maps',
      traffic_model: request.traffic_model || 'best_guess',
      waypoints: request.waypoints
    };

    return this.http.post<ApiResponse>(`${this.apiUrl}/optimize`, payload)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data.data as RouteOptimizationResult;
          }
          throw new Error('Failed to optimize route');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Start a route
   */
  startRoute(routeId: number): Observable<RoutePlan> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/${routeId}/start`, {})
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data.data as RoutePlan;
          }
          throw new Error('Failed to start route');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Complete a route
   */
  completeRoute(routeId: number): Observable<RoutePlan> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/${routeId}/complete`, {})
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data.data as RoutePlan;
          }
          throw new Error('Failed to complete route');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Update route status
   */
  updateRouteStatus(routeId: number, status: 'planned' | 'active' | 'completed' | 'cancelled'): Observable<RoutePlan> {
    return this.http.put<ApiResponse>(`${this.apiUrl}/${routeId}/status`, { status })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data.data as RoutePlan;
          }
          throw new Error('Failed to update route status');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Reorder deliveries in a route
   */
  reorderRouteDeliveries(routeId: number, request: RouteReorderRequest): Observable<RoutePlan> {
    const payload = {
      delivery_order: request.delivery_order,
      optimize_after_reorder: request.optimize_after_reorder,
      reason: request.reason
    };

    return this.http.post<ApiResponse>(`${this.apiUrl}/${routeId}/reorder`, payload)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data.data as RoutePlan;
          }
          throw new Error('Failed to reorder route deliveries');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get route suggestions for a delivery
   */
  getRouteSuggestions(deliveryId: number): Observable<AlternativeRoute[]> {
    return this.http.get<ApiResponse>(`${this.apiUrl}/suggestions/${deliveryId}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data.data as AlternativeRoute[];
          }
          return [];
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get alternative routes
   */
  getAlternativeRoutes(routeId: number): Observable<AlternativeRoute[]> {
    return this.http.get<ApiResponse>(`${this.apiUrl}/${routeId}/alternatives`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data.data as AlternativeRoute[];
          }
          return [];
        }),
        catchError(this.handleError)
      );
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

    console.error('RouteService Error:', errorMessage);
    return throwError(errorMessage);
  }
}