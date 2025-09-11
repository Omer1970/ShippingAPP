<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DolibarrDataService;
use App\Http\Resources\OrderResource;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class OrderController extends Controller
{
    private DolibarrDataService $dolibarrDataService;

    public function __construct(DolibarrDataService $dolibarrDataService)
    {
        $this->dolibarrDataService = $dolibarrDataService;
    }

    /**
     * Get paginated list of orders
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $page = $request->input('page', 1);
            $perPage = $request->input('per_page', 10);
            $status = $request->input('status');

            // Validate pagination parameters
            $perPage = in_array($perPage, [10, 25, 50, 100]) ? $perPage : 10;
            $page = max(1, $page);

            // Get orders from Dolibarr
            $filters = [];
            if ($status) {
                $filters['status'] = $status;
            }
            $orders = $this->dolibarrDataService->getOrders($filters, $page, $perPage);

            return response()->json([
                'success' => true,
                'data' => [
                    'orders' => OrderResource::collection(collect($orders['data'])),
                    'pagination' => $orders['pagination']
                ],
                'message' => 'Orders retrieved successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching orders: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to fetch orders at this time',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get single order details
     */
    public function show(int $id): JsonResponse
    {
        try {
            $order = $this->dolibarrDataService->getOrderById($id);

            if (!$order) {
                return response()->json([
                    'success' => false,
                    'message' => 'Order not found'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'order' => new OrderResource((object) $order)
                ],
                'message' => 'Order retrieved successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching order details: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to fetch order details',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get orders for specific customer
     */
    public function byCustomer(Request $request, int $customerId): JsonResponse
    {
        try {
            $page = $request->input('page', 1);
            $perPage = $request->input('per_page', 10);
            $status = $request->input('status');

            // Validate pagination parameters
            $perPage = in_array($perPage, [10, 25, 50, 100]) ? $perPage : 10;
            $page = max(1, $page);

            // Get orders for customer
            $filters = ['customer_id' => $customerId];
            if ($status) {
                $filters['status'] = $status;
            }
            $orders = $this->dolibarrDataService->getOrders($filters, $page, $perPage);

            return response()->json([
                'success' => true,
                'data' => [
                    'orders' => OrderResource::collection(collect($orders['data'])),
                    'customer_id' => $customerId,
                    'pagination' => $orders['pagination']
                ],
                'message' => 'Customer orders retrieved successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching customer orders: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to fetch customer orders',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get orders by status
     */
    public function byStatus(Request $request, string $status): JsonResponse
    {
        try {
            // Validate status parameter
            $validStatuses = ['draft', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'];
            if (!in_array($status, $validStatuses)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid status. Valid statuses: ' . implode(', ', $validStatuses)
                ], 400);
            }

            $page = $request->input('page', 1);
            $perPage = $request->input('per_page', 10);

            // Validate pagination parameters
            $perPage = in_array($perPage, [10, 25, 50, 100]) ? $perPage : 10;
            $page = max(1, $page);

            // Get orders by status
            $orders = $this->dolibarrDataService->getOrdersByStatus($status, $page, $perPage);

            return response()->json([
                'success' => true,
                'data' => [
                    'orders' => OrderResource::collection(collect($orders['data'])),
                    'status' => $status,
                    'pagination' => $orders['pagination']
                ],
                'message' => "Orders with status '{$status}' retrieved successfully"
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching orders by status: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to fetch orders by status',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Refresh order data from Dolibarr
     */
    public function refresh(int $id): JsonResponse
    {
        try {
            // Clear cache for this order
            $this->dolibarrDataService->clearOrderCache($id);
            
            // Fetch fresh data
            $order = $this->dolibarrDataService->getOrderById($id);

            if (!$order) {
                return response()->json([
                    'success' => false,
                    'message' => 'Order not found'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'order' => new OrderResource((object) $order)
                ],
                'message' => 'Order data refreshed successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error refreshing order: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to refresh order data',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }
}