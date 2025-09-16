<?php

namespace App\Providers;

use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\ServiceProvider;

class BroadcastServiceProvider extends ServiceProvider
{
    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Broadcast::routes(['middleware' => ['auth:sanctum']]);

        /*
         * Authenticate the user's access to private channels for delivery updates.
         */
        Broadcast::channel('delivery.{deliveryId}', function ($user, $deliveryId) {
            // Users can access their own delivery channels
            $delivery = \App\Models\DeliveryConfirmation::find($deliveryId);

            if (!$delivery) {
                return false;
            }

            // Allow access if the user is the delivery driver, or has appropriate role
            return $user->id === $delivery->user_id ||
                   $user->hasRole(['admin', 'warehouse_manager']) ||
                   $user->can('view-all-deliveries');
        });

        /*
         * Authenticate user-specific delivery channels.
         */
        Broadcast::channel('user.{userId}.deliveries', function ($user, $userId) {
            // Users can only access their own delivery channels
            return (int) $user->id === (int) $userId;
        });

        /*
         * Authenticate user-specific queue channels.
         */
        Broadcast::channel('user.{userId}.queue', function ($user, $userId) {
            // Users can only access their own queue channels
            return (int) $user->id === (int) $userId;
        });

        /*
         * Authenticate user-specific signature channels.
         */
        Broadcast::channel('user.{userId}.signature', function ($user, $userId) {
            // Users can only access their own signature channels
            return (int) $user->id === (int) $userId;
        });

        /*
         * Public delivery updates channel - no authentication required for status updates.
         */
        Broadcast::channel('delivery-updates', function () {
            // Public channel for general delivery updates
            return true;
        });

        /*
         * Public delivery queue updates channel for queue monitoring.
         */
        Broadcast::channel('delivery-queue-updates', function () {
            // Public channel for queue status updates
            return true;
        });
    }
}