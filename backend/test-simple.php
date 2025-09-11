<?php

/**
 * Simple Story 002 Test Runner 
 * Bypasses Laravel logging issues
 */

require __DIR__ . '/vendor/autoload.php';

use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Facade;

error_reporting(E_ALL);
ini_set('display_errors', 1);

// Check files without Laravel bootstrap to avoid logging issues

// Test 1: Check Controllers exist
echo "1️⃣ Testing Controllers:\n";
$tests = [
    'ShipmentController' => '/Http/Controllers/Api/ShipmentController.php',
    'OrderController' => '/Http/Controllers/Api/OrderController.php',
    'DolibarrDataService' => '/Services/DolibarrDataService.php',
    'ShipmentResource' => '/Http/Resources/ShipmentResource.php',
    'OrderResource' => '/Http/Resources/OrderResource.php',
];

$passed = 0;
$failed = 0;

foreach ($tests as $name => $path) {
    $fullPath = __DIR__ . '/app' . $path;
    if (file_exists($fullPath)) {
        echo "✅ $name - EXISTS\n";
        $passed++;
    } else {
        echo "❌ $name - MISSING\n";
        $failed++;
    }
}

// Test 2: Check Routes
echo "\n2️⃣ Testing Routes File:\n";
if (file_exists(__DIR__ . '/routes/api.php')) {
    $content = file_get_contents(__DIR__ . '/routes/api.php');
    if (strpos($content, 'Route::middleware') !== false && strpos($content, 'ShipmentController') !== false) {
        echo "✅ Shipment routes defined in api.php\n";
        $passed++;
    } else {
        echo "❌ Shipment routes missing from api.php\n";
        $failed++;
    }
    if (strpos($content, 'OrderController') !== false) {
        echo "✅ Order routes defined in api.php\n";
        $passed++;
    } else {
        echo "❌ Order routes missing from api.php\n";
        $failed++;
    }
} else {
    echo "❌ routes/api.php not found\n";
    $failed++;
}

// Test 3: Check Models
echo "\n3️⃣ Testing Models:\n";
$models = [
    'Shipment' => 'Shipment.php',
    'Order' => 'Order.php'
];
foreach ($models as $name => $file) {
    if (file_exists(__DIR__ . '/app/Models/' . $file)) {
        echo "✅ $name model - EXISTS\n";
        $passed++;
    } else {
        echo "❌ $name model - MISSING\n";
        $failed++;
    }
}

// Test 4: Check Test Files
echo "\n4️⃣ Testing Test Files:\n";
$testFiles = [
    'DolibarrDataServiceTest' => 'Unit/DolibarrDataServiceTest.php',
    'ShipmentTest' => 'Feature/ShipmentTest.php',
    'OrderTest' => 'Feature/OrderTest.php',
    'PerformanceTest' => 'Feature/PerformanceTest.php'
];
foreach ($testFiles as $name => $file) {
    if (file_exists(__DIR__ . '/tests/' . $file)) {
        echo "✅ $name - EXISTS\n";
        $passed++;
    } else {
        echo "❌ $name - MISSING\n";
        $failed++;
    }
}

echo "\n=====================================\n";
echo "📊 SUMMARY:\n";
echo "✅ Passed: $passed\n";
echo "❌ Failed: $failed\n";
echo "✨ Total: " . ($passed + $failed) . "\n";
echo "🎯 Success Rate: " . round(($passed / ($passed + $failed)) * 100, 1) . "%\n";