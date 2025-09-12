<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;
use Laravel\Scout\Searchable;

class Customer extends Model
{
    use HasFactory, Searchable;

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

    public function toSearchableArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'address' => $this->address,
            'customer_type' => $this->customer_type,
            'credit_status' => $this->credit_status,
            'tax_number' => $this->tax_number,
            'search_vector' => $this->search_vector,
            'total_orders' => $this->orders()->count(),
            'total_shipments' => $this->shipments()->count(),
            'total_order_value' => $this->getTotalOrderValue(),
            'last_search_at' => $this->last_search_at,
            'created_at' => $this->created_at,
            'popularity' => $this->searchIndexes()->avg('popularity_weight') ?? 0,
        ];
    }

    public function scopeEnhancedSearch($query, string $searchTerm)
    {
        if (empty(trim($searchTerm))) {
            return $query;
        }

        return $query->where(function ($q) use ($searchTerm) {
            // Boost exact name matches
            $q->where('name', $searchTerm)
              ->orderByRaw('name = ? DESC', [$searchTerm])
              ->orWhere('name', 'like', $searchTerm . '%')
              ->orderByRaw('name LIKE ? DESC', [$searchTerm . '%'])
              ->orWhere('name', 'like', '%' . $searchTerm . '%')
              ->orWhere('email', 'like', $searchTerm . '%')
              ->orWhere('phone', 'like', '%' . $searchTerm . '%')
              ->orWhere('search_vector', 'like', '%' . $searchTerm . '%');
        })
        ->orWhereHas('searchIndexes', function ($q) use ($searchTerm) {
            $q->where('search_terms', 'like', '%' . $searchTerm . '%')
              ->orderByDesc('popularity_weight');
        })
        ->orderBy('last_search_at', 'desc')
        ->orderBy('name', 'asc');
    }
}