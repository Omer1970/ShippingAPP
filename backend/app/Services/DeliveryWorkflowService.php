<?php

namespace App\Services;

use App\Models\DeliveryConfirmation;
use App\Models\DeliverySignature;
use App\Models\DeliveryPhoto;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use App\Events\DeliveryStatusUpdated;
use App\Events\SignatureProgress;
use App\Events\DeliveryLocationUpdated;
use Exception;

/**
 * Service for orchestrating the complete delivery confirmation workflow.
 * Handles signature processing, photo management, GPS tracking, and ERP sync coordination.
 */
class DeliveryWorkflowService
{
    private DolibarrDeliverySyncService $dolibarrSyncService;
    private SignatureService $signatureService;
    private PhotoService $photoService;

    public function __construct(
        DolibarrDeliverySyncService $dolibarrSyncService,
        SignatureService $signatureService,
        PhotoService $photoService
    ) {
        $this->dolibarrSyncService = $dolibarrSyncService;
        $this->signatureService = $signatureService;
        $this->photoService = $photoService;
    }

    /**
     * Process complete delivery confirmation workflow
     */
    public function processCompleteDelivery(array $data): DeliveryConfirmation
    {
        DB::beginTransaction();

        try {
            // Create or update delivery confirmation
            $delivery = $this->createOrUpdateDeliveryConfirmation($data);

            // Process signature if provided
            if (isset($data['signature_data'])) {
                $delivery = $this->processSignature($delivery, $data['signature_data']);
            }

            // Process photos if provided
            if (isset($data['photos']) && is_array($data['photos'])) {
                $delivery = $this->processPhotos($delivery, $data['photos']);
            }

            // Validate GPS coordinates
            if (isset($data['gps_latitude']) && isset($data['gps_longitude'])) {
                $this->validateGPSCoordinates($delivery, $data['gps_latitude'], $data['gps_longitude']);
            }

            // Generate verification hash
            $delivery->verification_hash = $delivery->generateVerificationHash();
            $delivery->save();

            // Queue ERP synchronization
            $this->queueErpSync($delivery);

            DB::commit();

            // Broadcast delivery status update
            broadcast(new DeliveryStatusUpdated($delivery, 'delivery_confirmed', [
                'workflow_completed' => true,
                'verification_hash' => $delivery->verification_hash
            ]))->toOthers();

            Log::info('Delivery confirmation processed successfully', [
                'delivery_id' => $delivery->id,
                'shipment_id' => $delivery->shipment_id,
                'user_id' => $delivery->user_id
            ]);

            return $delivery;

        } catch (Exception $e) {
            DB::rollBack();
            Log::error('Error processing delivery confirmation workflow', [
                'error' => $e->getMessage(),
                'data' => $data
            ]);
            throw $e;
        }
    }

    /**
     * Create or update delivery confirmation
     */
    private function createOrUpdateDeliveryConfirmation(array $data): DeliveryConfirmation
    {
        if (isset($data['delivery_id'])) {
            $delivery = DeliveryConfirmation::find($data['delivery_id']);
            if (!$delivery) {
                throw new Exception('Delivery confirmation not found');
            }
        } else {
            $delivery = new DeliveryConfirmation();
            $delivery->shipment_id = $data['shipment_id'];
            $delivery->user_id = auth()->id();
        }

        // Set base delivery information
        $delivery->delivered_at = $data['delivered_at'] ?? now();
        $delivery->recipient_name = $data['recipient_name'] ?? '';
        $delivery->delivery_notes = $data['delivery_notes'] ?? '';
        $delivery->status = $data['status'] ?? 'delivered';
        
        // Set GPS coordinates
        if (isset($data['gps_latitude'])) {
            $delivery->gps_latitude = $data['gps_latitude'];
        }
        if (isset($data['gps_longitude'])) {
            $delivery->gps_longitude = $data['gps_longitude'];
        }
        if (isset($data['gps_accuracy'])) {
            $delivery->gps_accuracy = $data['gps_accuracy'];
        }

        $delivery->save();

        // Broadcast location update when GPS coordinates are available
        if (isset($data['gps_latitude']) || isset($data['gps_longitude'])) {
            broadcast(new DeliveryLocationUpdated($delivery, [
                'latitude' => $delivery->gps_latitude,
                'longitude' => $delivery->gps_longitude,
                'accuracy' => $delivery->gps_accuracy
            ]))->toOthers();
        }

        return $delivery;
    }

