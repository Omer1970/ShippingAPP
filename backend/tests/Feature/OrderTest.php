<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Laravel\Sanctum\Sanctum;

class OrderTest extends TestCase
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
    public function it_can_list_all_orders()
    {
        // Create test orders
        Order::factory()->count(5)->create([
            'customer_name' => 'Test Customer',
            'status' => 'processing',
            'total_amount' => 1500.00
        ]);

        $response = $this->getJson('/api/orders');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'orders' => [
                        '*' => [
                            'id',
                            'dolibarr_order_id',
                            'reference',
                            'customer_id',
                            'customer_name',
                            'order_date',
                            'status',
                            'total_amount',
                            'shipping_address',
                            'billing_address'
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

        $this->assertCount(5, $response->json('data.orders'));
        $this->assertEquals(5, $response->json('data.pagination.total_items'));
    }

    /** @test */
    public function it_can_paginate_orders()
    {
        // Create 20 orders
        Order::factory()->count(20)->create();

        // Request page 2 with 10 items per page
        $response = $this->getJson('/api/orders?page=2&per_page=10');

        $response->assertStatus(200);
        $this->assertCount(10, $response->json('data.orders'));
        $this->assertEquals(2, $response->json('data.pagination.current_page'));
        $this->assertEquals(20, $response->json('data.pagination.total_items'));
        $this->assertEquals(2, $response->json('data.pagination.total_pages'));
    }

    /** @test */
    public function it_requires_authentication_for_orders()
    {
        // Log out the user
        Sanctum::actingAs(new User());
        
        $response = $this->getJson('/api/orders');
        
        // Since we're creating an empty user, we should get 401
        $response->assertStatus(401);
    }

    /** @test */
    public function it_can_get_order_by_id()
    {
        $order = Order::factory()->create([
            'reference' => 'ORDER-001',
            'customer_name' => 'Acme Corp',
            'status' => 'delivered',
            'total_amount' => json_encode([
                'exclTax' => 1000.00,
                'inclTax' => 1200.00,
                'currency' => 'EUR'
            ])
        ]);

        $response = $this->getJson("/api/orders/{$order->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'order' => [
                        'id',
                        'dolibarr_order_id',
                        'reference',
                        'customer_id',
                        'customer_name',
                        'order_date',
                        'status',
                        'total_amount',
                        'shipping_address',
                        'billing_address'
                    ]
                ]
            ]);

        $this->assertEquals($order->id, $response->json('data.order.id'));
        $this->assertEquals('ORDER-001', $response->json('data.order.reference'));
        $this->assertEquals('Acme Corp', $response->json('data.order.customer_name'));
        $this->assertEquals('delivered', $response->json('data.order.status'));
    }

    /** @test */
    public function it_returns_404_for_non_existent_order()
    {
        $response = $this->getJson('/api/orders/999999');

        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
                'error' => 'Order not found'
            ]);
    }

    /** @test */
    public function it_can_filter_orders_by_status()
    {
        // Create orders with different statuses
        Order::factory()->count(3)->create(['status' => 'processing']);
        Order::factory()->count(2)->create(['status' => 'shipped']);
        Order::factory()->count(1)->create(['status' => 'cancelled']);

        $response = $this->getJson('/api/orders/status/processing');

        $response->assertStatus(200);
        $this->assertCount(3, $response->json('data.orders'));
        
        // Verify all returned orders have the correct status
        foreach ($response->json('data.orders') as $order) {
            $this->assertEquals('processing', $order['status']);
        }
    }

    /** @test */
    public function it_can_get_orders_by_customer()
    {
        $customerId = 123;
        
        // Create test orders for a specific customer
        Order::factory()->count(4)->create([
            'customer_id' => $customerId,
            'customer_name' => 'Test Customer'
        ]);

        // Create other orders for different customers  
        Order::factory()->count(3)->create([
            'customer_id' => 456,
            'customer_name' => 'Other Customer'
        ]);

        $response = $this->getJson("/api/orders/customer/{$customerId}");

        $response->assertStatus(200);
        $this->assertCount(4, $response->json('data.orders'));
        
        // Verify all returned orders belong to the requested customer
        foreach ($response->json('data.orders') as $order) {
            $this->assertEquals($customerId, $order['customer_id']);
        }
    }

    /** @test */
    public function it_can_format_order_amounts_correctly()
    {
        $order = Order::factory()->create([
            'total_amount' => json_encode([
                'exclTax' => 999.99,
                'inclTax' => 1199.99,
                'currency' => 'USD'
            ])
        ]);

        $response = $this->getJson("/api/orders/{$order->id}");

        $response->assertStatus(200);
        
        $orderData = $response->json('data.order');
        $amount = $orderData['total_amount'];
        
        $this->assertIsArray($amount);
        $this->assertEquals(999.99, $amount['exclTax']);
        $this->assertEquals(1199.99, $amount['inclTax']);
        $this->assertEquals('USD', $amount['currency']);
    }

    /** @test */
    public function it_respects_rate_limiting()
    {
        // Make 65 requests (exceeding the 60 requests/minute limit)
        for ($i = 0; $i < 65; $i++) {
            $response = $this->getJson('/api/orders');
            
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
        $response = $this->getJson('/api/orders?page=invalid');
        
        // Should either validate or default to page 1
        $this->assertContains($response->status(), [200, 400]);
    }

    /** @test */
    public function it_validates_per_page_parameter()
    {
        $response = $this->getJson('/api/orders?per_page=invalid');
        
        // Should either validate or default to default per page
        $this->assertContains($response->status(), [200, 400]);
    }

    /** @test */
    public function it_handles_empty_order_list_gracefully()
    {
        $response = $this->getJson('/api/orders');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'orders',
                    'pagination'
                ]
            ]);

        $this->assertCount(0, $response->json('data.orders'));
        $this->assertEquals(0, $response->json('data.pagination.total_items'));
    }

    /** @test */
    public function it_includes_expected_delivery_date_in_response()
    {
        $order = Order::factory()->create([
            'expected_delivery' => '2025-09-15'
        ]);

        $response = $this->getJson("/api/orders/{$order->id}");

        $response->assertStatus(200);
        $this->assertEquals('2025-09-15', $response->json('data.order.expected_delivery'));
    }
}