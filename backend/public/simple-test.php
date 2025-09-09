<?php
// Simple test without Laravel bootstrap
echo "PHP is working fine. Extensions:\n";
echo "- Redis: " . (extension_loaded("redis") ? "✅ Loaded" : "❌ Missing") . "\n";
echo "- PDO: " . (extension_loaded("pdo") ? "✅ Loaded" : "❌ Missing") . "\n";
echo "- PDO_PGSQL: " . (extension_loaded("pdo_pgsql") ? "✅ Loaded" : "❌ Missing") . "\n";
echo "Memory limit: " . ini_get("memory_limit") . "\n";
echo "Max execution time: " . ini_get("max_execution_time") . "\n";