    /**
     * Process digital signature data
     */
    public function processSignature(DeliveryConfirmation $delivery, array $signatureData): DeliveryConfirmation
    {
        try {
            // Validate signature data
            $validationResult = $this->signatureService->validateSignatureData($signatureData['signature_data'] ?? '');
            if (!$validationResult['valid']) {
                throw new Exception('Invalid signature data: ' . implode(', ', $validationResult['errors']));
            }

            // Calculate signature quality if not provided
            $quality = $signatureData['signature_quality'] ?? $this->signatureService->calculateSignatureQuality(
                $signatureData['signature_data'],
                $signatureData['signature_strokes'] ?? []
            );

            // Create or update signature record
            $signature = $delivery->signature ?: new DeliverySignature();
            
            $signature->delivery_id = $delivery->id;
            $signature->signature_data = $signatureData['signature_data'];
            $signature->signature_type = $signatureData['signature_type'] ?? 'touch';
            $signature->signature_strokes = json_encode($signatureData['signature_strokes'] ?? []);
            $signature->signature_quality = $quality;
            $signature->canvas_width = $signatureData['canvas_width'] ?? 400;
            $signature->canvas_height = $signatureData['canvas_height'] ?? 200;
            $signature->device_name = $signatureData['device_name'] ?? $this->getDeviceName();
            $signature->ip_address = $signatureData['ip_address'] ?? request()->ip();
            $signature->user_agent = $signatureData['user_agent'] ?? request()->userAgent();
            
            $signature->save();

            // Generate verification hash
            $signature->signature_hash = $signature->generateVerificationHash();
            $signature->save();

            // Update delivery with signature reference
            $delivery->signature_id = $signature->id;
            $delivery->save();

            // Broadcast signature progress update
            broadcast(new SignatureProgress($delivery, 'completed', [
                'quality_score' => $quality,
                'stroke_count' => count($signatureData['signature_strokes'] ?? []),
                'canvas_width' => $signatureData['canvas_width'] ?? 400,
                'canvas_height' => $signatureData['canvas_height'] ?? 200,
                'is_legally_valid' => $signature->isLegallyValid()
            ]))->toOthers();

            Log::info('Signature processed successfully', [
                'delivery_id' => $delivery->id,
                'signature_id' => $signature->id,
                'quality_score' => $quality,
                'is_legally_valid' => $signature->isLegallyValid()
            ]);

            return $delivery;

        } catch (Exception $e) {
            Log::error('Error processing delivery signature', [
                'delivery_id' => $delivery->id,
                'error' => $e->getMessage()
            ]);
            throw new Exception('Failed to process signature: ' . $e->getMessage());
        }
    }

    /**
     * Process delivery photos
     */
    public function processPhotos(DeliveryConfirmation $delivery, array $photosData): DeliveryConfirmation
    {
        $processedPhotoIds = [];

        try {
            foreach ($photosData as $photoData) {
                $photo = $this->processSinglePhoto($delivery, $photoData);
                $processedPhotoIds[] = $photo->id;
            }

            // Update delivery confirmation with processed photo IDs
            $existingPhotoIds = $delivery->photo_ids ?? [];
            $updatedPhotoIds = array_merge($existingPhotoIds, $processedPhotoIds);
            $delivery->photo_ids = array_values(array_unique($updatedPhotoIds));
            $delivery->save();

            return $delivery;

        } catch (Exception $e) {
            // Cleanup any processed photos on error
            $this->cleanupPhotoFiles($processedPhotoIds);
            throw new Exception('Failed to process photos: ' . $e->getMessage());
        }
    }

