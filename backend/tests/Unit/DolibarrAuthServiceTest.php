<?php

namespace Tests\Unit;

use App\Services\DolibarrAuthService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;
use Mockery;

class DolibarrAuthServiceTest extends TestCase
{
    private DolibarrAuthService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new DolibarrAuthService();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_authenticate_with_valid_credentials()
    {
        // Mock the database connection
        $mockConnection = Mockery::mock('stdClass');
        $mockBuilder = Mockery::mock('stdClass');
        
        $mockUser = (object) [
            'rowid' => 123,
            'email' => 'test@example.com',
            'pass' => password_hash('password123', PASSWORD_BCRYPT),
            'lastname' => 'Doe',
            'firstname' => 'John',
            'login' => 'johndoe',
            'admin' => 0,
            'statut' => 1,
        ];

        DB::shouldReceive('connection')
            ->with('dolibarr')
            ->andReturn($mockConnection);

        $mockConnection->shouldReceive('table')
            ->with('llx_user')
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('where')
            ->with('email', 'test@example.com')
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('where')
            ->with('statut', 1)
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('first')
            ->andReturn($mockUser);

        // Mock group query
        $mockGroupBuilder = Mockery::mock('stdClass');
        $mockConnection->shouldReceive('table')
            ->with('llx_usergroup_user')
            ->andReturn($mockGroupBuilder);

        $mockGroupBuilder->shouldReceive('where')
            ->with('fk_user', 123)
            ->andReturn($mockGroupBuilder);

        $mockGroupBuilder->shouldReceive('pluck')
            ->with('fk_usergroup')
            ->andReturn(collect([]));

        $result = $this->service->authenticate('test@example.com', 'password123');

        $this->assertNotNull($result);
        $this->assertEquals('test@example.com', $result['email']);
        $this->assertEquals('John Doe', $result['name']);
        $this->assertEquals('driver', $result['role']);
    }

    public function test_authenticate_with_invalid_password()
    {
        // Mock the database connection
        $mockConnection = Mockery::mock('stdClass');
        $mockBuilder = Mockery::mock('stdClass');
        
        $mockUser = (object) [
            'rowid' => 123,
            'email' => 'test@example.com',
            'pass' => password_hash('different_password', PASSWORD_BCRYPT),
            'lastname' => 'Doe',
            'firstname' => 'John',
            'login' => 'johndoe',
            'admin' => 0,
            'statut' => 1,
        ];

        DB::shouldReceive('connection')
            ->with('dolibarr')
            ->andReturn($mockConnection);

        $mockConnection->shouldReceive('table')
            ->with('llx_user')
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('where')
            ->with('email', 'test@example.com')
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('where')
            ->with('statut', 1)
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('first')
            ->andReturn($mockUser);

        $result = $this->service->authenticate('test@example.com', 'wrong_password');

        $this->assertNull($result);
    }

    public function test_authenticate_with_non_existent_user()
    {
        // Mock the database connection
        $mockConnection = Mockery::mock('stdClass');
        $mockBuilder = Mockery::mock('stdClass');

        DB::shouldReceive('connection')
            ->with('dolibarr')
            ->andReturn($mockConnection);

        $mockConnection->shouldReceive('table')
            ->with('llx_user')
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('where')
            ->with('email', 'nonexistent@example.com')
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('where')
            ->with('statut', 1)
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('first')
            ->andReturn(null);

        $result = $this->service->authenticate('nonexistent@example.com', 'password');

        $this->assertNull($result);
    }

    public function test_authenticate_with_cached_user()
    {
        $cachedUser = [
            'id' => 123,
            'email' => 'test@example.com',
            'name' => 'John Doe',
            'role' => 'driver',
            'password_hash' => password_hash('password123', PASSWORD_BCRYPT),
        ];

        Cache::shouldReceive('has')
            ->with('dolibarr_user_test@example.com')
            ->andReturn(true);

        Cache::shouldReceive('get')
            ->with('dolibarr_user_test@example.com')
            ->andReturn($cachedUser);

        $result = $this->service->authenticate('test@example.com', 'password123');

        $this->assertNotNull($result);
        $this->assertEquals($cachedUser, $result);
    }

    public function test_get_user_by_id()
    {
        // Mock the database connection
        $mockConnection = Mockery::mock('stdClass');
        $mockBuilder = Mockery::mock('stdClass');
        
        $mockUser = (object) [
            'rowid' => 123,
            'email' => 'test@example.com',
            'lastname' => 'Doe',
            'firstname' => 'John',
            'login' => 'johndoe',
            'admin' => 1,
        ];

        DB::shouldReceive('connection')
            ->with('dolibarr')
            ->andReturn($mockConnection);

        $mockConnection->shouldReceive('table')
            ->with('llx_user')
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('where')
            ->with('rowid', 123)
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('first')
            ->andReturn($mockUser);

        // Mock group query
        $mockGroupBuilder = Mockery::mock('stdClass');
        $mockConnection->shouldReceive('table')
            ->with('llx_usergroup_user')
            ->andReturn($mockGroupBuilder);

        $mockGroupBuilder->shouldReceive('where')
            ->with('fk_user', 123)
            ->andReturn($mockGroupBuilder);

        $mockGroupBuilder->shouldReceive('pluck')
            ->with('fk_usergroup')
            ->andReturn(collect([]));

        $result = $this->service->getUserById(123);

        $this->assertNotNull($result);
        $this->assertEquals(123, $result['id']);
        $this->assertEquals('test@example.com', $result['email']);
        $this->assertEquals('admin', $result['role']);
    }

    public function test_clear_user_cache()
    {
        Cache::shouldReceive('forget')
            ->with('dolibarr_user_test@example.com')
            ->once();

        $this->service->clearUserCache('test@example.com');
    }

    public function test_test_connection_success()
    {
        // Mock the database connection
        $mockConnection = Mockery::mock('stdClass');

        DB::shouldReceive('connection')
            ->with('dolibarr')
            ->andReturn($mockConnection);

        $mockConnection->shouldReceive('select')
            ->with('SELECT 1')
            ->andReturn([(object)['1' => 1]]);

        $result = $this->service->testConnection();

        $this->assertTrue($result);
    }

    public function test_test_connection_failure()
    {
        // Mock the database connection
        $mockConnection = Mockery::mock('stdClass');

        DB::shouldReceive('connection')
            ->with('dolibarr')
            ->andReturn($mockConnection);

        $mockConnection->shouldReceive('select')
            ->with('SELECT 1')
            ->andThrow(new \Exception('Connection failed'));

        Log::shouldReceive('error')
            ->withArgs(function ($message) {
                return str_contains($message, 'Dolibarr connection test failed');
            });

        $result = $this->service->testConnection();

        $this->assertFalse($result);
    }

    public function test_authenticate_handles_database_exception()
    {
        DB::shouldReceive('connection')
            ->with('dolibarr')
            ->andThrow(new \Exception('Database connection failed'));

        Log::shouldReceive('error')
            ->withArgs(function ($message) {
                return str_contains($message, 'Dolibarr authentication error');
            });

        $result = $this->service->authenticate('test@example.com', 'password');

        $this->assertNull($result);
    }
}