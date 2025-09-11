<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ShipmentController;
use App\Http\Controllers\Api\OrderController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Authentication Routes
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login'])
        ->name('auth.login')
        ->middleware('throttle:' . env('AUTH_RATE_LIMIT', 60) . ',1');
    
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout'])->name('auth.logout');
        Route::get('/user', [AuthController::class, 'user'])->name('auth.user');
    });
});

// Protected Shipment Routes (require authentication)
Route::middleware('auth:sanctum')->prefix('shipments')->group(function () {
    Route::get('/', [ShipmentController::class, 'index'])->name('shipments.index');
    Route::get('/{id}', [ShipmentController::class, 'show'])->name('shipments.show');
    Route::get('/my/shipments', [ShipmentController::class, 'myShipments'])->name('shipments.my');
    Route::get('/status/{status}', [ShipmentController::class, 'byStatus'])->name('shipments.byStatus');
    Route::post('/{id}/refresh', [ShipmentController::class, 'refresh'])->name('shipments.refresh');
});

// Protected Order Routes (require authentication)
Route::middleware('auth:sanctum')->prefix('orders')->group(function () {
    Route::get('/', [OrderController::class, 'index'])->name('orders.index');
    Route::get('/{id}', [OrderController::class, 'show'])->name('orders.show');
    Route::get('/customer/{customerId}', [OrderController::class, 'byCustomer'])->name('orders.byCustomer');
    Route::get('/status/{status}', [OrderController::class, 'byStatus'])->name('orders.byStatus');
    Route::post('/{id}/refresh', [OrderController::class, 'refresh'])->name('orders.refresh');
});

// Health check route
Route::get('/health', function () {
    return response()->json([
        'status' => 'healthy',
        'timestamp' => now()->toISOString(),
    ]);
})->name('health');