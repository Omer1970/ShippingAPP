<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class DeliverySignature extends Model
{
    use HasFactory;

    protected $table = 'delivery_signatures';

    protected $fillable = [
        'delivery_id',
        'signature_data',
        'signature_hash',
        'signature_type',
        'signature_strokes',
        'signature_quality',
        'canvas_width',
        'canvas_height',
        'device_name',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'signature_quality' => 'float',
        'canvas_width' => 'integer',
        'canvas_height' => 'integer',
        'signature_strokes' => 'json',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $attributes = [
        'signature_type' => 'touch',
        'signature_quality' => 0.0,
        'canvas_width' => 400,
        'canvas_height' => 200,
    ];

    public function deliveryConfirmation(): BelongsTo
    {
        return $this->belongsTo(DeliveryConfirmation::class, 'delivery_id');
    }

    public function getSignatureStrokesAttribute($value)
    {
        return collect(json_decode($value, true) ?? []);
    }

    public function setSignatureStrokesAttribute($value): void
    {
        $this->attributes['signature_strokes'] = json_encode($value);
    }

    public function generateVerificationHash(): string
    {
        $data = [
            $this->delivery_id,
            $this->signature_data,
            $this->canvas_width,
            $this->canvas_height,
            $this->created_at?->format('Y-m-d H:i:s'),
            $this->ip_address,
        ];

        return hash('sha256', serialize($data));
    }

    public function verifyIntegrity(): bool
    {
        return $this->signature_hash === $this->generateVerificationHash();
    }

    public function isValidQuality(): bool
    {
        return $this->signature_quality >= 0.85;
    }

    public function isLegallyValid(): bool
    {
        return $this->isValidQuality() && 
               $this->verifyIntegrity() && 
               $this->signature_quality >= 0.85 &&
               strlen($this->signature_data) > 100;
    }

    public function getSignatureMetrics(): array
    {
        try {
            $strokes = $this->getSignatureStrokesAttribute($this->signature_strokes);
            
            return [
                'stroke_count' => $strokes->count(),
                'canvas_aspect_ratio' => $this->getAspectRatio(),
                'canvas_dimensions_valid' => $this->hasReasonableCanvasDimensions(),
                'signature_quality_score' => $this->signature_quality,
                'is_valid_quality' => $this->isValidQuality(),
                'integrity_verified' => $this->verifyIntegrity(),
                'is_legally_valid' => $this->isLegallyValid(),
                'device_credibility' => $this->isFromCredibleDevice(),
            ];
        } catch (\Exception $e) {
            return [
                'error' => 'Failed to calculate signature metrics',
                'exception' => $e->getMessage(),
            ];
        }
    }

    public function getAspectRatio(): float
    {
        if ($this->canvas_height == 0) {
            return 0.0;
        }

        return $this->canvas_width / $this->canvas_height;
    }

    public function hasReasonableCanvasDimensions(): bool
    {
        return $this->canvas_width >= 200 && 
               $this->canvas_width <= 800 &&
               $this->canvas_height >= 100 && 
               $this->canvas_height <= 400;
    }
}