#!/bin/bash

# Clean Staging Deployment Script for Story 001 - Dolibarr Authentication System
# Version: 3.0 (Clean Version)
# Date: 2025-09-09

set -e  # Exit on any error

# Configuration
BASE_DIR="/home/remo/codebase/ShipmentApp"
LOG_FILE="/tmp/shipmentapp-staging-deploy.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Docker Compose ports from docker-compose.yml
BACKEND_URL="http://localhost:8080"
FRONTEND_URL="http://localhost:3000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${TIMESTAMP} - $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "${RED}ERROR: $1${NC}"
    exit 1
}

# Success message
success() {
    log "${GREEN}SUCCESS: $1${NC}"
}

# Warning message
warning() {
    log "${YELLOW}WARNING: $1${NC}"
}

log "Starting clean staging deployment for Dolibarr Authentication System"

# Pre-deployment checks
echo "=== PRE-DEPLOYMENT CHECKS ==="

# Check Docker availability
if ! command -v docker > /dev/null; then
    error_exit "Docker is not installed or not in PATH"
fi

# Check Docker Compose (try both docker-compose and docker compose)
if ! command -v docker-compose > /dev/null && ! docker compose version > /dev/null 2>&1; then
    error_exit "Docker Compose is not installed or not in PATH"
fi

# Check environment file exists
if [[ ! -f "$BASE_DIR/backend/.env" ]]; then
    error_exit "Backend .env file not found at $BASE_DIR/backend/.env"
fi

log "Pre-deployment checks completed successfully"

# Environment validation
echo "=== ENVIRONMENT VALIDATION ==="

# Validate required environment variables
required_vars=(
    "DOLIBARR_DB_HOST"
    "DOLIBARR_DB_PORT"
    "DOLIBARR_DB_DATABASE"
    "DOLIBARR_DB_USERNAME"
    "DOLIBARR_DB_PASSWORD"
    "APP_KEY"
    "DB_CONNECTION"
    "REDIS_HOST"
    "REDIS_PORT"
)

for var in "${required_vars[@]}"; do
    if ! grep -q "^$var=" "$BASE_DIR/backend/.env"; then
        error_exit "Required environment variable $var is missing from .env file"
    fi
done

log "Environment validation completed"

# Docker deployment
echo "=== DOCKER DEPLOYMENT ==="

cd "$BASE_DIR"

# Stop existing containers if running
log "Stopping existing containers..."
if command -v docker-compose > /dev/null; then
    docker-compose down || true
else
    docker compose down || true
fi

# Build and start services
log "Building Docker containers..."
if command -v docker-compose > /dev/null; then
    docker-compose build || error_exit "Failed to build Docker containers"
else
    docker compose build || error_exit "Failed to build Docker containers"
fi

log "Starting Docker services..."
if command -v docker-compose > /dev/null; then
    docker-compose up -d || error_exit "Failed to start Docker services"
else
    docker compose up -d || error_exit "Failed to start Docker services"
fi

# Wait for services to be ready
log "Waiting for services to be ready..."
sleep 30

# Health checks
echo "=== HEALTH CHECKS ==="

# Check backend health
log "Checking backend health..."
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/health" || echo "000")
if [[ "$BACKEND_HEALTH" != "200" ]]; then
    error_exit "Backend health check failed (HTTP $BACKEND_HEALTH)"
fi

# Check frontend health
log "Checking frontend health..."
FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" || echo "000")
if [[ "$FRONTEND_HEALTH" != "200" ]]; then
    warning "Frontend health check failed (HTTP $FRONTEND_HEALTH)"
fi

# Check authentication endpoints
log "Testing authentication endpoints..."
AUTH_TEST=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/auth/login" || echo "000")
if [[ "$AUTH_TEST" != "422" ]]; then  # 422 is expected for GET request
    error_exit "Authentication endpoint test failed (HTTP $AUTH_TEST)"
fi

# Database and service checks
echo "=== SERVICE VALIDATION ==="

# Test database connection
log "Testing database connectivity..."
if command -v docker-compose > /dev/null; then
    if docker-compose exec -T db pg_isready -U shipmentapp >/dev/null 2>&1; then
        success "PostgreSQL database is ready"
    else
        error_exit "PostgreSQL database is not ready"
    fi
