#!/bin/bash

# Deployment Validation Script for Story 001 - Dolibarr Authentication System
# Version: 1.0
# Date: 2025-09-09

set -e

# Configuration
BACKEND_URL="http://localhost:8080"
FRONTEND_URL="http://localhost:3000"
LOG_FILE="/tmp/shipmentapp-validation.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${TIMESTAMP} - $1" | tee -a "$LOG_FILE"
}

test_passed() {
    log "${GREEN}✓ PASS: $1${NC}"
}

test_failed() {
    log "${RED}✗ FAIL: $1${NC}"
}

test_warning() {
    log "${YELLOW}⚠ WARNING: $1${NC}"
}

test_info() {
    log "${BLUE}ℹ INFO: $1${NC}"
}

log "Starting deployment validation for Dolibarr Authentication System"

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNING=0

# Function to perform HTTP request test
test_http_endpoint() {
    local name="$1"
    local url="$2"
    local expected_code="$3"
    local method="${4:-GET}"
    local data="$5"
    
    test_info "Testing $name: $url"
    
    if [[ -n "$data" ]]; then
        RESPONSE=$(curl -s -X "$method" "$url" \
            -H "Content-Type: application/json" \
            -d "$data" \
            -w "\nHTTP_CODE:%{http_code}" \
            2>/dev/null || echo "HTTP_CODE:000")
    else
        RESPONSE=$(curl -s -X "$method" "$url" \
            -w "\nHTTP_CODE:%{http_code}" \
            2>/dev/null || echo "HTTP_CODE:000")
    fi
    
    HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
    
    if [[ "$HTTP_CODE" == "$expected_code" ]]; then
        test_passed "$name returned expected HTTP $expected_code"
        ((TESTS_PASSED++))
    else
        test_failed "$name returned HTTP $HTTP_CODE, expected $expected_code"
        ((TESTS_FAILED++))
    fi
}

# Function to test service connectivity
test_service_connectivity() {
    local name="$1"
    local host="$2"
    local port="$3"
    
    test_info "Testing $name connectivity: $host:$port"
    
    if timeout 5 bash -c "echo >/dev/tcp/$host/$port" 2>/dev/null; then
        test_passed "$name is accessible at $host:$port"
        ((TESTS_PASSED++))
    else
        test_failed "$name is not accessible at $host:$port"
        ((TESTS_FAILED++))
    fi
}

echo "=== DEPLOYMENT VALIDATION ==="

# 1. Service Connectivity Tests
echo ""
echo "1. SERVICE CONNECTIVITY TESTS"
echo "-------------------------------"

test_service_connectivity "PostgreSQL" "localhost" "5432"
test_service_connectivity "Redis" "localhost" "6379"
test_service_connectivity "Backend API" "localhost" "8000"
test_service_connectivity "Frontend App" "localhost" "4200"

# 2. Backend API Tests
echo ""
echo "2. BACKEND API TESTS"
echo "--------------------"

# Health check endpoint
test_http_endpoint "Backend Health Check" "$BACKEND_URL/api/health" "200"

# Authentication endpoints
test_http_endpoint "Login Endpoint (GET)" "$BACKEND_URL/api/auth/login" "405"
test_http_endpoint "Login Endpoint (POST)" "$BACKEND_URL/api/auth/login" "422" "POST" '{"email":"","password":""}'
test_http_endpoint "User Endpoint (No Auth)" "$BACKEND_URL/api/auth/user" "401"
test_http_endpoint "Logout Endpoint (No Auth)" "$BACKEND_URL/api/auth/logout" "401"

# 3. Frontend Tests
echo ""
echo "3. FRONTEND TESTS"
echo "-----------------"

test_http_endpoint "Frontend Application" "$FRONTEND_URL" "200"

# 4. Docker Container Tests
echo ""
echo "4. DOCKER CONTAINER TESTS"
echo "-------------------------"

# Check if containers are running
test_info "Checking Docker containers status..."

if docker-compose ps | grep -q "Up"; then
    test_passed "Docker containers are running"
    ((TESTS_PASSED++))
else
    test_failed "Docker containers are not running properly"
    ((TESTS_FAILED++))
fi

# Check container health
CONTAINERS=$(docker-compose ps -q)
for container in $CONTAINERS; do
    CONTAINER_NAME=$(docker inspect --format='{{.Name}}' $container | sed 's/\///')
    CONTAINER_STATUS=$(docker inspect --format='{{.State.Status}}' $container)
    
    if [[ "$CONTAINER_STATUS" == "running" ]]; then
        test_passed "Container $CONTAINER_NAME is running"
        ((TESTS_PASSED++))
    else
        test_failed "Container $CONTAINER_NAME is not running (status: $CONTAINER_STATUS)"
        ((TESTS_FAILED++))
    fi
