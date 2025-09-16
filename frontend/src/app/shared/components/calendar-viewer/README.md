# Calendar Viewer Component

A powerful, standalone Angular calendar component designed for viewing delivery schedules, time slots, and route plans in multiple view modes. Built with reusability and extensibility in mind.

## ⭐ Features

### 🗓️ Multiple View Modes
- **Day View**: Detailed hourly breakdown with draggable time slots
- **Week View**: 7-day overview with compact event display
- **Month View**: Traditional calendar with event indicators

### 📋 Interactive Event Management
- **Drag & Drop**: Reschedule deliveries by dragging events
- **Click Events**: View detailed information via modal popups
- **Hover Previews**: Quick preview of event details on hover
- **Multi-select**: Batch operations on multiple events

### 🎨 Customizable Appearance
- **Flexible Styling**: CSS variables for theming
- **Responsive Design**: Mobile-first approach
- **Dark Mode Support**: Automatic dark theme detection
- **Compact/Minimal Modes**: Space-efficient display options

### ⚙️ Advanced Configuration
- **Smart Filtering**: Filter by status, driver, time period
- **Auto-refresh**: Real-time data updates with configurable intervals
- **Auto-loading**: Progressive data loading based on view mode
- **Error Handling**: Graceful error states with retry mechanisms

## 🚀 Quick Start

### Installation
The component is already integrated into your Angular project. Simply import and use it.

### Basic Usage

```html
<!-- Basic calendar with default settings -->
<app-calendar-viewer
  [initialDate]="today"
  (eventClicked)="handleEventClick($event)">
</app-calendar-viewer>
```

### Advanced Configuration

```html
<app-calendar-viewer
  [viewMode]="'week'"
  [initialDate]="selectedDate"
  [driverIds]="selectedDriverIds"
  [statusFilter]="'scheduled'"
  [showTimeSlots]="true"
  [showLegend]="true"
  [autoRefresh]="true"
  [refreshInterval]="30000"
  [enableDragDrop]="true"
  [enableClickEvents]="true"
  [customEventActions]="customActions"
  (eventClicked)="onEventClick($event)"
  (dayClicked)="onDayClick($event)"
  (viewChanged)="onViewChange($event)"
  (eventRescheduled)="onEventReschedule($event)"
  (refreshRequested)="onRefresh($event)"
  (errorOccurred)="onError($event)">
</app-calendar-viewer>
```

## 📚 API Reference

### @Inputs

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `viewMode` | `CalendarViewMode` | `'month'` | View type: 'day', 'week', 'month' |
| `initialDate` | `Date` | `new Date()` | Starting date for the calendar |
| `driverIds` | `number[]` | `[]` | Filter by specific driver IDs |
| `statusFilter` | `string` | `'all'` | Filter by delivery status: 'all', 'scheduled', 'in_progress', 'completed', 'cancelled' |
| `showTimeSlots` | `boolean` | `true` | Display time slot events |
| `showMonthNavigation` | `boolean` | `true` | Show previous/next navigation buttons |
| `showViewControls` | `boolean` | `true` | Show view mode selector (day/week/month) |
| `showFilters` | `boolean` | `true` | Show filter controls |
| `showLegend` | `boolean` | `true` | Show color legend |
| `autoRefresh` | `boolean` | `true` | Enable automatic data refresh |
| `refreshInterval` | `number` | `30000` | Auto-refresh interval in milliseconds |
| `enableDragDrop` | `boolean` | `true` | Enable drag and drop functionality |
| `enableClickEvents` | `boolean` | `true` | Enable click event handling |
| `modalSize` | `string` | `'lg'` | Modal size: 'sm', 'lg', 'xl' |
| `customEventActions` | `CalendarEventAction[]` | `[]` | Custom action buttons for events |

### @Outputs

