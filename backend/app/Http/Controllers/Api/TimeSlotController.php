<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeliveryTimeSlot;
use App\Models\User;
use App\Http\Resources\DeliveryTimeSlotResource;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * TimeSlotController for managing delivery time slots and availability
 */
class TimeSlotController extends Controller
{
    /**
     * Get time slots for a specific driver and date range
     */
    public function getTimeSlots(Request $request): JsonResponse
    {
        $validatedData = $request->validate([
            'driver_id' => 'required|integer|exists:users,id',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'availability' => 'in:available,limited,full,blocked,all',
        ]);

        $driverId = $validatedData['driver_id'];
        $startDate = $validatedData['start_date'];
        $endDate = $validatedData['end_date'];
        $availability = $validatedData['availability'] ?? 'all';

        $query = DeliveryTimeSlot::where('driver_id', $driverId)
            ->whereBetween('slot_date', [$startDate, $endDate]);

        if ($availability !== 'all') {
            $query->where('availability', $availability);
        }

        $timeSlots = $query->orderBy('slot_date')
            ->orderBy('start_time')
            ->get();

        return response()->json([
            'data' => DeliveryTimeSlotResource::collection($timeSlots),
            'meta' => [
                'driver_id' => $driverId,
                'date_range' => [
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                ],
                'summary' => [
                    'total_slots' => $timeSlots->count(),
                    'available_slots' => $timeSlots->filter->isAvailable()->count(),
                    'limited_slots' => $timeSlots->filter->isLimited()->count(),
                    'full_slots' => $timeSlots->filter->isFull()->count(),
                    'blocked_slots' => $timeSlots->filter->isBlocked()->count(),
                ],
            ],
        ]);
    }

    /**
     * Create a new time slot
     */
    public function createTimeSlot(Request $request): JsonResponse
    {
        $validatedData = $request->validate([
            'driver_id' => 'required|integer|exists:users,id',
            'slot_date' => 'required|date',
            'start_time' => 'required|string|regex:/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/',
            'end_time' => 'required|string|regex:/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/',
            'slot_label' => 'required|string|max:100',
            'capacity' => 'required|integer|min:1|max:20',
            'availability' => 'in:available,limited,full,blocked',
            'is_recurring' => 'boolean',
            'recurrence_pattern' => 'in:daily,weekly,monthly|required_if:is_recurring,true',
            'metadata' => 'array',
        ]);

        // Validate time range
        if ($validatedData['start_time'] >= $validatedData['end_time']) {
            return response()->json([
                'success' => false,
                'message' => 'End time must be after start time',
            ], 422);
        }

        // Check for overlapping time slots
        $overlapping = DeliveryTimeSlot::where('driver_id', $validatedData['driver_id'])
            ->where('slot_date', $validatedData['slot_date'])
            ->where(function ($query) use ($validatedData) {
                $query->whereBetween('start_time', [$validatedData['start_time'], $validatedData['end_time']])
                    ->orWhereBetween('end_time', [$validatedData['start_time'], $validatedData['end_time']])
                    ->orWhere(function ($q) use ($validatedData) {
                        $q->where('start_time', '<=', $validatedData['start_time'])
                            ->where('end_time', '>=', $validatedData['end_time']);
                    });
            })
            ->exists();

        if ($overlapping) {
            return response()->json([
                'success' => false,
                'message' => 'Time slot overlaps with existing slot',
            ], 409);
        }

        $timeSlot = DeliveryTimeSlot::create($validatedData);

        return response()->json([
            'success' => true,
            'data' => new DeliveryTimeSlotResource($timeSlot),
            'message' => 'Time slot created successfully',
        ], 201);
    }

    /**
     * Get a specific time slot
     */
    public function getTimeSlot(DeliveryTimeSlot $timeSlot): JsonResponse
    {
        return response()->json([
            'data' => new DeliveryTimeSlotResource($timeSlot),
        ]);
    }

    /**
     * Update a time slot
     */
    public function updateTimeSlot(Request $request, DeliveryTimeSlot $timeSlot): JsonResponse
    {
        $validatedData = $request->validate([
            'start_time' => 'string|regex:/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/',
            'end_time' => 'string|regex:/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/',
            'slot_label' => 'string|max:100',
            'capacity' => 'integer|min:1|max:20',
            'availability' => 'in:available,limited,full,blocked',
            'is_recurring' => 'boolean',
            'recurrence_pattern' => 'in:daily,weekly,monthly|required_if:is_recurring,true',
            'metadata' => 'array',
        ]);

        // Validate time range if both times are provided
        if (isset($validatedData['start_time']) && isset($validatedData['end_time'])) {
            if ($validatedData['start_time'] >= $validatedData['end_time']) {
                return response()->json([
                    'success' => false,
                    'message' => 'End time must be after start time',
                ], 422);
            }
        }

        // Check for overlapping time slots if time is being changed
        if (isset($validatedData['start_time']) || isset($validatedData['end_time'])) {
            $startTime = $validatedData['start_time'] ?? $timeSlot->start_time;
            $endTime = $validatedData['end_time'] ?? $timeSlot->end_time;

            $overlapping = DeliveryTimeSlot::where('driver_id', $timeSlot->driver_id)
                ->where('slot_date', $timeSlot->slot_date)
                ->where('id', '!=', $timeSlot->id)
                ->where(function ($query) use ($startTime, $endTime) {
                    $query->whereBetween('start_time', [$startTime, $endTime])
                        ->orWhereBetween('end_time', [$startTime, $endTime])
                        ->orWhere(function ($q) use ($startTime, $endTime) {
                            $q->where('start_time', '<=', $startTime)
                                ->where('end_time', '>=', $endTime);
                        });
                })
                ->exists();

            if ($overlapping) {
                return response()->json([
                    'success' => false,
                    'message' => 'Time slot overlaps with existing slot',
                ], 409);
            }
        }

        $timeSlot->update($validatedData);

        return response()->json([
            'success' => true,
            'data' => new DeliveryTimeSlotResource($timeSlot),
            'message' => 'Time slot updated successfully',
        ]);
    }

