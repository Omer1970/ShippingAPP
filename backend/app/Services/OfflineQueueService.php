<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use App\Jobs\SyncDeliveryToErp;
use Exception;

/**
 * Service for managing offline delivery confirmations and background synchronization.
 * Handles storage of queued deliveries, network connectivity monitoring, and batch sync.
 */
class OfflineQueueService
{
    private string $offlineCacheKey = 'offline_deliveries_';
    private string $syncQueueKey = 'delivery_sync_queue_';
    private array $onlineDrivers = [];

    public function __construct()
    {
        $this->offlineCacheKey .= auth()->id() ?? 'system';
        $this->syncQueueKey .= auth()->id() ?? 'system';
    }

    /**
     * Check if user is currently offline.
     */
    public function isOffline(int $userId = null): bool
    {
        $userId = $userId ?? auth()->id();

        // Check network connectivity through various methods
        $networkAvailable = $this->checkNetworkAvailability();

        // Check if Redis/server connections are available
        $serversAvailable = $this->checkServerConnectivity();

        // Check for recent successful API calls
        $recentSuccessfulCall = $this->checkRecentSuccessfulCall($userId);

        return !($networkAvailable && $serversAvailable && $recentSuccessfulCall);
    }

    /**
     * Queue delivery confirmation for offline processing.
     */
    public function queueOfflineDelivery(array $deliveryData): bool
    {
        try {
            $userId = auth()->id();
            $deliveryId = $deliveryData['shipment_id'] . '_' . time(); // Temporary ID

            // Storage key for offline deliveries
            $storageKey = $this->offlineCacheKey . '_' . $userId;

            // Retrieve existing queue
            $queue = $this->getOfflineQueue($userId);

            // Add delivery data with metadata
            $deliveryData['_meta'] = [
                'queued_at' => now()->toISOString(),
                'user_id' => $userId,
                'attempts' => 0,
                'status' => 'queued',
                'temporary_id' => $deliveryId
            ];

            $queue[] = $deliveryData;

            // Store in cache for 30 days (GDPR compliance)
            Cache::put($storageKey, $queue, now()->addDays(30));

            // Register offline delivery attempt for monitoring
            $this->recordOfflineActivity($userId, 'delivery_queued', [
                'delivery_data' => $deliveryData,
                'queue_length' => count($queue)
            ]);

            Log::info('Delivery queued for offline processing', [
                'user_id' => $userId,
                'queue_key' => $storageKey,
                'queue_length' => count($queue),
                'temporary_delivery_id' => $deliveryId
            ]);

            return true;

        } catch (Exception $e) {
            Log::error('Error queueing offline delivery', [
                'user_id' => auth()->id(),
                'error' => $e->getMessage(),
                'delivery_data' => $deliveryData
            ]);

            // Fallback to local storage if cache fails
            return $this->queueLocalStorageFallback($deliveryData);
        }
    }

