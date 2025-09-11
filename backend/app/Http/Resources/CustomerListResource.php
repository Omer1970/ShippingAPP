<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerListResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Get the search score if available from customer search service
        $searchScore = $this->search_score ?? null;
        
        return [
            'id' => $this->id,
            'dolibarr_customer_id' => $this->dolibarr_customer_id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'address_preview' => $this->getAddressPreview(),
            'customer_type' => $this->customer_type,
            'credit_status' => $this->credit_status,
            'statistics' => [
                'total_orders' => $this->orders()->count(),
                'total_shipments' => $this->shipments()->count(),
                'total_order_value' => round($this->getTotalOrderValue(), 2),
                'last_order_date' => $this->getLastOrderDate(),
            ],
            'search_score' => $searchScore,
            'last_synced' => $this->last_synced ? $this->last_synced->toIso8601String() : null,
        ];
    }

    private function getAddressPreview(): string
    {
        if (!$this->address) {
            return '';
        }

        $parts = explode(',', $this->address);
        $city = trim($parts[1] ?? '');
        $country = trim($parts[2] ?? '');
        
        return trim($city . ', ' . $country);
    }
}