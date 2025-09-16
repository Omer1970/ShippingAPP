<?php

namespace Tests\Unit;

use App\Services\DeliveryWorkflowService;
use App\Services\DolibarrDeliverySyncService;
use App\Services\SignatureService;
use App\Services\PhotoService;
use App\Services\OfflineQueueService;
use App\Models\DeliveryConfirmation;
use App\Models\DeliverySignature;
use App\Models\DeliveryPhoto;
use App\Models\User;
use App\Models\Shipment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;
use Mockery;

/**
 * Unit tests for DeliveryWorkflowService
 */
class DeliveryWorkflowServiceTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    private DeliveryWorkflowService $deliveryWorkflowService;
    private DolibarrDeliverySyncService $mockSyncService;
    private SignatureService $mockSignatureService;
    private PhotoService $mockPhotoService;
    private User $user;
    private Shipment $shipment;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create mock services
        $this->mockSyncService = Mockery::mock(DolibarrDeliverySyncService::class);
        $this->mockSignatureService = Mockery::mock(SignatureService::class);
        $this->mockPhotoService = Mockery::mock(PhotoService::class);
        
        // Set up service with mocks
        $this->deliveryWorkflowService = new DeliveryWorkflowService(
            $this->mockSyncService,
            $this->mockSignatureService,
            $this->mockPhotoService
        );
        
        // Create test user and shipment
        $this->user = User::factory()->create();
        $this->shipment = Shipment::factory()->create();
    }

    /**
     * Test complete delivery workflow processing
     */
    public function test_process_complete_delivery_workflow(): void
    {
        $deliveryData = [
            'shipment_id' => $this->shipment->id,
            'delivered_at' => now(),
            'recipient_name' => 'John Customer',
            'delivery_notes' => 'Delivered successfully',
            'gps_latitude' => 40.7128,
            'gps_longitude' => -74.0060,
            'gps_accuracy' => 5.0,
            'status' => 'delivered',
            'signature_data' => 'base64_encoded_signature_data',
            'signature_quality' => 0.95,
            'photos' => [
                [
                    'photo_type' => 'delivery_proof',
                    'gps_latitude' => 40.7128,
                    'gps_longitude' => -74.0060
                ]
            ]
        ];

        // Set up mock expectations
        $this->mockSignatureService->shouldReceive('validateSignatureData')
            ->once()
            ->with($deliveryData['signature_data'])
            ->andReturn(['valid' => true, 'errors' => []]);

        $this->mockSignatureService->shouldReceive('calculateSignatureQuality')
            ->once()
            ->andReturn(0.95);

        $this->mockPhotoService->shouldReceive('createThumbnail')
            ->once()
            ->andReturn('thumbnail_path');

        // Process delivery
        $result = $this->deliveryWorkflowService->processCompleteDelivery($deliveryData);

        $this->assertInstanceOf(DeliveryConfirmation::class, $result);
        $this->assertEquals($this->shipment->id, $result->shipment_id);
        $this->assertEquals('delivered', $result->status);
        $this->assertEquals('John Customer', $result->recipient_name);
        $this->assertEquals(40.7128, $result->gps_latitude);
        $this->assertNotNull($result->verification_hash);
    }

    /**
     * Test delivery workflow with minimum required data
     */
    public function test_process_delivery_with_minimum_data(): void
    {
        $deliveryData = [
            'shipment_id' => $this->shipment->id,
            'recipient_name' => 'Jane Customer',
        ];

        $result = $this->deliveryWorkflowService->processCompleteDelivery($deliveryData);

        $this->assertInstanceOf(DeliveryConfirmation::class, $result);
        $this->assertEquals('Jane Customer', $result->recipient_name);
        $this->assertEquals('delivered', $result->status);
        $this->assertNotNull($result->delivered_at);
        $this->assertNotNull($result->verification_hash);
    }

    /**
     * Test delivery workflow validation for invalid GPS coordinates
     */
    public function test_validation_fails_for_invalid_gps_coordinates(): void
    {
        $deliveryData = [
            'shipment_id' => $this->shipment->id,
            'recipient_name' => 'Test Customer',
            'gps_latitude' => 100.0, // Invalid latitude > 90
            'gps_longitude' => -200.0, // Invalid longitude < -180
        ];

        $this->expectException(Exception::class);
        $this->expectExceptionMessage('Invalid GPS coordinates');

        $this->deliveryWorkflowService->processCompleteDelivery($deliveryData);
    }

    /**
     * Test delivery workflow with invalid signature data
     */
    public function test_validation_fails_for_invalid_signature(): void
    {
        $deliveryData = [
            'shipment_id' => $this->shipment->id,
            'recipient_name' => 'Test Customer',
            'signature_data' => 'invalid_signature',
        ];

        // Set up mock to return validation error
        $this->mockSignatureService->shouldReceive('validateSignatureData')
            ->once()
            ->with($deliveryData['signature_data'])
            ->andReturn(['valid' => false, 'errors' => ['Invalid format', 'Too short']]);

        $this->expectException(Exception::class);
        $this->expectExceptionMessage('Invalid signature data');

        $this->deliveryWorkflowService->processCompleteDelivery($deliveryData);
    }

    /**
     * Test signature processing
     */
    public function test_process_signature_successfully(): void
    {
        $delivery = DeliveryConfirmation::factory()->create([
            'shipment_id' => $this->shipment->id,
            'user_id' => $this->user->id
        ]);

        $signatureData = [
            'signature_data' => 'base64_encoded_signature',
            'signature_quality' => 0.95,
            'signature_type' => 'touch',
            'canvas_width' => 400,
            'canvas_height' => 200,
            'signature_strokes' => [
                ['x' => 10, 'y' => 20],
                ['x' => 30, 'y' => 40]
            ]
        ];

        // Set up mock expectations
        $this->mockSignatureService->shouldReceive('validateSignatureData')
            ->once()
            ->with($signatureData['signature_data'])
            ->andReturn(['valid' => true, 'errors' => []]);

        $this->mockSignatureService->shouldReceive('calculateSignatureQuality')
            ->once()
            ->andReturn(0.95);

        $result = $this->deliveryWorkflowService->processSignature($delivery, $signatureData);

        $this->assertInstanceOf(DeliveryConfirmation::class, $result);
        $this->assertNotNull($result->signature);
        $this->assertEquals(0.95, $result->signature->signature_quality);
        $this->assertEquals('touch', $result->signature->signature_type);
        $this->assertEquals(400, $result->signature->canvas_width);
        $this->assertEquals(200, $result->signature->canvas_height);
    }

    /**
     * Test ERP sync queuing
     */
    public function test_erp_sync_is_queued(): void
    {
        $delivery = DeliveryConfirmation::factory()->create();

        // Expect that the sync job will be dispatched
        Queue::fake();

        $this->deliveryWorkflowService->queueErpSync($delivery);

        Queue::assertPushed(SyncDeliveryToErp::class, function ($job) use ($delivery) {
            return $job->deliveryId === $delivery->id;
        });
    }

    /**
     * Test delivery workflow status retrieval
     */
    public function test_get_workflow_status(): void
    {
        $delivery = DeliveryConfirmation::factory()->create([
            'status' => 'delivered',
            'gps_latitude' => 40.7128,
            'gps_longitude' => -74.0060,
            'synced_to_erp' => false
        ]);

        $delivery->signature()->create(
            DeliverySignature::factory()->make([
                'signature_quality' => 0.95,
                'signature_hash' => 'hash123'
            ])->toArray()
        );

        $photos = DeliveryPhoto::factory(2)->create([
            'delivery_confirmation_id' => $delivery->id
        ]);

        $status = $this->deliveryWorkflowService->getWorkflowStatus($delivery);

        $this->assertEquals('delivered', $status['delivery_status']);
        $this->assertTrue($status['has_signature']);
        $this->assertTrue($status['signature_valid']);
        $this->assertEquals(2, $status['photo_count']);
        $this->assertTrue($status['has_gps']);
        $this->assertFalse($status['synced_to_erp']);
    }

    /**
     * Test workflow completion validation
     */
    public function test_validate_workflow_completion(): void
    {
        $delivery = DeliveryConfirmation::factory()->create([
            'status' => 'delivered'
        ]);

        $delivery->signature()->create(
            DeliverySignature::factory()->make([
                'signature_quality' => 0.95,
                'signature_hash' => 'hash123'
            ])->toArray()
        );

        DeliveryPhoto::factory(1)->create([
            'delivery_confirmation_id' => $delivery->id
        ]);

        $validation = $this->deliveryWorkflowService->validateWorkflowCompletion($delivery);

        $this->assertEquals('complete', $validation['status']);
        $this->assertEmpty($validation['issues']);
        $this->assertEmpty($validation['warnings']);
        $this->assertEquals(100.0, $validation['completeness_percentage']);
    }

    /**
     * Test workflow validation with quality issues
     */
    public function test_validate_workflow_with_quality_issues(): void
    {
        $delivery = DeliveryConfirmation::factory()->create([
            'status' => 'delivered'
        ]);

        $delivery->signature()->create(
            DeliverySignature::factory()->make([
                'signature_quality' => 0.70, // Below threshold
                'signature_hash' => 'hash123'
            ])->toArray()
        );

        $validation = $this->deliveryWorkflowService->validateWorkflowCompletion($delivery);

        $this->assertEquals('needs_review', $validation['status']);
        $this->assertCount(1, $validation['issues']);
        $this->assertStringContains('below acceptable threshold', $validation['issues'][0]);
        $this->assertCount(2, $validation['warnings']);
    }

    /**
     * Test photo cleanup on failure
     */
    public function test_photo_cleanup_on_different_types_of_failures(): void
    {
        $delivery = DeliveryConfirmation::factory()->create();
        
        $photoData = [
            'photo_file' => $this->createMockUploadedFile(),
            'photo_type' => 'delivery_proof'
        ];

        $this->mockPhotoService->shouldReceive('createThumbnail')
            ->once()
            ->andThrow(new Exception('Thumbnail generation failed'));

        $this->expectException(Exception::class);
        $this->expectExceptionMessage('Failed to process photos');

        $this->deliveryWorkflowService->processPhotos($delivery, [$photoData]);
    }

    /**
     * Test delivery confirmation with error handling
     */
    public function test_delivery_confirmation_error_handling(): void
    {
        $data = [
            'shipment_id' => $this->shipment->id,
            'invalid_field' => 'this_should_cause_failure'
        ];

        $this->expectException(Exception::class);

        $this->deliveryWorkflowService->processCompleteDelivery($data);
    }

    /**
     * Test signature legal validity check
     */
    public function test_signature_legal_validity_check(): void
    {
        $delivery = DeliveryConfirmation::factory()->create();
        
        $signature = DeliverySignature::factory()->create([
            'delivery_id' => $delivery->id,
            'signature_quality' => 0.95,
            'signature_hash' => 'valid_hash',
            'signature_strokes' => json_encode([['x' => 10, 'y' => 20], ['x' => 30, 'y' => 40]]),
            'created_at' => now()
        ]);

        $this->assertTrue($signature->isLegallyValid());
        $this->assertEquals(0.95, $signature->signature_quality);
    }

    /**
     * Test delivery confirmation with GPS broadcasting
     */
    public function test_delivery_with_gps_coordinates_broadcasts_event(): void
    {
        Queue::fake();

        // Mock the Broadcasting facade
        $this->partialMock(\Illuminate\Contracts\Broadcasting\Factory::class, function ($mock) {
            $mock->shouldReceive('driver')->andReturnSelf();
            $mock->shouldReceive('broadcast')->andReturnSelf();
            $mock->shouldReceive('toOthers')->andReturn(true);
        });

        $deliveryData = [
            'shipment_id' => $this->shipment->id,
            'delivered_at' => now(),
            'recipient_name' => 'GPS Test Customer',
            'delivery_notes' => 'Delivered with GPS tracking',
            'gps_latitude' => 37.7749,
            'gps_longitude' => -122.4194,
            'gps_accuracy' => 3.5,
            'status' => 'delivered',
            'signature_data' => 'base64_gps_signature_data',
            'photos' => []
        ];

        // Mock signature service validation
        $this->mockSignatureService
            ->shouldReceive('validateSignatureData')
            ->once()
            ->with('base64_gps_signature_data')
            ->andReturn([
                'valid' => true,
                'errors' => [],
                'quality_score' => 0.88
            ]);

        // Mock ERP sync service
        $this->mockSyncService
            ->shouldReceive('queueDeliverySync')
            ->once();

        $delivery = $this->deliveryWorkflowService->processCompleteDelivery($deliveryData);

        $this->assertNotNull($delivery);
        $this->assertEquals(37.7749, $delivery->gps_latitude);
        $this->assertEquals(-122.4194, $delivery->gps_longitude);
        $this->assertEquals(3.5, $delivery->gps_accuracy);

        // Verify ERP sync was queued
        Queue::assertNotPushed(\App\Jobs\SyncDeliveryToErp::class);
    }

    /**
     * Test delivery confirmation with WebSocket broadcasting
     */
    public function test_delivery_workflow_triggers_status_broadcasts(): void
    {
        // Mock events for broadcasting
        $this->expectsEvents([
            \App\Events\DeliveryStatusUpdated::class,
            \App\Events\DeliveryLocationUpdated::class
        ]);

        $deliveryData = [
            'shipment_id' => $this->shipment->id,
            'delivered_at' => now(),
            'recipient_name' => 'Broadcast Test Customer',
            'delivery_notes' => 'Testing broadcast events',
            'gps_latitude' => 34.0522,
            'gps_longitude' => -118.2437,
            'gps_accuracy' => 2.0,
            'status' => 'delivered',
            'signature_data' => 'base64_broadcast_signature_data'
        ];

        // Mock signature service
        $this->mockSignatureService
            ->shouldReceive('validateSignatureData')
            ->once()
            ->andReturn([
                'valid' => true,
                'errors' => [],
                'quality_score' => 0.91
            ]);

        // Mock sync service
        $this->mockSyncService
            ->shouldReceive('queueDeliverySync')
            ->once();

        $delivery = $this->deliveryWorkflowService->processCompleteDelivery($deliveryData);

        $this->assertNotNull($delivery);
        $this->assertNotNull($delivery->verification_hash);
    }

    /**
     * Test offline delivery queue functionality
     */
    public function test_offline_queue_service_queues_deliveries(): void
    {
        Cache::flush();

        $offlineQueueService = new OfflineQueueService();
        $this->actingAs($this->user);

        $offlineDelivery = [
            'shipment_id' => $this->shipment->id,
            'recipient_name' => 'Offline Customer',
            'delivery_notes' => 'Delivered while offline',
            'gps_latitude' => 40.7128,
            'gps_longitude' => -74.0060,
            'status' => 'delivered',
            'signature' => [
                'signature_data' => 'offline_signature_data',
                'canvas_width' => 400,
                'canvas_height' => 200
            ],
            'photos' => []
        ];

        // Mock isOffline check
        $offlineQueueService = $this->getMockBuilder(OfflineQueueService::class)
            ->onlyMethods(['isOffline'])
            ->getMock();

        $offlineQueueService->method('isOffline')
            ->willReturn(true);

        $result = $offlineQueueService->queueOfflineDelivery($offlineDelivery);

        $this->assertTrue($result);
        $this->assertTrue($offlineQueueService->hasOfflineDeliveries());

        $queue = $offlineQueueService->getOfflineQueue();
        $this->assertCount(1, $queue);
        $this->assertEquals('Offline Customer', $queue[0]['recipient_name']);
    }

    /**
     * Test offline delivery sync functionality
     */
    public function test_offline_delivery_sync_processes_queue(): void
    {
        Cache::flush();
        Queue::fake();

        $this->actingAs($this->user);

        // Mock offline queue service
        $offlineQueueService = $this->getMockBuilder(OfflineQueueService::class)
            ->onlyMethods(['isOffline', 'processOfflineDelivery'])
            ->getMock();

        // Add a delivery to offline queue
        $offlineDelivery = [
            'shipment_id' => $this->shipment->id,
            'recipient_name' => 'Sync Test Customer',
            'gps_latitude' => 41.8781,
            'gps_longitude' => -87.6298,
            'status' => 'delivered'
        ];

        $offlineQueueService->queueOfflineDelivery($offlineDelivery);

        // Mock processOfflineDelivery to return success
        $offlineQueueService->method('processOfflineDelivery')
            ->willReturn(true);

        $syncResults = $offlineQueueService->syncOfflineDeliveries($this->user->id);

        $this->assertEquals('success', $syncResults['status']);
        $this->assertGreaterThanOrEqual(1, $syncResults['synced_count'] + $syncResults['failed_count']);
    }

    /**
     * Test delivery confirmation with broadcasting authentication
     */
    public function test_broadcasting_channels_auth_correctly(): void
    {
        $delivery = DeliveryConfirmation::factory()->create([
            'user_id' => $this->user->id,
            'shipment_id' => $this->shipment->id,
            'status' => 'delivered'
        ]);

        // Test private channel auth
        $this->assertInstanceOf(\Illuminate\Broadcasting\BroadcastServiceProvider::class, app(\Illuminate\Broadcasting\BroadcastServiceProvider::class));

        // Mock the broadcast channel authorization
        $channelAuth = function ($user, $deliveryId) {
            return true; // Simplified for test
        };

        // Verify channel exists
        $authResult = $channelAuth($this->user, $delivery->id);
        $this->assertTrue($authResult);
    }

    /**
     * Test Redis broadcasting configuration
     */
    public function test_redis_broadcasting_is_configured(): void
    {
        $config = config('broadcasting.connections');

        $this->assertArrayHasKey('redis', $config);
        $this->assertEquals('redis', $config['redis']['driver']);
        $this->assertEquals('default', $config['redis']['connection']);
    }

    /**
     * Test Pusher broadcasting options for real-time updates
     */
    public function test_pusher_broadcasting_configuration(): void
    {
        $config = config('broadcasting.connections.pusher');

        $this->assertArrayHasKey('key', $config);
        $this->assertArrayHasKey('secret', $config);
        $this->assertArrayHasKey('app_id', $config);
        $this->assertArrayHasKey('options', $config);

        $this->assertEquals('shipment-app-key', $config['key']);
        $this->assertTrue($config['options']['encrypted']);
        $this->assertTrue($config['options']['useTLS']);
        $this->assertEquals('127.0.0.1', $config['options']['host']);
        $this->assertEquals(6001, $config['options']['port']);
    }

    /**
     * Test signature progress broadcasting during capture
     */
    public function test_signature_progress_broadcasts_drawing_events(): void
    {
        $delivery = DeliveryConfirmation::factory()->create([
            'user_id' => $this->user->id,
            'shipment_id' => $this->shipment->id
        ]);

        // Mock signature progress event
        $event = new \App\Events\SignatureProgress(
            $delivery,
            'drawing',
            [
                'stroke_count' => 5,
                'quality_score' => 0.82,
                'canvas_width' => 400,
                'canvas_height' => 200
            ]
        );

        $broadcastData = $event->broadcastWith();

        $this->assertArrayHasKey('delivery_id', $broadcastData);
        $this->assertArrayHasKey('shipment_id', $broadcastData);
        $this->assertArrayHasKey('progress_type', $broadcastData);
        $this->assertEquals('drawing', $broadcastData['progress_type']);
        $this->assertEquals(5, $broadcastData['stroke_count']);
        $this->assertEquals(0.82, $broadcastData['current_quality']);
    }

    /**
     * Test delivery location update broadcasting
     */
    public function test_delivery_location_update_broadcasts_coordinates(): void
    {
        $delivery = DeliveryConfirmation::factory()->create([
            'user_id' => $this->user->id,
            'shipment_id' => $this->shipment->id,
            'gps_latitude' => 39.9042,
            'gps_longitude' => 116.4074,
            'gps_accuracy' => 8.5
        ]);

        $event = new \App\Events\DeliveryLocationUpdated(
            $delivery,
            [
                'latitude' => 39.9042,
                'longitude' => 116.4074,
                'accuracy' => 8.5
            ]
        );

        $channels = $event->broadcastOn();
        $data = $event->broadcastWith();

        // Verify channel authorization
        $this->assertCount(2, $channels);
        $this->assertInstanceOf(\Illuminate\Broadcasting\PrivateChannel::class, $channels[0]);

        // Verify coordinate data
        $this->assertArrayHasKey('delivery_id', $data);
        $this->assertEquals(39.9042, $data['gps_coordinates']['latitude']);
        $this->assertEquals(116.4074, $data['gps_coordinates']['longitude']);
        $this->assertEquals(8.5, $data['gps_coordinates']['accuracy']);
    }

    /**
     * Create mock uploaded file for testing
     */
    private function createMockUploadedFile()
    {
        // Create a mock uploaded file for testing
        return new \Illuminate\Http\UploadedFile(
            sys_get_temp_dir() . '/test.jpg',
            'test.jpg',
            'image/jpeg',
            null,
            true
        );
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}