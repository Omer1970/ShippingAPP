<?php

namespace App\Services;

use App\Models\DeliveryConfirmation;
use App\Models\DeliverySignature;
use App\Models\DeliveryPhoto;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Exception;

/**
 * Service for synchronizing delivery confirmations to Dolibarr ERP system.
 * Handles status updates, signature uploads, and document management.
 */
class DolibarrDeliverySyncService
{
    private ?int $syncTimeout = 30; // seconds
    private ?int $maxRetries = 3;
    private array $erpEndpoints = [];
    private array $syncQueue = [];
    private ?int $queueWatcherId = null;
    private int $syncCount = 0;
    private array $syncMetrics = [];

    public function __construct()
    {
        $this->erpEndpoints = [
            'shipment_status' => '/shipments/{id}/status',
            'document_upload' => '/documents',
            'signature_upload' => '/documents/signatures',
            'delivery_note' => '/documents/delivery-notes'
        ];
    }

    /**
     * Sync delivery confirmation to Dolibarr ERP with retry logic
     */
    public function syncToDolibarr(int $deliveryId): bool
    {
        $delivery = DeliveryConfirmation::with(['signature', 'photos', 'shipment', 'user'])
            ->find($deliveryId);

        if (!$delivery) {
            throw new Exception('Delivery confirmation not found');
        }

        if ($delivery->isSyncedToErp()) {
            Log::info('Delivery already synced to ERP', ['delivery_id' => $deliveryId]);
            return true;
        }

        $startTime = microtime(true);
        $retryCount = 0;
        $lastError = null;

        while ($retryCount < $this->maxRetries) {
            try {
                Log::info('Starting ERP sync for delivery confirmation', [
                    'delivery_id' => $deliveryId,
                    'shipment_id' => $delivery->shipment_id,
                    'retry_attempt' => $retryCount + 1
                ]);

                // Step 1: Update shipment status in Dolibarr
                $this->updateShipmentStatus($delivery);

                // Step 2: Upload signature to Dolibarr document system
                if ($delivery->signature) {
                    $this->uploadSignatureToErp($delivery);
                }

                // Step 3: Upload delivery photos to Dolibarr
                if ($delivery->photos->count() > 0) {
                    $this->uploadDeliveryPhotos($delivery);
                }

                // Step 4: Generate and upload delivery note PDF
                $this->uploadDeliveryNote($delivery);

                // Step 5: Create delivery status log entry
                $this->createDeliveryLogEntry($delivery);

                // Mark delivery as synced
                $delivery->markAsSyncedToErp();

                $syncDuration = microtime(true) - $startTime;
                Log::info('ERP sync completed successfully', [
                    'delivery_id' => $deliveryId,
                    'sync_duration' => round($syncDuration, 2),
                    'retry_attempts' => $retryCount
                ]);

                return true;

            } catch (Exception $e) {
                $retryCount++;
                $lastError = $e;
                
                Log::warning('ERP sync attempt failed, retrying', [
                    'delivery_id' => $deliveryId,
                    'shipment_id' => $delivery->shipment_id,
                    'retry_attempt' => $retryCount,
                    'error' => $e->getMessage(),
                    'error_code' => $e->getCode()
                ]);

                // Exponential backoff delay
                if ($retryCount < $this->maxRetries) {
                    usleep(pow(2, $retryCount) * 1000000); // 2^retry seconds
                }
            }
        }

        // All retries exhausted
        Log::error('ERP sync failed after all retry attempts', [
            'delivery_id' => $deliveryId,
            'shipment_id' => $delivery->shipment_id,
            'total_retries' => $this->maxRetries,
            'final_error' => $lastError->getMessage()
        ]);
        
        throw new Exception('ERP sync failed after ' . $this->maxRetries . ' attempts: ' . $lastError->getMessage());
    }

