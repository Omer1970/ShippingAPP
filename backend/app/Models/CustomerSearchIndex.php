<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerSearchIndex extends Model
{
    use HasFactory;

    protected $table = 'customer_search_indices';

    protected $fillable = [
        'customer_id',
        'search_terms',
        'search_metadata',
        'popularity_weight',
        'last_updated'
    ];

    protected $casts = [
        'search_metadata' => 'array',
        'popularity_weight' => 'float',
        'last_updated' => 'datetime',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function scopeBySearchTerm($query, string $term)
    {
        return $query->where('search_terms', 'like', "%{$term}%");
    }

    public function scopeByPopularity($query)
    {
        return $query->orderBy('popularity_weight', 'desc');
    }

    public function incrementPopularity(): void
    {
        $this->increment('popularity_weight', 0.01);
    }
}