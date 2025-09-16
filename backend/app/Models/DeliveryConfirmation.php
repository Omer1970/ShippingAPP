<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Laravel\Scout\Searchable;

class DeliveryConfirmation extends Model
{
    use HasFactory, Searchable;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'delivery_confirmations';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'shipment_id',
        'user_id',
        'delivered_at',
        'recipient_name',
        'signature_id',
        'photo_ids',
        'gps_latitude',
        'gps_longitude',
        'gps_accuracy',
        'delivery_notes',
        'status',
        'synced_to_erp',
        'erp_sync_timestamp',
        'verification_hash',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'delivered_at' => 'datetime',
        'erp_sync_timestamp' => 'datetime',
        'photo_ids' => 'json',
        'gps_latitude' => 'decimal:8',
        'gps_longitude' => 'decimal:8',
        'gps_accuracy' => 'decimal:2',
        'synced_to_erp' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * The model's default values for attributes.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => 'pending',
        'synced_to_erp' => false,
        'photo_ids' => '[]',
        'gps_accuracy' => 0.00,
    ];

    /**
     * Get the indexable data array for the model.
     *
     * @return array
     */
    public function toSearchableArray()
    {
        return [
            'id' => $this->id,
            'shipment_id' => $this->shipment_id,
            'recipient_name' => $this->recipient_name,
            'delivery_notes' => $this->delivery_notes,
            'status' => $this->status,
            'delivered_at' => $this->delivered_at,
            'created_at' => $this->created_at,
            'gps_latitude' => $this->gps_latitude,
            'gps_longitude' => $this->gps_longitude,
        ];
    }

    /**
     * Get the shipment associated with this delivery confirmation.
     *
     * @return BelongsTo
     */
    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class, 'shipment_id');
    }

    /**
     * Get the user who performed the delivery.
     *
     * @return BelongsTo
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Get the digital signature for this delivery.
     *
     * @return HasOne
     */
    public function signature(): HasOne
    {
        return $this->hasOne(DeliverySignature::class, 'delivery_id');
    }

    /**
     * Get the photos for this delivery confirmation.
     *
     * @return HasMany
     */
    public function photos(): HasMany
    {
        return $this->hasMany(DeliveryPhoto::class, 'delivery_confirmation_id');
    }

    /**
     * Get the delivery photos as a collection.
     *
     * @return \Illuminate\Support\Collection
     */
    public function getPhotoIdsAttribute($value)
    {
        return json_decode($value, true) ?? [];
    }

    /**
     * Set the delivery photos IDs.
     *
     * @param array $value
     * @return void
     */
    public function setPhotoIdsAttribute($value): void
    {
        $this->attributes['photo_ids'] = json_encode($value);
    }

    /**
     * Generate verification hash for data integrity.
     *
     * @return string
     */
    public function generateVerificationHash(): string
    {
        $data = [
            $this->shipment_id,
            $this->delivered_at?->format('Y-m-d H:i:s'),
            $this->recipient_name,
            $this->gps_latitude,
            $this->gps_longitude,
            $this->created_at?->format('Y-m-d H:i:s'),
        ];

        return hash('sha256', serialize($data));
    }

    /**
     * Verify data integrity using hash.
     *
     * @return bool
     */
    public function verifyIntegrity(): bool
    {
        return $this->verification_hash === $this->generateVerificationHash();
    }

    /**
     * Check if delivery is synced to ERP.
     *
     * @return bool
     */
    public function isSyncedToErp(): bool
    {
        return $this->synced_to_erp && $this->erp_sync_timestamp !== null;
    }

    /**
     * Mark delivery as synced to ERP.
     *
     * @return void
     */
    public function markAsSyncedToErp(): void
    {
        $this->update([
            'synced_to_erp' => true,
            'erp_sync_timestamp' => now(),
        ]);
    }

    /**
     * Scope delivery confirmations by user.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param int $userId
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope delivery confirmations by status.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param string $status
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeByStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Get delivery confirmations for the current month.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeCurrentMonth($query)
    {
        return $query->whereMonth('delivered_at', now()->month)
                     ->whereYear('delivered_at', now()->year);
    }

    /**
     * Get recently confirmed deliveries.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param int $minutes
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeRecentlyConfirmed($query, int $minutes = 60)
    {
        return $query->where('delivered_at', '>=', now()->subMinutes($minutes));
    }
}