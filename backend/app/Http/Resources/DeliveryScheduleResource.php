<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Resource for DeliverySchedule model
 */
class DeliveryScheduleResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
  'shipment_id' => $this->shipment_id,
    'driver_id' => $this->driver_id,
            'driver_name' => $this->driver->name ?? 'Unknown',
       'delivery_date' => $this->delivery_date->format('Y-m-d'),
    'start_time' => $this->start_time,
            'end_time' => $this->end_time,
  'time_slot' => $this->time_slot,
            'estimated_duration' => $this->estimated_duration,
            'estimated_distance' => $this->estimated_distance,
            'route_order' => $this->route_order,
   'sequence_current_step' => $this->sequence_current_step,
            'sequence_total_steps' => $this->sequence_total_steps,
         'status' => $this->status,
    'progress_percentage' => $this->getSequenceProgressPercentage(),
        'can_be_modified' => $this->canBeModified(),
            'metadata' => $this->metadata,
    'notes' => $this->notes,
     'shipment' => $this->when($this->relationLoaded('shipment'), function () {
         return [
                'id' => $this->shipment->id,
      'tracking_number' => $this->shipment->tracking_number,
                'recipient' => $this->shipment->recipient_info ?? $this->shipment->recipient_name,
                'address' => $this->shipment->delivery_address,
            ];
            }),
            'created_at' => $this->created_at->toISOString(),
            'updated_at' => $this->updated_at->toISOString(),
        ];
    }
}