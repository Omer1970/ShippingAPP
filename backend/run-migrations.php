<?php

require_once 'vendor/autoload.php';

$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "=== Running Database Migrations ===\n";

try {
    // Run migrations
    $migrator = app('migrator');
    $migrator->run(database_path('migrations'));
    
    echo "✅ Migrations completed successfully!\n";
    
    // Show tables
    $tables = DB::select("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    echo "\nDatabase tables:\n";
    foreach ($tables as $table) {
        echo "- {$table->table_name}\n";
    }
    
} catch (Exception $e) {
    echo "❌ Migration error: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}

echo "\n=== Migration Complete ===\n";