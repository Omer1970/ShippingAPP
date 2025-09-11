<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->integer('dolibarr_customer_id')->unique()->index();
            $table->string('name', 255)->index();
            $table->string('email', 255)->nullable();            
            $table->string('phone', 50)->nullable();
            $table->text('address')->nullable();
            $table->enum('customer_type', ['Individual', 'Corporate', 'Small_Business', 'Government'])->nullable();
            $table->enum('credit_status', ['Active', 'On_Hold', 'Suspended', 'Closed'])->default('Active');
            $table->string('payment_terms', 255)->nullable();
            $table->string('tax_number', 100)->nullable();
            $table->string('preferred_delivery_time', 255)->nullable();
            $table->text('special_instructions')->nullable();
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->text('search_vector')->nullable();
            $table->timestamp('last_synced')->nullable();
            $table->timestamp('last_search_at')->nullable();
            $table->timestamps();
            
            $table->index(['credit_status', 'customer_type']);
            $table->index('last_synced');
            $table->fullText('search_vector');
            $table->index('name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};