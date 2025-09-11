<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class Customer extends Model
{
    use HasFactory;

    protected $table = 'customers';

    protected $fillable = [
        'dolibarr_customer_id',
        'name',
        'email',
        'phone',
        'address',
        'customer_type',
        'credit_status',
        'payment_terms',
        'tax_number',
        'preferred_delivery_time',
        'special_instructions',
        'latitude',
        'longitude',
        'search_vector',
        'last_synced',
        'last_search_at'
    ];

    protected $casts = [
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'last_synced' => 'datetime',
        'last_search_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'customer_id', 'dolibarr_customer_id');
    }

    public function shipments(): HasMany
    {
        return $this->hasMany(Shipment::class, 'customer_id', 'dolibarr_customer_id');
    }

    public function searchIndexes()
    {
        return $this->hasMany(CustomerSearchIndex::class);
    }

    public function getSearchableText(): string
    {
        return implode(' ', [
            $this->name,
            $this->email,
            $this->phone,
            $this->address,
            $this->customer_type ?? '',
            $this->tax_number ?? ''
        ]);
    }

    public function updateSearchVector(): void
    {
        $searchableText = $this->getSearchableText();
        $this->search_vector = strtolower(preg_replace('/[^\w\s]/', ' ', $searchableText));
        $this->save();
    }

    public function scopeSearchByText($query, string $searchTerm)
    {
        $searchTerm = strtolower(trim($searchTerm));
        
        if (empty($searchTerm)) {
            return $query;
        }

        return $query->where(function ($q) use ($searchTerm) {
            $q->where('name', 'like', "%{$searchTerm}%")
              ->orWhere('email', 'like', "%{$searchTerm}%")
              ->orWhere('phone', 'like', "%{$searchTerm}%")
              ->orWhere('search_vector', 'like', "%{$searchTerm}%");
        });
    }

    public function scopeActiveCustomers($query)
    {
        return $query->where('credit_status', 'Active');
    }

    public function scopeByCustomerType($query, string $type)
    {
        return $query->where('customer_type', $type);
    }

    public function getTotalOrderValue(): float
    {
        return $this->orders()->sum('total_ttc') ?? 0.00;
    }

    public function getTotalShipmentCount(): int
    {
        return $this->shipments()->count();
    }

    public function getLastOrderDate(): ?string
    {
        return $this->orders()->max('date_commande');
    }

    public function incrementSearchPopularity(): void
    {
        $this->searchIndexes()->increment('popularity_weight');
        $this->update(['last_search_at' => now()]);
    }
}