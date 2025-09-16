import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Observable, BehaviorSubject, of } from 'rxjs';
import { takeUntil, switchMap, catchError, map } from 'rxjs/operators';

import { RouteService } from '../../../core/services/route.service';
import { LoadingService } from '../../../core/services/loading.service';
import { RoutePlan, RouteSuggestion, RouteOptimizationRequest, RouteStatus } from '../../../core/models/schedule.model';
import { LoadingState } from '../../../core/models/loading.model';

/**
 * Route Display Component
 *
 * A comprehensive route visualization and optimization component that provides:
 * - Route plan display with interactive maps
 * - Route optimization suggestions
 * - Delivery sequence visualization
 * - Route performance metrics
 * - Real-time tracking integration
 *
 * @usageNotes
 * This component integrates with mapping services and route optimization APIs
 * to provide detailed route information and suggestions for delivery planning.
 */

@Component({
  selector: 'app-route-display',
  templateUrl: './route-display.component.html',
  styleUrls: ['./route-display.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ]
})
export class RouteDisplayComponent implements OnInit, OnDestroy {
  @ViewChild('optimizationModal', { static: true }) optimizationModal!: TemplateRef<any>;
  @ViewChild('mapContainer', { static: true }) mapContainer!: TemplateRef<any>;

  @Input() routePlanId: number | null = null;
  @Input() driverId: number | null = null;
  @Input() showOptimizationSuggestions = true;
  @Input() showPerformanceMetrics = true;
  @Input() showMapView = true;
  @Input() enableRouteEditing = true;
  @Input() showComparison = true;
  @Input() autoRefresh = true;
  @Input() refreshInterval = 30000; // 30 seconds
  @Input() interactiveMode = true;
  @Input() compactView = false;
  @Input() theme: 'light' | 'dark' = 'light';

  @Output() routeLoaded = new EventEmitter<RoutePlan>();
  @Output() optimizationRequested = new EventEmitter<RouteOptimizationRequest>();
  @Output() routeModified = new EventEmitter<RoutePlan>();
  @Output() suggestionSelected = new EventEmitter<RouteSuggestion>();
  @Output() refreshRequested = new EventEmitter<void>();
  @Output() errorOccurred = new EventEmitter<Error>();
  @Output() loadingStateChanged = new EventEmitter<LoadingState>();

  private destroy$ = new Subject<void>();
  private refreshTimer: any;

  loadingState$: BehaviorSubject<LoadingState> = new BehaviorSubject<LoadingState>('idle');
  error$ = new BehaviorSubject<string | null>(null);

  // Route data
  currentRoutePlan: RoutePlan | null = null;
  routeSuggestions: RouteSuggestion[] = [];
  optimizationInProgress = false;

  // Performance metrics
  routeMetrics: RouteMetrics | null = null;
  comparisonMetrics: ComparisonMetrics | null = null;

  // State management
  selectedSuggestion: RouteSuggestion | null = null;
  showOptimizationPanel = false;
  showComparisonPanel = false;
  showDetailsModal = false;
  selectedRouteStop: any = null;
  refresh$ = new Subject<void>();

  // Map integration
  mapData: MapData | null = null;
  mapLoaded = false;

  constructor(
    private readonly routeService: RouteService,
    private readonly loadingService: LoadingService
  ) {}

  ngOnInit(): void {
    this.loadRouteData();
    this.setupAutoRefresh();
    this.initializeMap();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanupAutoRefresh();
    this.cleanupMap();
  }

  /**
   * Load route data
   */
  loadRouteData(): void {
    if (!this.routePlanId && !this.driverId) return;
    if (this.loadingState$.value === 'loading') return;

    this.loadingState$.next('loading');
    this.error$.next(null);

    const loadRequest$ = this.routePlanId
      ? this.routeService.getRoutePlan(this.routePlanId)
      : this.routeService.getTodayRoute(this.driverId!);

    loadRequest$
      .pipe(
        takeUntil(this.destroy$),
        switchMap((routePlan: RoutePlan) => {
          this.currentRoutePlan = routePlan;
          this.routeLoaded.emit(routePlan);
          return this.loadSupportingData(routePlan);
        }),
        catchError((error) => {
          this.handleError('Failed to load route data', error);
          return of(null);
        })
      )
      .subscribe({
        next: () => {
          this.loadingState$.next('succeeded');
          this.loadingStateChanged.emit('succeeded');
        },
        error: (error) => {
          this.handleError('Route data loading failed', error);
        }
      });
  }

  /**
   * Load supporting data
   */
  private loadSupportingData(routePlan: RoutePlan): Observable<void> {
    const requests: Observable<any>[] = [];

    if (this.showOptimizationSuggestions) {
      requests.push(this.loadRouteSuggestions(routePlan));
    }

    if (this.showPerformanceMetrics) {
      requests.push(this.calculateRouteMetrics(routePlan));
    }

    if (this.showComparison && routePlan.original_route_id) {
      requests.push(this.loadComparisonMetrics(routePlan));
    }

    if (requests.length === 0) {
      return this.loadingService.resolve$(undefined);
    }

    return this.loadingService.resolve$(undefined).pipe(
      switchMap(() => {
        return requests.length === 1 ? requests[0] : this.loadingService.combine$(requests);
      }),
      catchError((error) => {
        console.warn('Some supporting data failed to load', error);
        return of(null);
      })
    ) as Observable<void>;
  }

  /**
   * Load route suggestions
   */
  private loadRouteSuggestions(routePlan: RoutePlan): Observable<void> {
    return this.routeService.getRouteSuggestions(routePlan.id)
      .pipe(
        takeUntil(this.destroy$),
        map((suggestions: RouteSuggestion[]) => {
          this.routeSuggestions = suggestions.sort((a, b) => b.efficiency_score - a.efficiency_score);
          return undefined;
        })
      );
  }

  /**
   * Calculate route performance metrics
   */
  private calculateRouteMetrics(routePlan: RoutePlan): Observable<void> {
    return new Observable(observer => {
      try {
        this.routeMetrics = this.computeRouteMetrics(routePlan);
        observer.next();
        observer.complete();
      } catch (error) {
        observer.error(error);
      }
    });
  }

  /**
   * Load comparison metrics against original route
   */
  private loadComparisonMetrics(routePlan: RoutePlan): Observable<void> {
    if (!routePlan.original_route_id) return of(undefined);

    return this.routeService.getRoutePlan(routePlan.original_route_id)
      .pipe(
        takeUntil(this.destroy$),
        map((originalRoute: RoutePlan) => {
          this.comparisonMetrics = {
            timeSaved: originalRoute.estimated_duration - routePlan.estimated_duration,
            distanceSaved: originalRoute.total_distance - routePlan.total_distance,
            fuelSaved: this.calculateFuelSavings(originalRoute, routePlan),
            efficiencyGain: routePlan.optimization_score - originalRoute.optimization_score
          };
          return undefined;
        })
      );
  }

  /**
   * Compute route performance metrics
   */
  private computeRouteMetrics(routePlan: RoutePlan): RouteMetrics {
    const stopCount = routePlan.deliveries.length;
    const totalDuration = routePlan.estimated_duration;
    const totalDistance = routePlan.total_distance;
    const avgStopTime = totalDuration / stopCount;
    const avgDistance = totalDistance / stopCount;

    return {
      stopCount,
      totalDuration,
      totalDistance,
      avgStopTime,
      avgDistance,
      fuelEfficiency: this.calculateEstimatedMPG(totalDistance, routePlan.vehicle_type),
      optimizationScore: routePlan.optimization_score,
      completionRate: this.calculateCompletionRate(routePlan),
      estimatedArrival: this.calculateEstimatedArrival(routePlan)
    };
  }

  /**
   * Calculate fuel savings
   */
  private calculateFuelSavings(original: RoutePlan, optimized: RoutePlan): number {
    const mpg = this.calculateEstimatedMPG(original.total_distance, original.vehicle_type);
    const fuelUsed_Original = original.total_distance / mpg;
    const fuelUsed_Optimized = optimized.total_distance / mpg;
    return fuelUsed_Original - fuelUsed_Optimized;
  }

  /**
   * Calculate estimated MPG based on vehicle type
   */
  private calculateEstimatedMPG(distance: number, vehicleType: string = 'standard'): number {
    const mpgByType = {
      compact: 35,
      standard: 25,
      suv: 18,
      truck: 14,
      van: 20
    };
    return mpgByType[vehicleType] || mpgByType.standard;
  }

  /**
   * Calculate completion rate
   */
  private calculateCompletionRate(routePlan: RoutePlan): number {
    const completed = routePlan.deliveries.filter(d => d.status === 'completed').length;
    return routePlan.deliveries.length > 0 ? (completed / routePlan.deliveries.length) * 100 : 0;
  }

  /**
   * Calculate estimated arrival time
   */
  private calculateEstimatedArrival(routePlan: RoutePlan): Date {
    const now = new Date();
    const startTime = new Date(routePlan.start_time);
    const elapsedMinutes = routePlan.deliveries.filter(d => d.status === 'completed').length * 15; // Assume 15 min per delivery
    return new Date(startTime.getTime() + elapsedMinutes * 60000);
  }

  /**
   * Initialize map integration
   */
  private initializeMap(): void {
    if (!this.showMapView) return;

    // Placeholder for map initialization
    // This would integrate with Google Maps, Mapbox, or other mapping services
    this.mapLoaded = true;
  }

  /**
   * Cleanup map resources
   */
  private cleanupMap(): void {
    if (this.mapLoaded) {
      // Cleanup map resources
      this.mapLoaded = false;
    }
  }

  /**
   * Request route optimization
   */
  requestOptimization(): void {
    if (!this.currentRoutePlan) return;

    this.optimizationInProgress = true;
    this.optimizationRequested.emit({
      route_plan_id: this.currentRoutePlan.id,
      driver_id: this.currentRoutePlan.driver_id,
      optimization_params: {
        avoid_traffic: true,
        minimize_time: true,
        minimize_distance: true,
        prefer_highways: false
      }
    });

    // Simulate optimization process
    setTimeout(() => {
      this.optimizationInProgress = false;
      this.loadRouteData();
    }, 3000);
  }

  /**
   * Select optimization suggestion
   */
  selectSuggestion(suggestion: RouteSuggestion): void {
    this.selectedSuggestion = suggestion;
    this.suggestionSelected.emit(suggestion);
  }

  /**
   * Apply selected optimization suggestion
   */
  applyOptimizationSuggestion(): void {
    if (!this.selectedSuggestion || !this.currentRoutePlan) return;

    // This would typically call a backend API to apply the optimization
    console.log('Applying optimization suggestion:', this.selectedSuggestion);

    // Refresh route data after optimization
    setTimeout(() => {
      this.loadRouteData();
      this.showOptimizationPanel = false;
    }, 1000);
  }

  /**
   * Toggle optimization panel
   */
  toggleOptimizationPanel(): void {
    this.showOptimizationPanel = !this.showOptimizationPanel;
  }

  /**
   * Toggle comparison panel
   */
  toggleComparisonPanel(): void {
    this.showComparisonPanel = !this.showComparisonPanel;
  }

  /**
   * Show route stop details
   */
  showStopDetails(stop: any): void {
    this.selectedRouteStop = stop;
    this.showDetailsModal = true;
  }

  /**
   * Refresh route data
   */
  refresh(): void {
    this.loadRouteData();
    this.refreshRequested.emit();
    this.refresh$.next();
  }

  /**
   * Setup auto refresh
   */
  private setupAutoRefresh(): void {
    if (!this.autoRefresh || this.refreshInterval <= 0) return;

    this.cleanupAutoRefresh();
    this.refreshTimer = setInterval(() => {
      if (this.loadingState$.value !== 'loading') {
        this.refresh();
      }
    }, this.refreshInterval);
  }

  /**
   * Cleanup auto refresh
   */
  private cleanupAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Handle errors
   */
  private handleError(message: string, error: any): void {
    console.error(message, error);
    this.error$.next(message);
    this.loadingState$.next('failed');
    this.errorOccurred.emit(error);
    this.loadingStateChanged.emit('failed');
  }

  /**
   * Check if data is loading
   */
  isLoading(): boolean {
    return this.loadingState$.value === 'loading';
  }

  /**
   * Check if there was an error
   */
  hasError(): boolean {
    return this.loadingState$.value === 'failed';
  }

  /**
   * Check if route has data
   */
  hasRouteData(): boolean {
    return !!this.currentRoutePlan;
  }

  /**
   * Get error message
   */
  getErrorMessage(): Observable<string | null> {
    return this.error$.asObservable();
  }

  /**
   * Get route status color
   */
  getStatusColor(status: string): string {
    const statusColors = {
      'planned': 'primary',
      'active': 'warning',
      'completed': 'success',
      'cancelled': 'danger'
    };
    return statusColors[status] || 'secondary';
  }

  /**
   * Get efficiency score color
   */
  getEfficiencyScoreColor(score: number): string {
    if (score >= 0.8) return 'success';
    if (score >= 0.6) return 'warning';
    return 'danger';
  }
}

/**
 * Route metrics interface
 */
interface RouteMetrics {
  stopCount: number;
  totalDuration: number;
  totalDistance: number;
  avgStopTime: number;
  avgDistance: number;
  fuelEfficiency: number;
  optimizationScore: number;
  completionRate: number;
  estimatedArrival: Date;
}

/**
 * Comparison metrics interface
 */
interface ComparisonMetrics {
  timeSaved: number;
  distanceSaved: number;
  fuelSaved: number;
  efficiencyGain: number;
}

/**
 * Map data interface (placeholder)
 */
interface MapData {
  center: { lat: number; lng: number };
  zoom: number;
  markers: any[];
  polylines: any[];
}