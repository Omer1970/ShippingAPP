<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create a test user
        $this->testUser = User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => Hash::make('password123'),
            'role' => 'driver',
            'is_active' => true,
        ]);
    }

    /**
     * Test successful login with valid credentials.
     */
    public function test_successful_login_with_valid_credentials(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password123',
            'device_name' => 'Test Device',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'user' => [
                        'id',
                        'name',
                        'email',
                        'role',
                        'is_active',
                    ],
                    'token',
                    'expires_at',
                ],
                'message',
            ])
            ->assertJson([
                'success' => true,
                'message' => 'Login successful',
            ]);

        $this->assertNotEmpty($response->json('data.token'));
    }

    /**
     * Test failed login with invalid credentials.
     */
    public function test_failed_login_with_invalid_credentials(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'wrongpassword',
            'device_name' => 'Test Device',
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'Authentication failed',
            ]);
    }

    /**
     * Test failed login with inactive user.
     */
    public function test_failed_login_with_inactive_user(): void
    {
        $inactiveUser = User::factory()->create([
            'email' => 'inactive@example.com',
            'password' => Hash::make('password123'),
            'is_active' => false,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'inactive@example.com',
            'password' => 'password123',
            'device_name' => 'Test Device',
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'Authentication failed',
            ]);
    }

    /**
     * Test login validation errors.
     */
    public function test_login_validation_errors(): void
    {
        $response = $this->postJson('/api/auth/login', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password', 'device_name']);
    }

    /**
     * Test getting authenticated user profile.
     */
    public function test_get_authenticated_user_profile(): void
    {
        Sanctum::actingAs($this->testUser);

        $response = $this->getJson('/api/auth/user');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'user' => [
                        'id' => $this->testUser->id,
                        'name' => $this->testUser->name,
                        'email' => $this->testUser->email,
                        'role' => $this->testUser->role,
                    ],
                ],
            ]);
    }

    /**
     * Test getting user profile without authentication.
     */
    public function test_get_user_profile_without_authentication(): void
    {
        $response = $this->getJson('/api/auth/user');

        $response->assertStatus(401);
    }

    /**
     * Test successful logout.
     */
    public function test_successful_logout(): void
    {
        Sanctum::actingAs($this->testUser);

        $response = $this->postJson('/api/auth/logout');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Logout successful',
            ]);

        // Verify token was revoked
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $this->testUser->id,
            'tokenable_type' => User::class,
        ]);
    }

    /**
     * Test token refresh.
     */
    public function test_token_refresh(): void
    {
        Sanctum::actingAs($this->testUser);

        $response = $this->postJson('/api/auth/refresh');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'user',
                    'token',
                    'expires_at',
                ],
                'message',
            ])
            ->assertJson([
                'success' => true,
                'message' => 'Token refreshed successfully',
            ]);
    }

    /**
     * Test rate limiting on login endpoint.
     */
    public function test_rate_limiting_on_login(): void
    {
        // Make multiple failed login attempts
        for ($i = 0; $i < 65; $i++) { // Exceed the rate limit
            $response = $this->postJson('/api/auth/login', [
                'email' => 'test@example.com',
                'password' => 'wrongpassword',
                'device_name' => 'Test Device',
            ]);
        }

        // The last request should be rate limited
        $response->assertStatus(429); // Too Many Requests
    }

    /**
     * Test user role methods.
     */
    public function test_user_role_methods(): void
    {
        $adminUser = User::factory()->create([
            'role' => 'admin',
        ]);

        $this->assertTrue($adminUser->isAdmin());
        $this->assertFalse($adminUser->isDriver());
        $this->assertFalse($adminUser->isWarehouse());
        $this->assertTrue($adminUser->hasRole('admin'));

        $driverUser = User::factory()->create([
            'role' => 'driver',
        ]);

        $this->assertFalse($driverUser->isAdmin());
        $this->assertTrue($driverUser->isDriver());
        $this->assertFalse($driverUser->isWarehouse());
        $this->assertTrue($driverUser->hasRole('driver'));
    }

    /**
     * Test user active status methods.
     */
    public function test_user_active_status_methods(): void
    {
        $activeUser = User::factory()->create([
            'is_active' => true,
        ]);

        $inactiveUser = User::factory()->create([
            'is_active' => false,
        ]);

        $this->assertTrue($activeUser->isActive());
        $this->assertFalse($inactiveUser->isActive());
    }
}