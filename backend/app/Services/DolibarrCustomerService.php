<?php

namespace App\Services;

use App\Models\Customer;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class DolibarrCustomerService
{
    private const CUSTOMER_TABLE = 'llx_societe';
    private const CUSTOMER_CATEGORIES_TABLE = 'llx_categorie_societe';
    private const CUSTOMER_ADDRESSES_TABLE = 'llx_societe_address';
    private const CUSTOMER_CONTACTS_TABLE = 'llx_socpeople';
    private const PAYMENT_TERMS_TABLE = 'llx_cond_reglement';
    private const CACHE_TTL = 1800; // 30 minutes

    public function syncCustomersFromDolibarr(array $customerIds = []): array
    {
        try {
            $results = ['synced' => 0, 'failed' => 0, 'errors' => []];
            
            $customers = $this->fetchCustomersFromDolibarr($customerIds);
            
            foreach ($customers as $dolibarrCustomer) {
                try {
                    $this->syncSingleCustomer($dolibarrCustomer);
                    $results['synced']++;
                } catch (\Exception $e) {
                    $results['failed']++;
                    $results['errors'][] = "Customer ID {$dolibarrCustomer->rowid}: " . $e->getMessage();
                    Log::error('Failed to sync customer', ['customer_id' => $dolibarrCustomer->rowid, 'error' => $e->getMessage()]);
                }
            }
            
            return $results;
            
        } catch (\Exception $e) {
            Log::error('Customer sync failed', ['error' => $e->getMessage()]);
            throw $e;
        }
    }

    public function fetchCustomersFromDolibarr(array $customerIds = []): Collection
    {
        try {
            // Use external database connection configured for Dolibarr
            $dolibarrDB = DB::connection('dolibarr');
            
            $query = $dolibarrDB->table(self::CUSTOMER_TABLE)
                ->select([
                    's.rowid',
                    's.nom as name',
                    's.name_alias',
                    's.email',
                    's.phone',
                    's.fax',
                    's.address',
                    's.zip',
                    's.town',
                    's.country',
                    's.fk_typent as customer_type',
                    's.fk_stcomm as status',
                    's.fk_cond_reglement as payment_terms',
                    's.tva_intra as tax_number',
                    's.datec as created_at',
                    's.tms as updated_at'
                ])
                ->from(self::CUSTOMER_TABLE . ' as s')
                ->where('s.entity', '=', 1) // Required for multi-entity Dolibarr
                ->whereIn('s.status', [1, 2]); // Active or prospect customers
            
            // Filter by specific customer IDs if provided
            if (!empty($customerIds)) {
                $query->whereIn('s.rowid', $customerIds);
            }
            
            return $query->orderBy('s.nom')->get();
            
        } catch (\Exception $e) {
            Log::error('Failed to fetch customers from Dolibarr', ['error' => $e->getMessage()]);
            return collect();
        }
    }

    private function syncSingleCustomer(\stdClass $dolibarrCustomer): void
    {
        try {
            Customer::updateOrCreate(
                [
                    'dolibarr_customer_id' => $dolibarrCustomer->rowid
                ],
                [
                    'name' => $dolibarrCustomer->name,
                    'email' => $dolibarrCustomer->email,
                    'phone' => $dolibarrCustomer->phone,
                    'address' => $this->buildFullAddress($dolibarrCustomer),
                    'customer_type' => $this->mapCustomerType($dolibarrCustomer->customer_type),
                    'credit_status' => $this->mapCustomerStatus($dolibarrCustomer->status),
                    'payment_terms' => $this->getPaymentTerms($dolibarrCustomer->payment_terms),
                    'tax_number' => $dolibarrCustomer->tax_number,
                    'last_synced' => now(),
                ]
            );
            
            Log::info('Customer synced successfully', ['dolibarr_id' => $dolibarrCustomer->rowid]);
            
        } catch (\Exception $e) {
            Log::error('Failed to sync individual customer', ['dolibarr_id' => $dolibarrCustomer->rowid, 'error' => $e->getMessage()]);
            throw $e;
        }
    }

    public function getCustomerByDolibarrId(int $dolibarrCustomerId): ?Customer
    {
        try {
            return Customer::where('dolibarr_customer_id', $dolibarrCustomerId)->first();
        } catch (\Exception $e) {
            Log::error('Failed to get customer by Dolibarr ID', ['dolibarr_id' => $dolibarrCustomerId, 'error' => $e->getMessage()]);
            return null;
        }
    }

    public function validateCustomerExists(int $dolibarrCustomerId): bool
    {
        try {
            return DB::connection('dolibarr')
                ->table(self::CUSTOMER_TABLE)
                ->where('rowid', $dolibarrCustomerId)
                ->exists();
        } catch (\Exception $e) {
            Log::error('Failed to validate customer existence', ['dolibarr_id' => $dolibarrCustomerId, 'error' => $e->getMessage()]);
            return false;
        }
    }

    private function buildFullAddress(\stdClass $customer): string
    {
        $parts = [];
        
        if (!empty($customer->address)) {
            $parts[] = $customer->address;
        }
        if (!empty($customer->zip)) {
            $parts[] = $customer->zip;
        }
        if (!empty($customer->town)) {
            $parts[] = $customer->town;
        }
        if (!empty($customer->country)) {
            $country = DB::connection('dolibarr')
                ->table('llx_c_country')
                ->where('rowid', $customer->country)
                ->value('label');
            if ($country) {
                $parts[] = $country;
            }
        }
        
        return implode(', ', $parts);
    }

    private function mapCustomerType(?int $dolibarrType): string
    {
        $typeMapping = [
            2 => 'Individual',
            3 => 'Corporate',
            4 => 'Small_Business',
            5 => 'Government',
            6 => 'Corporate',
            7 => 'Corporate',
        ];

        return $typeMapping[$dolibarrType] ?? 'Corporate';
    }

    private function mapCustomerStatus(?int $dolibarrStatus): string
    {
        $statusMapping = [
            -1 => 'Closed',
            0 => 'Prospect',
            1 => 'Active', // KEY
            2 => 'Active', // KEY
            3 => 'On_Hold',
        ];

        return $statusMapping[$dolibarrStatus] ?? 'Active';
    }

    private function getPaymentTerms(?int $paymentTermsId): ?string
    {
        if (!$paymentTermsId) {
            return null;
        }

        try {
            return DB::connection('dolibarr')
                ->table(self::PAYMENT_TERMS_TABLE)
                ->where('rowid', $paymentTermsId)
                ->value('libelle_facture');
        } catch (\Exception $e) {
            Log::error('Failed to get payment terms', ['payment_terms_id' => $paymentTermsId, 'error' => $e->getMessage()]);
            return null;
        }
    }

    public function getTotalCustomerCount(): int
    {
        try {
            return DB::connection('dolibarr')
                ->table(self::CUSTOMER_TABLE)
                ->where('entity', 1)
                ->whereIn('status', [1, 2])
                ->count();
        } catch (\Exception $e) {
            Log::error('Failed to get total customer count', ['error' => $e->getMessage()]);
            return 0;
        }
    }
}