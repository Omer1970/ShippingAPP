import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSortModule } from '@angular/material/sort';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { ShipmentListComponent } from './shipment-list.component';
import { ShipmentService } from '../../core/services/shipment.service';
import { ShipmentListResponse, Shipment } from '../../core/models/shipment.model';

describe('ShipmentListComponent', () => {
  let component: ShipmentListComponent;
  let fixture: ComponentFixture<ShipmentListComponent>;
  let shipmentService: jasmine.SpyObj<ShipmentService>;

  const mockShipmentResponse: ShipmentListResponse = {
    success: true,
    data: {
      shipments: [
        {
          id: 1,
          dolibarrShipmentId: 12345,
          reference: 'SH-001',
          customerName: 'Test Customer',
          deliveryAddress: '123 Main St',
          status: 'in_transit' as const,
          expectedDelivery: '2025-09-15',
          assignedDriver: 'John Driver',
          totalWeight: 25.5,
          totalValue: 1500.00
        }
      ],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 1,
        itemsPerPage: 10
      }
    }
  };

  beforeEach(async () => {
    const shipmentServiceSpy = jasmine.createSpyObj('ShipmentService', [
      'getShipments', 'refreshShipment', 'getShipmentStatusColor', 
      'getShipmentStatusIcon', 'getShipmentStatusBadgeClass', 
      'formatShipmentDate', 'getShipmentDeliveryUrgency', 
      'getShipmentDeliveryUrgencyColor', 'clearError'
    ]);

    await TestBed.configureTestingModule({
      declarations: [ShipmentListComponent],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        BrowserAnimationsModule,
        MatTableModule,
        MatPaginatorModule,
        MatProgressSpinnerModule,
        MatIconModule,
        MatButtonModule,
        MatCardModule,
        MatChipsModule,
        MatTooltipModule,
        MatSortModule
      ],
      providers: [
        { provide: ShipmentService, useValue: shipmentServiceSpy }
      ]
    }).compileComponents();

    shipmentService = TestBed.inject(ShipmentService) as jasmine.SpyObj<ShipmentService>;
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ShipmentListComponent);
    component = fixture.componentInstance;
    
    // Setup default spy return values
    shipmentService.getShipments.and.returnValue(of(mockShipmentResponse));
    shipmentService.getShipmentStatusColor.and.returnValue('#2196F3');
    shipmentService.getShipmentStatusIcon.and.returnValue('local_shipping');
    shipmentService.getShipmentStatusBadgeClass.and.returnValue('badge-in-transit');
    shipmentService.formatShipmentDate.and.returnValue('Sept 15, 2025');
    shipmentService.getShipmentDeliveryUrgency.and.returnValue('later');
    shipmentService.getShipmentDeliveryUrgencyColor.and.returnValue('#9E9E9E');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load shipments on init', () => {
    fixture.detectChanges();
    
    expect(shipmentService.getShipments).toHaveBeenCalled();
    expect(component.shipments.length).toBe(1);
    expect(component.shipments[0].reference).toBe('SH-001');
  });

  it('should display loading state initially', () => {
    component.isLoading = true;
    fixture.detectChanges();
    
    const loadingElement = fixture.nativeElement.querySelector('.loading-container');
    expect(loadingElement).toBeTruthy();
  });

  it('should handle empty shipment list', () => {
    const emptyResponse: ShipmentListResponse = {
      success: true,
      data: {
        shipments: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: 10
        }
      }
    };

    shipmentService.getShipments.and.returnValue(of(emptyResponse));
    fixture.detectChanges();
    
    expect(component.shipments.length).toBe(0);
    const emptyElement = fixture.nativeElement.querySelector('.empty-container');
    expect(emptyElement).toBeTruthy();
  });

  it('should handle API errors gracefully', () => {
    const errorMessage = 'Failed to load shipments';
    shipmentService.getShipments.and.returnValue(throwError(() => ({ message: errorMessage })));
    fixture.detectChanges();
    
    expect(component.error).toBe('Failed to load shipments. Please try again.');
    const errorElement = fixture.nativeElement.querySelector('.error-container');
    expect(errorElement).toBeTruthy();
  });

  it('should handle pagination changes', () => {
    fixture.detectChanges();
    
    const pageEvent = { pageIndex: 1, pageSize: 25 };
    component.onPageChange(pageEvent);
    
    expect(shipmentService.getShipments).toHaveBeenCalledWith({ page: 2, perPage: 25 });
  });

  it('should navigate to shipment details on view', () => {
    fixture.detectChanges();
    
    spyOn(component.router, 'navigate');
    
    const testShipment = mockShipmentResponse.data.shipments[0];
    component.viewShipment(testShipment);
    
    expect(component.router.navigate).toHaveBeenCalledWith(['/shipments', 1]);
  });

  it('should refresh shipment data', () => {
    const refreshResponse = { success: true, data: mockShipmentResponse.data.shipments[0] };
    shipmentService.refreshShipment.and.returnValue(of(refreshResponse));
    
    fixture.detectChanges();
    
    const testShipment = mockShipmentResponse.data.shipments[0];
    component.refreshShipment(testShipment);
    
    expect(shipmentService.refreshShipment).toHaveBeenCalledWith(1);
    expect(shipmentService.getShipments).toHaveBeenCalledTimes(2);
  });

  it('should reload data when refresh fails', () => {
    shipmentService.refreshShipment.and.returnValue(throwError(() => ({ message: 'Refresh failed' })));
    fixture.detectChanges();
    
    const testShipment = mockShipmentResponse.data.shipments[0];
    component.refreshShipment(testShipment);
    
    expect(component.error).toBe('Failed to refresh shipment data.');
  });

  it('should get status color', () => {
    const color = component.getStatusColor('in_transit');
    expect(shipmentService.getShipmentStatusColor).toHaveBeenCalledWith('in_transit');
  });

  it('should get status icon', () => {
    const icon = component.getStatusIcon('in_transit');
    expect(shipmentService.getShipmentStatusIcon).toHaveBeenCalledWith('in_transit');
  });

  it('should get status badge class', () => {
    const badgeClass = component.getStatusBadgeClass('in_transit');
    expect(shipmentService.getShipmentStatusBadgeClass).toHaveBeenCalledWith('in_transit');
  });

  it('should format date correctly', () => {
    const formattedDate = component.formatDate('2025-09-15');
    expect(shipmentService.formatShipmentDate).toHaveBeenCalledWith('2025-09-15');
    expect(formattedDate).toBe('Sept 15, 2025');
  });

  it('should get delivery urgency', () => {
    const urgency = component.getDeliveryUrgency(mockShipmentResponse.data.shipments[0]);
    expect(shipmentService.getShipmentDeliveryUrgency).toHaveBeenCalledWith('2025-09-15');
    expect(urgency).toBe('later');
  });

  it('should track shipments by ID', () => {
    const testShipment = mockShipmentResponse.data.shipments[0];
    const trackedId = component.trackByShipmentId(0, testShipment);
    
    expect(trackedId).toBe(1);
  });

  it('should reload data on demand', () => {
    fixture.detectChanges();
    component.reloadData();
    
    expect(shipmentService.getShipments).toHaveBeenCalledTimes(2);
  });

  it('should clear error state', () => {
    component.error = 'Test error';
    fixture.detectChanges();
    
    component.clearError();
    
    expect(component.error).toBeNull();
    expect(shipmentService.clearError).toHaveBeenCalled();
  });

  it('should clean up subscriptions on destroy', () => {
    spyOn(component['destroy$'], 'next');
    spyOn(component['destroy$'], 'complete');
    
    component.ngOnDestroy();
    
    expect(component['destroy$'].next).toHaveBeenCalled();
    expect(component['destroy$'].complete).toHaveBeenCalled();
  });
});