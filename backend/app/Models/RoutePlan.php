<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\User;
use App\Models\DeliverySchedule;

/**
 * RoutePlan model for managing optimized delivery routes
 */
class RoutePlan extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'route_plans';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'driver_id',
        'route_date',
        'optimized_route',
        'route_status',
        'total_distance',
        'estimated_time',
        'efficiency_score',
        'waypoints',
        'alternatives',
        'optimization_algorithm',
        'optimized_at',
        'started_at',
        'completed_at',
        'traffic_model',
        'metadata',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'route_date' => 'date',
        'optimized_route' => 'array',
        'total_distance' => 'decimal:2',
        'estimated_time' => 'decimal:2',
        'efficiency_score' => 'decimal:2',
        'waypoints' => 'array',
        'alternatives' => 'array',
        'optimized_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'metadata' => 'array',
    ];

    /**
     * The attributes that use timestamps.
     */
    public $timestamps = true;

    /**
     * Get the driver associated with this route plan.
     */
    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    /**
     * Get delivery schedules associated with this route plan.
     */
    public function deliverySchedules(): HasMany
    {
        return $this->hasMany(DeliverySchedule::class, 'route_plan_id');
    }

    /**
     * Check if route plan is planned
     */
    public function isPlanned(): bool
    {
        return $this->route_status === 'planned';
    }

    /**
     * Check if route plan is active
     */
    public function isActive(): bool
    {
        return $this->route_status === 'active';
    }

    /**
     * Check if route plan is completed
     */
    public function isCompleted(): bool
    {
        return $this->route_status === 'completed';
    }

    /**
     * Check if route plan is cancelled
     */
    public function isCancelled(): bool
    {
        return $this->route_status === 'cancelled';
    }

    /**
     * Mark route plan as active
     */
    public function markAsActive(): void
    {
        $this->update([
            'route_status' => 'active',
            'started_at' => now(),
        ]);
    }

    /**
     * Mark route plan as completed
     */
    public function markAsCompleted(): void
    {
        $this->update([
            'route_status' => 'completed',
            'completed_at' => now(),
        ]);
    }

    /**
     * Mark route plan as cancelled
     */
    public function markAsCancelled(): void
    {
        $this->update(['route_status' => 'cancelled']);
    }

    /**
     * Get formatted route duration display
     */
    public function getRouteDurationDisplay(): string
    {
        if ($this->estimated_time === null) {
            return 'Not calculated';
        }
        return sprintf('%.1f minutes', $this->estimated_time);
    }

    /**
     * Get formatted route distance display
     */
    public function getRouteDistanceDisplay(): string
    {
        if ($this->total_distance === null) {
            return 'Not calculated';
        }
        return sprintf('%.1f km', $this->total_distance);
    }

    /**
     * Get efficiency score as percentage
     */
    public function getEfficiencyScorePercentage(): ?int
    {
        if ($this->efficiency_score === null) {
            return null;
        }
        return (int) ($this->efficiency_score * 100);
    }

    /**
     * Get optimized schedule IDs from route
     */
    public function getOptimizedScheduleIds(): array
    {
        return $this->optimized_route ?? [];
    }

    /**
     * Set optimized schedule IDs for the route
     */
    public function setOptimizedRoute(array $scheduleIds): void
    {
        $this->update([
            'optimized_route' => array_values($scheduleIds),
            'optimized_at' => now(),
        ]);
    }

    /**
     * Check if route has been optimized
     */
    public function isOptimized(): bool
    {
        return $this->optimized_at !== null;
    }

    /**
     * Check if route optimization is needed
     */
    public function needsOptimization(): bool
    {
        return !$this->isOptimized() && $this->isPlanned();
    }

    /**
     * Get route progress as percentage
     */
    public function getRouteProgress(): int
    {
        if (!$this->isOptimized()) {
            return 0;
        }

        $scheduleIds = $this->getOptimizedScheduleIds();
        if (empty($scheduleIds)) {
            return 0;
        }

        $completedCount = DeliverySchedule::whereIn('id', $scheduleIds)
            ->where('status', 'completed')
            ->count();

        return (int) (($completedCount / count($scheduleIds)) * 100);
    }

    /**
     * Scope for finding route plans by driver and date
     */
    public function scopeForDriverOnDate($query, int $driverId, string $routeDate)
    {
        return $query->where('driver_id', $driverId)
                     ->where('route_date', $routeDate);
    }

    /**
     * Scope for finding route plans by status
     */
    public function scopeByStatus($query, string $status)
    {
        return $query->where('route_status', $status);
    }

    /**
     * Scope for finding route plans within date range
     */
    public function scopeWithinDateRange($query, string $startDate, string $endDate)
    {
        return $query->whereBetween('route_date', [$startDate, $endDate]);
    }

    /**
     * Scope for finding route plans that need optimization
     */
    public function scopeNeedsOptimization($query)
    {
        return $query->where('optimized_at', null)
                     ->where('route_status', 'planned');
    }

    /**
     * Scope for finding active routes
     */
    public function scopeActive($query)
    {
        return $query->where('route_status', 'active');
    }

    /**
     * Get next schedule in the route
     */
    public function getNextSchedule(): ?DeliverySchedule
    {
        $scheduleIds = $this->getOptimizedScheduleIds();
        if (empty($scheduleIds)) {
            return null;
        }

        $currentIndex = $this->getCurrentScheduleIndex();
        if ($currentIndex >= count($scheduleIds) - 1) {
            return null;
        }

        return DeliverySchedule::find($scheduleIds[$currentIndex + 1]);
    }

    /**
     * Get current schedule index in route
     */
    private function getCurrentScheduleIndex(): int
    {
        $scheduleIds = $this->getOptimizedScheduleIds();
        foreach ($scheduleIds as $index => $scheduleId) {
            $schedule = DeliverySchedule::find($scheduleId);
            if ($schedule && $schedule->isInProgress()) {
                return $index;
            }
        }
        return -1;
    }

    /**
     * Calculate and store route statistics
     */
    public function updateRouteStatistics(): void
    {
        $scheduleIds = $this->getOptimizedScheduleIds();
        if (empty($scheduleIds)) {
            return;
        }

        // Update route statistics based on delivery schedules
        $schedules = DeliverySchedule::whereIn('id', $scheduleIds)->get();

        $totalDistance = $schedules->sum('estimated_distance') ?? 0;
        $totalTime = $schedules->sum('estimated_duration') ?? 0;

        // Update route statistics
        $this->update([
            'total_distance' => $totalDistance,
            'estimated_time' => $totalTime,
        ]);
    }

    /**
     * Validate that all schedules in route are assigned to the same driver
     */
    public function validateRouteConsistency(): bool
    {
        $scheduleIds = $this->getOptimizedScheduleIds();
        if (empty($scheduleIds)) {
            return true;
        }

        $driverId = $this->driver_id;

        return DeliverySchedule::whereIn('id', $scheduleIds)
            ->where('driver_id', $driverId)
            ->count() === count($scheduleIds);
    }

    /**
     * Check if route can be started
     */
 public function canStart(): bool
    {
        return $this->isPlanned() && $this->isOptimized();
    }

    /**
     * Check if route can be modified
     */
    public function canBeModified(): bool
    {
        return !$this->isCompleted() && !$this->isCancelled();
    }

    /**
     * Get route duration in human readable format
     */
    public function getDurationHumanReadable(): string
    {
        if ($this->estimated_time === null) {
            return 'Not calculated';
        }

        $hours = (int) ($this->estimated_time / 60);
        $minutes = (int) ($this->estimated_time % 60);

        if ($hours > 0) {
            return sprintf('%dh %dmin', $hours, $minutes);
        }

        return sprintf('%dmin', $minutes);
    }

    /**
     * Get average efficiency score
     */
    public function getAverageEfficiencyScore(): ?float
    {
        return $this->efficiency_score;
    }
}
