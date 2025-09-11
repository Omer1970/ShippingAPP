<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('shipments', function (Blueprint $table) {
            $table->id();
            $table->integer('dolibarr_shipment_id')->nullable();
            $table->string('reference')->nullable();
            $table->integer('customer_id')->nullable();
            $table->string('customer_name')->nullable();
            $table->text('delivery_address')->nullable();
            $table->string('status')->default('pending');
            $table->date('expected_delivery')->nullable();
            $table->integer('assigned_driver_id')->nullable();
            $table->decimal('total_weight', 10, 2)->nullable();
            $table->decimal('total_value', 10, 2)->nullable();
            $table->boolean('created_from_dolibarr')->default(true);
            $table->timestamp('last_synced')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('shipments');
    }
};
