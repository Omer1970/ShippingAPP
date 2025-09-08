<?php

use App\Http\Controllers\Api\AuthController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Authentication Routes (Public)
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login'])
        ->name('auth.login')
        ->middleware('throttle:' . env('AUTH_RATE_LIMIT', 60) . ',1'); // Rate limiting
    
    Route::post('/logout', [AuthController::class, 'logout'])
        ->name('auth.logout')
        ->middleware('auth:sanctum');
    
    Route::get('/user', [AuthController::class, 'user'])
        ->name('auth.user')
        ->middleware('auth:sanctum');
    
    Route::post('/refresh', [AuthController::class, 'refresh'])
        ->name('auth.refresh')
        ->middleware('auth:sanctum');
});

// Protected Routes (Require Authentication)
Route::middleware('auth:sanctum')->group(function () {
    // User routes
    Route::get('/user', function (Request $request) {
        return $request->user();
    });
    
    // Add other protected routes here as needed
    // Route::apiResource('shipments', ShipmentController::class);
    // Route::apiResource('orders', OrderController::class);
});

// Health check route (public)
Route::get('/health', function () {
    return response()->json([
        'status' => 'healthy',
        'timestamp' => now()->toISOString(),
        'version' => '1.0.0',
    ]);
})->name('health');