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

class SignatureProgress implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public DeliveryConfirmation $delivery;
    public string $progressType;
    public array $signatureData;
    public string $timestamp;

    /**
     * Create a new event instance.
     */
    public function __construct(DeliveryConfirmation $delivery, string $progressType, array $signatureData = [])
    {
        $this->delivery = $delivery;
        $this->progressType = $progressType; // 'started', 'drawing', 'completed', 'cleared'
        $this->signatureData = $signatureData;
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
            new PrivateChannel('delivery.' . $this->delivery->id . '.signature'),
            new PrivateChannel('user.' . $this->delivery->user_id . '.signature'),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'signature.progress';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        $data = [
            'delivery_id' => $this->delivery->id,
            'shipment_id' => $this->delivery->shipment_id,
            'progress_type' => $this->progressType,
            'timestamp' => $this->timestamp,
        ];

        // Include signature-specific data based on progress type
        switch ($this->progressType) {
            case 'started':
                $data['canvas_size'] = [
                    'width' => $this->signatureData['canvas_width'] ?? 400,
                    'height' => $this->signatureData['canvas_height'] ?? 200
                ];
                break;
                
            case 'drawing':
                $data['stroke_count'] = $this->signatureData['stroke_count'] ?? 0;
                $data['current_quality'] = $this->signatureData['quality_score'] ?? 0;
                break;
                
            case 'completed':
                $data['final_quality'] = $this->signatureData['quality_score'] ?? 0;
                $data['stroke_count'] = $this->signatureData['stroke_count'] ?? 0;
                $data['canvas_size'] = [
                    'width' => $this->signatureData['canvas_width'] ?? 400,
                    'height' => $this->signatureData['canvas_height'] ?? 200
                ];
                $data['is_legally_valid'] = $this->signatureData['is_legally_valid'] ?? false;
                break;
                
            case 'cleared':
                $data['reason'] = $this->signatureData['reason'] ?? 'user_cleared';
                break;
        }

        return $data;
    }
}