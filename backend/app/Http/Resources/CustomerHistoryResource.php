<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerHistoryResource extends JsonResource
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
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'created_from_dolibarr' => $this->created_from_dolibarr,
            'last_synced' => $this->last_synced?->toIso8601String(),
            'last_search_at' => $this->last_search_at?->toIso8601String(),
            'timestamps' => [
                'created_at' => $this->created_at->toIso8601String(),
                'updated_at' => $this->updated_at->toIso8601String(),
            ],
            // Include order history with pagination
            'orders' => [
                'data' => $this->when($this->relationLoaded('orders') && $this->orders->count() > 0, function () {
                    return $this->orders->take(10)->map(function ($order) {
                        return [
                            'id' => $order->id,
                            'ref' => $order->ref,
                            'date_commande' => $order->date_commande,
                            'total_ttc' => $order->total_ttc,
                            'status' => $order->status,
                            'description' => $order->description,
                            'link' => route('api.orders.show', ['order' => $order->id])
                        ];
                    })->toArray();
                }),
                'meta' => [
                    'total' => $this->when($this->relationLoaded('orders'), fn () => $this->orders->count()),
                    'last_order' => $this->getLastOrderDate(),
                    'api_endpoint' => route('api.customers.orders', ['customer' => $this->id])
                ]
            ],
            // Include shipment history
            'shipments' => [
                'data' => $this->when($this->relationLoaded('shipments') && $this->shipments->count() > 0, function () {
                    return $this->shipments->take(10)->map(function ($shipment) {
                        return [
                            'id' => $shipment->id,
                            'ref' => $shipment->ref,
                            'tracking_number' => $shipment->tracking_number,
                            'status' => $shipment->status,
                            'date_creation' => $shipment->date_creation,
                            'date_delivery_planned' => $shipment->date_delivery_planned,
                            'link' => route('api.shipments.show', ['shipment' => $shipment->id])
                        ];
                    })->toArray();
                }),
                'meta' => [
                    'total' => $this->when($this->relationLoaded('shipments'), fn () => $this->shipments->count()),
                    'last_shipment' => $this->when($this->relationLoaded('shipments'), fn () => $this->shipments->max('date_creation')),
                    'in_transit' => $this->when($this->relationLoaded('shipments'), fn () => $this->shipments->whereIn('status', ['in_process', 'shipped'])->count()),
                    'api_endpoint' => route('api.customers.shipments', ['customer' => $this->id])
                ]
            ],
            // Customer statistics
            'statistics' => $this->when($this->relationLoaded('orders') || $this->relationLoaded('shipments'), function () {
                $orders = $this->relationLoaded('orders') ? $this->orders : collect();
                $shipments = $this->relationLoaded('shipments') ? $this->shipments : collect();
                
                $completedOrders = $orders->where('status', 'completed');
                $totalOrderValue = $completedOrders->sum('total_ttc') ?? 0;
                $orderCount = $orders->count();
                
                return [
                    'orders' => [
                        'total' => $orderCount,
                        'active' => $orders->whereIn('status', ['pending', 'processing'])->count(),
                        'completed' => $completedOrders->count(),
                        'cancelled' => $orders->where('status', 'cancelled')->count(),
                        'total_value' => round($totalOrderValue, 2),
                        'average_value' => $orderCount > 0 ? round($totalOrderValue / $orderCount, 2) : 0,
                        'last_order_date' => $orders->max('date_commande')
                    ],
                    'shipments' => [
                        'total' => $shipments->count(),
                        'in_transit' => $shipments->whereIn('status', ['in_process', 'shipped'])->count(),
                        'delivered' => $shipments->where('status', 'delivered')->count(),
                        'cancelled' => $shipments->where('status', 'cancelled')->count(),
                        'last_shipment_date' => $shipments->max('date_creation')
                    ],
                    'performance' => [
                        'order_to_shipment_ratio' => $orderCount > 0 ? round($shipments->count() / $orderCount, 2) : 0,
                        'successful_shipment_rate' => $shipments->count() > 0 ? round($shipments->where('status', 'delivered')->count() / $shipments->count() * 100, 1) : 0,
                        'average_days_to_deliver' => $this->calculateAverageDeliveryTime($orders, $shipments)
                    ]
                ];
            }),
            // Customer search index data if available
            'search_metadata' => $this->when($this->relationLoaded('searchIndexes') && $this->searchIndexes->count() > 0, function () {
                return [
                    'search_count' => $this->searchIndexes->sum('search_count') ?? 0,
                    'popularity_weight' => $this->searchIndexes->avg('popularity_weight') ?? 0,
                    'categories' => $this->searchIndexes->pluck('search_metadata.categories')->flatten()->unique()->values(),
                    'address_count' => $this->searchIndexes->pluck('search_metadata.address_count')->first() ?? 0,
                    'primary_contact' => $this->searchIndexes->pluck('search_metadata.primary_contact')->first()
                ];
            }),
            // Customer level calculation
            'classification' => $this->determineCustomerClassification()
        ];
    }

    private function calculateAverageDeliveryTime($orders, $shipments): ?string
    {
        if ($orders->count() === 0 || $shipments->count() === 0) {
            return null;
        }

        $totalDays = 0;
        $matchingShipments = 0;

        foreach ($orders as $order) {
            if (!$order->date_commande) {
                continue;
            }

            $matchingShipment = $shipments->first(function ($shipment) use ($order) {
                // Simple matching logic - in a real application, you might have a specific relationship
                return $shipment->date_delivery_planned && 
                       $shipment->date_delivery_planned >= $order->date_commande;
            });

            if ($matchingShipment && $matchingShipment->date_delivery_planned) {
                $orderDate = new \Carbon\Carbon($order->date_commande);
                $deliveryDate = new \Carbon\Carbon($matchingShipment->date_delivery_planned);
                
                $totalDays += $orderDate->diffInDays($deliveryDate);
                $matchingShipments++;
            }
        }

        if ($matchingShipments > 0) {
            $averageDays = round($totalDays / $matchingShipments);
            
            if ($averageDays < 1) {
                return 'Less than 1 day';
            } elseif ($averageDays === 1) {
                return '1 day';
            } else {
                return "{$averageDays} days";
            }
        }

        return null;
    }

    private function determineCustomerClassification(): array
    {
        if (!$this->relationLoaded('orders') && !$this->relationLoaded('shipments')) {
            return ['level' => 'unknown', 'description' => 'Insufficient data'];
        }

        $orders = $this->relationLoaded('orders') ? $this->orders : collect();
        $orderCount = $orders->count();
        $totalValue = $orders->where('status', 'completed')->sum('total_ttc') ?? 0;

        if ($orderCount >= 50 && $totalValue >= 20000) {
            return [
                'level' => 'VIP',
                'description' => 'High-value frequent customer',
                'benefits' => ['Priority support', 'Dedicated account manager', 'Expedited shipping']
            ];
        } elseif ($orderCount >= 20 && $totalValue >= 10000) {
            return [
                'level' => 'Premium',
                'description' => 'Valued customer with good history',
                'benefits' => ['Express shipping', 'Discount offers', 'Early access']
            ];
        } elseif ($orderCount >= 5) {
            return [
                'level' => 'Regular',
                'description' => 'Established customer relationship',
                'benefits' => ['Standard service', 'Email notifications', 'Loyalty points']
            ];
        } elseif ($orderCount >= 1) {
            return [
                'level' => 'New',
                'description' => 'New customer - build relationship',
                'benefits' => ['Welcome package', 'Onboarding support', 'Follow-up calls']
            ];
        } else {
            return [
                'level' => 'Prospect',
                'description' => 'Customer record without order history',
                'benefits' => ['Activation offer', 'Marketing campaigns', 'Introduction package']
            ];
        }
    }
}