<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Shipment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Laravel\Sanctum\Sanctum;

class ShipmentTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create and authenticate a user
        $this->user = User::factory()->create([
            'email' => 'test@example.com',
            'name' => 'Test User'
        ]);
        
        Sanctum::actingAs($this->user);
    }

    /** @test */
    public function it_can_list_all_shipments()
    {
        // Create test shipments
        Shipment::factory()->count(5)->create([
            'customer_name' => 'Test Customer',
            'status' => 'in_transit'
        ]);

        $response = $this->getJson('/api/shipments');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'shipments' => [
                        '*' => [
                            'id',
                            'dolibarr_shipment_id',
                            'reference',
                            'customer_name',
                            'delivery_address',
                            'status',
                            'expected_delivery',
                            'assigned_driver',
                            'total_weight',
                            'total_value'
                        ]
                    ],
                    'pagination' => [
                        'current_page',
                        'total_pages',
                        'total_items',
                        'items_per_page'
                    ]
                ]
            ]);

        $this->assertCount(5, $response->json('data.shipments'));
        $this->assertEquals(5, $response->json('data.pagination.total_items'));
    }

    /** @test */
    public function it_can_paginate_shipments()
    {
        // Create 15 shipments
        Shipment::factory()->count(15)->create();

        // Request page 2 with 5 items per page
        $response = $this->getJson('/api/shipments?page=2&per_page=5');

        $response->assertStatus(200);
        $this->assertCount(5, $response->json('data.shipments'));
        $this->assertEquals(2, $response->json('data.pagination.current_page'));
        $this->assertEquals(15, $response->json('data.pagination.total_items'));
        $this->assertEquals(3, $response->json('data.pagination.total_pages'));
    }

    /** @test */
    public function it_requires_authentication_for_shipments()
    {
        // Log out the user
        Sanctum::actingAs(new User());
        
        $response = $this->getJson('/api/shipments');
        
        // Since we're creating an empty user, we should get 401
        $response->assertStatus(401);
    }

    /** @test */
    public function it_can_get_shipment_by_id()
    {
        $shipment = Shipment::factory()->create([
            'reference' => 'SHIP-001',
            'customer_name' => 'Acme Corp',
            'status' => 'delivered'
        ]);

        $response = $this->getJson("/api/shipments/{$shipment->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'shipment' => [
                        'id',
                        'dolibarr_shipment_id',
                        'reference',
                        'customer_name',
                        'delivery_address',
                        'status',
                        'expected_delivery',
                        'assigned_driver',
                        'total_weight',
                        'total_value'
                    ]
                ]
            ]);

        $this->assertEquals($shipment->id, $response->json('data.shipment.id'));
        $this->assertEquals('SHIP-001', $response->json('data.shipment.reference'));
        $this->assertEquals('Acme Corp', $response->json('data.shipment.customer_name'));
    }

    /** @test */
    public function it_returns_404_for_non_existent_shipment()
    {
        $response = $this->getJson('/api/shipments/999999');

        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
                'error' => 'Shipment not found'
            ]);
    }

    /** @test */
    public function it_can_filter_shipments_by_status()
    {
        // Create shipments with different statuses
        Shipment::factory()->count(3)->create(['status' => 'in_transit']);
        Shipment::factory()->count(2)->create(['status' => 'delivered']);
        Shipment::factory()->count(1)->create(['status' => 'pending']);

        $response = $this->getJson('/api/shipments/status/in_transit');

        $response->assertStatus(200);
        $this->assertCount(3, $response->json('data.shipments'));
        
        // Verify all returned shipments have the correct status
        foreach ($response->json('data.shipments') as $shipment) {
            $this->assertEquals('in_transit', $shipment['status']);
        }
    }

    /** @test */
    public function it_can_get_shipments_assigned_to_current_user()
    {
        // Create test shipments assigned to the current user
        Shipment::factory()->count(4)->create([
            'assigned_driver_id' => $this->user->id
        ]);

        // Create other shipments not assigned to this user
        Shipment::factory()->count(3)->create([
            'assigned_driver_id' => 999
        ]);

        $response = $this->getJson('/api/shipments/my');

        $response->assertStatus(200);
        $this->assertCount(4, $response->json('data.shipments'));
    }

    /** @test */
    public function it_respects_rate_limiting()
    {
        // Make 65 requests (exceeding the 60 requests/minute limit)
        for ($i = 0; $i < 65; $i++) {
            $response = $this->getJson('/api/shipments');
            
            if ($i < 60) {
                $response->assertStatus(200);
            } else {
                // Should be rate limited after 60 requests
                $response->assertStatus(429);
            }
        }
    }

    /** @test */
    public function it_validates_page_parameter()
    {
        $response = $this->getJson('/api/shipments?page=invalid');
        
        // Should either validate or default to page 1
        $this->assertContains($response->status(), [200, 400]);
    }

    /** @test */
    public function it_validates_per_page_parameter()
    {
        $response = $this->getJson('/api/shipments?per_page=invalid');
        
        // Should either validate or default to default per page
        $this->assertContains($response->status(), [200, 400]);
    }

    /** @test */
    public function it_handles_empty_shipment_list_gracefully()
    {
        $response = $this->getJson('/api/shipments');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'shipments',
                    'pagination'
                ]
            ]);

        $this->assertCount(0, $response->json('data.shipments'));
        $this->assertEquals(0, $response->json('data.pagination.total_items'));
    }
}