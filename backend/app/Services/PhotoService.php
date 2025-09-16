<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Exception;
use Intervention\Image\Facades\Image;

/**
 * Service for handling photo upload, processing, optimization, and storage.
 */
class PhotoService
{
    private const MAX_FILE_SIZE = 5242880; // 5MB
    private const THUMBNAIL_WIDTH = 300;
    private const THUMBNAIL_HEIGHT = 200;
    private const SUPPORTED_FORMATS = ['jpg', 'jpeg', 'png', 'gif'];
    private const QUALITY = 85;

    /**
     * Process and upload photo
     */
    public function processPhoto($file, array $options = []): array
    {
        try {
            // Validate file
            $validation = $this->validateUploadedFile($file);
            if (!$validation['valid']) {
                throw new Exception('Invalid uploaded file: ' . implode(', ', $validation['errors']));
            }

            // Get file information
            $fileInfo = $this->getFileInfo($file);
            
            // Create optimized versions
            $processedVersions = $this->createOptimizedVersions($file, $fileInfo, $options);

            // Store files
            $storageResults = $this->storeFiles($processedVersions, $fileInfo, $options);

            // Extract metadata
            $metadata = $this->extractMetadata($file, $fileInfo);

            return [
                'success' => true,
                'original' => $storageResults['original'],
                'thumbnail' => $storageResults['thumbnail'] ?? null,
                'optimized' => $storageResults['optimized'] ?? null,
                'metadata' => $metadata,
                'size_reduction' => $this->calculateSizeReduction($fileInfo['size'] ?? 0, $storageResults)
            ];

        } catch (Exception $e) {
            Log::error('Error processing photo', ['error' => $e->getMessage()]);
            
            // Cleanup any stored files on error
            $this->cleanupOnError($storageResults ?? []);
            
            throw $e;
        }
    }

    /**
     * Create thumbnail from uploaded image
     */
    public function createThumbnail(string $sourcePath): string
    {
        try {
            $fullSourcePath = storage_path('app/public/' . $sourcePath);
            
            if (!file_exists($fullSourcePath)) {
                throw new Exception('Source file not found: ' . $fullSourcePath);
            }

            // Generate thumbnail path
            $thumbnailPath = str_replace('delivery_photos/', 'delivery_photos/thumbnails/', $sourcePath);
            $fullThumbnailPath = storage_path('app/public/' . $thumbnailPath);

            // Create thumbnail directory
            $thumbnailDir = dirname($fullThumbnailPath);
            if (!is_dir($thumbnailDir)) {
                mkdir($thumbnailDir, 0755, true);
            }

            // Process and resize image
            $image = Image::make($fullSourcePath);
            
            // Resize to thumbnail dimensions while maintaining aspect ratio
            $image->fit(self::THUMBNAIL_WIDTH, self::THUMBNAIL_HEIGHT, function ($constraint) {
                $constraint->upsize();
            });

            // Optimize quality
            $image->encode('jpg', self::QUALITY);

            // Save thumbnail
            $image->save($fullThumbnailPath);

            Log::info('Thumbnail created successfully', [
                'source' => $sourcePath,
                'thumbnail' => $thumbnailPath,
                'dimensions' => $image->width() . 'x' . $image->height(),
                'size' => filesize($fullThumbnailPath)
            ]);

            return $thumbnailPath;

        } catch (Exception $e) {
            Log::error('Error creating thumbnail', [
                'source' => $sourcePath,
                'error' => $e->getMessage()
            ]);
            throw new Exception('Failed to create thumbnail: ' . $e->getMessage());
        }
    }

