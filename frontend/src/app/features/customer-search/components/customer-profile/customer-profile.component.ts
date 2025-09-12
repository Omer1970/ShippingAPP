import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil, switchMap, map } from 'rxjs/operators';

import { 
  CustomerWithHistory, 
  CustomerStatistics,
  Order,
  Shipment 
} from '../../../../core/models/customer.model';
import { CustomerService } from '../../../../core/services/customer.service';

@Component({
  selector: 'app-customer-profile',
  templateUrl: './customer-profile.component.html',
  styleUrls: ['./customer-profile.component.scss']
})
export class CustomerProfileComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  customer: CustomerWithHistory | null = null;
  orders: Order[] = [];
  shipments: Shipment[] = [];
  statistics: CustomerStatistics | null = null;
  
  ordersTotal = 0;
  shipmentsTotal = 0;
  ordersPerPage = 10;
  shipmentsPerPage = 10;
  currentOrdersPage = 1;
  currentShipmentsPage = 1;
  
  activeTab = 'overview';
  isLoading = false;
  error: string | null = null;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private customerService: CustomerService
  ) {}

  ngOnInit(): void {
    this.loadCustomerProfile();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCustomerProfile(): void {
    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        map(params => params.get('id')),
        switchMap(customerId => {
          const id = customerId ? parseInt(customerId, 10) : null;
          if (!id) {
            throw new Error('Invalid customer ID');
          }
          
          this.isLoading = true;
          return this.customerService.getCustomerProfile(id, true, true);
        })
      )
      .subscribe({
        next: (details) => {
          this.customer = details.customer;
          this.orders = details.customer.orders.data;
          this.shipments = details.customer.shipments.data;
          this.statistics = details.customer.statistics;
          this.ordersTotal = details.customer.orders.meta.total;
          this.shipmentsTotal = details.customer.shipments.meta.total;
          this.isLoading = false;
          this.error = null;
        },
        error: (error) => {
          this.error = error.message || 'Failed to load customer profile';
          this.isLoading = false;
          console.error('Error loading customer profile:', error);
        }
      });
  }

  onTabChange(tab: string): void {
    this.activeTab = tab;
  }

  onRefreshCustomer(): void {
    if (!this.customer) return;
    
    this.isLoading = true;
    this.customerService.refreshCustomerData(this.customer.id).subscribe({
      next: () => {
        this.loadCustomerProfile();
      },
      error: (error) => {
        this.error = 'Failed to refresh customer data';
        this.isLoading = false;
      }
    });
  }

  onEditCustomer(): void {
    if (!this.customer) return;
    this.router.navigate(['/customers', this.customer.id, 'edit']);
  }

  onBackToSearch(): void {
    this.router.navigate(['/customers/search']);
  }

  onNewOrder(): void {
    if (!this.customer) return;
    this.router.navigate(['/orders/new'], { 
      queryParams: { customer_id: this.customer.id }
    });
  }

  onNewShipment(): void {
    if (!this.customer) return;
    this.router.navigate(['/shipments/new'], { 
      queryParams: { customer_id: this.customer.id }
    });
  }

  onOrdersPageChange(page: number): void {
    if (!this.customer) return;
    this.currentOrdersPage = page;
    this.loadCustomerOrders();
  }

  onShipmentsPageChange(page: number): void {
    if (!this.customer) return;
    this.currentShipmentsPage = page;
    this.loadCustomerShipments();
  }

  private loadCustomerOrders(): void {
    if (!this.customer) return;
    
    this.customerService.getCustomerOrders(
      this.customer.id,
      this.currentOrdersPage,
      this.ordersPerPage
    ).subscribe({
      next: (response) => {
        this.orders = response.data;
        this.ordersTotal = response.pagination.total;
      },
      error: (error) => {
        console.error('Error loading orders:', error);
      }
    });
  }

  private loadCustomerShipments(): void {
    if (!this.customer) return;
    
    this.customerService.getCustomerShipments(
      this.customer.id,
      this.currentShipmentsPage,
      this.shipmentsPerPage
    ).subscribe({
      next: (response) => {
        this.shipments = response.data;
        this.shipmentsTotal = response.pagination.total;
      },
      error: (error) => {
        console.error('Error loading shipments:', error);
      }
    });
  }

  getCreditStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'Active': 'primary',
      'On_Hold': 'warn',
      'Suspended': 'accent',
      'Closed': 'disabled'
    };
    return colors[status] || 'default';
  }

  getCustomerTypeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'Individual': 'person',
      'Corporate': 'business',
      'Small_Business': 'store',
      'Government': 'account_balance'
    };
    return icons[type] || 'person_outline';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  formatDate(dateString: string): string {
    try {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(new Date(dateString));
    } catch {
      return dateString;
    }
  }

  getCustomerLevelColor(level: string): string {
    const colors: { [key: string]: string } = {
      'VIP': 'accent',
      'Premium': 'primary',
      'Regular': 'basic',
      'New': 'info',
      'Prospect': 'warn'
    };
    return colors[level] || 'basic';
  }

  getOrderStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'pending': 'warn',
      'processing': 'accent',
      'completed': 'primary',
      'cancelled': 'disabled'
    };
    return colors[status] || 'basic';
  }

  getShipmentStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'draft': 'basic',
      'validated': 'accent',
      'in_process': 'warn',
      'shipped': 'primary',
      'delivered': 'primary',
      'cancelled': 'disabled'
    };
    return colors[status] || 'basic';
  }

  getOrderStatusIcon(status: string): string {
    const icons: { [key: string]: string } = {
      'pending': 'schedule',
      'processing': 'autorenew',
      'completed': 'check_circle',
      'cancelled': 'cancel'
    };
    return icons[status] || 'help_outline';
  }

  getShipmentStatusIcon(status: string): string {
    const icons: { [key: string]: string } = {
      'draft': 'drafts',
      'validated': 'verified',
      'in_process': 'local_shipping',
      'shipped': 'local_shipping',
      'delivered': 'check_circle',
      'cancelled': 'cancel'
    };
    return icons[status] || 'help_outline';
  }

  getSuccessfulShipmentRate(statistics: CustomerStatistics): string {
    return statistics.successful_shipment_rate.toFixed(1) + '%';
  }

  getClassificationDescription(level: string): string {
    const descriptions: { [key: string]: string } = {
      'VIP': 'Premium customer with highest priority and benefits',
      'Premium': 'Valued customer with enhanced service level',
      'Regular': 'Standard customer with standard service',
      'New': 'Recently acquired customer',
      'Prospect': 'Potential customer under evaluation'
    };
    return descriptions[level] || 'Customer classification unknown';
  }
}