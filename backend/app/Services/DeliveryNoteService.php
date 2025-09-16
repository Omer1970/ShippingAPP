<?php

namespace App\Services;

use App\Models\DeliveryConfirmation;
use Illuminate\Support\Facades\Log;
use Exception;
use Carbon\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Service for generating delivery note PDFs with signature, photos, and delivery details.
 */
class DeliveryNoteService
{
    private const PDF_TTL = 3600; // 1 hour
    private const PDF_QUALITY = 90;
    private const TEMPLATE_DIR = 'delivery-notes';
    private const CACHE_DIR = 'temp/delivery-notes';

    private array $defaultTemplateData = [
        'company_name' => 'ShipmentApp Delivery Service',
        'company_address' => '123 Logistics Avenue, Commerce City',
        'company_phone' => '+1-800-SHIP-NOW',
        'company_email' => 'deliveries@shipmentapp.com',
        'website' => 'https://shipmentapp.com'
    ];

    /**
     * Generate delivery note PDF
     */
    public function generateDeliveryNote(DeliveryConfirmation $delivery): array
    {
        try {
            // Prepare delivery data
            $deliveryData = $this->prepareDeliveryData($delivery);

            // Generate HTML content
            $htmlContent = $this->generateHtmlTemplate($deliveryData);

            // Generate PDF
            $pdfPath = $this->generatePdf($htmlContent, $delivery, $deliveryData);

            // Calculate checksum
            $checksum = $this->calculatePdfChecksum($pdfPath);

            // Set expiration time
            $expiresAt = Carbon::now()->addSeconds(self::PDF_TTL);

            $result = [
                'path' => $pdfPath,
                'url' => $this->getPdfUrl($pdfPath),
                'size' => filesize($pdfPath),
                'checksum' => $checksum,
                'expires_at' => $expiresAt,
                'generated_at' => Carbon::now()->toISOString()
            ];

            Log::info('Delivery note PDF generated successfully', [
                'delivery_id' => $delivery->id,
                'pdf_size' => $result['size'],
                'checksum' => $checksum
            ]);

            return $result;

        } catch (Exception $e) {
            Log::error('Error generating delivery note PDF', [
                'delivery_id' => $delivery->id,
                'error' => $e->getMessage()
            ]);
            throw new Exception('Failed to generate delivery note: ' . $e->getMessage());
        }
    }

    /**
     * Generate delivery note HTML preview
     */
    public function generatePreview(DeliveryConfirmation $delivery): array
    {
        try {
            // Prepare delivery data
            $deliveryData = $this->prepareDeliveryData($delivery, true); // Include preview flag

            // Generate HTML content
            $htmlContent = $this->generateHtmlTemplate($deliveryData);

            return [
                'html' => $htmlContent,
                'data' => $deliveryData
            ];

        } catch (Exception $e) {
            Log::error('Error generating delivery note preview', [
                'delivery_id' => $delivery->id,
                'error' => $e->getMessage()
            ]);
            throw new Exception('Failed to generate delivery note preview: ' . $e->getMessage());
        }
    }

