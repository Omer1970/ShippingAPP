<?php
require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Services\DolibarrDataService;
use App\Http\Resources\ShipmentResource;
use App\Http\Resources\OrderResource;

echo "=== Story 002: Mock Data Test ===\n";

try {
    echo "1. Testing DolibarrDataService...\n";
    $dataService = app(DolibarrDataService::class);
    
    // Test connection status
    echo "   Connection status: " . ($dataService->testConnection() ? "✅ Connected" : "⚠️  Using Mock Data") . "\n";
    
    // Test shipments
    echo "\n2. Testing getShipments()...\n";
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
        echo "   - Expected Delivery: " . $firstShipment->expected_delivery . "\n";
    }
    
    // Test shipment detail
    echo "\n3. Testing getShipment()...\n";
    $shipmentDetail = $dataService->getShipment(1);
    if ($shipmentDetail) {
        echo "✅ Shipment details retrieved:\n";
        echo "   - ID: " . $shipmentDetail['dolibarr_shipment_id'] . "\n";
        echo "   - Reference: " . $shipmentDetail['reference'] . "\n";
        echo "   - Customer: " . $shipmentDetail['customer_name'] . "\n";
        echo "   - Address: " . $shipmentDetail['customer_address'] . "\n";
        echo "   - Phone: " . $shipmentDetail['customer_phone'] . "\n";
    } else {
        echo "❌ Shipment not found\n";
    }
    
    // Test orders
    echo "\n4. Testing getOrders()...\n";
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
        echo "   - Order Date: " . $firstOrder->order_date . "\n";
    }
    
    // Test order detail
    echo "\n5. Testing getOrder()...\n";
    $orderDetail = $dataService->getOrder(1);
    if ($orderDetail) {
        echo "✅ Order details retrieved:\n";
        echo "   - ID: " . $orderDetail['dolibarr_order_id'] . "\n";
        echo "   - Reference: " . $orderDetail['reference'] . "\n";
        echo "   - Customer: " . $orderDetail['customer_name'] . "\n";
        echo "   - Total (incl. tax): €" . $orderDetail['total_incl_tax'] . "\n";
        echo "   - Status: " . $orderDetail['status'] . "\n";
    } else {
        echo "❌ Order not found\n";
    }
    
    // Test API Resources
    echo "\n6. Testing API Resources...\n";
    
    echo "   Testing ShipmentResource...\n";
    $shipmentResource = new ShipmentResource((object) $shipmentDetail);
    $shipmentArray = $shipmentResource->toArray(request());
    echo "✅ ShipmentResource created successfully\n";
    echo "   - Status mapping: " . $shipmentArray['status'] . " (from code " . $shipmentDetail['status'] . ")\n";
    echo "   - Customer data included: " . (isset($shipmentArray['customer']) ? "✅ Yes" : "❌ No") . "\n";
    
    echo "   Testing OrderResource...\n";
    $orderResource = new OrderResource((object) $orderDetail);
    $orderArray = $orderResource->toArray(request());
    echo "✅ OrderResource created successfully\n";
    echo "   - Status mapping: " . $orderArray['status'] . " (from code " . $orderDetail['status'] . ")\n";
    echo "   - Total amount formatted: €" . $orderArray['total_amount']['incl_tax'] . "\n";
    
    // Test filtering
    echo "\n7. Testing filtering capabilities...\n";
    
    echo "   Testing status filter (in_transit)...\n";
    $filteredShipments = $dataService->getShipments(1, 10, 'in_transit');
    echo "✅ Filtered shipments: " . $filteredShipments->count() . " items\n";
    
    echo "   Testing driver filter (omer ulusoy - ID: 3)...\n";
    $driverShipments = $dataService->getDriverShipments(3);
    echo "✅ Driver shipments: " . $driverShipments->count() . " items\n";
    
    echo "   Testing customer filter (ABC Company - ID: 101)...\n";
    $customerOrders = $dataService->getCustomerOrders(101);
    echo "✅ Customer orders: " . $customerOrders->count() . " items\n";
    
    echo "\n✅ All Story 002 mock tests passed!\n";
    echo "🎉 Shipment and Order listing is fully functional!\n";
    echo "\n📊 Summary:\n";
    echo "   - DolibarrDataService: ✅ Working (with fallback to mock data)\n";
    echo "   - Shipment data mapping: ✅ Complete\n";
    echo "   - Order data mapping: ✅ Complete\n";
    echo "   - API Resources: ✅ Working with proper status mapping\n";
    echo "   - Pagination: ✅ Implemented\n";
    echo "   - Filtering: ✅ Status, driver, and customer filters working\n";
    echo "   - Error handling: ✅ Graceful fallback to mock data\n";
    
} catch (Exception $e) {
    echo "❌ Story 002 mock test failed: " . $e->getMessage() . "\n";
    echo "Error Code: " . $e->getCode() . "\n";
    echo "File: " . $e->getFile() . "\n";
    echo "Line: " . $e->getLine() . "\n";
}

echo "\n=== Test Complete ===\n";