<?php

namespace App\Events;

use App\Models\DeliveryConfirmation;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DeliveryLocationUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithQueue, SerializesModels;

    public DeliveryConfirmation $delivery;
    public float $latitude;
    public float $longitude;
    public ?float $accuracy;
    public string $updateType;
    public string $timestamp;

    /**
     * Create a new event instance.
     */
    public function __construct(
        DeliveryConfirmation $delivery, 
        float $latitude, 
        float $longitude, 
        ?float $accuracy = null,
        string $updateType = 'location_update'
    ) {
        $this->delivery = $delivery;
        $this->latitude = $latitude;
        $this->longitude = $longitude;
        $this->accuracy = $accuracy;
        $this->updateType = $updateType; // 'location_update', 'delivery_start', 'delivery_complete', 'gps_lost'
        $this->timestamp = now()->toISOString();
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('delivery.' . $this->delivery->id . '.tracking'),
            new PrivateChannel('user.' . $this->delivery->user_id . '.tracking'),
            new Channel('delivery-tracking.' . $this->delivery->shipment_id),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'delivery.location.updated';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'delivery_id' => $this->delivery->id,
            'shipment_id' => $this->delivery->shipment_id,
            'user_id' => $this->delivery->user_id,
            'coordinates' => [
                'latitude' => $this->latitude,
                'longitude' => $this->longitude,
                'accuracy' => $this->accuracy ?? 0
            ],
            'update_type' => $this->updateType,
            'timestamp' => $this->timestamp,
            'status' => $this->delivery->status,
            'current_address' => $this->getCurrentAddress(), // Would integrate with geocoding service
            'speed_kmh' => $this->calculateSpeed(), // If available from GPS data
            'battery_level' => $this->delivery->battery_level ?? null, // Mobile device battery
        ];
    }

    /**
     * Get current address from coordinates (placeholder for geocoding service)
     */
    private function getCurrentAddress(): ?string
    {
        // In production, this would integrate with Google Maps Geocoding API or similar service
        // For now, return coordinates as address placeholder
        $lat = round($this->latitude, 6);
        $lng = round($this->longitude, 6);
        return "GPS: {$lat}, {$lng}";
    }

    /**
     * Calculate speed between GPS points if available
     */
    private function calculateSpeed(): ?float
    {
        // This would calculate speed based on previous location and time difference
        // For now, return null as placeholder
        return null;
    }
}