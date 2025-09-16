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
        Schema::create('delivery_time_slots', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('driver_id');
            $table->date('slot_date');
            $table->time('start_time');
            $table->time('end_time');
            $table->string('slot_label', 20);
            $table->unsignedSmallInteger('capacity')->default(4);
            $table->unsignedSmallInteger('booked')->default(0);
            $table->string('availability', 20)->default('available'); // available, limited, full, blocked
            $table->boolean('is_recurring')->default(false);
            $table->string('recurrence_pattern', 20)->nullable(); // daily, weekly, monthly
            $table->json('metadata')->nullable();
            $table->timestamps();

            // Foreign keys
            $table->foreign('driver_id')->references('id')->on('users')->onDelete('cascade');

            // Indexes
            $table->index(['driver_id', 'slot_date']);
            $table->index(['slot_date', 'availability']);
            $table->index(['driver_id', 'availability']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('delivery_time_slots');
    }
};
