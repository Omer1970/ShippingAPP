<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Handle user login request.
     */
    public function login(LoginRequest $request)
    {
        try {
            $user = User::where('email', $request->email)->first();

            if (!$user || !Hash::check($request->password, $user->password)) {
                throw ValidationException::withMessages([
                    'email' => ['The provided credentials are incorrect.'],
                ]);
            }

            if (!$user->isActive()) {
                throw ValidationException::withMessages([
                    'email' => ['Your account has been deactivated.'],
                ]);
            }

            $token = $user->createToken($request->device_name)->plainTextToken;
            $tokenExpiry = now()->addHours(config('sanctum.expiration') / 60);

            return response()->json([
                'success' => true,
                'data' => [
                    'user' => new UserResource($user),
                    'token' => $token,
                    'expires_at' => $tokenExpiry->toISOString(),
                ],
                'message' => 'Login successful',
            ]);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Authentication failed',
                'errors' => $e->errors(),
            ], 401);
        } catch (\Exception $e) {
            \Log::error('Login error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'An error occurred during authentication',
                'errors' => ['general' => ['Please try again later.']],
            ], 500);
        }
    }

    /**
     * Get the authenticated user.
     */
    public function user(Request $request)
    {
        try {
            $user = $request->user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated',
                ], 401);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'user' => new UserResource($user),
                ],
                'message' => 'User profile retrieved successfully',
            ]);

        } catch (\Exception $e) {
            \Log::error('User profile error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'An error occurred while retrieving user profile',
                'errors' => ['general' => ['Please try again later.']],
            ], 500);
        }
    }

    /**
     * Handle user logout.
     */
    public function logout(Request $request)
    {
        try {
            $user = $request->user();
            
            if ($user) {
                // Revoke all tokens for the user
                $user->tokens()->delete();
            }

            return response()->json([
                'success' => true,
                'message' => 'Logout successful',
            ]);

        } catch (\Exception $e) {
            \Log::error('Logout error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'An error occurred during logout',
                'errors' => ['general' => ['Please try again later.']],
            ], 500);
        }
    }

    /**
     * Refresh authentication token.
     */
    public function refresh(Request $request)
    {
        try {
            $user = $request->user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated',
                ], 401);
            }

            // Revoke current token
            $currentToken = $request->user()->currentAccessToken();
            if ($currentToken) {
                $currentToken->delete();
            }

            // Create new token
            $token = $user->createToken('refreshed_token')->plainTextToken;
            $tokenExpiry = now()->addHours(config('sanctum.expiration') / 60);

            return response()->json([
                'success' => true,
                'data' => [
                    'user' => new UserResource($user),
                    'token' => $token,
                    'expires_at' => $tokenExpiry->toISOString(),
                ],
                'message' => 'Token refreshed successfully',
            ]);

        } catch (\Exception $e) {
            \Log::error('Token refresh error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'An error occurred while refreshing token',
                'errors' => ['general' => ['Please try again later.']],
            ], 500);
        }
    }
}