<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

/**
 * Shipment model for storing shipment data synchronized from Dolibarr ERP
 */
class Shipment extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'shipments';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'dolibarr_shipment_id',
        'reference',
        'customer_id',
        'customer_name',
        'delivery_address',
        'status',
        'expected_delivery',
        'assigned_driver_id',
        'total_weight',
        'total_value',
        'created_from_dolibarr',
        'last_synced',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'dolibarr_shipment_id' => 'integer',
        'customer_id' => 'integer',
        'total_weight' => 'decimal:2',
        'total_value' => 'decimal:2',
        'expected_delivery' => 'date',
        'assigned_driver_id' => 'integer',
        'status' => 'string',
        'created_from_dolibarr' => 'boolean',
        'last_synced' => 'datetime',
    ];

    /**
     * Get the assigned driver for this shipment.
     */
    public function assignedDriver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_driver_id');
    }

    /**
     * Check if shipment is assigned to specific driver
     */
    public function isAssignedTo(int $driverId): bool
    {
        return $this->assigned_driver_id === $driverId;
    }

    /**
     * Check if shipment is delivered or cancelled (cannot be updated)
     */
    public function canBeUpdated(): bool
    {
        return !in_array($this->status, ['delivered', 'cancelled']);
    }

    /**
     * Check if shipment is active (in transit or validated)
     */
    public function isActive(): bool
    {
        return in_array($this->status, ['validated', 'in_transit']);
    }

    /**
     * Check if shipment is in a specific status
     */
    public function isStatus(string $status): bool
    {
        return $this->status === $status;
    }
}