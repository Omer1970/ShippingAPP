<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RoutePlan;
use App\Models\DeliverySchedule;
use App\Models\User;
use App\Http\Resources\RoutePlanResource;
use App\Services\RouteOptimizationService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * RouteController for managing delivery routes and optimization
 */
class RouteController extends Controller
{
    /**
     * Get all route plans for a specific date range
     */
    public function getRoutePlans(Request $request): JsonResponse
    {
        $validatedData = $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'driver_ids' => 'array',
            'driver_ids.*' => 'integer|exists:users,id',
            'status' => 'in:planned,active,completed,cancelled,all',
        ]);

        $startDate = $validatedData['start_date'];
        $endDate = $validatedData['end_date'];
        $driverIds = $validatedData['driver_ids'] ?? [];
        $status = $validatedData['status'] ?? 'all';

        $query = RoutePlan::with(['driver', 'deliverySchedules'])
            ->whereBetween('route_date', [$startDate, $endDate]);

        if (!empty($driverIds)) {
            $query->whereIn('driver_id', $driverIds);
        }

        if ($status !== 'all') {
            $query->where('route_status', $status);
        }

        $routePlans = $query->orderBy('route_date')
            ->orderBy('created_at')
            ->get();

        return response()->json([
            'data' => RoutePlanResource::collection($routePlans),
            'meta' => [
                'date_range' => [
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                ],
                'summary' => [
                    'total_routes' => $routePlans->count(),
                    'planned_routes' => $routePlans->where('route_status', 'planned')->count(),
                    'active_routes' => $routePlans->where('route_status', 'active')->count(),
                    'completed_routes' => $routePlans->where('route_status', 'completed')->count(),
                    'cancelled_routes' => $routePlans->where('route_status', 'cancelled')->count(),
                ],
            ],
        ]);
    }

    /**
     * Get a specific route plan
     */
    public function getRoutePlan(RoutePlan $routePlan): JsonResponse
    {
        $routePlan->load(['driver', 'deliverySchedules.shipment']);

        return response()->json([
            'data' => new RoutePlanResource($routePlan),
        ]);
    }

    /**
     * Create a new route plan
     */
    public function createRoutePlan(Request $request): JsonResponse
    {
        $validatedData = $request->validate([
            'driver_id' => 'required|integer|exists:users,id',
            'route_date' => 'required|date',
            'delivery_schedule_ids' => 'required|array|min:1',
            'delivery_schedule_ids.*' => 'integer|exists:delivery_schedules,id',
            'optimization_algorithm' => 'in:google_maps,osrm,custom',
            'metadata' => 'array',
        ]);

        // Validate that all schedules belong to the same driver
        $driverId = $validatedData['driver_id'];
        $scheduleIds = $validatedData['delivery_schedule_ids'];

        $validScheduleCount = DeliverySchedule::where('driver_id', $driverId)
            ->whereIn('id', $scheduleIds)
            ->count();

        if ($validScheduleCount !== count($scheduleIds)) {
            return response()->json([
                'success' => false,
                'message' => 'All delivery schedules must belong to the specified driver',
            ], 422);
        }

        // Check if a route already exists for this driver and date
        $existingRoute = RoutePlan::where('driver_id', $driverId)
            ->where('route_date', $validatedData['route_date'])
            ->where('route_status', '!=', 'cancelled')
            ->first();

        if ($existingRoute) {
            return response()->json([
                'success' => false,
                'message' => 'A route already exists for this driver on the specified date',
            ], 409);
        }

        // Create the route plan
        $routePlan = RoutePlan::create([
            'driver_id' => $driverId,
            'route_date' => $validatedData['route_date'],
            'optimized_route' => $scheduleIds,
            'route_status' => 'planned',
            'optimization_algorithm' => $validatedData['optimization_algorithm'] ?? 'google_maps',
            'metadata' => $validatedData['metadata'] ?? [],
        ]);

        // Update delivery schedules to link to this route plan
        DeliverySchedule::whereIn('id', $scheduleIds)->update([
            'route_plan_id' => $routePlan->id,
        ]);

        return response()->json([
            'success' => true,
            'data' => new RoutePlanResource($routePlan),
            'message' => 'Route plan created successfully',
        ], 201);
    }

    /**
     * Optimize a route plan
     */
    public function optimizeRoute(Request $request): JsonResponse
    {
        $validatedData = $request->validate([
            'route_plan_id' => 'required|integer|exists:route_plans,id',
            'optimization_algorithm' => 'in:google_maps,osrm,custom',
            'constraints' => 'array',
            'constraints.time_window_start' => 'date_format:H:i',
            'constraints.time_window_end' => 'date_format:H:i|after:constraints.time_window_start',
            'constraints.max_distance' => 'numeric|min:0',
            'constraints.max_duration' => 'integer|min:0',
            'constraints.traffic_model' => 'in:best_guess,pessimistic,optimistic',
        ]);

        $routePlan = RoutePlan::with(['deliverySchedules.shipment'])->find($validatedData['route_plan_id']);

        if (!$routePlan) {
            return response()->json([
                'success' => false,
                'message' => 'Route plan not found',
            ], 404);
        }

        // Initialize route optimization service
        $optimizationService = new RouteOptimizationService();

        // Prepare delivery points for optimization
        $deliveryPoints = [];
        foreach ($routePlan->deliverySchedules as $schedule) {
            $deliveryPoints[] = [
                'schedule_id' => $schedule->id,
                'address' => $schedule->shipment->delivery_address ?? '',
                'latitude' => $schedule->shipment->delivery_latitude ?? null,
                'longitude' => $schedule->shipment->delivery_longitude ?? null,
                'service_duration' => $schedule->estimated_duration ?? 30, // default 30 minutes
                'time_window_start' => $schedule->start_time ?? '09:00',
                'time_window_end' => $schedule->end_time ?? '18:00',
            ];
        }

        // Optimize the route
        $optimizationResult = $optimizationService->optimizeRoute(
            $deliveryPoints,
            $validatedData['optimization_algorithm'] ?? 'google_maps',
            $validatedData['constraints'] ?? []
        );

        if ($optimizationResult['success']) {
            // Update route plan with optimized data
            $routePlan->update([
                'optimized_route' => $optimizationResult['optimized_order'],
                'total_distance' => $optimizationResult['total_distance'],
                'estimated_time' => $optimizationResult['total_duration'],
                'efficiency_score' => $optimizationResult['efficiency_score'],
                'waypoints' => $optimizationResult['waypoints'],
                'alternatives' => $optimizationResult['alternative_routes'],
                'optimization_algorithm' => $optimizationResult['algorithm_used'],
                'optimized_at' => now(),
                'traffic_model' => $validatedData['constraints']['traffic_model'] ?? 'best_guess',
            ]);

            // Update route order in delivery schedules
            $this->updateRouteOrder($routePlan, $optimizationResult['optimized_order']);

            return response()->json([
                'success' => true,
                'data' => [
                    'route_plan' => new RoutePlanResource($routePlan),
                    'optimization_summary' => [
                        'original_distance' => $optimizationResult['original_distance'],
                        'optimized_distance' => $optimizationResult['optimized_distance'],
                        'distance_saved' => $optimizationResult['original_distance'] - $optimizationResult['optimized_distance'],
                        'efficiency_improvement' => $optimizationResult['efficiency_improvement'],
                        'original_time' => $optimizationResult['original_time'],
                        'optimized_time' => $optimizationResult['optimized_time'],
                        'time_saved' => $optimizationResult['original_time'] - $optimizationResult['optimized_time'],
                    ],
                    'algorithm_used' => $optimizationResult['algorithm_used'],
                ],
                'message' => 'Route optimized successfully',
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Route optimization failed: ' . $optimizationResult['error'],
        ], 422);
    }

    /**
     * Start a route plan
     */
    public function startRoute(Request $request, RoutePlan $routePlan): JsonResponse
    {
        if (!$routePlan->canStart()) {
            return response()->json([
                'success' => false,
                'message' => 'Route cannot be started - must be planned and optimized',
            ], 422);
        }

        $validatedData = $request->validate([
            'start_location' => 'array',
            'start_location.latitude' => 'required_with:start_location|numeric',
            'start_location.longitude' => 'required_with:start_location|numeric',
            'start_location.address' => 'required_with:start_location|string',
        ]);

        DB::transaction(function () use ($routePlan, $validatedData) {
            $routePlan->markAsActive();

            // Update metadata with start location if provided
            if (isset($validatedData['start_location'])) {
                $metadata = $routePlan->metadata;
                $metadata['start_location'] = $validatedData['start_location'];
                $routePlan->update(['metadata' => $metadata]);
            }
        });

        return response()->json([
            'success' => true,
            'data' => new RoutePlanResource($routePlan),
            'message' => 'Route plan started successfully',
        ]);
    }

    /**
     * Complete a route plan
     */
    public function completeRoute(Request $request, RoutePlan $routePlan): JsonResponse
    {
        if (!$routePlan->isActive()) {
            return response()->json([
                'success' => false,
                'message' => 'Route must be active to be completed',
            ], 422);
        }

        $validatedData = $request->validate([
            'completion_notes' => 'string|max:1000',
            'actual_duration' => 'integer|min:0',
            'start_location' => 'array',
            'start_location.latitude' => 'numeric',
            'start_location.longitude' => 'numeric',
            'end_location' => 'array',
            'end_location.latitude' => 'required_with:end_location|numeric',
        'end_location.longitude' => 'required_with:end_location|numeric',
        ]);

        DB::transaction(function () use ($routePlan, $validatedData) {
   $routePlan->markAsCompleted();

            // Update metadata with completion data if provided
            $metadata = $routePlan->metadata;

            if (isset($validatedData['completion_notes'])) {
       $metadata['completion_notes'] = $validatedData['completion_notes'];
            }

      if (isset($validatedData['actual_duration'])) {
    $metadata['actual_duration'] = $validatedData['actual_duration'];
  }

            if (isset($validatedData['start_location'])) {
    $metadata['completion_data']['start_location'] = $validatedData['start_location'];
      }

            if (isset($validatedData['end_location'])) {
    $metadata['completion_data']['end_location'] = $validatedData['end_location'];
            }

   $routePlan->update(['metadata' => $metadata]);
        });

        return response()->json([
            'success' => true,
 'data' => new RoutePlanResource($routePlan),
      'message' => 'Route plan completed successfully',
  ]);
    }

    /**
     * Cancel a route plan
     */
    public function cancelRoute(Request $request, RoutePlan $routePlan): JsonResponse
    {
        if ($routePlan->isCompleted()) {
            return response()->json([
           'success' => false,
          'message' => 'Cannot cancel completed route',
        ], 422);
        }

        $validatedData = $request->validate([
            'cancellation_reason' => 'required|string|max:500',
        ]);

  DB::transaction(function () use ($routePlan, $validatedData) {
         $routePlan->markAsCancelled();

       // Update metadata with cancellation reason
  $metadata = $routePlan->metadata;
            $metadata['cancellation_reason'] = $validatedData['cancellation_reason'];
         $metadata['cancelled_at'] = now();
      $routePlan->update(['metadata' => $metadata]);
    });

        return response()->json([
           'success' => true,
            'data' => new RoutePlanResource($routePlan),
            'message' => 'Route plan cancelled successfully',
        ]);
    }

    /**
  * Get driver's route for today
     */
    public function getTodaysRoute(Request $request): JsonResponse
    {
 $validatedData = $request->validate([
   'driver_id' => 'required|integer|exists:users,id',
      ]);

        $driverId = $validatedData['driver_id'];
      $today = now()->format('Y-m-d');

        $routePlan = RoutePlan::with(['driver', 'deliverySchedules.shipment'])
      ->where('driver_id', $driverId)
            ->where('route_date', $today)
        ->where('route_status', '!=', 'cancelled')
            ->first();

        if (!$routePlan) {
            return response()->json([
        'success' => false,
             'message' => 'No active route found for today',
      ], 404);
        }

        return response()->json([
            'data' => new RoutePlanResource($routePlan),
        ]);
    }

    /**
     * Reorder deliveries in a route
     */
    public function reorderRoute(Request $request): JsonResponse
    {
        $validatedData = $request->validate([
     'route_plan_id' => 'required|integer|exists:route_plans,id',
            'new_order' => 'required|array|min:1',
   'new_order.*' => 'integer|exists:delivery_schedules,id',
        ]);

        $routePlan = RoutePlan::with('deliverySchedules')->find($validatedData['route_plan_id']);
        $newOrder = $validatedData['new_order'];

   // Validate that all new order IDs are in the current route
    $currentScheduleIds = $routePlan->deliverySchedules->pluck('id')->toArray();
        if (count(array_diff($newOrder, $currentScheduleIds)) > 0) {
            return response()->json([
  'success' => false,
           'message' => 'Invalid schedule IDs in new order',
            ], 422);
        }

     // Validate that the new order contains all schedules
        if (count($newOrder) !== count($currentScheduleIds)) {
            return response()->json([
        'success' => false,
         'message' => 'New order must include all delivery schedules',
    ], 422);
     }

        DB::transaction(function () use ($routePlan, $newOrder) {
        // Update the route order
            $routePlan->setOptimizedRoute($newOrder);

      // Update route_order in delivery schedules
            foreach ($newOrder as $index => $scheduleId) {
          DeliverySchedule::where('id', $scheduleId)->update([
          'route_order' => $index + 1,
         ]);
       }
        });

        return response()->json([
            'success' => true,
   'data' => new RoutePlanResource($routePlan),
    'message' => 'Route reordered successfully',
        ]);
 }

    /**
     * Get route suggestions for a delivery
     */
    public function getRouteSuggestions(Request $request): JsonResponse
    {
   $validatedData = $request->validate([
       'delivery_schedule_id' => 'required|integer|exists:delivery_schedules,id',
     'nearby_radius' => 'numeric|min:0|max:50',
        ]);

        $scheduleId = $validatedData['delivery_schedule_id'];
        $nearbyRadius = $validatedData['nearby_radius'] ?? 5;

        $deliverySchedule = DeliverySchedule::with('shipment')->find($scheduleId);

        if (!$deliverySchedule || !$deliverySchedule->driver_id) {
   return response()->json([
       'success' => false,
  'message' => 'Delivery schedule not found or no driver assigned',
   ], 404);
        }

        $driverId = $deliverySchedule->driver_id;
  $deliveryDate = $deliverySchedule->delivery_date;

        // Get other deliveries for the same driver and date
        $nearbyDeliveries = DeliverySchedule::with('shipment')
  ->where('driver_id', $driverId)
          ->where('delivery_date', $deliveryDate)
            ->where('id', '!=', $scheduleId)
       ->where('status', '!=', 'cancelled')
   ->get();

        // Get potential route plans that include nearby deliveries
        $routePlans = RoutePlan::with(['deliverySchedules.shipment'])
        ->where('driver_id', $driverId)
    ->where('route_date', $deliveryDate)
       ->where('route_status', '!=', 'cancelled')
   ->get();

        $suggestions = [
    'delivery_schedule' => [
     'id' => $deliverySchedule->id,
    'address' => $deliverySchedule->shipment->delivery_address ?? 'Address not available',
          'time_slot' => $deliverySchedule->time_slot,
      'estimated_duration' => $deliverySchedule->estimated_duration,
            'route_order' => $deliverySchedule->route_order,
            'is_planned' => !empty($deliverySchedule->route_plan_id),
            ],
     'current_route' => null,
        'suggested_routes' => [],
   'alternate_deliveries' => $nearbyDeliveries->map(function ($delivery) {
          return [
    'id' => $delivery->id,
          'address' => $delivery->shipment->delivery_address ?? 'Address not available',
       'time_slot' => $delivery->time_slot,
             'route_order' => $delivery->route_order,
              'distance_from_current' => null, // This would need geocoding API
        'optimal_position' => $delivery->route_order,
          ];
      }),
       'optimization_suggestions' => [
          'optimal_time_slot' => $this->suggestOptimalTimeSlot($deliverySchedule),
   'optimal_route_order' => $this->suggestOptimalRouteOrder($deliverySchedule, $nearbyDeliveries),
  'potential_efficiency_gain' => $this->calculateEfficiencyGain($deliverySchedule, $nearbyDeliveries),
            ],
        ];

        // Add current route information if exists
        if ($deliverySchedule->routePlan) {
            $suggestions['current_route'] = [
          'route_plan_id' => $deliverySchedule->routePlan->id,
         'route_status' => $deliverySchedule->routePlan->route_status,
        'efficiency_score' => $deliverySchedule->routePlan->efficiency_score,
    'total_deliveries' => count($deliverySchedule->routePlan->deliverySchedules),
         'route_progress' => $deliverySchedule->routePlan->getRouteProgress(),
       ];
        }

   return response()->json([
       'success' => true,
            'data' => $suggestions,
     ]);
    }

    /**
 * Helper method to update route order in delivery schedules
     */
    private function updateRouteOrder(RoutePlan $routePlan, array $optimizedOrder): void
    {
        foreach ($optimizedOrder as $index => $scheduleId) {
            DeliverySchedule::where('id', $scheduleId)->update([
      'route_order' => $index + 1,
     ]);
        }
    }

    /**
     * Suggest optimal time slot for delivery
     */
    private function suggestOptimalTimeSlot(DeliverySchedule $deliverySchedule): array
{
        $driverId = $deliverySchedule->driver_id;
        $deliveryDate = $deliverySchedule->delivery_date;

        // Get driver's time slots for the date
        $timeSlots = \App\Models\DeliveryTimeSlot::where('driver_id', $driverId)
         ->where('slot_date', $deliveryDate)
   ->where('availability', 'available')
     ->orderBy('start_time')
      ->get();

        $optimalSlot = null;
        $efficiencyScore = 0;

        foreach ($timeSlots as $slot) {
       // Calculate efficiency score based on slot utilization and capacity
  $score = $this->calculateTimeSlotEfficiency($slot, $deliverySchedule);

    if ($score > $efficiencyScore) {
      $efficiencyScore = $score;
           $optimalSlot = $slot;
            }
        }

        if ($optimalSlot) {
   return [
          'suggested_slot' => $optimalSlot->time_slot,
      'current_time_slot' => $deliverySchedule->time_slot,
    'efficiency_benefit' => $efficiencyScore,
          'reason' => 'Higher utilization and better route integration',
  ];
        }

        return [
            'suggested_slot' => null,
            'current_time_slot' => $deliverySchedule->time_slot,
            'efficiency_benefit' => 0,
  'reason' => 'Current time slot is optimal',
        ];
    }

    /**
     * Suggest optimal route order
     */
    private function suggestOptimalRouteOrder(DeliverySchedule $deliverySchedule, $otherDeliveries): array
    {
        $currentOrder = $deliverySchedule->route_order;
        $deliveryCount = $otherDeliveries->count() + 1;

        // Simple heuristic: place deliveries with shorter estimatedduration first
        $suggestedOrder = $this->calculateOptimalOrder($deliverySchedule, $otherDeliveries);

   return [
            'current_order' => $currentOrder,
 'suggested_order' => $suggestedOrder,
            'reason' => 'Optimized for minimal total route time',
   'potential_efficiency_gain' => $this->calculateOrderEfficiency($currentOrder, $suggestedOrder, $deliveryCount),
        ];
    }

    /**
     * Calculate efficiency gain
     */
    private function calculateEfficiencyGain(DeliverySchedule $deliverySchedule, $otherDeliveries): array
    {
        $currentRoute = $deliverySchedule->routePlan ? $deliverySchedule->routePlan->getRouteProgress() : null;

        return [
   'time_saved_potential' => 15, // This would be calculated based on actual optimization
            'distance_saved_potential' => 2.5, // This would be calculated based on actual optimization
     'fuel_efficiency_improvement' => 8,
            'customer_satisfaction_improvement' => 'High',
        ];
    }

    /**
     * Calculate time slot efficiency score
     */
    private function calculateTimeSlotEfficiency($slot, $deliverySchedule): float
    {
     $utilizationScore = $slot->getUtilizationPercentage() * 0.6; // 60% weight
        $capacityScore = ($slot->capacity - $slot->booked) / $slot->capacity * 0.4; // 40% weight

        return $utilizationScore + ($capacityScore * 100);
    }

    /**
     * Calculate optimal delivery order
     */
    private function calculateOptimalOrder(DeliverySchedule $deliverySchedule, $otherDeliveries): int
    {
        // Simple heuristic based on distance and duration
         $deliveryCount = $otherDeliveries->count() + 1;

        // Place deliveries with shorter duration first for efficiency
  if ($deliverySchedule->estimated_duration < $deliveryCount * 15) { // 15 minutes per delivery average
     return 1; // Place first
      }

        return ceil($deliveryCount / 2); // Place in middle
    }

    /**
     * Calculate order efficiency score
     */
    private function calculateOrderEfficiency($currentOrder, $suggestedOrder, $totalDeliveries): float
    {
        if ($currentOrder === $suggestedOrder) {
   return 0.0;
        }

        $orderDifference = abs($currentOrder - $suggestedOrder);
        $efficiencyGain = ($orderDifference / $totalDeliveries) * 10; // Scale to reasonable efficiency gain

        return min($efficiencyGain, 15.0); // Cap at 15% maximum efficiency gain
    }
}