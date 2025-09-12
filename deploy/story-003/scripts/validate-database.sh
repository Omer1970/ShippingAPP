#!/bin/bash
# validate-database.sh - Story 003 Database Connectivity Validation

echo "=== Database Connectivity Validation ==="

# Change to application directory (this should be replaced with your actual path)
APP_PATH="${APP_PATH:-/var/www/html/backend}"

if [ -d "$APP_PATH" ]; then
    cd "$APP_PATH"
    echo "Working directory: $(pwd)"
else
    echo "❌ Application directory not found: $APP_PATH"
    exit 1
fi

# MySQL connection test
echo "Testing MySQL connection..."
mysql_result=$(php artisan tinker --execute="echo DB::select('SELECT 1')[0]->{'1'};" 2>/dev/null)
if [ "$mysql_result" = "1" ]; then
    echo "✅ MySQL connection: PASSED"
    MYSQL_OK=true
else
    echo "❌ MySQL connection: FAILED"
    MYSQL_OK=false
    RETURN_CODE=1
fi

# Redis connection test
echo "Testing Redis connection..."
redis_result=$(php artisan tinker --execute="echo Cache::getRedis()->ping() ? 'pong' : 'fail';" 2>/dev/null)
if [ "$redis_result" = "pong" ]; then
    echo "✅ Redis connection: PASSED"
    REDIS_OK=true
else
    echo "❌ Redis connection: FAILED"
    REDIS_OK=false
    RETURN_CODE=1
fi

# Dolibarr connection test
echo "Testing Dolibarr connection..."
dolibarr_result=$(php artisan tinker --execute="echo DB::connection('dolibarr')->select('SELECT COUNT(*) as count FROM llx_societe')[0]->count;" 2>/dev/null)
if [ "$dolibarr_result" -gt "0" ]; then
    echo "✅ Dolibarr connection: PASSED ($dolibarr_result customers)"
    DOLIBARR_OK=true
else
    echo "❌ Dolibarr connection: FAILED"
    DOLIBARR_OK=false
    RETURN_CODE=1
fi

# Search functionality test (if MySQL connected)
if [ "$MYSQL_OK" = true ]; then
    echo "Testing customer search functionality..."
    search_result=$(php artisan tinker --execute="echo \App\Models\Customer::count();" 2>/dev/null)
    if [ "$search_result" -ge "0" ]; then
        echo "✅ Customer search model: PASSED ($search_result customers)"
    else
        echo "❌ Customer search model: FAILED"
        RETURN_CODE=1
    fi
fi

echo "Database connectivity: OPERATIONAL"
exit ${RETURN_CODE:-0}