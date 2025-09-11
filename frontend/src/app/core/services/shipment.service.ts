import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { 
  Shipment, 
  ShipmentListResponse, 
  ShipmentDetailResponse, 
  ShipmentFilter, 
  ShipmentQueryParams,
  ShipmentStats,
  ShipmentStatus,
  ShipmentSummary,
  ShipmentSearchCriteria
} from '../models/shipment.model';

@Injectable({
  providedIn: 'root'
})
export class ShipmentService {
  private apiUrl = `${environment.apiUrl}/api/shipments`;
  
  // State management
  private shipmentsSubject = new BehaviorSubject<Shipment[]>([]);
  private currentShipmentSubject = new BehaviorSubject<Shipment | null>(null);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);
  
  // Public observables
  shipments$ = this.shipmentsSubject.asObservable();
  currentShipment$ = this.currentShipmentSubject.asObservable();
  loading$ = this.loadingSubject.asObservable();
  error$ = this.errorSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Get paginated list of shipments
   */
  getShipments(filter?: ShipmentFilter): Observable<ShipmentListResponse> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);
    
    const params = this.buildQueryParams(filter);
    
    return this.http.get<ShipmentListResponse>(this.apiUrl, { params })
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.shipmentsSubject.next(response.data.shipments);
          }
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Get single shipment details
   */
  getShipment(id: number): Observable<ShipmentDetailResponse> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);
    
    return this.http.get<ShipmentDetailResponse>(`${this.apiUrl}/${id}`)
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.currentShipmentSubject.next(response.data.shipment);
          }
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Get shipments assigned to current user (driver)
   */
  getMyShipments(filter?: ShipmentFilter): Observable<ShipmentListResponse> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);
    
    const params = this.buildQueryParams(filter);
    
    return this.http.get<ShipmentListResponse>(`${this.apiUrl}/my/shipments`, { params })
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.shipmentsSubject.next(response.data.shipments);
          }
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Get shipments by status
   */
  getShipmentsByStatus(status: ShipmentStatus, filter?: ShipmentFilter): Observable<ShipmentListResponse> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);
    
    const params = this.buildQueryParams(filter);
    
    return this.http.get<ShipmentListResponse>(`${this.apiUrl}/status/${status}`, { params })
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.shipmentsSubject.next(response.data.shipments);
          }
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Refresh shipment data from server
   */
  refreshShipment(id: number): Observable<ShipmentDetailResponse> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);
    
    return this.http.post<ShipmentDetailResponse>(`${this.apiUrl}/${id}/refresh`, {})
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.currentShipmentSubject.next(response.data.shipment);
          }
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Search shipments with advanced criteria
   */
  searchShipments(criteria: ShipmentSearchCriteria): Observable<ShipmentListResponse> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);
    
    const params = new HttpParams({ fromObject: criteria as any });
    
    return this.http.get<ShipmentListResponse>(`${this.apiUrl}/search`, { params })
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.shipmentsSubject.next(response.data.shipments);
          }
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Get shipment statistics
   */
  getShipmentStats(): Observable<ShipmentStats> {
    // For now, we'll calculate stats locally from current shipments
    // In a real implementation, this would be a separate API endpoint
    return this.shipments$.pipe(
      map(shipments => {
        const stats: ShipmentStats = {
          totalShipments: shipments.length,
          shipmentsByStatus: this.calculateShipmentsByStatus(shipments),
          recentShipments: this.countRecentShipments(shipments)
        };
        return stats;
      })
    );
  }

  /**
   * Update current shipment in state
   */
  updateCurrentShipment(shipment: Shipment): void {
    this.currentShipmentSubject.next(shipment);
  }

  /**
   * Clear current shipment from state
   */
  clearCurrentShipment(): void {
    this.currentShipmentSubject.next(null);
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
  private buildQueryParams(filter?: ShipmentFilter): HttpParams {
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
   * Calculate shipments grouped by status
   */
  private calculateShipmentsByStatus(shipments: Shipment[]): ShipmentStatusCount[] {
    const statusCounts: Record<ShipmentStatus, number> = {} as Record<ShipmentStatus, number>;
    
    // Initialize all statuses with 0
    const allStatuses: ShipmentStatus[] = ['draft', 'validated', 'in_transit', 'delivered', 'cancelled', 'unknown'];
    allStatuses.forEach(status => {
      statusCounts[status] = 0;
    });
    
    // Count shipments by status
    shipments.forEach(shipment => {
      statusCounts[shipment.status] = (statusCounts[shipment.status] || 0) + 1;
    });
    
    // Convert to array format
    return Object.entries(statusCounts).map(([status, count]) => ({
      status: status as ShipmentStatus,
      count,
      label: this.getStatusLabel(status as ShipmentStatus),
      color: this.getStatusColor(status as ShipmentStatus)
    }));
  }

  /**
   * Count recent shipments (last 7 days)
   */
  private countRecentShipments(shipments: Shipment[]): number {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    return shipments.filter(shipment => {
      const createdDate = new Date(shipment.createdAt);
      return createdDate >= sevenDaysAgo;
    }).length;
  }

  /**
   * Get status label
   */
  private getStatusLabel(status: ShipmentStatus): string {
    const labels: Record<ShipmentStatus, string> = {
      draft: 'Draft',
      validated: 'Validated',
      'in_transit': 'In Transit',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      unknown: 'Unknown'
    };
    return labels[status] || status;
  }

  /**
   * Get status color
   */
  private getStatusColor(status: ShipmentStatus): string {
    const colors: Record<ShipmentStatus, string> = {
      draft: '#9E9E9E',
      validated: '#2196F3',
      'in_transit': '#FF9800',
      delivered: '#4CAF50',
      cancelled: '#F44336',
      unknown: '#757575'
    };
    return colors[status] || '#757575';
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
      if (error.status === 401) {
        errorMessage = 'Authentication required';
      } else if (error.status === 403) {
        errorMessage = 'Access denied';
      } else if (error.status === 404) {
        errorMessage = 'Resource not found';
      } else if (error.status === 429) {
        errorMessage = 'Too many requests';
      } else if (error.status >= 500) {
        errorMessage = 'Server error';
      } else if (error.error?.message) {
        errorMessage = error.error.message;
      }
    }
    
    this.errorSubject.next(errorMessage);
    return throwError(() => errorMessage);
  }

  /**
   * Get shipment by ID from current state
   */
  getShipmentFromState(id: number): Shipment | undefined {
    const shipments = this.shipmentsSubject.value;
    return shipments.find(shipment => shipment.id === id);
  }

  /**
   * Update shipment in state
   */
  updateShipmentInState(updatedShipment: Shipment): void {
    const shipments = this.shipmentsSubject.value;
    const index = shipments.findIndex(s => s.id === updatedShipment.id);
    
    if (index !== -1) {
      shipments[index] = updatedShipment;
      this.shipmentsSubject.next([...shipments]);
    }
  }

  /**
   * Remove shipment from state
   */
  removeShipmentFromState(id: number): void {
    const shipments = this.shipmentsSubject.value;
    const filteredShipments = shipments.filter(s => s.id !== id);
    this.shipmentsSubject.next(filteredShipments);
  }

  /**
   * Add shipment to state
   */
  addShipmentToState(shipment: Shipment): void {
    const shipments = this.shipmentsSubject.value;
    this.shipmentsSubject.next([shipment, ...shipments]);
  }

  /**
   * Get current shipments
   */
  getCurrentShipments(): Shipment[] {
    return this.shipmentsSubject.value;
  }

  /**
   * Get current shipment
   */
  getCurrentShipment(): Shipment | null {
    return this.currentShipmentSubject.value;
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
   * Get shipment status options
   */
  getShipmentStatusOptions(): Array<{ value: ShipmentStatus; label: string }> {
    return [
      { value: 'draft', label: 'Draft' },
      { value: 'validated', label: 'Validated' },
      { value: 'in_transit', label: 'In Transit' },
      { value: 'delivered', label: 'Delivered' },
      { value: 'cancelled', label: 'Cancelled' }
    ];
  }

  /**
   * Get shipment status color
   */
  getShipmentStatusColor(status: ShipmentStatus): string {
    const colors: Record<ShipmentStatus, string> = {
      draft: 'var(--mat-badge-disabled-color)',
      validated: 'var(--mat-primary-color)',
      'in_transit': 'var(--mat-accent-color)',
      delivered: 'var(--mat-green-color)',
      cancelled: 'var(--mat-red-color)',
      unknown: 'var(--mat-grey-color)'
    };
    return colors[status] || colors.unknown;
  }

  /**
   * Get shipment status icon
   */
  getShipmentStatusIcon(status: ShipmentStatus): string {
    const icons: Record<ShipmentStatus, string> = {
      draft: 'draft',
      validated: 'check_circle',
      'in_transit': 'local_shipping',
      delivered: 'check_circle_outline',
      cancelled: 'cancel',
      unknown: 'help_outline'
    };
    return icons[status] || icons.unknown;
  }

  /**
   * Get shipment status badge class
   */
  getShipmentStatusBadgeClass(status: ShipmentStatus): string {
    const classes: Record<ShipmentStatus, string> = {
      draft: 'badge-draft',
      validated: 'badge-validated',
      'in_transit': 'badge-in-transit',
      delivered: 'badge-delivered',
      cancelled: 'badge-cancelled',
      unknown: 'badge-unknown'
    };
    return classes[status] || classes.unknown;
  }

  /**
   * Get shipment priority color
   */
  getShipmentPriorityColor(priority: 'low' | 'medium' | 'high' | 'urgent'): string {
    const colors = {
      low: 'var(--mat-green-color)',
      medium: 'var(--mat-yellow-color)',
      high: 'var(--mat-orange-color)',
      urgent: 'var(--mat-red-color)'
    };
    return colors[priority];
  }

  /**
   * Get shipment priority icon
   */
  getShipmentPriorityIcon(priority: 'low' | 'medium' | 'high' | 'urgent'): string {
    const icons = {
      low: 'low_priority',
      medium: 'remove',
      high: 'priority_high',
      urgent: 'error_outline'
    };
    return icons[priority];
  }

  /**
   * Get shipment delivery urgency
   */
  getShipmentDeliveryUrgency(expectedDelivery?: string): 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'later' {
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
   * Get shipment delivery urgency color
   */
  getShipmentDeliveryUrgencyColor(urgency: 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'later'): string {
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
   * Format shipment weight
   */
  formatShipmentWeight(weight?: number, units?: number): string {
    if (!weight) return 'N/A';
    
    // Convert to appropriate units based on weight_units value
    // 0 = kg, -3 = g, 3 = t, etc.
    let convertedWeight = weight;
    let unit = 'kg';
    
    if (units === -3) {
      convertedWeight = weight * 1000; // Convert kg to g
      unit = 'g';
    } else if (units === 3) {
      convertedWeight = weight / 1000; // Convert kg to t
      unit = 't';
    }
    
    return `${convertedWeight.toFixed(1)} ${unit}`;
  }

  /**
   * Format shipment date
   */
  formatShipmentDate(date: string): string {
    const shipmentDate = new Date(date);
    const today = new Date();
    const diffTime = shipmentDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
    
    return shipmentDate.toLocaleDateString();
  }

  /**
   * Get shipment timeline
   */
  getShipmentTimeline(shipment: Shipment): Array<{ date: string; event: string; status: ShipmentStatus }> {
    const timeline = [];
    
    timeline.push({
      date: shipment.createdAt,
      event: 'Shipment created',
      status: 'draft'
    });
    
    if (shipment.status !== 'draft') {
      timeline.push({
        date: shipment.createdAt, // In real app, would have validation date
        event: 'Shipment validated',
        status: 'validated'
      });
    }
    
    if (shipment.status === 'in_transit') {
      timeline.push({
        date: new Date().toISOString(), // In real app, would have actual shipping date
        event: 'Shipment in transit',
        status: 'in_transit'
      });
    }
    
    if (shipment.status === 'delivered') {
      timeline.push({
        date: shipment.expectedDelivery || new Date().toISOString(),
        event: 'Shipment delivered',
        status: 'delivered'
      });
    }
    
    if (shipment.status === 'cancelled') {
      timeline.push({
        date: new Date().toISOString(), // In real app, would have cancellation date
        event: 'Shipment cancelled',
        status: 'cancelled'
      });
    }
    
    return timeline;
  }

  /**
   * Check if shipment can be edited
   */
  canEditShipment(shipment: Shipment): boolean {
    return ['draft', 'validated'].includes(shipment.status);
  }

  /**
   * Check if shipment can be cancelled
   */
  canCancelShipment(shipment: Shipment): boolean {
    return ['draft', 'validated', 'in_transit'].includes(shipment.status);
  }

  /**
   * Check if shipment can be deleted
   */
  canDeleteShipment(shipment: Shipment): boolean {
    return shipment.status === 'draft';
  }

  /**
   * Check if shipment can be tracked
   */
  canTrackShipment(shipment: Shipment): boolean {
    return ['in_transit', 'delivered'].includes(shipment.status);
  }

  /**
   * Get next possible statuses
   */
  getNextPossibleStatuses(currentStatus: ShipmentStatus): ShipmentStatus[] {
    const statusFlow: Record<ShipmentStatus, ShipmentStatus[]> = {
      draft: ['validated', 'cancelled'],
      validated: ['in_transit', 'cancelled'],
      'in_transit': ['delivered', 'cancelled'],
      delivered: [],
      cancelled: [],
      unknown: []
    };
    return statusFlow[currentStatus] || [];
  }

  /**
   * Validate shipment data
   */
  validateShipment(shipment: Partial<Shipment>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!shipment.reference) {
      errors.push('Reference is required');
    }
    
    if (!shipment.customer?.id) {
      errors.push('Customer is required');
    }
    
    if (!shipment.customer?.name) {
      errors.push('Customer name is required');
    }
    
    if (shipment.expectedDelivery && new Date(shipment.expectedDelivery) < new Date()) {
      errors.push('Expected delivery date cannot be in the past');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Compare two shipments
   */
  compareShipments(shipment1: Shipment, shipment2: Shipment): Record<string, { old: any; new: any }> {
    const changes: Record<string, { old: any; new: any }> = {};
    
    if (shipment1.status !== shipment2.status) {
      changes.status = { old: shipment1.status, new: shipment2.status };
    }
    
    if (shipment1.expectedDelivery !== shipment2.expectedDelivery) {
      changes.expectedDelivery = { old: shipment1.expectedDelivery, new: shipment2.expectedDelivery };
    }
    
    if (shipment1.privateNote !== shipment2.privateNote) {
      changes.privateNote = { old: shipment1.privateNote, new: shipment2.privateNote };
    }
    
    if (shipment1.publicNote !== shipment2.publicNote) {
      changes.publicNote = { old: shipment1.publicNote, new: shipment2.publicNote };
    }
    
    return changes;
  }

  /**
   * Clone shipment (for creating similar shipments)
   */
  cloneShipment(shipment: Shipment): Partial<Shipment> {
    return {
      customer: shipment.customer,
      expectedDelivery: shipment.expectedDelivery,
      privateNote: shipment.privateNote,
      publicNote: shipment.publicNote,
      totalWeight: shipment.totalWeight,
      weightUnits: shipment.weightUnits
    };
  }

  /**
   * Get shipment summary
   */
  getShipmentSummary(shipment: Shipment): string {
    const parts = [
      `Shipment ${shipment.reference}`,
      `for ${shipment.customer.name}`,
      `status: ${this.getStatusLabel(shipment.status)}`
    ];
    
    if (shipment.expectedDelivery) {
      parts.push(`delivery: ${this.formatShipmentDate(shipment.expectedDelivery)}`);
    }
    
    if (shipment.totalWeight) {
      parts.push(`weight: ${this.formatShipmentWeight(shipment.totalWeight, shipment.weightUnits)}`);
    }
    
    return parts.join(', ');
  }

  /**
   * Export shipment data
   */
  exportShipmentData(shipments: Shipment[], format: 'csv' | 'json'): string {
    if (format === 'json') {
      return JSON.stringify(shipments, null, 2);
    }
    
    if (format === 'csv') {
      const headers = ['ID', 'Reference', 'Customer', 'Status', 'Expected Delivery', 'Weight'];
      const rows = shipments.map(shipment => [
        shipment.id.toString(),
        shipment.reference,
        shipment.customer.name,
        shipment.status,
        shipment.expectedDelivery || '',
        this.formatShipmentWeight(shipment.totalWeight, shipment.weightUnits)
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    
    return '';
  }

  /**
   * Import shipment data
   */
  importShipmentData(data: string, format: 'csv' | 'json'): Partial<Shipment>[] {
    if (format === 'json') {
      try {
        return JSON.parse(data);
      } catch {
        return [];
      }
    }
    
    if (format === 'csv') {
      // Simple CSV parsing - in real app, use proper CSV parser
      const lines = data.split('\n');
      const headers = lines[0].split(',');
      const shipments: Partial<Shipment>[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length >= 6) {
          shipments.push({
            id: parseInt(values[0]) || 0,
            reference: values[1],
            customer: { id: 0, name: values[2] },
            status: values[3] as ShipmentStatus,
            expectedDelivery: values[4] || undefined,
            totalWeight: parseFloat(values[5]) || undefined
          });
        }
      }
      
      return shipments;
    }
    
    return [];
  }

  /**
   * Get shipment metadata
   */
  getShipmentMetadata(shipment: Shipment): Record<string, any> {
    return {
      age: this.calculateShipmentAge(shipment.createdAt),
      urgency: this.getShipmentDeliveryUrgency(shipment.expectedDelivery),
      canEdit: this.canEditShipment(shipment),
      canCancel: this.canCancelShipment(shipment),
      canDelete: this.canDeleteShipment(shipment),
      canTrack: this.canTrackShipment(shipment),
      nextStatuses: this.getNextPossibleStatuses(shipment.status),
      summary: this.getShipmentSummary(shipment),
      timeline: this.getShipmentTimeline(shipment)
    };
  }

  /**
   * Calculate shipment age in days
   */
  private calculateShipmentAge(createdAt: string): number {
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = now.getTime() - created.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get shipment alerts
   */
  getShipmentAlerts(shipment: Shipment): Array<{ type: 'warning' | 'error' | 'info'; message: string }> {
    const alerts: Array<{ type: 'warning' | 'error' | 'info'; message: string }> = [];
    
    // Check for overdue deliveries
    if (shipment.expectedDelivery) {
      const urgency = this.getShipmentDeliveryUrgency(shipment.expectedDelivery);
      if (urgency === 'overdue') {
        alerts.push({
          type: 'error',
          message: 'Delivery is overdue'
        });
      } else if (urgency === 'today') {
        alerts.push({
          type: 'warning',
          message: 'Delivery is due today'
        });
      } else if (urgency === 'tomorrow') {
        alerts.push({
          type: 'info',
          message: 'Delivery is due tomorrow'
        });
      }
    }
    
    // Check for high weight
    if (shipment.totalWeight && shipment.totalWeight > 100) {
      alerts.push({
        type: 'warning',
        message: 'Heavy shipment - special handling required'
      });
    }
    
    // Check for cancelled status
    if (shipment.status === 'cancelled') {
      alerts.push({
        type: 'info',
        message: 'Shipment has been cancelled'
      });
    }
    
    return alerts;
  }

  /**
   * Get shipment recommendations
   */
  getShipmentRecommendations(shipment: Shipment): string[] {
    const recommendations: string[] = [];
    
    if (shipment.status === 'validated' && !shipment.expectedDelivery) {
      recommendations.push('Set expected delivery date');
    }
    
    if (shipment.status === 'in_transit' && !shipment.trackingNumber) {
      recommendations.push('Add tracking number for customer visibility');
    }
    
    if (shipment.status === 'delivered' && !shipment.privateNote) {
      recommendations.push('Add delivery notes for record keeping');
    }
    
    if (shipment.totalWeight && shipment.totalWeight > 50) {
      recommendations.push('Consider special handling for heavy shipment');
    }
    
    return recommendations;
  }

  /**
   * Get shipment insights
   */
  getShipmentInsights(shipment: Shipment): Record<string, any> {
    return {
      deliveryEfficiency: this.calculateDeliveryEfficiency(shipment),
      customerSatisfaction: this.estimateCustomerSatisfaction(shipment),
      operationalComplexity: this.calculateOperationalComplexity(shipment),
      riskLevel: this.assessRiskLevel(shipment),
      priority: this.calculatePriority(shipment)
    };
  }

  /**
   * Calculate delivery efficiency
   */
  private calculateDeliveryEfficiency(shipment: Shipment): number {
    // Simple efficiency calculation based on status and timing
    if (shipment.status === 'delivered') return 100;
    if (shipment.status === 'in_transit') return 75;
    if (shipment.status === 'validated') return 50;
    if (shipment.status === 'draft') return 25;
    return 0;
  }

  /**
   * Estimate customer satisfaction
   */
  private estimateCustomerSatisfaction(shipment: Shipment): number {
    let satisfaction = 50; // Base satisfaction
    
    // Increase satisfaction for delivered shipments
    if (shipment.status === 'delivered') {
      satisfaction += 30;
    }
    
    // Decrease satisfaction for delayed shipments
    if (shipment.expectedDelivery) {
      const urgency = this.getShipmentDeliveryUrgency(shipment.expectedDelivery);
      if (urgency === 'overdue') {
        satisfaction -= 40;
      } else if (urgency === 'today') {
        satisfaction -= 10;
      }
    }
    
    return Math.max(0, Math.min(100, satisfaction));
  }

  /**
   * Calculate operational complexity
   */
  private calculateOperationalComplexity(shipment: Shipment): number {
    let complexity = 1; // Base complexity
    
    // Increase complexity for heavy shipments
    if (shipment.totalWeight && shipment.totalWeight > 10) {
      complexity += Math.floor(shipment.totalWeight / 10);
    }
    
    // Increase complexity for international shipments (simplified)
    if (shipment.customer?.address && shipment.customer.address.includes('International')) {
      complexity += 2;
    }
    
    // Increase complexity for high-value shipments
    if (shipment.totalWeight && shipment.totalWeight > 100) {
      complexity += 1;
    }
    
    return complexity;
  }

  /**
   * Assess risk level
   */
  private assessRiskLevel(shipment: Shipment): 'low' | 'medium' | 'high' | 'critical' {
    if (shipment.status === 'cancelled') return 'critical';
    if (shipment.status === 'delivered') return 'low';
    
    if (shipment.expectedDelivery) {
      const urgency = this.getShipmentDeliveryUrgency(shipment.expectedDelivery);
      if (urgency === 'overdue') return 'critical';
      if (urgency === 'today') return 'high';
      if (urgency === 'tomorrow') return 'medium';
    }
    
    if (shipment.totalWeight && shipment.totalWeight > 100) return 'high';
    
    return 'low';
  }

  /**
   * Calculate priority
   */
  private calculatePriority(shipment: Shipment): number {
    let priority = 1;
    
    // Higher priority for urgent deliveries
    if (shipment.expectedDelivery) {
      const urgency = this.getShipmentDeliveryUrgency(shipment.expectedDelivery);
      if (urgency === 'overdue') priority += 10;
      if (urgency === 'today') priority += 5;
      if (urgency === 'tomorrow') priority += 3;
      if (urgency === 'this_week') priority += 1;
    }
    
    // Higher priority for heavy shipments
    if (shipment.totalWeight && shipment.totalWeight > 50) {
      priority += 2;
    }
    
    return priority;
  }
}