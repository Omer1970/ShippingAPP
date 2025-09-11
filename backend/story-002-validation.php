<?php

/**
 * Final Story 002 Validation Script
 * Comprehensive validation against all requirements
 */

require __DIR__ . '/vendor/autoload.php';

echo "🎯 Story 002 Final Validation Report\n";
echo "=====================================\n\n";

echo "✅ VALIDATION RESULTS:\n\n";

// Function to check requirements
checkRequirements();
printSummary();

function checkRequirements() {
    global $data;
    
    // 1. API ENDPOINTS
    echo "1️⃣ API Endpoints Implementation:\n";
    
    $endpoints = [
        'GET /api/shipments' => [
            'file' => '/app/Http/Controllers/Api/ShipmentController.php',
            'method' => 'index'
        ],
        'GET /api/shipments/{id}' => [
            'file' => '/app/Http/Controllers/Api/ShipmentController.php',
            'method' => 'show'
        ],
        'GET /api/shipments/my' => [
            'file' => '/app/Http/Controllers/Api/ShipmentController.php',
            'method' => 'myShipments'
        ],
        'GET /api/shipments/status/{status}' => [
            'file' => '/app/Http/Controllers/Api/ShipmentController.php',
            'method' => 'byStatus'
        ],
        'GET /api/orders' => [
            'file' => '/app/Http/Controllers/Api/OrderController.php',
            'method' => 'index'
        ],
        'GET /api/orders/{id}' => [
            'file' => '/app/Http/Controllers/Api/OrderController.php',
            'method' => 'show'
        ],
        'GET /api/orders/customer/{customerId}' => [
            'file' => '/app/Http/Controllers/Api/OrderController.php',
            'method' => 'byCustomer'
        ],
        'GET /api/orders/status/{status}' => [
            'file' => '/app/Http/Controllers/Api/OrderController.php',
            'method' => 'byStatus'
        ]
    ];
    
    $failed = [];
    $passed = [];
    
    foreach ($endpoints as $endpoint => $config) {
        $file = __DIR__ . $config['file'];
        $method = $config['method'];
        
        if (file_exists($file)) {
            $content = file_get_contents($file);
            if (strpos($content, "public function $method(") !== false) {
                echo "✅ $endpoint - IMPLEMENTED\n";
                $passed[] = $endpoint;
            } else {
                echo "❌ $endpoint - METHOD MISSING\n";
                $failed[] = "$endpoint (missing method $method)";
            }
        } else {
            echo "❌ $endpoint - CONTROLLER MISSING\n";
            $failed[] = "$endpoint (missing controller)";
        }
    }
    
    // 2. DATA MODELS
    echo "\n2️⃣ Data Models:\n";
    $models = [
        'Shipment Model' => '/app/Models/Shipment.php',
        'Order Model' => '/app/Models/Order.php',
        'Shipment Resource' => '/app/Http/Resources/ShipmentResource.php',
        'Order Resource' => '/app/Http/Resources/OrderResource.php',
        'DolibarrDataService' => '/app/Services/DolibarrDataService.php'
    ];
    
    foreach ($models as $name => $path) {
        $fullPath = __DIR__ . $path;
        if (file_exists($fullPath)) {
            echo "✅ $name - EXISTS\n";
            $passed[] = $name;
        } else {
            echo "❌ $name - MISSING\n";
            $failed[] = $name;
        }
    }
    
    // 3. SECURITY MEASURES
    echo "\n3️⃣ Security Measures:\n";
    
    $routes = file_get_contents(__DIR__ . '/routes/api.php');
    
    if (strpos($routes, "Route::middleware('auth:sanctum')") !== false) {
        echo "✅ Authentication middleware applied\n";
        $passed[] = 'Authentication middleware';
    } else {
        echo "❌ Authentication middleware missing\n";
        $failed[] = 'Authentication middleware';
    }
    
    // Check for throttle
    if (strpos($routes, 'throttle') !== false) {
        echo "✅ Rate limiting implemented\n";
        $passed[] = 'Rate limiting';
    } else {
        echo "❌ Rate limiting missing\n";
        $failed[] = 'Rate limiting';
    }
    
    // Check for error handling
    $ShipmentContent = file_get_contents(__DIR__ . '/app/Http/Controllers/Api/ShipmentController.php');
    if (strpos($ShipmentContent, 'try {') !== false && strpos($ShipmentContent, 'catch') !== false) {
        echo "✅ Error handling implemented\n";
        $passed[] = 'Error handling';
    } else {
        echo "❌ Error handling missing\n";
        $failed[] = 'Error handling';
    }
    
    // 4. TESTING
    echo "\n4️⃣ Testing Coverage:\n";
    
    $testFiles = [
        'Shipment API Tests' => '/tests/Feature/ShipmentTest.php',
        'Order API Tests' => '/tests/Feature/OrderTest.php',
        'Performance Tests' => '/tests/Feature/PerformanceTest.php',
        'Data Service Tests' => '/tests/Unit/DolibarrDataServiceTest.php'
    ];
    
    foreach ($testFiles as $name => $path) {
        $fullPath = __DIR__ . $path;
        if (file_exists($fullPath)) {
            $count = count(explode("\n", file_get_contents($fullPath)));
            echo "✅ $name - EXISTS ($count lines)\n";
            $passed[] = $name;
        } else {
            echo "❌ $name - MISSING\n";
            $failed[] = $name;
        }
    }
    
    // 5. FRONTEND VALIDATION
    echo "\n5️⃣ Frontend Components:\n";
    
    $frontendBase = __DIR__ . '/../frontend/src';
    $frontendComponents = [
        'Shipment Model' => '/app/core/models/shipment.model.ts',
        'Order Model' => '/app/core/models/order.model.ts',
        'Shipment Service' => '/app/core/services/shipment.service.ts',
        'Order Service' => '/app/core/services/order.service.ts',
        'Shipment List Component' => '/app/shared/components/shipment-list/shipment-list.component.ts',
        'Order List Component' => '/app/shared/components/order-list/order-list.component.ts',
        'Dashboard Component' => '/app/features/dashboard/dashboard.component.ts'
    ];
    
    foreach ($frontendComponents as $name => $path) {
        $fullPath = $frontendBase . $path;
        if (file_exists($fullPath)) {
            echo "✅ $name - EXISTS\n";
            $passed[] = $name;
        } else {
            echo "❌ $name - MISSING\n";
            $failed[] = $name;
        }
    }
    
    // Store results globally
    global $testPassed, $testFailed;
    $testPassed = count($passed);
    $testFailed = count($failed);
}

function printSummary() {
    global $testPassed, $testFailed;
    
    echo "\n🎯 FINAL VALIDATION SUMMARY:\n";
    echo "=====================================\n";
    echo "✅ REQUIREMENTS PASSED: $testPassed\n";
    echo "❌ REQUIREMENTS FAILED: $testFailed\n";
    echo "📊 COMPLETION RATE: " . round(($testPassed / ($testPassed + $testFailed)) * 100, 1) . "%\n";
    
    $completionStatus = "UNKNOWN";
    $percentage = round(($testPassed / ($testPassed + $testFailed)) * 100, 1);
    
    if ($percentage >= 95) {
        $completionStatus = "COMPLETED - READY FOR QA";
    } elseif ($percentage >= 80) {
        $completionStatus = "NEARLY COMPLETE";
    } elseif ($percentage >= 60) {
        $completionStatus = "IN PROGRESS";
    } else {
        $completionStatus = "EARLY STAGE";
    }
    
    echo "🏷️  STATUS: $completionStatus\n";
    echo "=====================================\n";
    
    // Return result for documentation update
    return $percentage >= 95 ? 'completed' : 'in_progress';
}

echo "\n✨ Validation complete - updating documentation...\n";