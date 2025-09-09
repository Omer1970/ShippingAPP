<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\DolibarrAuthService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SyncDolibarrUsers extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'dolibarr:sync-users
                          {--full : Perform full sync (update all users)}
                          {--since= : Sync only users updated since date (Y-m-d H:i:s)}
                          {--dry-run : Show what would be synced without making changes}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Synchronize users from Dolibarr ERP to local cache';

    /**
     * Execute the console command.
     */
    public function handle(DolibarrAuthService $dolibarrAuth): int
    {
        $this->info('Starting Dolibarr user synchronization...');

        try {
            // Test Dolibarr connection
            if (!$dolibarrAuth->testConnection()) {
                $this->error('Failed to connect to Dolibarr database.');
                return Command::FAILURE;
            }

            $this->info('Connected to Dolibarr database successfully.');

            // Determine sync scope
            $isFullSync = $this->option('full');
            $sinceDate = $this->option('since');
            $isDryRun = $this->option('dry-run');

            // Get users from Dolibarr
            $query = DB::connection('dolibarr')
                ->table('llx_user')
                ->where('statut', 1); // Active users only

            if (!$isFullSync && $sinceDate) {
                $query->where('tms', '>=', $sinceDate);
            }

            $dolibarrUsers = $query->get();

            $this->info("Found {$dolibarrUsers->count()} users to sync.");

            $synced = 0;
            $created = 0;
            $updated = 0;
            $errors = 0;

            foreach ($dolibarrUsers as $dolibarrUser) {
                try {
                    $this->syncUser($dolibarrUser, $isDryRun, $synced, $created, $updated);
                } catch (\Exception $e) {
                    $errors++;
                    $this->error("Failed to sync user {$dolibarrUser->email}: " . $e->getMessage());
                    Log::error("Dolibarr sync error for user {$dolibarrUser->email}: " . $e->getMessage());
                }
            }

            // Handle deactivated users (soft delete)
            if ($isFullSync) {
                $this->handleDeactivatedUsers($dolibarrUsers, $isDryRun);
            }

            // Display summary
            $this->newLine();
            $this->info('=== Sync Summary ===');
            $this->info("Total users processed: {$synced}");
            $this->info("New users created: {$created}");
            $this->info("Existing users updated: {$updated}");
            $this->info("Errors: {$errors}");

            if ($isDryRun) {
                $this->warn('This was a dry run. No changes were made.');
            }

            return Command::SUCCESS;

        } catch (\Exception $e) {
            $this->error('Sync failed: ' . $e->getMessage());
            Log::error('Dolibarr sync failed: ' . $e->getMessage());
            return Command::FAILURE;
        }
    }

    /**
     * Sync individual user.
     */
    private function syncUser(object $dolibarrUser, bool $isDryRun, int &$synced, int &$created, int &$updated): void
    {
        $userData = [
            'name' => $this->getUserFullName($dolibarrUser),
            'email' => $dolibarrUser->email,
            'role' => $this->getUserRole($dolibarrUser),
            'is_active' => true,
        ];

        $existingUser = User::where('dolibarr_user_id', $dolibarrUser->rowid)->first();

        if ($existingUser) {
            // Update existing user
            if (!$isDryRun) {
                $existingUser->update($userData);
            }
            $updated++;
            $this->line("Updated: {$dolibarrUser->email}");
        } else {
            // Create new user
            if (!$isDryRun) {
                User::create(array_merge($userData, [
                    'dolibarr_user_id' => $dolibarrUser->rowid,
                ]));
            }
            $created++;
            $this->line("Created: {$dolibarrUser->email}");
        }

        $synced++;
    }

    /**
     * Handle deactivated users.
     */
    private function handleDeactivatedUsers(object $dolibarrUsers, bool $isDryRun): void
    {
        $dolibarrUserIds = $dolibarrUsers->pluck('rowid')->toArray();
        
        $localUsers = User::whereNotNull('dolibarr_user_id')
            ->whereNotIn('dolibarr_user_id', $dolibarrUserIds)
            ->where('is_active', true)
            ->get();

        if ($localUsers->isNotEmpty()) {
            $this->newLine();
            $this->info("Deactivating {$localUsers->count()} users no longer in Dolibarr...");

            foreach ($localUsers as $user) {
                if (!$isDryRun) {
                    $user->update(['is_active' => false]);
                }
                $this->line("Deactivated: {$user->email}");
            }
        }
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
    private function getUserRole(object $user): string
    {
        // Check if user has admin rights in Dolibarr
        if ($user->admin === 1) {
            return 'admin';
        }

        // Check group memberships for role determination
        $groups = DB::connection('dolibarr')
            ->table('llx_usergroup_user')
            ->where('fk_user', $user->rowid)
            ->pluck('fk_usergroup');

        // Map common Dolibarr groups to roles
        foreach ($groups as $groupId) {
            $group = DB::connection('dolibarr')
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
}