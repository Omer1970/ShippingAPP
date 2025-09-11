<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id ?? $this->dolibarr_order_id,
            'dolibarr_order_id' => $this->dolibarr_order_id,
            'reference' => $this->reference,
            'customer_reference' => $this->customer_reference ?? null,
            'customer' => [
                'id' => $this->customer_id,
                'name' => $this->customer_name,
                'address' => $this->customer_address ?? null,
                'zip' => $this->customer_zip ?? null,
                'city' => $this->customer_city ?? null,
                'phone' => $this->customer_phone ?? null,
                'email' => $this->customer_email ?? null,
            ],
            'status' => $this->mapStatus($this->status),
            'status_code' => $this->status,
            'order_date' => $this->order_date ?? null,
            'expected_delivery' => $this->expected_delivery ?? null,
            'created_at' => $this->created_at,
            'author' => [
                'id' => $this->author_id ?? null,
                'name' => $this->author_name ?? null,
            ],
            'total_amount' => [
                'excl_tax' => $this->total_excl_tax ?? 0,
                'incl_tax' => $this->total_incl_tax ?? 0,
                'currency' => 'EUR', // Default currency, can be made dynamic
            ],
            'shipping_address' => $this->shipping_address ?? null,
            'billing_address' => $this->billing_address ?? null,
            'private_note' => $this->private_note ?? null,
            'public_note' => $this->public_note ?? null,
            'last_synced' => now()->toIso8601String(),
        ];
    }

    /**
     * Map Dolibarr status codes to application status
     */
    private function mapStatus($status): string
    {
        $statusMap = [
            0 => 'draft',
            1 => 'pending',
            2 => 'processing',
            3 => 'shipped',
            4 => 'delivered',
            9 => 'cancelled',
        ];

        return $statusMap[$status] ?? 'unknown';
    }
}