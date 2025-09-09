<?php
// Minimal Laravel bootstrap test
try {
    require_once "../vendor/autoload.php";
    \$app = require_once "../bootstrap/app.php";
    echo "Laravel bootstrap successful";
} catch (Exception \$e) {
    echo "Error: " . \$e->getMessage();
}
