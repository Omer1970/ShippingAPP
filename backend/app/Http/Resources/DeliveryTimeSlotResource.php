<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Resource for DeliveryTimeSlot model
 */
class DeliveryTimeSlotResource extends JsonResource
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
            'slot_date' => $this->slot_date->format('Y-m-d'),
   'start_time' => $this->start_time,
            'end_time' => $this->end_time,
       'slot_label' => $this->slot_label,
   'capacity' => $this->capacity,
         'booked' => $this->booked,
         'availability' => $this->availability,
 'is_available' => $this->isAvailable(),
          'is_limited' => $this->isLimited(),
            'is_full' => $this->isFull(),
      'is_blocked' => $this->isBlocked(),
         'available_capacity' => $this->getAvailableCapacity(),
            'utilization_percentage' => $this->getUtilizationPercentage(),
            'is_recurring' => $this->is_recurring,
            'recurrence_pattern' => $this->recurrence_pattern,
            'metadata' => $this->metadata,
  'display_label' => $this->getDisplayLabel(),
            'time_slot' => $this->time_slot,
            'created_at' => $this->created_at->toISOString(),
          'updated_at' => $this->updated_at->toISOString(),
        ];
  }
}