    /**
     * Update shipment status in Dolibarr
     */
    private function updateShipmentStatus(DeliveryConfirmation $delivery): void
    {
        try {
            // Update shipment status from "in_transit" (2) to "delivered" (3)
            $statusUpdate = [
                'id' => $delivery->shipment_id,
                'status' => 3, // Delivered
                'delivery_date' => $delivery->delivered_at->format('Y-m-d H:i:s'),
                'delivery_note' => $delivery->delivery_notes,
                'delivery_confirmed_by' => $delivery->user->name ?? 'System',
                'delivery_confirmation_id' => $delivery->id
            ];

            // Use Dolibarr database connection to update shipment status
            DB::connection('dolibarr')->table('llx_expedition')
                ->where('rowid', $delivery->shipment_id)
                ->update([
                    'fk_statut' => 3, // Status delivered
                    'date_delivery' => $delivery->delivered_at->format('Y-m-d H:i:s'),
                    'fk_user_delivery' => $delivery->user_id,
                    'note_private' => DB::raw("COALESCE(note_private, '') || '\\nDelivery confirmed: " . $delivery->delivered_at->format('Y-m-d H:i:s') . " by " . ($delivery->user->name ?? 'User') . "'")
                ]);

            // Update tracking if available
            if ($delivery->gps_latitude && $delivery->gps_longitude) {
                $this->updateShipmentTracking($delivery->shipment_id, [
                    'latitude' => $delivery->gps_latitude,
                    'longitude' => $delivery->gps_longitude,
                    'accuracy' => $delivery->gps_accuracy,
                    'timestamp' => $delivery->delivered_at
                ]);
            }

            Log::info('Shipment status updated in Dolibarr', [
                'shipment_id' => $delivery->shipment_id,
                'new_status' => 'delivered',
                'synced_at' => now()
            ]);

        } catch (Exception $e) {
            Log::error('Error updating shipment status', [
                'shipment_id' => $delivery->shipment_id,
                'error' => $e->getMessage()
            ]);
            throw new Exception('Failed to update shipment status: ' . $e->getMessage());
        }
    }

    /**
     * Update shipment tracking information
     */
    private function updateShipmentTracking(int $shipmentId, array $trackingData): void
    {
        try {
            // Create tracking log entry
            DB::connection('dolibarr')->table('llx_expedition_tracking')->insert([
                'fk_expedition' => $shipmentId,
                'latitude' => $trackingData['latitude'],
                'longitude' => $trackingData['longitude'],
                'accuracy' => $trackingData['accuracy'],
                'tracking_date' => $trackingData['timestamp'],
                'tracking_type' => 'delivery',
                'note' => 'Delivery completion GPS coordinates',
                'created_at' => now()
            ]);

            Log::info('Shipment tracking updated', [
                'shipment_id' => $shipmentId,
                'coordinates' => [$trackingData['latitude'], $trackingData['longitude']]
            ]);

        } catch (Exception $e) {
            Log::error('Error updating shipment tracking', [
                'shipment_id' => $shipmentId,
                'error' => $e->getMessage()
            ]);
            // Don't fail the sync if tracking fails
        }
    }

    /**
     * Upload signature to Dolibarr document system
     */
    private function uploadSignatureToErp(DeliveryConfirmation $delivery): void
    {
        try {
            $signature = $delivery->signature;
            if (!$signature) {
                return;
            }

            // Decode signature data and create image file
            $signatureFileName = sprintf(
                'signature_delivery_%d_%s.png',
                $delivery->id,
                now()->format('Ymd_His')
            );

            // Convert base64 signature data to image file
            $signatureImage = base64_decode(preg_replace('#^data:image/\w+;base64,#i', '', $signature->signature_data));
            
            // Save signature to temporary file
            $tempPath = storage_path('app/temp/' . $signatureFileName);
            if (!is_dir(storage_path('app/temp'))) {
                mkdir(storage_path('app/temp'), 0755, true);
            }
            
            file_put_contents($tempPath, $signatureImage);

            // Upload to Dolibarr document system
            $documentId = $this->uploadDocumentToErp(
                $delivery->shipment_id,
                $tempPath,
                $signatureFileName,
                'delivery_signature',
                'Delivery signature for confirmation ID: ' . $delivery->id
            );

            // Link signature to delivery confirmation record
            if ($documentId) {
                DB::connection('dolibarr')->table('llx_element_element')->insert([
                    'fk_source' => $delivery->id,
                    'sourcetype' => 'delivery_confirmation',
                    'fk_target' => $documentId,
                    'targettype' => 'document',
                    'create_date' => now()
                ]);

                Log::info('Signature uploaded to ERP successfully', [
                    'delivery_id' => $delivery->id,
                    'document_id' => $documentId,
                    'file_size' => strlen($signatureImage)
                ]);
            }

            // Cleanup temporary file
            if (file_exists($tempPath)) {
                unlink($tempPath);
            }

        } catch (Exception $e) {
            Log::error('Error uploading signature to ERP', [
                'delivery_id' => $delivery->id,
                'error' => $e->getMessage()
            ]);
            throw new Exception('Failed to upload signature: ' . $e->getMessage());
        }
    }

