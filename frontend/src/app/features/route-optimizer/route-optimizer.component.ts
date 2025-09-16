import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { takeUntil, switchMap, map, catchError } from 'rxjs/operators';

import { RouteService } from '../../core/services/route.service';
import { TimeSlotService } from '../../core/services/time-slot.service';
import {
  RoutePlan,
  RouteOptimizationRequest,
  RouteOptimizationResult,
  DeliveryTimeSlot,
  RouteWaypoint,
  OptimizationSummary
} from '../../core/models/schedule.model';
import { LoadingState } from '../../core/models/loading.model';

/**
 * Route Optimizer Feature Component
 *
 * A dedicated page for route optimization and planning that provides:
 * - Advanced optimization algorithms selection
 * - Multi-criteria route optimization
 * - Real-time route mapping and visualization
 * - Delivery sequence reordering
 * - Alternative route comparison
 * - Traffic and efficiency analysis
 *
 * @usageNotes
 * This component serves as a standalone page for route optimization
 * with advanced algorithm selection and comprehensive route analysis.
 */

@Component({
  selector: 'app-route-optimizer',
  templateUrl: './route-optimizer.component.html',
  styleUrls: ['./route-optimizer.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ]
})
export class RouteOptimizerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private refreshTimer: any;

  loadingState$: BehaviorSubject<LoadingState> = new BehaviorSubject<LoadingState>('idle');
  error$ = new BehaviorSubject<string | null>(null);

  // Route parameters
  driverId: number | null = null;
  timeSlotIds: number[] = [];
  routeOptimizationMode: 'single' | 'bulk' = 'single';

  // Component state
  currentRoutePlan: RoutePlan | null = null;
  originalRoutePlan: RoutePlan | null = null;
  optimizationResult: RouteOptimizationResult | null = null;
  alternativeRoutes: RoutePlan[] = [];
  selectedAlgorithm = 'google_maps';
  optimizationCriteria = 'time';
  optimizationInProgress = false;

  // Configuration
  optimizationConfig = {
    algorithms: [
      { id: 'google_maps', name: 'Google Maps', description: 'Real-time traffic optimization' },
      { id: 'osrm', name: 'OSRM', description: 'Open source routing' },
      { id: 'nearest_neighbor', name: 'Nearest Neighbor', description: 'Efficient nearest neighbor algorithm' },
      { id: 'genetic', name: 'Genetic Algorithm', description: 'Advanced genetic optimization' }
    ],
    criteria: [
      { id: 'time', name: 'Time', description: 'Minimize total travel time' },
      { id: 'distance', name: 'Distance', description: 'Minimize total distance' },
      { id: 'fuel_efficiency', name: 'Fuel Efficiency', description: 'Optimize for fuel consumption' },
      { id: 'driver_preference', name: 'Driver Preference', description: 'Consider driver preferences' }
    ],
    trafficModels: [
      { id: 'best_guess', name: 'Best Guess', description: 'Default traffic prediction' },
      { id: 'pessimistic', name: 'Pessimistic', description: 'Worst-case traffic scenario' },
      { id: 'optimistic', name: 'Optimistic', description: 'Best-case traffic scenario' }
    ]
  };

  // Visualization settings
  viewSettings = {
    showMap: true,
    showComparisons: true,
    showWaypoints: true,
    showMetrics: true,
    autoRefresh: true,
    refreshInterval: 30000
  };

  // Advanced settings
  advancedSettings = {
    trafficModel: 'best_guess',
    maxDistance: 500,
    maxTime: 8,
    avoidTolls: false,
    avoidHighways: false,
    priorityDeliveries: [],
    fixedWaypoints: []
  };

  // Map configuration
  mapConfig = {
    center: { lat: 51.509865, lng: -0.118092 }, // London coordinates
    zoom: 12,
    showMarkers: true,
    showRouteLines: true,
    showTraffic: true
  };

  // Comparison data
  comparisonMetrics = {
    timeImproved: 0,
    distanceReduced: 0,
    efficiencyGain: 0,
    fuelSaved: 0
  };

  constructor(
    private readonly routeService: RouteService,
    private readonly timeSlotService: TimeSlotService,
    private readonly activatedRoute: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.initializeComponent();
    this.loadRouteData();
    this.setupAutoRefresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanupAutoRefresh();
  }

  /**
   * Initialize component from route parameters
   */
  private initializeComponent(): void {
    this.activatedRoute.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.driverId = params['driverId'] ? parseInt(params['driverId']) : null;

        if (params['timeSlots']) {
          this.timeSlotIds = params['timeSlots'].split(',').map(id => parseInt(id));
        }

        this.routeOptimizationMode = params['mode'] || 'single';

        // Load configuration from parameters
        if (params['algorithm']) this.selectedAlgorithm = params['algorithm'];
        if (params['criteria']) this.optimizationCriteria = params['criteria'];
        if (params['trafficModel']) this.advancedSettings.trafficModel = params['trafficModel'];

        this.loadOptimizationData();
      });
  }

  /**
   * Load route optimization data
   */
  private loadRouteData(): void {
    if (!this.driverId && this.timeSlotIds.length === 0) {
      this.loadingState$.next('succeeded');
      return;
    }

    if (this.loadingState$.value === 'loading') return;

    this.loadingState$.next('loading');
    this.error$.next(null);

    const loadRequests = this.buildLoadRequests();

    Promise.all(loadRequests)
      .then(results => {
        this.processLoadResults(results);
        this.loadingState$.next('succeeded');
      })
      .catch(error => {
        this.handleError('Failed to load route optimization data', error);
      });
  }

  /**
   * Build data load requests
   */
  private buildLoadRequests(): Promise<any>[] {
    const promises: Promise<any>[] = [];

    // Load current route plan
    if (this.driverId) {
      promises.push(this.routeService.getTodayRoute(this.driverId).toPromise());
    }

    // Load time slots (for creating route from time slots)
    if (this.timeSlotIds.length > 0) {
      promises.push(this.loadTimeSlotsForRoute());
    }

    return promises;
  }

  /**
   * Load time slots for route creation
   */
  private loadTimeSlotsForRoute(): Promise<DeliveryTimeSlot[]> {
    const promises: Promise<DeliveryTimeSlot>[] = this.timeSlotIds.map(slotId =>
      this.timeSlotService.checkTimeSlotDetails(slotId).toPromise()
    );

    return Promise.all(promises);
  }

  /**
   * Process load results
   */
  private processLoadResults(results: any[]): void {
    results.forEach((result, index) => {
      if (index === 0 && result) {
        // Route plan result
        this.originalRoutePlan = result as RoutePlan;
        this.currentRoutePlan = result as RoutePlan;
      } else if (result && Array.isArray(result)) {
        // Time slots result
        // Process time slots and create preliminary route plan
        this.processTimeSlotsForRouteCreation(result as DeliveryTimeSlot[]);
      }
    });

    // Set up initial comparison metrics
    if (this.originalRoutePlan) {
      this.initializeComparisonMetrics();
    }
  }

  /**
   * Process time slots for route creation
   */
  private processTimeSlotsForRouteCreation(timeSlots: DeliveryTimeSlot[]): void {
    if (timeSlots.length === 0) return;

    // Create waypoints from time slots
    const waypoints: RouteWaypoint[] = timeSlots.map((slot, index) => ({
      sequence: index + 1,
      latitude: 51.509865 + (index * 0.01), // Simulated coordinates
      longitude: -0.118092 + (index * 0.01),
      address: slot.slot_label || `Location ${index + 1}`,
      delivery_id: slot.id
    }));

    const newRoutePlan: RoutePlan = {
      id: 0, // Will be assigned by backend
      driver_id: this.driverId!,
      route_date: new Date().toISOString().split('T')[0],
      waypoints: waypoints,
      route_status: 'planned',
      total_distance: this.calculateTotalDistance(waypoints),
      estimated_time: this.calculateEstimatedTime(waypoints),
      efficiency_score: 0.75,
      optimization_algorithm: this.selectedAlgorithm,
      is_optimized: false,
      can_start: false,
      optimization_algorithm: 'none',
      route_progress: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.originalRoutePlan = newRoutePlan;
    this.currentRoutePlan = JSON.parse(JSON.stringify(newRoutePlan)); // Deep copy
  }

  /**
   * Calculate total distance for waypoints
   */
  private calculateTotalDistance(waypoints: RouteWaypoint[]): number {
    let totalDistance = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const distance = this.calculateDistanceBetweenPoints(
        waypoints[i].latitude, waypoints[i].longitude,
        waypoints[i + 1].latitude, waypoints[i + 1].longitude
      );
      totalDistance += distance;
    }
    return Math.round(totalDistance);
  }

  /**
   * Calculate estimated time for waypoints
   */
  private calculateEstimatedTime(waypoints: RouteWaypoint[]): number {
    // Assume average speed of 30 km/h in urban area, plus 15 minutes per stop
    const distanceTime = (this.calculateTotalDistance(waypoints) / 30) * 60; // minutes
    const stopTime = waypoints.length * 15; // 15 minutes per stop
    return Math.round(distanceTime + stopTime);
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistanceBetweenPoints(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * Math.PI / 180;
  }

  /**
   * Initialize comparison metrics
   */
  private initializeComparisonMetrics(): void {
    this.comparisonMetrics = {
      timeImproved: 0,
      distanceReduced: 0,
      efficiencyGain: 0,
      fuelSaved: 0
    };
  }

  /**
   * Load optimization data based on route parameters
   */
  private loadOptimizationData(): void {
    // This would load driver preferences, historical data, etc.
    console.log('Loading optimization data for driver:', this.driverId);
  }

  /**
   * Start route optimization
   */
  onOptimizeRoute(): void {
    if (!this.currentRoutePlan && !this.driverId) return;
    if (this.optimizationInProgress) return;

    this.optimizationInProgress = true;
    this.error$.next(null);

    const optimizationRequest: RouteOptimizationRequest = {
      driver_id: this.driverId!,
      delivery_ids: this.currentRoutePlan?.deliveries?.map(d => d.id) || this.timeSlotIds,
      optimization_criteria: this.optimizationCriteria as any,
      algorithm: this.selectedAlgorithm as any,
      constraints: {
        traffic_model: this.advancedSettings.trafficModel,
        max_distance: this.advancedSettings.maxDistance,
        max_time: this.advancedSettings.maxTime * 60 // Convert hours to minutes
      }
    };

    // Emit optimization request
    this.onOptimizationRequested(optimizationRequest);

    // Simulate optimization process
    setTimeout(() => {
      this.performOptimization(optimizationRequest)
        .then(result => {
          this.optimizationResult = result;
          this.updateComparisonMetrics(result);
          this.optimizationInProgress = false;
        })
        .catch(error => {
          this.handleError('Route optimization failed', error);
          this.optimizationInProgress = false;
        });
    }, 3000);
  }

  /**
   * Perform route optimization
   */
  private performOptimization(request: RouteOptimizationRequest): Promise<RouteOptimizationResult> {
    // This would call the actual optimization API
    // For now, simulate a result

    return new Promise((resolve) => {
      const mockResult: RouteOptimizationResult = {
        success: true,
        route_plan: {
          ...this.currentRoutePlan!,
          efficiency_score: Math.min(0.95, (this.currentRoutePlan?.efficiency_score || 0.75) + 0.15),
          total_distance: Math.max(0, (this.currentRoutePlan?.total_distance || 0) - 5),
          estimated_duration: Math.max(15, (this.currentRoutePlan?.estimated_duration || 0) - 10)
        },
        optimization_summary: {
          original_distance: this.currentRoutePlan?.total_distance || 0,
          optimized_distance: Math.max(0, (this.currentRoutePlan?.total_distance || 0) - 5),
          distance_saved: 5,
          efficiency_improvement: 0.15,
          original_time: this.currentRoutePlan?.estimated_duration || 0,
          optimized_time: Math.max(15, (this.currentRoutePlan?.estimated_duration || 0) - 10),
          time_saved: 10
        },
        algorithm_used: request.algorithm
      };

      resolve(mockResult);
    });
  }

  /**
   * Update comparison metrics
   */
  private updateComparisonMetrics(result: RouteOptimizationResult): void {
    this.comparisonMetrics = {
      timeImproved: result.optimization_summary.time_saved,
      distanceReduced: result.optimization_summary.distance_saved,
      efficiencyGain: result.optimization_summary.efficiency_improvement,
      fuelSaved: Math.round(result.optimization_summary.distance_saved * 0.08 * 100) / 100 // Estimate fuel savings
    };

    this.currentRoutePlan = result.route_plan;
    this.alternativeRoutes.push(result.route_plan);
  }

  /**
   * Select alternative route
   */
  onAlternativeSelected(route: RoutePlan): void {
    this.originalRoutePlan = this.currentRoutePlan;
    this.currentRoutePlan = route;
    this.initializeComparisonMetrics();
  }

  /**
   * Reorder delivery sequence
   */
  onReorderDeliveries(newOrder: number[]): void {
    if (!this.currentRoutePlan?.deliveries) return;

    // Reorder deliveries based on new sequence
    this.currentRoutePlan.deliveries = newOrder.map(orderId =>
      this.currentRoutePlan!.deliveries!.find(d => d.id === orderId)!
    ).filter(Boolean);

    // Recalculate route metrics
    this.recalculateRouteMetrics();
  }

  /**
   * Recalculate route metrics after changes
   */
  private recalculateRouteMetrics(): void {
    if (!this.currentRoutePlan) return;

    // Simulate recalculation
    this.currentRoutePlan.waypoints = this.currentRoutePlan.deliveries?.map((delivery, index) => ({
      sequence: index + 1,
      latitude: 51.509865 + (index * 0.01),
      longitude: -0.118092 + (index * 0.01),
      address: delivery.shipment?.delivery_address || `Location ${index + 1}`,
      delivery_id: delivery.id
    }));

    this.currentRoutePlan.total_distance = this.calculateTotalDistance(this.currentRoutePlan.waypoints || []);
    this.currentRoutePlan.estimated_duration = this.calculateEstimatedTime(this.currentRoutePlan.waypoints || []);
  }

  /**
   * Toggle advanced settings
   */
  onToggleAdvancedSettings(): void {
    // Show/hide advanced settings panel
    console.log('Toggle advanced settings');
  }

  /**
   * Export optimization results
   */
  onExportResults(): void {
    if (!this.optimizationResult) return;

    const exportData = {
      driver_id: this.driverId,
      original_route: this.originalRoutePlan,
      optimized_route: this.optimizationResult.route_plan,
      optimization_summary: this.optimizationResult.optimization_summary,
      algorithm_used: this.optimizationResult.algorithm_used,
      alternative_routes: this.alternativeRoutes,
      comparison_metrics: this.comparisonMetrics
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = `route-optimization-${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  /**
   * Apply optimization result
   */
  onApplyOptimization(): void {
    if (!this.optimizationResult) return;

    const confirmation = confirm(
      'Are you sure you want to apply this optimized route? ' +
      `This will save ${this.optimizationResult.optimization_summary.time_saved} minutes and ` +
      `${this.optimizationResult.optimization_summary.distance_saved} km.`
    );

    if (confirmation) {
      this.applyOptimizationResult(this.optimizationResult);
    }
  }

  /**
   * Apply optimization result to system
   */
  private applyOptimizationResult(result: RouteOptimizationResult): void {
    // This would persist the optimization result
    this.currentRoutePlan = result.route_plan;
    this.originalRoutePlan = null;
    this.optimizationResult = null; // Clear after application

    console.log('Optimization result applied successfully');
  }

  /**
   * Refresh optimization data
   */
  onRefreshData(): void {
    this.loadRouteData();
  }

  /**
   * Handle optimization requests
   */
  onOptimizationRequested(request: RouteOptimizationRequest): void {
    // This would typically be handled by parent component
    console.log('Optimization requested:', request);
  }

  /**
   * Handle map interactions
   */
  onMapInteraction(event: any): void {
    console.log('Map interaction:', event);
  }

  /**
   * Calculate fuel cost savings
   */
  calculateFuelSavings(liters: number): number {
    const fuelCostPerLiter = 1.45; // Example fuel cost
    return Math.round(liters * fuelCostPerLiter * 100) / 100;
  }

  /**
   * Get optimization status
   */
  getOptimizationStatus(): string {
    if (this.optimizationInProgress) return 'Optimizing...';
    if (this.optimizationResult) return 'Optimal';
    if (this.currentRoutePlan?.is_optimized) return 'Optimized';
    return 'Not Optimized';
  }

  /**
   * Setup auto refresh
   */
  private setupAutoRefresh(): void {
    if (!this.viewSettings.autoRefresh || this.viewSettings.refreshInterval <= 0) return;

    this.cleanupAutoRefresh();
    this.refreshTimer = setInterval(() => {
      if (!this.optimizationInProgress) {
        this.onRefreshData();
      }
    }, this.viewSettings.refreshInterval);
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
  }

  /**
   * Check if optimization is possible
   */
  canOptimize(): boolean {
    return (!this.optimizationResult && !this.optimizationInProgress) &&
           (this.currentRoutePlan || this.timeSlotIds.length > 0) &&
           (this.driverId !== null);
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
   * Get error message
   */
  getErrorMessage(): Observable<string | null> {
    return this.error$.asObservable();
  }

  /**
   * Navigation methods
   */
  goBack(): void {
    this.router.navigate(['/delivery-schedule']);
  }

  goToSchedule(): void {
    this.router.navigate(['/delivery-schedule'], {
      queryParams: { driverId: this.driverId }
    });
  }
}