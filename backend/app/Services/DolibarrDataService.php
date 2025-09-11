<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Exception;

/**
 * Service for fetching shipment and order data from Dolibarr ERP system.
 * Provides read-only access to Dolibarr database with caching and proper error handling.
 */
class DolibarrDataService
{
    private const CACHE_TTL = 1800; // 30 minutes
    private const DEFAULT_PAGE_SIZE = 10;
    private const MAX_PAGE_SIZE = 100;

    /**
     * Get shipments from Dolibarr with pagination and filtering
     */
    public function getShipments(array $filters = [], int $page = 1, int $perPage = self::DEFAULT_PAGE_SIZE): array
    {
        $perPage = $this->normalizePageSize($perPage);
        $cacheKey = $this->generateCacheKey('shipments', $filters, $page, $perPage);

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($filters, $page, $perPage) {
            try {
                $query = DB::connection('dolibarr')
                    ->table('llx_expedition as e')
                    ->leftJoin('llx_societe as s', 'e.fk_soc', '=', 's.rowid')
                    ->leftJoin('llx_user as u', 'e.fk_user_valid', '=', 'u.rowid')
                    ->select([
                        'e.rowid as id',
                        'e.ref as reference',
                        'e.fk_soc as customer_id',
                        's.nom as customer_name',
                        'e.fk_statut as status_code',
                        'e.date_delivery as expected_delivery',
                        'e.date_creation as created_at',
                        'e.weight as total_weight',
                        'e.weight_units',
                        'u.lastname as driver_lastname',
                        'u.firstname as driver_firstname',
                        's.address',
                        's.zip',
                        's.town',
                        's.country',
                        DB::raw("e.rowid as dolibarr_shipment_id")
                    ]);

                // Apply filters from the story requirements
                if (isset($filters['customer_id'])) {
                    $query->where('e.fk_soc', $filters['customer_id']);
                }

                if (isset($filters['status'])) {
                    $statusCode = $this->mapShipmentStatusToCode($filters['status']);
                    if ($statusCode !== null) {
                        $query->where('e.fk_statut', $statusCode);
                    }
                }

                if (isset($filters['user_id'])) {
                    $query->where('e.fk_user_valid', $filters['user_id']);
                }

                // Get total count before pagination
                $totalItems = $query->count();
                $totalPages = ceil($totalItems / $perPage);

                // Apply pagination
                $offset = ($page - 1) * $perPage;
                $shipments = $query->orderBy('e.rowid', 'desc')
                    ->offset($offset)
                    ->limit($perPage)
                    ->get();

                // Transform data according to story specification
                $transformedData = [];
                foreach ($shipments as $shipment) {
                    $transformedData[] = [
                        'id' => $shipment->id,
                        'dolibarr_shipment_id' => $shipment->dolibarr_shipment_id,
                        'reference' => $shipment->reference,
                        'customer_name' => $shipment->customer_name,
                        'delivery_address' => $this->formatAddress($shipment),
                        'status' => $this->mapShipmentStatus($shipment->status_code),
                        'expected_delivery' => $shipment->expected_delivery,
                        'assigned_driver' => $this->formatDriverName($shipment),
                        'total_weight' => $shipment->total_weight,
                    ];
                }

                return [
                    'data' => $transformedData,
                    'pagination' => [
                        'current_page' => $page,
                        'total_pages' => $totalPages,
                        'total_items' => $totalItems,
                        'items_per_page' => $perPage,
                        'has_next' => $page < $totalPages,
                        'has_previous' => $page > 1
                    ]
                ];

            } catch (Exception $e) {
                Log::error('Failed to fetch shipments from Dolibarr', [
                    'error' => $e->getMessage(),
                    'filters' => $filters,
                    'page' => $page,
                    'per_page' => $perPage
                ]);
                
                // Return empty result on error instead of throwing exception
                return [
                    'data' => [],
                    'pagination' => [
                        'current_page' => $page,
                        'total_pages' => 1,
                        'total_items' => 0,
                        'items_per_page' => $perPage,
                        'has_next' => false,
                        'has_previous' => false
                    ]
                ];
            }
        });
    }

    /**
     * Get single shipment by ID from Dolibarr
     */
    public function getShipmentById(int $id): ?array
    {
        $cacheKey = "shipment_{$id}";

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($id) {
            try {
                $shipment = DB::connection('dolibarr')
                    ->table('llx_expedition as e')
                    ->leftJoin('llx_societe as s', 'e.fk_soc', '=', 's.rowid')
                    ->leftJoin('llx_user as u', 'e.fk_user_valid', '=', 'u.rowid')
                    ->select([
                        'e.rowid as id',
                        'e.ref as reference',
                        'e.fk_soc as customer_id',
                        's.nom as customer_name',
                        'e.fk_statut as status_code',
                        'e.date_delivery as expected_delivery',
                        'e.date_creation as created_at',
                        'e.weight as total_weight',
                        'e.weight_units',
                        'u.lastname as driver_lastname',
                        'u.firstname as driver_firstname',
                        's.address',
                        's.zip',
                        's.town',
                        's.country',
                        DB::raw("e.rowid as dolibarr_shipment_id")
                    ])
                    ->where('e.rowid', $id)
                    ->first();

                if (!$shipment) {
                    return null;
                }

                return [
                    'id' => $shipment->id,
                    'dolibarr_shipment_id' => $shipment->dolibarr_shipment_id,
                    'reference' => $shipment->reference,
                    'customer_name' => $shipment->customer_name,
                    'delivery_address' => $this->formatAddress($shipment),
                    'status' => $this->mapShipmentStatus($shipment->status_code),
                    'expected_delivery' => $shipment->expected_delivery,
                    'assigned_driver' => $this->formatDriverName($shipment),
                    'total_weight' => $shipment->total_weight,
                ];

            } catch (Exception $e) {
                Log::error('Failed to fetch shipment from Dolibarr', [
                    'error' => $e->getMessage(),
                    'shipment_id' => $id
                ]);
                
                return null;
            }
        });
    }

    /**
     * Get shipments by status from Dolibarr
     */
    public function getShipmentsByStatus(string $status, int $page = 1, int $perPage = self::DEFAULT_PAGE_SIZE): array
    {
        return $this->getShipments(['status' => $status], $page, $perPage);
    }

    /**
     * Get orders from Dolibarr with pagination and filtering
     */
    public function getOrders(array $filters = [], int $page = 1, int $perPage = self::DEFAULT_PAGE_SIZE): array
    {
        $perPage = $this->normalizePageSize($perPage);
        $cacheKey = $this->generateCacheKey('orders', $filters, $page, $perPage);

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($filters, $page, $perPage) {
            try {
                $query = DB::connection('dolibarr')
                    ->table('llx_commande as c')
                    ->leftJoin('llx_societe as s', 'c.fk_soc', '=', 's.rowid')
                    ->select([
                        'c.rowid as id',
                        'c.ref as reference',
                        'c.fk_soc as customer_id',
                        's.nom as customer_name',
                        'c.fk_statut as status_code',
                        'c.date_commande as order_date',
                        'c.total_ttc as total_amount',
                        's.address',
                        's.zip',
                        's.town',
                        's.country',
                        DB::raw("c.rowid as dolibarr_order_id"),
                        DB::raw("'Y' as created_from_dolibarr"),
                        DB::raw("CURRENT_TIMESTAMP as last_synced")
                    ]);

                // Apply filters from the story requirements
                if (isset($filters['customer_id'])) {
                    $query->where('c.fk_soc', $filters['customer_id']);
                }

                if (isset($filters['status'])) {
                    $statusCode = $this->mapOrderStatusToCode($filters['status']);
                    if ($statusCode !== null) {
                        $query->where('c.fk_statut', $statusCode);
                    }
                }

                // Get total count before pagination
                $totalItems = $query->count();
                $totalPages = ceil($totalItems / $perPage);

                // Apply pagination
                $offset = ($page - 1) * $perPage;
                $orders = $query->orderBy('c.rowid', 'desc')
                    ->offset($offset)
                    ->limit($perPage)
                    ->get();

                // Transform data according to story specification
                $transformedData = [];
                foreach ($orders as $order) {
                    $transformedData[] = [
                        'id' => $order->id,
                        'dolibarr_order_id' => $order->dolibarr_order_id,
                        'reference' => $order->reference,
                        'customer_name' => $order->customer_name,
                        'order_date' => $order->order_date,
                        'status' => $this->mapOrderStatus($order->status_code),
                        'total_amount' => $order->total_amount,
                        'shipping_address' => $this->formatAddress($order),
                        'billing_address' => $this->formatAddress($order),
                    ];
                }

                return [
                    'data' => $transformedData,
                    'pagination' => [
                        'current_page' => $page,
                        'total_pages' => $totalPages,
                        'total_items' => $totalItems,
                        'items_per_page' => $perPage,
                        'has_next' => $page < $totalPages,
                        'has_previous' => $page > 1
                    ]
                ];

            } catch (Exception $e) {
                Log::error('Failed to fetch orders from Dolibarr', [
                    'error' => $e->getMessage(),
                    'filters' => $filters,
                    'page' => $page,
                    'per_page' => $perPage
                ]);
                
                return [
                    'data' => [],
                    'pagination' => [
                        'current_page' => $page,
                        'total_pages' => 1,
                        'total_items' => 0,
                        'items_per_page' => $perPage,
                        'has_next' => false,
                        'has_previous' => false
                    ]
                ];
            }
        });
    }

    /**
     * Get single order by ID from Dolibarr
     */
    public function getOrderById(int $id): ?array
    {
        $cacheKey = "order_{$id}";

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($id) {
            try {
                $order = DB::connection('dolibarr')
                    ->table('llx_commande as c')
                    ->leftJoin('llx_societe as s', 'c.fk_soc', '=', 's.rowid')
                    ->select([
                        'c.rowid as id',
                        'c.ref as reference',
                        'c.fk_soc as customer_id',
                        's.nom as customer_name',
                        'c.fk_statut as status_code',
                        'c.date_commande as order_date',
                        'c.total_ttc as total_amount',
                        's.address',
                        's.zip',
                        's.town',
                        's.country',
                        DB::raw("c.rowid as dolibarr_order_id"),
                        DB::raw("'Y' as created_from_dolibarr"),
                        DB::raw("CURRENT_TIMESTAMP as last_synced")
                    ])
                    ->where('c.rowid', $id)
                    ->first();

                if (!$order) {
                    return null;
                }

                return [
                    'id' => $order->id,
                    'dolibarr_order_id' => $order->dolibarr_order_id,
                    'reference' => $order->reference,
                    'customer_name' => $order->customer_name,
                    'order_date' => $order->order_date,
                    'status' => $this->mapOrderStatus($order->status_code),
                    'total_amount' => $order->total_amount,
                    'shipping_address' => $this->formatAddress($order),
                    'billing_address' => $this->formatAddress($order),
                ];

            } catch (Exception $e) {
                Log::error('Failed to fetch order from Dolibarr', [
                    'error' => $e->getMessage(),
                    'order_id' => $id
                ]);
                
                return null;
            }
        });
    }

    /**
     * Get orders by status from Dolibarr
     */
    public function getOrdersByStatus(string $status, int $page = 1, int $perPage = self::DEFAULT_PAGE_SIZE): array
    {
        return $this->getOrders(['status' => $status], $page, $perPage);
    }

    /**
     * Get orders by customer from Dolibarr
     */
    public function getOrdersByCustomer(int $customerId, int $page = 1, int $perPage = self::DEFAULT_PAGE_SIZE): array
    {
        return $this->getOrders(['customer_id' => $customerId], $page, $perPage);
    }

    /**
     * Map Dolibarr shipment status codes to application statuses
     */
    private function mapShipmentStatus(int $statusCode): string
    {
        return match ($statusCode) {
            0 => 'draft',
            1 => 'validated',
            2 => 'in_transit',
            3 => 'delivered',
            -1 => 'cancelled',
            default => 'pending',
        };
    }

    /**
     * Map application shipment status back to Dolibarr code
     */
    private function mapShipmentStatusToCode(string $status): ?int
    {
        return match ($status) {
            'draft' => 0,
            'validated' => 1,
            'in_transit' => 2,
            'delivered' => 3,
            'cancelled' => -1,
            'pending' => 1,
            default => null,
        };
    }

    /**
     * Map Dolibarr order status codes to application statuses
     */
    private function mapOrderStatus(int $statusCode): string
    {
        return match ($statusCode) {
            0 => 'draft',
            1 => 'pending',
            2 => 'processing',
            3 => 'shipped',
            4 => 'delivered',
            -1 => 'cancelled',
            default => 'pending',
        };
    }

    /**
     * Map application order status back to Dolibarr code
     */
    private function mapOrderStatusToCode(string $status): ?int
    {
        return match ($status) {
            'draft' => 0,
            'pending' => 1,
            'processing' => 2,
            'shipped' => 3,
            'delivered' => 4,
            'cancelled' => -1,
            default => null,
        };
    }

    /**
     * Format address from address components
     */
    private function formatAddress(object $data): string
    {
        $addressParts = [];
        
        if (isset($data->address) && $data->address) {
            $addressParts[] = $data->address;
        }
        
        if (isset($data->zip) && $data->zip) {
            $addressParts[] = $data->zip;
        }
        
        if (isset($data->town) && $data->town) {
            $addressParts[] = $data->town;
        }
        
        if (isset($data->country) && $data->country) {
            $addressParts[] = $data->country;
        }

        return implode(' ', array_filter($addressParts));
    }

    /**
     * Format driver name from name components
     */
    private function formatDriverName(object $shipment): ?string
    {
        $firstname = $shipment->driver_firstname ?? '';
        $lastname = $shipment->driver_lastname ?? '';
        
        if (!$firstname && !$lastname) {
            return null;
        }
        
        return trim("{$firstname} {$lastname}");
    }

    /**
     * Normalize page size within allowed bounds
     */
    private function normalizePageSize(int $perPage): int
    {
        return max(1, min($perPage, self::MAX_PAGE_SIZE));
    }

    /**
     * Generate cache key based on type and parameters
     */
    private function generateCacheKey(string $type, array $filters, int $page, int $perPage): string
    {
        $filterString = http_build_query($filters);
        return "dolibarr_{$type}_page_{$page}_perpage_{$perPage}_filters_{$filterString}";
    }
}