done

# 5. Database Tests
echo ""
echo "5. DATABASE TESTS"
echo "-----------------"

# Test database connection
test_info "Testing database connectivity..."
if docker-compose exec -T postgres pg_isready -U postgres &>/dev/null; then
    test_passed "PostgreSQL database is ready"
    ((TESTS_PASSED++))
else
    test_failed "PostgreSQL database is not ready"
    ((TESTS_FAILED++))
fi

# Test Redis connection
test_info "Testing Redis connectivity..."
if docker-compose exec -T redis redis-cli ping &>/dev/null; then
    test_passed "Redis cache is accessible"
    ((TESTS_PASSED++))
else
    test_failed "Redis cache is not accessible"
    ((TESTS_FAILED++))
fi

# 6. Application Log Tests
echo ""
echo "6. APPLICATION LOG TESTS"
echo "------------------------"

# Check for recent errors in backend logs
test_info "Checking backend logs for errors..."
if docker-compose logs backend --tail=50 | grep -i "error\|exception" &>/dev/null; then
    test_warning "Errors found in backend logs (check detailed logs)"
    ((TESTS_WARNING++))
else
    test_passed "No recent errors in backend logs"
    ((TESTS_PASSED++))
fi

# Check for recent errors in frontend logs
test_info "Checking frontend logs for errors..."
if docker-compose logs frontend --tail=50 | grep -i "error\|exception" &>/dev/null; then
    test_warning "Errors found in frontend logs (check detailed logs)"
    ((TESTS_WARNING++))
else
    test_passed "No recent errors in frontend logs"
    ((TESTS_PASSED++))
fi

# 7. Configuration Tests
echo ""
echo "7. CONFIGURATION TESTS"
echo "----------------------"

# Check Laravel configuration
test_info "Testing Laravel configuration..."
if docker-compose exec -T backend php artisan config:show &>/dev/null; then
    test_passed "Laravel configuration is valid"
    ((TESTS_PASSED++))
else
    test_failed "Laravel configuration has issues"
    ((TESTS_FAILED++))
fi

# Check if migrations are up to date
test_info "Checking database migrations..."
if docker-compose exec -T backend php artisan migrate:status | grep -q "Pending"; then
    test_warning "Pending database migrations found"
    ((TESTS_WARNING++))
else
    test_passed "Database migrations are up to date"
    ((TESTS_PASSED++))
fi

# 8. Performance Tests
echo ""
echo "8. PERFORMANCE TESTS"
echo "--------------------"

# Test API response time
test_info "Testing API response time..."
START_TIME=$(date +%s%N)
curl -s "$BACKEND_URL/api/health" > /dev/null
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))  # Convert to milliseconds

if [[ $RESPONSE_TIME -lt 1000 ]]; then
    test_passed "API response time is acceptable (${RESPONSE_TIME}ms)"
    ((TESTS_PASSED++))
else
    test_warning "API response time is slow (${RESPONSE_TIME}ms)"
    ((TESTS_WARNING++))
fi

# SUMMARY
echo ""
echo "=== VALIDATION SUMMARY ==="
echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $TESTS_FAILED"
echo "Tests with Warnings: $TESTS_WARNING"
echo "Total Tests: $((TESTS_PASSED + TESTS_FAILED + TESTS_WARNING))"

if [[ $TESTS_FAILED -eq 0 ]]; then
    if [[ $TESTS_WARNING -eq 0 ]]; then
        log "${GREEN}DEPLOYMENT VALIDATION PASSED - All tests successful!${NC}"
        exit_code=0
    else
        log "${YELLOW}DEPLOYMENT VALIDATION PASSED WITH WARNINGS - Check warnings above${NC}"
        exit_code=0
    fi
else
    log "${RED}DEPLOYMENT VALIDATION FAILED - $TESTS_FAILED tests failed${NC}"
    exit_code=1
fi

# Save validation results
cat > /tmp/validation-results.txt << EOF
Validation Date: $(date)
Tests Passed: $TESTS_PASSED
Tests Failed: $TESTS_FAILED
Tests with Warnings: $TESTS_WARNING
Overall Status: $([ $exit_code -eq 0 ] && echo "PASSED" || echo "FAILED")
Backend URL: $BACKEND_URL
Frontend URL: $FRONTEND_URL
Log File: $LOG_FILE
EOF

log "Validation results saved to /tmp/validation-results.txt"

exit $exit_code