    /**
     * Prepare delivery data for template
     */
    private function prepareDeliveryData(DeliveryConfirmation $delivery, bool $isPreview = false): array
    {
        try {
            $now = Carbon::now();
            $deliveryTime = Carbon::parse($delivery->delivered_at);
            
            // Get signatures data
            $signatures = [];
            if ($delivery->signature) {
                $signatures[] = [
                    'type' => 'digital',
                    'data' => $this->processSignatureData($delivery->signature),
                    'quality' => $delivery->signature->signature_quality,
                    'quality_class' => $this->getQualityClass($delivery->signature->signature_quality),
                    'is_valid' => $delivery->signature->isLegallyValid(),
                    'ip_address' => $delivery->signature->ip_address,
                    'device' => $delivery->signature->device_name,
                    'timestamp' => $delivery->signature->created_at->format('Y-m-d H:i:s')
                ];
            }

            // Get photos data
            $photos = [];
            foreach ($delivery->photos as $photo) {
                $photos[] = [
                    'id' => $photo->id,
                    'type' => $this->formatPhotoType($photo->photo_type),
                    'url' => $photo->getPhotoUrl(),
                    'thumbnail_url' => $photo->getThumbnailUrl(),
                    'dimensions' => $photo->getImageDimensions(),
                    'file_size' => $photo->getFileSizeFormatted(),
                    'has_gps' => $photo->hasGPSData(),
                    'gps_location' => $photo->getGPSLocation(),
                    'taken_at' => $photo->created_at->format('Y-m-d H:i:s')
                ];
            }

            // Get shipment information
            $shipmentInfo = $this->prepareShipmentInfo($delivery);

            // Calculate delivery stats
            $deliveryStats = $this->calculateDeliveryStats($delivery, $deliveryTime);

            // Get GPS information
            $gpsInfo = $this->prepareGPSInfo($delivery);

            // Get verification status
            $verificationStatus = $this->getVerificationStatus($delivery);

            // Prepare customer information
            $customerInfo = $this->prepareCustomerInfo($delivery);

            // Prepare delivery personnel information
            $driverInfo = $this->prepareDriverInfo($delivery);

            return [
                // Header information
                'delivery_note_id' => 'DN-' . str_pad($delivery->id, 6, '0', STR_PAD_LEFT),
                'shipment_id' => $shipmentInfo['shipment_id'],
                'shipment_reference' => $shipmentInfo['reference'],
                'generated_at' => $now->format('Y-m-d H:i:s'),
                'generated_date' => $now->format('F j, Y'),
                'generated_time' => $now->format('g:i A'),
                
                // Company information
                'company' => array_merge($this->defaultTemplateData, $this->getCompanyInfo()),
                
                // Customer information
                'customer' => $customerInfo,
                
                // Delivery details
                'delivery_date' => $deliveryTime->format('F j, Y'),
                'delivery_time' => $deliveryTime->format('g:i A'),
                'recipient_name' => $delivery->recipient_name,
                'delivery_address' => $shipmentInfo['delivery_address'],
                'delivery_notes' => $delivery->delivery_notes,
                'status' => $this->formatDeliveryStatus($delivery->status),
                'status_color' => $this->getStatusColor($delivery->status),
                
                // Driver information
                'driver' => $driverInfo,
                
                // GPS information
                'gps' => $gpsInfo,
                
                // Signature information
                'signatures' => $signatures,
                'has_signature' => count($signatures) > 0,
                
                // Photo information
                'photos' => $photos,
                'photo_count' => count($photos),
                'photo_types' => array_unique(array_column($photos, 'type')),
                
                // Verification information
                'verification' => $verificationStatus,
                
                // Statistics
                'stats' => $deliveryStats,
                
                // Additional details
                'delivery_duration' => $deliveryTime->diffInMinutes(Carbon::parse($delivery->created_at)),
                'total_delivery_time' => $this->formatDeliveryTime($deliveryTime, Carbon::parse($delivery->created_at)),
                'sync_status' => $this->getSyncStatus($delivery),
                
                // Flags for template rendering
                'has_gps' => $gpsInfo['has_coordinates'],
                'has_photos' => count($photos) > 0,
                'has_signature' => count($signatures) > 0,
                'is_preview' => $isPreview,
                'data_integrity_verified' => $verificationStatus['hash_valid']
            ];

        } catch (Exception $e) {
            Log::error('Error preparing delivery data', [
                'delivery_id' => $delivery->id,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Process signature data for template
     */
    private function processSignatureData($signature): array
    {
        try {
            // Convert base64 signature data to image
            $signatureData = $signature->signature_data;
            
            // Remove data:image prefix if present
            $signatureData = preg_replace('#^data:image/\w+;base64,#i', '', $signatureData);
            
            // Decode base64
            $signatureImage = base64_decode($signatureData);
            
            if ($signatureImage === false) {
                throw new Exception('Invalid signature data');
            }

            // Save signature image temporarily
            $signatureFileName = 'signature_' . $signature->delivery_id . '_' . Str::random(8) . '.png';
            $tempDir = storage_path('app/temp/signatures');
            
            if (!is_dir($tempDir)) {
                mkdir($tempDir, 0755, true);
            }
            
            $signaturePath = $tempDir . '/' . $signatureFileName;
            file_put_contents($signaturePath, $signatureImage);

            // Get signature metrics
            $signatureMetrics = $signature->getSignatureMetrics();

            return [
                'image_path' => $signaturePath,
                'image_url' => 'data:image/png;base64,' . base64_encode($signatureImage),
                'width' => $signature->canvas_width,
                'height' => $signature->canvas_height,
                'type' => $signature->signature_type,
                'quality_score' => $signature->signature_quality,
                'is_valid_quality' => $signature->isValidQuality(),
                'integrity_verified' => $signature->verifyIntegrity(),
                'is_legally_valid' => $signature->isLegallyValid(),
                'stroke_count' => $signatureMetrics['stroke_count'],
                'canvas_aspect_ratio' => $signatureMetrics['canvas_aspect_ratio'],
                'device_credibility' => $signatureMetrics['device_credibility']
            ];

        } catch (Exception $e) {
            Log::error('Error processing signature data', [
                'signature_id' => $signature->id,
                'error' => $e->getMessage()
            ]);
            return [
                'image_url' => '',
                'error' => 'Failed to process signature: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Generate HTML template
     */
    private function generateHtmlTemplate(array $deliveryData): string
    {
        try {
            $html = $this->renderHeader($deliveryData);
            $html .= $this->renderDeliveryDetails($deliveryData);
            $html .= $this->renderSignatures($deliveryData);
            $html .= $this->renderPhotos($deliveryData);
            $html .= $this->renderGPSInfo($deliveryData);
            $html .= $this->renderVerification($deliveryData);
            $html .= $this->renderFooter($deliveryData);

            return $html;

        } catch (Exception $e) {
            Log::error('Error generating HTML template', [
                'delivery_note_id' => $deliveryData['delivery_note_id'],
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Generate PDF from HTML
     */
    private function generatePdf(string $htmlContent, DeliveryConfirmation $delivery, array $deliveryData): string
    {
        try {
            // Create output directory
            $outputDir = storage_path('app/' . self::CACHE_DIR);
            if (!is_dir($outputDir)) {
                mkdir($outputDir, 0755, true);
            }

            // Generate unique filename
            $pdfFileName = sprintf(
                'delivery_note_%d_%s.pdf',
                $delivery->id,
                Carbon::now()->format('Ymd_His')
            );

            $pdfPath = $outputDir . '/' . $pdfFileName;

            // Use DomPDF for PDF generation
            $dompdf = new \Dompdf\Dompdf([
                'defaultPaperSize' => 'A4',
                'defaultPaperOrientation' => 'portrait',
                'isPhpEnabled' => true,
                'isRemoteEnabled' => true,
                'tempDir' => storage_path('app/temp'),
                'fontDir' => storage_path('app/fonts'),
                'chroot' => realpath(storage_path())
            ]);

            // Update HTML to handle images properly
            $htmlContent = $this->processImagesForPdf($htmlContent, $deliveryData);

            $dompdf->loadHtml($htmlContent);
            $dompdf->render();
            
            // Save PDF to file
            file_put_contents($pdfPath, $dompdf->output());

            Log::info('PDF generated successfully', [
                'delivery_id' => $delivery->id,
                'pdf_path' => $pdfPath,
                'pdf_size' => filesize($pdfPath)
            ]);

            return $pdfPath;

        } catch (Exception $e) {
            Log::error('Error generating PDF from HTML', [
                'delivery_id' => $delivery->id,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    // Additional helper methods for template rendering, data formatting, etc.
    // Would continue with the complete implementation...

    /**
     * Get company information
     */
    private function getCompanyInfo(): array
    {
        // In a real application, this would fetch from configuration
        return [
            'name' => 'ShipmentApp Logistics',
            'address' => '456 Commerce Street, Business District, City 12345',
            'phone' => '+1 (555) 123-4567',
            'email' => 'support@shipmentapp.com',
            'website' => 'https://shipmentapp.com',
            'logo' => null, // Could be base64 encoded logo or URL
            'registration' => 'Business License #123456'
        ];
    }

    /**
     * Format delivery status
     */
    private function formatDeliveryStatus(string $status): string
    {
        return ucfirst(str_replace('_', ' ', $status));
    }

    /**
     * Get status color
     */
    private function getStatusColor(string $status): string
    {
        $colors = [
            'delivered' => 'success',
            'confirmed' => 'info',
            'pending' => 'warning',
            'failed' => 'danger',
            'returned' => 'danger'
        ];

        return $colors[$status] ?? 'secondary';
    }

    /**
     * Format photo type
     */
    private function formatPhotoType(string $type): string
    {
        return ucfirst(str_replace('_', ' ', $type));
    }

    /**
     * Get quality class
     */
    private function getQualityClass(float $quality): string
    {
        if ($quality >= 0.9) return 'excellent';
        if ($quality >= 0.85) return 'good';
        if ($quality >= 0.7) return 'acceptable';
        return 'poor';
    }

    /**
     * Prepare shipment information
     */
    private function prepareShipmentInfo(DeliveryConfirmation $delivery): array
    {
        $shipment = $delivery->shipment;
        
        return [
            'shipment_id' => $shipment->id ?? 'N/A',
            'reference' => $shipment->reference ?? 'N/A',
            'planned_date' => $shipment->planned_date ?? null,
            'delivery_address' => $this->formatAddress($shipment),
            'weight' => $shipment->weight ?? null,
            'weight_units' => $shipment->weight_units ?? 'kg'
        ];
    }

    /**
     * Format address
     */
    private function formatAddress($shipment): string
    {
        $parts = [];
        
        if ($shipment->address ?? false) $parts[] = $shipment->address;
        if ($shipment->city ?? false) $parts[] = $shipment->city;
        if ($shipment->zip ?? false) $parts[] = $shipment->zip;
        if ($shipment->country ?? false) $parts[] = $shipment->country;
        
        return implode(', ', $parts);
    }

    /**
     * Calculate delivery statistics
     */
    private function calculateDeliveryStats(DeliveryConfirmation $delivery, Carbon $deliveryTime): array
    {
        // Calculate various statistics and metrics
        $creationTime = Carbon::parse($delivery->created_at);
        $deliveryDuration = $creationTime->diffInMinutes($deliveryTime);
        
        return [
            'delivery_duration_minutes' => $deliveryDuration,
            'created_to_delivery_time' => $this->formatDuration($deliveryDuration),
            'signature_quality_score' => $delivery->signature->signature_quality ?? 0,
            'photo_count' => $delivery->photos()->count(),
            'synced_to_erp' => $delivery->isSyncedToErp(),
            'verification_valid' => $delivery->verifyIntegrity()
        ];
    }

    /**
     * Format duration
     */
    private function formatDuration(int $minutes): string
    {
        if ($minutes < 60) {
            return $minutes . ' minutes';
        } else {
            $hours = floor($minutes / 60);
            $remainingMinutes = $minutes % 60;
            return $hours . ' hours ' . ($remainingMinutes > 0 ? $remainingMinutes . ' minutes' : '');
        }
    }

    /**
     * Prepare GPS information
     */
    private function prepareGPSInfo(DeliveryConfirmation $delivery): array
    {
        $hasCoordinates = $delivery->gps_latitude && $delivery->gps_longitude;
        
        return [
            'has_coordinates' => $hasCoordinates,
            'latitude' => $delivery->gps_latitude,
            'longitude' => $delivery->gps_longitude,
            'accuracy' => $delivery->gps_accuracy ?? 5.0,
            'coordinates_text' => $hasCoordinates ? sprintf(
                '%.6f, %.6f',
                $delivery->gps_latitude,
                $delivery->gps_longitude
            ) : 'Not available',
            'map_url' => $hasCoordinates ? sprintf(
                'https://maps.google.com/maps?q=%.6f,%.6f',
                $delivery->gps_latitude,
                $delivery->gps_longitude
            ) : null,
            'verification_status' => $this->verifyGPSAccuracy($delivery)
        ];
    }

    /**
     * Verify GPS accuracy
     */
    private function verifyGPSAccuracy(DeliveryConfirmation $delivery): string
    {
        if (!$delivery->gps_accuracy) return 'unknown';
        
        if ($delivery->gps_accuracy <= 5) return 'excellent';
        if ($delivery->gps_accuracy <= 10) return 'good';
        if ($delivery->gps_accuracy <= 20) return 'acceptable';
        return 'poor';
    }

    /**
     * Get verification status
     */
    private function getVerificationStatus(DeliveryConfirmation $delivery): array
    {
        return [
            'hash_valid' => $delivery->verifyIntegrity(),
            'signature_valid' => $delivery->signature && $delivery->signature->isLegallyValid(),
            'has_required_elements' => $this->checkRequiredElements($delivery),
            'overall_status' => $this->calculateOverallVerificationStatus($delivery)
        ];
    }

    /**
     * Check required elements
     */
    private function checkRequiredElements(DeliveryConfirmation $delivery): bool
    {
        // Basic required elements: signature, recipient name, delivery time
        return !empty($delivery->recipient_name) && 
               $delivery->delivered_at && 
               $delivery->signature;
    }

    /**
     * Calculate overall verification status
     */
    private function calculateOverallVerificationStatus(DeliveryConfirmation $delivery): string
    {
        $checks = [
            'hash_valid' => $delivery->verifyIntegrity(),
            'has_signature' => $delivery->signature !== null,
            'signature_valid' => $delivery->signature && $delivery->signature->isLegallyValid(),
            'has_recipient' => !empty($delivery->recipient_name),
            'has_delivery_time' => $delivery->delivered_at !== null
        ];

        $passedChecks = array_sum($checks);
        $totalChecks = count($checks);

        $score = $passedChecks / $totalChecks;

        if ($score >= 1.0) return 'verified';
        if ($score >= 0.8) return 'mostly_verified';
        if ($score >= 0.6) return 'partially_verified';
        return 'verification_required';
    }

    /**
     * Prepare customer information
     */
    private function prepareCustomerInfo(DeliveryConfirmation $delivery): array
    {
        $shipment = $delivery->shipment;
        
        return [
            'name' => $delivery->recipient_name,
            'company' => $shipment->customer_name ?? 'N/A',
            'address' => $this->formatAddress($shipment),
            'contact' => $shipment->customer_contact ?? 'N/A'
        ];
    }

    /**
     * Prepare driver information
     */
    private function prepareDriverInfo(DeliveryConfirmation $delivery): array
    {
        $driver = $delivery->user;
        
        return [
            'name' => $driver->name ?? 'Unknown Driver',
            'id' => $driver->id ?? 'N/A',
            'employee_id' => $driver->employee_id ?? 'N/A',
            'vehicle' => $delivery->shipment->vehicle_info ?? 'N/A'
        ];
    }

    /**
     * Calculate delivery time
     */
    private function formatDeliveryTime(Carbon $deliveryTime, Carbon $creationTime): string
    {
        return $deliveryTime->diffForHumans($creationTime, true);
    }

    /**
     * Get sync status
     */
    private function getSyncStatus(DeliveryConfirmation $delivery): array
    {
        $isSynced = $delivery->isSyncedToErp();
        
        return [
            'synced' => $isSynced,
            'synced_at' => $delivery->erp_sync_timestamp,
            'status' => $isSynced ? 'synchronized' : 'pending_sync',
            'color' => $isSynced ? 'success' : 'warning'
        ];
    }

    /**
     * Calculate PDF checksum
     */
    private function calculatePdfChecksum(string $pdfPath): string
    {
        try {
            return hash('sha256', file_get_contents($pdfPath));
        } catch (Exception $e) {
            Log::error('Error calculating PDF checksum', ['error' => $e->getMessage()]);
            return 'error_calculating_checksum';
        }
    }

    /**
     * Get PDF URL
     */
    private function getPdfUrl(string $pdfPath): string
    {
        try {
            // Convert file system path to storage URL
            $relativePath = str_replace(storage_path('app/'), '', $pdfPath);
            return Storage::url($relativePath);
        } catch (Exception $e) {
            Log::error('Error generating PDF URL', ['error' => $e->getMessage()]);
            return 'error_generating_url';
        }
    }

    /**
     * Delete existing delivery note
     */
    public function deleteExistingDeliveryNote(DeliveryConfirmation $delivery): bool
    {
        try {
            // Find existing delivery note files
            $pdfDir = storage_path('app/' . self::CACHE_DIR);
            $pattern = sprintf('delivery_note_%d_*.pdf', $delivery->id);
            $existingFiles = glob($pdfDir . '/' . $pattern);

            $deletedCount = 0;
            foreach ($existingFiles as $file) {
                if (unlink($file)) {
                    $deletedCount++;
                } else {
                    Log::warning('Failed to delete existing delivery note file', ['file' => $file]);
                }
            }

            Log::info('Deleted existing delivery note files', [
                'delivery_id' => $delivery->id,
                'files_deleted' => $deletedCount
            ]);

            return $deletedCount > 0;

        } catch (Exception $e) {
            Log::error('Error deleting existing delivery note', [
                'delivery_id' => $delivery->id,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Get delivery note file
     */
    public function getDeliveryNoteFile(DeliveryConfirmation $delivery): ?string
    {
        try {
            $pdfDir = storage_path('app/' . self::CACHE_DIR);
            $pattern = sprintf('delivery_note_%d_*.pdf', $delivery->id);
            $existingFiles = glob($pdfDir . '/' . $pattern);

            if (empty($existingFiles)) {
                return null;
            }

            // Return the most recent file
            usort($existingFiles, function($a, $b) {
                return filemtime($b) - filemtime($a);
            });

            return $existingFiles[0];

        } catch (Exception $e) {
            Log::error('Error getting delivery note file', [
                'delivery_id' => $delivery->id,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Get delivery note data
     */
    public function getDeliveryNoteData(DeliveryConfirmation $delivery): ?array
    {
        try {
            $pdfFile = $this->getDeliveryNoteFile($delivery);
            
            if (!$pdfFile) {
                return null;
            }

            $deliveryData = $this->prepareDeliveryData($delivery);

            return [
                'delivery_note_id' => 'DN-' . str_pad($delivery->id, 6, '0', STR_PAD_LEFT),
                'delivery_id' => $delivery->id,
                'pdf_url' => $this->getPdfUrl($pdfFile),
                'pdf_path' => $pdfFile,
                'file_size' => filesize($pdfFile),
                'checksum' => $this->calculatePdfChecksum($pdfFile),
                'generated_at' => date('Y-m-d H:i:s', filemtime($pdfFile)),
                'expires_at' => Carbon::parse(date('Y-m-d H:i:s', filemtime($pdfFile)))->addSeconds(self::PDF_TTL)->toISOString(),
                'delivery_data' => $deliveryData
            ];

        } catch (Exception $e) {
            Log::error('Error getting delivery note data', [
                'delivery_id' => $delivery->id,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Get delivery note statistics
     */
    public function getDeliveryNoteStats(array $filters = []): array
    {
        try {
            // Get total delivery count from filters
            $deliveryQuery = \App\Models\DeliveryConfirmation::query();
            
            if (isset($filters['user_id'])) {
                $deliveryQuery->where('user_id', $filters['user_id']);
            }
            
            if (isset($filters['date_from'])) {
                $deliveryQuery->whereDate('created_at', '>=', $filters['date_from']);
            }
            
            if (isset($filters['date_to'])) {
                $deliveryQuery->whereDate('created_at', '<=', $filters['date_to']);
            }

            $totalDeliveries = $deliveryQuery->count();
            
            // Count deliveries with generated notes
            $notesGenerated = 0;
            $pdfDir = storage_path('app/' . self::CACHE_DIR);
            
            if (is_dir($pdfDir)) {
                $pdfFiles = glob($pdfDir . '/*.pdf');
                $notesGenerated = count($pdfFiles);
            }

            // Calculate file sizes
            $totalStorageSize = 0;
            if (is_dir($pdfDir)) {
                $pdfFiles = glob($pdfDir . '/*.pdf');
                foreach ($pdfFiles as $file) {
                    $totalStorageSize += filesize($file);
                }
            }

            return [
                'total_deliveries' => $totalDeliveries,
                'notes_generated' => $notesGenerated,
                'notes_not_generated' => $totalDeliveries - $notesGenerated,
                'generation_rate' => $totalDeliveries > 0 ? round(($notesGenerated / $totalDeliveries) * 100, 2) : 0,
                'total_storage_size' => $totalStorageSize,
                'formatted_storage_size' => $this->formatFileSize($totalStorageSize),
                'average_pdf_size' => $notesGenerated > 0 ? round($totalStorageSize / $notesGenerated) : 0
            ];

        } catch (Exception $e) {
            Log::error('Error getting delivery note statistics', [
                'error' => $e->getMessage()
            ]);
            return [
                'error' => 'Failed to calculate statistics: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Process images for PDF generation
     */
    private function processImagesForPdf(string $htmlContent, array $deliveryData): string
    {
        try {
            // Convert images to embeddable format for PDF
            foreach ($deliveryData['photos'] as $photo) {
                if (isset($photo['url']) && !str_starts_with($photo['url'], 'data:')) {
                    $imageData = $this->convertImageToBase64($photo['url']);
                    if ($imageData) {
                        $htmlContent = str_replace($photo['url'], $imageData, $htmlContent);
                    }
                }
            }

            // Process signature images
            foreach ($deliveryData['signatures'] as $signature) {
                if (isset($signature['image_url']) && str_starts_with($signature['image_url'], 'data:')) {
                    // Already embedded, no action needed
                }
            }

            return $htmlContent;

        } catch (Exception $e) {
            Log::error('Error processing images for PDF', ['error' => $e->getMessage()]);
            return $htmlContent; // Return original HTML on error
        }
    }

    /**
     * Convert image to base64
     */
    private function convertImageToBase64(string $imageUrl): ?string
    {
        try {
            // For local storage files, read directly
            if (str_contains($imageUrl, '/storage/')) {
                $relativePath = str_replace('/storage/', '', $imageUrl);
                $fullPath = storage_path('app/public/' . $relativePath);
                
                if (file_exists($fullPath)) {
                    $imageData = file_get_contents($fullPath);
                    $mimeType = mime_content_type($fullPath);
                    return 'data:' . $mimeType . ';base64,' . base64_encode($imageData);
                }
            }

            return null;

        } catch (Exception $e) {
            Log::error('Error converting image to base64', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Format file size
     */
    private function formatFileSize(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $unitIndex = 0;

        while ($bytes >= 1024 && $unitIndex < count($units) - 1) {
            $bytes /= 1024;
            $unitIndex++;
        }

        return round($bytes, 1) . ' ' . $units[$unitIndex];
    }

    // Additional methods for HTML template rendering would continue...
    // These would include: renderHeader(), renderDeliveryDetails(), renderSignatures(),
    // renderPhotos(), renderGPSInfo(), renderVerification(), renderFooter()
    // For brevity, these are not included but would be implemented in production

    /**# Render Methods (Simplified for implementation)
     * Render delivery note header
     */
    private function renderHeader(array $data): string
    {
        return <<<HTML
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Delivery Note {$data['delivery_note_id']}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                .company-info { float: right; text-align: right; }
                .delivery-info { margin-bottom: 30px; }
                .section { margin-bottom: 25px; }
                .signature-box { border: 1px solid #ddd; padding: 10px; margin: 10px 0; }
                .photo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
                .photo-item { text-align: center; }
                .verification-status { padding: 10px; border-radius: 5px; }
                .success { background-color: #d4edda; border-color: #c3e6cb; color: #155724; }
                .warning { background-color: #fff3cd; border-color: #ffeaa7; color: #856404; }
                .danger { background-color: #f8d7da; border-color: #f5c6cb; color: #721c24; }
            </style>
        </head>
        <body>
        HTML;
    }

    /**# Render Methods (Simplified for implementation)
     * Render delivery details section
     */
    private function renderDeliveryDetails(array $data): string
    {
        return <<<HTML
        <div class="header">
            <div class="company-info">
                <h2>{$data['company']['name']}</h2>
                <p>{$data['company']['address']}</p>
                <p>Phone: {$data['company']['phone']}</p>
                <p>Email: {$data['company']['email']}</p>
            </div>
            <h1>Delivery Note #{$data['delivery_note_id']}</h1>
            <p><strong>Delivery Date:</strong> {$data['delivery_date']}</p>
            <p><strong>Delivery Time:</strong> {$data['delivery_time']}</p>
            <p><strong>Generated:</strong> {$data['generated_at']}</p>
        </div>
        
        <div class="section delivery-info">
            <h2>Delivery Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Shipment ID:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{$data['shipment_id']}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Reference:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{$data['shipment_reference']}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Recipient:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{$data['recipient_name']}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Address:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{$data['delivery_address']}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Status:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{$data['status']}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Driver:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{$data['driver']['name']}</td></tr>
            </table>
        </div>
        HTML;
    }

    /**# Render Methods (Simplified for implementation)
     * Render signatures section
     */
    private function renderSignatures(array $data): string
    {
        if (!$data['has_signature']) {
            return '<div class="section"><h2>Signature</h2><p>No digital signature captured.</p></div>';
        }

        $signatureHtml = '';
        foreach ($data['signatures'] as $signature) {
            $signatureHtml .= <<<HTML
            <div class="signature-box">
                <h4>Digital Signature</h4>
                <div style="text-align: center; margin: 10px 0;">
                    <img src="{$signature['image_url']}" alt="Delivery Signature" style="max-width: 300px; border: 1px solid #ccc;">
                </div>
                <p><strong>Quality Score:</strong> {$signature['quality_score']} {$signature['quality']}</p>
                <p><strong>Legal Validity:</strong> {$signature['is_legally_valid'] ? 'Valid' : 'Invalid'}</p>
                <p><strong>Type:</strong> {$signature['type']}</p>
                <p><strong>Time:</strong> {$signature['timestamp']}</p>
            </div>
            HTML;
        }

        return <<<HTML
        <div class="section">
            <h2>Delivery Signature</h2>
            {$signatureHtml}
        </div>
        HTML;
    }

    /**# Render Methods (Simplified for implementation)
     * Render photos section
     */
    private function renderPhotos(array $data): string
    {
        if (!$data['has_photos']) {
            return '<div class="section"><h2>Delivery Photos</h2><p>No photos were captured for this delivery.</p></div>';
        }

        $photosHtml = '<div class="photo-grid">';
        foreach ($data['photos'] as $photo) {
            $photosHtml .= <<<HTML
            <div class="photo-item">
                <img src="{$photo['thumbnail_url']}" alt="{$photo['type']}" style="max-width: 200px; height: 150px; object-fit: cover; border: 1px solid #ddd;">
                <p><strong>{$photo['type']}</strong></p>
                <p>Size: {$photo['file_size']}</p>
                <p>Dimensions: {$photo['dimensions']['width']}x{$photo['dimensions']['height']}</p>
            </div>
            HTML;
        }
        $photosHtml .= '</div>';

        return <<<HTML
        <div class="section">
            <h2>Delivery Photos ({$data['photo_count']})</h2>
            {$photosHtml}
        </div>
        HTML;
    }

    /**# Render Methods (Simplified for implementation)
     * Render GPS information section
     */
    private function renderGPSInfo(array $data): string
    {
        if (!$data['has_gps']) {
            return '<div class="section"><h2>GPS Location</h2><p>GPS coordinates not available for this delivery.</p></div>';
        }

        $gps = $data['gps'];
        
        return <<<HTML
        <div class="section">
            <h2>GPS Location</h2>
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Latitude:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{$gps['latitude']}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Longitude:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{$gps['longitude']}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Accuracy:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{$gps['accuracy']} meters</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Location:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{$gps['coordinates_text']}</td></tr>
            </table>
        </div>
        HTML;
    }

    /**# Render Methods (Simplified for implementation)
     * Render verification section
     */
    private function renderVerification(array $data): string
    {
        $verification = $data['verification'];
        $statusClass = $verification['overall_status'] === 'verified' ? 'success' : 
                      ($verification['overall_status'] === 'verification_required' ? 'danger' : 'warning');

        $verificationHtml = <<<HTML
        <div class="verification-status {$statusClass}">
            <h3>Verification Status</h3>
            <p><strong>Overall Status:</strong> {$verification['overall_status']}</p>
            <p><strong>Data Integrity:</strong> {$verification['hash_valid'] ? 'Verified' : 'Modified'}</p>
            <p><strong>Signature Validity:</strong> {$verification['signature_valid'] ? 'Valid' : 'Invalid/Suspicious'}</p>
            <p><strong>Required Elements:</strong> {$verification['has_required_elements'] ? 'Complete' : 'Missing Data'}</p>
        </div>
        HTML;

        return <<<HTML
        <div class="section">
            <h2>Verification</h2>
            {$verificationHtml}
        </div>
        HTML;
    }

    /**# Render Methods (Simplified for implementation)
     * Render footer
     */
    private function renderFooter(array $data): string
    {
        $sync = $data['sync_status'];
        
        return <<<HTML
        <div class="section" style="border-top: 2px solid #333; padding-top: 20px; margin-top: 30px;">
            <p><em>This delivery note was automatically generated by the ShipmentApp system.</em></p>
            <p><strong>Generated on:</strong> {$data['generated_at']}</p>
            <p><strong>ERP Sync Status:</strong> <span class="{$sync['color']}">{$sync['status']}</span></p>
            <p><strong>Delivery Note ID:</strong> {$data['delivery_note_id']}</p>
            <p style="font-size: 11px; color: #666; margin-top: 20px;">
                This document is electronically generated and contains digital signature verification. 
                Presence of the verification hash: {$data['verification']['hash_valid'] ? 'VERIFIED' : 'NOT VERIFIED'}
            </p>
        </div>
        </body>
        </html>
        HTML;
    }
}