    /**
     * Create optimized version of image
     */
    public function createOptimizedVersion(string $sourcePath, int $maxWidth = 1200, int $maxHeight = 800): string
    {
        try {
            $fullSourcePath = storage_path('app/public/' . $sourcePath);
            
            if (!file_exists($fullSourcePath)) {
                throw new Exception('Source file not found: ' . $fullSourcePath);
            }

            // Generate optimized path
            $optimizedPath = str_replace('.', '_optimized.', $sourcePath);
            $fullOptimizedPath = storage_path('app/public/' . $optimizedPath);

            // Create optimized directory
            $optimizedDir = dirname($fullOptimizedPath);
            if (!is_dir($optimizedDir)) {
                mkdir($optimizedDir, 0755, true);
            }

            // Process image
            $image = Image::make($fullSourcePath);
            $originalWidth = $image->width();
            $originalHeight = $image->height();

            // Only resize if image is larger than max dimensions
            if ($originalWidth > $maxWidth || $originalHeight > $maxHeight) {
                // Calculate scaling factor
                $widthRatio = $maxWidth / $originalWidth;
                $heightRatio = $maxHeight / $originalHeight;
                $scale = min($widthRatio, $heightRatio);

                $newWidth = round($originalWidth * $scale);
                $newHeight = round($originalHeight * $scale);

                $image->resize($newWidth, $newHeight, function ($constraint) {
                    $constraint->aspectRatio();
                    $constraint->upsize();
                });
            }

            // Apply optimization
            $image->encode('jpg', self::QUALITY);

            // Strip metadata for smaller file size
            $image->strip();

            // Save optimized version
            $image->save($fullOptimizedPath);

            Log::info('Optimized version created successfully', [
                'source' => $sourcePath,
                'optimized' => $optimizedPath,
                'reduction_percentage' => round((1 - filesize($fullOptimizedPath) / filesize($fullSourcePath)) * 100, 1)
            ]);

            return $optimizedPath;

        } catch (Exception $e) {
            Log::error('Error creating optimized version', [
                'source' => $sourcePath,
                'error' => $e->getMessage()
            ]);
            throw new Exception('Failed to create optimized version: ' . $e->getMessage());
        }
    }

    /**
     * Validate uploaded file
     */
    public function validateUploadedFile($file): array
    {
        $valid = true;
        $errors = [];

        try {
            if (!$file) {
                $errors[] = 'No file provided';
                $valid = false;
                return ['valid' => $valid, 'errors' => $errors];
            }

            if (!$file->isValid()) {
                $errors[] = 'File upload failed';
                $valid = false;
                return ['valid' => $valid, 'errors' => $errors];
            }

            // Check file size
            if ($file->getSize() > self::MAX_FILE_SIZE) {
                $errors[] = 'File size exceeds maximum allowed size (5MB)';
                $valid = false;
            }

            // Check file type
            $extension = strtolower($file->getClientOriginalExtension());
            if (!in_array($extension, self::SUPPORTED_FORMATS)) {
                $errors[] = 'Unsupported file format. Allowed formats: ' . implode(', ', self::SUPPORTED_FORMATS);
                $valid = false;
            }

            // Additional MIME type check
            $mimeType = $file->getMimeType();
            if (!$this->isSupportedMimeType($mimeType)) {
                $errors[] = 'Unsupported MIME type: ' . $mimeType;
                $valid = false;
            }

            return ['valid' => $valid, 'errors' => $errors];

        } catch (Exception $e) {
            Log::error('Error validating uploaded file', ['error' => $e->getMessage()]);
            return ['valid' => false, 'errors' => ['Validation error: ' . $e->getMessage()]];
        }
    }

