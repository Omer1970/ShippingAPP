<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

/**
 * DeliveryTimeSlot model for managing time slot availability and booking capacity
 */
class DeliveryTimeSlot extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'delivery_time_slots';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'driver_id',
        'slot_date',
        'start_time',
        'end_time',
        'slot_label',
        'capacity',
        'booked',
        'availability',
        'is_recurring',
        'recurrence_pattern',
        'metadata',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'slot_date' => 'date',
        'start_time' => 'string',
        'end_time' => 'string',
        'capacity' => 'integer',
        'booked' => 'integer',
        'availability' => 'string',
        'is_recurring' => 'boolean',
        'recurrence_pattern' => 'string',
        'metadata' => 'array',
    ];

    /**
     * Get the driver associated with this time slot.
     */
    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    /**
     * Check if slot is available
     */
    public function isAvailable(): bool
    {
        return $this->availability === 'available' && $this->booked < $this->capacity;
    }

    /**
     * Check if slot is limited availability
     */
    public function isLimited(): bool
    {
        return $this->availability === 'limited' || $this->booked >= $this->capacity / 2;
    }

    /**
     * Check if slot is full
     */
    public function isFull(): bool
    {
        return $this->booked >= $this->capacity;
    }

    /**
     * Check if slot is blocked
     */
    public function isBlocked(): bool
    {
        return $this->availability === 'blocked';
    }

    /**
     * Check if slot is recurring
     */
    public function isRecurring(): bool
    {
        return $this->is_recurring === true;
    }

    /**
     * Get available capacity for this slot
     */
    public function getAvailableCapacity(): int
    {
        return max(0, $this->capacity - $this->booked);
    }

    /**
     * Get percentage of slot utilization
     */
    public function getUtilizationPercentage(): int
    {
        if ($this->capacity === 0) return 0;
        return (int) (($this->booked / $this->capacity) * 100);
    }

    /**
     * Book a slot
     */
    public function bookSlot(): bool
    {
        if ($this->isAvailable()) {
            $this->increment('booked');

            // Update availability status based on new booked count
            if ($this->getAvailableCapacity() === 0) {
                $this->update(['availability' => 'full']);
            } elseif ($this->getUtilizationPercentage() >= 75) {
                $this->update(['availability' => 'limited']);
            }

            return true;
        }

        return false;
    }

    /**
     * Cancel a booking
     */
    public function cancelBooking(): bool
    {
        if ($this->booked > 0) {
            $this->decrement('booked');

            // Update availability status based on new booked count
            if ($this->booked === 0) {
                $this->update(['availability' => 'available']);
            } elseif ($this->getUtilizationPercentage() < 75) {
                $this->update(['availability' => 'available']);
            }

            return true;
        }

        return false;
    }

    /**
     * Block the slot
     */
    public function blockSlot(): void
    {
        $this->update(['availability' => 'blocked']);
    }

    /**
     * Unblock the slot
     */
    public function unblockSlot(): void
    {
        $this->update(['availability' => 'available']);
    }

    /**
     * Get time slot display label
     */
    public function getDisplayLabel(): string
    {
        return sprintf('%s (%s - %s)', $this->slot_label, $this->start_time, $this->end_time);
    }

    /**
     * Get time slot in readable format
     */
    public function getTimeSlotAttribute(): string
    {
        return sprintf('%s-%s', $this->start_time, $this->end_time);
    }

    /**
     * Check if overlaps with given time range
     */
    public function overlapsWith(string $startTime, string $endTime): bool
    {
        return ($this->start_time <= $endTime && $this->end_time >= $startTime);
    }

    /**
     * Scope for finding slots for specific driver on specific date
     */
    public function scopeForDriverOnDate($query, int $driverId, string $slotDate)
    {
        return $query->where('driver_id', $driverId)
                     ->where('slot_date', $slotDate);
    }

    /**
     * Scope for finding available slots
     */
    public function scopeAvailable($query)
    {
        return $query->where('availability', 'available')
                     ->whereRaw('booked < capacity');
    }

    /**
     * Scope for finding slots within time range
     */
    public function scopeWithinTimeRange($query, string $startTime, string $endTime)
    {
        return $query->where(function ($q) use ($startTime, $endTime) {
            $q->whereBetween('start_time', [$startTime, $endTime])
              ->orWhereBetween('end_time', [$startTime, $endTime])
              ->orWhere(function ($q) use ($startTime, $endTime) {
                  $q->where('start_time', '<=', $startTime)
                    ->where('end_time', '>=', $endTime);
              });
        });
    }

    /**
     * Get total available bookings across multiple slots
     */
    public static function getTotalAvailableCapacity(array $slotIds): int
    {
        return self::whereIn('id', $slotIds)
                  ->available()
          ->sum(fn($slot) => $slot->getAvailableCapacity());
    }

    /**
     * Generate recurring slots for date range
     */
    public static function generateRecurringSlots(int $driverId, string $startDate, string $endDate): array
    {
        $recurringSlots = [];

        self::where('driver_id', $driverId)
             ->where('is_recurring', true)
            ->where('slot_date', '<=', $endDate)
           ->get()
        ->map(function ($templateSlot) use (&$recurringSlots, $startDate, $endDate) {
       $currentDate = new \DateTime($startDate);
     $endDateObj = new \DateTime($endDate);

    while ($currentDate <= $endDateObj) {
   if ($templateSlot->matchesRecurringPattern($currentDate->format('Y-m-d'))) {
             $recurringSlots[] = $templateSlot->createSlotForDate($currentDate->format('Y-m-d'));
            }
     $currentDate->add(new \DateInterval('P1D'));
            }
        });

        return $recurringSlots;
    }

    /**
     * Check if date matches recurrence pattern
     */
    private function matchesRecurringPattern(string $date): bool
    {
        $dateObj = new \DateTime($date);

        return match($this->recurrence_pattern) {
            'daily' => true,
          'weekly' => $dateObj->format('w') === (new \DateTime($this->slot_date))->format('w'),
      'monthly' => $dateObj->format('d') === (new \DateTime($this->slot_date))->format('d'),
            default => false,
    };
    }

    /**
     * Create new slot instance for given date
     */
    private function createSlotForDate(string $date): array
    {
        return [
'driver_id' => $this->driver_id,
            'slot_date' => $date,
            'start_time' => $this->start_time,
'end_time' => $this->end_time,
            'slot_label' => $this->slot_label,
        'capacity' => $this->capacity,
 'availability' => $this->availability,
            'metadata' => $this->metadata,
       ];
    }
}
