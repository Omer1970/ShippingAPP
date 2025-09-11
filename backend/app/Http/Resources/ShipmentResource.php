<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Resource class for transforming Shipment data according to story specification
 */
class ShipmentResource extends JsonResource
{
    /**
     * Transform the resource into an array as specified in Story 002
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'dolibarr_shipment_id' => $this->dolibarr_shipment_id,
            'reference' => $this->reference,
            'customer_name' => $this->customer_name,
            'delivery_address' => $this->delivery_address,
            'status' => $this->status,
            'expected_delivery' => $this->expected_delivery,
            'assigned_driver' => $this->getAssignedDriverName(),
            'total_weight' => $this->total_weight,
            'total_value' => $this->total_value,
            'created_from_dolibarr' => $this->created_from_dolibarr,
            'last_synced' => $this->last_synced ? $this->last_synced->toISOString() : null,
            'created_at' => $this->created_at ? $this->created_at->toISOString() : null,
            'updated_at' => $this->updated_at ? $this->updated_at->toISOString() : null,
        ];
    }

    /**
     * Get assigned driver name if available
     */
    private function getAssignedDriverName(): ?string
    {
        if (!$this->assignedDriver) {
            return null;
        }
        
        return trim($this->assignedDriver->firstname . ' ' . $this->assignedDriver->lastname);
    }