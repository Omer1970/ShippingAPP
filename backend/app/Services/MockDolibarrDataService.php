<?php

namespace App\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Pagination\LengthAwarePaginator as Paginator;

/**
 * Mock Dolibarr Data Service for development and testing
 * Provides sample data when Dolibarr connection is unavailable
 */
class MockDolibarrDataService
{
    private array $sampleShipments = [];
    private array $sampleOrders = [];

    public function __construct()
    {
        $this->initializeSampleData();
    }

    /**
     * Initialize sample data for development
     */
    private function initializeSampleData(): void
    {
        $this->sampleShipments = [
            [
                'dolibarr_shipment_id' => 1,
                'reference' => 'SH2025001',
                'customer_reference' => 'CUST-REF-001',
                'customer_id' => 101,
                'customer_name' => 'ABC Company Ltd',
                'customer_address' => '123 Main Street, Business District',
                'customer_zip' => '12345',
                'customer_city' => 'New York',
                'customer_phone' => '+1-555-0123',
                'customer_email' => 'contact@abccompany.com',
                'created_at' => '2025-09-01 10:30:00',
                'expected_delivery' => '2025-09-15',
                'status' => 2,
                'author_id' => 3,
                'author_name' => 'omer.ulusoy',
                'total_weight' => 25.5,
                'weight_units' => 0,
                'private_note' => 'Handle with care - fragile items',
                'public_note' => 'Delivery between 9AM-5PM'
            ],
            [
                'dolibarr_shipment_id' => 2,
                'reference' => 'SH2025002',
                'customer_reference' => 'CUST-REF-002',
                'customer_id' => 102,
                'customer_name' => 'Tech Solutions Inc',
                'customer_address' => '456 Innovation Blvd',
                'customer_zip' => '67890',
                'customer_city' => 'San Francisco',
                'customer_phone' => '+1-555-0456',
                'customer_email' => 'orders@techsolutions.com',
                'created_at' => '2025-09-02 14:15:00',
                'expected_delivery' => '2025-09-16',
                'status' => 1,
                'author_id' => 1,
                'author_name' => 'admin',
                'total_weight' => 12.3,
                'weight_units' => 0,
                'private_note' => 'Priority delivery',
                'public_note' => 'Call customer upon arrival'
            ],
            [
                'dolibarr_shipment_id' => 3,
                'reference' => 'SH2025003',
                'customer_reference' => 'CUST-REF-003',
                'customer_id' => 103,
                'customer_name' => 'Global Logistics Corp',
                'customer_address' => '789 Harbor Road',
                'customer_zip' => '34567',
                'customer_city' => 'Los Angeles',
                'customer_phone' => '+1-555-0789',
                'customer_email' => 'shipping@globallogistics.com',
                'created_at' => '2025-09-03 09:45:00',
                'expected_delivery' => '2025-09-17',
                'status' => 3,
                'author_id' => 3,
                'author_name' => 'omer.ulusoy',
                'total_weight' => 45.8,
                'weight_units' => 0,
                'private_note' => 'Heavy items - use lifting equipment',
                'public_note' => 'Loading dock required'
            ]
        ];

        $this->sampleOrders = [
            [
                'dolibarr_order_id' => 1,
                'reference' => 'ORD2025001',
                'customer_reference' => 'PO-001-2025',
                'customer_id' => 101,
                'customer_name' => 'ABC Company Ltd',
                'customer_address' => '123 Main Street, Business District',
                'customer_zip' => '12345',
                'customer_city' => 'New York',
                'customer_phone' => '+1-555-0123',
                'customer_email' => 'contact@abccompany.com',
                'created_at' => '2025-08-15 11:20:00',
                'order_date' => '2025-08-15',
                'expected_delivery' => '2025-09-15',
                'status' => 2,
                'author_id' => 3,
                'author_name' => 'omer.ulusoy',
                'total_excl_tax' => 1250.00,
                'total_incl_tax' => 1500.00,
                'shipping_address' => '123 Main Street, Business District, New York, 12345',
                'billing_address' => '123 Main Street, Business District, New York, 12345',
                'private_note' => 'Corporate account - net 30 terms',
                'public_note' => 'Standard delivery terms apply'
            ],
            [
                'dolibarr_order_id' => 2,
                'reference' => 'ORD2025002',
                'customer_reference' => 'PO-002-2025',
                'customer_id' => 102,
                'customer_name' => 'Tech Solutions Inc',
                'customer_address' => '456 Innovation Blvd',
                'customer_zip' => '67890',
                'customer_city' => 'San Francisco',
                'customer_phone' => '+1-555-0456',
                'customer_email' => 'orders@techsolutions.com',
                'created_at' => '2025-08-20 16:30:00',
                'order_date' => '2025-08-20',
                'expected_delivery' => '2025-09-16',
                'status' => 1,
                'author_id' => 1,
                'author_name' => 'admin',
                'total_excl_tax' => 2100.00,
                'total_incl_tax' => 2520.00,
                'shipping_address' => '456 Innovation Blvd, San Francisco, 67890',
                'billing_address' => '456 Innovation Blvd, San Francisco, 67890',
                'private_note' => 'Express processing requested',
                'public_note' => 'Expedited shipping required'
            ],
            [
                'dolibarr_order_id' => 3,
                'reference' => 'ORD2025003',
                'customer_reference' => 'PO-003-2025',
                'customer_id' => 103,
                'customer_name' => 'Global Logistics Corp',
                'customer_address' => '789 Harbor Road',
                'customer_zip' => '34567',
                'customer_city' => 'Los Angeles',
                'customer_phone' => '+1-555-0789',
                'customer_email' => 'shipping@globallogistics.com',
                'created_at' => '2025-08-25 13:45:00',
                'order_date' => '2025-08-25',
                'expected_delivery' => '2025-09-17',
                'status' => 3,
                'author_id' => 3,
                'author_name' => 'omer.ulusoy',
                'total_excl_tax' => 3500.00,
                'total_incl_tax' => 4200.00,
                'shipping_address' => '789 Harbor Road, Los Angeles, 34567',
                'billing_address' => '789 Harbor Road, Los Angeles, 34567',
                'private_note' => 'Bulk order - volume discount applied',
                'public_note' => 'Delivery appointment required'
            ]
        ];
    }

