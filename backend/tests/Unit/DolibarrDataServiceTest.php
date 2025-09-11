<?php

namespace Tests\Unit;

use Tests\TestCase;
use App\Services\DolibarrDataService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Mockery;

class DolibarrDataServiceTest extends TestCase
{
    private DolibarrDataService $service;
    
    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(DolibarrDataService::class);
        Cache::flush();
    }
    
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    /** @test */
    public function it_can_fetch_shipments_with_pagination()
    {
        // Mock the database connection for Dolibarr
        $mockConnection = Mockery::mock('connection');
        $mockQuery = Mockery::mock('query');
        
        // Set up the mock chain for building the query
        $mockQuery->shouldReceive('select')
            ->with([
                's.rowid as id',
                's.ref as reference',
                's.ref_customer',
                's.fk_soc as customer_id',
                'soc.nom as customer_name',
                's.fk_statut as status',
                's.fk_shipping_method',
                's.tracking_number',
                's.weight',
                's.weight_units',
                's.date_delivery as expected_delivery',
                's.date_valid',
                's.date_creation',
                's.tms as last_synced',
                's.date_creation as created_from_dolibarr'
            ])
            ->once()->andReturnSelf();
            
        $mockQuery->shouldReceive('join')
            ->withArgs(function($table, $first, $operator, $second) {
                return $table === 'llx_societe' || str_starts_with($first, 's.fk_soc');
            })
            ->times(2)->andReturnSelf();
            
        $mockQuery->shouldReceive('where')
            ->with('s.fk_statut', '!=', -1)
            ->once()->andReturnSelf();
            
        $mockQuery->shouldReceive('orderBy')
            ->with('s.date_creation', 'desc')
            ->once()->andReturnSelf();
            
        $mockQuery->shouldReceive('offset')->with(0)->once()->andReturnSelf();
        $mockQuery->shouldReceive('limit')->with(10)->once()->andReturnSelf();
        
        $mockResults = collect([
            (object)[
                'id' => 1,
                'reference' => 'SH-2025-001',
                'ref_customer' => 'CUST-001',
                'customer_id' => 100,
                'customer_name' => 'Test Customer',
                'status' => 1,
                'expected_delivery' => '2025-09-15',
                'date_creation' => '2025-09-01 10:00:00',
                'weight' => 25.5,
                'weight_units' => 0,
                'tracking_number' => null
            ]
        ]);
        
        $mockQuery->shouldReceive('get')->once()->andReturn($mockResults);
        
        $mockConnection->shouldReceive('table')
            ->with('llx_expedition as s')
            ->once()->andReturn($mockQuery);
            
        // Mock the database manager
        DB::shouldReceive('connection')
            ->with('dolibarr')
            ->twice()
            ->andReturn($mockConnection);
            
        // Mock count query
        $mockCountQuery = Mockery::mock('countQuery');
        $mockCountQuery->shouldReceive('select')->withRaw('COUNT(*) as total')->once()->andReturnSelf();
        $mockCountQuery->shouldReceive('join')->twice()->andReturnSelf();
        $mockCountQuery->shouldReceive('where')->once()->andReturnSelf();
        $mockCountQuery->shouldReceive('get')->once()->andReturn(collect([(object)['total' => 1]]));
        
        $mockConnection->shouldReceive('table')
            ->with('llx_expedition as s')
            ->once()->andReturn($mockCountQuery);

        $result = $this->service->getShipments(1, 10);

        $this->assertTrue($result['success']);
        $this->assertCount(1, $result['data']['shipments']);
        $this->assertEquals('SH-2025-001', $result['data']['shipments'][0]['reference']);
        $this->assertEquals('Test Customer', $result['data']['shipments'][0]['customer_name']);
        $this->assertEquals(1, $result['data']['pagination']['totalItems']);
    }

    /** @test */
    public function it_caches_shipment_data()
    {
        // Mock the same database setup as above
        $mockConnection = Mockery::mock('connection');
        $mockQuery = Mockery::mock('query');
        
        // ... (same setup as previous test)
        
        $mockResults = collect([
            (object)[
                'id' => 1,
                'reference' => 'SH-2025-001',
                'ref_customer' => 'CUST-001',
                'customer_id' => 100,
                'customer_name' => 'Test Customer',
                'status' => 1,
                'expected_delivery' => '2025-09-15',
                'date_creation' => '2025-09-01 10:00:00',
                'weight' => 25.5,
                'weight_units' => 0,
                'tracking_number' => null
            ]
        ]);
        
        $mockQuery->shouldReceive('select')->once()->andReturnSelf();
        $mockQuery->shouldReceive('join')->twice()->andReturnSelf();
        $mockQuery->shouldReceive('where')->once()->andReturnSelf();
        $mockQuery->shouldReceive('orderBy')->once()->andReturnSelf();
        $mockQuery->shouldReceive('offset')->once()->andReturnSelf();
        $mockQuery->shouldReceive('limit')->once()->andReturnSelf();
        $mockQuery->shouldReceive('get')->once()->andReturn($mockResults);
        
        $mockConnection->shouldReceive('table')->twice()->andReturn($mockQuery);

        // Mock count query
        $mockCountQuery = Mockery::mock('countQuery');
        $mockCountQuery->shouldReceive('select')->withRaw('COUNT(*) as total')->once()->andReturnSelf();
        $mockCountQuery->shouldReceive('join')->twice()->andReturnSelf();
        $mockCountQuery->shouldReceive('where')->once()->andReturnSelf();
        $mockCountQuery->shouldReceive('get')->once()->andReturn(collect([(object)['total' => 1]]));
        
        $mockConnection->shouldReceive('table')
            ->with('llx_expedition as s')
            ->once()
            ->andReturn($mockCountQuery);
            
        DB::shouldReceive('connection')->with('dolibarr')->times(4)->andReturn($mockConnection);

        // First call - should hit database
        $result1 = $this->service->getShipments(1, 10);
        
        // Second call - should use cache
        $result2 = $this->service->getShipments(1, 10);

        $this->assertTrue($result1['success']);
        $this->assertTrue($result2['success']);
        $this->assertEquals($result1['data']['shipments'][0]['reference'], $result2['data']['shipments'][0]['reference']);
    }

    /** @test */
    public function it_maps_dolibarr_status_codes_correctly()
    {
        $this->assertEquals('pending', $this->service->mapShipmentStatus(0));
        $this->assertEquals('in_transit', $this->service->mapShipmentStatus(1));
        $this->assertEquals('delivered', $this->service->mapShipmentStatus(2));
        $this->assertEquals('cancelled', $this->service->mapShipmentStatus(-1));
        $this->assertEquals('pending', $this->service->mapShipmentStatus(99));
    }

    /** @test */
    public function it_converts_weight_units_correctly()
    {
        $this->assertEquals(25.5, $this->service->convertWeight(25.5, 0)); // kg
        $this->assertEquals(0.5, $this->service->convertWeight(500, -3)); // g to kg
    }

    /** @test */
    public function it_handles_database_connection_errors_gracefully()
    {
        DB::shouldReceive('connection')
            ->with('dolibarr')
            ->andThrow(new \PDOException('Connection failed'));

        $result = $this->service->getShipments(1, 10);

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('Failed to fetch shipment data', $result['error']);
    }
}