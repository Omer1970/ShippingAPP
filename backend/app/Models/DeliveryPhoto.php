<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class DeliveryPhoto extends Model
{
    use HasFactory;

    protected $table = 'delivery_photos';

    protected $fillable = [
        'delivery_confirmation_id',
        'photo_path',
        'thumbnail_path',
        'photo_type',
        'gps_latitude',
        'gps_longitude',
        'photo_metadata',
        'file_size',
        'image_dimensions',
    ];

    protected $casts = [
        'photo_metadata' => 'json',
        'image_dimensions' => 'json',
        'file_size' => 'integer',
        'gps_latitude' => 'decimal:8',
        'gps_longitude' => 'decimal:8',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $attributes = [
        'photo_type' => 'delivery_proof',
        'image_dimensions' => '{}',
        'photo_metadata' => '{}',
    ];

    const PHOTO_TYPES = [
        'delivery_proof' => 'delivery_proof',
        'site_photo' => 'site_photo',
        'issue_documentation' => 'issue_documentation'
    ];

    public function deliveryConfirmation(): BelongsTo
    {
        return $this->belongsTo(DeliveryConfirmation::class, 'delivery_confirmation_id');
    }

    public function getPhotoMetadataAttribute($value)
    {
        return collect(json_decode($value, true) ?? []);
    }

    public function setPhotoMetadataAttribute($value): void
    {
        $this->attributes['photo_metadata'] = json_encode($value);
    }

    public function getImageDimensionsAttribute($value)
    {
        return json_decode($value, true) ?? [];
    }

    public function setImageDimensionsAttribute($value): void
    {
        $this->attributes['image_dimensions'] = json_encode($value);
    }

    public function isDeliveryProof(): bool
    {
        return $this->photo_type === self::PHOTO_TYPES['delivery_proof'];
    }

    public function isSitePhoto(): bool
    {
        return $this->photo_type === self::PHOTO_TYPES['site_photo'];
    }

    public function isIssueDocumentation(): bool
    {
        return $this->photo_type === self::PHOTO_TYPES['issue_documentation'];
    }

    public function getPhotoUrl(): ?string
    {
        return Storage::exists($this->photo_path) ? Storage::url($this->photo_path) : null;
    }

    public function getThumbnailUrl(): ?string
    {
        return Storage::exists($this->thumbnail_path) ? Storage::url($this->thumbnail_path) : null;
    }

    public function getImageDimensions(): array
    {
        $dimensions = $this->getImageDimensionsAttribute($this->image_dimensions);
        
        return [
            'width' => $dimensions['width'] ?? null,
            'height' => $dimensions['height'] ?? null,
            'aspect_ratio' => $this->getAspectRatio()
        ];
    }

    public function getAspectRatio(): ?float
    {
        $dimensions = $this->getImageDimensionsAttribute($this->image_dimensions);
        $width = $dimensions['width'] ?? 0;
        $height = $dimensions['height'] ?? 0;
        
        if ($height === 0) {
            return null;
        }
        
        return round($width / $height, 2);
    }

    public function getFileSizeFormatted(): string
    {
        $bytes = $this->file_size;
        
        if ($bytes >= 1073741824) {
            return round($bytes / 1073741824, 2) . ' GB';
        } elseif ($bytes >= 1048576) {
            return round($bytes / 1048576, 2) . ' MB';
        } elseif ($bytes >= 1024) {
            return round($bytes / 1024, 2) . ' KB';
        } else {
            return $bytes . ' Bytes';
        }
    }

    public function hasGPSData(): bool
    {
        return !is_null($this->gps_latitude) && !is_null($this->gps_longitude);
    }

    public function getGPSLocation(): ?array
    {
        if (!$this->hasGPSData()) {
            return null;
        }

        return [
            'latitude' => $this->gps_latitude,
            'longitude' => $this->gps_longitude,
            'accuracy' => 5.0 // Default accuracy
        ];
    }

    public function deletePhotoFiles(): bool
    {
        try {
            if ($this->photo_path && Storage::exists($this->photo_path)) {
                Storage::delete($this->photo_path);
            }

            if ($this->thumbnail_path && Storage::exists($this->thumbnail_path)) {
                Storage::delete($this->thumbnail_path);
            }

            return true;
        } catch (\Exception $e) {
            \Log::error('Failed to delete photo files', [
                'photo_id' => $this->id,
                'photo_path' => $this->photo_path,
                'thumbnail_path' => $this->thumbnail_path,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    public function generateFileName(string $extension = 'jpg'): string
    {
        $timestamp = $this->created_at ? $this->created_at->format('Ymd_His') : now()->format('Ymd_His');
        return "delivery_{$this->delivery_confirmation_id}_photo_{$timestamp}_{$this->id}.{$extension}";
    }

    public function getEXIFData(): array
    {
        $meta = $this->getPhotoMetadataAttribute($this->photo_metadata);
        
        return [
            'camera_make' => $meta['camera_make'] ?? null,
            'camera_model' => $meta['camera_model'] ?? null,
            'taken_at' => $meta['taken_at'] ?? null,
            'gps_coordinates' => $this->getGPSLocation(),
            'iso' => $meta['iso'] ?? null,
            'aperture' => $meta['aperture'] ?? null,
            'shutter_speed' => $meta['shutter_speed'] ?? null,
        ];
    }
}