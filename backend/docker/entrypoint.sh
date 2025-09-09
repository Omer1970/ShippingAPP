#!/bin/bash
set -e

echo "🚀 Starting ShipmentApp Backend..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
timeout=60
while ! php -r "try { \$pdo = new PDO('pgsql:host=' . env('DB_HOST') . ';port=' . env('DB_PORT') . ';dbname=' . env('DB_DATABASE'), env('DB_USERNAME'), env('DB_PASSWORD')); echo 'Database connected'; exit(0); } catch (Exception \$e) { exit(1); }" 2>/dev/null; do
    timeout=$((timeout - 1))
    if [ $timeout -eq 0 ]; then
        echo "❌ Database connection timeout"
        exit 1
    fi
    sleep 1
done
echo "✅ Database connected"

# Install composer dependencies if vendor directory doesn't exist
if [ ! -d "vendor" ]; then
    echo "📦 Installing composer dependencies..."
    composer install --no-dev --optimize-autoloader --no-interaction
fi

# Generate app key if not set
if [ -z "$APP_KEY" ]; then
    echo "🔑 Generating application key..."
    php artisan key:generate --show
fi

# Run database migrations
echo "🗄️ Running database migrations..."
php artisan migrate --force --no-interaction || true

# Clear and cache config
echo "⚙️ Caching configuration..."
php artisan config:cache || true
php artisan route:cache || true
php artisan view:cache || true

# Test Dolibarr connection if configured
if [ ! -z "$DOLIBARR_DB_HOST" ]; then
    echo "🔗 Testing Dolibarr connection..."
    php test-dolibarr-connection.php || echo "⚠️ Dolibarr connection test failed - authentication may not work"
fi

# Set proper permissions
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 777 /var/www/html/storage /var/www/html/bootstrap/cache

echo "✅ Setup complete! Starting Apache..."

# Execute the main command
exec "$@"