    /**
     * Get paginated list of shipments (mock implementation)
     */
    public function getShipments(int $page = 1, int $perPage = 10, ?string $status = null, ?int $driverId = null): LengthAwarePaginator
    {
        $shipments = collect($this->sampleShipments);
        
        // Apply status filter if provided
        if ($status !== null) {
            $statusCode = $this->mapShipmentStatusToDolibarr($status);
            if ($statusCode !== null) {
                $shipments = $shipments->where('status', $statusCode);
            }
        }
        
        // Apply driver filter if provided
        if ($driverId !== null) {
            $shipments = $shipments->where('author_id', $driverId);
        }
        
        // Create paginator
        $total = $shipments->count();
        $items = $shipments->forPage($page, $perPage)->values();
        
        return new Paginator($items, $total, $perPage, $page, [
            'path' => url('/api/shipments'),
            'pageName' => 'page'
        ]);
    }

    /**
     * Get single shipment details (mock implementation)
     */
    public function getShipmentById(int $shipmentId): ?array
    {
        $shipment = collect($this->sampleShipments)->firstWhere('dolibarr_shipment_id', $shipmentId);
        return $shipment ?? null;
    }

    /**
     * Get paginated list of orders (mock implementation)
     */
    public function getOrders(int $page = 1, int $perPage = 10, ?string $status = null, ?int $customerId = null): LengthAwarePaginator
    {
        $orders = collect($this->sampleOrders);
        
        // Apply status filter if provided
        if ($status !== null) {
            $statusCode = $this->mapOrderStatusToDolibarr($status);
            if ($statusCode !== null) {
                $orders = $orders->where('status', $statusCode);
            }
        }
        
        // Apply customer filter if provided
        if ($customerId !== null) {
            $orders = $orders->where('customer_id', $customerId);
        }
        
        // Create paginator
        $total = $orders->count();
        $items = $orders->forPage($page, $perPage)->values();
        
        return new Paginator($items, $total, $perPage, $page, [
            'path' => url('/api/orders'),
            'pageName' => 'page'
        ]);
    }

    /**
     * Get single order details (mock implementation)
     */
    public function getOrderById(int $orderId): ?array
    {
        $order = collect($this->sampleOrders)->firstWhere('dolibarr_order_id', $orderId);
        return $order ?? null;
    }

    /**
     * Get shipments by status (mock implementation)
     */
    public function getShipmentsByStatus(string $status, int $page = 1, int $perPage = 10): array
    {
        $statusCode = $this->mapShipmentStatusToDolibarr($status);
        $filteredShipments = $statusCode !== null 
            ? collect($this->sampleShipments)->where('status', $statusCode)->values()->all()
            : [];
        
        return $this->createPaginationData($filteredShipments, $page, $perPage);
    }

