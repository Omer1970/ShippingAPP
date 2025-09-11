<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

/**
 * Order model for storing order data synchronized from Dolibarr ERP
 */
class Order extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'orders';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'dolibarr_order_id',
        'reference',
        'customer_id',
        'customer_name',
        'order_date',
        'status',
        'total_amount',
        'shipping_address',
        'billing_address',
        'created_from_dolibarr',
        'last_synced',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'dolibarr_order_id' => 'integer',
        'customer_id' => 'integer',
        'total_amount' => 'decimal:2',
        'order_date' => 'date',
        'status' => 'string',
        'created_from_dolibarr' => 'boolean',
        'last_synced' => 'datetime',
    ];

    /**
     * Get the author of this order.
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /**
     * Check if order belongs to specific customer
     */
    public function belongsToCustomer(int $customerId): bool
    {
        return $this->customer_id === $customerId;
    }

    /**
     * Check if order is active (pending or processing)
     */
    public function isActive(): bool
    {
        return in_array($this->status, ['pending', 'processing']);
    }

    /**
     * Check if order is completed (shipped or delivered)
     */
    public function isCompleted(): bool
    {
        return in_array($this->status, ['shipped', 'delivered']);
    }

    /**
     * Check if order is cancelled
     */
    public function isCancelled(): bool
    {
        return $this->status === 'cancelled';
    }

    /**
     * Check if order can be updated (not shipped, delivered, or cancelled)
     */
    public function canBeUpdated(): bool
    {
        return !in_array($this->status, ['shipped', 'delivered', 'cancelled']);
    }

    /**
     * Check if order is in a specific status
     */
    public function isStatus(string $status): bool
    {
        return $this->status === $status;
    }

    /**
     * Get total formatted amount
     */
    public function getTotalAmountFormatted(): string
    {
        return number_format($this->total_amount ?? 0, 2) . ' EUR';
    }
}