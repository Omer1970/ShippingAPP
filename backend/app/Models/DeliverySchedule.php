<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Shipment;
use App\Models\User;

/**
 * DeliverySchedule model for managing delivery scheduling and time slot allocation
 */
class DeliverySchedule extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'delivery_schedules';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'shipment_id',
        'driver_id',
        'delivery_date',
        'start_time',
        'end_time',
        'time_slot',
        'estimated_duration',
        'estimated_distance',
        'route_order',
        'sequence_current_step',
        'sequence_total_steps',
        'status',
        'metadata',
        'notes',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'delivery_date' => 'date',
        'start_time' => 'string',
        'end_time' => 'string',
        'estimated_duration' => 'integer',
        'estimated_distance' => 'decimal:2',
        'route_order' => 'integer',
        'sequence_current_step' => 'integer',
        'sequence_total_steps' => 'integer',
        'status' => 'string',
        'metadata' => 'array',
    ];

    /**
     * Get the shipment associated with this delivery schedule.
     */
    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class, 'shipment_id');
    }

    /**
     * Get the assigned driver for this delivery schedule.
     */
    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    /**
     * Check if schedule is confirmed/scheduled
     */
    public function isScheduled(): bool
    {
        return $this->status === 'scheduled';
    }

    /**
     * Check if schedule is in progress
     */
    public function isInProgress(): bool
    {
        return $this->status === 'in_progress';
    }

    /**
     * Check if schedule is completed
     */
    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    /**
     * Check if schedule is cancelled
     */
    public function isCancelled(): bool
    {
        return $this->status === 'cancelled';
    }

    /**
     * Check if schedule can be modified
     */
    public function canBeModified(): bool
    {
        return !in_array($this->status, ['completed', 'cancelled']);
    }

    /**
     * Get time slot in readable format
     */
    public function getTimeSlotAttribute(): string
    {
        return $this->time_slot ?? sprintf('%s-%s', $this->start_time, $this->end_time);
    }

    /**
     * Mark schedule as completed
     */
    public function markCompleted(): void
    {
        $this->update(['status' => 'completed']);
    }

    /**
     * Mark schedule as cancelled
     */
    public function markCancelled(): void
    {
        $this->update(['status' => 'cancelled']);
    }

    /**
     * Update delivery time slot
     */
    public function updateTimeSlot(string $startTime, string $endTime): void
    {
        $this->update([
            'start_time' => $startTime,
            'end_time' => $endTime,
            'time_slot' => sprintf('%s-%s', $startTime, $endTime),
        ]);
    }

    /**
     * Get formatted duration display
     */
    public function getEstimatedDurationDisplay(): string
    {
        return sprintf('%d minutes', $this->estimated_duration);
    }

    /**
     * Get formatted distance display
     */
    public function getEstimatedDistanceDisplay(): string
    {
        return sprintf('%.1f km', $this->estimated_distance ?? 0);
    }

    /**
     * Check if schedule overlaps with given time range
     */
    public function overlapsWith(string $startTime, string $endTime): bool
    {
        return ($this->start_time <= $endTime && $this->end_time >= $startTime);
    }

    /**
     * Get sequence progress as percentage
     */
    public function getSequenceProgressPercentage(): int
    {
        if ($this->sequence_total_steps === 0) return 0;
        return (int) (($this->sequence_current_step / $this->sequence_total_steps) * 100);
    }

    /**
     * Scope for finding schedules for specific driver on specific date
     */
    public function scopeForDriverOnDate($query, int $driverId, string $deliveryDate)
    {
        return $query->where('driver_id', $driverId)
                     ->where('delivery_date', $deliveryDate);
    }

    /**
     * Scope for finding schedules by status
     */
    public function scopeByStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope for finding schedules within date range
     */
    public function scopeWithinDateRange($query, string $startDate, string $endDate)
    {
        return $query->whereBetween('delivery_date', [$startDate, $endDate]);
    }

    /**
     * Scope for finding schedules by route order
     */
    public function scopeOrderedByRoute($query, int $driverId, string $deliveryDate)
    {
        return $query->forDriverOnDate($driverId, $deliveryDate)
                    ->orderBy('route_order')
                    ->orderBy('start_time');
    }
}
