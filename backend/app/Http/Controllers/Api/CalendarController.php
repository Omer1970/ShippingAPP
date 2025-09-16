<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeliverySchedule;
use App\Models\DeliveryTimeSlot;
use App\Models\RoutePlan;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use App\Http\Resources\DeliveryScheduleResource;
use App\Http\Resources\DeliveryTimeSlotResource;

/**
 * CalendarController for managing calendar operations and calendar-related functionality
 */
class CalendarController extends Controller
{
    /**
     * Get calendar data for a specific date range
     */
    public function getCalendarData(Request $request): JsonResponse
    {
        $validatedData = $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'driver_ids' => 'array',
            'driver_ids.*' => 'integer|exists:users,id',
            'status' => 'in:planned,in_progress,completed,cancelled,all',
        ]);

        $startDate = $validatedData['start_date'];
        $endDate = $validatedData['end_date'];
        $driverIds = $validatedData['driver_ids'] ?? [];
        $status = $validatedData['status'] ?? 'all';

        // Build query for delivery schedules
        $schedulesQuery = DeliverySchedule::with(['shipment', 'driver'])
            ->whereBetween('delivery_date', [$startDate, $endDate]);

        // Filter by drivers if specified
        if (!empty($driverIds)) {
            $schedulesQuery->whereIn('driver_id', $driverIds);
        }

        // Filter by status if specified
        if ($status !== 'all') {
            $schedulesQuery->where('status', $status);
        }

        $schedules = $schedulesQuery->get();

        // Get time slots for the date range
        $timeSlotsQuery = DeliveryTimeSlot::with('driver')
            ->whereBetween('slot_date', [$startDate, $endDate]);

        if (!empty($driverIds)) {
            $timeSlotsQuery->whereIn('driver_id', $driverIds);
        }

        $timeSlots = $timeSlotsQuery->get();

        // Get route plans for the date range
        $routePlansQuery = RoutePlan::with('driver')
            ->whereBetween('route_date', [$startDate, $endDate]);

        if (!empty($driverIds)) {
            $routePlansQuery->whereIn('driver_id', $driverIds);
        }

        $routePlans = $routePlansQuery->get();

        // Group data by date for calendar view
        $calendarData = [];

        $currentDate = Carbon::parse($startDate);
        $endDateObj = Carbon::parse($endDate);

        while ($currentDate <= $endDateObj) {
            $dateKey = $currentDate->format('Y-m-d');

            $calendarData[$dateKey] = [
                'date' => $dateKey,
                'schedules' => DeliveryScheduleResource::collection(
                    $schedules->where('delivery_date', $dateKey)
                ),
                'time_slots' => DeliveryTimeSlotResource::collection(
                    $timeSlots->where('slot_date', $dateKey)
                ),
   'route_plans' => $routePlans->where('route_date', $dateKey)->map(function ($routePlan) {
      return [
       'id' => $routePlan->id,
          'driver_id' => $routePlan->driver_id,
       'driver_name' => $routePlan->driver->name ?? 'Unknown',
   'route_status' => $routePlan->route_status,
'efficiency_score' => $routePlan->efficiency_score,
    'total_distance' => $routePlan->total_distance,
'waypoints_count' => count($routePlan->waypoints ?? []),
          'can_start' => $routePlan->canStart(),
                ];
                }),
                'summary' => [
      'total_schedules' => $schedules->where('delivery_date', $dateKey)->count(),
   'active_schedules' => $schedules->where('delivery_date', $dateKey)->where('status', 'in_progress')->count(),
                'completed_schedules' => $schedules->where('delivery_date', $dateKey)->where('status', 'completed')->count(),
             'available_time_slots' => $timeSlots->where('slot_date', $dateKey)->filter->isAvailable()->count(),
        'active_routes' => $routePlans->where('route_date', $dateKey)->where('route_status', 'active')->count(),
      ],
            ];

            $currentDate->addDay();
        }

        return response()->json([
            'data' => array_values($calendarData),
            'meta' => [
                'date_range' => [
        'start_date' => $startDate,
      'end_date' => $endDate,
              ],
                'total_schedules' => $schedules->count(),
                'total_time_slots' => $timeSlots->count(),
                'total_route_plans' => $routePlans->count(),
  ],
        ]);
    }

    /**
     * Get daily overview for dashboard
     */
    public function getDailyOverview(Request $request): JsonResponse
    {
        $validatedData = $request->validate([
            'date' => 'required|date',
        ]);

        $date = $validatedData['date'];

        // Get data for the specific date
        $schedules = DeliverySchedule::with(['shipment', 'driver'])
            ->where('delivery_date', $date)
   ->get();

        $timeSlots = DeliveryTimeSlot::with('driver')
            ->where('slot_date', $date)
            ->get();

        $routePlans = RoutePlan::with('driver')
     ->where('route_date', $date)
            ->get();

        // Calculate statistics
        $statusCounts = $schedules->groupBy('status')->map->count();
        $totalCapacity = $timeSlots->sum('capacity');
        $totalBooked = $timeSlots->sum('booked');
        $availableCapacity = $totalCapacity - $totalBooked;

     return response()->json([
         'data' => [
   'date' => $date,
    'schedules' => [
                'total' => $schedules->count(),
   'by_status' => [
        'scheduled' => $statusCounts['scheduled'] ?? 0,
         'in_progress' => $statusCounts['in_progress'] ?? 0,
       'completed' => $statusCounts['completed'] ?? 0,
  'cancelled' => $statusCounts['cancelled'] ?? 0,
    ],
       'by_driver' => $this->groupByDriver($schedules),
         ],
  'time_slots' => [
    'total' => $timeSlots->count(),
                'available' => $timeSlots->filter->isAvailable()->count(),
   'limited' => $timeSlots->filter->isLimited()->count(),
          'full' => $timeSlots->filter->isFull()->count(),
         'blocked' => $timeSlots->filter->isBlocked()->count(),
                'total_capacity' => $totalCapacity,
    'booked_capacity' => $totalBooked,
  'available_capacity' => $availableCapacity,
           'utilization_percentage' => $totalCapacity > 0 ? (int)(($totalBooked / $totalCapacity) * 100) : 0,
                ],
    'routes' => [
    'total' => $routePlans->count(),
     'by_status' => [
             'planned' => $routePlans->where('route_status', 'planned')->count(),
                'active' => $routePlans->where('route_status', 'active')->count(),
  'completed' => $routePlans->where('route_status', 'completed')->count(),
      'cancelled' => $routePlans->where('route_status', 'cancelled')->count(),
      ],
        'ready_to_start' => $routePlans->filter->canStart()->count(),
            ],
   ],
        ]);
    }

    /**
     * Get weekly calendar view
     */
    public function getWeeklyCalendar(Request $request): JsonResponse
    {
        $validatedData = $request->validate([
       'week_start' => 'required|date',
      'driver_ids' => 'array',
       'driver_ids.*' => 'integer|exists:users,id',
        ]);

        $weekStart = Carbon::parse($validatedData['week_start'])->startOfWeek();
        $weekEnd = $weekStart->copy()->endOfWeek();
        $driverIds = $validatedData['driver_ids'] ?? [];

        return $this->getCalendarDataForRange($weekStart->format('Y-m-d'), $weekEnd->format('Y-m-d'), $driverIds);
    }

    /**
     * Get monthly calendar view
     */
    public function getMonthlyCalendar(Request $request): JsonResponse
    {
        $validatedData = $request->validate([
      'month' => 'required|date_format:Y-m',
        'driver_ids' => 'array',
    'driver_ids.*' => 'integer|exists:users,id',
        ]);

        $monthDate = Carbon::parse($validatedData['month'] . '-01');
        $monthStart = $monthDate->copy()->startOfMonth();
        $monthEnd = $monthDate->copy()->endOfMonth();

        $driverIds = $validatedData['driver_ids'] ?? [];

   return $this->getCalendarDataForRange($monthStart->format('Y-m-d'), $monthEnd->format('Y-m-d'), $driverIds);
    }

    /**
    * Get driver availability for calendar
     */
    public function getDriverAvailability(Request $request): JsonResponse
    {
      $validatedData = $request->validate([
          'driver_id' => 'required|integer|exists:users,id',
          'start_date' => 'required|date',
          'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $driverId = $validatedData['driver_id'];
        $startDate = $validatedData['start_date'];
        $endDate = $validatedData['end_date'];

        // Get time slots within the date range for the specific driver
 $timeSlots = DeliveryTimeSlot::where('driver_id', $driverId)
        ->whereBetween('slot_date', [$startDate, $endDate])
     ->get();

        // Get delivery schedules within the date range for the specific driver
        $schedules = DeliverySchedule::where('driver_id', $driverId)
       ->whereBetween('delivery_date', [$startDate, $endDate])
            ->get();

   // Get route plans within the date range for the specific driver
        $routePlans = RoutePlan::where('driver_id', $driverId)
     ->whereBetween('route_date', [$startDate, $endDate])
            ->get();

      return response()->json([
     'data' => [
       'driver_id' => $driverId,
    'date_range' => [
           'start_date' => $startDate,
    'end_date' => $endDate,
            ],
  'availability' => [
        'time_slots' => DeliveryTimeSlotResource::collection($timeSlots),
        'occupied_slots' => $schedules->count(),
        'route_plans' => $routePlans->map(function ($routePlan) {
          return [
         'id' => $routePlan->id,
 'date' => $routePlan->route_date,
        'status' => $routePlan->route_status,
   'can_start' => $routePlan->canStart(),
       ];
             }),
                ],
            ],
        ]);
    }

    /**
 * Helper method to get calendar data for a specific date range
     */
    private function getCalendarDataForRange(string $startDate, string $endDate, array $driverIds = []): JsonResponse
    {
  $request = request()->merge([
      'start_date' => $startDate,
      'end_date' => $endDate,
            'driver_ids' => $driverIds,
        ]);

        return $this->getCalendarData($request);
    }

    /**
    * Helper method to group schedules by driver
     */
    private function groupByDriver($schedules): array
    {
        return $schedules->groupBy('driver_id')
   ->map(function ($driverSchedules, $driverId) {
                return [
     'driver_id' => $driverId,
                    'driver_name' => $driverSchedules->first()->driver->name ?? 'Unknown',
          'schedule_count' => $driverSchedules->count(),
             'by_status' => $driverSchedules->groupBy('status')->map->count(),
        ];
          })
   ->values()
       ->toArray();
    }

  /**
     * Get schedule conflicts for calendar view
     */
    public function getScheduleConflicts(Request $request): JsonResponse
    {
        $validatedData = $request->validate([
      'date' => 'required|date',
'driver_ids' => 'array',
          'driver_ids.*' => 'integer|exists:users,id',
        ]);

 $date = $validatedData['date'];
        $driverIds = $validatedData['driver_ids'] ?? [];

        $conflicts = [];

        // Check for overlapping schedules within time slots
        $timeSlots = DeliveryTimeSlot::where('slot_date', $date)
       ->when(!empty($driverIds), function ($query) use ($driverIds) {
         return $query->whereIn('driver_id', $driverIds);
            })
    ->get();

   foreach ($timeSlots as $timeSlot) {
   $overlappingSchedules = DeliverySchedule::where('driver_id', $timeSlot->driver_id)
        ->where('delivery_date', $date)
        ->where('start_time', '<', $timeSlot->end_time)
          ->where('end_time', '>', $timeSlot->start_time)
           ->where('status', '!=', 'cancelled')
     ->get();

            if ($overlappingSchedules->count() > 1) {
   $conflicts[] = [
    'type' => 'time_overlap',
            'driver_id' => $timeSlot->driver_id,
           'driver_name' => $timeSlot->driver->name ?? 'Unknown',
    'time_slot' => $timeSlot->getTimeSlotAttribute(),
                'conflicting_schedules' => DeliveryScheduleResource::collection($overlappingSchedules),
];
      }
        }

        // Check for overbooked time slots
      $overbookedSlots = $timeSlots->filter(function ($slot) {
         return $slot->booked > $slot->capacity;
        });

        foreach ($overbookedSlots as $timeSlot) {
    $conflicts[] = [
      'type' => 'overbooked_slot',
    'driver_id' => $timeSlot->driver_id,
        'driver_name' => $timeSlot->driver->name ?? 'Unknown',
       'time_slot' => $timeSlot->getTimeSlotAttribute(),
       'capacity' => $timeSlot->capacity,
      'booked' => $timeSlot->booked,
     'overage' => $timeSlot->booked - $timeSlot->capacity,
           ];
        }

        return response()->json([
   'data' => [
  'date' => $date,
        'conflicts_count' => count($conflicts),
'conflicts' => $conflicts,
               ],
        ]);
    }
}