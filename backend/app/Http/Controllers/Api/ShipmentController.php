<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DolibarrDataService;
use App\Http\Resources\ShipmentResource;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ShipmentController extends Controller
{
    private DolibarrDataService $dolibarrDataService;

    public function __construct(DolibarrDataService $dolibarrDataService)
    {
        $this->dolibarrDataService = $dolibarrDataService;
    }

    /**
     * Get paginated list of shipments
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

            // Get shipments from Dolibarr
            $filters = [];
            if ($status) {
                $filters['status'] = $status;
            }
            $shipments = $this->dolibarrDataService->getShipments($filters, $page, $perPage);

            return response()->json([
                'success' => true,
                'data' => [
                    'shipments' => ShipmentResource::collection(collect($shipments['data'])),
                    'pagination' => $shipments['pagination']
                ],
                'message' => 'Shipments retrieved successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching shipments: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to fetch shipments at this time',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get single shipment details
     */
    public function show(int $id): JsonResponse
    {
        try {
            $shipment = $this->dolibarrDataService->getShipmentById($id);

            if (!$shipment) {
                return response()->json([
                    'success' => false,
                    'message' => 'Shipment not found'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'shipment' => new ShipmentResource((object) $shipment)
                ],
                'message' => 'Shipment retrieved successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching shipment details: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to fetch shipment details',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get shipments assigned to current user (driver)
     */
    public function myShipments(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $page = $request->input('page', 1);
            $perPage = $request->input('per_page', 10);
            $status = $request->input('status');

            // Validate pagination parameters
            $perPage = in_array($perPage, [10, 25, 50, 100]) ? $perPage : 10;
            $page = max(1, $page);

            // Get shipments assigned to current user
            $filters = ['user_id' => $user->id];
            if ($status) {
                $filters['status'] = $status;
            }
            $shipments = $this->dolibarrDataService->getShipments($filters, $page, $perPage);

            return response()->json([
                'success' => true,
                'data' => [
                    'shipments' => ShipmentResource::collection(collect($shipments['data'])),
                    'pagination' => $shipments['pagination']
                ],
                'message' => 'My shipments retrieved successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching user shipments: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to fetch your shipments',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get shipments by status
     */
    public function byStatus(Request $request, string $status): JsonResponse
    {
        try {
            // Validate status parameter
            $validStatuses = ['draft', 'validated', 'in_transit', 'delivered', 'cancelled'];
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

            // Get shipments by status
            $shipments = $this->dolibarrDataService->getShipmentsByStatus($status, $page, $perPage);

            return response()->json([
                'success' => true,
                'data' => [
                    'shipments' => ShipmentResource::collection(collect($shipments['data'])),
                    'status' => $status,
                    'pagination' => $shipments['pagination']
                ],
                'message' => "Shipments with status '{$status}' retrieved successfully"
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching shipments by status: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to fetch shipments by status',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Refresh shipment data from Dolibarr
     */
    public function refresh(int $id): JsonResponse
    {
        try {
            // Clear cache for this shipment
            $this->dolibarrDataService->clearShipmentCache($id);
            
            // Fetch fresh data
            $shipment = $this->dolibarrDataService->getShipmentById($id);

            if (!$shipment) {
                return response()->json([
                    'success' => false,
                    'message' => 'Shipment not found'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'shipment' => new ShipmentResource((object) $shipment)
                ],
                'message' => 'Shipment data refreshed successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error refreshing shipment: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Unable to refresh shipment data',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }
}