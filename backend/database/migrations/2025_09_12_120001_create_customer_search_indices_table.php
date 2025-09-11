<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_search_indices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->onDelete('cascade');
            $table->text('search_terms');
            $table->json('search_metadata')->nullable();
            $table->float('popularity_weight')->default(1.0);
            $table->timestamp('last_updated')->useCurrent();
            $table->timestamps();
            
            $table->index(['search_terms']);
            $table->index(['popularity_weight']);
            $table->index(['customer_id', 'last_updated']);            
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_search_indices');
    }
};