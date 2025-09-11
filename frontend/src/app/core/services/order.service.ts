/**
 * Order Service for Story 002 - Basic Order Listing
 * Provides methods for fetching and managing orders from the API
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { 
  Order, 
  OrderListResponse, 
  OrderDetailResponse, 
  OrderFilter, 
  OrderQueryParams
} from '../models/order-simple.model';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = `${environment.apiUrl}/api/orders`;
  
  // State management
  private ordersSubject = new BehaviorSubject<Order[]>([]);
  private currentOrderSubject = new BehaviorSubject<Order | null>(null);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);
  
  // Public observables
  orders$ = this.ordersSubject.asObservable();
  currentOrder$ = this.currentOrderSubject.asObservable();
  loading$ = this.loadingSubject.asObservable();
  error$ = this.errorSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Get paginated list of orders
   */
  getOrders(filter?: OrderFilter): Observable<OrderListResponse> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);
    
    const params = this.buildQueryParams(filter);
    
    return this.http.get<OrderListResponse>(this.apiUrl, { params })
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.ordersSubject.next(response.data.orders);
          }
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Get single order details
   */
  getOrder(id: number): Observable<OrderDetailResponse> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);
    
    return this.http.get<OrderDetailResponse>(`${this.apiUrl}/${id}`)
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.currentOrderSubject.next(response.data.order);
          }
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Get orders for specific customer
   */
  getCustomerOrders(customerId: number, filter?: OrderFilter): Observable<OrderListResponse> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);
    
    const params = this.buildQueryParams(filter);
    
    return this.http.get<OrderListResponse>(`${this.apiUrl}/customer/${customerId}`, { params })
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.ordersSubject.next(response.data.orders);
          }
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Get orders by status
   */
  getOrdersByStatus(status: OrderStatus, filter?: OrderFilter): Observable<OrderListResponse> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);
    
    const params = this.buildQueryParams(filter);
    
    return this.http.get<OrderListResponse>(`${this.apiUrl}/status/${status}`, { params })
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.ordersSubject.next(response.data.orders);
          }
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Refresh order data from server
   */
  refreshOrder(id: number): Observable<OrderDetailResponse> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);
    
    return this.http.post<OrderDetailResponse>(`${this.apiUrl}/${id}/refresh`, {})
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.currentOrderSubject.next(response.data.order);
          }
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Update current order in state
   */
  updateCurrentOrder(order: Order): void {
    this.currentOrderSubject.next(order);
  }

  /**
   * Clear current order from state
   */
  clearCurrentOrder(): void {
    this.currentOrderSubject.next(null);
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.errorSubject.next(null);
  }

  /**
   * Build query parameters from filter
   */
  private buildQueryParams(filter?: OrderFilter): HttpParams {
    let params = new HttpParams();
    
    if (filter) {
      if (filter.page) {
        params = params.set('page', filter.page.toString());
      }
      if (filter.perPage) {
        params = params.set('per_page', filter.perPage.toString());
      }
      if (filter.status) {
        params = params.set('status', filter.status);
      }
    }
    
    return params;
  }

  /**
   * Get order status color
   */
  getOrderStatusColor(status: OrderStatus): string {
    const colors: Record<OrderStatus, string> = {
      draft: 'var(--mat-badge-disabled-color)',
      pending: 'var(--mat-primary-color)',
      processing: 'var(--mat-accent-color)',
      shipped: 'var(--mat-blue-color)',
      delivered: 'var(--mat-green-color)',
      cancelled: 'var(--mat-red-color)',
      unknown: 'var(--mat-grey-color)'
    };
    return colors[status] || colors.unknown;
  }

  /**
   * Get order status icon
   */
  getOrderStatusIcon(status: OrderStatus): string {
    const icons: Record<OrderStatus, string> = {
      draft: 'draft',
      pending: 'schedule',
      processing: 'build',
      shipped: 'local_shipping',
      delivered: 'check_circle_outline',
      cancelled: 'cancel',
      unknown: 'help_outline'
    };
    return icons[status] || icons.unknown;
  }

  /**
   * Get order status badge class
   */
  getOrderStatusBadgeClass(status: OrderStatus): string {
    const classes: Record<OrderStatus, string> = {
      draft: 'badge-draft',
      pending: 'badge-pending',
      processing: 'badge-processing',
      shipped: 'badge-shipped',
      delivered: 'badge-delivered',
      cancelled: 'badge-cancelled',
      unknown: 'badge-unknown'
    };
    return classes[status] || classes.unknown;
  }

  /**
   * Format order date
   */
  formatOrderDate(date: string): string {
    const orderDate = new Date(date);
    const today = new Date();
    const diffTime = orderDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
    
    return orderDate.toLocaleDateString();
  }

  /**
   * Format order amount
   */
  formatOrderAmount(amount: { exclTax: number; inclTax: number; currency: string }): string {
    if (!amount) return '€0.00';
    return `${amount.currency}${amount.inclTax.toFixed(2)}`;
  }

  /**
   * Get order delivery urgency
   */
  getOrderDeliveryUrgency(expectedDelivery?: string): 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'later' {
    if (!expectedDelivery) return 'later';
    
    const today = new Date();
    const deliveryDate = new Date(expectedDelivery);
    const diffTime = deliveryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays <= 7) return 'this_week';
    return 'later';
  }

  /**
   * Get order delivery urgency color
   */
  getOrderDeliveryUrgencyColor(urgency: 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'later'): string {
    const colors = {
      overdue: 'var(--mat-red-color)',
      today: 'var(--mat-orange-color)',
      tomorrow: 'var(--mat-yellow-color)',
      this_week: 'var(--mat-blue-color)',
      later: 'var(--mat-green-color)'
    };
    return colors[urgency];
  }

  /**
   * Get current orders
   */
  getCurrentOrders(): Order[] {
    return this.ordersSubject.value;
  }

  /**
   * Get current order
   */
  getCurrentOrder(): Order | null {
    return this.currentOrderSubject.value;
  }

  /**
   * Check if loading
   */
  isLoading(): boolean {
    return this.loadingSubject.value;
  }

  /**
   * Get current error
   */
  getCurrentError(): string | null {
    return this.errorSubject.value;
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: any): Observable<never> {
    this.loadingSubject.next(false);
    
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = error.error?.message || 'A server error occurred';
    }
    
    this.errorSubject.next(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}