    /**
     * Get orders by status (mock implementation)
     */
    public function getOrdersByStatus(string $status, int $page = 1, int $perPage = 10): array
    {
        $statusCode = $this->mapOrderStatusToDolibarr($status);
        $filteredOrders = $statusCode !== null 
            ? collect($this->sampleOrders)->where('status', $statusCode)->values()->all()
            : [];
        
        return $this->createPaginationData($filteredOrders, $page, $perPage);
    }

    /**
     * Get shipments assigned to specific driver (mock implementation)
     */
    public function getDriverShipments(int $driverId, int $page = 1, int $perPage = 10): LengthAwarePaginator
    {
        return $this->getShipments($page, $perPage, null, $driverId);
    }

    /**
     * Get orders for specific customer (mock implementation)
     */
    public function getCustomerOrders(int $customerId, int $page = 1, int $perPage = 10): LengthAwarePaginator
    {
        return $this->getOrders($page, $perPage, null, $customerId);
    }

    /**
     * Map application shipment status to Dolibarr status codes
     */
    private function mapShipmentStatusToDolibarr(?string $status): ?int
    {
        $statusMap = [
            'draft' => 0,
            'validated' => 1,
            'in_transit' => 2,
            'delivered' => 3,
            'cancelled' => 9
        ];

        return isset($statusMap[$status]) ? $statusMap[$status] : null;
    }

    /**
     * Map application order status to Dolibarr status codes
     */
    private function mapOrderStatusToDolibarr(?string $status): ?int
    {
        $statusMap = [
            'draft' => 0,
            'pending' => 1,
            'processing' => 2,
            'shipped' => 3,
            'delivered' => 4,
            'cancelled' => 9
        ];

        return isset($statusMap[$status]) ? $statusMap[$status] : null;
    }

    /**
     * Clear cache for specific shipment (no-op for mock)
     */
    public function clearShipmentCache(int $shipmentId): void
    {
        // No-op for mock service
    }

    /**
     * Clear cache for specific order (no-op for mock)
     */
    public function clearOrderCache(int $orderId): void
    {
        // No-op for mock service
    }

    /**
     * Clear cache for shipment lists (no-op for mock)
     */
    public function clearShipmentListCache(): void
    {
        // No-op for mock service
    }

    /**
     * Clear cache for order lists (no-op for mock)
     */
    public function clearOrderListCache(): void
    {
        // No-op for mock service
    }

    /**
     * Add more sample data for development
     */
    public function addSampleShipment(array $shipmentData): void
    {
        $this->sampleShipments[] = array_merge([
            'dolibarr_shipment_id' => max(array_column($this->sampleShipments, 'dolibarr_shipment_id')) + 1,
            'created_at' => now()->toDateTimeString(),
        ], $shipmentData);
    }

    /**
     * Add more sample data for development
     */
    public function addSampleOrder(array $orderData): void
    {
        $this->sampleOrders[] = array_merge([
            'dolibarr_order_id' => max(array_column($this->sampleOrders, 'dolibarr_order_id')) + 1,
            'created_at' => now()->toDateTimeString(),
        ], $orderData);
    }

    /**
     * Create pagination data array consistent with DolibarrDataService
     */
    private function createPaginationData(array $items, int $page, int $perPage): array
    {
        $totalItems = count($items);
        $totalPages = max(1, ceil($totalItems / $perPage));
        $offset = ($page - 1) * $perPage;
        $paginatedItems = array_slice($items, $offset, $perPage);
        
        return [
            'data' => $paginatedItems,
            'pagination' => [
                'current_page' => $page,
                'total_pages' => $totalPages,
                'total_items' => $totalItems,
                'items_per_page' => $perPage,
                'has_next' => $page < $totalPages,
                'has_previous' => $page > 1
            ]
        ];
    }

    /**
     * Get all sample shipments (for testing)
     */
    public function getAllSampleShipments(): array
    {
        return $this->sampleShipments;
    }

    /**
     * Get all sample orders (for testing)
     */
    public function getAllSampleOrders(): array
    {
        return $this->sampleOrders;
    }

    /**
     * Reset to default sample data
     */
    public function resetSampleData(): void
    {
        $this->initializeSampleData();
    }
}