import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { 
  Customer, 
  CustomerListItem, 
  CustomerWithHistory, 
  CustomerDetails,
  CustomerStatistics,
  Order,
  Shipment,
  OrderMeta,
  ShipmentMeta
} from '../models/customer.model';
import { PaginatedResponse } from '../models/pagination.model';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private apiUrl = `${environment.apiUrl}/customers`;
  private currentCustomerSubject = new BehaviorSubject<CustomerWithHistory | null>(null);
  public currentCustomer$ = this.currentCustomerSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Search customers with autocomplete functionality
   */
  searchCustomers(query: string, limit: number = 10, includeSynonyms: boolean = false): Observable<CustomerListItem[]> {
    const params = new HttpParams()
      .set('q', query)
      .set('limit', limit.toString())
      .set('include_synonyms', includeSynonyms.toString());

    return this.http.get<any>(`${this.apiUrl}/search`, { params }).pipe(
      map(response => response.data.customers),
      tap(customers => {
        console.log(`Found ${customers.length} customers for query: ${query}`);
      }),
      catchError(this.handleError<CustomerListItem[]>('searchCustomers', []))
    );
  }

  /**
   * Get autocomplete suggestions
   */
  getAutocompleteSuggestions(query: string): Observable<any> {
    const params = new HttpParams().set('q', query);

    return this.http.get<any>(`${this.apiUrl}/autocomplete`, { params }).pipe(
      map(response => response.data),
      tap(data => {
        console.log(`Autocomplete returned ${data.suggestions.length} suggestions for: ${query}`);
      }),
      catchError(this.handleError<any>('getAutocompleteSuggestions'))
    );
  }

  /**
   * Get customer profile with detailed information
   */
  getCustomerProfile(customerId: number, includeOrders: boolean = false, includeShipments: boolean = false): Observable<CustomerDetails> {
    const params = new HttpParams()
      .set('include_orders', includeOrders.toString())
      .set('include_shipments', includeShipments.toString());

    return this.http.get<any>(`${this.apiUrl}/${customerId}`, { params }).pipe(
      map(response => response.data),
      tap(data => {
        this.currentCustomerSubject.next(data.customer);
        console.log(`Loaded customer profile for ID: ${customerId}`);
      }),
      catchError(this.handleError<CustomerDetails>('getCustomerProfile'))
    );
  }

  /**
   * Get customer orders with pagination
   */
  getCustomerOrders(
    customerId: number, 
    page: number = 1, 
    perPage: number = 20,
    status?: string,
    sort: string = 'date',
    order: string = 'desc'
  ): Observable<PaginatedResponse<Order>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString())
      .set('sort', sort)
      .set('order', order);

    if (status && status !== 'all') {
      params = params.set('status', status);
    }

    return this.http.get<any>(`${this.apiUrl}/${customerId}/orders`, { params }).pipe(
      map(response => response.data),
      tap(data => {
        console.log(`Loaded ${data.orders.length} orders for customer ${customerId}`);
      }),
      catchError(this.handleError<PaginatedResponse<Order>>('getCustomerOrders'))
    );
  }

  /**
   * Get customer shipments with pagination
   */
  getCustomerShipments(
    customerId: number,
    page: number = 1,
    perPage: number = 20,
    status?: string,
    sort: string = 'date',
    order: string = 'desc'
  ): Observable<PaginatedResponse<Shipment>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString())
      .set('sort', sort)
      .set('order', order);

    if (status && status !== 'all') {
      params = params.set('status', status);
    }

    return this.http.get<any>(`${this.apiUrl}/${customerId}/shipments`, { params }).pipe(
      map(response => response.data),
      tap(data => {
        console.log(`Loaded ${data.shipments.length} shipments for customer ${customerId}`);
      }),
      catchError(this.handleError<PaginatedResponse<Shipment>>('getCustomerShipments'))
    );
  }

  /**
   * Get customer statistics and analytics
   */
  getCustomerStats(customerId: number): Observable<{
    stats: CustomerStatistics;
    customer_level: string;
    recommendations: CustomerRecommendation[];
  }> {
    return this.http.get<any>(`${this.apiUrl}/${customerId}/stats`).pipe(
      map(response => response.data),
      tap(data => {
        console.log(`Loaded statistics for customer ${customerId}`);
      }),
      catchError(this.handleError<any>('getCustomerStats'))
    );
  }

  /**
   * Update customer information
   */
  updateCustomer(customerId: number, customerData: Partial<Customer>): Observable<Customer> {
    return this.http.put<any>(`${this.apiUrl}/${customerId}`, customerData).pipe(
      map(response => response.data),
      tap(updatedCustomer => {
        console.log(`Updated customer ${customerId}`);
        // Update current customer if it's the same one
        if (this.currentCustomerSubject.value?.id === customerId) {
          this.currentCustomerSubject.next({
            ...this.currentCustomerSubject.value!,
            ...updatedCustomer
          });
        }
      }),
      catchError(this.handleError<Customer>('updateCustomer'))
    );
  }

  /**
   * Refresh customer data from Dolibarr
   */
  refreshCustomerData(customerId: number): Observable<Customer> {
    return this.http.post<any>(`${this.apiUrl}/${customerId}/refresh`, {}).pipe(
      map(response => response.data),
      tap(refreshedCustomer => {
        console.log(`Refreshed customer data for ID: ${customerId}`);
        // Update current customer if it's the same one
        if (this.currentCustomerSubject.value?.id === customerId) {
          this.currentCustomerSubject.next({
            ...this.currentCustomerSubject.value!,
            ...refreshedCustomer
          });
        }
      }),
      catchError(this.handleError<Customer>('refreshCustomerData'))
    );
  }

  /**
   * Get current customer
   */
  getCurrentCustomer(): CustomerWithHistory | null {
    return this.currentCustomerSubject.value;
  }

  /**
   * Set current customer
   */
  setCurrentCustomer(customer: CustomerWithHistory | null): void {
    this.currentCustomerSubject.next(customer);
  }

  /**
   * Clear current customer
   */
  clearCurrentCustomer(): void {
    this.currentCustomerSubject.next(null);
  }

  /**
   * Handle HTTP errors
   */
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed: ${error.message}`);
      
      // Let the app keep running by returning an empty result
      return throwError(() => error);
    };
  }
}

export interface CustomerRecommendation {
  type: 'retention' | 'loyalty' | 'vip' | 'growth';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  action_url?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
    from: number;
    to: number;
  };
  summary: {
    total_orders?: number;
    active_orders?: number;
    completed_orders?: number;
    total_shipments?: number;
    delivered?: number;
    in_transit?: number;
  };
}