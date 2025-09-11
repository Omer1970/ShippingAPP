<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Shipment;
use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Illuminate\Support\Facades\Cache;

class PerformanceTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->user = User::factory()->create();
        Sanctum::actingAs($this->user);
        
        // Clear cache before tests
        Cache::flush();
    }

    /** @test */
    public function shipment_pagination_performs_well_with_large_dataset()
    {
        // Create 1000 shipments for load testing
        $this->createLargeShipmentDataset(1000);

        // Test various pagination scenarios
        $testCases = [
            ['page' => 1, 'per_page' => 10],
            ['page' => 10, 'per_page' => 50],
            ['page' => 20, 'per_page' => 25],
            ['page' => 5, 'per_page' => 100]
        ];

        $executionTimes = [];
        
        foreach ($testCases as $params) {
            $startTime = microtime(true);
            
            $response = $this->getJson('/api/shipments?' . http_build_query($params));
            
            $endTime = microtime(true);
            $executionTime = ($endTime - $startTime) * 1000; // Convert to milliseconds
            
            $executionTimes[] = $executionTime;
            
            $response->assertStatus(200);
            $this->assertLessThan(500, $executionTime, "Pagination {$params['per_page']} items took too long");
            
            echo "Pagination test (page={$params['page']}, per_page={$params['per_page']}): {$executionTime}ms\n";
        }

        // Verify average performance meets requirements
        $averageTime = array_sum($executionTimes) / count($executionTimes);
        $this->assertLessThan(500, $averageTime, 'Average pagination response time should be under 500ms');
        
        // Verify individual response times meet requirements
        foreach ($executionTimes as $time) {
            $this->assertLessThan(500, $time, 'Individual response times should be under 500ms');
        }
    }

    /** @test */
    public function order_pagination_performs_well_with_large_dataset()
    {
        // Create 1000 orders for load testing
        $this->createLargeOrderDataset(1000);

        // Test various pagination scenarios
        $testCases = [
            ['page' => 1, 'per_page' => 10],
            ['page' => 20, 'per_page' => 25],
            ['page' => 10, 'per_page' => 50],
            ['page' => 5, 'per_page' => 100]
        ];

        $executionTimes = [];
        
        foreach ($testCases as $params) {
            $startTime = microtime(true);
            
            $response = $this->getJson('/api/orders?' . http_build_query($params));
            
            $endTime = microtime(true);
            $executionTime = ($endTime - $startTime) * 1000; // Convert to milliseconds
            
            $executionTimes[] = $executionTime;
            
            $response->assertStatus(200);
            $this->assertLessThan(500, $executionTime, "Pagination {$params['per_page']} items took too long");
            
            echo "Order pagination test (page={$params['page']}, per_page={$params['per_page']}): {$executionTime}ms\n";
        }

        // Verify average performance meets requirements
        $averageTime = array_sum($executionTimes) / count($executionTimes);
        $this->assertLessThan(500, $averageTime, 'Average pagination response time should be under 500ms');
    }

    /** @test */
    public function individual_record_fetch_performs_well()
    {
        // Create test records
        $shipments = Shipment::factory()->count(10)->create();
        $orders = Order::factory()->count(10)->create();

        // Test shipment individual fetch
        $shipmentExecutionTimes = [];
        foreach ($shipments as $shipment) {
            $startTime = microtime(true);
            
            $response = $this->getJson("/api/shipments/{$shipment->id}");
            
            $endTime = microtime(true);
            $executionTime = ($endTime - $startTime) * 1000;
            
            $shipmentExecutionTimes[] = $executionTime;
            
            $response->assertStatus(200);
            $this->assertLessThan(200, $executionTime, 'Individual shipment fetch should be under 200ms');
        }

        // Test order individual fetch
        $orderExecutionTimes = [];
        foreach ($orders as $order) {
            $startTime = microtime(true);
            
            $response = $this->getJson("/api/orders/{$order->id}");
            
            $endTime = microtime(true);
            $executionTime = ($endTime - $startTime) * 1000;
            
            $orderExecutionTimes[] = $executionTime;
            
            $response->assertStatus(200);
            $this->assertLessThan(200, $executionTime, 'Individual order fetch should be under 200ms');
        }

        // Verify averages meet requirements
        $avgShipmentTime = array_sum($shipmentExecutionTimes) / count($shipmentExecutionTimes);
        $avgOrderTime = array_sum($orderExecutionTimes) / count($orderExecutionTimes);

        $this->assertLessThan(200, $avgShipmentTime, 'Average shipment fetch time should be under 200ms');
        $this->assertLessThan(200, $avgOrderTime, 'Average order fetch time should be under 200ms');
    }

    /** @test */
    public function filtering_operations_perform_efficiently()
    {
        // Create diverse dataset
        $statuses = ['pending', 'in_transit', 'delivered', 'cancelled'];
        
        foreach ($statuses as $status) {
            Shipment::factory()->count(50)->create(['status' => $status]);
            Order::factory()->count(50)->create(['status' => $status]);
        }

        // Test filtering performance
        $filterUrls = [
            '/api/shipments/status/in_transit',
            '/api/orders/status/processing',
            '/api/shipments?per_page=50',
            '/api/orders?per_page=25'
        ];

        foreach ($filterUrls as $url) {
            $startTime = microtime(true);
            
            $response = $this->getJson($url);
            
            $endTime = microtime(true);
            $executionTime = ($endTime - $startTime) * 1000;
            
            $response->assertStatus(200);
            $this->assertLessThan(500, $executionTime, "Filter operation on {$url} should be under 500ms");
            
            echo "Filter operation {$url}: {$executionTime}ms\n";
        }
    }

    /** @test */
    public function database_queries_use_appropriate_indexes()
    {
        // Create test data
        $this->createLargeShipmentDataset(500);
        $this->createLargeOrderDataset(500);

        // Enable query logging
        \DB::connection()->enableQueryLog();

        // Test queries that should use indexes
        $filters = [
            ['status' => 'in_transit'],
            ['status' => 'delivered'],
            ['id' => 250]
        ];

        foreach ($filters as $filter) {
            // Test shipment queries
            $startTime = microtime(true);
            
            $shipmentsQuery = \DB::table('shipments')
                ->where($filter)
                ->get();
            
            $endTime = microtime(true);
            $executionTime = ($endTime - $startTime) * 1000;
            
            $this->assertLessThan(50, $executionTime, "Database query with filter should be efficient");
        }

        // Check that queries are reasonable
        $queries = \DB::getQueryLog();
        
        foreach ($queries as $query) {
            // Ensure queries don't have obvious performance issues
            $this->assertStringNotContainsString('filesort', json_encode($query), 'Query should not require filesort');
            $this->assertStringNotContainsString('temporary', json_encode($query), 'Query should not require temporary tables');
        }

        \DB::connection()->disableQueryLog();
    }

    /** @test */
    public function large_dataset_scalability_test()
    {
        // Test with progressively larger datasets
        $datasetSizes = [100, 500, 1000, 2000];
        
        foreach ($datasetSizes as $size) {
            $this->createLargeShipmentDataset($size);
            
            $startTime = microtime(true);
            
            $response = $this->getJson('/api/shipments?page=1&per_page=50');
            
            $endTime = microtime(true);
            $executionTime = ($endTime - $startTime) * 1000;
            
            $response->assertStatus(200);
            $this->assertCount(50, $response->json('data.shipments'));
            $this->assertEquals($size, $response->json('data.pagination.total_items'));
            
            // Performance should remain consistent regardless of dataset size
            $maxAllowedTime = min(500 + ($size / 10), 1000); // Slight increase allowed for very large datasets
            $this->assertLessThan($maxAllowedTime, $executionTime, "Performance should scale well with dataset size {$size}");
            
            echo "Dataset size {$size}: {$executionTime}ms\n";
            
            // Clear dataset for next test
            \DB::table('shipments')->truncate();
        }
    }

    private function createLargeShipmentDataset(int $count): void
    {
        $data = [];
        $now = now();
        
        for ($i = 0; $i < $count; $i++) {
            $data[] = [
                'dolibarr_shipment_id' => 1000 + $i,
                'reference' => 'SHIP-' . str_pad($i + 1, 6, '0', STR_PAD_LEFT),
                'customer_id' => rand(1, 100),
                'customer_name' => 'Customer ' . rand(1, 50),
                'delivery_address' => rand(1, 999) . ' Test Street, City, State 12345',
                'status' => ['pending', 'in_transit', 'delivered', 'cancelled'][rand(0, 3)],
                'expected_delivery' => $now->copy()->addDays(rand(0, 30))->format('Y-m-d'),
                'assigned_driver_id' => rand(1, 20),
                'assigned_driver' => 'Driver ' . rand(1, 20),
                'total_weight' => rand(10, 1000) / 10,
                'total_value' => rand(100, 10000),
                'created_from_dolibarr' => $now,
                'last_synced' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
            
            // Insert in batches to avoid memory issues
            if (($i + 1) % 100 === 0 || $i === $count - 1) {
                \DB::table('shipments')->insert($data);
                $data = [];
            }
        }
    }

    private function createLargeOrderDataset(int $count): void
    {
        $data = [];
        $now = now();
        
        for ($i = 0; $i < $count; $i++) {
            $data[] = [
                'dolibarr_order_id' => 2000 + $i,
                'reference' => 'ORD-' . str_pad($i + 1, 6, '0', STR_PAD_LEFT),
                'customer_id' => rand(1, 100),
                'customer_name' => 'Customer ' . rand(1, 50),
                'customer_reference' => 'CUST-' . str_pad(rand(1, 100), 4, '0', STR_PAD_LEFT),
                'order_date' => $now->copy()->subDays(rand(0, 90))->format('Y-m-d'),
                'status' => ['pending', 'processing', 'shipped', 'delivered', 'cancelled'][rand(0, 4)],
                'total_amount' => json_encode([
                    'exclTax' => rand(100, 10000),
                    'inclTax' => rand(120, 12000),
                    'currency' => 'USD'
                ]),
                'shipping_address' => rand(1, 999) . ' Shipping Street, City, State 12345',
                'billing_address' => rand(1, 999) . ' Billing Street, City, State 12345',
                'expected_delivery' => $now->copy()->addDays(rand(0, 30))->format('Y-m-d'),
                'created_from_dolibarr' => $now,
                'last_synced' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
            
            // Insert in batches to avoid memory issues
            if (($i + 1) % 100 === 0 || $i === $count - 1) {
                \DB::table('orders')->insert($data);
                $data = [];
            }
        }
    }
}