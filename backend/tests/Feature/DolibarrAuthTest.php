<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
use Mockery;

class DolibarrAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create test user
        User::factory()->create([
            'email' => 'test@example.com',
            'dolibarr_user_id' => 123,
            'role' => 'driver',
        ]);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_successful_login_with_dolibarr_credentials()
    {
        // Mock Dolibarr authentication
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
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('first')
            ->andReturn($mockUser);

        // Mock group query
        $mockGroupBuilder = Mockery::mock('stdClass');
        $mockConnection->shouldReceive('table')
            ->with('llx_usergroup_user')
            ->andReturn($mockGroupBuilder);

        $mockGroupBuilder->shouldReceive('where')
            ->andReturn($mockGroupBuilder);

        $mockGroupBuilder->shouldReceive('pluck')
            ->andReturn(collect([]));

        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password123',
            'device_name' => 'test-device'
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'user' => [
                    'id',
                    'dolibarr_user_id',
                    'name',
                    'email',
                    'role'
                ],
                'token'
            ]);

        $this->assertDatabaseHas('users', [
            'email' => 'test@example.com',
            'dolibarr_user_id' => 123,
            'role' => 'driver'
        ]);
    }

    public function test_failed_login_with_invalid_dolibarr_credentials()
    {
        // Mock Dolibarr authentication failure
        $mockConnection = Mockery::mock('stdClass');
        $mockBuilder = Mockery::mock('stdClass');

        DB::shouldReceive('connection')
            ->with('dolibarr')
            ->andReturn($mockConnection);

        $mockConnection->shouldReceive('table')
            ->with('llx_user')
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('where')
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('first')
            ->andReturn(null);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'wrongpassword',
            'device_name' => 'test-device'
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'message' => 'Authentication failed',
                'errors' => [
                    'email' => ['Invalid Dolibarr credentials.']
                ]
            ]);
    }

    public function test_login_with_deactivated_account()
    {
        // Create deactivated user
        User::factory()->create([
            'email' => 'deactivated@example.com',
            'dolibarr_user_id' => 456,
            'role' => 'driver',
            'is_active' => false,
        ]);

        // Mock Dolibarr authentication
        $mockConnection = Mockery::mock('stdClass');
        $mockBuilder = Mockery::mock('stdClass');
        
        $mockUser = (object) [
            'rowid' => 456,
            'email' => 'deactivated@example.com',
            'pass' => password_hash('password123', PASSWORD_BCRYPT),
            'lastname' => 'Deactivated',
            'firstname' => 'User',
            'login' => 'deactivated',
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
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('first')
            ->andReturn($mockUser);

        // Mock group query
        $mockGroupBuilder = Mockery::mock('stdClass');
        $mockConnection->shouldReceive('table')
            ->with('llx_usergroup_user')
            ->andReturn($mockGroupBuilder);

        $mockGroupBuilder->shouldReceive('where')
            ->andReturn($mockGroupBuilder);

        $mockGroupBuilder->shouldReceive('pluck')
            ->andReturn(collect([]));

        $response = $this->postJson('/api/auth/login', [
            'email' => 'deactivated@example.com',
            'password' => 'password123',
            'device_name' => 'test-device'
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'message' => 'Authentication failed',
                'errors' => [
                    'email' => ['Account is deactivated.']
                ]
            ]);
    }

    public function test_get_current_user()
    {
        $user = User::factory()->create([
            'email' => 'current@example.com',
            'dolibarr_user_id' => 789,
            'role' => 'admin',
        ]);

        $token = $user->createToken('test-device')->plainTextToken;

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token,
        ])>getJson('/api/auth/user');

        $response->assertStatus(200)
            ->assertJson([
                'user' => [
                    'id' => $user->id,
                    'dolibarr_user_id' => 789,
                    'name' => $user->name,
                    'email' => 'current@example.com',
                    'role' => 'admin'
                ]
            ]);
    }

    public function test_logout()
    {
        $user = User::factory()->create();
        $token = $user->createToken('test-device')->plainTextToken;

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token,
        ])>postJson('/api/auth/logout');

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Logout successful'
            ]);
    }

    public function test_dolibarr_connection_failure()
    {
        // Mock Dolibarr connection failure
        DB::shouldReceive('connection')
            ->with('dolibarr')
            ->andThrow(new \Exception('Connection failed'));

        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password123',
            'device_name' => 'test-device'
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'message' => 'Authentication failed',
                'errors' => [
                    'email' => ['Invalid Dolibarr credentials.']
                ]
            ]);
    }

    public function test_validation_errors()
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'invalid-email',
            'password' => '123',
            'device_name' => ''
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password', 'device_name']);
    }

    public function test_rate_limiting()
    {
        // This test would require rate limiting to be configured
        // For now, we'll just test that the endpoint exists and handles requests
        $mockConnection = Mockery::mock('stdClass');
        $mockBuilder = Mockery::mock('stdClass');

        DB::shouldReceive('connection')
            ->with('dolibarr')
            ->andReturn($mockConnection);

        $mockConnection->shouldReceive('table')
            ->with('llx_user')
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('where')
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('first')
            ->andReturn(null);

        // Make multiple failed login attempts
        for ($i = 0; $i < 5; $i++) {
            $response = $this->postJson('/api/auth/login', [
                'email' => 'test@example.com',
                'password' => 'wrongpassword',
                'device_name' => 'test-device'
            ]);

            $response->assertStatus(401);
        }
    }

    public function test_admin_role_mapping()
    {
        // Mock Dolibarr authentication for admin user
        $mockConnection = Mockery::mock('stdClass');
        $mockBuilder = Mockery::mock('stdClass');
        
        $mockUser = (object) [
            'rowid' => 999,
            'email' => 'admin@example.com',
            'pass' => password_hash('password123', PASSWORD_BCRYPT),
            'lastname' => 'Admin',
            'firstname' => 'John',
            'login' => 'admin',
            'admin' => 1,
            'statut' => 1,
        ];

        DB::shouldReceive('connection')
            ->with('dolibarr')
            ->andReturn($mockConnection);

        $mockConnection->shouldReceive('table')
            ->with('llx_user')
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('where')
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('first')
            ->andReturn($mockUser);

        // Mock group query
        $mockGroupBuilder = Mockery::mock('stdClass');
        $mockConnection->shouldReceive('table')
            ->with('llx_usergroup_user')
            ->andReturn($mockGroupBuilder);

        $mockGroupBuilder->shouldReceive('where')
            ->andReturn($mockGroupBuilder);

        $mockGroupBuilder->shouldReceive('pluck')
            ->andReturn(collect([]));

        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin@example.com',
            'password' => 'password123',
            'device_name' => 'test-device'
        ]);

        $response->assertStatus(200);
        
        $this->assertDatabaseHas('users', [
            'email' => 'admin@example.com',
            'dolibarr_user_id' => 999,
            'role' => 'admin'
        ]);
    }

    public function test_warehouse_role_mapping()
    {
        // Mock Dolibarr authentication for warehouse user
        $mockConnection = Mockery::mock('stdClass');
        $mockBuilder = Mockery::mock('stdClass');
        
        $mockUser = (object) [
            'rowid' => 888,
            'email' => 'warehouse@example.com',
            'pass' => password_hash('password123', PASSWORD_BCRYPT),
            'lastname' => 'Manager',
            'firstname' => 'Warehouse',
            'login' => 'warehouse',
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
            ->andReturn($mockBuilder);

        $mockBuilder->shouldReceive('first')
            ->andReturn($mockUser);

        // Mock group query for warehouse
        $mockGroupBuilder = Mockery::mock('stdClass');
        $mockConnection->shouldReceive('table')
            ->with('llx_usergroup_user')
            ->andReturn($mockGroupBuilder);

        $mockGroupBuilder->shouldReceive('where')
            ->andReturn($mockGroupBuilder);

        $mockGroupBuilder->shouldReceive('pluck')
            ->andReturn(collect([10]));

        // Mock group details
        $mockGroupDetailsBuilder = Mockery::mock('stdClass');
        $mockConnection->shouldReceive('table')
            ->with('llx_usergroup')
            ->andReturn($mockGroupDetailsBuilder);

        $mockGroupDetailsBuilder->shouldReceive('where')
            ->with('rowid', 10)
            ->andReturn($mockGroupDetailsBuilder);

        $mockGroupDetailsBuilder->shouldReceive('first')
            ->andReturn((object)['nom' => 'Warehouse Staff']);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'warehouse@example.com',
            'password' => 'password123',
            'device_name' => 'test-device'
        ]);

        $response->assertStatus(200);
        
        $this->assertDatabaseHas('users', [
            'email' => 'warehouse@example.com',
            'dolibarr_user_id' => 888,
            'role' => 'warehouse'
        ]);
    }
}