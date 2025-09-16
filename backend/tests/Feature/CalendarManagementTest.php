<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;
use App\Models\User;
use App\Models\DeliverySchedule;
use App\Models\DeliveryTimeSlot;
use App\Models\RoutePlan;
use App\Models\Shipment;
use Laravel\Sanctum\Sanctum;
use Carbon\Carbon;

/**
 * Feature tests for Calendar Management System (Story 5)
 */
class CalendarManagementTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    private User $driver;
    private User $supervisor;
    private DeliverySchedule $schedule;

    protected function setUp(): void
    {
        parent::setUp();

        // Create test users
        $this->driver = User::factory()->create(['role' => 'driver']);
        $this->supervisor = User::factory()->create(['role' => 'supervisor']);
    }

    /**
     * Test calendar data retrieval for authorized users
     */
    public function test_can_retrieve_calendar_data_for_date_range()
    {
        Sanctum::actingAs($this->supervisor);

        $this->schedule = DeliverySchedule::factory()->create([
            'driver_id' => $this->driver->id,
            'delivery_date' => now()->addDays(3)->format('Y-m-d'),
            'status' => 'scheduled'
        ]);

        $response = $this->postJson('/api/calendar/schedule', [
            'start_date' => now()->format('Y-m-d'),
            'end_date' => now()->addDays(7)->format('Y-m-d')
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'schedules',
                    'time_slots',
                    'route_plans'
                ]
            ]);
    }

    /**
     * Test driver's calendar view permission
     */
    public function test_drivers_can_only_view_their_own_schedule()
    {
        Sanctum::actingAs($this->driver);

        $driverSchedule = DeliverySchedule::factory()->create([
            'driver_id' => $this->driver->id,
            'delivery_date' => now()->format('Y-m-d')
        ]);

        $otherDriverSchedule = DeliverySchedule::factory()->create([
            'driver_id' => User::factory()->create(['role' => 'driver'])->id,
            'delivery_date' => now()->format('Y-m-d')
        ]);

        $response = $this->postJson('/api/calendar/schedule', [
            'start_date' => now()->format('Y-m-d'),
            'end_date' => now()->format('Y-m-d')
        ]);

        $response->assertStatus(200);
        $schedules = $response->json('data.schedules');

        $this->assertArrayHasKey($driverSchedule->id, array_combine(array_column($schedules, 'id'), $schedules));
        $this->assertArrayNotHasKey($otherDriverSchedule->id, array_combine(array_column($schedules, 'id'), $schedules));
    }

    /**
     * Test calendar view mode options (day/week/month)
     */
    public function test_calendar_supports_multiple_view_modes()
    {
        Sanctum::actingAs($this->supervisor);

        $response = $this->postJson('/api/calendar/schedule', [
            'start_date' => now()->format('Y-m-d'),
            'end_date' => now()->addMonth()->format('Y-m-d'),
            'view' => 'month'
        ]);

        $response->assertStatus(200);

        // Test week view
        $response = $this->postJson('/api/calendar/schedule', [
            'start_date' => now()->format('Y-m-d'),
            'end_date' => now()->addWeek()->format('Y-m-d'),
            'view' => 'week'
        ]);

        $response->assertStatus(200);

        // Test day view
        $response = $this->postJson('/api/calendar/schedule', [
            'start_date' => now()->format('Y-m-d'),
            'end_date' => now()->format('Y-m-d'),
            'view' => 'day'
        ]);

        $response->assertStatus(200);
    }

    /**
     * Test scheduling conflict detection
     */
    public function test_calendar_detects_scheduling_conflicts()
    {
        Sanctum::actingAs($this->supervisor);

        $slot1 = DeliveryTimeSlot::factory()->create([
            'driver_id' => $this->driver->id,
            'slot_date' => now()->format('Y-m-d'),
            'start_time' => '09:00',
            'end_time' => '11:00',
            'capacity' => 1,
            'booked' => 1
        ]);

        $response = $this->postJson('/api/calendar/scheduling-conflicts', [
            'driver_id' => $this->driver->id,
            'date' => now()->format('Y-m-d'),
            'start_time' => '10:00',
            'end_time' => '12:00'
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'conflicts' => [
                        [
                            'id' => $slot1->id,
                            'slot_label' => $slot1->slot_label
                        ]
                    ]
                ]
            ]);
    }

    /**
     * Test unauthenticated access is blocked
     */
    public function test_unauthenticated_users_cannot_access_calendar_data()
    {
        $response = $this->postJson('/api/calendar/schedule', [
            'start_date' => now()->format('Y-m-d'),
            'end_date' => now()->addDays(7)->format('Y-m-d')
        ]);

        $response->assertStatus(401);
    }

    /**
     * Test invalid date range validation
     */
    public function test_invalid_date_ranges_return_error()
    {
        Sanctum::actingAs($this->supervisor);

        $response = $this->postJson('/api/calendar/schedule', [
            'start_date' => now()->addDays(7)->format('Y-m-d'),
            'end_date' => now()->format('Y-m-d') // End before start
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['end_date']);
    }

    /**
     * Test calendar data with time zone handling
     */
    public function test_calendar_handles_time_zones_correctly()
    {
        Sanctum::actingAs($this->supervisor);

        $response = $this->postJson('/api/calendar/schedule', [
            'start_date' => now()->format('Y-m-d'),
            'end_date' => now()->addDays(7)->format('Y-m-d'),
            'timezone' => 'America/New_York'
        ]);

        $response->assertStatus(200);
    }

    /**
     * Test calendar performance with large dataset
     */
    public function test_calendar_performance_with_large_dataset()
    {
        Sanctum::actingAs($this->supervisor);

        // Create 100+ schedules and time slots
        DeliverySchedule::factory(150)->create([
            'delivery_date' => now()->addDays(2)->format('Y-m-d')
        ]);

        DeliveryTimeSlot::factory(100)->create([
            'slot_date' => now()->format('Y-m-d')
        ]);

        $startTime = microtime(true);
        $response = $this->postJson('/api/calendar/schedule', [
            'start_date' => now()->format('Y-m-d'),
            'end_date' => now()->addDays(7)->format('Y-m-d')
        ]);
        $endTime = microtime(true);

        $response->assertStatus(200);

        // Assert performance requirement: < 2 seconds
        $this->assertLessThan(2.0, $endTime - $startTime, 'Calendar load time exceeded 2 seconds');
    }

    /**
     * Test calendar data format consistency
     */
    public function test_calendar_returns_consistent_data_format()
    {
        Sanctum::actingAs($this->supervisor);

        DeliverySchedule::factory(5)->create([
            'delivery_date' => now()->format('Y-m-d')
        ]);

        $response = $this->postJson('/api/calendar/schedule', [
            'start_date' => now()->format('Y-m-d'),
            'end_date' => now()->format('Y-m-d')
        ]);

        $response->assertStatus(200);

        $schedules = $response->json('data.schedules');

        foreach ($schedules as $schedule) {
            $this->assertArrayHasKey('id', $schedule);
            $this->assertArrayHasKey('shipment_id', $schedule);
            $this->assertArrayHasKey('driver_id', $schedule);
            $this->assertArrayHasKey('delivery_date', $schedule);
            $this->assertArrayHasKey('start_time', $schedule);
            $this->assertArrayHasKey('end_time', $schedule);
            $this->assertArrayHasKey('status', $schedule);
            $this->assertArrayHasKey('metadata', $schedule);
        }
    }

    /**
     * Test driver availability checking
     */
    public function test_can_check_driver_availability()
    {
        Sanctum::actingAs($this->supervisor);

        $response = $this->getJson('/api/calendar/availability/' . $this->driver->id);

        $response->assertStatus(200)
            ->assertJsonStructur([
                'success',
                'data' => [
                    'driver_id',
                    'availability',
                    'time_slots',
                    'bookings'
                ]
            ]);
    }

    /**
     * Test bulk scheduling operations
     */
    public function test_bulk_scheduling_operations_work_correctly()
    {
        Sanctum::actingAs($this->supervisor);

        $schedules = DeliverySchedule::factory(5)->create([
            'delivery_date' => now()->addDays(1)->format('Y-m-d')
        ]);

        $updates = [
            [
                'id' => $schedules[0]->id,
                'status' => 'in_progress'
            ],
            [
                'id' => $schedules[1]->id,
                'status' => 'completed'
            ]
        ];

        $response = $this->postJson('/api/calendar/bulk-update', [
            'updates' => $updates
        ]);

        $response->assertStatus(200);

        $this->assertDatabaseHas('delivery_schedules', [
            'id' => $schedules[0]->id,
            'status' => 'in_progress'
        ]);

        $this->assertDatabaseHas('delivery_schedules', [
            'id' => $schedules[1]->id,
            'status' => 'completed'
        ]);
    }
}