import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Observable, BehaviorSubject, of } from 'rxjs';
import { takeUntil, switchMap, catchError, map } from 'rxjs/operators';

import { TimeSlotService } from '../../../core/services/time-slot.service';
import { DeliveryTimeSlot, TimeSlotAvailability, TimeSlotConfiguration } from '../../../core/models/schedule.model';
import { LoadingState } from '../../../core/models/loading.model';

/**
 * Time Slot Selector Component
 *
 * A comprehensive time slot selection component that provides:
 * - Time slot availability display
 * - Interactive slot selection
 * - Capacity visualization
 * - Real-time booking status
 * - Multi-date slot selection
 * - Conflict detection
 *
 * @usageNotes
 * This component can be used for booking delivery time slots, managing
 * driver schedules, and displaying time slot availability across
 * different dates and drivers.
 */

@Component({
  selector: 'app-time-slot-selector',
  templateUrl: './time-slot-selector.component.html',
  styleUrls: ['./time-slot-selector.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ]
})
export class TimeSlotSelectorComponent implements OnInit, OnDestroy, OnChanges {
  @Input() driverId: number | null = null;
  @Input() selectedDate: Date = new Date();
  @Input() dateRange: { start: Date; end: Date } | null = null;
  @Input() selectionMode: 'single' | 'multiple' | 'range' = 'single';
  @Input() showAvailabilityIndicator = true;
  @Input() showCapacityDetails = true;
  @Input() showDriverSelector = false;
  @Input() availableDrivers: number[] = [];
  @Input() filterByAvailability: 'all' | 'available' | 'limited' | 'full' | 'blocked' = 'all';
  @Input() minCapacity = 1;
  @Input() enableBooking = false;
  @Input() enableConfiguration = false;
  @Input() bookingLimit = 1;
  @Input() showTimeLabels = true;
  @Input() compactView = false;
  @Input() theme: 'light' | 'dark' = 'light';
  @Input() autoRefresh = true;
  @Input() refreshInterval = 30000; // 30 seconds

  @Output() slotSelected = new EventEmitter<DeliveryTimeSlot>();
  @Output() slotsSelected = new EventEmitter<DeliveryTimeSlot[]>();
  @Output() bookingAttempted = new EventEmitter<DeliveryTimeSlot>();
  @Output() configurationRequested = new EventEmitter<TimeSlotConfiguration>();
  @Output() refreshRequested = new EventEmitter<void>();
  @Output() errorOccurred = new EventEmitter<Error>();
  @Output() loadingStateChanged = new EventEmitter<LoadingState>();

  private destroy$ = new Subject<void>();
  private refreshTimer: any;

  loadingState$: BehaviorSubject<LoadingState> = new BehaviorSubject<LoadingState>('idle');
  error$ = new BehaviorSubject<string | null>(null);

  // Data sources
  timeSlots: DeliveryTimeSlot[] = [];
  timeSlotAvailability: TimeSlotAvailability | null = null;
  selectedTimeSlots: DeliveryTimeSlot[] = [];
  configuration: TimeSlotConfiguration | null = null;

  // State management
  currentDate: Date = new Date();
  activeDriverId: number | null = null;
  slotSelectionState: Map<number, boolean> = new Map();
  bookingInProgress = false;
  refresh$ = new Subject<void>();

  // Time slot organization
  timeSlotGroups: TimeSlotGroup[] = [];
  morningSlots: DeliveryTimeSlot[] = [];
  afternoonSlots: DeliveryTimeSlot[] = [];
  eveningSlots: DeliveryTimeSlot[] = [];

  constructor(
    private readonly timeSlotService: TimeSlotService
  ) {}

  ngOnInit(): void {
    this.initializeComponent();
    this.loadTimeSlotData();
    this.setupAutoRefresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['driverId'] && !changes['driverId'].firstChange) {
      this.activeDriverId = this.driverId;
      this.loadTimeSlotData();
    }
    if (changes['selectedDate'] && !changes['selectedDate'].firstChange) {
      this.currentDate = this.selectedDate;
      this.loadTimeSlotData();
    }
    if (changes['dateRange'] && !changes['dateRange'].firstChange) {
      this.loadTimeSlotData();
    }
    if ((changes['filterByAvailability'] || changes['minCapacity']) && !changes['filterByAvailability']?.firstChange) {
      this.filterAndOrganizeTimeSlots();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanupAutoRefresh();
  }

  /**
   * Initialize component state
   */
  private initializeComponent(): void {
    this.currentDate = this.selectedDate;
    this.activeDriverId = this.driverId;
    this.selectedTimeSlots = [];
    this.slotSelectionState.clear();
  }

  /**
   * Load time slot data
   */
  private loadTimeSlotData(): void {
    if (!this.activeDriverId) return;
    if (this.loadingState$.value === 'loading') return;

    this.loadingState$.next('loading');
    this.error$.next(null);

    const dateRange = this.getEffectiveDateRange();

    this.timeSlotService.getTimeSlotAvailability(this.activeDriverId, dateRange.start, dateRange.end)
      .pipe(
        takeUntil(this.destroy$),
        switchMap((availability: TimeSlotAvailability) => {
          this.timeSlotAvailability = availability;
          this.timeSlots = availability.time_slots;
          return this.loadConfiguration();
        }),
        catchError((error) => {
          this.handleError('Failed to load time slot data', error);
          return of(null);
        })
      )
      .subscribe({
        next: () => {
          this.filterAndOrganizeTimeSlots();
          this.loadingState$.next('succeeded');
          this.loadingStateChanged.emit('succeeded');
        },
        error: (error) => {
          this.handleError('Time slot data loading failed', error);
        }
      });
  }

  /**
   * Load time slot configuration
   */
  private loadConfiguration(): Observable<void> {
    if (!this.activeDriverId || !this.enableConfiguration) {
      return of(undefined);
    }

    return this.timeSlotService.getTimeSlotConfiguration(this.activeDriverId)
      .pipe(
        takeUntil(this.destroy$),
        map((config: TimeSlotConfiguration) => {
          this.configuration = config;
          return undefined;
        }),
        catchError(() => {
          // Configuration loading is optional
          return of(undefined);
        })
      );
  }

  /**
   * Filter and organize time slots for display
   */
  private filterAndOrganizeTimeSlots(): void {
    if (!this.timeSlots.length) return;

    // Apply filters
    let filteredSlots = this.applyFilters(this.timeSlots);

    // Organize by time periods
    this.organizeByTimePeriod(filteredSlots);

    // Create time slot groups
    this.createTimeSlotGroups(filteredSlots);
  }

  /**
   * Apply filters to time slots
   */
  private applyFilters(slots: DeliveryTimeSlot[]): DeliveryTimeSlot[] {
    return slots.filter(slot => {
      // Availability filter
      if (this.filterByAvailability !== 'all' && slot.availability !== this.filterByAvailability) {
        return false;
      }

      // Minimum capacity filter
      if (slot.available_capacity < this.minCapacity) {
        return false;
      }

      return true;
    });
  }

  /**
   * Organize time slots by time periods
   */
  private organizeByTimePeriod(slots: DeliveryTimeSlot[]): void {
    this.morningSlots = slots.filter(slot => this.isMorningSlot(slot.start_time));
    this.afternoonSlots = slots.filter(slot => this.isAfternoonSlot(slot.start_time));
    this.eveningSlots = slots.filter(slot => this.isEveningSlot(slot.start_time));
  }

  /**
   * Create time slot groups for better organization
   */
  private createTimeSlotGroups(slots: DeliveryTimeSlot[]): void {
    const groups = new Map<string, DeliveryTimeSlot[]>();

    slots.forEach(slot => {
      const timeGroup = this.getTimeGroup(slot.start_time);
      if (!groups.has(timeGroup)) {
        groups.set(timeGroup, []);
      }
      groups.get(timeGroup)!.push(slot);
    });

    this.timeSlotGroups = Array.from(groups.entries()).map(([timeGroup, slots]) => ({
      timeGroup,
      slots: slots.sort((a, b) => a.start_time.localeCompare(b.start_time)),
      earliestTime: slots.reduce((earliest, slot) =>
        !earliest || slot.start_time < earliest ? slot.start_time : earliest, '' as string),
      latestTime: slots.reduce((latest, slot) =>
        !latest || slot.end_time > latest ? slot.end_time : latest, '' as string)
    }));
  }

  /**
   * Check if slot is morning time
   */
  private isMorningSlot(startTime: string): boolean {
    const hour = parseInt(startTime.split(':')[0]);
    return hour >= 6 && hour < 12;
  }

  /**
   * Check if slot is afternoon time
   */
  private isAfternoonSlot(startTime: string): boolean {
    const hour = parseInt(startTime.split(':')[0]);
    return hour >= 12 && hour < 18;
  }

  /**
   * Check if slot is evening time
   */
  private isEveningSlot(startTime: string): boolean {
    const hour = parseInt(startTime.split(':')[0]);
    return hour >= 18 || hour < 6;
  }

  /**
   * Get time group for organization
   */
  private getTimeGroup(startTime: string): string {
    const hour = parseInt(startTime.split(':')[0]);
    if (hour >= 6 && hour < 9) return 'Early Morning (6-9 AM)';
    if (hour >= 9 && hour < 12) return 'Morning (9-12 PM)';
    if (hour >= 12 && hour < 15) return 'Afternoon (12-3 PM)';
    if (hour >= 15 && hour < 18) return 'Late Afternoon (3-6 PM)';
    if (hour >= 18 && hour < 21) return 'Evening (6-9 PM)';
    return 'Night (9 PM-6 AM)';
  }

  /**
   * Get effective date range
   */
  private getEffectiveDateRange(): { start: Date; end: Date } {
    if (this.dateRange) {
      return this.dateRange;
    }

    const start = new Date(this.currentDate);
    const end = new Date(this.currentDate);
    end.setDate(end.getDate() + 7); // Default to 1 week

    return { start, end };
  }

  /**
   * Handle time slot selection
   */
  onSlotSelection(slot: DeliveryTimeSlot): void {
    if (!this.isSlotSelectable(slot)) return;

    switch (this.selectionMode) {
      case 'single':
        this.selectSingleSlot(slot);
        break;
      case 'multiple':
        this.toggleSlotSelection(slot);
        break;
      case 'range':
        this.selectSlotRange(slot);
        break;
    }
  }

  /**
   * Select single time slot
   */
  private selectSingleSlot(slot: DeliveryTimeSlot): void {
    this.selectedTimeSlots = [slot];
    this.slotSelected.emit(slot);
    this.slotsSelected.emit(this.selectedTimeSlots);

    // Update selection state
    this.slotSelectionState.clear();
    this.slotSelectionState.set(slot.id, true);
  }

  /**
   * Toggle slot selection for multiple mode
   */
  private toggleSlotSelection(slot: DeliveryTimeSlot): void {
    const index = this.selectedTimeSlots.findIndex(s => s.id === slot.id);

    if (index >= 0) {
      this.selectedTimeSlots.splice(index, 1);
      this.slotSelectionState.set(slot.id, false);
    } else {
      if (this.selectedTimeSlots.length < this.bookingLimit) {
        this.selectedTimeSlots.push(slot);
        this.slotSelectionState.set(slot.id, true);
      }
    }

    this.slotsSelected.emit(this.selectedTimeSlots);
  }

  /**
   * Select slot range
   */
  private selectSlotRange(slot: DeliveryTimeSlot): void {
    if (this.selectedTimeSlots.length === 0) {
      this.selectedTimeSlots = [slot];
    } else if (this.selectedTimeSlots.length === 1) {
      const range = this.createSlotRange(this.selectedTimeSlots[0], slot);
      this.selectedTimeSlots = range;
    } else {
      this.selectedTimeSlots = [slot];
    }

    this.slotsSelected.emit(this.selectedTimeSlots);
  }

  /**
   * Create slot range between two slots
   */
  private createSlotRange(startSlot: DeliveryTimeSlot, endSlot: DeliveryTimeSlot): DeliveryTimeSlot[] {
    const startIndex = this.timeSlots.findIndex(s => s.id === startSlot.id);
    const endIndex = this.timeSlots.findIndex(s => s.id === endSlot.id);

    if (startIndex === -1 || endIndex === -1) return [startSlot];

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    return this.timeSlots.slice(minIndex, maxIndex + 1);
  }

  /**
   * Check if slot is selectable
   */
  isSlotSelectable(slot: DeliveryTimeSlot): boolean {
    if (!slot.is_available) return false;
    if (slot.available_capacity < this.minCapacity) return false;

    if (this.selectionMode === 'multiple' && this.selectedTimeSlots.length >= this.bookingLimit) {
      return this.selectedTimeSlots.some(s => s.id === slot.id);
    }

    return true;
  }

  /**
   * Check if slot is selected
   */
  isSlotSelected(slot: DeliveryTimeSlot): boolean {
    return this.selectedTimeSlots.some(s => s.id === slot.id);
  }

  /**
   * Handle booking attempt
   */
  onBookingAttempt(slot: DeliveryTimeSlot): void {
    if (!this.enableBooking || !this.isSlotSelectable(slot)) return;

    this.bookingInProgress = true;
    this.bookingAttempted.emit(slot);

    this.timeSlotService.bookTimeSlot(slot.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedSlot: DeliveryTimeSlot) => {
          this.updateTimeSlotInList(updatedSlot);
          this.bookingInProgress = false;
        },
        error: (error) => {
          this.handleError('Booking failed', error);
          this.bookingInProgress = false;
        }
      });
  }

  /**
   * Update time slot in the local list
   */
  private updateTimeSlotInList(updatedSlot: DeliveryTimeSlot): void {
    const index = this.timeSlots.findIndex(slot => slot.id === updatedSlot.id);
    if (index >= 0) {
      this.timeSlots[index] = updatedSlot;
      this.filterAndOrganizeTimeSlots();
    }
  }

  /**
   * Handle configuration request
   */
  onConfigurationRequest(): void {
    if (this.configuration && this.activeDriverId) {
      this.configurationRequested.emit(this.configuration);
    }
  }

  /**
   * Navigate to date
   */
  navigateToDate(date: Date): void {
    this.currentDate = new Date(date);
    this.loadTimeSlotData();
  }

  /**
   * Navigate to previous period
   */
  previousPeriod(): void {
    const newDate = new Date(this.currentDate);
    newDate.setDate(newDate.getDate() - 1);
    this.navigateToDate(newDate);
  }

  /**
   * Navigate to next period
   */
  nextPeriod(): void {
    const newDate = new Date(this.currentDate);
    newDate.setDate(newDate.getDate() + 1);
    this.navigateToDate(newDate);
  }

  /**
   * Refresh time slot data
   */
  refresh(): void {
    this.loadTimeSlotData();
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
      if (this.loadingState$.value !== 'loading' && !this.bookingInProgress) {
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
   * Get availability color class
   */
  getAvailabilityColorClass(availability: string): string {
    const colorMap: Record<string, string> = {
      available: 'available-slot',
      limited: 'limited-slot',
      full: 'full-slot',
      blocked: 'blocked-slot'
    };
    return colorMap[availability] || 'available-slot';
  }

  /**
   * Get availability icon
   */
  getAvailabilityIcon(availability: string): string {
    const iconMap: Record<string, string> = {
      available: 'fa-check-circle',
      limited: 'fa-exclamation-circle',
      full: 'fa-times-circle',
      blocked: 'fa-ban'
    };
    return iconMap[availability] || 'fa-question-circle';
  }

  /**
   * Get capacity utilization percentage
   */
  getCapacityUtilization(slot: DeliveryTimeSlot): number {
    return slot.utilization_percentage || (slot.booked / slot.capacity) * 100;
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
   * Check if time slots are available
   */
  hasTimeSlots(): boolean {
    return this.timeSlots.length > 0;
  }

  /**
   * Get error message
   */
  getErrorMessage(): Observable<string | null> {
    return this.error$.asObservable();
  }

  /**
   * Clear selected slots
   */
  clearSelection(): void {
    this.selectedTimeSlots = [];
    this.slotSelectionState.clear();
    this.slotsSelected.emit(this.selectedTimeSlots);
  }

  /**
   * Get selected slots count
   */
  getSelectedSlotsCount(): number {
    return this.selectedTimeSlots.length;
  }

  /**
   * Check if booking is allowed
   */
  canBook(): boolean {
    return this.enableBooking && this.selectedTimeSlots.length > 0 && !this.bookingInProgress;
  }

  /**
   * Book all selected time slots
   */
  bookSelectedSlots(): void {
    if (!this.canBook()) return;

    this.bookingInProgress = true;

    // Book slots sequentially to avoid conflicts
    const bookingPromises = this.selectedTimeSlots.map(slot =>
      this.timeSlotService.bookTimeSlot(slot.id).toPromise()
    );

    Promise.all(bookingPromises)
      .then(results => {
        // Update all booked slots in the list
        results.forEach(updatedSlot => {
          if (updatedSlot) {
            this.updateTimeSlotInList(updatedSlot);
          }
        });

        this.bookingInProgress = false;
        this.clearSelection();
      })
      .catch(error => {
        this.handleError('Bulk booking failed', error);
        this.bookingInProgress = false;
      });
  }
}

/**
 * Time Slot Group Interface
 */
interface TimeSlotGroup {
  timeGroup: string;
  slots: DeliveryTimeSlot[];
  earliestTime: string;
  latestTime: string;
}