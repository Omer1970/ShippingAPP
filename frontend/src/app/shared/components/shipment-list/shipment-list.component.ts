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
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSortModule } from '@angular/material/sort';

import { ShipmentService } from '../../core/services/shipment.service';
import { Shipment, ShipmentStatus, ShipmentListResponse } from '../../core/models/shipment.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-shipment-list',
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
    MatBadgeModule,
    MatTooltipModule,
    MatSortModule
  ],
  templateUrl: './shipment-list.component.html',
  styleUrls: ['./shipment-list.component.scss']
})
export class ShipmentListComponent implements OnInit, OnDestroy {
  shipments: Shipment[] = [];
  isLoading = false;
  error: string | null = null;
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;
  
  displayedColumns: string[] = ['reference', 'customer', 'status', 'expectedDelivery', 'driver', 'weight', 'actions'];
  
  private destroy$ = new Subject<void>();

  constructor(
    private shipmentService: ShipmentService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadShipments();
    this.setupShipmentServiceSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupShipmentServiceSubscriptions(): void {
    // Subscribe to loading state
    this.shipmentService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.isLoading = loading;
      });

    // Subscribe to error state
    this.shipmentService.error$
      .pipe(takeUntil(this.destroy$))
      .subscribe(error => {
        this.error = error;
      });
  }

  loadShipments(): void {
    const filter = {
      page: this.currentPage,
      perPage: this.itemsPerPage
    };

    this.shipmentService.getShipments(filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: ShipmentListResponse) => {
          if (response.success && response.data) {
            this.shipments = response.data.shipments;
            this.totalItems = response.data.pagination.totalItems;
            this.totalPages = response.data.pagination.totalPages;
            this.currentPage = response.data.pagination.currentPage;
          }
        },
        error: (error) => {
          console.error('Error loading shipments:', error);
          this.error = 'Failed to load shipments. Please try again.';
        }
      });
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1;
    this.itemsPerPage = event.pageSize;
    this.loadShipments();
  }

  viewShipment(shipment: Shipment): void {
    this.router.navigate(['/shipments', shipment.id]);
  }

  refreshShipment(shipment: Shipment): void {
    this.shipmentService.refreshShipment(shipment.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Shipment refreshed:', response);
          this.loadShipments();
        },
        error: (error) => {
          console.error('Error refreshing shipment:', error);
          this.error = 'Failed to refresh shipment data.';
        }
      });
  }

  getStatusColor(status: ShipmentStatus): string {
    return this.shipmentService.getShipmentStatusColor(status);
  }

  getStatusIcon(status: ShipmentStatus): string {
    return this.shipmentService.getShipmentStatusIcon(status);
  }

  getStatusBadgeClass(status: ShipmentStatus): string {
    return this.shipmentService.getShipmentStatusBadgeClass(status);
  }

  formatDate(date: string): string {
    return this.shipmentService.formatShipmentDate(date);
  }

  formatWeight(weight?: number, units?: number): string {
    return this.shipmentService.formatShipmentWeight(weight, units);
  }

  getDeliveryUrgency(shipment: Shipment): string {
    return this.shipmentService.getShipmentDeliveryUrgency(shipment.expectedDelivery);
  }

  getDeliveryUrgencyColor(urgency: string): string {
    return this.shipmentService.getShipmentDeliveryUrgencyColor(urgency as any);
  }

  trackByShipmentId(index: number, shipment: Shipment): number {
    return shipment.id;
  }

  reloadData(): void {
    this.error = null;
    this.loadShipments();
  }

  clearError(): void {
    this.error = null;
    this.shipmentService.clearError();
  }
}