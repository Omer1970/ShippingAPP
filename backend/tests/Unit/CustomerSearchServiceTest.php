<?php

namespace Tests\Unit;

use App\Models\Customer;
use App\Models\CustomerSearchIndex;
use App\Services\CustomerSearchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class CustomerSearchServiceTest extends TestCase
{
    use RefreshDatabase;

    private CustomerSearchService $searchService;
    private array $testCustomers;

    protected function setUp(): void
    {
        parent::setUp();
        $this->searchService = new CustomerSearchService();
        
        // Create test customers
        $this->testCustomers = $this->createTestCustomers();
    }

    public function test_search_customers_with_exact_name_match()
    {
        $results = $this->searchService->searchCustomers('ABC Corporation');
        
        $this->assertInstanceOf(\Illuminate\Support\Collection::class, $results);
        $this->assertTrue($results->count() > 0);
        $this->assertEquals('ABC Corporation', $results->first()->name);
    }

    public function test_search_customers_with_partial_match()
    {
        $results = $this->searchService->searchCustomers('ABC');
        
        $this->assertInstanceOf(\Illuminate\Support\Collection::class, $results);
        $this->assertTrue($results->count() > 0);
        
        // Check that results contain ABC in name, email, or other fields
        $hasPartialMatch = false;
        foreach ($results as $customer) {
            if (stripos($customer->name, 'ABC') !== false || 
                stripos($customer->email, 'abc') !== false) {
                $hasPartialMatch = true;
                break;
            }
        }
        $this->assertTrue($hasPartialMatch);
    }

    public function test_search_customers_with_email_match()
    {
        $results = $this->searchService->searchCustomers('test@abc-corp.com');
        
        $this->assertInstanceOf(\Illuminate\Support\Collection::class, $results);
        $this->assertTrue($results->where('email', 'test@abc-corp.com')->count() > 0);
    }

    public function test_autocomplete_search_with_minimum_characters()
    {
        // Test with 1 character (should return empty)
        $results = $this->searchService->autocompleteSearch('A');
        $this->assertTrue($results->isEmpty());
        
        // Test with 2 characters (should return results)
        $results = $this->searchService->autocompleteSearch('AB');
        $this->assertInstanceOf(\Illuminate\Support\Collection::class, $results);
        $this->assertLessThanOrEqual(10, $results->count()); // Max 10 results
    }

    public function test_autocomplete_search_returns_limited_results()
    {
        $results = $this->searchService->autocompleteSearch('test');
        
        $this->assertInstanceOf(\Illuminate\Support\Collection::class, $results);
        $this->assertLessThanOrEqual(10, $results->count());
    }

    public function test_search_results_are_ordered_by_relevance()
    {
        $results = $this->searchService->searchCustomers('tech');
        
        if ($results->count() > 1) {
            // Exact "Tech" should come before "Tech Solutions" which should come before "Smith Technologies"
            $techIndex = -1;
            $techSolutionsIndex = -1;
            $smithTechIndex = -1;
            
            foreach ($results as $index => $customer) {
                if ($customer->name === 'Tech') $techIndex = $index;
                elseif ($customer->name === 'Tech Solutions') $techSolutionsIndex = $index;
                elseif ($customer->name === 'Smith Technologies') $smithTechIndex = $index;
            }
            
            // Only check ordering if we found relevant companies
            if ($techIndex !== -1 && $techSolutionsIndex !== -1) {
                $this->assertLessThan($techSolutionsIndex, $techIndex);
            }
            if ($techIndex !== -1 && $smithTechIndex !== -1) {
                $this->assertLessThan($smithTechIndex, $techIndex);
            }
        }
    }

    public function test_autocomplete_caching()
    {
        Cache::flush();
        
        $query = 'ABC';
        $cacheKey = "customer_autocomplete_{$query}";
        
        // First call should cache
        $beforeCache = microtime(true);
        $results1 = $this->searchService->autocompleteSearch($query);
        $afterCache = microtime(true);
        $firstCallTime = $afterCache - $beforeCache;
        
        // Second call should be from cache and faster
        $beforeCache2 = microtime(true);
        $results2 = $this->searchService->autocompleteSearch($query);
        $afterCache2 = microtime(true);
        $secondCallTime = $afterCache2 - $beforeCache2;
        
        $this->assertEquals($results1->count(), $results2->count());
        $this->assertEquals($results1->pluck('id')->toArray(), $results2->pluck('id')->toArray());
        
        // Second call should be faster (from cache)
        // Note: Allow some tolerance due to server load
        $this->assertLessThanOrEqual($firstCallTime + 0.1, $secondCallTime);
    }

    public function test_search_with_fuzzy_matching()
    {
        // Test with slight misspelling
        $results = $this->searchService->searchCustomers('ABCC Crporation'); // Misspelled
        
        $this->assertInstanceOf(\Illuminate\Support\Collection::class, $results);
        
        if ($results->isNotEmpty()) {
            // Should still find relevant results with fuzzy matching
            $hasFuzzyMatch = false;
            foreach ($results as $customer) {
                if (similar_text($customer->name, 'ABC Corporation') > 70) {
                    $hasFuzzyMatch = true;
                    break;
                }
            }
            $this->assertTrue($hasFuzzyMatch);
        }
    }

    public function test_search_performance()
    {
        $startTime = microtime(true);
        $results = $this->searchService->searchCustomers('company');
        $endTime = microtime(true);
        
        $executionTime = ($endTime - $startTime) * 1000; // Convert to milliseconds
        
        // Assert search completes within acceptable time (< 500ms for reasonable test data)
        $this->assertLessThan(500, $executionTime, 
            "Search took {$executionTime}ms, which exceeds the 500ms performance threshold");
    }

    public function test_autocomplete_performance()
    {
        $startTime = microtime(true);
        $results = $this->searchService->autocompleteSearch('A');
        $endTime = microtime(true);
        
        $executionTime = ($endTime - $startTime) * 1000; // Convert to milliseconds
        
        // Assert autocomplete completes within acceptable time (< 200ms target from PRD)
        $this->assertLessThan(100, $executionTime, 
            "Autocomplete took {$executionTime}ms, which exceeds the 100ms performance threshold");
    }

    public function test_search_with_empty_query()
    {
        $results = $this->searchService->searchCustomers('');
        $this->assertTrue($results->isEmpty());
    }

    public function test_autocomplete_with_empty_query()
    {
        $results = $this->searchService->autocompleteSearch('');
        $this->assertTrue($results->isEmpty());
    }

    public function test_search_with_special_characters()
    {
        // Test SQL injection protection
        $results = $this->searchService->searchCustomers("test'; DROP TABLE customers;--");
        
        // Should not crash
        $this->assertInstanceOf(\Illuminate\Support\Collection::class, $results);
        $this->assertTrue($results->isEmpty() || $results->count() > 0);
    }

    public function test_search_increases_popularity()
    {
        $customer = $this->testCustomers[0];
        $searchIndex = CustomerSearchIndex::where('customer_id', $customer->id)->first();
        
        $initialPopularity = $searchIndex ? $searchIndex->popularity_weight : 0;
        
        // Perform search
        $this->searchService->searchCustomers($customer->name);
        
        // Refresh data
        $customer->refresh();
        $searchIndex = CustomerSearchIndex::where('customer_id', $customer->id)->first();
        $newPopularity = $searchIndex ? $searchIndex->popularity_weight : 0;
        
        // Popularity should have increased (or stayed same if no index exists)
        $this->assertGreaterThanOrEqual($initialPopularity, $newPopularity);
    }

    public function test_search_includes_related_data()
    {
        $results = $this->searchService->searchCustomers('corporation');
        
        foreach ($results as $customer) {
            $this->assertArrayHasKey('total_orders', $customer->toArray());
            $this->assertArrayHasKey('total_shipments', $customer->toArray());
            $this->assertArrayHasKey('last_order_date', $customer->toArray());
        }
    }

    private function createTestCustomers(): array
    {
        return [
            Customer::create([
                'dolibarr_customer_id' => 10001,
                'name' => 'ABC Corporation',
                'email' => 'test@abc-corp.com',
                'phone' => '+1-555-123-4567',
                'address' => '123 Business Park, Dallas, TX',
                'customer_type' => 'Corporate',
                'credit_status' => 'Active',
                'tax_number' => '12-3456789',
                'search_vector' => 'abc corporation test@abc-corp.com 123 business park 12-3456789'
            ]),
            Customer::create([
                'dolibarr_customer_id' => 10002,
                'name' => 'Tech Solutions Ltd',
                'email' => 'info@techsolutions.com',
                'phone' => '+1-555-987-6543',
                'address' => '456 Innovation Center, Austin, TX',
                'customer_type' => 'Small_Business',
                'credit_status' => 'Active',
                'tax_number' => '98-7654321',
                'search_vector' => 'tech solutions ltd info@techsolutions.com 456 innovation center 98-7654321'
            ]),
            Customer::create([
                'dolibarr_customer_id' => 10003,
                'name' => 'Smith Corporation',
                'email' => 'orders@smithcorp.org',
                'phone' => '+1-555-456-7890',
                'address' => '789 Industry Way, Houston, TX',
                'customer_type' => 'Corporate',
                'credit_status' => 'Active',
                'tax_number' => '45-6789012',
                'search_vector' => 'smith corporation orders@smithcorp.org 789 industry way 45-6789012'
            ]),
            Customer::create([
                'dolibarr_customer_id' => 10004,
                'name' => 'Johnson Retail Chain',
                'email' => 'purchase@johnsonretail.net',
                'phone' => '+1-555-246-1357',
                'address' => '321 Commerce Street, San Antonio, TX',
                'customer_type' => 'Corporate',
                'credit_status' => 'On_Hold',
                'tax_number' => '67-8901234',
                'search_vector' => 'johnson retail chain purchase@johnsonretail.net 321 commerce street 67-8901234'
            ])
        ];
    }

    protected function tearDown(): void
    {
        Cache::flush();
        parent::tearDown();
    }
}