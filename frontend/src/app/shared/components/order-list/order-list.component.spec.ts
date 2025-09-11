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

import { OrderListComponent } from './order-list.component';
import { OrderService } from '../../core/services/order.service';
import { OrderListResponse, Order } from '../../core/models/order.model';

describe('OrderListComponent', () => {
  let component: OrderListComponent;
  let fixture: ComponentFixture<OrderListComponent>;
  let orderService: jasmine.SpyObj<OrderService>;

  const mockOrderResponse: OrderListResponse = {
    success: true,
    data: {
      orders: [
        {
          id: 1,
          dolibarrOrderId: 12345,
          reference: 'ORD-001',
          customer: {
            id: 100,
            name: 'Test Customer',
            email: 'customer@example.com',
            phone: '123-456-7890'
          },
          customerId: 100,
          customerName: 'Test Customer',
          customerReference: 'CUST-001',
          orderDate: '2025-09-01',
          expectedDelivery: '2025-09-15',
          status: 'processing' as const,
          totalAmount: {
            exclTax: 1000.00,
            inclTax: 1200.00,
            currency: 'USD'
          },
          shippingAddress: '123 Main St',
          billingAddress: '123 Main St'
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
    const orderServiceSpy = jasmine.createSpyObj('OrderService', [
      'getOrders', 'refreshOrder', 'getOrderStatusColor', 
      'getOrderStatusIcon', 'getOrderStatusBadgeClass', 
      'formatOrderDate', 'formatOrderAmount', 'getOrderDeliveryUrgency', 
      'getOrderDeliveryUrgencyColor', 'clearError'
    ]);

    await TestBed.configureTestingModule({
      declarations: [OrderListComponent],
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
        { provide: OrderService, useValue: orderServiceSpy }
      ]
    }).compileComponents();

    orderService = TestBed.inject(OrderService) as jasmine.SpyObj<OrderService>;
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(OrderListComponent);
    component = fixture.componentInstance;
    
    // Setup default spy return values
    orderService.getOrders.and.returnValue(of(mockOrderResponse));
    orderService.getOrderStatusColor.and.returnValue('#2196F3');
    orderService.getOrderStatusIcon.and.returnValue('shopping_cart');
    orderService.getOrderStatusBadgeClass.and.returnValue('badge-processing');
    orderService.formatOrderDate.and.returnValue('Sept 1, 2025');
    orderService.formatOrderAmount.and.returnValue('$1,200.00');
    orderService.getOrderDeliveryUrgency.and.returnValue('later');
    orderService.getOrderDeliveryUrgencyColor.and.returnValue('#9E9E9E');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load orders on init', () => {
    fixture.detectChanges();
    
    expect(orderService.getOrders).toHaveBeenCalled();
    expect(component.orders.length).toBe(1);
    expect(component.orders[0].reference).toBe('ORD-001');
  });

  it('should display loading state initially', () => {
    component.isLoading = true;
    fixture.detectChanges();
    
    const loadingElement = fixture.nativeElement.querySelector('.loading-container');
    expect(loadingElement).toBeTruthy();
  });

  it('should handle empty order list', () => {
    const emptyResponse: OrderListResponse = {
      success: true,
      data: {
        orders: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: 10
        }
      }
    };

    orderService.getOrders.and.returnValue(of(emptyResponse));
    fixture.detectChanges();
    
    expect(component.orders.length).toBe(0);
    const emptyElement = fixture.nativeElement.querySelector('.empty-container');
    expect(emptyElement).toBeTruthy();
  });

  it('should handle API errors gracefully', () => {
    const errorMessage = 'Failed to load orders';
    orderService.getOrders.and.returnValue(throwError(() => ({ message: errorMessage })));
    fixture.detectChanges();
    
    expect(component.error).toBe('Failed to load orders. Please try again.');
    const errorElement = fixture.nativeElement.querySelector('.error-container');
    expect(errorElement).toBeTruthy();
  });

  it('should handle pagination changes', () => {
    fixture.detectChanges();
    
    const pageEvent = { pageIndex: 1, pageSize: 25 };
    component.onPageChange(pageEvent);
    
    expect(orderService.getOrders).toHaveBeenCalledWith({ page: 2, perPage: 25 });
  });

  it('should navigate to order details on view', () => {
    fixture.detectChanges();
    
    spyOn(component.router, 'navigate');
    
    const testOrder = mockOrderResponse.data.orders[0];
    component.viewOrder(testOrder);
    
    expect(component.router.navigate).toHaveBeenCalledWith(['/orders', 1]);
  });

  it('should refresh order data', () => {
    const refreshResponse = { success: true, data: mockOrderResponse.data.orders[0] };
    orderService.refreshOrder.and.returnValue(of(refreshResponse));
    
    fixture.detectChanges();
    
    const testOrder = mockOrderResponse.data.orders[0];
    component.refreshOrder(testOrder);
    
    expect(orderService.refreshOrder).toHaveBeenCalledWith(1);
    expect(orderService.getOrders).toHaveBeenCalledTimes(2);
  });

  it('should reload data when refresh fails', () => {
    orderService.refreshOrder.and.returnValue(throwError(() => ({ message: 'Refresh failed' })));
    fixture.detectChanges();
    
    const testOrder = mockOrderResponse.data.orders[0];
    component.refreshOrder(testOrder);
    
    expect(component.error).toBe('Failed to refresh order data.');
  });

  it('should get status color', () => {
    const color = component.getStatusColor('processing');
    expect(orderService.getOrderStatusColor).toHaveBeenCalledWith('processing');
  });

  it('should get status icon', () => {
    const icon = component.getStatusIcon('processing');
    expect(orderService.getOrderStatusIcon).toHaveBeenCalledWith('processing');
  });

  it('should get status badge class', () => {
    const badgeClass = component.getStatusBadgeClass('processing');
    expect(orderService.getOrderStatusBadgeClass).toHaveBeenCalledWith('processing');
  });

  it('should format date correctly', () => {
    const formattedDate = component.formatDate('2025-09-01');
    expect(orderService.formatOrderDate).toHaveBeenCalledWith('2025-09-01');
    expect(formattedDate).toBe('Sept 1, 2025');
  });

  it('should format amount correctly', () => {
    const testAmount = { exclTax: 1000.00, inclTax: 1200.00, currency: 'USD' };
    const formattedAmount = component.formatAmount(testAmount);
    expect(orderService.formatOrderAmount).toHaveBeenCalledWith(testAmount);
    expect(formattedAmount).toBe('$1,200.00');
  });

  it('should get delivery urgency', () => {
    const urgency = component.getDeliveryUrgency(mockOrderResponse.data.orders[0]);
    expect(orderService.getOrderDeliveryUrgency).toHaveBeenCalledWith('2025-09-15');
    expect(urgency).toBe('later');
  });

  it('should get delivery urgency color', () => {
    const urgency = 'later';
    const color = component.getDeliveryUrgencyColor(urgency);
    expect(orderService.getOrderDeliveryUrgencyColor).toHaveBeenCalledWith(urgency);
    expect(color).toBe('#9E9E9E');
  });

  it('should track orders by ID', () => {
    const testOrder = mockOrderResponse.data.orders[0];
    const trackedId = component.trackByOrderId(0, testOrder);
    
    expect(trackedId).toBe(1);
  });

  it('should reload data on demand', () => {
    fixture.detectChanges();
    component.reloadData();
    
    expect(orderService.getOrders).toHaveBeenCalledTimes(2);
  });

  it('should clear error state', () => {
    component.error = 'Test error';
    fixture.detectChanges();
    
    component.clearError();
    
    expect(component.error).toBeNull();
    expect(orderService.clearError).toHaveBeenCalled();
  });

  it('should clean up subscriptions on destroy', () => {
    spyOn(component['destroy$'], 'next');
    spyOn(component['destroy$'], 'complete');
    
    component.ngOnDestroy();
    
    expect(component['destroy$'].next).toHaveBeenCalled();
    expect(component['destroy$'].complete).toHaveBeenCalled();
  });
});