    /**
     * Upload delivery photos to Dolibarr
     */
    private function uploadDeliveryPhotos(DeliveryConfirmation $delivery): void
    {
        try {
            $uploadedPhotoIds = [];

            foreach ($delivery->photos as $photo) {
                try {
                    $photoFilePath = storage_path('app/public/' . $photo->photo_path);
                    
                    if (!file_exists($photoFilePath)) {
                        Log::warning('Photo file not found for ERP upload', [
                            'photo_id' => $photo->id,
                            'photo_path' => $photo->photo_path
                        ]);
                        continue;
                    }

                    $photoFileName = sprintf(
                        'photo_delivery_%d_%d_%s.%s',
                        $delivery->id,
                        $photo->id,
                        now()->format('Ymd_His'),
                        pathinfo($photo->photo_path, PATHINFO_EXTENSION)
                    );

                    // Upload photo to Dolibarr
                    $documentId = $this->uploadDocumentToErp(
                        $delivery->shipment_id,
                        $photoFilePath,
                        $photoFileName,
                        'delivery_photo',
                        sprintf('Delivery photo (type: %s) for confirmation ID: %d', 
                                $photo->photo_type, $delivery->id)
                    );

                    if ($documentId) {
                        $uploadedPhotoIds[] = $documentId;
                        
                        // Link photo to delivery confirmation
                        DB::connection('dolibarr')->table('llx_element_element')->insert([
                            'fk_source' => $delivery->id,
                            'sourcetype' => 'delivery_confirmation',
                            'fk_target' => $documentId,
                            'targettype' => 'document',
                            'create_date' => now()
                        ]);

                        Log::info('Photo uploaded to ERP successfully', [
                            'delivery_id' => $delivery->id,
                            'photo_id' => $photo->id,
                            'document_id' => $documentId
                        ]);
                    }

                } catch (Exception $e) {
                    Log::error('Error uploading individual photo to ERP', [
                        'delivery_id' => $delivery->id,
                        'photo_id' => $photo->id,
                        'error' => $e->getMessage()
                    ]);
                    // Continue with other photos instead of failing the entire sync
                }
            }

            Log::info('Delivery photos uploaded to ERP', [
                'delivery_id' => $delivery->id,
                'photo_count' => count($uploadedPhotoIds),
                'total_photos' => $delivery->photos->count()
            ]);

        } catch (Exception $e) {
            Log::error('Error uploading delivery photos to ERP', [
                'delivery_id' => $delivery->id,
                'error' => $e->getMessage()
            ]);
            throw new Exception('Failed to upload delivery photos: ' . $e->getMessage());
        }
    }

    /**
     * Upload delivery note PDF to Dolibarr
     */
    private function uploadDeliveryNote(DeliveryConfirmation $delivery): void
    {
        try {
            // Generate delivery note PDF (service would handle this)
            $deliveryNoteService = app(\App\Services\DeliveryNoteService::class);
            $pdfData = $deliveryNoteService->generateDeliveryNote($delivery);

            if (!$pdfData) {
                Log::warning('Could not generate delivery note PDF', ['delivery_id' => $delivery->id]);
                return;
            }

            $deliveryNoteFilePath = $pdfData['path'];
            $deliveryNoteFileName = sprintf(
                'delivery_note_%d_%s.pdf',
                $delivery->id,
                now()->format('Ymd_His')
            );

            // Upload delivery note to Dolibarr
            $documentId = $this->uploadDocumentToErp(
                $delivery->shipment_id,
                $deliveryNoteFilePath,
                $deliveryNoteFileName,
                'delivery_note',
                'Formal delivery confirmation note for shipment ID: ' . $delivery->shipment_id
            );

            if ($documentId) {
                // Link delivery note to delivery confirmation
                DB::connection('dolibarr')->table('llx_element_element')->insert([
                    'fk_source' => $delivery->id,
                    'sourcetype' => 'delivery_confirmation',
                    'fk_target' => $documentId,
                    'targettype' => 'document',
                    'create_date' => now()
                ]);

                Log::info('Delivery note uploaded to ERP successfully', [
                    'delivery_id' => $delivery->id,
                    'document_id' => $documentId,
                    'file_size' => $pdfData['size']
                ]);
            }

        } catch (Exception $e) {
            Log::error('Error uploading delivery note to ERP', [
                'delivery_id' => $delivery->id,
                'error' => $e->getMessage()
            ]);
            // Don't fail the entire sync if delivery note upload fails
        }
    }

