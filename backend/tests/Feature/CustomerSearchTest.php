<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Shipment;
use App\Models\CustomerSearchIndex;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Redis;
use Tests\TestCase;

class CustomerSearchTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private array $testCustomers;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create a test user
        $this->user = User::factory()->create();
        
        // Create test customer data
        $this->testCustomers = $this->createTestCustomerData();
    }

    public function test_authenticated_user_can_search_customers()
    {
        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/customers/search?q=abc');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'customers' => [
                        '*' => [
                            'id',
                            'dolibarr_customer_id',
                            'name',
                            'email',
                            'phone',
                            'customer_type',
                            'credit_status'
                        ]
                    ],
                    'metadata' => [
                        'total_results',
                        'search_time_ms',
                        'query',
                        'limit'
                    ]
                ]
            ])
            ->assertJson([
                'success' => true,
                'data' => [
                    'metadata' => [
                        'query' => 'abc',
                        'limit' => 10
                    ]
                ]
            ]);

        $this->assertGreaterThan(0, count($response->json('data.customers')));
    }

    public function test_unauthenticated_user_cannot_search_customers()
    {
        $response = $this->getJson('/api/customers/search?q=abc');
        
        $response->assertStatus(401);
    }

    public function test_autocomplete_search_returns_suggestions()
    {
        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/customers/autocomplete?q=tech');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'suggestions' => [
                        '*' => [
                            'id',
                            'name',
                            'email',
                            'customer_type',
                            'highlight'
                        ]
                    ],
                    'metadata' => [
                        'total_suggestions',
                        'search_time_ms',
                        'query'
                    ]
                ]
            ]);

        $this->assertGreaterThan(0, count($response->json('data.suggestions')));
    }

    public function test_customer_profile_loads_with_complete_data()
    {
        $customer = $this->testCustomers[0];
        
        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson("/api/customers/{$customer->id}?include_orders=true&include_shipments=true");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'customer' => [
                        'id',
                        'dolibarr_customer_id',
                        'name',
                        'email',
                        'phone',
                        'address',
                        'customer_type',
                        'credit_status',
                        'orders',
                        'shipments',
                        'statistics',
                        'classification'
                    ],
                    'metadata' => [
                        'last_search_at',
                        'search_count'
                    ]
                ]
            ]);

        $this->assertEquals($customer->name, $response->json('data.customer.name'));
        $this->assertEquals($customer->email, $response->json('data.customer.email'));
    }

    public function test_customer_orders_endpoint_returns_paginated_data()
    {
        $customer = $this->testCustomers[0];
        
        // Create some orders for the customer
        Order::create([
            'customer_id' => $customer->dolibarr_customer_id,
            'ref' => 'ORD-001',
            'date_commande' => now(),
            'total_ttc' => 1000.00,
            'status' => 'completed'
        ]);

        Order::create([
            'customer_id' => $customer->dolibarr_customer_id,
            'ref' => 'ORD-002',
            'date_commande' => now()->subDays(7),
            'total_ttc' => 2500.50,
            'status' => 'pending'
        ]);

        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson("/api/customers/{$customer->id}/orders");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'orders' => [
                        '*' => ['id', 'ref', 'date_commande', 'total_ttc', 'status']
                    ],
                    'pagination' => [
                        'total',
                        'per_page',
                        'current_page',
                        'last_page',
                        'from',
                        'to'
                    ],
                    'summary' => ['total_orders', 'active_orders', 'completed_orders']
                ]
            ]);

        $this->assertEquals(2, $response->json('data.summary.total_orders'));
        $this->assertEquals(1, $response->json('data.summary.active_orders'));
        $this->assertEquals(1, $response->json('data.summary.completed_orders'));
    }

    public function test_customer_shipments_endpoint_returns_proper_data()
    {
        $customer = $this->testCustomers[0];
        
        // Create some shipments
        Shipment::create([
            'customer_id' => $customer->dolibarr_customer_id,
            'ref' => 'SHIP-001',
            'tracking_number' => 'TRACK123456',
            'status' => 'delivered',
            'date_creation' => now(),
            'date_delivery_planned' => now()->subDays(1)
        ]);

        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson("/api/customers/{$customer->id}/shipments");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'shipments' => [
                        '*' => ['id', 'ref', 'tracking_number', 'status', 'date_creation']
                    ],
                    'pagination' => [
                        'total',
                        'per_page',
                        'current_page',
                        'last_page'
                    ],
                    'summary' => ['total_shipments', 'delivered', 'in_transit']
                ]
            ]);

        $this->assertEquals(1, $response->json('data.summary.total_shipments'));
        $this->assertEquals(1, $response->json('data.summary.delivered'));
    }

    public function test_customer_stats_endpoint_provides_comprehensive_data()
    {
        $customer = $this->testCustomers[0];
        
        // Create orders with various statuses and values
        Order::create([
            'customer_id' => $customer->dolibarr_customer_id,
            'ref' => 'ORD-001',
            'date_commande' => now()->subDays(30),
            'total_ttc' => 5000.00,
            'status' => 'completed'
        ]);

        Order::create([
            'customer_id' => $customer->dolibarr_customer_id,
            'ref' => 'ORD-002',
            'date_commande' => now()->subDays(10),
            'total_ttc' => 3000.50,
            'status' => 'completed'
        ]);

        Order::create([
            'customer_id' => $customer->dolibarr_customer_id,
            'ref' => 'ORD-003',
            'date_commande' => now(),
            'total_ttc' => 450.00,
            'status' => 'pending'
        ]);

        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson("/api/customers/{$customer->id}/stats");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'stats' => [
                        'total_orders',
                        'total_shipments',
                        'total_value',
                        'average_order_value',
                        'active_orders'
                    ],
                    'customer_level'
                ]
            ]);

        $stats = $response->json('data.stats');
        
        $this->assertEquals(3, $stats['total_orders']);
        $this->assertEquals(0, $stats['total_shipments']);
        $this->assertEquals(8000.50, $stats['total_value']);
        $this->assertEquals(2666.83, round($stats['average_order_value'], 2));
        $this->assertEquals(1, $stats['active_orders']);
    }

    public function test_autocomplete_results_highlight_matching_text()
    {
        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/customers/autocomplete?q=corp');

        $response->assertStatus(200);
        
        $suggestions = $response->json('data.suggestions');
        $this->assertGreaterThan(0, count($suggestions));
        
        // Check that highlight information is present
        $firstSuggestion = $suggestions[0];
        $this->assertArrayHasKey('highlight', $firstSuggestion);
        
        // The highlight data should contain position information
        if ($firstSuggestion['highlight'] !== null) {
            $this->assertArrayHasKey('start_position', $firstSuggestion['highlight']);
            $this->assertArrayHasKey('end_position', $firstSuggestion['highlight']);
        }
    }

    public function test_rate_limiting_prevents_excessive_autocomplete_requests()
    {
        $this->user = User::factory()->create();
        
        // Clear any existing rate limiting
        Redis::flushdb();
        
        // Make 120 requests (the limit)
        for ($i = 1; $i <= 120; $i++) {
            $response = $this->actingAs($this->user, 'sanctum')
                ->getJson('/api/customers/autocomplete?q=test');
            
            if ($i <= 120) {
                $response->assertStatus(200);
            }
        }
        
        // 121st request should be rate limited
        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/customers/autocomplete?q=test');
        
        $response->assertStatus(429); // Too Many Requests
        $response->assertJsonStructure([
            'success',
            'message',
            'retry_after'
        ]);
    }

    public function test_invalid_search_query_returns_validation_error()
    {
        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/customers/search?q='); // Empty query
        
        $response->assertStatus(422); // Unprocessable Entity
        $response->assertJsonStructure([
            'message',
            'errors'
        ]);
    }

    public function test_non_existent_customer_returns_not_found()
    {
        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/customers/99999999'); // Non-existent ID
        
        $response->assertStatus(404);
        $response->assertJson([
            'success' => false,
            'message' => 'Customer not found'
        ]);
    }

    public function test_search_results_include_navigation_links()
    {
        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/customers/autocomplete?q=abc');

        $response->assertStatus(200);
        
        // Check that each suggestion helps guide navigation
        $suggestions = $response->json('data.suggestions');
        foreach ($suggestions as $suggestion) {
            $this->assertArrayHasKey('id', $suggestion);
            $this->assertArrayHasKey('name', $suggestion);
            $this->assertArrayHasKey('email', $suggestion);
            $this->assertArrayHasKey('customer_type', $suggestion);
        }
    }

    public function test_performance_completes_within_acceptable_time()
    {
        $startTime = microtime(true);
        
        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/customers/search?q=corporation');
        
        $responseTime = (microtime(true) - $startTime) * 1000; // Convert to milliseconds
        
        $response->assertStatus(200);
        
        // Assert complete response within target time (< 500ms as per requirements)
        $this->assertLessThan(500, $responseTime, 
            "Customer search completed in {$responseTime}ms, exceeding the 500ms performance target");
        
        // Verify response time is reported in metadata
        $metadata = $response->json('data.metadata');
        $this->assertArrayHasKey('search_time_ms', $metadata);
        $this->assertIsNumeric($metadata['search_time_ms']);
    }

    public function test_autocomplete_performance_completes_within_target()
    {
        $startTime = microtime(true);
        
        $response = $this->actingAs($this->user, 'sanctum')
            ->getJson('/api/customers/autocomplete?q=abc');
        
        $responseTime = (microtime(true) - $startTime) * 1000; // Convert to milliseconds
        
        $response->assertStatus(200);
        
        // Assert autocomplete within target time (< 200ms super-fast requirement)
        $this->assertLessThan(200, $responseTime, 
            "Autocomplete search completed in {$responseTime}ms, exceeding the 200ms performance target");
    }

    private function createTestCustomerData(): array
    {
        return [
            Customer::create([
                'dolibarr_customer_id' => 20001,
                'name' => 'ABC Corporation',
                'email' => 'orders@abc-corp.com',
                'phone' => '+1-555-123-4567',
                'address' => '123 Business Park, Dallas, TX 75201',
                'customer_type' => 'Corporate',
                'credit_status' => 'Active',
                'search_vector' => 'abc corporation orders@abc-corp.com 123 business park 12-3456789'
            ]),
            Customer::create([
                'dolibarr_customer_id' => 20002,
                'name' => 'Tech Solutions Inc',
                'email' => 'sales@techsolutions.com',
                'phone' => '+1-555-987-6543',
                'address' => '456 Innovation Center, Austin, TX 73301',
                'customer_type' => 'Corporate',
                'credit_status' => 'Active',
                'search_vector' => 'tech solutions inc sales@techsolutions.com 456 innovation center 98-7654321'
            ]),
            Customer::create([
                'dolibarr_customer_id' => 20003,
                'name' => 'Johnson Retail Chain',
                'email' => 'purchase@johnsonretail.net',
                'phone' => '+1-555-246-1357',
                'address' => '321 Commerce Street, San Antonio, TX 78205',
                'customer_type' => 'Small_Business',
                'credit_status' => 'On_Hold',
                'search_vector' => 'johnson retail chain purchase@johnsonretail.net 321 commerce street 67-8901234'
            ])
        ];
    }

    protected function tearDown(): void
    {
        Cache::flush();
        Redis::flushall();
        parent::tearDown();
    }
}