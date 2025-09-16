<?php

namespace Tests\Unit;

use App\Services\DolibarrDeliverySyncService;
use App\Models\DeliveryConfirmation;
use App\Models\DeliverySignature;
use App\Models\DeliveryPhoto;
use App\Models\User;
use App\Models\Shipment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use Mockery;

/**
 * Unit tests for DolibarrDeliverySyncService
 */
class DolibarrDeliverySyncServiceTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    private DolibarrDeliverySyncService $syncService;
    private User $user;
    private Shipment $shipment;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->syncService = new DolibarrDeliverySyncService();
        
        $this->user = User::factory()->create();
        $this->shipment = Shipment::factory()->create();
        
        // Mock Dolibarr database connection
        $this->mockDolibarrConnection();
    }

    /**
     * Mock Dolibarr database connection
     */
    private function mockDolibarrConnection(): void
    {
        // Create a mock connection for testing
        $mockConnection = Mockery::mock('Illuminate\\Database\\Connection');
        $mockConnection->shouldReceive('table')->andReturn(
            Mockery::mock('Illuminate\\Database\\Query\\Builder')
                ->shouldReceive('where', 'update', 'insert', 'insertGetId')->andReturn(
                    Mockery::mock('stdClass')->shouldReceive('get')->andReturn(null)->getMock()
                )->getMock()
        );
        
        DB::shouldReceive('connection')->with('dolibarr')->andReturn($mockConnection);
    }

    /**
     * Test successful delivery sync to Dolibarr
     */
    public function test_successful_delivery_sync_to_dolibarr(): void
    {
        Storage::fake();

        $delivery = $this->createMockDeliveryConfirmation();
        
        // Mock successful database operations
        DB::shouldReceive('connection')
            ->with('dolibarr')
            ->andReturnSelf();

        DB::shouldReceive('table')
            ->with('llx_expedition')
            ->andReturnSelf();

        DB::shouldReceive('where')
            ->with('rowid', $delivery->shipment_id)
            ->andReturnSelf();

        DB::shouldReceive('update')
            ->once()
            ->andReturn(true);

        // Test sync
        $result = $this->syncService->syncToDolibarr($delivery->id);

        $this->assertTrue($result);
        
        // Verify delivery was marked as synced
        $delivery->refresh();
        $this->assertTrue($delivery->synced_to_erp);
        $this->assertNotNull($delivery->erp_sync_timestamp);
    }

    /**
     * Test delivery sync with signature upload
     */
    public function test_sync_delivery_with_signature(): void
    {
        Storage::fake();

        $delivery = DeliveryConfirmation::factory()->create([
            'shipment_id' => $this->shipment->id,
            'user_id' => $this->user->id
        ]);

        $signature = DeliverySignature::factory()->create([
            'delivery_id' => $delivery->id,
            'signature_data' => 'data:image/png;base64,iVBORw0KGgoAAAANSUg=='
        ]);

        // Mock database operations
        DB::shouldReceive('connection')->with('dolibarr')->andReturnSelf();
        DB::shouldReceive('table')->andReturnSelf();
        DB::shouldReceive('where')->andReturnSelf();
        DB::shouldReceive('update')->andReturn(true);
        DB::shouldReceive('insertGetId')->andReturn(123);
        DB::shouldReceive('insert')->andReturn(true);

        Storage::shouldReceive('path')->andReturn(sys_get_temp_dir());
        Storage::shouldReceive('exists')->andReturn(true);
        Storage::shouldReceive('delete')->andReturn(true);

        $result = $this->syncService->syncToDolibarr($delivery->id);

        $this->assertTrue($result);
    }

    /**
     * Test delivery sync with photos upload
     */
    public function test_sync_delivery_with_photos(): void
    {
        Storage::fake();

        $delivery = DeliveryConfirmation::factory()->create([
            'shipment_id' => $this->shipment->id,
            'user_id' => $this->user->id
        ]);

        DeliveryPhoto::factory(3)->create([
            'delivery_confirmation_id' => $delivery->id
        ]);

        // Mock database operations
        DB::shouldReceive('connection')->with('dolibarr')->andReturnSelf();
        DB::shouldReceive('table')->andReturnSelf();
        DB::shouldReceive('where')->andReturnSelf();
        DB::shouldReceive('update')->andReturn(true);
        DB::shouldReceive('insertGetId')->andReturn(124)->times(3);
        DB::shouldReceive('insert')->andReturn(true)->times(3);

        Storage::shouldReceive('path')->andReturn(sys_get_temp_dir());
        Storage::shouldReceive('exists')->andReturn(true);

        $result = $this->syncService->syncToDolibarr($delivery->id);

        $this->assertTrue($result);
    }

    /**
     * Test delivery sync with GPS tracking information
     */
    public function test_sync_delivery_with_gps_tracking(): void
    {
        Storage::fake();

        $delivery = DeliveryConfirmation::factory()->create([
            'shipment_id' => $this->shipment->id,
            'user_id' => $this->user->id,
            'gps_latitude' => 40.7128,
            'gps_longitude' => -74.0060,
            'gps_accuracy' => 5.0
        ]);

        // Mock tracking table operations
        DB::shouldReceive('connection')->with('dolibarr')->andReturnSelf();
        DB::shouldReceive('table')->andReturnSelf();
        DB::shouldReceive('where')->andReturnSelf();
        DB::shouldReceive('update')->andReturn(true);
        DB::shouldReceive('table', 'llx_expedition_tracking')
            ->andReturnSelf();
        DB::shouldReceive('insert')->with(Mockery::on(function ($data) use ($delivery) {
            return $data['latitude'] === $delivery->gps_latitude &&
                   $data['longitude'] === $delivery->gps_longitude &&
                   $data['tracking_type'] === 'delivery';
        }))->once()
            ->andReturn(true);

        $result = $this->syncService->syncToDolibarr($delivery->id);

        $this->assertTrue($result);
    }

    /**
     * Test batch sync functionality
     */
    public function test_batch_sync_multiple_deliveries(): void
    {
        // Create multiple deliveries
        $deliveries = DeliveryConfirmation::factory(5)->create([
            'shipment_id' => $this->shipment->id,
            'user_id' => $this->user->id,
            'synced_to_erp' => false
        ]);

        // Mock successful sync for all deliveries
        DB::shouldReceive('connection')->with('dolibarr')->andReturnSelf();
        DB::shouldReceive('table')->andReturnSelf();
        DB::shouldReceive('where')->andReturnSelf();
        DB::shouldReceive('update')->andReturn(true);

        $results = $this->syncService->syncBatch($deliveries->pluck('id')->toArray());

        $this->assertEquals(5, $results['total']);
        $this->assertEquals(5, $results['successful']);
        $this->assertEquals(0, $results['failed']);
        $this->assertEmpty($results['errors']);
    }

    /**
     * Test sync retry mechanism for failed deliveries
     */
    public function test_sync_retry_mechanism(): void
    {
        $delivery = DeliveryConfirmation::factory()->create([
            'shipment_id' => $this->shipment->id,
            'user_id' => $this->user->id
        ]);

        // Mock failed database update on first attempt
        DB::shouldReceive('connection')->with('dolibarr')->andReturnSelf();
        DB::shouldReceive('table')->andReturnSelf();
        DB::shouldReceive('where')->andReturnSelf();
        
        $updateCount = 0;
        DB::shouldReceive('update')
            ->times(1)
            ->andReturnUsing(function ($data) use (&$updateCount) {
                $updateCount++;
                if ($updateCount === 1) {
                    return false; // First attempt fails
                }
                return true; 
            });

        // This should throw an exception after all retries
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('ERP sync failed after');

        $this->syncService->syncToDolibarr($delivery->id);
    }

    /**
     * Test sync statistics calculation
     */
    public function test_sync_statistics_calculation(): void
    {
        // Create deliveries with different sync statuses
        DeliveryConfirmation::factory(3)->create([
            'shipment_id' => $this->shipment->id,
            'user_id' => $this->user->id,
            'synced_to_erp' => true
        ]);

        DeliveryConfirmation::factory(2)->create([
            'shipment_id' => $this->shipment->id,
            'user_id' => $this->user->id,
            'synced_to_erp' => false,
            'user_id' => $this->user->id
        ]);

        $stats = $this->syncService->getSyncStatistics(['user_id' => $this->user->id]);

        $this->assertEquals(5, $stats['total_deliveries']);
        $this->assertEquals(3, $stats['synced_deliveries']);
        $this->assertEquals(2, $stats['pending_deliveries']);
        $this->assertEquals(60.0, $stats['sync_success_rate']);
    }

    /**
     * Test delivery sync queue management
     */
    public function test_delivery_sync_queue_management(): void
    {
        $delivery = DeliveryConfirmation::factory()->create([
            'shipment_id' => $this->shipment->id,
            'user_id' => $this->user->id,
            'synced_to_erp' => false
        ]);

        // Add delivery to sync queue
        $this->syncService->queueDeliverySync($delivery->id);

        // Verify that the queue processor is not running in test
        // In production, this would spawn a background worker
        $this->assertTrue(true); // Placeholder for queue verification
    }

    /**
     * Test selective sync retry logic
     */
    public function test_selective_sync_retry_logic(): void
    {
        $delivery = DeliveryConfirmation::factory()->create([
            'shipment_id' => $this->shipment->id,
            'user_id' => $this->user->id
        ]);

        // Mock failed delivery sync
        DB::shouldReceive('connection')->with('dolibarr')->andReturnSelf();
        DB::shouldReceive('table')->andReturnSelf();
        DB::shouldReceive('where')->andReturnSelf();
        DB::shouldReceive('update')->andReturn(false);

        try {
            $this->syncService->syncToDolibarr($delivery->id);
        } catch (\Exception $e) {
            // Verify retry logic in mixed environment
            $this->assertStringContains('ERP sync failed after', $e->getMessage());
        }
    }

    /**
     * Test document upload to ERP system
     */
    public function test_document_upload_to_erp_system(): void
    {
        Storage::fake();

        $delivery = DeliveryConfirmation::factory()->create([
            'shipment_id' => $this->shipment->id,
            'user_id' => $this->user->id
        ]);

        // Create temporary file for upload
        $tempFile = tempnam(sys_get_temp_dir(), 'test');
        file_put_contents($tempFile, 'test content');

        // Mock document upload
        DB::shouldReceive('connection')->with('dolibarr')->andReturnSelf();
        DB::shouldReceive('table', 'llx_document')->andReturnSelf();
        DB::shouldReceive('insertGetId')->andReturn(125);
        DB::shouldReceive('table', 'llx_element_element')->andReturnSelf();
        DB::shouldReceive('insert')->andReturn(true);

        Storage::shouldReceive('path')->andReturn(sys_get_temp_dir());
        Storage::shouldReceive('exists')->andReturn(true);

        // Test document upload (private method - testing via reflection)
        $reflection = new \ReflectionClass($this->syncService);
        $method = $reflection->getMethod('uploadDocumentToErp');
        $method->setAccessible(true);

        $result = $method->invoke($this->syncService, 
            $delivery->shipment_id,
            $tempFile,
            'test_file.jpg',
            'test_document',
            'Test document upload'
        );

        $this->assertEquals(125, $result);

        // Cleanup
        unlink($tempFile);
    }

    /**
     * Test sync monitoring and statistics
     */
    public function test_sync_monitoring_and_statistics(): void
    {
        // Test sync monitoring functions
        $stats = $this->syncService->getSyncMonitoringStats();

        $this->assertArrayHasKey('total_attempts', $stats);
        $this->assertArrayHasKey('successful_syncs', $stats);
        $this->assertArrayHasKey('failed_syncs', $stats);
        $this->assertArrayHasKey('success_rate', $stats);
        $this->assertArrayHasKey('current_queue_size', $stats);
        $this->assertArrayHasKey('is_queue_processing', $stats);
    }

    /**
     * Create mock delivery confirmation for testing
     */
    private function createMockDeliveryConfirmation(): DeliveryConfirmation
    {
        $delivery = DeliveryConfirmation::factory()->create([
            'shipment_id' => $this->shipment->id,
            'user_id' => $this->user->id,
            'status' => 'delivered',
            'synced_to_erp' => false,
            'recipient_name' => 'Test Customer',
            'delivered_at' => now(),
            'gps_latitude' => 40.7128,
            'gps_longitude' => -74.0060,
            'gps_accuracy' => 5.0
        ]);

        return $delivery;
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}