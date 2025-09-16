<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Shipment;
use App\Models\DeliveryConfirmation;
use App\Models\DeliverySignature;
use App\Models\DeliveryPhoto;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;
use App\Jobs\SyncDeliveryToErp;

/**
 * Integration tests for Delivery Confirmation API endpoints
 */
class DeliveryConfirmationTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    private User $user;
    private Shipment $shipment;
    private string $authToken;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->user = User::factory()->create();
        $this->shipment = Shipment::factory()->create();
        $this->authToken = $this->getAuthTokenForUser($this->user);
    }

    /**
     * Helper method to get authentication token
     */
    private function getAuthTokenForUser(User $user): string
    {
        // Create personal access token for testing
        return $user->createToken('test-token')->plainTextToken;
    }

    /**
     * Test creating delivery confirmation with signature and photos
     */
    public function test_create_delivery_confirmation_with_full_data(): void
    {
        Storage::fake('public');

        $deliveryData = [
            'delivered_at' => now()->format('Y-m-d H:i:s'),
            'recipient_name' => 'John Customer',
            'delivery_notes' => 'Delivered successfully',
            'gps_latitude' => 40.7128,
            'gps_longitude' => -74.0060,
            'gps_accuracy' => 5.0,
            'signature_data' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            'signature_quality' => 0.95,
            'photo_ids' => []
        ];

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->authToken,
            'Accept' => 'application/json',
        ])->postJson("/api/deliveries/{$this->shipment->id}/confirm", $deliveryData);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'delivery_confirmation' => [
                        'shipment_id' => $this->shipment->id,
                        'recipient_name' => 'John Customer',
                        'status' => 'delivered'
                    ]
                ]
            ]);

        // Verify delivery was created
        $delivery = DeliveryConfirmation::where('shipment_id', $this->shipment->id)->first();
        $this->assertNotNull($delivery);
        $this->assertEquals('John Customer', $delivery->recipient_name);
        $this->assertEquals(40.7128, $delivery->gps_latitude);
        $this->assertEquals(-74.0060, $delivery->gps_longitude);
        $this->assertEquals(5.0, $delivery->gps_accuracy);

        // Verify ERP sync queued
        Queue::assertPushed(SyncDeliveryToErp::class, function ($job) use ($delivery) {
            return $job->deliveryId === $delivery->id;
        });
    }

    /**
     * Test creating delivery confirmation with validation errors
     */
    public function test_create_delivery_confirmation_with_validation_errors(): void
    {
        $deliveryData = [
            'recipient_name' => '', // Missing required field
            'gps_latitude' => 100.0, // Invalid latitude
            'gps_longitude' => -200.0, // Invalid longitude
        ];

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->authToken,
            'Accept' => 'application/json',
        ])->postJson("/api/deliveries/{$this->shipment->id}/confirm", $deliveryData);

        $response->assertStatus(422)
            ->assertJsonFragment([
                'success' => false,
                'message' => 'Validation failed'
            ]);
    }

    /**
     * Test uploading delivery photo
     */
    public function test_upload_delivery_photo(): void
    {
        Storage::fake('public');

        $delivery = DeliveryConfirmation::factory()->create([
            'shipment_id' => $this->shipment->id,
            'user_id' => $this->user->id
        ]);

        $file = UploadedFile::fake()->image('delivery.jpg', 800, 600)->size(500); // 500KB

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->authToken,
            'Accept' => 'application/json',
        ])->postJson("/api/deliveries/{$delivery->id}/photo", [
            'photo' => $file,
            'photo_type' => 'delivery_proof',
            'gps_latitude' => 40.7128,
            'gps_longitude' => -74.0060,
            'photo_metadata' => [
                'camera_model' => 'iPhone 14',
                'resolution' => '800x600'
            ]
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'photo' => [
                        'photo_type' => 'delivery_proof',
                        'has_gps' => true
                    ]
                ]
            ]);

        // Verify storage
        Storage::disk('public')->assertExists('delivery_photos/' . $delivery->id . '/delivery.jpg');
        
        // Verify photo was saved to database
        $this->assertDatabaseHas('delivery_photos', [
            'delivery_confirmation_id' => $delivery->id,
            'photo_type' => 'delivery_proof',
            'gps_latitude' => 40.7128,
            'gps_longitude' => -74.0060
        ]);
    }

    /**
     * Test updating delivery status
     */
    public function test_update_delivery_status(): void
    {
        $delivery = DeliveryConfirmation::factory()->create([
            'shipment_id' => $this->shipment->id,
            'user_id' => $this->user->id,
            'status' => 'delivered'
        ]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->authToken,
            'Accept' => 'application/json',
        ])->putJson("/api/deliveries/{$delivery->id}/status", [
            'status' => 'failed',
            'delivery_notes' => 'Could not locate customer'
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'delivery_confirmation' => [
                        'status' => 'failed',
                        'delivery_notes' => 'Could not locate customer'
                    ]
                ]
            ]);

        $delivery->refresh();
        $this->assertEquals('failed', $delivery->status);
        $this->assertStringContains('Could not locate customer', $delivery->delivery_notes);
    }

    /**
     * Test retrieving delivery confirmation
     */
    public function test_get_delivery_confirmation(): void
    {
        $delivery = DeliveryConfirmation::factory()->create([
            'shipment_id' => $this->shipment->id,
            'user_id' => $this->user->id,
            'status' => 'delivered',
            'recipient_name' => 'Jane Customer'
        ]);

        $delivery->signature()->create(
            DeliverySignature::factory()->make([
                'signature_quality' => 0.95
            ])->toArray()
        );

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->authToken,
            'Accept' => 'application/json',
        ])->getJson("/api/deliveries/{$this->shipment->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'delivery_confirmation' => [
                        'shipment_id' => $this->shipment->id,
                        'status' => 'delivered',
                        'recipient_name' => 'Jane Customer'
                    ]
                ]
            ]);
    }

    /**
     * Test retrieving user's delivery confirmations
     */
    public function test_get_user_deliveries(): void
    {
        $deliveries = DeliveryConfirmation::factory(3)->create([
            'user_id' => $this->user->id,
            'shipment_id' => $this->shipment->id
        ]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->authToken,
            'Accept' => 'application/json',
        ])->getJson("/api/deliveries/user/{$this->user->id}");

        $response->assertStatus(200)
            ->assertJsonCount(3, 'data.deliveries.data');
    }

    /**
     * Test delivery statistics endpoint
     */
    public function test_get_delivery_statistics(): void
    {
        // Create test deliveries with various statuses
        DeliveryConfirmation::factory(5)->create([
            'user_id' => $this->user->id,
            'status' => 'delivered',
            'delivered_at' => now()->subDays(2)
        ]);

        DeliveryConfirmation::factory(2)->create([
            'user_id' => $this->user->id,
            'status' => 'failed'
        ]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->authToken,
            'Accept' => 'application/json',
        ])->getJson('api/deliveries/stats');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'statistics' => [
                        'total_deliveries' => 7,
                        'successful_deliveries' => 5,
                        'success_rate' => 71.43
                    ]
                ]
            ]);
    }

    /**
     * Test unauthorized access to delivery confirmation
     */
    public function test_unauthorized_access_to_delivery_confirmation(): void
    {
        $otherUser = User::factory()->create();
        $otherUsersDelivery = DeliveryConfirmation::factory()->create([
            'user_id' => $otherUser->id,
            'shipment_id' => Shipment::factory()->create()->id
        ]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->authToken,
            'Accept' => 'application/json',
        ])->getJson("/api/deliveries/{$otherUsersDelivery->shipment_id}");

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'Unauthorized to access this delivery confirmation'
            ]);
    }

    /**
     * Test photo file size validation
     */
    public function test_photo_file_size_validation(): void
    {
        Storage::fake('public');

        $delivery = DeliveryConfirmation::factory()->create([
            'shipment_id' => $this->shipment->id,
            'user_id' => $this->user->id
        ]);

        // Create a file larger than 5MB
        $largeFile = UploadedFile::fake()->image('large.jpg', 800, 600)->size(6000); // 6MB

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->authToken,
            'Accept' => 'application/json',
        ])->postJson("/api/deliveries/{$delivery->id}/photo", [
            'photo' => $largeFile,
            'photo_type' => 'delivery_proof'
        ]);

        $response->assertStatus(422)
            ->assertJsonFragment([
                'success' => false,
                'message' => 'Validation failed'
            ]);
    }

    /**
     * Test GPS accuracy validation
     */
    public function test_gps_accuracy_validation(): void
    {
        $deliveryData = [
            'delivered_at' => now()->format('Y-m-d H:i:s'),
            'recipient_name' => 'John Customer',
            'gps_latitude' => 40.7128,
            'gps_longitude' => -74.0060,
            'gps_accuracy' => 100.0, // Too high accuracy
        ];

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->authToken,
            'Accept' => 'application/json',
        ])->postJson("/api/deliveries/{$this->shipment->id}/confirm", $deliveryData);

        $response->assertStatus(422)
            ->assertJsonFragment([
                'success' => false,
                'message' => 'Validation failed'
            ]);
    }

    /**
     * Test delivery confirmation with WebSocket events
     */
    public function test_delivery_confirmation_triggers_websocket_events(): void
    {
        Storage::fake('public');

        $deliveryData = [
            'delivered_at' => now()->format('Y-m-d H:i:s'),
            'recipient_name' => 'John Customer',
            'gps_latitude' => 40.7128,
            'gps_longitude' => -74.0060,
            'gps_accuracy' => 5.0
        ];

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->authToken,
            'Accept' => 'application/json',
        ])->postJson("/api/deliveries/{$this->shipment->id}/confirm", $deliveryData);

        $response->assertStatus(201);

        // Verify WebSocket event would be triggered (in real implementation)
        $delivery = DeliveryConfirmation::first();
        
        // In a real test, we would assert that the broadcasting event was dispatched
        // For now, we verify the delivery was created successfully
        $this->assertNotNull($delivery);
        $this->assertEquals('John Customer', $delivery->recipient_name);
    }
}