| Property | Type | Description |
|----------|------|-------------|
| `eventClicked` | `EventEmitter<CalendarEvent>` | Fired when a calendar event is clicked |
| `dayClicked` | `EventEmitter<Date>` | Fired when a day is clicked |
| `viewChanged` | `EventEmitter<{view: CalendarViewMode, date: Date}>` | Fired when view mode or date changes |
| `eventRescheduled` | `EventEmitter<{schedule: DeliverySchedule, newStart: Date, newEnd: Date}>` | Fired when event is rescheduled via drag and drop |
| `refreshRequested` | `EventEmitter<void>` | Fired when refresh is manually triggered |
| `errorOccurred` | `EventEmitter<Error>` | Fired when an error occurs |
| `loadingStateChanged` | `EventEmitter<LoadingState>` | Fired when loading state changes |

### Public Methods

```typescript
// Refresh calendar data
refresh(): void

// Set view mode
setView(view: CalendarViewMode): void

// Navigate to previous time period
previousView(): void

// Navigate to next time period
nextView(): void

// Navigate to today
goToToday(): void

// Get event by ID
getEventById(id: string | number): CalendarEvent | undefined

// Check if component has errors
hasError(): boolean

// Check if component is loading
isLoading(): boolean

// Check if calendar has data
hasData(): boolean

// Get error message
getErrorMessage(): Observable<string | null>

// Set loading state manually
setLoadingState(state: LoadingState): void

// Clear selected event
clearSelectedEvent(): void
```

## 🎨 Styling and Theming

### CSS Classes Structure

```scss
// Main container
.calendar-viewer-container
├── .calendar-header
├── .calendar-controls
├── .calendar-content
│   ├── .loading-overlay
│   ├── .error-state
│   ├── .empty-state
│   └── .calendar-view
│       ├── .cal-month-view
│       ├── .cal-week-view
│       └── .cal-day-view
└── .calendar-legend
```

### CSS Variables (Custom Properties)

```scss
.calendar-viewer-container {
  --calendar-primary: #007bff;
  --calendar-secondary: #6c757d;
  --calendar-border-radius: 0.375rem;
  --calendar-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
  --calendar-transition-speed: 0.15s;
}
```

### Theme Modifiers

```html
<!-- Minimal theme -->
<app-calendar-viewer class="minimal"></app-calendar-viewer>

<!-- Compact theme -->
<app-calendar-viewer class="compact"></app-calendar-viewer>

<!-- Custom styling -->
<app-calendar-viewer
  style="--calendar-primary: #your-color; --calendar-border-radius: 8px">
</app-calendar-viewer>
```

## 🔧 Configuration Options

### Filter Configuration
```typescript
@Component({
  template: `
    <app-calendar-viewer
      [driverIds]="selectedDrivers"
      [statusFilter]="selectedStatus">
    </app-calendar-viewer>
  `
})
export class MyComponent {
  selectedDrivers = [1, 2, 3]; // Show only schedules for these drivers
  selectedStatus = 'scheduled'; // Only show scheduled deliveries
}
```

### Event Customization
```typescript
@Component({
  template: `
    <app-calendar-viewer
      [customEventActions]="customActions"
      (eventClicked)="handleCustomEvent($event)">
    </app-calendar-viewer>
  `,
  customActions: CalendarEventAction[] = [
    {
      label: '<i class="fas fa-edit"></i>',
      a11yLabel: 'Edit',
      onClick: ({ event }: { event: CalendarEvent }) => {
        this.openEditModal(event);
      }
    },
    {
      label: '<i class="fas fa-trash"></i>',
      a11yLabel: 'Delete',
      onClick: ({ event }: { event: CalendarEvent }) => {
        this.confirmDelete(event);
      }
    }
  ];
})
```

### Real-time Configuration
```typescript
@Component({
  template: `
    <app-calendar-viewer
      [autoRefresh]="true"
      [refreshInterval]="15000"
      (loadingStateChanged)="onLoadingStateChange($event)">
    </app-calendar-viewer>
  `
})
```

## 🌟 Advanced Usage Patterns

