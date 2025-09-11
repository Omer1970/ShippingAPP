/**
 * Simplified Shipment Model for Story 002 - Basic Listing
 * This file replaces the over-engineered 1000+ line shipment.model.ts
 * with just the essential types needed for basic listing functionality.
 */

// Basic Customer interface for shipments
export interface Customer {
  id: number;
  name: string;
  address?: string;
  city?: string;
  zip?: string;
  phone?: string;
  email?: string;
}

// Basic Author interface for shipments
export interface Author {
  id?: number;
  name?: string;
}

// Shipment status as returned by API
export type ShipmentStatus = 'draft' | 'validated' | 'in_transit' | 'delivered' | 'cancelled' | 'unknown';

// Core Shipment interface - matches API resource exactly
export interface Shipment {
  id: number;
  dolibarrShipmentId: number;
  reference: string;
  customerName: string;
  deliveryAddress?: string;
  status: string; // Comes as string from API
  expectedDelivery?: string;
  assignedDriver?: string;
  totalWeight?: number;
  totalValue?: number;
  createdFromDolibarr: boolean;
  lastSynced?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Pagination structure
export interface ShipmentPagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// API Response structures
export interface ShipmentListResponse {
  success: boolean;
  data: {
    shipments: Shipment[];
    pagination: ShipmentPagination;
  };
  message: string;
}

export interface ShipmentDetailResponse {
  success: boolean;
  data: {
    shipment: Shipment;
  };
  message: string;
}

// Basic filter interface for querying shipments
export interface ShipmentFilter {
  status?: string;
  page?: number;
  perPage?: number;
}

// Query parameters interface for API calls
export interface ShipmentQueryParams {
  page?: number;
  per_page?: number;
  status?: string;
}

/**
 * Status mapping from numeric codes to string values
 * Matches backend implementation
 */
export const SHIPMENT_STATUS_MAP = {
  0: 'draft',
  1: 'validated', 
  2: 'in_transit',
  3: 'delivered',
  9: 'cancelled'
} as const;

export function mapShipmentStatus(code: number): string {
  return SHIPMENT_STATUS_MAP[code as keyof typeof SHIPMENT_STATUS_MAP] || 'unknown';
}

/**
 * Utility functions for shipment data
 */

export function formatShipmentAddress(shipment: Shipment): string {
  if (!shipment.deliveryAddress) return '';
  return shipment.deliveryAddress;
}

export function formatDriverName(driverName?: string): string {
  if (!driverName) return 'Unassigned';
  return driverName;
}

export function formatExpectedDelivery(date?: string): string {
  if (!date) return 'Not specified';
  const deliveryDate = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const delivery = new Date(deliveryDate.getFullYear(), deliveryDate.getMonth(), deliveryDate.getDate());
  
  if (delivery < today) return 'Overdue';
  if (delivery.getTime() === today.getTime()) return 'Today';
  
  return deliveryDate.toLocaleDateString();
}

/**
 * Type guards for API responses
 */
export function isShipmentListResponse(response: any): response is ShipmentListResponse {
  return response && 
         typeof response.success === 'boolean' &&
         response.data &&
         Array.isArray(response.data.shipments) &&
         response.data.pagination &&
         typeof response.message === 'string';
}

export function isShipmentDetailResponse(response: any): response is ShipmentDetailResponse {
  return response && 
         typeof response.success === 'boolean' &&
         response.data &&
         response.data.shipment &&
         typeof response.message === 'string';
}

/**
 * Basic filtering helpers
 */
export function filterShipmentsByStatus(shipments: Shipment[], status: string): Shipment[] {
  return shipments.filter(shipment => shipment.status === status);
}

export function searchShipments(shipments: Shipment[], query: string): Shipment[] {
  if (!query.trim()) return shipments;
  
  return shipments.filter(shipment =>
    shipment.reference.toLowerCase().includes(query.toLowerCase()) ||
    shipment.customerName.toLowerCase().includes(query.toLowerCase())
  );
}

export function sortShipmentsByDate(shipments: Shipment[]): Shipment[] {
  return shipments.sort((a, b) => {
    if (!a.createdAt || !b.createdAt) return 0;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}