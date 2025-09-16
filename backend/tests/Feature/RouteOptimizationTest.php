<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;
use App\Models\User;
use App\Models\RoutePlan;
use App\Models\DeliverySchedule;
use App\Models\Shipment;
use Laravel\Sanctum\Sanctum;
use Carbon\Carbon;

/**
 * Feature tests for Route Optimization System (Story 5)
 */
class RouteOptimizationTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    private User $driver;
    private User $supervisor;
    private RoutePlan $routePlan;

    protected function setUp(): void
    {
        parent::setUp();

        $this->driver = User::factory()->create(['role' => 'driver']);
        $this->supervisor = User::factory()->create(['role' => 'supervisor']);
    }

    /**
     * Test route optimization with multiple deliveries
     */
    public function test_can_optimize_route_with_multiple_deliveries()
    {
        Sanctum::actingAs($this->supervisor);

        // Create test deliveries with different addresses
        $deliveries = [];
        for ($i = 0; $i < 5; $i++) {
            $deliveries[] = [
                'delivery_id' => DeliverySchedule::factory()->create([
                    'driver_id' => $this->driver->id,
                    'delivery_date' => now()->format('Y-m-d')
                ])->id,
                'address' => $this->faker->address,
                'coordinates' => [
                    'lat' => $this->faker->latitude,
                    'lng' => $this->faker->longitude
                ],
                'priority' => $i + 1,
                'delivery_window' => [
                    'start' => '09:00',
                    'end' => '17:00'
                ]
            ];
        }

        $response = $this->postJson('/api/routes/optimize', [
            'deliveries' => $deliveries,
            'driver_id' => $this->driver->id,
            'optimization_method' => 'multiple_stops',
            'include_traffic' => true,
            'preferred_time' => '06:00',
            'constraints' => [
                'max_distance' => 100,
                'max_duration' => 480 // 8 hours
            ]
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'route_plan',
                    'optimized_route',
                    'total_distance',
                    'estimated_duration',
                    'efficiency_score'
                ]
            ]);

        $result = $response->json('data');
        $this->assertNotEmpty($result['optimized_route']);
        $this->assertGreaterThan(0, $result['efficiency_score']);
        $this->assertLessThanOrEqual(100, $result['efficiency_score']);
    }

    /**
     * Test current day route retrieval
     */
    public function test_can_retrieve_current_day_route_for_driver()
    {
        Sanctum::actingAs($this->driver);

        $routePlan = RoutePlan::factory()->create([
            'driver_id' => $this->driver->id,
            'delivery_date' => now()->format('Y-m-d'),
            'status' => 'planned'
        ]);

        DeliverySchedule::factory(3)->create([
            'route_plan_id' => $routePlan->id,
            'driver_id' => $this->driver->id,
            'delivery_date' => now()->format('Y-m-d'),
            'route_order' => 1
        ]);

        $response = $this->getJson("/api/routes/{$this->driver->id}/today");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'route_plan',
                    'deliveries',
                    'optimized_route',
                    'progress'
                ]
            ]);
    }

    /**
     * Test route reordering functionality
     */
    public function test_can_reorder_existing_deliveries()
    {
        Sanctum::actingAs($this->supervisor);

        $routePlan = RoutePlan::factory()->create([
            'driver_id' => $this->driver->id,
            'delivery_date' => now()->format('Y-m-d')
        ]);

        $deliveries = [];
        for ($i = 1; $i <= 3; $i++) {
            $delivery = DeliverySchedule::factory()->create([
                'route_plan_id' => $routePlan->id,
                'driver_id' => $this->driver->id,
                'delivery_date' => now()->format('Y-m-d'),
                'route_order' => $i
            ]);
            $deliveries[] = $delivery->id;
        }

        $response = $this->postJson("/api/routes/{$routePlan->id}/reorder", [
            'delivery_order' => array_reverse($deliveries) // Reverse the order
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Route reordered successfully'
            ]);

        // Verify new order
        $this->assertDatabaseHas('delivery_schedules', [
            'id' => $deliveries[0],
            'route_order' => 3 // Was 1, now 3
        ]);

        $this->assertDatabaseHas('delivery_schedules', [
            'id' => $deliveries[2],
            'route_order' => 1 // Was 3, now 1
        ]);
    }

    /**
     * Test route suggestions engine
     */
    public function test_route_suggestions_work_correctly()
    {
        Sanctum::actingAs($this->supervisor);

        $baseDelivery = DeliverySchedule::factory()->create([
            'driver_id' => $this->driver->id,
            'delivery_date' => now()->format('Y-m-d'),
            'route_order' => 1
        ]);

        // Create nearby deliveries
        DeliverySchedule::factory(3)->create([
            'driver_id' => $this->driver->id,
            'delivery_date' => now()->format('Y-m-d'),
            'route_order' => 0 // Unassigned
        ]);

        $response = $this->getJson("/api/routes/suggestions/{$baseDelivery->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'current_delivery',
                    'suggested_additions',
                    'efficiency_impact'
                ]
            ]);
    }

    /**
     * Test route start and completion tracking
     */
    public function test_route_progress_tracking_works_correctly()
    {
        Sanctum::actingAs($this->driver);

        $routePlan = RoutePlan::factory()->create([
            'driver_id' => $this->driver->id,
            'delivery_date' => now()->format('Y-m-d'),
            'status' => 'planned',
            'start_time' => null,
            'end_time' => null
        ]);

        // Start route
        $response = $this->postJson("/api/routes/{$routePlan->id}/start");
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Route started successfully'
            ]);

        $routePlan->refresh();
        $this->assertEquals('active', $routePlan->status);
        $this->assertNotNull($routePlan->start_time);

        // Complete route
        sleep(1); // Ensure time difference

        $stopCountData = [
            'deliveries_completed' => 5,
            'deliveries_skipped' => 1,
            'fuel_consumption' => 15.5,
            'distance_traveled' => 25.3
        ];

        $response = $this->postJson("/api/routes/{$routePlan->id}/complete", $stopCountData);
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Route completed successfully'
            ]);

        $routePlan->refresh();
        $this->assertEquals('completed', $routePlan->status);
        $this->assertNotNull($routePlan->end_time);
        $this->assertNotNull($routePlan->actual_durations);
        $this->assertEquals($stopCountData['distance_traveled'], $routePlan->actual_distance);
    }

    /**
     * Test route optimization with different algorithms
     */
    public function test_multiple_optimization_algorithms_available()
    {
        Sanctum::actingAs($this->supervisor);

        $deliveries = [];
        for ($i = 0; $i < 3; $i++) {
            $deliveries[] = [
                'delivery_id' => DeliverySchedule::factory()->create([
                    'driver_id' => $this->driver->id
                ])->id,
                'address' => $this->faker->address,
                'coordinates' => [
                    'lat' => $this->faker->latitude,
                    'lng' => $this->faker->longitude
                ],
                'priority' => $i + 1
            ];
        }

        // Test TSP (Traveling Salesperson) algorithm
        $response1 = $this->postJson('/api/routes/optimize', [
            'deliveries' => $deliveries,
            'driver_id' => $this->driver->id,
            'optimization_method' => 'tsp'
        ]);

        $response1->assertStatus(200);

        // Test Google Maps algorithm
        $response2 = $this->postJson('/api/routes/optimize', [
            'deliveries' => $deliveries,
            'driver_id' => $this->driver->id,
            'optimization_method' => 'google_maps'
        ]);

        $response2->assertStatus(200);

        // Test OSRM algorithm
        $response3 = $this->postJson('/api/routes/optimize', [
            'deliveries' => $deliveries,
            'driver_id' => $this->driver->id,
            'optimization_method' => 'osrm'
        ]);

        $response3->assertStatus(200);
    }

    /**
     * Test route optimization with traffic consideration
     */
    public function test_route_optimization_considers_traffic()
    {
        Sanctum::actingAs($this->supervisor);

        $deliveries = [];
        for ($i = 0; $i < 3; $i++) {
            $deliveries[] = [
                'delivery_id' => DeliverySchedule::factory()->create([
                    'driver_id' => $this->driver->id
                ])->id,
                'address' => $this->faker->address,
                'coordinates' => [
                    'lat' => $this->faker->latitude,
                    'lng' => $this->faker->longitude
                ],
                'priority' => $i + 1,
                'delivery_window' => $i % 2 === 0 ? ['start' => '09:00', 'end' => '12:00'] : null
            ];
        }

        $response = $this->postJson('/api/routes/optimize', [
            'deliveries' => $deliveries,
            'driver_id' => $this->driver->id,
            'include_traffic' => true,
            'api_provider' => 'google_maps'
        ]);

        $response->assertStatus(200);
        $data = $response->json('data');

        // Should include traffic data in response
        $this->assertArrayHasKey('traffic_conditions', $data);
        $this->assertArrayHasKey('estimated_travel_time_with_traffic', $data);
    }

    /**
     * Test route optimization constraints
     */
    public function test_route_optimization_respects_constraints()
    {
        Sanctum::actingAs($this->supervisor);

        $deliveries = [];
        for ($i = 0; $i < 5; $i++) {
            $deliveries[] = [
                'delivery_id' => DeliverySchedule::factory()->create([
                    'driver_id' => $this->driver->id
                ])->id,
                'address' => $this->faker->address,
                'coordinates' => [
                    'lat' => $this->faker->latitude,
                    'lng' => $this->faker->longitude
                ],
                'priority' => $i + 1,
                'delivery_window' => ['start' => '09:00', 'end' => '17:00'],
                'duration_estimate' => 30 // 30 minutes per delivery
            ];
        }

        $response = $this->postJson('/api/routes/optimize', [
            'deliveries' => $deliveries,
            'driver_id' => $this->driver->id,
            'constraints' => [
                'max_distance' => 50, // 50 km max
                'max_duration' => 360, // 6 hours max
                'required_time_windows' => true
            ]
        ]);

        $response->assertStatus(200);
        $data = $response->json('data');

        $this->assertLessThanOrEqual(50, round($data['total_distance'] / 1000, 1)); // Convert meters to km
        $this->assertLessThanOrEqual(360, round($data['estimated_duration'] / 60, 1)); // Convert seconds to minutes
    }

    /**
     * Test route optimization error handling
     */
    public function test_route_optimization_handles_api_failures_gracefully()
    {
        Sanctum::actingAs($this->supervisor);

        // Test with invalid delivery data
        $response = $this->postJson('/api/routes/optimize', [
            'deliveries' => [
                ['invalid_data' => 'test']
            ],
            'driver_id' => $this->driver->id
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['deliveries.0']);

        // Test with missing driver
        $response = $this->postJson('/api/routes/optimize', [
            'deliveries' => [
                [
                    'delivery_id' => 1,
                    'address' => '123 Test Street'
                ]
            ]
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['driver_id']);
    }

    /**
     * Test route optimization performance
     */
    public function test_route_optimization_performs_efficiently()
    {
        Sanctum::actingAs($this->supervisor);

        // Create large dataset
        $deliveries = [];
        for ($i = 0; $i < 20; $i++) {
            $deliveries[] = [
                'delivery_id' => ($i + 1),
                'address' => $this->faker->address,
                'coordinates' => [
                    'lat' => $this->faker->latitude,
                    'lng' => $this->faker->longitude
                ],
                'priority' => $i + 1
            ];
        }

        $startTime = microtime(true);
        $response = $this->postJson('/api/routes/optimize', [
            'deliveries' => $deliveries,
            'driver_id' => $this->driver->id
        ]);
        $endTime = microtime(true);

        $response->assertStatus(200);

        // Should complete within 5 seconds (as per requirements)
        $this->assertLessThan(5.0, $endTime - $startTime, 'Route optimization took longer than 5 seconds');
    }
}