### Event Context Menu
```typescript
handleEventClick(event: CalendarEvent): void {
  const contextMenu = [
    {
      label: 'View Details',
      icon: 'fa-eye',
      action: () => this.showEventDetails(event)
    },
    {
      label: 'Reschedule',
      icon: 'fa-calendar-edit',
      action: () => this.openRescheduleModal(event)
    },
    {
      label: 'Route Info',
      icon: 'fa-map-route',
      action: () => this.showRouteDetails(event)
    }
  ];
  this.showContextMenu(contextMenu);
}
```

### Multi-calendar Integration
```typescript
@ViewChild('calendar1') calendar1: CalendarViewerComponent;
@ViewChild('calendar2') calendar2: CalendarViewerComponent;

synchronizeCalendars(): void {
  this.calendar1.viewChanged.pipe(
    takeUntil(this.destroy$)
  ).subscribe(data => {
    this.calendar2.viewDate = data.date;
    this.calendar2.setView(data.view);
  });
}
```

### Conditional Event Styling
```typescript
getEventColor(event: CalendarEvent): any {
  const data = event.meta.data as DeliverySchedule;

  if (data.priority === 'high') {
    return { primary: '#dc3545', secondary: '#f8d7da' };
  } else if (data.status === 'overdue') {
    return { primary: '#fd7e14', secondary: '#ffeaa7' };
  }

  return this.defaultEventColor;
}
```

## 🚨 Error Handling

### Error Types and Handling
```typescript
handleError(error: Error): void {
  switch (error.name) {
    case 'NetworkError':
      this.showNotification('Connection lost. Retrying...');
      break;
    case 'ValidationError':
      this.showNotification('Invalid data format. Check filters.');
      break;
    case 'AuthorizationError':
      this.router.navigate(['/login']);
      break;
    default:
      this.showNotification(`Unexpected error: ${error.message}`);
  }

  // Auto-retry for network errors
  if (error.name === 'NetworkError') {
    setTimeout(() => this.refresh(), 5000);
  }
}
```

## ♿ Accessibility Features

### Keyboard Navigation
- **Tab Navigation**: Navigate through events and controls
- **Arrow Keys**: Move between calendar days
- **Enter/Space**: Select or activate events
- **Escape**: Close modals and clear selection

### Screen Reader Support
- **ARIA Labels**: Comprehensive labeling for all controls
- **Role Attributes**: Proper role assignments
- **Live Regions**: Dynamic content announcements
- **Semantic HTML**: Proper heading hierarchy

### High Contrast Mode
```scss
@media (prefers-contrast: high) {
  .calendar-viewer-container {
    border-width: 2px;

    .calendar-event {
      text-decoration: underline;
      font-weight: 700;
    }
  }
}
```

## 🔄 Integration Examples

### Parent Component Integration
```typescript
import { Component, OnInit, ViewChild } from '@angular/core';
import { CalendarViewerComponent } from '@shared/components/calendar-viewer';
import { CalendarData, DeliverySchedule } from '@core/models';

@Component({
  selector: 'app-delivery-planner',
  template: `
    <div class="delivery-planner">
      <app-calendar-viewer
        #calendarViewer
        [driverIds]="selectedDrivers"
        [statusFilter]="filterStatus"
        (eventClicked)="handleEventClick($event)"
        (eventRescheduled)="handleReschedule($event)">
      </app-calendar-viewer>

      <!-- Custom overlay for event details -->
      <div class="event-overlay" *ngIf="selectedEvent">
        <!-- Event details content -->
      </div>
    </div>
  `
})
export class DeliveryPlannerComponent implements OnInit {
  @ViewChild('calendarViewer') calendarViewer: CalendarViewerComponent;

  selectedDrivers: number[] = [];
  filterStatus = 'all';
  selectedEvent: CalendarEvent | null = null;

  ngOnInit(): void {
    this.loadInitialData();
  }

  handleEventClick(event: CalendarEvent): void {
    this.selectedEvent = event;
    // Show custom overlay or redirect to detail page
  }

  handleReschedule(data: {schedule: DeliverySchedule, newStart: Date, newEnd: Date}): void {
    this.calendarService.rescheduleDelivery(data.schedule, data.newStart, data.newEnd)
      .subscribe(response => {
        this.notificationService.success('Rescheduled successfully');
        this.calendarViewer.refresh();
      });
  }

  private loadInitialData(): void {
    // Load initial driver list and default filters
    this.driverService.getActiveDrivers().subscribe(drivers => {
      this.selectedDrivers = drivers.map(d => d.id);
      this.calendarViewer.refresh();
    });
  }
}
```

