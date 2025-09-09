<?php

require_once 'vendor/autoload.php';

$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();

echo "=== Dolibarr Connection Test ===\n";

// Test database configuration
$config = config('database.connections.dolibarr');
echo "Dolibarr Config:\n";
echo "- Host: {$config['host']}\n";
echo "- Port: {$config['port']}\n";
echo "- Database: {$config['database']}\n";
echo "- Username: {$config['username']}\n";
echo "- Password: " . (empty($config['password']) ? 'not set' : 'set') . "\n\n";

// Test connection
try {
    $dolibarrService = app(App\Services\DolibarrAuthService::class);
    
    if ($dolibarrService->testConnection()) {
        echo "✅ Dolibarr database connection successful!\n";
        
        // Test user query
        $user = DB::connection('dolibarr')
            ->table('llx_user')
            ->select('rowid', 'login', 'lastname', 'firstname', 'email', 'statut', 'admin')
            ->where('statut', 1)
            ->first();
            
        if ($user) {
            echo "✅ Found active user in Dolibarr:\n";
            echo "- ID: {$user->rowid}\n";
            echo "- Login: {$user->login}\n";
            echo "- Name: {$user->firstname} {$user->lastname}\n";
            echo "- Email: {$user->email}\n";
            echo "- Admin: " . ($user->admin ? 'Yes' : 'No') . "\n";
        } else {
            echo "⚠️  No active users found in Dolibarr\n";
        }
    } else {
        echo "❌ Dolibarr database connection failed\n";
    }
    
} catch (\Exception $e) {
    echo "❌ Dolibarr connection error: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}

echo "\n=== Test Complete ===\n";