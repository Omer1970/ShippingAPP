<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Models\User;
use App\Services\DolibarrAuthService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private DolibarrAuthService $dolibarrAuth
    ) {}

    /**
     * Handle user login via Dolibarr authentication.
     */
    public function login(LoginRequest $request)
    {
        try {
            // Authenticate against Dolibarr
            $dolibarrUser = $this->dolibarrAuth->authenticate(
                $request->email,
                $request->password
            );

            if (!$dolibarrUser) {
                throw ValidationException::withMessages([
                    'email' => ['Invalid Dolibarr credentials.'],
                ]);
            }

            // Get or create local user with Dolibarr data
            $user = User::firstOrCreate(
                ['dolibarr_user_id' => $dolibarrUser['id']],
                [
                    'name' => $dolibarrUser['name'],
                    'email' => $dolibarrUser['email'],
                    'role' => $this->mapDolibarrRole($dolibarrUser['role']),
                    'is_active' => true,
                ]
            );

            if (!$user->isActive()) {
                throw ValidationException::withMessages([
                    'email' => ['Account is deactivated.'],
                ]);
            }

            // Generate Sanctum token
            $token = $user->createToken($request->device_name)->plainTextToken;

            return response()->json([
                'user' => [
                    'id' => $user->id,
                    'dolibarr_user_id' => $user->dolibarr_user_id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                ],
                'token' => $token,
            ]);

        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Authentication failed',
                'errors' => $e->errors(),
            ], 401);
        }
    }

    /**
     * Get the authenticated user.
     */
    public function user(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'user' => [
                'id' => $user->id,
                'dolibarr_user_id' => $user->dolibarr_user_id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
            ],
        ]);
    }

    /**
     * Handle user logout.
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logout successful',
        ]);
    }

    /**
     * Map Dolibarr role to ShipmentApp role.
     */
    private function mapDolibarrRole(?string $dolibarrRole): string
    {
        return match ($dolibarrRole) {
            'admin', 'superadmin' => 'admin',
            'warehouse_manager', 'logistics' => 'warehouse',
            default => 'driver',
        };
    }
}