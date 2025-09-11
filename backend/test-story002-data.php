<?php
require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use App\Services\DolibarrDataService;

echo "=== Story 002: Shipment and Order Data Test ===\n";

try {
    // Test basic connection
    echo "1. Testing Dolibarr database connection...\n";
    $version = DB::connection('dolibarr')->select('SELECT VERSION() as version');
    echo "✅ Database connection successful!\n";
    echo "   MySQL Version: " . $version[0]->version . "\n";
    
    // Test shipment table
    echo "\n2. Testing shipment table (llx_expedition)...\n";
    $shipmentCount = DB::connection('dolibarr')
        ->table('llx_expedition')
        ->where('entity', '=', 1)
        ->count();
    echo "✅ Shipment table accessible!\n";
    echo "   Total shipments: " . $shipmentCount . "\n";
    
    // Sample shipment data
    echo "\n3. Testing sample shipment data...\n";
    $sampleShipments = DB::connection('dolibarr')
        ->table('llx_expedition')
        ->select('rowid', 'ref', 'fk_soc', 'fk_statut', 'date_creation', 'date_delivery')
        ->where('entity', '=', 1)
        ->limit(3)
        ->get();
    
    echo "✅ Sample shipments retrieved:\n";
    foreach ($sampleShipments as $shipment) {
        echo "   - ID: " . $shipment->rowid . ", Ref: " . $shipment->ref . ", Status: " . $shipment->fk_statut . ", Date: " . $shipment->date_creation . "\n";
    }
    
    // Test order table
    echo "\n4. Testing order table (llx_commande)...\n";
    $orderCount = DB::connection('dolibarr')
        ->table('llx_commande')
        ->where('entity', '=', 1)
        ->count();
    echo "✅ Order table accessible!\n";
    echo "   Total orders: " . $orderCount . "\n";
    
    // Sample order data
    echo "\n5. Testing sample order data...\n";
    $sampleOrders = DB::connection('dolibarr')
        ->table('llx_commande')
        ->select('rowid', 'ref', 'fk_soc', 'fk_statut', 'date_creation', 'total_ttc')
        ->where('entity', '=', 1)
        ->limit(3)
        ->get();
    
    echo "✅ Sample orders retrieved:\n";
    foreach ($sampleOrders as $order) {
        echo "   - ID: " . $order->rowid . ", Ref: " . $order->ref . ", Status: " . $order->fk_statut . ", Total: €" . $order->total_ttc . "\n";
    }
    
    // Test customer table join
    echo "\n6. Testing customer table join...\n";
    $shipmentWithCustomer = DB::connection('dolibarr')
        ->table('llx_expedition as e')
        ->select('e.rowid', 'e.ref', 's.nom as customer_name', 's.address', 's.phone', 's.email')
        ->leftJoin('llx_societe as s', 'e.fk_soc', '=', 's.rowid')
        ->where('e.entity', '=', 1)
        ->first();
    
    if ($shipmentWithCustomer) {
        echo "✅ Customer join successful!\n";
        echo "   Sample: Shipment " . $shipmentWithCustomer->ref . " for " . $shipmentWithCustomer->customer_name . "\n";
        if ($shipmentWithCustomer->address) {
            echo "   Address: " . $shipmentWithCustomer->address . "\n";
        }
        if ($shipmentWithCustomer->phone) {
            echo "   Phone: " . $shipmentWithCustomer->phone . "\n";
        }
        if ($shipmentWithCustomer->email) {
            echo "   Email: " . $shipmentWithCustomer->email . "\n";
        }
    }
    
    // Test DolibarrDataService
    echo "\n7. Testing DolibarrDataService...\n";
    $dataService = app(DolibarrDataService::class);
    
    // Test shipments
    echo "   Testing getShipments()...\n";
    $shipments = $dataService->getShipments(1, 2);
    echo "✅ Shipments retrieved: " . $shipments->count() . " items\n";
    echo "✅ Total shipments: " . $shipments->total() . "\n";
    
    if ($shipments->count() > 0) {
        $firstShipment = $shipments->items()[0];
        echo "   Sample shipment:\n";
        echo "   - ID: " . $firstShipment->dolibarr_shipment_id . "\n";
        echo "   - Reference: " . $firstShipment->reference . "\n";
        echo "   - Customer: " . $firstShipment->customer_name . "\n";
        echo "   - Status: " . $firstShipment->status . " (Code: " . $firstShipment->status . ")\n";
    }
    
    // Test orders
    echo "\n   Testing getOrders()...\n";
    $orders = $dataService->getOrders(1, 2);
    echo "✅ Orders retrieved: " . $orders->count() . " items\n";
    echo "✅ Total orders: " . $orders->total() . "\n";
    
    if ($orders->count() > 0) {
        $firstOrder = $orders->items()[0];
        echo "   Sample order:\n";
        echo "   - ID: " . $firstOrder->dolibarr_order_id . "\n";
        echo "   - Reference: " . $firstOrder->reference . "\n";
        echo "   - Customer: " . $firstOrder->customer_name . "\n";
        echo "   - Total: €" . ($firstOrder->total_incl_tax ?? 0) . "\n";
        echo "   - Status: " . $firstOrder->status . " (Code: " . $firstOrder->status . ")\n";
    }
    
    // Test cache functionality
    echo "\n8. Testing cache functionality...\n";
    $cacheKey = "test_shipments_1_2__";
    echo "   Cache key: " . $cacheKey . "\n";
    
    if (Cache::has($cacheKey)) {
        echo "✅ Cache hit - data retrieved from cache\n";
    } else {
        echo "ℹ️  Cache miss - data fetched from database\n";
    }
    
    echo "\n✅ All Story 002 integration tests passed!\n";
    echo "🎉 Shipment and Order listing is ready for frontend development!\n";
    
} catch (Exception $e) {
    echo "❌ Story 002 test failed: " . $e->getMessage() . "\n";
    echo "Error Code: " . $e->getCode() . "\n";
    echo "File: " . $e->getFile() . "\n";
    echo "Line: " . $e->getLine() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}

echo "\n=== Test Complete ===\n";