    /**
     * Get file information
     */
    private function getFileInfo($file): array
    {
        try {
            return [
                'name' => $file->getClientOriginalName(),
                'size' => $file->getSize(),
                'type' => $file->getMimeType(),
                'extension' => strtolower($file->getClientOriginalExtension()),
                'filename' => pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME)
            ];

        } catch (Exception $e) {
            Log::error('Error getting file info', ['error' => $e->getMessage()]);
            throw new Exception('Failed to get file information');
        }
    }

    /**
     * Create optimized versions of the photo
     */
    private function createOptimizedVersions($file, array $fileInfo, array $options): array
    {
        $versions = [];

        try {
            // Always create original version
            $originalPath = $file->store(
                $options['directory'] ?? 'photos',
                $options['disk'] ?? 'public'
            );

            $versions['original'] = [
                'path' => $originalPath,
                'size' => $fileInfo['size']
            ];

            // Create thumbnail if requested
            if ($options['create_thumbnail'] ?? true) {
                $thumbnailPath = $this->createThumbnail($originalPath);
                $fullThumbnailPath = storage_path('app/public/' . $thumbnailPath);
                
                $versions['thumbnail'] = [
                    'path' => $thumbnailPath,
                    'size' => file_exists($fullThumbnailPath) ? filesize($fullThumbnailPath) : 0
                ];
            }

            // Create optimized version if requested
            if ($options['create_optimized'] ?? true) {
                $optimizedPath = $this->createOptimizedVersion(
                    $originalPath,
                    $options['max_width'] ?? 1200,
                    $options['max_height'] ?? 800
                );
                
                $fullOptimizedPath = storage_path('app/public/' . $optimizedPath);
                
                $versions['optimized'] = [
                    'path' => $optimizedPath,
                    'size' => file_exists($fullOptimizedPath) ? filesize($fullOptimizedPath) : 0
                ];
            }

            return $versions;

        } catch (Exception $e) {
            Log::error('Error creating optimized versions', ['error' => $e->getMessage()]);
            throw $e;
        }
    }

    /**
     * Store files and return storage results
     */
    private function storeFiles(array $versions, array $fileInfo, array $options): array
    {
        $results = [];

        try {
            foreach ($versions as $type => $version) {
                $results[$type] = [
                    'path' => $version['path'],
                    'size' => $version['size'],
                    'url' => Storage::url($version['path']),
                    'metadata' => $this->getImageMetadata($version['path'])
                ];
            }

            return $results;

        } catch (Exception $e) {
            Log::error('Error storing files', ['error' => $e->getMessage()]);
            throw $e;
        }
    }

    /**
     * Extract metadata from photo file
     */
    private function extractMetadata($file, array $fileInfo): array
    {
        try {
            $metadata = [
                'original' => [
                    'name' => $fileInfo['name'],
                    'size' => $fileInfo['size'],
                    'type' => $fileInfo['type'],
                    'extension' => $fileInfo['extension']
                ],
                'extracted' => []
            ];

            // Get EXIF data and additional metadata
            $exifData = $this->getExifData($file->getRealPath());
            if ($exifData) {
                $metadata['exif'] = $exifData;
            }

            // Get image dimensions
            $imageInfo = getimagesize($file->getRealPath());
            if ($imageInfo !== false) {
                $metadata['dimensions'] = [
                    'width' => $imageInfo[0],
                    'height' => $imageInfo[1],
                    'aspect_ratio' => round($imageInfo[0] / $imageInfo[1], 2)
                ];
            }

            return $metadata;

        } catch (Exception $e) {
            Log::error('Error extracting metadata', ['error' => $e->getMessage()]);
            return [
                'original' => [
                    'name' => $fileInfo['name'],
                    'size' => $fileInfo['size']
                ]
            ];
        }
    }

    /**
     * Get EXIF data from image file
     */
    private function getExifData(string $filePath): array
    {
        try {
            if (!function_exists('exif_read_data')) {
                return [];
            }

            $exif = @exif_read_data($filePath);
            if (!$exif) {
                return [];
            }

            return [
                'camera_make' => $exif['Make'] ?? null,
                'camera_model' => $exif['Model'] ?? null,
                'taken_at' => isset($exif['DateTime']) ? date('Y-m-d H:i:s', strtotime($exif['DateTime'])) : null,
                'iso' => $exif['ISOSpeedRatings'] ?? null,
                'f_number' => $exif['FNumber'] ?? null,
                'exposure_time' => $exif['ExposureTime'] ?? null,
                'gps_latitude' => $this->getExifGpsData($exif, 'GPSLatitude'),
                'gps_longitude' => $this->getExifGpsData($exif, 'GPSLongitude'),
                'gps_altitude' => $this->getExifGpsData($exif, 'GPSAltitude')
            ];

        } catch (Exception $e) {
            return [];
        }
    }

    /**
     * Get GPS data from EXIF
     */
    private function getExifGpsData(array $exif, string $field): float|null
    {
        try {
            if (isset($exif[$field])) {
                $gpsData = $exif[$field];
                if (is_array($gpsData) && count($gpsData) >= 3) {
                    $degrees = $this->convertExifGps($gpsData[0]);
                    $minutes = $this->convertExifGps($gpsData[1]);
                    $seconds = $this->convertExifGps($gpsData[2]);
                    
                    return $degrees + ($minutes / 60) + ($seconds / 3600);
                }
            }
            return null;

        } catch (Exception $e) {
            return null;
        }
    }

    /**
     * Convert EXIF GPS fraction to decimal
     */
    private function convertExifGps($fraction)
       {
        try {
            if (is_array($fraction)) {
                return $fraction[0] / $fraction[1];
            }
            return (float)$fraction;

        } catch (Exception $e) {
            return 0.0;
        }
    }

    /**
     * Get image metadata from stored file
     */
    private function getImageMetadata(string $path): array
    {
        try {
            $fullPath = storage_path('app/public/' . $path);
            
            if (!file_exists($fullPath)) {
                return [];
            }

            $fileSize = filesize($fullPath);
            $imageInfo = getimagesize($fullPath);

            return [
                'size' => $fileSize,
                'format' => explode('/', $imageInfo['mime'] ?? 'unknown')[1] ?? 'unknown',
                'dimensions' => [
                    'width' => $imageInfo[0] ?? 0,
                    'height' => $imageInfo[1] ?? 0
                ],
                'formatted_size' => $this->formatFileSize($fileSize)
            ];

        } catch (Exception $e) {
            return [
                'size' => 0,
                'format' => 'unknown'
            ];
        }
    }

    /**
     * Check MIME type support
     */
    private function isSupportedMimeType(string $mimeType): bool
    {
        $supportedTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif'
        ];

        return in_array($mimeType, $supportedTypes);
    }

    /**
     * Calculate size reduction percentage
     */
    private function calculateSizeReduction(int $originalSize, array $storageResults): array
       {
        try {
            $reductions = [];

            if (isset($storageResults['original'])) {
                $reductions['original'] = 0;
            }

            if (isset($storageResults['thumbnail'])) {
                $thumbnailSize = $storageResults['thumbnail']['size'] ?? 0;
                $reductions['thumbnail'] = $originalSize > 0 ? 
                    round((1 - $thumbnailSize / $originalSize) * 100, 1) : 0;
            }

            if (isset($storageResults['optimized'])) {
                $optimizedSize = $storageResults['optimized']['size'] ?? 0;
                $reductions['optimized'] = $originalSize > 0 ? 
                    round((1 - $optimizedSize / $originalSize) * 100, 1) : 0;
            }

            return $reductions;

        } catch (Exception $e) {
            return [];
        }
    }

    /**
     * Format file size for display
     */
    private function formatFileSize(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $index = 0;

        while ($bytes >= 1024 && $index < count($units) - 1) {
            $bytes /= 1024;
            $index++;
        }

        return round($bytes, 1) . ' ' . $units[$index];
    }

    /**
     * Cleanup files on processing error
     */
    private function cleanupOnError(array $storageResults): void
    {
        try {
            foreach ($storageResults as $type => $fileData) {
                if (isset($fileData['path'])) {
                    Storage::delete($fileData['path']);
                }
            }
        } catch (Exception $e) {
            Log::error('Error cleaning up files', ['error' => $e->getMessage()]);
        }
    }
}