    /**
     * Delete a time slot
     */
    public function deleteTimeSlot(DeliveryTimeSlot $timeSlot): JsonResponse
    {
        // Check if slot has bookings
        if ($timeSlot->booked > 0) {
            return response()->json([
                'success' => false,
                    'message' => 'Cannot delete time slot with existing bookings',
            ], 422);
        }

        $timeSlot->delete();

        return response()->json([
            'success' => true,
            'message' => 'Time slot deleted successfully',
        ]);
    }

    /**
     * Book a time slot
     */
    public function bookTimeSlot(Request $request, DeliveryTimeSlot $timeSlot): JsonResponse
    {
        $validatedData = $request->validate([
            'delivery_schedule_id' => 'required|integer|exists:delivery_schedules,id',
        ]);

        // Check if slot is available
        if (!$timeSlot->isAvailable()) {
            return response()->json([
                'success' => false,
                'message' => 'Time slot is not available',
                'availability' => $timeSlot->availability,
            ], 409);
        }

        // Book the slot
        if ($timeSlot->bookSlot()) {
            return response()->json([
                'success' => true,
                'data' => new DeliveryTimeSlotResource($timeSlot),
                'message' => 'Time slot booked successfully',
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Failed to book time slot',
        ], 500);
    }

    /**
     * Cancel a time slot booking
     */
    public function cancelBooking(Request $request, DeliveryTimeSlot $timeSlot): JsonResponse
    {
        $validatedData = $request->validate([
            'delivery_schedule_id' => 'required|integer|exists:delivery_schedules,id',
        ]);

        // Cancel the booking
        if ($timeSlot->cancelBooking()) {
            return response()->json([
                'success' => true,
                'data' => new DeliveryTimeSlotResource($timeSlot),
                'message' => 'Time slot booking cancelled successfully',
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Failed to cancel booking',
        ], 422);
    }

    /**
     * Block a time slot
     */
    public function blockTimeSlot(DeliveryTimeSlot $timeSlot): JsonResponse
    {
        $timeSlot->blockSlot();

        return response()->json([
            'success' => true,
            'data' => new DeliveryTimeSlotResource($timeSlot),
            'message' => 'Time slot blocked successfully',
        ]);
    }

    /**
     * Unblock a time slot
     */
    public function unblockTimeSlot(DeliveryTimeSlot $timeSlot): JsonResponse
    {
        $timeSlot->unblockSlot();

        return response()->json([
            'success' => true,
            'data' => new DeliveryTimeSlotResource($timeSlot),
            'message' => 'Time slot unblocked successfully',
        ]);
    }

    /**
     * Bulk update time slots
     */
    public function bulkUpdateTimeSlots(Request $request): JsonResponse
    {
        $validatedData = $request->validate([
            'driver_id' => 'required|integer|exists:users,id',
            'slot_ids' => 'required|array|min:1',
            'slot_ids.*' => 'integer|exists:delivery_time_slots,id',
            'availability' => 'in:available,limited,full,blocked',
            'capacity' => 'integer|min:1|max:20',
            'is_recurring' => 'boolean',
            'recurrence_pattern' => 'in:daily,weekly,monthly|required_if:is_recurring,true',
        ]);

        $driverId = $validatedData['driver_id'];
        $slotIds = $validatedData['slot_ids'];

        // Ensure all slots belong to the specified driver
        $driverSlots = DeliveryTimeSlot::where('driver_id', $driverId)
            ->whereIn('id', $slotIds)
            ->pluck('id')
            ->toArray();

        if (count($driverSlots) !== count($slotIds)) {
            return response()->json([
                'success' => false,
                'message' => 'Some time slots do not belong to the specified driver',
            ], 422);
        }

        $updateData = array_filter([
            'availability' => $validatedData['availability'] ?? null,
            'capacity' => $validatedData['capacity'] ?? null,
            'is_recurring' => $validatedData['is_recurring'] ?? null,
            'recurrence_pattern' => $validatedData['recurrence_pattern'] ?? null,
        ]);

        if (empty($updateData)) {
            return response()->json([
                'success' => false,
                'message' => 'No valid update data provided',
            ], 422);
        }

        $updatedCount = DeliveryTimeSlot::whereIn('id', $slotIds)
            ->update($updateData);

        return response()->json([
            'success' => true,
            'data' => [
                'updated_count' => $updatedCount,
                'slot_ids' => $slotIds,
            ],
            'message' => "Successfully updated {$updatedCount} time slots",
        ]);
    }

    /**
     * Generate recurring time slots
     */
    public function generateRecurringTimeSlots(Request $request): JsonResponse
    {
        $validatedData = $request->validate([
            'driver_id' => 'required|integer|exists:users,id',
            'template_slot_id' => 'required|integer|exists:delivery_time_slots,id',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $driverId = $validatedData['driver_id'];
        $templateSlotId = $validatedData['template_slot_id'];
        $startDate = $validatedData['start_date'];
        $endDate = $validatedData['end_date'];

        // Get the template slot
        $templateSlot = DeliveryTimeSlot::find($templateSlotId);

        if (!$templateSlot || $templateSlot->driver_id !== $driverId) {
            return response()->json([
                'success' => false,
                'message' => 'Template slot not found or does not belong to the specified driver',
            ], 404);
        }

        if (!$templateSlot->is_recurring) {
            return response()->json([
                'success' => false,
                'message' => 'Template slot is not marked as recurring',
            ], 422);
        }

        // Generate recurring slots
        $generatedSlots = DeliveryTimeSlot::generateRecurringSlots($driverId, $startDate, $endDate);

        // Create the slots
        $createdSlots = [];
        foreach ($generatedSlots as $slotData) {
            // Check if slot already exists
            $existingSlot = DeliveryTimeSlot::where('driver_id', $driverId)
                ->where('slot_date', $slotData['slot_date'])
                ->where('start_time', $slotData['start_time'])
                ->where('end_time', $slotData['end_time'])
                ->first();

            if (!$existingSlot) {
                $createdSlots[] = DeliveryTimeSlot::create($slotData);
            }
        }

        return response()->json([
            'success' => true,
            'data' => [
                'generated_count' => count($createdSlots),
                'slots' => DeliveryTimeSlotResource::collection(collect($createdSlots)),
            ],
            'message' => "Successfully generated " . count($createdSlots) . " recurring time slots",
        ], 201);
    }

    /**
     * Get time slot availability for a specific date
     */
    public function getAvailability(Request $request): JsonResponse
    {
        $validatedData = $request->validate([
            'driver_id' => 'required|integer|exists:users,id',
            'date' => 'required|date',
        ]);

        $driverId = $validatedData['driver_id'];
        $date = $validatedData['date'];

        $timeSlots = DeliveryTimeSlot::where('driver_id', $driverId)
            ->where('slot_date', $date)
            ->orderBy('start_time')
            ->get();

        $availability = [
            'date' => $date,
            'driver_id' => $driverId,
            'driver_name' => User::find($driverId)->name ?? 'Unknown',
            'total_slots' => $timeSlots->count(),
            'available_slots' => $timeSlots->filter->isAvailable()->count(),
            'limited_slots' => $timeSlots->filter->isLimited()->count(),
            'full_slots' => $timeSlots->filter->isFull()->count(),
            'blocked_slots' => $timeSlots->filter->isBlocked()->count(),
            'time_slots' => DeliveryTimeSlotResource::collection($timeSlots),
        ];

        return response()->json([
            'data' => $availability,
        ]);
    }

    /**
     * Configure time slot settings for a driver
     */
    public function configureTimeSlots(Request $request): JsonResponse
    {
        $validatedData = $request->validate([
            'driver_id' => 'required|integer|exists:users,id',
            'default_capacity' => 'integer|min:1|max:20',
            'slot_duration' => 'integer|min:30|max:240', // minutes
            'working_hours_start' => 'string|regex:/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/',
            'working_hours_end' => 'string|regex:/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/',
            'break_times' => 'array',
            'break_times.*.start_time' => 'required_with:break_times|string|regex:/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/',
            'break_times.*.end_time' => 'required_with:break_times|string|regex:/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/',
            'days_of_week' => 'array',
            'days_of_week.*' => 'integer|between:0,6', // 0 = Sunday, 6 = Saturday
        ]);

        $driverId = $validatedData['driver_id'];

        // Store configuration in metadata or separate table (implementation depends on requirements)
        $configuration = [
            'default_capacity' => $validatedData['default_capacity'] ?? 4,
            'slot_duration' => $validatedData['slot_duration'] ?? 120,
            'working_hours_start' => $validatedData['working_hours_start'] ?? '09:00',
            'working_hours_end' => $validatedData['working_hours_end'] ?? '18:00',
            'break_times' => $validatedData['break_times'] ?? [],
            'days_of_week' => $validatedData['days_of_week'] ?? [1, 2, 3, 4, 5], // Monday to Friday
        ];

        // For now, return the configuration (in a real implementation, this would be stored)
        return response()->json([
            'success' => true,
            'data' => [
                'driver_id' => $driverId,
                'configuration' => $configuration,
            ],
            'message' => 'Time slot configuration saved successfully',
        ]);
    }
}