    /**
     * Upload document to Dolibarr document system
     */
    private function uploadDocumentToErp(int $shipmentId, string $filePath, string $fileName, string $documentType, string $description): ?int
    {
        try {
            // Insert document record
            $documentId = DB::connection('dolibarr')->table('llx_document')->insertGetId([
                'rowid' => null,
                'entity' => 1,
                'ref' => $fileName,
                'label' => substr($description, 0, 255),
                'description' => $description,
                'type' => $documentType,
                'mimetype' => mime_content_type($filePath),
                'filename' => $fileName,
                'filesize' => filesize($filePath),
                'path' => 'expedition/' . $shipmentId . '/delivery_docs/',
                'position' => 0,
                'active' => 1,
                'datec' => now(),
                'tms' => now(),
                'fk_user_creat' => auth()->id() ?? 1,
                'fk_user_modif' => auth()->id() ?? 1
            ]);

            // Link document to shipment
            DB::connection('dolibarr')->table('llx_element_element')->insert([
                'fk_source' => $shipmentId,
                'sourcetype' => 'shipment',
                'fk_target' => $documentId,
                'targettype' => 'document',
                'create_date' => now()
            ]);

            // Copy file to Dolibarr storage location (simulate upload)
            $this->copyFileToErpStorage($filePath, $documentId, $fileName);

            return $documentId;

        } catch (Exception $e) {
            Log::error('Error uploading document to ERP', [
                'shipment_id' => $shipmentId,
                'file_name' => $fileName,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Copy file to ERP storage location (simulating upload)
     */
    private function copyFileToErpStorage(string $sourcePath, int $documentId, string $fileName): void
    {
        try {
            // Simulate copying to Dolibarr document directory
            $erpDocumentPath = storage_path('app/erp-documents/' . $documentId);
            
            if (!is_dir($erpDocumentPath)) {
                mkdir($erpDocumentPath, 0755, true);
            }

            $destinationPath = $erpDocumentPath . '/' . $fileName;
            copy($sourcePath, $destinationPath);

            Log::info('Document copied to ERP storage', [
                'document_id' => $documentId,
                'file_name' => $fileName,
                'size' => filesize($destinationPath)
            ]);

        } catch (Exception $e) {
            Log::error('Error copying file to ERP storage', [
                'document_id' => $documentId,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Create delivery status log entry
     */
    private function createDeliveryLogEntry(DeliveryConfirmation $delivery): void
    {
        try {
            // Create log entry with delivery confirmation details
            DB::connection('dolibarr')->table('llx_expedition_logs')->insert([
                'fk_expedition' => $delivery->shipment_id,
                'fk_user' => $delivery->user_id,
                'type' => 'delivery_confirmation',
                'message' => sprintf(
                    'Delivery confirmed by %s on %s for %s',
                    $delivery->user->name ?? 'User',
                    $delivery->delivered_at->format('Y-m-d H:i:s'),
                    $delivery->recipient_name
                ),
                'data' => json_encode([
                    'delivery_id' => $delivery->id,
                    'signature_quality' => $delivery->signature->signature_quality ?? null,
                    'photo_count' => $delivery->photos->count(),
                    'gps_coordinates' => [
                        'latitude' => $delivery->gps_latitude,
                        'longitude' => $delivery->gps_longitude,
                        'accuracy' => $delivery->gps_accuracy
                    ],
                    'verification_hash' => $delivery->verification_hash,
                    'synced_at' => now()->toISOString()
                ]),
                'datec' => now(),
                'tms' => now()
            ]);

            Log::info('Delivery log entry created in ERP', [
                'delivery_id' => $delivery->id,
                'shipment_id' => $delivery->shipment_id,
                'log_type' => 'delivery_confirmation'
            ]);

        } catch (Exception $e) {
            Log::error('Error creating delivery log entry', [
                'delivery_id' => $delivery->id,
                'error' => $e->getMessage()
            ]);
            // Don't fail sync if log entry creation fails
        }
    }

    /**
     * Batch sync multiple deliveries
     */
    public function syncBatch(array $deliveryIds): array
    {
        $results = [
            'total' => count($deliveryIds),
            'successful' => 0,
            'failed' => 0,
            'errors' => []
        ];

        foreach ($deliveryIds as $deliveryId) {
            try {
                $this->syncToDolibarr($deliveryId);
                $results['successful']++;

            } catch (Exception $e) {
                $results['failed']++;
                $results['errors'][$deliveryId] = $e->getMessage();

                Log::error('Batch sync failed for delivery', [
                    'delivery_id' => $deliveryId,
                    'error' => $e->getMessage()
                ]);
            }
        }

        Log::info('Batch delivery sync completed', $results);

        return $results;
    }

    /**
     * Get sync statistics
     */
    public function getSyncStatistics(array $filters = []): array
    {
        try {
            $query = DeliveryConfirmation::query();

            // Apply filters
            if (isset($filters['user_id'])) {
                $query->where('user_id', $filters['user_id']);
            }

            if (isset($filters['date_from'])) {
                $query->whereDate('created_at', '>=', $filters['date_from']);
            }

            if (isset($filters['date_to'])) {
                $query->whereDate('created_at', '<=', $filters['date_to']);
            }

            $totalDeliveries = $query->count();
            $syncedDeliveries = (clone $query)->where('synced_to_erp', true)->count();
            $pendingDeliveries = (clone $query)->where('synced_to_erp', false)->count();

            $avgSyncTime = 0; // Would calculate from sync timestamps

            return [
                'total_deliveries' => $totalDeliveries,
                'synced_deliveries' => $syncedDeliveries,
                'pending_deliveries' => $pendingDeliveries,
                'sync_success_rate' => $totalDeliveries > 0 ? round(($syncedDeliveries / $totalDeliveries) * 100, 2) : 0,
                'avg_sync_time_seconds' => $avgSyncTime,
                'last_synced_at' => $syncedDeliveries > 0 ? 
                    DeliveryConfirmation::where('synced_to_erp', true)->latest('erp_sync_timestamp')->value('erp_sync_timestamp') : null
            ];

        } catch (Exception $e) {
            Log::error('Error fetching sync statistics', [
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Add delivery to sync queue for immediate processing
     */
    public function queueDeliverySync(int $deliveryId): void
    {
        if (!in_array($deliveryId, $this->syncQueue)) {
            array_push($this->syncQueue, $deliveryId);
            Log::info('Delivery added to ERP sync queue', ['delivery_id' => $deliveryId, 'queue_size' => count($this->syncQueue)]);
            
            // Start queue processor if not already running
            $this->startQueueProcessor();
        }
    }

    /**
     * Start background queue processor
     */
    private function startQueueProcessor(): void
    {
        if ($this->queueWatcherId === null && count($this->syncQueue) > 0) {
            Log::info('Starting ERP sync queue processor');
            // In production, this would create a background job or queue worker
            $this->processSyncQueue();
        }
    }

    /**
     * Process the sync queue
     */
    private function processSyncQueue(): void
    {
        $processingStarted = microtime(true);
        $currentBatch = array_splice($this->syncQueue, 0, 10); // Process batch of 10
        
        if (empty($currentBatch)) {
            $this->queueWatcherId = null;
            return;
        }

        Log::info('Processing ERP sync queue batch', ['count' => count($currentBatch)]);

        $processingResults = [
            'successful' => 0,
            'failed' => 0,
            'errors' => []
        ];

        foreach ($currentBatch as $deliveryId) {
            try {
                // Use shorter timeout for queue processing than manual sync
                $this->syncTimeout = 15; // 15 seconds per delivery
                $this->syncToDolibarr($deliveryId);
                $processingResults['successful']++;
                $this->recordSyncMetric($deliveryId, 'success', array_diff(
                    [
                        'sync_time' => microtime(true) - $processingStarted,
                        'queue_position' => array_search($deliveryId, $currentBatch)
                    ], []
                ));
            } catch (Exception $e) {
                $processingResults['failed']++;
                $processingResults['errors'][$deliveryId] = $e->getMessage();
                $this->recordSyncMetric($deliveryId, 'failed', [
                    'error' => $e->getMessage(),
                    'queue_position' => array_search($deliveryId, $currentBatch)
                ]);
                
                // Re-queue failed deliveries for later retry
                if ($this->shouldRetryDelivery($deliveryId)) {
                    $this->queueDeliverySync($deliveryId);
                }
            }
        }

        $batchDuration = microtime(true) - $processingStarted;
        
        Log::info('ERP sync queue batch processing completed', [
            'batch_size' => count($currentBatch),
            'successful' => $processingResults['successful'],
            'failed' => $processingResults['failed'],
            'batch_duration' => round($batchDuration, 2),
            'remaining_queue' => count($this->syncQueue)
        ]);

        // Continue processing if queue still has items
        if (count($this->syncQueue) > 0) {
            // Use exponential processing to avoid overwhelming the system
            usleep(2000000); // 2 second delay between batches
            $this->processSyncQueue();
        } else {
            $this->queueWatcherId = null;
        }
    }

    /**
     * Determine if a failed delivery should be retried
     */
    private function shouldRetryDelivery(int $deliveryId): bool
    {
        // Look up sync metrics to see retry attempts
        $metrics = $this->getDeliverySyncMetrics($deliveryId);
        
        if (isset($metrics['retry_count']) && $metrics['retry_count'] >= $this->maxRetries) {
            // Max retries exhausted, move to failed queue for manual review
            Log::warning('Max retries exhausted for delivery sync', ['delivery_id' => $deliveryId, 'retry_count' => $metrics['retry_count']]);
            $this->queueFailedDeliveryForManualReview($deliveryId);
            return false;
        }
        
        return true;
    }

    /**
     * Queue failed delivery for manual review
     */
    private function queueFailedDeliveryForManualReview(int $deliveryId): void
    {
        
        try {
            DB::connection('dolibarr')->table('llx_expedition_sync_failed')->insert([
                'fk_expedition' => $deliveryId,
                'error_message' => 'Max retry attempts exhausted',
                'created_at' => now(),
                'review_status' => 'pending',
                'is_resolved' => false
            ]);
            
            Log::error('Delivery marked for manual review due to sync failures', [
                'delivery_id' => $deliveryId,
                'max_retries' => $this->maxRetries
            ]);
            
        } catch (Exception $e) {
            Log::error('Failed to queue delivery for manual review', [
                'delivery_id' => $deliveryId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Record sync metrics for monitoring and reporting
     */
    private function recordSyncMetric(int $deliveryId, string $status, array $data = []): void
    {
        $this->syncMetrics[$deliveryId] = array_merge([
            'delivery_id' => $deliveryId,
            'status' => $status,
            'timestamp' => time(),
            'retry_count' => isset($data['error']) ? ($this->syncMetrics[$deliveryId]['retry_count'] ?? 0) : 0
        ], $data);
    }

    /**
     * Get sync metrics for a specific delivery
     */
    private function getDeliverySyncMetrics(int $deliveryId): array
    {
        return $this->syncMetrics[$deliveryId] ?? [];
    }

    /**
     * Get overall sync statistics
     */
    public function getSyncMonitoringStats(): array
    {
        $totalSyns = count($this->syncMetrics);
        $successfulSyncs = count(array_filter($this->syncMetrics, fn($metric) => $metric['status'] === 'success'));
        $failedSyncs = $totalSyns - $successfulSyncs;
        
        return [
            'total_attempts' => $totalSyns,
            'successful_syncs' => $successfulSyncs,
            'failed_syncs' => $failedSyncs,
            'success_rate' => $totalSyns > 0 ? round(($successfulSyncs / $totalSyns) * 100, 2) : 0,
            'current_queue_size' => count($this->syncQueue),
            'is_queue_processing' => $this->queueWatcherId !== null,
            'sync_metrics_sample' => array_slice($this->syncMetrics, -10) // Last 10 metrics
        ];
    }

    /**
     * Get delivery confirmations that need sync retry
     */
    public function getFailedDeliveriesForRetry(): array
    {
        // This would query the failed sync queue and retry count
        return DB::table('llx_expedition_sync_failed')
            ->where('is_resolved', false)
            ->where('review_status', 'retry_pending')
            ->where('created_at', '>', now()->subHours(24))
            ->pluck('fk_expedition')
            ->toArray();
    }
}