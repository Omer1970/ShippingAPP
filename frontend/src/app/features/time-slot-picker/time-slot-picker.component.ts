import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { takeUntil, switchMap, map } from 'rxjs/operators';

import { TimeSlotService } from '../../core/services/time-slot.service';
import { DeliveryTimeSlot, TimeSlotConfiguration, TimeSlotAvailability } from '../../core/models/schedule.model';
import { LoadingState } from '../../core/models/loading.model';

/**
 * Time Slot Picker Feature Component
 *
 * A dedicated page for time slot selection and management that provides:
 * - Comprehensive time slot booking interface
 * - Multi-date scheduling capabilities
 * - Driver coordination and assignment
 * - Real-time availability updates
 * - Bulk scheduling operations
 *
 * @usageNotes
 * This component serves as a standalone page for time slot management
 * with advanced booking features and comprehensive scheduling workflows.
 */

@Component({
  selector: 'app-time-slot-picker',
  templateUrl: './time-slot-picker.component.html',
  styleUrls: ['./time-slot-picker.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ]
})
export class TimeSlotPickerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private refreshTimer: any;

  loadingState$: BehaviorSubject<LoadingState> = new BehaviorSubject<LoadingState>('idle');
  error$ = new BehaviorSubject<string | null>(null);

  // Route parameters
  driverId: number | null = null;
  bookingMode: 'single' | 'multiple' | 'bulk' = 'single';
  selectedDate: Date = new Date();

  // Component state
  availableDrivers: number[] = [];
  timeSlotAvailability: TimeSlotAvailability | null = null;
  timeSlots: DeliveryTimeSlot[] = [];
  selectedTimeSlots: DeliveryTimeSlot[] = [];
  bookingInProgress = false;
  bookingSuccess = false;
  bookingError: string | null = null;

  // Configuration
  viewConfig = {
    showCalendar: true,
    showTimeGrid: true,
    showSummary: true,
    showRecommendations: true,
    autoRefresh: true,
    refreshInterval: 30000
  };

  // Booking state
  bookingSummary = {
    totalSlots: 0,
    selectedSlots: 0,
    totalCost: 0,
    estimatedTime: 0
  };

  constructor(
    private readonly timeSlotService: TimeSlotService,
    private readonly activatedRoute: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.initializeComponent();
    this.loadTimeSlotData();
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
        this.bookingMode = params['mode'] || 'single';
        this.selectedDate = params['date'] ? new Date(params['date']) : new Date();
      });

    this.selectedTimeSlots = [];
    this.bookingSuccess = false;
    this.bookingError = null;
  }

  /**
   * Load time slot availability data
   */
  private loadTimeSlotData(): void {
    if (!this.driverId) {
      this.loadAvailableDrivers();
      return;
    }

    if (this.loadingState$.value === 'loading') return;

    this.loadingState$.next('loading');
    this.error$.next(null);

    const dateRange = this.getDateRange();

    this.timeSlotService.getTimeSlotsByDriver(
      this.driverId!,
      dateRange.start,
      dateRange.end,
      'available'
    )
      .pipe(
        takeUntil(this.destroy$),
        map(timeSlots => {
          this.timeSlots = timeSlots;
          this.updateBookingSummary();
          return timeSlots;
        }),
        catchError((error) => {
          this.handleError('Failed to load time slot data', error);
          return of([]);
        })
      )
      .subscribe({
        next: () => {
          this.loadingState$.next('succeeded');
        },
        error: (error) => {
          this.handleError('Time slot data loading failed', error);
        }
      });
  }

  /**
   * Load available drivers
   */
  private loadAvailableDrivers(): void {
    // This would typically load drivers from a service
    // For now, simulate available drivers
    this.availableDrivers = [1, 2, 3, 4, 5];
  }

  /**
   * Get effective date range for time slot loading
   */
  private getDateRange(): { start: Date, end: Date } {
    const start = new Date(this.selectedDate);
    const end = new Date(this.selectedDate);

    switch (this.bookingMode) {
      case 'single':
        end.setDate(end.getDate() + 1);
        break;
      case 'multiple':
        end.setDate(end.getDate() + 7); // 1 week
        break;
      case 'bulk':
        end.setDate(end.getDate() + 30); // 1 month
        break;
    }

    return { start, end };
  }

  /**
   * Handle driver selection
   */
  onDriverSelected(driverId: number): void {
    this.driverId = driverId;
    this.selectedTimeSlots = [];
    this.updateQueryParams();
    this.loadTimeSlotData();
  }

  /**
   * Handle date selection
   */
  onDateSelected(date: Date): void {
    this.selectedDate = date;
    this.selectedTimeSlots = [];
    this.updateQueryParams();
    this.loadTimeSlotData();
  }

  /**
   * Handle time slot selection
   */
  onTimeSlotSelection(slot: DeliveryTimeSlot): void {
    switch (this.bookingMode) {
      case 'single':
        this.selectSingleSlot(slot);
        break;
      case 'multiple':
        this.toggleSlotSelection(slot);
        break;
      case 'bulk':
        this.addToBulkSelection(slot);
        break;
    }

    this.updateBookingSummary();
  }

  /**
   * Select single time slot
   */
  private selectSingleSlot(slot: DeliveryTimeSlot): void {
    this.selectedTimeSlots = [slot];
  }

  /**
   * Toggle time slot selection for multiple mode
   */
  private toggleSlotSelection(slot: DeliveryTimeSlot): void {
    const index = this.selectedTimeSlots.findIndex(s => s.id === slot.id);

    if (index >= 0) {
      this.selectedTimeSlots.splice(index, 1);
    } else {
      this.selectedTimeSlots.push(slot);
    }
  }

  /**
   * Add slot to bulk selection
   */
  private addToBulkSelection(slot: DeliveryTimeSlot): void {
    const index = this.selectedTimeSlots.findIndex(s => s.id === slot.id);

    if (index >= 0) {
      this.selectedTimeSlots.splice(index, 1);
    } else {
      this.selectedTimeSlots.push(slot);
    }
  }

  /**
   * Check if time slot is selected
   */
  isSlotSelected(slot: DeliveryTimeSlot): boolean {
    return this.selectedTimeSlots.some(s => s.id === slot.id);
  }

  /**
   * Update booking summary
   */
  private updateBookingSummary(): void {
    this.bookingSummary = {
      totalSlots: this.timeSlots.length,
      selectedSlots: this.selectedTimeSlots.length,
      totalCost: this.selectedTimeSlots.length * 10, // Simulated cost calculation
      estimatedTime: this.selectedTimeSlots.reduce((total, slot) => {
        // Calculate estimated time based on slot duration
        const [startHour, startMin] = slot.start_time.split(':').map(Number);
        const [endHour, endMin] = slot.end_time.split(':').map(Number);
        const duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);
        return total + duration;
      }, 0)
    };
  }

  /**
   * Process booking attempt
   */
  onBookingAttempt(): void {
    if (this.selectedTimeSlots.length === 0) {
      this.bookingError = 'Please select at least one time slot';
      return;
    }

    this.bookingInProgress = true;
    this.bookingError = null;
    this.bookingSuccess = false;

    // Process each selected time slot
    const bookingPromises = this.selectedTimeSlots.map(slot =>
      this.timeSlotService.bookTimeSlot(slot.id)
    );

    Promise.all(bookingPromises)
      .then(results => {
        this.bookingSuccess = true;
        this.bookingInProgress = false;
        // Refresh time slot data to show updated availability
        this.loadTimeSlotData();
      })
      .catch(error => {
        this.bookingError = error.message || 'Booking failed';
        this.bookingInProgress = false;
      });
  }

  /**
   * Handle mode change
   */
  onModeChange(newMode: 'single' | 'multiple' | 'bulk'): void {
    this.bookingMode = newMode;
    this.selectedTimeSlots = [];
    this.updateQueryParams();
    this.loadTimeSlotData();
  }

  /**
   * Refresh time slot data
   */
  refreshTimeSlots(): void {
    this.loadTimeSlotData();
  }

  /**
   * Navigate to route optimization
   */
  goToRouteOptimization(): void {
    if (this.selectedTimeSlots.length > 0) {
      this.router.navigate(['/route-optimizer'], {
        queryParams: {
          timeSlots: this.selectedTimeSlots.map(s => s.id).join(','),
          driverId: this.driverId
        }
      });
    }
  }

  /**
   * Navigate to schedule view
   */
  viewSchedule(): void {
    this.router.navigate(['/delivery-schedule'], {
      queryParams: {
        date: this.selectedDate.toISOString(),
        driverId: this.driverId
      }
    });
  }

  /**
   * Export selected time slots
   */
  exportTimeSlots(): void {
    const exportData = {
      driverId: this.driverId,
      date: this.selectedDate.toISOString(),
      timeSlots: this.selectedTimeSlots.map(slot => ({
        id: slot.id,
        startTime: slot.start_time,
        endTime: slot.end_time,
        availability: slot.availability
      }))
    };

    // This would typically trigger a file download
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = `time-slots-${this.selectedDate.toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  /**
   * Setup auto refresh
   */
  private setupAutoRefresh(): void {
    if (!this.viewConfig.autoRefresh || this.viewConfig.refreshInterval <= 0) return;

    this.cleanupAutoRefresh();
    this.refreshTimer = setInterval(() => {
      if (!this.bookingInProgress) {
        this.refreshTimeSlots();
      }
    }, this.viewConfig.refreshInterval);
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
   * Update URL query parameters
   */
  private updateQueryParams(): void {
    const queryParams: any = {};

    if (this.driverId) {
      queryParams.driverId = this.driverId;
    }

    if (this.bookingMode !== 'single') {
      queryParams.mode = this.bookingMode;
    }

    if (this.selectedDate) {
      queryParams.date = this.selectedDate.toISOString();
    }

    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
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
   * Get booking mode display text
   */
  getBookingModeText(): string {
    const modeTexts = {
      single: 'Single Slot Booking',
      multiple: 'Multiple Slot Selection',
      bulk: 'Bulk Scheduling'
    };
    return modeTexts[this.bookingMode];
  }

  /**
   * Check if booking is possible
   */
  canBook(): boolean {
    return this.selectedTimeSlots.length > 0 && !this.bookingInProgress;
  }

  /**
   * Check if time slots are available
   */
  hasTimeSlots(): boolean {
    return this.timeSlots.length > 0;
  }

  /**
   * Check if driver is selected
   */
  hasDriverSelected(): boolean {
    return this.driverId !== null;
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
   * Get booking summary text
   */
  getBookingSummaryText(): string {
    const { selectedSlots, totalCost, estimatedTime } = this.bookingSummary;

    if (selectedSlots === 0) {
      return 'No time slots selected';
    }

    const hours = Math.floor(estimatedTime / 60);
    const minutes = estimatedTime % 60;

    return `${selectedSlots} slot${selectedSlots === 1 ? '' : 's'} selected • ${estimatedTime} min total`;
  }

  /**
   * Get confirmation message
   */
  getConfirmationMessage(): string {
    if (this.bookingSuccess) {
      return `Successfully booked ${this.selectedTimeSlots.length} time slot${this.selectedTimeSlots.length === 1 ? '' : 's'}!`;
    }
    return '';
  }
}