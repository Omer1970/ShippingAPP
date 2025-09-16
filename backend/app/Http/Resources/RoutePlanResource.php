<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Resource for RoutePlan model
 */
class RoutePlanResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'driver_id' => $this->driver_id,
            'driver_name' => $this->driver->name ?? 'Unknown',
            'route_date' => $this->route_date->format('Y-m-d'),
            'optimized_route' => $this->optimized_route,
            'route_status' => $this->route_status,
            'total_distance' => $this->total_distance,
            'estimated_time' => $this->estimated_time,
            'efficiency_score' => $this->efficiency_score,
            'efficiency_percentage' => $this->getEfficiencyScorePercentage(),
            'waypoints' => $this->waypoints,
            'alternatives' => $this->alternatives,
            'optimization_algorithm' => $this->optimization_algorithm,
            'is_optimized' => $this->isOptimized(),
            'can_start' => $this->canStart(),
    'optimized_at' => $this->optimized_at?->toISOString(),
            'started_at' => $this->started_at?->toISOString(),
      'completed_at' => $this->completed_at?->toISOString(),
          'traffic_model' => $this->traffic_model,
 'route_progress' => $this->getRouteProgress(),
        'delivery_schedules' => $this->when($this->relationLoaded('deliverySchedules'), function () {
     return DeliveryScheduleResource::collection($this->deliverySchedules);
        }),
  'metadata' => $this->metadata,
            'created_at' => $this->created_at->toISOString(),
        'updated_at' => $this->updated_at->toISOString(),
        ];
    }
}