### Service Integration
```typescript
export class CalendarIntegrationService {
  constructor(
    private calendarService: CalendarService,
    private notificationService: NotificationService
  ) {}

  integrateCalendarWithExternalSystem(calendarViewer: CalendarViewerComponent): void {
    // Subscribe to calendar events
    calendarViewer.eventClicked.pipe(
      switchMap(event => this.externalService.getEventDetails(event.id)),
      tap(details => this.notificationService.showDetails(details)),
      catchError(error => {
        this.notificationService.showError('External service error');
        return of(null);
      })
    ).subscribe();

    // Handle rescheduling
    calendarViewer.eventRescheduled.pipe(
      switchMap(data => this.externalService.updateSchedule(data.schedule.id, data)),
      tap(() => this.notificationService.success('Schedule updated externally')),
      catchError(error => {
        this.notificationService.showError('Update failed');
        return of(null);
      })
    ).subscribe();
  }
}
```

## 📋 Testing

### Unit Testing
```typescript
describe('CalendarViewerComponent', () => {
  let component: CalendarViewerComponent;
  let fixture: ComponentFixture<CalendarViewerComponent>;
  const mockCalendarService = jasmine.createSpyObj('CalendarService', ['getCalendarData']);

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CalendarViewerComponent],
      providers: [
        { provide: CalendarService, useValue: mockCalendarService }
      ]
    });

    fixture = TestBed.createComponent(CalendarViewerComponent);
    component = fixture.componentInstance;
  });

  it('should load calendar data on initialization', () => {
    mockCalendarService.getCalendarData.and.returnValue(of([]));
    fixture.detectChanges();
    expect(component.isLoading()).toBeFalsy();
  });

  it('should emit event when calendar event is clicked', () => {
    spyOn(component.eventClicked, 'emit');
    const mockEvent = createMockCalendarEvent();
    component.onEventClick(mockEvent);
    expect(component.eventClicked.emit).toHaveBeenCalledWith(mockEvent);
  });

  it('should handle drag and drop rescheduling', () => {
    spyOn(component.eventRescheduled, 'emit');
    const mockEvent = createMockCalendarEvent();
    const newStart = new Date();
    const newEnd = new Date(newStart.getTime() + 3600000); // 1 hour later

    component.onEventTimesChanged({
      event: mockEvent,
      newStart,
      newEnd
    } as any);

    expect(component.eventRescheduled.emit).toHaveBeenCalled();
  });
});
```

### E2E Testing
```typescript
describe('Calendar Viewer E2E', () => {
  it('should display calendar with events', () => {
    cy.visit('/calendar');
    cy.get('.calendar-viewer-container').should('exist');
    cy.get('.calendar-event').should('have.length.greaterThan', 0);
  });

  it('should change view mode', () => {
    cy.visit('/calendar');
    cy.get('[data-cy=month-view]').should('have.class', 'active');
    cy.get('[data-cy=week-view]').click();
    cy.get('[data-cy=week-view]').should('have.class', 'active');
  });

  it('should navigate between months', () => {
    cy.visit('/calendar');
    const currentMonth = cy.get('.calendar-title').invoke('text');
    cy.get('[data-cy=prev-button]').click();
    cy.get('.calendar-title').should('not.contain', currentMonth);
  });
});
```

## 📈 Performance Optimization

