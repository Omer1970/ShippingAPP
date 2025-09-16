<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DeliveryQueueStatusUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $queueData;
    public string $timestamp;

    /**
     * Create a new event instance.
     */
    public function __construct(array $queueData)
    {
        $this->queueData = $queueData;
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
            new PrivateChannel('user.' . $this->queueData['user_id'] . '.queue'),
            new Channel('delivery-queue-updates'), // Public channel for queue monitoring
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'delivery.queue.status.updated';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return array_merge($this->queueData, [
            'timestamp' => $this->timestamp,
            'is_offline_mode' => count($this->queueData['queue']) > 0,
            'estimated_sync_time' => $this->estimateSyncTime($this->queueData['queue_length'])
        ]);
    }

    /**
     * Estimate sync time based on queue length.
     */
    private function estimateSyncTime(int $queueLength): string
    {
        // Assume ~30 seconds per delivery for offline sync including photos
        $estimatedSeconds = $queueLength * 30;

        if ($estimatedSeconds < 60) {
            return sprintf('%ds', $estimatedSeconds);
        } elseif ($estimatedSeconds < 3600) {
            return sprintf('%.1fm', $estimatedSeconds / 60);
        } else {
            return sprintf('%.1fh', $estimatedSeconds / 3600);
        }
    }
}