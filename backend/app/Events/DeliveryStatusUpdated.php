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

class DeliveryStatusUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public DeliveryConfirmation $delivery;
    public string $eventType;
    public array $updateData;
    public string $timestamp;

    /**
     * Create a new event instance.
     */
    public function __construct(DeliveryConfirmation $delivery, string $eventType = 'status_update', array $updateData = [])
    {
        $this->delivery = $delivery;
        $this->eventType = $eventType;
        $this->updateData = $updateData;
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
            new PrivateChannel('delivery.' . $this->delivery->id),
            new PrivateChannel('user.' . $this->delivery->user_id . '.deliveries'),
            new Channel('delivery-updates'),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'delivery.status.updated';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'delivery_id' => $this->delivery->id,
            'shipment_id' => $this->delivery->shipment_id,
            'status' => $this->delivery->status,
            'user_id' => $this->delivery->user_id,
            'event_type' => $this->eventType,
            'update_data' => $this->updateData,
            'has_signature' => !is_null($this->delivery->signature),
            'signature_quality' => $this->delivery->signature->signature_quality ?? null,
            'photo_count' => $this->delivery->photos()->count(),
            'gps_coordinates' => [
                'latitude' => $this->delivery->gps_latitude,
                'longitude' => $this->delivery->gps_longitude,
                'accuracy' => $this->delivery->gps_accuracy
            ],
            'synced_to_erp' => $this->delivery->synced_to_erp,
            'erpsync_at' => $this->delivery->erp_sync_timestamp?->toISOString(),
            'delivered_at' => $this->delivery->delivered_at?->toISOString(),
            'recipient_name' => $this->delivery->recipient_name,
            'timestamp' => $this->timestamp,
            'verification_hash' => $this->delivery->verification_hash,
        ];
    }
}