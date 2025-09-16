import { Component, OnInit, OnDestroy, ViewChild, TemplateRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import { CalendarEvent, CalendarView, CalendarEventAction, CalendarEventTimesChangedEvent } from 'angular-calendar';

import { CalendarService } from '../../core/services/calendar.service';
import { TimeSlotService } from '../../core/services/time-slot.service';
import { RouteService } from '../../core/services/route.service';
import { LoadingService } from '../../core/services/loading.service';
import {
  DeliverySchedule,
  DeliveryTimeSlot,
  RoutePlan,
  CalendarViewMode,
  CalendarData,
  DriverAvailability
} from '../../core/models/schedule.model';
import { User } from '../../core/models/user.model';
import { LoadingState } from '../../core/models/loading.model';

@Component({
  selector: 'app-calendar-delivery',
  templateUrl: './calendar-delivery.component.html',
  styleUrls: ['./calendar-delivery.component.scss']
})
export class CalendarDeliveryComponent implements OnInit, OnDestroy {
  @ViewChild('modalContent', { static: true }) modalContent!: TemplateRef<any>;

  private destroy$ = new Subject<void>();
  loadingState$: BehaviorSubject<LoadingState> = new BehaviorSubject<LoadingState>('idle');

  // Calendar configuration
  view: CalendarView = CalendarView.Month;
  viewDate: Date = new Date();
  CalendarView = CalendarView;
  viewMode: CalendarViewMode = 'month';

  // Data sources
  calendarEvents: CalendarEvent[] = [];
  deliverySchedules: DeliverySchedule[] = [];
  timeSlots: DeliveryTimeSlot[] = [];
  routePlans: RoutePlan[] = [];
  availableDrivers: User[] = [];
  selectedDriverIds: number[] = [];

  // Filters and state
  selectedStatus = 'all';
  showTimeSlots = true;
  showRoutePlans = true;
  showDriverAvailability = true;

  // Modal and overlay
  selectedSchedule: DeliverySchedule | null = null;
  modalData: any = {};
  activeDayIsOpen = false;

  // Refresh trigger
  refresh$ = new Subject<void>();

  constructor(
    private readonly router: Router,
    private readonly calendarService: CalendarService,
    private readonly timeSlotService: TimeSlotService,
    private readonly routeService: RouteService,
    private readonly loadingService: LoadingService
  ) {}

  ngOnInit(): void {
    this.loadCalendarData();
    this.setupRealTimeUpdates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load calendar data based on current view and filters
   */
  private loadCalendarData(): void {
    if (this.loadingState$.value === 'loading') return;

    this.loadingState$.next('loading');

    const { startOfWeek, endOfWeek, startOfMonth, endOfMonth } = this.getDateRange();
    const dateRange = this.getCurrentDateRange();

    this.calendarService.getCalendarData({
      start_date: dateRange.start.toISOString().split('T')[0],
      end_date: dateRange.end.toISOString().split('T')[0],
      driver_ids: this.selectedDriverIds.length > 0 ? this.selectedDriverIds : undefined,
      status: this.selectedStatus !== 'all' ? this.selectedStatus as any : undefined
    }).pipe(
      takeUntil(this.destroy$),
      switchMap((calendarData: CalendarData[]) => {
        this.processCalendarData(calendarData);
        return this.loadSupportingData();
      })
    ).subscribe({
      next: () => {
        this.loadingState$.next('succeeded');
        this.updateCalendarEvents();
      },
      error: (error) => {
        console.error('Calendar error:', error);
        this.loadingState$.next('failed');
      }
    });
  }

  /**
   * Get current date range based on view mode
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
   * Load supporting data (time slots, route plans)
   */
  private loadSupportingData(): Observable<void> {
    const { start, end } = this.getCurrentDateRange();

    const loadTimeSlots$ = this.showTimeSlots
      ? this.timeSlotService.getTimeSlotsForDateRange(start, end, this.selectedDriverIds)
      : this.loadingService.resolve$([]);

    const loadRoutePlans$ = this.showRoutePlans
      ? this.routeService.getRoutePlans(start.toISOString().split('T')[0], end.toISOString().split('T')[0])
      : this.loadingService.resolve$([]);

    return this.loadingService.loadMultiple$(
      [loadTimeSlots$, loadRoutePlans$],
      (timeSlots, routePlans) => {
        this.timeSlots = timeSlots;
        this.routePlans = routePlans;
      }
    );
  }

  /**
   * Process calendar data and convert to events
   */
  private processCalendarData(calendarData: CalendarData[]): void {
    this.deliverySchedules = calendarData.map(data => this.mapCalendarDataToSchedule(data));
  }

  /**
   * Map calendar data to delivery schedule
   */
  private mapCalendarDataToSchedule(data: CalendarData): DeliverySchedule {
    return {
      id: data.id,
      shipment_id: data.shipment_id,
      driver_id: data.driver_id,
      delivery_date: data.delivery_date,
      start_time: data.start_time,
      end_time: data.end_time,
      time_slot: data.time_slot,
      estimated_duration: data.estimated_duration,
      estimated_distance: data.estimated_distance,
      route_order: data.route_order,
      sequence_current_step: data.sequence_current_step,
      sequence_total_steps: data.sequence_total_steps,
      status: data.status,
      progress_percentage: data.progress_percentage,
      can_be_modified: data.can_be_modified,
      metadata: data.metadata,
      notes: data.notes,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  /**
   * Update calendar events from schedules and time slots
   */
  private updateCalendarEvents(): void {
    const events: CalendarEvent[] = [];

    // Add delivery schedule events
    this.deliverySchedules.forEach(schedule => {
      events.push(this.createDeliveryScheduleEvent(schedule));
    });

    // Add time slot events
    if (this.showTimeSlots) {
      this.timeSlots.forEach(slot => {
        events.push(this.createTimeSlotEvent(slot));
      });
    }

    this.calendarEvents = events;
  }

  /**
   * Create a calendar event from a delivery schedule
   */
  private createDeliveryScheduleEvent(schedule: DeliverySchedule): CalendarEvent {
    const start = new Date(`${schedule.delivery_date}T${schedule.start_time}`);
    const end = new Date(`${schedule.delivery_date}T${schedule.end_time}`);

    return {
      id: schedule.id,
      title: `Delivery #${schedule.id} - ${schedule.shipment?.customer?.name || 'Customer'}`,
      start,
      end,
      color: this.getEventColor(schedule.status),
      actions: this.getScheduleActions(schedule),
      allDay: false,
      draggable: schedule.can_be_modified,
      resizable: {
        beforeStart: schedule.can_be_modified,
        afterEnd: schedule.can_be_modified
      },
      meta: {
        type: 'schedule',
        data: schedule
      }
    };
  }

  /**
   * Create a calendar event from a time slot
   */
  private createTimeSlotEvent(slot: DeliveryTimeSlot): CalendarEvent {
    const start = new Date(`${slot.slot_date}T${slot.start_time}`);
    const end = new Date(`${slot.slot_date}T${slot.end_time}`);

    return {
      id: slot.id,
      title: `${slot.slot_label} (${slot.booked}/${slot.capacity})`,
      start,
      end,
      color: this.getTimeSlotColor(slot.availability),
      allDay: false,
      draggable: false,
      resizable: { beforeStart: false, afterEnd: false },
      meta: {
        type: 'time_slot',
        data: slot
      }
    };
  }

  /**
   * Get event color based on status
   */
  private getEventColor(status: string): any {
    const colors = {
      scheduled: { primary: '#007bff', secondary: '#E6F3FF' },
      in_progress: { primary: '#ffc107', secondary: '#FFF8E1' },
      completed: { primary: '#28a745', secondary: '#E8F5E8' },
      cancelled: { primary: '#dc3545', secondary: '#FFE8E8' }
    };
    return colors[status] || colors.scheduled;
  }

  /**
   * Get time slot color based on availability
   */
  private getTimeSlotColor(availability: string): any {
    const colors = {
      available: { primary: '#28a745', secondary: '#E8F5E8' },
      limited: { primary: '#ffc107', secondary: '#FFF8E1' },
      full: { primary: '#dc3545', secondary: '#FFE8E8' },
      blocked: { primary: '#6c757d', secondary: '#F8F9FA' }
    };
    return colors[availability] || colors.available;
  }

  /**
   * Get schedule actions for calendar events
   */
  private getScheduleActions(schedule: DeliverySchedule): CalendarEventAction[] {
    return [
      {
        label: '<i class=\"fas fa-eye\"></i>',
        a11yLabel: 'View',
        onClick: ({ event }: { event: CalendarEvent }): void => {
          this.viewSchedule(event.meta.data as DeliverySchedule);
        }
      },
      {
        label: '<i class=\"fas fa-map-route\"></i>',
        a11yLabel: 'Route',
        onClick: ({ event }: { event: CalendarEvent }): void => {
          this.viewRoute((event.meta.data as DeliverySchedule).route_plan_id);
        }
      }
    ];
  }

  /**
   * Handle view switching (day/week/month)
   */
  setView(view: CalendarView): void {
    this.view = view;
    this.viewMode = view.toLowerCase() as CalendarViewMode;
    this.loadCalendarData();
  }

  /**
   * Handle date changes
   */
  viewChange(date: Date): void {
    this.viewDate = date;
    this.loadCalendarData();
  }

  /**
   * Handle previous/next navigation
   */
  prevView(): void {
    this.addTime(-1);
  }

  nextView(): void {
    this.addTime(1);
  }

  /**
   * Add time to current view date
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
   * Handle event click
   */
  eventClicked(event: CalendarEvent): void {
    if (event.meta.type === 'schedule') {
      this.viewSchedule(event.meta.data as DeliverySchedule);
    } else if (event.meta.type === 'time_slot') {
      this.viewTimeSlot(event.meta.data as DeliveryTimeSlot);
    }
  }

  /**
   * Handle day click
   */
  dayClicked(day: any): void {
    if (this.viewMode === 'month') {
      this.viewDate = day.date;
      this.setView(CalendarView.Day);
    }
  }

  /**
   * Refresh calendar data
   */
  refresh(): void {
    this.loadCalendarData();
    this.refresh$.next();
  }

  /**
   * View schedule details
   */
  private viewSchedule(schedule: DeliverySchedule): void {
    this.selectedSchedule = schedule;
    this.overlayService.open({
      component: 'schedule-details',
      data: { schedule }
    });
  }

  /**
   * View time slot details
   */
  private viewTimeSlot(slot: DeliveryTimeSlot): void {
    this.overlayService.open({
      component: 'time-slot-details',
      data: { slot }
    });
  }

  /**
   * View route for schedule
   */
  private viewRoute(routePlanId?: number): void {
    if (!routePlanId) return;

    this.router.navigate(['/delivery/route', routePlanId]);
  }

  /**
   * Setup real-time updates using WebSocket
   */
  private setupRealTimeUpdates(): void {
    // WebSocket integration will be added here
    // For now, we'll use a polling mechanism
    setInterval(() => {
      if (this.loadingState$.value !== 'loading') {
        this.refresh();
      }
    }, 30000); // Refresh every 30 seconds
  }

  /**
   * Get view title for current calendar view
   */
  getViewTitle(): Observable<string> {
    const start = new Date(this.viewDate);
    const end = new Date(this.viewDate);

    switch (this.viewMode) {
      case 'day':
        return new BehaviorSubject<string>(`Day View - ${start.toLocaleDateString()}`);
      case 'week':
        const startOfWeek = new Date(start);
        startOfWeek.setDate(start.getDate() - start.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return new BehaviorSubject<string>(`Week View - ${startOfWeek.toLocaleDateString()} to ${endOfWeek.toLocaleDateString()}`);
      case 'month':
        return new BehaviorSubject<string>(`Month View - ${start.toLocaleDateString('default', { month: 'long', year: 'numeric' })}`);
      default:
        return new BehaviorSubject<string>('Calendar View');
    }
  }

  /**
   * Open new schedule modal
   */
  openNewScheduleModal(): void {
    // Implementation for opening new schedule modal
    console.log('Opening new schedule modal...');
  }

  /**
   * Handle filter changes
   */
  onFilterChange(): void {
    this.loadCalendarData();
  }

  /**
   * Handle event time changes
   */
  eventTimesChanged(event: CalendarEventTimesChangedEvent): void {
    // Handle rescheduling via drag and drop
    if (event.event && event.event.meta.type === 'schedule') {
      const schedule = event.event.meta.data as DeliverySchedule;
      this.rescheduleDelivery(schedule, event.newStart, event.newEnd);
    }
  }

  /**
   * Reschedule delivery
   */
  private rescheduleDelivery(schedule: DeliverySchedule, newStart: Date, newEnd: Date): void {
    // Implementation for rescheduling delivery
    console.log('Rescheduling delivery:', schedule.id, 'from', newStart, 'to', newEnd);
  }

  /**
   * Close modal
   */
  closeModal(): void {
    this.selectedSchedule = null;
    this.modalData = {};
  }

  /**
   * Get status badge CSS class
   */
  getStatusBadgeClass(status: string): string {
    const classMap = {
      'scheduled': 'badge-primary',
      'in_progress': 'badge-warning',
      'completed': 'badge-success',
      'cancelled': 'badge-danger'
    };
    return classMap[status] || 'badge-secondary';
  }

  /**
   * Get selected sequence data
   */
  get selectedSequence() {
    if (!this.selectedSchedule) {
      return { current_step: 0, total_steps: 0, next_delivery: null };
    }
    return {
      current_step: this.selectedSchedule.sequence_current_step || 0,
      total_steps: this.selectedSchedule.sequence_total_steps || 0,
      next_delivery: this.selectedSchedule.metadata?.next_delivery || null
    };
  }

  /**
   * Get date range helpers for calendar
   */
  private getDateRange() {
    const startOfWeek = new Date(this.viewDate);
    const endOfWeek = new Date(this.viewDate);
    const startOfMonth = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth(), 1);
    const endOfMonth = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 0);

    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    return { startOfWeek, endOfWeek, startOfMonth, endOfMonth };
  }
}