else
    if docker compose exec -T db pg_isready -U shipmentapp >/dev/null 2>&1; then
        success "PostgreSQL database is ready"
    else
        error_exit "PostgreSQL database is not ready"
    fi
fi

# Test Redis connection
log "Testing Redis connectivity..."
if command -v docker-compose > /dev/null; then
    if docker-compose exec -T redis redis-cli ping >/dev/null 2>&1; then
        success "Redis cache is accessible"
    else
        error_exit "Redis cache is not accessible"
    fi
else
    if docker compose exec -T redis redis-cli ping >/dev/null 2>&1; then
        success "Redis cache is accessible"
    else
        error_exit "Redis cache is not accessible"
    fi
fi

# Check Laravel configuration
log "Testing Laravel configuration..."
if command -v docker-compose > /dev/null; then
    if docker-compose exec -T backend php artisan config:show >/dev/null 2>&1; then
        success "Laravel configuration is valid"
    else
        error_exit "Laravel configuration has issues"
    fi
else
    if docker compose exec -T backend php artisan config:show >/dev/null 2>&1; then
        success "Laravel configuration is valid"
    else
        error_exit "Laravel configuration has issues"
    fi
fi

# Run database migrations
log "Running database migrations..."
if command -v docker-compose > /dev/null; then
    docker-compose exec -T backend php artisan migrate --force || error_exit "Failed to run database migrations"
else
    docker compose exec -T backend php artisan migrate --force || error_exit "Failed to run database migrations"
fi

# Test Dolibarr connection
log "Testing Dolibarr database connection..."
if command -v docker-compose > /dev/null; then
    if docker-compose exec -T backend php artisan tinker --execute="
use App\Services\DolibarrAuthService;
\$service = new DolibarrAuthService();
if (\$service-\u003etestConnection()) {
    echo 'Dolibarr connection successful';
} else {
    echo 'Dolibarr connection failed';
    exit(1);
}
" \u003e/dev/null 2\u003e\u00261; then
        success "Dolibarr database connection successful"
    else
        error_exit "Failed to connect to Dolibarr database"
    fi
else
    if docker compose exec -T backend php artisan tinker --execute="
use App\Services\DolibarrAuthService;
\$service = new DolibarrAuthService();
if (\$service-\u003etestConnection()) {
    echo 'Dolibarr connection successful';
} else {
    echo 'Dolibarr connection failed';
    exit(1);
}
" \u003e/dev/null 2\u003e\u00261; then
        success "Dolibarr database connection successful"
    else
        error_exit "Failed to connect to Dolibarr database"
    fi
fi

# Build and test frontend
log "Building frontend application..."
cd "$BASE_DIR/frontend"
if command -v docker-compose > /dev/null; then
    docker-compose exec -T frontend npm run build || warning "Frontend build failed"
else
    docker compose exec -T frontend npm run build || warning "Frontend build failed"
fi

# Deployment summary
echo ""
echo "=== DEPLOYMENT SUMMARY ==="
log "Staging deployment completed successfully!"
log "Backend API: $BACKEND_URL"
log "Frontend App: $FRONTEND_URL"
log "Health Check: $BACKEND_URL/api/health"

echo ""
echo "Next steps:"
echo "1. Run validation: ./scripts/validate-deployment.sh"
echo "2. Test authentication with actual Dolibarr credentials"
echo "3. Monitor application logs: docker-compose logs -f"
echo "4. Run integration tests"

# Save deployment info
cat > /tmp/staging-deployment-info.txt << EOF
Deployment Date: $(date)
Backend URL: $BACKEND_URL
Frontend URL: $FRONTEND_URL
Health Check: $BACKEND_URL/api/health
Status: SUCCESS
EOF

log "Deployment information saved to /tmp/staging-deployment-info.txt"

log "Staging deployment completed successfully"

echo ""
echo "USAGE:"
echo "1. Ensure Docker and Docker Compose are installed"
echo "2. Configure environment variables in backend/.env"
echo "3. Run deployment: ./scripts/deploy-staging-clean.sh"
echo "4. Monitor logs: tail -f /var/log/shipmentapp-staging-deploy.log"
echo "5. Validate deployment: ./scripts/validate-deployment.sh"
