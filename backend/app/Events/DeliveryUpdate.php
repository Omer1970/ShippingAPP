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

class DeliveryUpdate implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $delivery;
    public $updateType;
    public $data;

    /**
     * Create a new event instance.
     */
    public function __construct(DeliveryConfirmation $delivery, string $updateType, array $data = [])
    {
        $this->delivery = $delivery;
        $this->updateType = $updateType;
        $this->data = $data;
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
            new PrivateChannel('driver.' . $this->delivery->user_id),
            new PrivateChannel('shipment.' . $this->delivery->shipment_id),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'delivery.update';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'type' => $this->updateType,
            'delivery_id' => $this->delivery->id,
            'shipment_id' => $this->delivery->shipment_id,
            'timestamp' => now()->toISOString(),
            'data' => array_merge(
                [
                    'id' => $this->delivery->id,
                    'shipment_id' => $this->delivery->shipment_id,
                    'status' => $this->delivery->status,
                    'recipient_name' => $this->delivery->recipient_name,
                    'delivered_at' => $this->delivery->delivered_at?->toISOString(),
                    'synced_to_erp' => $this->delivery->synced_to_erp,
                ],
                $this->data
            )
        ];
    }
}