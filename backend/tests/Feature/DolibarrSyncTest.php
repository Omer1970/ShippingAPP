<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
use Mockery;

class DolibarrSyncTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_sync_users_from_dolibarr()
    {
        // Mock Dolibarr connection
        $mockConnection = Mockery::mock('stdClass');
        $mockBuilder = Mockery::mock('stdClass');

        DB::shouldReceive('connection')
            ->with('dolibarr')
            ->andReturn($mockConnection);

        $mockConnection->shouldReceive('select')
            ->with('SELECT 1')
            ->andReturn([(object)['1' => 1]]);

        $mockConnection->shouldReceive('table')
            ->with('llx_user')
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('where')
            ->with('statut', 1)
            ->andReturn($mockBuilder);

        // Mock Dolibarr users
        $dolibarrUsers = collect([
            (object) [
                'rowid' => 1,
                'email' => 'user1@example.com',
                'lastname' => 'User',
                'firstname' => 'One',
                'login' => 'user1',
                'admin' => 0,
                'statut' => 1,
            ],
            (object) [
                'rowid' => 2,
                'email' => 'user2@example.com',
                'lastname' => 'User',
                'firstname' => 'Two',
                'login' => 'user2',
                'admin' => 1,
                'statut' => 1,
            ],
        ]);

        $mockBuilder->shouldReceive('get')
            ->andReturn($dolibarrUsers);

        // Mock group queries
        $mockGroupBuilder = Mockery::mock('stdClass');
        $mockConnection->shouldReceive('table')
            ->with('llx_usergroup_user')
            ->andReturn($mockGroupBuilder);

        $mockGroupBuilder->shouldReceive('where')
            ->andReturn($mockGroupBuilder);

        $mockGroupBuilder->shouldReceive('pluck')
            ->andReturn(collect([]));

        // Run the sync command
        $exitCode = Artisan::call('dolibarr:sync-users');

        $this->assertEquals(0, $exitCode);

        // Verify users were created
        $this->assertDatabaseHas('users', [
            'email' => 'user1@example.com',
            'dolibarr_user_id' => 1,
            'role' => 'driver',
        ]);

        $this->assertDatabaseHas('users', [
            'email' => 'user2@example.com',
            'dolibarr_user_id' => 2,
            'role' => 'admin',
        ]);
    }

    public function test_sync_users_dry_run()
    {
        // Mock Dolibarr connection
        $mockConnection = Mockery::mock('stdClass');
        $mockBuilder = Mockery::mock('stdClass');

        DB::shouldReceive('connection')
            ->with('dolibarr')
            ->andReturn($mockConnection);

        $mockConnection->shouldReceive('select')
            ->with('SELECT 1')
            ->andReturn([(object)['1' => 1]]);

        $mockConnection->shouldReceive('table')
            ->with('llx_user')
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('where')
            ->with('statut', 1)
            ->andReturn($mockBuilder);

        // Mock Dolibarr users
        $dolibarrUsers = collect([
            (object) [
                'rowid' => 1,
                'email' => 'user1@example.com',
                'lastname' => 'User',
                'firstname' => 'One',
                'login' => 'user1',
                'admin' => 0,
                'statut' => 1,
            ],
        ]);

        $mockBuilder->shouldReceive('get')
            ->andReturn($dolibarrUsers);

        // Mock group queries
        $mockGroupBuilder = Mockery::mock('stdClass');
        $mockConnection->shouldReceive('table')
            ->with('llx_usergroup_user')
            ->andReturn($mockGroupBuilder);

        $mockGroupBuilder->shouldReceive('where')
            ->andReturn($mockGroupBuilder);

        $mockGroupBuilder->shouldReceive('pluck')
            ->andReturn(collect([]));

        // Run the sync command with dry-run option
        $exitCode = Artisan::call('dolibarr:sync-users', ['--dry-run' => true]);

        $this->assertEquals(0, $exitCode);

        // Verify no users were created
        $this->assertDatabaseMissing('users', [
            'email' => 'user1@example.com',
        ]);
    }

    public function test_sync_users_with_existing_users()
    {
        // Create existing user
        User::factory()->create([
            'email' => 'existing@example.com',
            'dolibarr_user_id' => 1,
            'name' => 'Old Name',
            'role' => 'driver',
        ]);

        // Mock Dolibarr connection
        $mockConnection = Mockery::mock('stdClass');
        $mockBuilder = Mockery::mock('stdClass');

        DB::shouldReceive('connection')
            ->with('dolibarr')
            ->andReturn($mockConnection);

        $mockConnection->shouldReceive('select')
            ->with('SELECT 1')
            ->andReturn([(object)['1' => 1]]);

        $mockConnection->shouldReceive('table')
            ->with('llx_user')
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('where')
            ->with('statut', 1)
            ->andReturn($mockBuilder);

        // Mock updated Dolibarr user
        $dolibarrUsers = collect([
            (object) [
                'rowid' => 1,
                'email' => 'existing@example.com',
                'lastname' => 'New',
                'firstname' => 'Name',
                'login' => 'existing',
                'admin' => 0,
                'statut' => 1,
            ],
        ]);

        $mockBuilder->shouldReceive('get')
            ->andReturn($dolibarrUsers);

        // Mock group queries
        $mockGroupBuilder = Mockery::mock('stdClass');
        $mockConnection->shouldReceive('table')
            ->with('llx_usergroup_user')
            ->andReturn($mockGroupBuilder);

        $mockGroupBuilder->shouldReceive('where')
            ->andReturn($mockGroupBuilder);

        $mockGroupBuilder->shouldReceive('pluck')
            ->andReturn(collect([]));

        // Run the sync command
        $exitCode = Artisan::call('dolibarr:sync-users');

        $this->assertEquals(0, $exitCode);

        // Verify user was updated
        $this->assertDatabaseHas('users', [
            'email' => 'existing@example.com',
            'dolibarr_user_id' => 1,
            'name' => 'New Name',
            'role' => 'driver',
        ]);
    }

    public function test_sync_users_deactivates_removed_users()
    {
        // Create users that will be deactivated
        User::factory()->create([
            'email' => 'toremove@example.com',
            'dolibarr_user_id' => 999,
            'is_active' => true,
        ]);

        // Mock Dolibarr connection with empty users
        $mockConnection = Mockery::mock('stdClass');
        $mockBuilder = Mockery::mock('stdClass');

        DB::shouldReceive('connection')
            ->with('dolibarr')
            ->andReturn($mockConnection);

        $mockConnection->shouldReceive('select')
            ->with('SELECT 1')
            ->andReturn([(object)['1' => 1]]);

        $mockConnection->shouldReceive('table')
            ->with('llx_user')
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('where')
            ->with('statut', 1)
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('get')
            ->andReturn(collect([]));

        // Run the sync command with full sync
        $exitCode = Artisan::call('dolibarr:sync-users', ['--full' => true]);

        $this->assertEquals(0, $exitCode);

        // Verify user was deactivated
        $this->assertDatabaseHas('users', [
            'email' => 'toremove@example.com',
            'is_active' => false,
        ]);
    }

    public function test_sync_users_connection_failure()
    {
        // Mock Dolibarr connection failure
        DB::shouldReceive('connection')
            ->with('dolibarr')
            ->andThrow(new \Exception('Connection failed'));

        // Run the sync command
        $exitCode = Artisan::call('dolibarr:sync-users');

        $this->assertEquals(1, $exitCode);
    }

    public function test_sync_users_since_date()
    {
        // Mock Dolibarr connection
        $mockConnection = Mockery::mock('stdClass');
        $mockBuilder = Mockery::mock('stdClass');

        DB::shouldReceive('connection')
            ->with('dolibarr')
            ->andReturn($mockConnection);

        $mockConnection->shouldReceive('select')
            ->with('SELECT 1')
            ->andReturn([(object)['1' => 1]]);

        $mockConnection->shouldReceive('table')
            ->with('llx_user')
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('where')
            ->with('statut', 1)
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('where')
            ->with('tms', '>=', '2023-01-01 00:00:00')
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('get')
            ->andReturn(collect([]));

        // Run the sync command with since option
        $exitCode = Artisan::call('dolibarr:sync-users', [
            '--since' => '2023-01-01 00:00:00'
        ]);

        $this->assertEquals(0, $exitCode);
    }

    public function test_sync_users_handles_database_errors()
    {
        // Mock Dolibarr connection
        $mockConnection = Mockery::mock('stdClass');
        $mockBuilder = Mockery::mock('stdClass');

        DB::shouldReceive('connection')
            ->with('dolibarr')
            ->andReturn($mockConnection);

        $mockConnection->shouldReceive('select')
            ->with('SELECT 1')
            ->andReturn([(object)['1' => 1]]);

        $mockConnection->shouldReceive('table')
            ->with('llx_user')
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('where')
            ->with('statut', 1)
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('get')
            ->andThrow(new \Exception('Database error'));

        // Run the sync command
        $exitCode = Artisan::call('dolibarr:sync-users');

        $this->assertEquals(1, $exitCode);
    }
}