    /**
     * Sync offline deliveries when connection is restored.
     */
    public function syncOfflineDeliveries(int $userId = null): array
    {
        $userId = $userId ?? auth()->id();
        $storageKey = $this->offlineCacheKey . '_' . $userId;

        try {
            // Retrieve offline queue
            $queue = $this->getOfflineQueue($userId);

            if (empty($queue)) {
                return [
                    'status' => 'success',
                    'message' => 'No offline deliveries to sync',
                    'synced_count' => 0
                ];
            }

            Log::info('Starting offline delivery sync', [
                'user_id' => $userId,
                'queue_length' => count($queue),
                'queue_key' => $storageKey
            ]);

            $syncResults = [
                'successful' => 0,
                'failed' => 0,
                'errors' => []
            ];

            // Process each queued delivery
            foreach ($queue as $key => &$deliveryData) {
                try {
                    // Skip recently queued items to avoid race conditions
                    if ($this->isRecentlyQueued($deliveryData)) {

                        continue;
                    }

                    // Add current online delivery workflow
                    $result = $this->processOfflineDelivery($deliveryData, $userId);

                    if ($result) {
                        $deliveryData['_meta']['status'] = 'synced';
                        $deliveryData['_meta']['synced_at'] = now()->toISOString();
                        $syncResults['successful']++;

                        // Remove successfully synced delivery
                        unset($queue[$key]);

                    } else {
                        $syncResults['failed']++;
                        $deliveryData['_meta']['status'] = 'sync_failed';
                        $deliveryData['_meta']['attempts']++;
                    }

                } catch (Exception $e) {
                    $syncResults['failed']++;
                    $syncResults['errors'][] = $e->getMessage();

                    $deliveryData['_meta']['status'] = 'sync_failed';
                    $deliveryData['_meta']['error'] = $e->getMessage();
                    $deliveryData['_meta']['attempts']++;
                }
            }

            // Re-index array after unset operations
            $queue = array_values($queue);

            // Store updated queue
            Cache::put($storageKey, $queue, now()->addDays(30));

            // Record sync activity
            $this->recordOfflineActivity($userId, 'offline_sync_completed', $syncResults);

            Log::info('Offline delivery sync completed', [
                'user_id' => $userId,
                'results' => $syncResults,
                'remaining_queue' => count($queue)
            ]);

            return [
                'status' => 'success',
                'message' => sprintf('Sync completed: %d successful, %d failed',
                    $syncResults['successful'], $syncResults['failed']),
                'synced_count' => $syncResults['successful'],
                'failed_count' => $syncResults['failed'],
                'errors' => $syncResults['errors'],
                'remaining_in_queue' => count($queue)
            ];

        } catch (Exception $e) {
            Log::error('Error syncing offline deliveries', [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);

            return [
                'status' => 'error',
                'message' => 'Failed to sync offline deliveries',
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Process individual offline delivery confirmation.
     */
    private function processOfflineDelivery(array $deliveryData, int $userId): bool
    {
        try {
            // Merge offline data with current user context
            $deliveryData['user_id'] = $userId;
            $deliveryData['signature_data'] = $deliveryData['signature'] ?? null;
            unset($deliveryData['signature']); // Remove old key

            // Use DeliveryWorkflowService to process the complete delivery
            $workflowService = app(\App\Services\DeliveryWorkflowService::class);
            $delivery = $workflowService->processCompleteDelivery($deliveryData);

            // Queue ERP sync
            if (!$delivery->synced_to_erp) {
                dispatch(new SyncDeliveryToErp($delivery->id))->delay(now()->addSeconds(5));
            }

            Log::info('Offline delivery processed successfully', [
                'delivery_id' => $delivery->id,
                'shipment_id' => $delivery->shipment_id,
                'user_id' => $userId
            ]);

            return true;

        } catch (Exception $e) {
            Log::error('Error processing offline delivery', [
                'user_id' => $userId,
                'error' => $e->getMessage(),
                'delivery_data' => $deliveryData
            ]);

            return false;
        }
    }

    /**
     * Check if user has pending offline deliveries.
     */
    public function hasOfflineDeliveries(int $userId = null): bool
    {
        $userId = $userId ?? auth()->id();
        $queue = $this->getOfflineQueue($userId);

        return !empty($queue);
    }

    /**
     * Get offline queue for user.
     */
    public function getOfflineQueue(int $userId = null): array
    {
        $userId = $userId ?? auth()->id();
        $storageKey = $this->offlineCacheKey . '_' . $userId;

        return Cache::get($storageKey, []);
    }

    /**
     * Add delivery to sync queue for immediate processing.
     */
    public function markDeliveryForSync(int $deliveryId): void
    {
        $userId = auth()->id();
        $syncQueueKey = $this->syncQueueKey . '_' . $userId;

        try {
            $queue = Cache::get($syncQueueKey, []);
            $queue[] = [
                'delivery_id' => $deliveryId,
                'queued_at' => now()->toISOString(),
                'priority' => 'high'
            ];

            Cache::put($syncQueueKey, $queue, now()->addHours(2));

            // Immediately process sync queue
            dispatch(new SyncDeliveryToErp($deliveryId))->onQueue('sync-queue');

            Log::info('Delivery marked for sync', [
                'delivery_id' => $deliveryId,
                'user_id' => $userId
            ]);

        } catch (Exception $e) {
            Log::error('Error marking delivery for sync', [
                'delivery_id' => $deliveryId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Get sync queue for user.
     */
    public function getSyncQueue(int $userId = null): array
    {
        $userId = $userId ?? auth()->id();
        $syncQueueKey = $this->syncQueueKey . '_' . $userId;

        return Cache::get($syncQueueKey, []);
    }

    /**
     * Check network availability.
     */
    private function checkNetworkAvailability(): bool
    {
        try {
            // Simple connectivity check
            $connection = @fsockopen('www.google.com', 80, $errno, $errstr, 10);

            if ($connection) {
                fclose($connection);
                return true;
            }

            return false;

        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Check server connectivity.
     */
    private function checkServerConnectivity(): bool
    {
        try {
            // Check if Redis is available
            $appUrl = config('app.url', 'http://localhost');
            $headers = @get_headers($appUrl . '/api/health', 1);

            return $headers !== false && strpos($headers[0], '200') !== false;

        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Check for recent successful API calls.
     */
    private function checkRecentSuccessfulCall(int $userId): bool
    {
        try {
            $lastSuccessKey = 'last_successful_call_' . $userId;
            $lastSuccess = Cache::get($lastSuccessKey);

            if (!$lastSuccess) {
                return false;
            }

            // Consider user online if they had a successful call within 5 minutes
            $lastSuccessTime = \Carbon\Carbon::parse($lastSuccess);

            return $lastSuccessTime->isAfter(now()->subMinutes(5));

        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Record successful API call.
     */
    public function recordSuccessfulCall(int $userId = null): void
    {
        $userId = $userId ?? auth()->id();

        try {
            $lastSuccessKey = 'last_successful_call_' . $userId;
            Cache::put($lastSuccessKey, now()->toISOString(), now()->addMinutes(10));

            // If coming back online, trigger sync
            if ($this->wasRecentlyOffline($userId)) {
                $this->syncOfflineDeliveries($userId);
            }

        } catch (Exception $e) {
            // Silently fail as this is just for connectivity detection
        }
    }

    /**
     * Check if delivery was recently queued (avoid race conditions).
     */
    private function isRecentlyQueued(array $deliveryData): bool
    {
        $queuedAt = $deliveryData['_meta']['queued_at'] ?? null;

        if (!$queuedAt) {
            return false;
        }

        try {
            $queuedTime = \Carbon\Carbon::parse($queuedAt);

            // Don't sync deliveries queued within the last 60 seconds
            return $queuedTime->isAfter(now()->subSeconds(60));

        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Check if user was recently offline.
     */
    private function wasRecentlyOffline(int $userId): bool
    {
        $offlineActivityKey = 'offline_activity_' . $userId;
        $lastActivity = Cache::get($offlineActivityKey);

        if (!$lastActivity) {
            return false;
        }

        try {
            $lastActivityTime = \Carbon\Carbon::parse($lastActivity);

            return $lastActivityTime->isAfter(now()->subMinutes(15));

        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Record offline activity for monitoring.
     */
    private function recordOfflineActivity(int $userId, string $activity, array $data = []): void
    {
        $offlineActivityKey = 'offline_activity_' . $userId;

        try {
            Cache::put($offlineActivityKey, now()->toISOString(), now()->addMinutes(30));

            // Log for monitoring
            Log::info('Offline activity recorded', [
                'user_id' => $userId,
                'activity' => $activity,
                'data' => $data
            ]);

        } catch (Exception $e) {
            // Silently continue if cache fails
        }
    }

    /**
     * Fallback to local file storage if cache fails.
     */
    private function queueLocalStorageFallback(array $deliveryData): bool
    {
        try {
            $filePath = storage_path('app/offline-queue/' . auth()->id() . '/deliveries.json');

            if (!is_dir(dirname($filePath))) {
                mkdir(dirname($filePath), 0755, true);
            }

            $existingData = [];
            if (file_exists($filePath)) {
                $existingData = json_decode(file_get_contents($filePath), true) ?? [];
            }

            $existingData[] = $deliveryData;

            file_put_contents($filePath, json_encode($existingData, JSON_PRETTY_PRINT));

            Log::info('Offline delivery queued to local storage fallback', [
                'file_path' => $filePath,
                'delivery_count' => count($existingData)
            ]);

            return true;

        } catch (Exception $e) {
            Log::error('Local storage fallback failed', [
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Broadcast offline queue status to connected clients.
     */
    public function broadcastQueueStatus(int $userId = null): void
    {
        $userId = $userId ?? auth()->id();

        try {
            $queue = $this->getOfflineQueue($userId);

            // Broadcast offline queue status via WebSocket
            $queueData = [
                'user_id' => $userId,
                'queue_length' => count($queue),
                'has_pending_deliveries' => !empty($queue),
                'queue' => array_slice($queue, 0, 5) // Only broadcast first 5 for privacy
            ];

            // This would use Laravel's broadcasting system
            broadcast(new \App\Events\DeliveryQueueStatusUpdated($queueData))->toOthers();

        } catch (Exception $e) {
            // Broadcasting is optional, don't let sync fail due to broadcast errors
        }
    }
}