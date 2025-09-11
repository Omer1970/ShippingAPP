import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSortModule } from '@angular/material/sort';

import { OrderService } from '../../core/services/order.service';
import { Order, OrderStatus, OrderListResponse } from '../../core/models/order.model';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [
    CommonModule,
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
  templateUrl: './order-list.component.html',
  styleUrls: ['./order-list.component.scss']
})
export class OrderListComponent implements OnInit, OnDestroy {
  orders: Order[] = [];
  isLoading = false;
  error: string | null = null;
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;
  
  displayedColumns: string[] = ['reference', 'customer', 'status', 'orderDate', 'expectedDelivery', 'amount', 'actions'];
  
  private destroy$ = new Subject<void>();

  constructor(
    private orderService: OrderService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadOrders();
    this.setupOrderServiceSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupOrderServiceSubscriptions(): void {
    // Subscribe to loading state
    this.orderService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.isLoading = loading;
      });

    // Subscribe to error state
    this.orderService.error$
      .pipe(takeUntil(this.destroy$))
      .subscribe(error => {
        this.error = error;
      });
  }

  loadOrders(): void {
    const filter = {
      page: this.currentPage,
      perPage: this.itemsPerPage
    };

    this.orderService.getOrders(filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: OrderListResponse) => {
          if (response.success && response.data) {
            this.orders = response.data.orders;
            this.totalItems = response.data.pagination.totalItems;
            this.totalPages = response.data.pagination.totalPages;
            this.currentPage = response.data.pagination.currentPage;
          }
        },
        error: (error) => {
          console.error('Error loading orders:', error);
          this.error = 'Failed to load orders. Please try again.';
        }
      });
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1;
    this.itemsPerPage = event.pageSize;
    this.loadOrders();
  }

  viewOrder(order: Order): void {
    this.router.navigate(['/orders', order.id]);
  }

  refreshOrder(order: Order): void {
    this.orderService.refreshOrder(order.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Order refreshed:', response);
          this.loadOrders();
        },
        error: (error) => {
          console.error('Error refreshing order:', error);
          this.error = 'Failed to refresh order data.';
        }
      });
  }

  getStatusColor(status: OrderStatus): string {
    return this.orderService.getOrderStatusColor(status);
  }

  getStatusIcon(status: OrderStatus): string {
    return this.orderService.getOrderStatusIcon(status);
  }

  getStatusBadgeClass(status: OrderStatus): string {
    return this.orderService.getOrderStatusBadgeClass(status);
  }

  formatDate(date: string): string {
    return this.orderService.formatOrderDate(date);
  }

  formatAmount(amount: { exclTax: number; inclTax: number; currency: string }): string {
    return this.orderService.formatOrderAmount(amount);
  }

  getDeliveryUrgency(order: Order): string {
    return this.orderService.getOrderDeliveryUrgency(order.expectedDelivery);
  }

  getDeliveryUrgencyColor(urgency: string): string {
    return this.orderService.getOrderDeliveryUrgencyColor(urgency as any);
  }

  trackByOrderId(index: number, order: Order): number {
    return order.id;
  }

  reloadData(): void {
    this.error = null;
    this.loadOrders();
  }

  clearError(): void {
    this.error = null;
    this.orderService.clearError();
  }
}