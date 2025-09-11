/**
 * Simplified Order Model for Story 002 - Basic Listing
 * This file provides minimal types needed for basic order listing.
 */

// Basic Customer interface for orders
export interface OrderCustomer {
  id: number;
  name: string;
  address?: string;
  zip?: string;
  city?: string;
  phone?: string;
  email?: string;
}

// Basic Author interface for orders
export interface OrderAuthor {
  id?: number;
  name?: string;
}

// Order status as returned by API
export type OrderStatus = 'draft' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'unknown';

// Amount with currency info
export interface OrderAmount {
  exclTax: number;
  inclTax: number;
  currency: string;
}

// Core Order interface - matches API resource exactly
export interface Order {
  id: number;
  dolibarrOrderId: number;
  reference: string;
  customerReference?: string;
  customer: OrderCustomer;
  status: string; // Comes as string from API
  statusCode: number;
  orderDate?: string;
  expectedDelivery?: string;
  createdAt?: string;
  author?: OrderAuthor;
  totalAmount: OrderAmount;
  shippingAddress?: string;
  billingAddress?: string;
  privateNote?: string;
  publicNote?: string;
  lastSynced?: string;
}

// Pagination structure
export interface OrderPagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// API Response structures
export interface OrderListResponse {
  success: boolean;
  data: {
    orders: Order[];
    pagination: OrderPagination;
  };
  message: string;
}

export interface OrderDetailResponse {
  success: boolean;
  data: {
    order: Order;
  };
  message: string;
}

// Basic filter interface for querying orders
export interface OrderFilter {
  status?: string;
  customerId?: number;
  page?: number;
  perPage?: number;
}

// Query parameters interface for API calls
export interface OrderQueryParams {
  page?: number;
  per_page?: number;
  status?: string;
  customer_id?: number;
}

/**
 * Status mapping from numeric codes to string values
 * Matches backend implementation
 */
export const ORDER_STATUS_MAP = {
  0: 'draft',
  1: 'pending',
  2: 'processing', 
  3: 'shipped',
  4: 'delivered',
  9: 'cancelled'
} as const;

export function mapOrderStatus(code: number): string {
  return ORDER_STATUS_MAP[code as keyof typeof ORDER_STATUS_MAP] || 'unknown';
}

/**
 * Utility functions for order data
 */

export function formatOrderAddress(order: Order): string {
  return order.shippingAddress || `${order.customer.name}, ${order.customer.city || 'Unknown location'}`;
}

export function formatOrderTotal(order: Order): string {
  const amount = order.totalAmount;
  const total = amount.inclTax > 0 ? amount.inclTax : amount.exclTax;
  return `${total.toFixed(2)} ${amount.currency}`;
}

export function formatOrderDate(date?: string): string {
  if (!date) return 'Unknown';
  const orderDate = new Date(date);
  return orderDate.toLocaleDateString();
}

export function getOrderDaysSinceCreated(order: Order): number {
  if (!order.createdAt) return 0;
  const created = new Date(order.createdAt);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - created.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Type guards for API responses
 */
export function isOrderListResponse(response: any): response is OrderListResponse {
  return response && 
         typeof response.success === 'boolean' &&
         response.data &&
         Array.isArray(response.data.orders) &&
         response.data.pagination &&
         typeof response.message === 'string';
}

export function isOrderDetailResponse(response: any): response is OrderDetailResponse {
  return response && 
         typeof response.success === 'boolean' &&
         response.data &&
         response.data.order &&
         typeof response.message === 'string';
}

/**
 * Basic filtering helpers
 */
export function filterOrdersByStatus(orders: Order[], status: string): Order[] {
  return orders.filter(order => order.status === status);
}

export function filterOrdersByCustomer(orders: Order[], customerId: number): Order[] {
  return orders.filter(order => order.customer.id === customerId);
}

export function searchOrders(orders: Order[], query: string): Order[] {
  if (!query.trim()) return orders;
  
  return orders.filter(order =>
    order.reference.toLowerCase().includes(query.toLowerCase()) ||
    order.customer.name.toLowerCase().includes(query.toLowerCase()) ||
    (order.customerReference && order.customerReference.toLowerCase().includes(query.toLowerCase()))
  );
}

export function sortOrdersByDate(orders: Order[]): Order[] {
  return orders.sort((a, b) => {
    if (!a.orderDate || !b.orderDate) return 0;
    return new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime();
  });
}