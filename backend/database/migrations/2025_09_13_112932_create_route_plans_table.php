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
        Schema::create('route_plans', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('driver_id');
            $table->date('route_date');
            $table->json('optimized_route'); // Array of delivery schedule IDs in order
            $table->string('route_status', 20)->default('planned'); // planned, active, completed, cancelled
            $table->decimal('total_distance', 8, 2)->nullable();
            $table->decimal('estimated_time', 8, 2)->nullable(); // in minutes
            $table->decimal('efficiency_score', 5, 2)->nullable(); // 0.00 - 1.00
            $table->json('waypoints')->nullable(); // GPS coordinates for route
            $table->json('alternatives')->nullable(); // Alternative route options
            $table->string('optimization_algorithm', 50)->default('google_maps'); // google_maps, osrm, custom
            $table->timestamp('optimized_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->string('traffic_model', 20)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            // Foreign keys
            $table->foreign('driver_id')->references('id')->on('users')->onDelete('cascade');

            // Indexes
            $table->index(['driver_id', 'route_date']);
            $table->index(['route_date', 'route_status']);
            $table->index(['driver_id', 'route_status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('route_plans');
    }
};
