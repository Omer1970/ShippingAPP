<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerSearchIndex;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CustomerSearchService
{
    private const AUTOCOMPLETE_CACHE_TTL = 300; // 5 minutes
    private const MAX_AUTOCOMPLETE_RESULTS = 10;
    private const MIN_SEARCH_LENGTH = 2;
    private const SIMILARITY_THRESHOLD = 0.6;

    public function searchCustomers(string $query, int $limit = 50): Collection
    {
        try {
            $query = trim(strtolower($query));
            
            if (strlen($query) < self::MIN_SEARCH_LENGTH) {
                return collect();
            }

            return Customer::searchByText($query)
                ->activeCustomers()
                ->with(['orders', 'shipments'])
                ->limit($limit)
                ->orderBy('name')
                ->get();

        } catch (\Exception $e) {
            Log::error('Customer search failed', ['query' => $query, 'error' => $e->getMessage()]);
            return collect();
        }
    }

    public function autocompleteSearch(string $query): Collection
    {
        try {
            $query = trim(strtolower($query));
            
            if (strlen($query) < self::MIN_SEARCH_LENGTH) {
                return collect();
            }

            $cacheKey = "customer_autocomplete_{$query}";
            
            return Cache::remember($cacheKey, self::AUTOCOMPLETE_CACHE_TTL, function () use ($query) {
                return Customer::searchByText($query)
                    ->activeCustomers()
                    ->select('id', 'name', 'email', 'phone', 'customer_type')
                    ->limit(self::MAX_AUTOCOMPLETE_RESULTS)
                    ->orderBy(DB::raw("CASE 
                        WHEN name = '{$query}' THEN 1
                        WHEN name LIKE '{$query}%' THEN 2
                        WHEN name LIKE '%{$query}%' THEN 3
                        ELSE 4
                    END"))
                    ->orderBy('name')
                    ->get()
                    ->map(function ($customer) {
                        $customer->search_score = $this->calculateRelevanceScore($customer->name, request()->get('q', ''));
                        return $customer;
                    });
            });

        } catch (\Exception $e) {
            Log::error('Customer autocomplete search failed', ['query' => $query, 'error' => $e->getMessage()]);
            return collect();
        }
    }

    public function advancedSearch(array $filters, int $limit = 50): Collection
    {
        try {
            $query = Customer::query();

            // Apply search text filter
            if (!empty($filters['query'])) {
                $query->searchByText($filters['query']);
            }

            // Apply customer type filter
            if (!empty($filters['customer_type'])) {
                $query->byCustomerType($filters['customer_type']);
            }

            // Apply active customers filter
            if ($filters['active_only'] ?? true) {
                $query->activeCustomers();
            }

            // Apply date range for last activity
            if (!empty($filters['date_from'])) {
                $query->where('last_synced', '>=', $filters['date_from']);
            }

            if (!empty($filters['date_to'])) {
                $query->where('last_synced', '<=', $filters['date_to']);
            }

            return $query->with(['orders', 'shipments'])
                ->limit($limit)
                ->orderBy('name')
                ->get();

        } catch (\Exception $e) {
            Log::error('Customer advanced search failed', ['filters' => $filters, 'error' => $e->getMessage()]);
            return collect();
        }
    }

    public function getCustomerDetails(int $customerId): ?Customer
    {
        try {
            return Customer::with(['orders', 'shipments', 'searchIndexes'])
                ->find($customerId);
        } catch (\Exception $e) {
            Log::error('Customer details fetch failed', ['customer_id' => $customerId, 'error' => $e->getMessage()]);
            return null;
        }
    }

    public function getSearchSuggestions(string $query): array
    {
        $autocompleteResults = $this->autocompleteSearch($query);
        
        return [
            'suggestions' => $autocompleteResults->pluck('name')->toArray(),
            'total_results' => $autocompleteResults->count(),
            'search_time_ms' => round(microtime(true) * 1000), // Approximate
        ];
    }

    private function calculateRelevanceScore(string $name, string $query): float
    {
        $nameLower = strtolower($name);
        $queryLower = strtolower($query);
        
        $exactMatch = $nameLower === $queryLower;
        $startsWith = str_starts_with($nameLower, $queryLower);
        $contains = str_contains($nameLower, $queryLower);
        
        if ($exactMatch) return 1.0;
        if ($startsWith) return 0.9;
        if ($contains) return 0.7;
        return 0.5;
    }
}