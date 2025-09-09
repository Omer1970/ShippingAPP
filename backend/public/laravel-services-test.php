<?php
require_once "../vendor/autoload.php";
\$app = require_once "../bootstrap/app.php";

// Test basic Laravel container
try {
    echo "Testing Laravel services...\n";
    
    // Test router
    \$router = \$app->make("router");
    echo "Router: OK\n";
    
    // Test database
    \$db = \$app->make("db");
    echo "Database: " . (\$db ? "Available" : "Not available") . "\n";
    
    echo "Services test completed\n";
} catch (Exception \$e) {
    echo "Error: " . \$e->getMessage() . "\n";
}
