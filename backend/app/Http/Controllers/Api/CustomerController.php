<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CustomerResource;
use App\Http\Resources\CustomerListResource;
use App\Http\Resources\CustomerHistoryResource;
use App\Models\Customer;
use App\Services\CustomerSearchService;
use App\Services\DolibarrCustomerService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Log;

class CustomerController extends Controller
{
    private CustomerSearchService $searchService;
    private DolibarrCustomerService $dolibarrService;

    public function __construct(
        CustomerSearchService $searchService,
        DolibarrCustomerService $dolibarrService
    ) {
        $this->searchService = $searchService;
        $this->dolibarrService = $dolibarrService;
    }

    /**
     * Search customers with autocomplete functionality
     */
    public function search(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'q' => 'required|string|min:2|max:100',
                'limit' => 'sometimes|integer|min:1|max:50',
                'include_synonyms' => 'sometimes|boolean'
            ]);

            $query = $request->input('q');
            $limit = $request->input('limit', 10);
            $includeSynonyms = $request->input('include_synonyms', false);
            
            $startTime = microtime(true);

            // Cache key for search results
            $cacheKey = "customer_search_{$query}_{$limit}_" . ($includeSynonyms ? 'with_synonyms' : 'no_synonyms');
            
            $results = Cache::remember($cacheKey, 300, function () use ($query, $limit, $includeSynonyms, $request) {
                return $this->searchService->searchCustomers($query, $limit);
            });

            // Increment search popularity for found customers
            $results->each(function ($customer) {
                $customer->incrementSearchPopularity();
            });

            $responseTime = (microtime(true) - $startTime) * 1000;

            return response()->json([
                'success' => true,
                'data' => [
                    'customers' => CustomerListResource::collection($results),
                    'metadata' => [
                        'total_results' => $results->count(),
                        'search_time_ms' => round($responseTime, 2),
                        'query' => $query,
                        'limit' => $limit,
                        'cache_hit' => Cache::has($cacheKey)
                    ]
                ]
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('Customer search failed', [
                'query' => $request->input('q'),
                'error' => $e->getMessage(),
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Search service temporarily unavailable',
                'error' => config('app.debug') ? $e->getMessage() : 'Service unavailable'
            ], 500);
        }
    }

    /**
     * Get autocomplete suggestions
     */
    public function autocomplete(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'q' => 'required|string|min:1|max:50'
            ]);

            $query = $request->input('q');
            $startTime = microtime(true);

            $suggestions = $this->searchService->autocompleteSearch($query);

            $responseTime = (microtime(true) - $startTime) * 1000;

            // Redis-based rate limiting
            $rateLimitKey = "customer_search_{$request->ip()}";
            $currentCount = Redis::incr($rateLimitKey);
            
            if ($currentCount === 1) {
                Redis::expire($rateLimitKey, 60); // 1 minute window
            }
            
            if ($currentCount > 120) { // 120 requests per minute
                return response()->json([
                    'success' => false,
                    'message' => 'Rate limit exceeded. Please try again later.',
                    'retry_after' => Redis::ttl($rateLimitKey)
                ], 429);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'suggestions' => $suggestions->map(function ($customer) {
                        return [
                            'id' => $customer->id,
                            'name' => $customer->name,
                            'email' => $customer->email,
                            'customer_type' => $customer->customer_type,
                            'highlight' => $this->highlightSearchTerm($customer->name, $query)
                        ];
                    }),
                    'metadata' => [
                        'total_suggestions' => $suggestions->count(),
                        'search_time_ms' => round($responseTime, 2),
                        'query' => $query
                    ]
                ]
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('Autocomplete failed', [
                'query' => $request->input('q'),
                'error' => $e->getMessage(),
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Autocomplete service unavailable',
                'error' => config('app.debug') ? $e->getMessage() : 'Service unavailable'
            ], 500);
        }
    }

    /**
     * Get detailed customer profile
     */
    public function profile(Request $request, $id): JsonResponse
    {
        try {
            $customer = Customer::findOrFail($id);
            
            // Record access for audit trail
            Log::info('Customer profile accessed', [
                'customer_id' => $id,
                'user_id' => auth()->id()
            ]);

            // Increment search popularity
            $customer->incrementSearchPopularity();

            // Include optional data
            $includeOrders = $request->boolean('include_orders', false);
            $includeShipments = $request->boolean('include_shipments', false);
            $includeStatistics = $request->boolean('include_stats', true);

            // Optimized loading based on request
            $withRelations = [];
            if ($includeOrders) {
                $withRelations[] = 'orders';
            }
            if ($includeShipments) {
                $withRelations[] = 'shipments';
            }
            if ($includeStatistics) {
                $withRelations[] = 'orders:customer_id,status,total_ttc,date_commande';
                $withRelations[] = 'shipments:customer_id,status,shipping_date';
            }

            if (!empty($withRelations)) {
                $customer->load($withRelations);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'customer' => new CustomerHistoryResource($customer),
                    'metadata' => [
                        'last_search_at' => $customer->last_search_at,
                        'search_count' => $customer->searchIndexes->sum('search_count') ?? 0
                    ]
                ]
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Customer not found'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Customer profile failed', [
                'customer_id' => $id,
                'error' => $e->getMessage(),
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to load customer profile',
                'error' => config('app.debug') ? $e->getMessage() : 'Service unavailable'
            ], 500);
        }
    }

    /**
     * Get customer order history
     */
    public function orders(Request $request, $customerId): JsonResponse
    {
        try {
            $request->validate([
                'page' => 'sometimes|integer|min:1',
                'per_page' => 'sometimes|integer|min:5|max:100',
                'status' => 'sometimes|string|in:pending,processing,completed,cancelled,all',
                'sort' => 'sometimes|string|in:date,total,status',
                'order' => 'sometimes|string|in:asc,desc'
            ]);

            $customer = Customer::findOrFail($customerId);
            
            $query = $customer->orders();

            // Apply status filter
            if ($request->input('status') && $request->input('status') !== 'all') {
                $query->where('status', $request->input('status'));
            }

            // Apply sorting
            $sortBy = $request->input('sort', 'date');
            $sortOrder = $request->input('order', 'desc');

            switch ($sortBy) {
                case 'date':
                    $query->orderBy('date_commande', $sortOrder);
                    break;
                case 'total':
                    $query->orderBy('total_ttc', $sortOrder);
                    break;
                case 'status':
                    $query->orderBy('status', $sortOrder);
                    break;
            }

            $orders = $query->paginate(
                $request->input('per_page', 20),
                ['id', 'ref', 'date_commande', 'total_ttc', 'status', 'fk_statut', 'description'],
                'page',
                $request->input('page', 1)
            );

            return response()->json([
                'success' => true,
                'data' => [
                    'orders' => $orders->items(),
                    'pagination' => [
                        'total' => $orders->total(),
                        'per_page' => $orders->perPage(),
                        'current_page' => $orders->currentPage(),
                        'last_page' => $orders->lastPage(),
                        'from' => $orders->firstItem(),
                        'to' => $orders->lastItem()
                    ],
                    'summary' => [
                        'total_orders' => $orders->total(),
                        'active_orders' => $customer->orders()->whereIn('status', ['pending', 'processing'])->count(),
                        'completed_orders' => $customer->orders()->where('status', 'completed')->count()
                    ]
                ]
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $e->errors()
            ], 422);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Customer not found'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Customer orders failed', [
                'customer_id' => $customerId,
                'error' => $e->getMessage(),
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to load customer orders',
                'error' => config('app.debug') ? $e->getMessage() : 'Service unavailable'
            ], 500);
        }
    }

    /**
     * Get customer shipment history
     */
    public function shipments(Request $request, $customerId): JsonResponse
    {
        try {
            $request->validate([
                'page' => 'sometimes|integer|min:1',
                'per_page' => 'sometimes|integer|min:5|max:100',
                'status' => 'sometimes|string|in:draft,validated,in_process,shipped,delivered,cancelled,all',
                'sort' => 'sometimes|string|in:date,tracking_number',
                'order' => 'sometimes|string|in:asc,desc'
            ]);

            $customer = Customer::findOrFail($customerId);
            
            $query = $customer->shipments();

            // Apply status filter
            if ($request->input('status') && $request->input('status') !== 'all') {
                $query->where('status', $request->input('status'));
            }

            // Apply sorting
            $sortBy = $request->input('sort', 'date');
            $sortOrder = $request->input('order', 'desc');

            switch ($sortBy) {
                case 'date':
                    $query->orderBy('date_creation', $sortOrder);
                    break;
                case 'tracking_number':
                    $query->orderBy('tracking_number', $sortOrder);
                    break;
            }

            $shipments = $query->paginate(
                $request->input('per_page', 20),
                ['id', 'ref', 'tracking_number', 'status', 'date_creation', 'date_delivery_planned', 'shipping_directory'],
                'page',
                $request->input('page', 1)
            );

            return response()->json([
                'success' => true,
                'data' => [
                    'shipments' => $shipments->items(),
                    'pagination' => [
                        'total' => $shipments->total(),
                        'per_page' => $shipments->perPage(),
                        'current_page' => $shipments->currentPage(),
                        'last_page' => $shipments->lastPage(),
                        'from' => $shipments->firstItem(),
                        'to' => $shipments->lastItem()
                    ],
                    'summary' => [
                        'total_shipments' => $shipments->total(),
                        'delivered' => $customer->shipments()->where('status', 'delivered')->count(),
                        'in_transit' => $customer->shipments()->whereIn('status', ['in_process', 'shipped'])->count()
                    ]
                ]
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $e->errors()
            ], 422);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Customer not found'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Customer shipments failed', [
                'customer_id' => $customerId,
                'error' => $e->getMessage(),
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to load customer shipments',
                'error' => config('app.debug') ? $e->getMessage() : 'Service unavailable'
            ], 500);
        }
    }

    /**
     * Get customer statistics
     */
    public function stats(Request $request, $customerId): JsonResponse
    {
        try {
            $customer = Customer::withCount(['orders', 'shipments'])
                ->withSum('orders', 'total_ttc')
                ->findOrFail($customerId);

            $stats = [
                'total_orders' => $customer->orders_count,
                'total_shipments' => $customer->shipments_count,
                'total_value' => $customer->orders_sum_total_ttc ?? 0,
                'average_order_value' => $customer->orders_count > 0 ? ($customer->orders_sum_total_ttc / $customer->orders_count) : 0,
                'active_orders' => $customer->orders()->whereIn('status', ['pending', 'processing'])->count(),
                'completed_orders' => $customer->orders()->where('status', 'completed')->count(),
                'delivered_shipments' => $customer->shipments()->where('status', 'delivered')->count(),
                'last_order_date' => $customer->orders()->max('date_commande'),
                'last_shipment_date' => $customer->shipments()->max('date_creation')
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'stats' => $stats,
                    'customer_level' => $this->calculateCustomerLevel($stats),
                    'recommendations' => $this->generateCustomerRecommendations($stats, $customer)
                ]
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Customer not found'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Customer stats failed', [
                'customer_id' => $customerId,
                'error' => $e->getMessage(),
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to load customer statistics',
                'error' => config('app.debug') ? $e->getMessage() : 'Service unavailable'
            ], 500);
        }
    }

    /**
     * Private helper methods
     */
    private function highlightSearchTerm(string $text, string $term): array
    {
        $position = stripos($text, $term);
        
        if ($position === false) {
            return ['text' => $text, 'highlight_start' => null, 'highlight_end' => null];
        }
        
        return [
            'text' => $text,
            'highlight_start' => $position,
            'highlight_end' => $position + strlen($term)
        ];
    }

    private function calculateCustomerLevel(array $stats): string
    {
        $orderCount = $stats['total_orders'] ?? 0;
        $totalValue = $stats['total_value'] ?? 0;
        
        if ($orderCount >= 50 && $totalValue >= 10000) {
            return 'VIP';
        } elseif ($orderCount >= 20 && $totalValue >= 5000) {
            return 'Premium';
        } elseif ($orderCount >= 5) {
            return 'Regular';
        } elseif ($orderCount >= 1) {
            return 'New';
        } else {
            return 'Potential';
        }
    }

    private function generateCustomerRecommendations(array $stats, $customer): array
    {
        $recommendations = [];
        
        $daysSinceLastOrder = null;
        if ($stats['last_order_date']) {
            $lastOrderDate = \Carbon\Carbon::parse($stats['last_order_date']);
            $daysSinceLastOrder = now()->diffInDays($lastOrderDate);
        }
        
        if ($daysSinceLastOrder && $daysSinceLastOrder > 90) {
            $recommendations[] = [
                'type' => 'retention',
                'title' => 'Customer Retention',
                'description' => 'Customer has not placed an order in over 90 days. Consider reaching out.',
                'priority' => 'high'
            ];
        }
        
        if ($stats['total_orders'] < 5 && $stats['total_orders'] > 0) {
            $recommendations[] = [
                'type' => 'loyalty',
                'title' => 'Customer Development',
                'description' => 'This customer has potential for growth. Consider offering loyalty program.',
                'priority' => 'medium'
            ];
        }
        
        if ($stats['average_order_value'] >= 100 && $stats['total_orders'] >= 10) {
            $recommendations[] = [
                'type' => 'vip',
                'title' => 'VIP Candidate',
                'description' => 'High-value customer with frequent orders. Consider VIP program.',
                'priority' => 'high'
            ];
        }
        
        return $recommendations;
    }
}