### Data Loading Strategies
```typescript
// Lazy loading for large datasets
loadCalendarDataLazy(): void {
  this.calendarService.getCalendarDataChunked({
    startDate: this.startDate,
    endDate: this.endDate,
    chunkSize: 100 // Load 100 events at a time
  }).pipe(
    scan((acc, chunk) => [...acc, ...chunk], []),
    throttleTime(500),
    debounceTime(200)
  ).subscribe(events => {
    this.updateCalendarEvents(events);
  });
}

// Virtual scrolling for performance
@ViewChild('viewport', { read: ViewportScroller }) viewport: ViewportScroller;

handleScroll(): void {
  const scrollTop = this.viewport.getScrollPosition()[1];
  const visibleEvents = this.calendarEvents.filter(event => {
    const eventTop = event.start.getTime();
    const viewportTop = scrollTop;
    const viewportBottom = scrollTop + this.viewportHeight;
    return eventTop >= viewportTop && eventTop <= viewportBottom;
  });
  this.renderEvents(visibleEvents);
}
```

### Memory Management
```typescript
ngOnDestroy(): void {
  this.destroy$.next();
  this.destroy$.complete();
  this.cleanupAutoRefresh();
  this.virtualScrollSubscription?.unsubscribe();
  this.calendarData = [];
  this.calendarEvents = [];
}

// Clear large datasets when not in use
clearLargeDatasets(): void {
  this.calendarData = null;
  this.calendarEvents = [];
  this.virtualEvents = [];
  this.triggerGpuCleanup();
}

private triggerGpuCleanup(): void {
  // Force garbage collection hints
  setTimeout(() => {
    if (window.gc) {
      window.gc();
    }
  }, 100);
}
```

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. Calendar not loading data
**Problem**: Calendar shows empty state despite having data
**Solution**:
```typescript
// Ensure calendar service is properly initialized
constructor(private calendarService: CalendarService) {
  this.calendarService.getCalendarData(...).subscribe(...);
}

// Check API endpoint response format
// Expected: { success: boolean, data: CalendarData[] }
```

#### 2. Drag and drop not working
**Problem**: Events can't be dragged or resized
**Solution**:
```typescript
// Verify enableDragDrop input is set to true
<app-calendar-viewer [enableDragDrop]="true"></app-calendar-viewer>

// Check that schedule.can_be_modified is true on the backend
// Required for drag functionality
```

#### 3. Performance issues with many events
**Problem**: Calendar lags with >500 events
**Solution**:
```typescript
// Implement virtual scrolling
// Set maximum visible events limit
// Use data pagination
this.calendarViewer.setMaxVisibleEvents(200);
```

#### 4. Styling conflicts
**Problem**: Calendar styles don't apply correctly
**Solution**:
```scss
// Increase specificity if needed
.calendar-viewer-container.calendar-viewer-container {
  // Your styles here
}

// Or use !important for critical styles
.calendar-event {
  background-color: var(--custom-color) !important;
}
```

### Debug Mode
Enable debug mode for troubleshooting:
```typescript
@Component({
  template: `
    <app-calendar-viewer
      [debugMode]="true"
      (debugLog)="onDebugLog($event)">
    </app-calendar-viewer>
  `
})
export class MyComponent {
  onDebugLog(log: DebugInfo): void {
    console.log('Calendar Debug:', log);
    // Log component state, performance metrics, etc.
  }
}
```

## 🔄 Version History

### v1.0.0 (Current)
- Initial release with core calendar functionality
- Multiple view modes (day/week/month)
- Drag and drop support
- Customizable styling and theming
- Comprehensive accessibility features

## 📄 License

This component is part of the ShipmentApp calendar system and follows the project's licensing terms.

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:
1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request with detailed description

See [CONTRIBUTING.md](../../../../../CONTRIBUTING.md) for detailed contribution guidelines.

## 📞 Support

For support and questions:
- Check the [troubleshooting section](#troubleshooting) above
- Review the [API documentation](#api-reference)
- Open an issue in the project repository

---

**Happy Calendar Building! 📅**