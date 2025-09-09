<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class DolibarrAuthService
{
    private string $connection = 'dolibarr';
    private int $cacheTtl = 3600; // 1 hour

    /**
     * Authenticate user against Dolibarr database.
     */
    public function authenticate(string $email, string $password): ?array
    {
        try {
            // Check cache first
            $cacheKey = "dolibarr_user_{$email}";
            if (Cache::has($cacheKey)) {
                $cachedUser = Cache::get($cacheKey);
                if (password_verify($password, $cachedUser['password_hash'])) {
                    return $cachedUser;
                }
            }

            // Query Dolibarr database
            $user = DB::connection($this->connection)
                ->table('llx_user')
                ->where('email', $email)
                ->where('statut', 1) // Active users only
                ->first();

            if (!$user) {
                return null;
            }

            // Verify password (Dolibarr uses MD5 or bcrypt depending on version)
            if (!$this->verifyPassword($password, $user->pass)) {
                return null;
            }

            $userData = [
                'id' => $user->rowid,
                'name' => $this->getUserFullName($user),
                'email' => $user->email,
                'role' => $this->getUserRole($user),
                'password_hash' => $user->pass, // Store for cache validation
            ];

            // Cache the user data
            Cache::put($cacheKey, $userData, $this->cacheTtl);

            return $userData;

        } catch (\Exception $e) {
            Log::error('Dolibarr authentication error: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Get user by Dolibarr user ID.
     */
    public function getUserById(int $dolibarrUserId): ?array
    {
        try {
            $user = DB::connection($this->connection)
                ->table('llx_user')
                ->where('rowid', $dolibarrUserId)
                ->first();

            if (!$user) {
                return null;
            }

            return [
                'id' => $user->rowid,
                'name' => $this->getUserFullName($user),
                'email' => $user->email,
                'role' => $this->getUserRole($user),
            ];

        } catch (\Exception $e) {
            Log::error('Dolibarr get user error: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Verify password against Dolibarr hash.
     */
    private function verifyPassword(string $password, string $hash): bool
    {
        // Dolibarr may use different hash formats
        if (password_verify($password, $hash)) {
            return true; // bcrypt
        }

        if (md5($password) === $hash) {
            return true; // MD5 (older Dolibarr versions)
        }

        return false;
    }

    /**
     * Get user's full name from Dolibarr data.
     */
    private function getUserFullName(object $user): string
    {
        $parts = [];
        if (!empty($user->lastname)) {
            $parts[] = $user->lastname;
        }
        if (!empty($user->firstname)) {
            $parts[] = $user->firstname;
        }
        
        return implode(' ', $parts) ?: $user->login ?: $user->email;
    }

    /**
     * Determine user role from Dolibarr data.
     */
    private function getUserRole(object $user): ?string
    {
        // Check if user has admin rights in Dolibarr
        if ($user->admin === 1) {
            return 'admin';
        }

        // Check group memberships for role determination
        $groups = DB::connection($this->connection)
            ->table('llx_usergroup_user')
            ->where('fk_user', $user->rowid)
            ->pluck('fk_usergroup');

        // Map common Dolibarr groups to roles
        foreach ($groups as $groupId) {
            $group = DB::connection($this->connection)
                ->table('llx_usergroup')
                ->where('rowid', $groupId)
                ->first();

            if ($group) {
                $groupName = strtolower($group->nom);
                if (str_contains($groupName, 'warehouse') || str_contains($groupName, 'logistics')) {
                    return 'warehouse';
                }
                if (str_contains($groupName, 'driver') || str_contains($groupName, 'delivery')) {
                    return 'driver';
                }
            }
        }

        return 'driver'; // Default role
    }

    /**
     * Clear user cache.
     */
    public function clearUserCache(string $email): void
    {
        $cacheKey = "dolibarr_user_{$email}";
        Cache::forget($cacheKey);
    }

    /**
     * Test Dolibarr database connection.
     */
    public function testConnection(): bool
    {
        try {
            DB::connection($this->connection)->select('SELECT 1');
            return true;
        } catch (\Exception $e) {
            Log::error('Dolibarr connection test failed: ' . $e->getMessage());
            return false;
        }
    }
}