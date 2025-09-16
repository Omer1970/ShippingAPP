<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;
use App\Models\User;
use App\Models\DeliveryTimeSlot;
use Laravel\Sanctum\Sanctum;
use Carbon\Carbon;

/**
 * Feature tests for Time Slot Management System (Story 5)
 */
class TimeSlotManagementTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    private User $driver;
    private User $supervisor;

    protected function setUp(): void
    {
        parent::setUp();

        $this->driver = User::factory()->create(['role' => 'driver']);
        $this->supervisor = User::factory()->create(['role' => 'supervisor']);
    }

    /**
     * Test time slot creation
     */
    public function test_can_create_time_slot()
    {
        Sanctum::actingAs($this->supervisor);

        $response = $this->postJson('/api/time-slots/', [
            'driver_id' => $this->driver->id,
            'slot_date' => now()->addDays(1)->format('Y-m-d'),
            'start_time' => '09:00',
            'end_time' => '11:00',
            'slot_label' => 'Morning Slot',
            'capacity' => 3,
            'availability' => 'available'
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'id',
                    'driver_id',
                    'slot_date',
                    'start_time',
                    'end_time',
                    'slot_label',
                    'capacity',
                    'booked',
                    'availability'
                ]
            ]);

        $this->assertDatabaseHas('delivery_time_slots', [
            'driver_id' => $this->driver->id,
            'slot_date' => now()->addDays(1)->format('Y-m-d'),
            'start_time' => '09:00',
            'availability' => 'available'
        ]);
    }

    /**
     * Test time slot booking functionality
     */
    public function test_can_book_time_slot()
    {
        Sanctum::actingAs($this->driver);

        $slot = DeliveryTimeSlot::factory()->create([
            'driver_id' => $this->driver->id,
            'slot_date' => now()->format('Y-m-d'),
            'capacity' => 2,
            'booked' => 0,
            'availability' => 'available'
        ]);

        $response = $this->postJson("/api/time-slots/{$slot->id}/book");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Time slot booked successfully'
            ]);

        $this->assertDatabaseHas('delivery_time_slots', [
            'id' => $slot->id,
            'booked' => 1,
            'availability' => 'available'
        ]);
    }

    /**
     * Test overbooking prevention
     */
    public function test_prevents_overbooking_time_slot()
    {
        Sanctum::actingAs($this->driver);

        $slot = DeliveryTimeSlot::factory()->create([
            'driver_id' => $this->driver->id,
            'slot_date' => now()->format('Y-m-d'),
            'capacity' => 1,
            'booked' => 1, // Already at capacity
            'availability' => 'available'
        ]);

        $response = $this->postJson("/api/time-slots/{$slot->id}/book");

        $response->assertStatus(409) // Conflict status
            ->assertJson([
                'success' => false,
                'message' => 'Time slot is full'
            ]);
    }

    /**
     * Test time slot availability update
     */
    public function test_can_update_time_slot_availability()
    {
        Sanctum::actingAs($this->supervisor);

        $slot = DeliveryTimeSlot::factory()->create([
            'driver_id' => $this->driver->id,
            'availability' => 'available'
        ]);

        $response = $this->putJson("/api/time-slots/{$slot->id}/availability", [
            'availability' => 'blocked'
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Time slot availability updated'
            ]);

        $this->assertDatabaseHas('delivery_time_slots', [
            'id' => $slot->id,
            'availability' => 'blocked'
        ]);
    }

    /**
     * Test bulk time slot operations
     */
    public function test_bulk_update_time_slots()
    {
        Sanctum::actingAs($this->supervisor);

        $slots = DeliveryTimeSlot::factory(3)->create([
            'driver_id' => $this->driver->id,
            'availability' => 'available'
        ]);

        $updates = [
            [
                'slot_id' => $slots[0]->id,
                'availability' => 'limited',
                'capacity' => 1
            ],
            [
                'slot_id' => $slots[1]->id,
                'availability' => 'full'
            ]
        ];

        $response = $this->postJson('/api/time-slots/bulk-update', [
            'updates' => $updates
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Time slots updated successfully'
            ]);

        $this->assertDatabaseHas('delivery_time_slots', [
            'id' => $slots[0]->id,
            'availability' => 'limited',
            'capacity' => 1
        ]);

        $this->assertDatabaseHas('delivery_time_slots', [
            'id' => $slots[1]->id,
            'availability' => 'full'
        ]);
    }

    /**
     * Test recurring time slot generation
     */
    public function test_generates_recurring_time_slots()
    {
        Sanctum::actingAs($this->supervisor);

        $response = $this->postJson('/api/time-slots/generate-recurring', [
            'driver_id' => $this->driver->id,
            'start_date' => now()->format('Y-m-d'),
            'end_date' => now()->addWeeks(2)->format('Y-m-d'),
            'start_time' => '10:00',
            'end_time' => '12:00',
            'recurrence_pattern' => 'weekly',
            'capacity' => 3,
            'recurrence_days' => [1, 2, 3, 4, 5] // Monday-Friday
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Recurring time slots generated successfully'
            ]);

        $slots = $response->json('data');
        $this->assertNotEmpty($slots);
        $this->assertGreaterThan(10, count($slots)); // Should generate multiple slots
    }

    /**
     * Test time slot configuration
     */
    public function test_can_configure_driver_time_slots()
    {
        Sanctum::actingAs($this->supervisor);

        $config = [
            'default_capacity' => 4,
            'default_start_time' => '08:00',
            'default_end_time' => '18:00',
            'availability_rules' => [
                ['day' => 'Monday', 'available' => 'true'],
                ['day' => 'Sunday', 'available' => 'false']
            ],
            'recurrence_patterns' => ['weekly', 'daily']
        ];

        $response = $this->postJson('/api/time-slots/config', [
            'driver_id' => $this->driver->id,
            ...$config
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Time slot configuration created successfully'
            ]);

        $this->assertDatabaseHas('driver_time_slot_configurations', [
            'driver_id' => $this->driver->id,
            'default_capacity' => 4
        ]);
    }

    /**
     * Test time slot availability checking
     */
    public function test_can_check_time_slot_availability()
    {
        Sanctum::actingAs($this->driver);

        $slot = DeliveryTimeSlot::factory()->create([
            'driver_id' => $this->driver->id,
            'slot_date' => now()->format('Y-m-d'),
            'start_time' => '09:00',
            'end_time' => '11:00',
            'capacity' => 2,
            'booked' => 0,
            'availability' => 'available'
        ]);

        $response = $this->getJson("/api/time-slots/{$this->driver->id}/availability?availability=available");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'driver_id',
                    'total_slots',
                    'available_slots',
                    'booked_slots',
                    'time_slots'
                ]
            ]);
    }

    /**
     * Test time consumption logic
     */
    public function test_time_slot_consumption_tracking()
    {
        Sanctum::actingAs($this->driver);

        $slot = DeliveryTimeSlot::factory()->create([
            'driver_id' => $this->driver->id,
            'capacity' => 3,
            'booked' => 1
        ]);

        // Book remaining slots
        for ($i = 0; $i < 2; $i++) {
            $response = $this->postJson("/api/time-slots/{$slot->id}/book");
            $response->assertStatus(200);
        }

        // Manually refresh the model
        $slot->refresh();

        // Check if slot status updated to full
        $this->assertEquals(3, $slot->booked);
        $this->assertEquals('full', $slot->availability);

        // Try to book again - should fail
        $response = $this->postJson("/api/time-slots/{$slot->id}/book");
        $response->assertStatus(409);
    }

    /**
     * Test invalid time slot creation
     */
    public function test_invalid_time_slot_creation_fails_validation()
    {
        Sanctum::actingAs($this->supervisor);

        $response = $this->postJson('/api/time-slots/', [
            'driver_id' => $this->driver->id,
            'slot_date' => now()->format('Y-m-d'),
            'start_time' => '14:00',
            'end_time' => '12:00', // Invalid: end before start
            'capacity' => -1, // Invalid capacity
            'availability' => 'invalid_status'
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['end_time', 'capacity', 'availability']);
    }

    /**
     * Test unauthorized access is blocked
     */
    public function test_booking_requires_authentication()
    {
        $slot = DeliveryTimeSlot::factory()->create([
            'capacity' => 2,
            'booked' => 0
        ]);

        $response = $this->postJson("/api/time-slots/{$slot->id}/book");

        $response->assertStatus(401);
    }

    /**
     * Test booking can only be done by the assigned driver
     */
    public function test_only_assigned_driver_can_book_slot()
    {
        Sanctum::actingAs($this->driver);

        $otherDriver = User::factory()->create(['role' => 'driver']);
        $slot = DeliveryTimeSlot::factory()->create([
            'driver_id' => $otherDriver->id,
            'capacity' => 2,
            'booked' => 0
        ]);

        $response = $this->postJson("/api/time-slots/{$slot->id}/book");

        $response->assertStatus(403);
    }
}