import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Observable, BehaviorSubject, of, forkJoin } from 'rxjs';
import { takeUntil, switchMap, catchError, map } from 'rxjs/operators';

import { CalendarService } from '../../../core/services/calendar.service';
import { RouteService } from '../../../core/services/route.service';
import { TimeSlotService } from '../../../core/services/time-slot.service';
import {
  DeliverySchedule,
  DeliveryTimeSlot,
  RoutePlan,
  RouteOptimizationRequest,
  TimeSlotConfiguration,
  ScheduleConflicts
} from '../../../core/models/schedule.model';
import { CalendarEvent } from 'angular-calendar';
import { LoadingState } from '../../../core/models/loading.model';

/**
 * Delivery Planner Component
 *
 * A comprehensive delivery planning interface that combines:
 * - Calendar integration with drag-and-drop scheduling
 * - Time slot selection and booking
 * - Route optimization and visualization
 * - Real-time conflict detection
 * - Multi-driver coordination
 *
 * @usageNotes
 * This component provides a unified interface for delivery planning
 * that integrates calendar scheduling, time slot management, and
 * route optimization in a single cohesive experience.
 */

@Component({
  selector: 'app-delivery-planner',
  templateUrl: './delivery-planner.component.html',
  styleUrls: ['./delivery-planner.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ]
})
export class DeliveryPlannerComponent implements OnInit, OnDestroy, OnChanges {
  @Input() mode: 'planning' | 'scheduling' | 'optimization' = 'planning';
  @Input() driverId: number | null = null;
  @Input() selectedDate: Date = new Date();
  @Input() deliverySchedules: DeliverySchedule[] = [];
  @Input() availableDrivers: number[] = [];
  @Input() enableMultiDriver = true;
  @Input() enableDragDrop = true;
  @Input() enableRouteOptimization = true;
  @Input() enableTimeSlotBooking = true;
  @Input() enableConflictDetection = true;
  @Input() showCalendarView = true;
  @Input() showTimeSlots = true;
  @Input() showRouteMap = true;
  @Input() autoRefresh = true;
  @Input() refreshInterval = 30000; // 30 seconds
  @Input() theme: 'light' | 'dark' = 'light';

  @Output() schedulePlanned = new EventEmitter<DeliverySchedule>();
  @Output() schedulesPlanned = new EventEmitter<DeliverySchedule[]>();
  @Output() routeOptimized = new EventEmitter<RoutePlan>();
  @Output() conflictsDetected = new EventEmitter<ScheduleConflicts>();
  @Output() refreshRequested = new EventEmitter<void>();
  @Output() errorOccurred = new EventEmitter<Error>();
  @Output() loadingStateChanged = new EventEmitter<LoadingState>();

  private destroy$ = new Subject<void>();
  private refreshTimer: any;

  loadingState$: BehaviorSubject<LoadingState> = new BehaviorSubject<LoadingState>('idle');
  error$ = new BehaviorSubject<string | null>(null);

  // View configuration
  activeView: 'calendar' | 'schedule' | 'route' | 'conflicts' = 'calendar';
  isSidebarCollapsed = false;
  showConfigurationPanel = false;

  // Data sources
  calendarEvents: CalendarEvent[] = [];
  deliverySlots: DeliveryTimeSlot[] = [];
  routePlans: RoutePlan[] = [];
  scheduleConflicts: ScheduleConflicts | null = null;
  optimizationInProgress = false;

  // State management
  selectedSchedule: DeliverySchedule | null = null;
  selectedTimeSlot: DeliveryTimeSlot | null = null;
  selectedRoutePlan: RoutePlan | null = null;
  activeDriverId: number | null = null;
  currentDate: Date = new Date();
  dateRange: { start: Date; end: Date } | null = null;

  // Planning state
  planningMode: 'single' | 'bulk' = 'single';
  bulkSelection: DeliverySchedule[] = [];
  draftSchedule: Partial<DeliverySchedule> | null = null;

  // Configuration
  plannerConfig = {
    defaultTimeSlotDuration: 60, // minutes
    maxDeliveriesPerDay: 8,
    bufferTime: 15, // minutes
    optimizationCriteria: 'time',
    conflictResolution: 'alert'
  };

  constructor(
    private readonly calendarService: CalendarService,
    private readonly routeService: RouteService,
    private readonly timeSlotService: TimeSlotService
  ) {}

  ngOnInit(): void {
    this.initializePlanner();
    this.loadInitialData();
    this.setupAutoRefresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['driverId'] && !changes['driverId'].firstChange) {
      this.activeDriverId = this.driverId;
      this.loadPlannerData();
    }
    if (changes['selectedDate'] && !changes['selectedDate'].firstChange) {
      this.currentDate = this.selectedDate;
      this.loadPlannerData();
    }
    if (changes['deliverySchedules'] && !changes['deliverySchedules'].firstChange) {
      this.updateCalendarFromSchedules();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanupAutoRefresh();
  }

  /**
   * Initialize the delivery planner component
   */
  private initializePlanner(): void {
    this.activeDriverId = this.driverId;
    this.currentDate = this.selectedDate;
    this.bulkSelection = [];
    this.draftSchedule = null;
    this.selectedSchedule = null;
    this.selectedTimeSlot = null;
    this.selectedRoutePlan = null;

    // Set initial date range
    const start = new Date(this.currentDate);
    const end = new Date(this.currentDate);
    end.setDate(end.getDate() + 7);
    this.dateRange = { start, end };
  }

  /**
   * Load initial data for the planner
   */
  private loadInitialData(): void {
    this.loadPlannerData();
  }

  /**
   * Load comprehensive planner data
   */
  private loadPlannerData(): void {
    if (!this.activeDriverId) return;
    if (this.loadingState$.value === 'loading') return;

    this.loadingState$.next('loading');
    this.error$.next(null);

    const loadRequests = this.buildDataLoadRequests();

    if (loadRequests.length === 0) {
      this.loadingState$.next('succeeded');
      return;
    }

    forkJoin(loadRequests)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          this.handleError('Failed to load planner data', error);
          return of(null);
        })
      )
      .subscribe({
        next: (results) => {
          this.processLoadResults(results);
          this.loadingState$.next('succeeded');
          this.loadingStateChanged.emit('succeeded');
        },
        error: (error) => {
          if (error) {
            this.handleError('Planner data loading failed', error);
          }
        }
      });
  }

  /**
   * Build data load requests based on active view and configuration
   */
  private buildDataLoadRequests(): Observable<any>[] {
    const requests: Observable<any>[] = [];

    // Calendar/scheduling data
    if (this.showCalendarView || this.activeView === 'calendar') {
      requests.push(this.loadCalendarData());
    }

    // Time slots data
    if (this.showTimeSlots || this.activeView === 'schedule' || this.enableTimeSlotBooking) {
      requests.push(this.loadTimeSlotData());
    }

    // Route data
    if (this.enableRouteOptimization || this.activeView === 'route') {
      requests.push(this.loadRouteData());
    }

    // Check for conflicts if enabled
    if (this.enableConflictDetection) {
      requests.push(this.checkForConflicts());
    }

    return requests;
  }

  /**
   * Load calendar data
   */
  private loadCalendarData(): Observable<any> {
    if (!this.dateRange) return of(null);

    const params = {
      start_date: this.dateRange.start.toISOString().split('T')[0],
      end_date: this.dateRange.end.toISOString().split('T')[0],
      driver_id: this.activeDriverId?.toString() || 'all'
    };

    return this.calendarService.getCalendarData(params)
      .pipe(
        map(calendarData => {
          this.updateCalendarFromData(calendarData);
          return calendarData;
        })
      );
  }

  /**
   * Load time slot data
   */
  private loadTimeSlotData(): Observable<any> {
    if (!this.dateRange) return of(null);

    return this.timeSlotService.getTimeSlotAvailability(
      this.activeDriverId!,
      this.dateRange.start,
      this.dateRange.end
    )
      .pipe(
        map(availability => {
          this.deliverySlots = availability.time_slots;
          return availability;
        })
      );
  }

  /**
   * Load route data
   */
  private loadRouteData(): Observable<any> {
    const today = new Date().toISOString().split('T')[0];

    return this.routeService.getTodayRoute(this.activeDriverId!)
      .pipe(
        map(routePlan => {
          this.selectedRoutePlan = routePlan;
          this.routePlans = [routePlan]; // For multi-driver support
          return routePlan;
        }),
        catchError(() => {
          // Route might not exist yet, which is fine
          return of(null);
        })
      );
  }

  /**
   * Check for scheduling conflicts
   */
  private checkForConflicts(): Observable<any> {
    if (!this.dateRange || !this.activeDriverId) return of(null);

    const currentDate = this.currentDate.toISOString().split('T')[0];

    return this.calendarService.getScheduleConflicts(currentDate, [this.activeDriverId])
      .pipe(
        map(conflicts => {
          this.scheduleConflicts = conflicts;
          if (conflicts.conflicts.length > 0) {
            this.conflictsDetected.emit(conflicts);
          }
          return conflicts;
        }),
        catchError(() => {
          // Conflict detection is optional
          return of(null);
        })
      );
  }

  /**
   * Process results from data loading
   */
  private processLoadResults(results: any[]): void {
    results.forEach(result => {
      if (result) {
        // Individual services already processed their data
        console.log('Processed result:', result);
      }
    });

    // Additional cross-service data correlation would go here
    this.correlateDataServices();
  }

  /**
   * Correlate data between different services
   */
  private correlateDataServices(): void {
    // Example: Match delivery schedules with time slots
    // This would be where you implement complex business logic
    // to ensure all data services are synchronized
  }

  /**
   * Update calendar from schedule data
   */
  private updateCalendarFromData(calendarData: any[]): void {
    // This would transform the calendar data into CalendarEvent objects
    // for display in the calendar view
    this.updateCalendarFromSchedules();
  }

  /**
   * Update calendar from delivery schedules
   */
  private updateCalendarFromSchedules(): void {
    if (!this.deliverySchedules.length) return;

    const events: CalendarEvent[] = this.deliverySchedules.map(schedule => ({
      id: schedule.id,
      title: this.formatScheduleTitle(schedule),
      start: new Date(`${schedule.delivery_date}T${schedule.start_time}`),
      end: new Date(`${schedule.delivery_date}T${schedule.end_time}`),
      color: this.getEventColorByStatus(schedule.status),
      allDay: false,
      draggable: this.enableDragDrop && schedule.can_be_modified,
      resizable: {
        beforeStart: this.enableDragDrop && schedule.can_be_modified,
        afterEnd: this.enableDragDrop && schedule.can_be_modified
      },
      meta: {
        type: 'delivery',
        data: schedule,
        canModify: schedule.can_be_modified
      }
    }));

    this.calendarEvents = events;
  }

  /**
   * Format schedule title for calendar display
   */
  private formatScheduleTitle(schedule: DeliverySchedule): string {
    const customerName = schedule.shipment?.customer?.name || 'Customer';
    const timeSlot = schedule.time_slot || `${schedule.start_time}-${schedule.end_time}`;
    return `Delivery #${schedule.id} - ${customerName}`;
  }

  /**
   * Get event color by status
   */
  private getEventColorByStatus(status: string): any {
    const colors = {
      scheduled: { primary: '#007bff', secondary: '#E6F3FF' },
      in_progress: { primary: '#ffc107', secondary: '#FFF8E1' },
      completed: { primary: '#28a745', secondary: '#E8F5E8' },
      cancelled: { primary: '#dc3545', secondary: '#FFE8E8' }
    };
    return colors[status] || colors.scheduled;
  }

  /**
   * Handle calendar event selection
   */
  onCalendarEventSelected(event: CalendarEvent): void {
    if (event.meta.type === 'delivery') {
      this.selectedSchedule = event.meta.data as DeliverySchedule;
      this.activeView = 'schedule';
    }
  }

  /**
   * Handle calendar event drag/drop
   */
  onCalendarEventDragged(event: any): void {
    if (this.enableDragDrop && event.event.meta.canModify) {
      const schedule = event.event.meta.data as DeliverySchedule;
      const newStart = event.newStart;
      const newEnd = event.newEnd;

      // This would trigger a reschedule operation
      console.log('Rescheduling delivery:', schedule.id, 'to:', newStart, '-', newEnd);
    }
  }

  /**
   * Handle time slot selection
   */
  onTimeSlotSelected(slot: DeliveryTimeSlot): void {
    this.selectedTimeSlot = slot;

    if (this.selectedSchedule) {
      this.assignScheduleToTimeSlot(this.selectedSchedule, slot);
    }
  }

  /**
   * Assign schedule to time slot
   */
  private assignScheduleToTimeSlot(schedule: DeliverySchedule, slot: DeliveryTimeSlot): void {
    if (this.planningMode === 'single') {
      this.performTimeSlotAssignment(schedule, slot);
    } else {
      // Handle bulk assignment logic
      console.log('Bulk assignment not implemented yet');
    }
  }

  /**
   * Perform time slot assignment
   */
  private performTimeSlotAssignment(schedule: DeliverySchedule, slot: DeliveryTimeSlot): void {
    this.loadingState$.next('loading');

    const assignmentRequest = {
      schedule_id: schedule.id,
      time_slot_id: slot.id,
      driver_id: this.activeDriverId,
      date: new Date(this.currentDate).toISOString().split('T')[0]
    };

    // This would call an API to assign the schedule to the time slot
    console.log('Assigning schedule to time slot:', assignmentRequest);

    // For now, simulate success
    setTimeout(() => {
      schedule.time_slot = `${slot.start_time}-${slot.end_time}`;
      schedule.start_time = slot.start_time;
      schedule.end_time = slot.end_time;

      this.selectedSchedule = schedule;
      this.loadingState$.next('succeeded');

      // Notify parent component
      this.schedulePlanned.emit(schedule);
    }, 1000);
  }

  /**
   * Handle route optimization request
   */
  optimizeRoute(): void {
    if (!this.selectedRoutePlan && !this.deliverySchedules.length) return;

    this.optimizationInProgress = true;

    const optimizationRequest: RouteOptimizationRequest = {
      driver_id: this.activeDriverId!,
      delivery_ids: this.deliverySchedules.map(s => s.id),
      optimization_criteria: 'time',
      algorithm: 'google_maps'
    };

    // Emit optimization request for parent component to handle
    this.routeOptimized.emit(this.selectedRoutePlan!);

    // Simulate optimization process
    setTimeout(() => {
      this.optimizationInProgress = false;
    }, 3000);
  }

  /**
   * Add new delivery schedule
   */
  addNewSchedule(): void {
    this.draftSchedule = {
      driver_id: this.activeDriverId!,
      delivery_date: new Date(this.currentDate).toISOString().split('T')[0],
      status: 'scheduled'
    };
    this.activeView = 'schedule';
  }

  /**
   * Save draft schedule
   */
  saveDraftSchedule(): void {
    if (!this.draftSchedule || !this.selectedTimeSlot) return;

    const newSchedule: DeliverySchedule = {
      id: Date.now(), // Temporary ID
      driver_id: this.draftSchedule.driver_id!,
      shipment_id: 0, // Would be set from actual shipment
      delivery_date: this.draftSchedule.delivery_date!,
      start_time: this.selectedTimeSlot.start_time,
      end_time: this.selectedTimeSlot.end_time,
      time_slot: `${this.selectedTimeSlot.start_time}-${this.selectedTimeSlot.end_time}`,
      estimated_duration: 45, // Default
      estimated_distance: 10, // Default
      route_order: this.deliverySchedules.length + 1,
      sequence_current_step: 1,
      sequence_total_steps: 1,
      status: 'scheduled',
      progress_percentage: 0,
      can_be_modified: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.deliverySchedules.push(newSchedule);
    this.updateCalendarFromSchedules();
    this.draftSchedule = null;
    this.selectedTimeSlot = null;

    this.schedulePlanned.emit(newSchedule);
  }

  /**
   * Cancel draft schedule
   */
  cancelDraftSchedule(): void {
    this.draftSchedule = null;
    this.selectedTimeSlot = null;
  }

  /**
   * Navigate to different views
   */
  navigateToView(view: 'calendar' | 'schedule' | 'route' | 'conflicts'): void {
    this.activeView = view;
  }

  /**
   * Refresh planner data
   */
  refresh(): void {
    this.loadPlannerData();
    this.refreshRequested.emit();
  }

  /**
   * Setup auto refresh
   */
  private setupAutoRefresh(): void {
    if (!this.autoRefresh || this.refreshInterval <= 0) return;

    this.cleanupAutoRefresh();
    this.refreshTimer = setInterval(() => {
      if (this.loadingState$.value !== 'loading' && !this.optimizationInProgress) {
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
   * Loading state accessors
   */
  isLoading(): boolean {
    return this.loadingState$.value === 'loading';
  }

  hasError(): boolean {
    return this.loadingState$.value === 'failed';
  }

  getErrorMessage(): Observable<string | null> {
    return this.error$.asObservable();
  }

  /**
   * State helpers
   */
  hasConflicts(): boolean {
    return this.scheduleConflicts != null && this.scheduleConflicts.conflicts.length > 0;
  }

  canOptimize(): boolean {
    return this.enableRouteOptimization && !!this.selectedRoutePlan && !this.optimizationInProgress;
  }

  canAddSchedule(): boolean {
    return this.mode === 'scheduling' && this.deliverySchedules.length < this.plannerConfig.maxDeliveriesPerDay;
  }
}