    /**
     * Process single photo
     */
    private function processSinglePhoto(DeliveryConfirmation $delivery, array $photoData): DeliveryPhoto
    {
        try {
            // Validate and save photo file
            if (isset($photoData['photo_file']) && $photoData['photo_file']->isValid()) {
                $file = $photoData['photo_file'];
                $fileName = sprintf(
                    'delivery_%d_%s_%s.%s',
                    $delivery->id,
                    $photoData['photo_type'] ?? 'photo',
                    now()->format('Ymd_His'),
                    $file->getClientOriginalExtension()
                );

                // Store photo in public disk
                $photoPath = $file->storeAs('delivery_photos/' . $delivery->id, $fileName, 'public');
                
                // Generate thumbnail
                $thumbnailPath = $this->photoService->createThumbnail($photoPath);

                // Get image dimensions
                $imageDimensions = [
                    'width' => null,
                    'height' => null
                ];

                if (file_exists(storage_path('app/public/' . $photoPath))) {
                    $imageInfo = getimagesize(storage_path('app/public/' . $photoPath));
                    if ($imageInfo !== false) {
                        $imageDimensions = [
                            'width' => $imageInfo[0],
                            'height' => $imageInfo[1]
                        ];
                    }
                }

                // Create photo record
                $photo = DeliveryPhoto::create([
                    'delivery_confirmation_id' => $delivery->id,
                    'photo_path' => $photoPath,
                    'thumbnail_path' => $thumbnailPath,
                    'photo_type' => $photoData['photo_type'] ?? 'delivery_proof',
                    'gps_latitude' => $photoData['gps_latitude'] ?? null,
                    'gps_longitude' => $photoData['gps_longitude'] ?? null,
                    'photo_metadata' => json_encode($photoData['photo_metadata'] ?? []),
                    'file_size' => $file->getSize(),
                    'image_dimensions' => json_encode($imageDimensions)
                ]);

                Log::info('Photo processed successfully', [
                    'delivery_id' => $delivery->id,
                    'photo_id' => $photo->id,
                    'photo_type' => $photo->photo_type,
                    'file_size' => $photo->file_size
                ]);

                return $photo;
            }

            throw new Exception('Invalid photo file');

        } catch (Exception $e) {
            Log::error('Error processing delivery photo', [
                'delivery_id' => $delivery->id,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Validate GPS coordinates against delivery address
     */
    private function validateGPSCoordinates(DeliveryConfirmation $delivery, float $latitude, float $longitude): void
    {
        try {
            // Basic coordinate validation
            if ($latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) {
                throw new Exception('Invalid GPS coordinates');
            }

            // Advanced validation using Google Maps API or similar service would go here
            // For now, we'll just log the validation attempt
            Log::info('GPS coordinates validation', [
                'delivery_id' => $delivery->id,
                'latitude' => $latitude,
                'longitude' => $longitude,
                'shipment_address' => $delivery->shipment->address ?? 'Not available'
            ]);

        } catch (Exception $e) {
            Log::error('Error validating GPS coordinates', [
                'delivery_id' => $delivery->id,
                'error' => $e->getMessage()
            ]);
            // Don't throw error for GPS validation failures, just log
        }
    }

    /**
     * Queue ERP synchronization
     */
    public function queueErpSync(DeliveryConfirmation $delivery): void
    {
        try {
            // Dispatch job for ERP sync
            $job = new \App\Jobs\SyncDeliveryToErp($delivery->id);
            
            // Set queue priority based on delivery status
            if ($delivery->status === 'delivered') {
                $job->onQueue('high-priority');
            } else {
                $job->onQueue('default');
            }

            dispatch($job)->delay(now()->addSeconds(30)); // Delay to ensure all data is saved

            Log::info('ERP sync queued successfully', [
                'delivery_id' => $delivery->id,
                'shipment_id' => $delivery->shipment_id,
                'queue' => $job->queue
            ]);

        } catch (Exception $e) {
            Log::error('Error queuing ERP sync', [
                'delivery_id' => $delivery->id,
                'error' => $e->getMessage()
            ]);
            // Don't throw error, just log - the delivery is still valid
        }
    }

    /**
     * Get delivery workflow status
     */
    public function getWorkflowStatus(DeliveryConfirmation $delivery): array
    {
        return [
            'delivery_status' => $delivery->status,
            'has_signature' => !is_null($delivery->signature),
            'signature_valid' => $delivery->signature && $delivery->signature->isLegallyValid(),
            'photo_count' => $delivery->photos()->count(),
            'has_gps' => !is_null($delivery->gps_latitude) && !is_null($delivery->gps_longitude),
            'synced_to_erp' => $delivery->isSyncedToErp(),
            'verification_hash_valid' => $delivery->verifyIntegrity(),
            'created_at' => $delivery->created_at->toISOString(),
            'updated_at' => $delivery->updated_at->toISOString()
        ];
    }

    /**
     * Validate delivery workflow completeness
     */
    public function validateWorkflowCompletion(DeliveryConfirmation $delivery): array
    {
        $issues = [];
        $warnings = [];
        $status = 'complete';

        // Check signature
        if (!$delivery->signature) {
            $issues[] = 'Missing digital signature';
            $status = 'incomplete';
        } elseif (!$delivery->signature->isLegallyValid()) {
            $warnings[] = 'Signature may not meet legal requirements';
            if ($delivery->signature->signature_quality < 0.85) {
                $issues[] = 'Signature quality below acceptable threshold (0.85)';
                $status = 'needs_review';
            }
        }

        // Check photos
        $photoCount = $delivery->photos()->count();
        if ($photoCount === 0) {
            $warnings[] = 'No delivery photos provided';
        }

        // Check GPS coordinates
        if (!$delivery->gps_latitude || !$delivery->gps_longitude) {
            $warnings[] = 'Missing GPS location data';
        }

        // Check verification hash
        if (!$delivery->verifyIntegrity()) {
            $issues[] = 'Delivery data integrity verification failed';
            $status = 'invalid';
        }

        // Check ERP sync status
        if (!$delivery->isSyncedToErp()) {
            $warnings[] = 'Not yet synchronized to ERP system';
        }

        return [
            'status' => $status,
            'issues' => $issues,
            'warnings' => $warnings,
            'completeness_percentage' => $this->calculateCompleteness($delivery, $issues, $warnings)
        ];
    }

    /**
     * Calculate delivery completeness percentage
     */
    private function calculateCompleteness(DeliveryConfirmation $delivery, array $issues, array $warnings): float
    {
        $totalChecks = 5; // signature, photos, gps, verification, erp_sync
        $passedChecks = 0;

        if ($delivery->signature && $delivery->signature->isLegallyValid()) {
            $passedChecks++;
        }

        if ($delivery->photos()->count() > 0) {
            $passedChecks++;
        }

        if ($delivery->gps_latitude && $delivery->gps_longitude) {
            $passedChecks++;
        }

        if ($delivery->verifyIntegrity()) {
            $passedChecks++;
        }

        if ($delivery->isSyncedToErp()) {
            $passedChecks++;
        }

        return round(($passedChecks / $totalChecks) * 100, 2);
    }

    /**
     * Cleanup photo files on error
     */
    private function cleanupPhotoFiles(array $photoIds): void
    {
        foreach ($photoIds as $photoId) {
            try {
                $photo = DeliveryPhoto::find($photoId);
                if ($photo) {
                    $photo->deletePhotoFiles();
                    $photo->delete();
                }
            } catch (Exception $e) {
                Log::error('Error cleaning up photo', [
                    'photo_id' => $photoId,
                    'error' => $e->getMessage()
                ]);
            }
        }
    }

    /**
     * Get device name from request
     */
    private function getDeviceName(): string
    {
        $userAgent = request()->userAgent();
        
        if (strpos($userAgent, 'Mobile') !== false) {
            return 'Mobile Device';
        } elseif (strpos($userAgent, 'Tablet') !== false) {
            return 'Tablet Device';
        } else {
            return 'Desktop Device';
        }
    }
}