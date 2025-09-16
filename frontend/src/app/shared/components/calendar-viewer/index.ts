/**
 * Calendar Viewer Component Public API
 *
 * This file provides the public interface for the calendar-viewer component.
 * It exports the main component class, interfaces, and utilities for external usage.
 */

// Main Component Export
export * from './calendar-viewer.component';

// CalendarViewerComponent is the default export
export { CalendarViewerComponent as default } from './calendar-viewer.component';

// Configuration and Types (if any additional types are needed)
// export * from './calendar-viewer.config';
// export * from './calendar-viewer.interfaces';

/**
 * Usage Instructions:
 *
 * 1. Import the component in your module:
 * ```typescript
 * import { CalendarViewerComponent } from '@shared/components/calendar-viewer';
 * ```
 *
 * 2. Add to your module's declarations:
 * ```typescript
 * @NgModule({
 *   declarations: [CalendarViewerComponent, ...],
 *   imports: [...],
 *   exports: [CalendarViewerComponent, ...]
 * })
 * ```
 *
 * 3. Use in templates:
 * ```html
 * <app-calendar-viewer
 *   [viewMode]="'month'"
 *   [initialDate]="today"
 *   [driverIds]="selectedDrivers"
 *   [showFilters]="true"
 *   (eventClicked)="onEventClick($event)"
 *   (viewChanged)="onViewChange($event)">
 * </app-calendar-viewer>
 * ```
 *
 * @see CalendarViewerComponent for detailed API documentation
 */