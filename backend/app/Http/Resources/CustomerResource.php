<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'dolibarr_customer_id' => $this->dolibarr_customer_id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'address' => $this->address,
            'customer_type' => $this->customer_type,
            'credit_status' => $this->credit_status,
            'payment_terms' => $this->payment_terms,
            'tax_number' => $this->tax_number,
            'preferred_delivery_time' => $this->preferred_delivery_time,
            'special_instructions' => $this->special_instructions,
            'coordinates' => [
                'latitude' => $this->latitude,
                'longitude' => $this->longitude,
            ],
            'statistics' => [
                'total_orders' => $this->orders()->count(),
                'total_shipments' => $this->shipments()->count(),
                'total_order_value' => round($this->getTotalOrderValue(), 2),
                'last_order_date' => $this->getLastOrderDate(),
            ],
            'sync_info' => [
                'last_synced' => $this->last_synced?->toIso8601String(),
                'last_search_at' => $this->last_search_at?->toIso8601String(),
            ],
            'timestamps' => [
                'created_at' => $this->created_at->toIso8601String(),
                'updated_at' => $this->updated_at->toIso8601String(),
            ],
        ];
    }
}