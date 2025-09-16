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
        Schema::create('delivery_schedules', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('shipment_id');
            $table->unsignedBigInteger('driver_id');
            $table->date('delivery_date');
            $table->time('start_time');
            $table->time('end_time');
            $table->string('time_slot', 20);
            $table->unsignedSmallInteger('estimated_duration')->default(30);
            $table->decimal('estimated_distance', 8, 2)->nullable();
            $table->unsignedSmallInteger('route_order')->default(1);
            $table->unsignedSmallInteger('sequence_current_step')->default(1);
            $table->unsignedSmallInteger('sequence_total_steps')->default(1);
            $table->string('status', 20)->default('scheduled'); // scheduled, in_progress, completed, cancelled
            $table->json('metadata')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            // Foreign keys
            $table->foreign('shipment_id')->references('id')->on('shipments')->onDelete('cascade');
            $table->foreign('driver_id')->references('id')->on('users')->onDelete('cascade');

            // Indexes
            $table->index(['driver_id', 'delivery_date']);
            $table->index(['shipment_id']);
            $table->index(['status']);
            $table->index(['delivery_date', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('delivery_schedules');
    }
};
