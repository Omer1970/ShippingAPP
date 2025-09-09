<?php
require_once "../vendor/autoload.php";
\$app = require_once "../bootstrap/app.php";

// Test basic Laravel container
try {
    \$router = \$app-make("router");
    echo "Router created successfully\n";
    
    // Test database connection
    \$db = \$app-make("db");
    echo "Database connection: " . (\$db ? "OK" : "Failed") . "\n";
    
    echo "Laravel services test completed\n";
} catch (Exception \$e) {
    echo "Error: " . \$e->getMessage() . "\n";
}
