<?php
echo "=== Testing Dolibarr User Authentication ===\n";
echo "Testing user: omer ulusoy\n";
echo "Password: digiturk5!!!\n\n";

try {
    $pdo = new PDO("mysql:host=10.10.40.2;port=3306;dbname=dolidb;charset=utf8mb4", "dolidbuser", "dolidbpass");
    
    echo "1. Checking if user exists...\n";
    $user = $pdo->prepare("SELECT rowid, login, firstname, lastname, email, admin, statut FROM llx_user WHERE firstname = :firstname AND lastname = :lastname AND statut = 1");
    $user->execute(["firstname" => "omer", "lastname" => "ulusoy"]);
    
    $userData = $user->fetch(PDO::FETCH_ASSOC);
    
    if ($userData) {
        echo "✅ User found in Dolibarr database:\n";
        echo "  - ID: " . $userData["rowid"] . "\n";
        echo "  - Login: " . $userData["login"] . "\n";
        echo "  - Name: " . $userData["firstname"] . " " . $userData["lastname"] . "\n";
        echo "  - Email: " . $userData["email"] . "\n";
        echo "  - Admin: " . ($userData["admin"] ? "Yes" : "No") . "\n";
        echo "  - Status: " . ($userData["statut"] ? "Active" : "Inactive") . "\n";
        
        echo "\n2. Testing user permissions...\n";
        if ($userData["admin"] == 1) {
            echo "✅ User has ADMIN privileges\n";
        } else {
            echo "✅ User has REGULAR user privileges\n";
        }
        
        echo "\n✅ User omer ulusoy is ready for authentication testing!\n";
        
    } else {
        echo "❌ User omer ulusoy not found in Dolibarr database\n";
        
        echo "\n3. Checking all active users...\n";
        $allUsers = $pdo->query("SELECT rowid, login, firstname, lastname FROM llx_user WHERE statut = 1")->fetchAll(PDO::FETCH_ASSOC);
        echo "Available active users (" . count($allUsers) . "):\n";
        foreach ($allUsers as $user) {
            echo "  - " . $user["firstname"] . " " . $user["lastname"] . " (" . $user["login"] . ")\n";
        }
    }
    
} catch (Exception $e) {
    echo "❌ Database query failed: " . $e->getMessage() . "\n";
}

echo "\n=== Test Complete ===\n";