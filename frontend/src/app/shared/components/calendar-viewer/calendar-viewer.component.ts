import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ViewChild, TemplateRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarModule,CalendarEvent, CalendarView, CalendarEventAction, CalendarEventTimesChangedEvent } from 'angular-calendar';
import { Subject, Observable, BehaviorSubject, of } from 'rxjs';
import { takeUntil, switchMap, catchError } from 'rxjs/operators';

// FullCalendar integration types and features
interface FullCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end?: Date;
  allDay?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps?: any;
}

import { CalendarService } from '../../../core/services/calendar.service';
import { LoadingService } from '../../../core/services/loading.service';
import {
  CalendarData,
  CalendarSummary,
  DeliverySchedule,
  DeliveryTimeSlot,
  CalendarViewMode
} from '../../../core/models/schedule.model';
import { LoadingState } from '../../../core/models/loading.model';

/**
 * Standalone Calendar Viewer Component
 *
 * A reusable calendar component that provides:
 * - Multiple view modes (day/week/month)
 * - Delivery schedule visualization
 * - Time slot display
 * - Interactive event handling
 * - Real-time data updates
 *
 * @usageNotes
 * This component can be used independently throughout the application
 * for displaying calendar data with different configurations.
 */

@Component({
  selector: 'app-calendar-viewer',
  templateUrl: './calendar-viewer.component.html',
  styleUrls: ['./calendar-viewer.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CalendarModule
  ]
})
export class CalendarViewerComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('modalContent', { static: true }) modalContent!: TemplateRef<any>;

  @Input() viewMode: CalendarViewMode = 'month';
  @Input() initialDate: Date = new Date();
  @Input() driverIds: number[] = [];
  @Input() statusFilter: 'all' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' = 'all';
  @Input() showTimeSlots = true;
  @Input() showMonthNavigation = true;
  @Input() showViewControls = true;
  @Input() showFilters = true;
  @Input() showLegend = true;
  @Input() showTimeIndicators = true; // FullCalendar-style time indicators
  @Input() enableEventGrouping = true; // Group events by type
  @Input() enableFullCalendarFeatures = true; // Enable FullCalendar-style features
  @Input() enableDragDrop = true;
  @Input() enableClickEvents = true;
  @Input() enableMultiSelect = false; // FullCalendar multi-select feature
  @Input() modalSize: 'sm' | 'lg' | 'xl' = 'lg';
  @Input() customEventActions: CalendarEventAction[] = [];

  @Output() eventClicked = new EventEmitter<CalendarEvent>();
  @Output() dayClicked = new EventEmitter<Date>();
  @Output() viewChanged = new EventEmitter<{ view: CalendarViewMode; date: Date }>();
  @Output() eventRescheduled = new EventEmitter<{ schedule: DeliverySchedule; newStart: Date; newEnd: Date }>();
  @Output() refreshRequested = new EventEmitter<void>();
  @Output() errorOccurred = new EventEmitter<Error>();
  @Output() loadingStateChanged = new EventEmitter<LoadingState>();

  private destroy$ = new Subject<void>();
  private refreshTimer: any;

  loadingState$: BehaviorSubject<LoadingState> = new BehaviorSubject<LoadingState>('idle');
  error$ = new BehaviorSubject<string | null>(null);

  // Calendar configuration
  view: CalendarView = CalendarView.Month;
  viewDate: Date = new Date();
  CalendarView = CalendarView;

  // Data sources
  calendarEvents: CalendarEvent[] = [];
  calendarData: CalendarData[] = [];
  deliverySchedules: DeliverySchedule[] = [];
  timeSlots: DeliveryTimeSlot[] = [];
  calendarSummary: CalendarSummary | null = null;

  // State management
  selectedEvent: CalendarEvent | null = null;
  modalData: any = {};
  activeDayIsOpen = false;
  refresh$ = new Subject<void>();

  // FullCalendar-specific state
  showAdvancedControls = false;
  enableFullCalendarMode = true;
  multiSelectedEvents: CalendarEvent[] = [];
  eventGrouping: 'none' | 'driver' | 'status' = 'none';
  timeIndicators: CalendarEvent[] = []; // FullCalendar-style time indicators

  // Auto refresh configuration
  autoRefresh = true;
  refreshInterval = 30000; // 30 seconds

  // Map configuration for FullCalendar
  mapConfig = {
    center: { lat: 51.509865, lng: -0.118092 }, // London
    zoom: 10,
    showMarkers: true,
    showRoutes: true,
    enableTrafficLayer: true
  };

  constructor(
    private readonly calendarService: CalendarService,
    private readonly loadingService: LoadingService
  ) {
    this.viewDate = this.initialDate;
  }

  ngOnInit(): void {
    this.initializeViewMode();
    this.loadCalendarData();
    this.setupAutoRefresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['viewMode'] && !changes['viewMode'].firstChange) {
      this.setView(this.viewMode);
    }
    if (changes['initialDate'] && !changes['initialDate'].firstChange) {
      this.viewDate = this.initialDate;
      this.loadCalendarData();
    }
    if ((changes['driverIds'] || changes['statusFilter']) && !changes['driverIds']?.firstChange) {
      this.loadCalendarData();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanupAutoRefresh();
  }

  /**
   * Initialize view mode from input
   */
  private initializeViewMode(): void {
    switch (this.viewMode) {
      case 'day':
        this.view = CalendarView.Day;
        break;
      case 'week':
        this.view = CalendarView.Week;
        break;
      case 'month':
        this.view = CalendarView.Month;
        break;
      default:
        this.view = CalendarView.Month;
    }
  }

  /**
   * Load calendar data based on current configuration
   */
  private loadCalendarData(): void {
    if (this.loadingState$.value === 'loading') return;

    this.loadingState$.next('loading');
    this.error$.next(null);

    const dateRange = this.getCurrentDateRange();
    const params = {
      start_date: dateRange.start.toISOString().split('T')[0],
      end_date: dateRange.end.toISOString().split('T')[0],
      driver_ids: this.driverIds.length > 0 ? this.driverIds : undefined,
      status: this.statusFilter !== 'all' ? this.statusFilter : undefined
    };

    this.calendarService.getCalendarData(params)
      .pipe(
        takeUntil(this.destroy$),
        switchMap((calendarData: CalendarData[]) => {
          this.processCalendarData(calendarData);
          return this.loadSupportingData();
        }),
        catchError((error) => {
          this.handleError('Failed to load calendar data', error);
          return of(null);
        })
      )
      .subscribe({
        next: () => {
          this.loadingState$.next('succeeded');
          this.updateCalendarEvents();
          this.loadingStateChanged.emit('succeeded');
        },
        error: (error) => {
          this.handleError('Calendar data loading failed', error);
        }
      });
  }

  /**
   * Load supporting data (time slots, etc.)
   */
  private loadSupportingData(): Observable<void> {
    if (!this.showTimeSlots) {
      return this.loadingService.resolve$(undefined);
    }

    // Load time slots based on current date range
    // This is a placeholder - implement actual time slot loading if needed
    return this.loadingService.resolve$(undefined);
  }

  /**
   * Process calendar data
   */
  private processCalendarData(data: CalendarData[]): void {
    this.calendarData = data;
    this.deliverySchedules = data.flatMap(dayData => dayData.schedules || []);
    this.timeSlots = data.flatMap(dayData => dayData.time_slots || []);
  }

  /**
   * Update calendar events from processed data
   */
  private updateCalendarEvents(): void {
    const events: CalendarEvent[] = [];

    // Add delivery schedule events
    this.deliverySchedules.forEach(schedule => {
      events.push(this.createDeliveryScheduleEvent(schedule));
    });

    // Add time slot events if enabled
    if (this.showTimeSlots) {
      this.timeSlots.forEach(slot => {
        events.push(this.createTimeSlotEvent(slot));
      });
    }

    this.calendarEvents = events;
  }

  /**
   * Create calendar event from delivery schedule
   */
  private createDeliveryScheduleEvent(schedule: DeliverySchedule): CalendarEvent {
    const start = new Date(`${schedule.delivery_date}T${schedule.start_time}`);
    const end = new Date(`${schedule.delivery_date}T${schedule.end_time}`);

    return {
      id: schedule.id,
      title: this.formatDeliveryTitle(schedule),
      start,
      end,
      color: this.getEventColorByStatus(schedule.status),
      actions: this.createEventActions('delivery', schedule),
      allDay: false,
      draggable: this.enableDragDrop && schedule.can_be_modified,
      resizable: {
        beforeStart: this.enableDragDrop && schedule.can_be_modified,
        afterEnd: this.enableDragDrop && schedule.can_be_modified
      },
      meta: {
        type: 'delivery',
        data: schedule,
        originalData: schedule
      }
    };
  }

  /**
   * Create calendar event from time slot
   */
  private createTimeSlotEvent(slot: DeliveryTimeSlot): CalendarEvent {
    const start = new Date(`${slot.slot_date}T${slot.start_time}`);
    const end = new Date(`${slot.slot_date}T${slot.end_time}`);

    return {
      id: slot.id,
      title: this.formatTimeSlotTitle(slot),
      start,
      end,
      color: this.getTimeSlotColorByAvailability(slot.availability),
      allDay: false,
      draggable: false,
      resizable: { beforeStart: false, afterEnd: false },
      meta: {
        type: 'time_slot',
        data: slot,
        originalData: slot
      }
    };
  }

  /**
   * Format delivery title
   */
  private formatDeliveryTitle(schedule: DeliverySchedule): string {
    return `Delivery #${schedule.id} - ${schedule.shipment?.customer?.name || 'Customer'}`;
  }

  /**
   * Format time slot title
   */
  private formatTimeSlotTitle(slot: DeliveryTimeSlot): string {
    return `${slot.slot_label} (${slot.booked}/${slot.capacity})`;
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
   * Get time slot color by availability
   */
  private getTimeSlotColorByAvailability(availability: string): any {
    const colors = {
      available: { primary: '#28a745', secondary: '#E8F5E8' },
      limited: { primary: '#ffc107', secondary: '#FFF8E1' },
      full: { primary: '#dc3545', secondary: '#FFE8E8' },
      blocked: { primary: '#6c757d', secondary: '#F8F9FA' }
    };
    return colors[availability] || colors.available;
  }

  /**
   * Create event actions
   */
  private createEventActions(type: string, data: any): CalendarEventAction[] {
    const actions: CalendarEventAction[] = [];

    if (type === 'delivery') {
      actions.push({
        label: '<i class="fas fa-eye"></i>',
        a11yLabel: 'View Details',
        onClick: ({ event }: { event: CalendarEvent }): void => {
          this.onEventClick(event);
        }
      });

      if (data.route_plan_id) {
        actions.push({
          label: '<i class="fas fa-map-route"></i>',
          a11yLabel: 'View Route',
          onClick: ({ event }: { event: CalendarEvent }): void => {
            this.onEventClick(event);
          }
        });
      }
    }

    // Add custom actions
    actions.push(...this.customEventActions);

    return actions;
  }

  /**
   * Handle event click
   */
  onEventClick(event: CalendarEvent): void {
    if (this.enableClickEvents) {
      this.selectedEvent = event;
      this.eventClicked.emit(event);
    }
  }

  /**
   * Handle day click
   */
  onDayClick(day: any): void {
    if (this.enableClickEvents && this.view === CalendarView.Month) {
      this.viewDate = day.date;
      this.setView('day');
      this.dayClicked.emit(this.viewDate);
    }
  }

  /**
   * Handle event time changes (for drag and drop)
   */
  onEventTimesChanged(event: CalendarEventTimesChangedEvent): void {
    if (this.enableDragDrop && event.event.meta.type === 'delivery') {
      const schedule = event.event.meta.data as DeliverySchedule;
      this.eventRescheduled.emit({
        schedule,
        newStart: event.newStart,
        newEnd: event.newEnd
      });
    }
  }

  /**
   * Change calendar view
   */
  setView(view: CalendarViewMode): void {
    this.viewMode = view;
    switch (view) {
      case 'day':
        this.view = CalendarView.Day;
        break;
      case 'week':
        this.view = CalendarView.Week;
        break;
      case 'month':
        this.view = CalendarView.Month;
        break;
    }
    this.loadCalendarData();
    this.viewChanged.emit({ view: this.viewMode, date: this.viewDate });
  }

  /**
   * Navigate to previous time period
   */
  previousView(): void {
    this.addTime(-1);
  }

  /**
   * Navigate to next time period
   */
  nextView(): void {
    this.addTime(1);
  }

  /**
   * Navigate to today
   */
  goToToday(): void {
    this.viewDate = new Date();
    this.loadCalendarData();
  }

  /**
   * Add time to current view
   */
  private addTime(amount: number): void {
    switch (this.viewMode) {
      case 'day':
        this.viewDate.setDate(this.viewDate.getDate() + amount);
        break;
      case 'week':
        this.viewDate.setDate(this.viewDate.getDate() + (amount * 7));
        break;
      case 'month':
        this.viewDate.setMonth(this.viewDate.getMonth() + amount);
        break;
    }
    this.loadCalendarData();
  }

  /**
   * Refresh calendar data
   */
  refresh(): void {
    this.loadCalendarData();
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
   * Get current date range
   */
  private getCurrentDateRange(): { start: Date, end: Date } {
    const start = new Date(this.viewDate);
    const end = new Date(this.viewDate);

    switch (this.viewMode) {
      case 'day':
        end.setDate(start.getDate() + 1);
        break;
      case 'week':
        const dayOfWeek = start.getDay();
        start.setDate(start.getDate() - dayOfWeek);
        end.setDate(start.getDate() + 6);
        break;
      case 'month':
        start.setDate(1);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        break;
      default:
        start.setDate(start.getDate() - 7);
        end.setDate(end.getDate() + 7);
    }

    return { start, end };
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
   * Get current view title
   */
  getViewTitle(): string {
    const start = new Date(this.viewDate);
    const end = new Date(this.viewDate);

    switch (this.viewMode) {
      case 'day':
        return `Day View - ${start.toLocaleDateString()}`;
      case 'week':
        const startOfWeek = new Date(start);
        startOfWeek.setDate(start.getDate() - start.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return `Week View - ${startOfWeek.toLocaleDateString()} to ${endOfWeek.toLocaleDateString()}`;
      case 'month':
        return `Month View - ${start.toLocaleDateString('default', { month: 'long', year: 'numeric' })}`;
      default:
        return 'Calendar View';
    }
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
   * Check if calendar has data
   */
  hasData(): boolean {
    return this.calendarEvents.length > 0;
  }

  /**
   * Get error message
   */
  getErrorMessage(): Observable<string | null> {
    return this.error$.asObservable();
  }

  /**
   * Get event by ID
   */
  getEventById(id: number | string): CalendarEvent | undefined {
    return this.calendarEvents.find(event => event.id === id);
  }

  /**
   * Clear selected event
   */
  clearSelectedEvent(): void {
    this.selectedEvent = null;
  }

  /**
   * Manual trigger for loading state
   */
  setLoadingState(state: LoadingState): void {
    this.loadingState$.next(state);
    this.loadingStateChanged.emit(state);
  }
}