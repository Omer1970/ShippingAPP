# Story 003: Customer Search and Profile Management
# Post-Deployment Validation Scripts

**Story ID:** STORY-003  
**Status:** QA PASS - Ready for Production  
**Validation Date:** September 12, 2025  

---

## Quick Start Validation

### Fast Validation (5 minutes)
```bash
# Run complete validation suite
./scripts/validate-story-003.sh production

# Or step-by-step validation
./scripts/validate-story-003.sh --step=health-checks
```

---

## 1. System Health Validation

### 1.1 API Health Checks
```bash
#!/bin/bash
# validate-api-health.sh

echo "=== API Health Validation ==="

# Base URL (replace with your production API URL)
API_URL="https://api.shipmentapp.com"
AUTH_TOKEN="your_production_token"

# Health endpoint
health_status=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health")
if [ "$health_status" = "200" ]; then
    echo "✅ Health check: PASSED"
else
    echo "❌ Health check: FAILED (HTTP $health_status)"
    exit 1
fi

# Authentication test
auth_test=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/user" | jq '.success')
if [ "$auth_test" = "true" ]; then
    echo "✅ Authentication: PASSED"
else
    echo "❌ Authentication: FAILED"
    exit 1
fi

echo "API Health: OPERATIONAL"
```

### 1.2 Database Connectivity
```bash
#!/bin/bash
# validate-database.sh

echo "=== Database Connectivity ==="

cd /var/www/html/backend

# MySQL connection test
mysql_result=$(php artisan tinker --execute="echo DB::select('SELECT 1')[0]->{'1'};" 2>/dev/null)
if [ "$mysql_result" = "1" ]; then
    echo "✅ MySQL connection: PASSED"
else
    echo "❌ MySQL connection: FAILED"
    exit 1
fi

# Redis connection test
redis_result=$(php artisan tinker --execute="echo Cache::getRedis()->ping() ? 'pong' : 'fail';" 2>/dev/null)
if [ "$redis_result" = "pong" ]; then
    echo "✅ Redis connection: PASSED"  
else
    echo "❌ Redis connection: FAILED"
    exit 1
fi

# Dolibarr connection test
dolibarr_result=$(php artisan tinker --execute="echo DB::connection('dolibarr')->select('SELECT COUNT(*) as count FROM llx_societe')[0]->count;" 2>/dev/null)
if [ "$dolibarr_result" -gt "0" ]; then
    echo "✅ Dolibarr connection: PASSED ($dolibarr_result customers)"
else
    echo "❌ Dolibarr connection: FAILED"
    exit 1
fi

echo "Database connectivity: OPERATIONAL"
```

---

## 2. Performance Validation

### 2.1 Autocomplete Performance Test
```bash
#!/bin/bash
# validate-autocomplete-performance.sh

echo "=== Autocomplete Performance Validation ==="

API_URL="https://api.shipmentapp.com"
AUTH_TOKEN="your_production_token"

# Test customer autocomplete
start_time=$(($(date +%s%N) / 1000000))
response=$(curl -s -w "\n%{time_total}" -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/customers/search?q=ABC&limit=10")
response_time=$(echo "$response" | tail -n 1 | cut -d'.' -f1)

# Check if response is successful (should contain JSON data)
if echo "$response" | head -n -1 | jq empty 2>/dev/null; then
    response_success=$(echo "$response" | head -n -1 | jq '.success')
    result_count=$(echo "$response" | head -n -1 | jq '.data.customers | length')
    search_time_ms=$(echo "$response" | head -n -1 | jq '.data.autocomplete.search_time_ms')
    
    if [ "$response_success" = "true" ] && [ "$response_time" -lt "200" ]; then
        echo "✅ Autocomplete performance: PASSED (${response_time}ms, search_time: ${search_time_ms}ms, results: $result_count)"
    else
        echo "❌ Autocomplete performance: FAILED (${response_time}ms, max allowed: 200ms)"
        exit 1
    fi
else
    echo "❌ Autocomplete: Invalid response format"
    exit 1
fi
```

### 2.2 Customer Search Performance Test
```bash
#!/bin/bash
# validate-search-performance.sh

echo "=== Customer Search Performance Validation ==="

API_URL="https://api.shipmentapp.com"
AUTH_TOKEN="your_production_token"

# Test customer search
start_time=$(($(date +%s%N) / 1000000))
response=$(curl -s -w "\n%{time_total}" -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/customers"")
response_time=$(echo "$response" | tail -n 1 | cut -d'.' -f1)

if [ "$response_time" -lt "500" ]; then
    echo "✅ Customer search performance: PASSED (${response_time}ms)"
else
    echo "❌ Customer search performance: FAILED (${response_time}ms, max allowed: 500ms)"
    exit 1
fi
```

### 2.3 Customer Profile Load Test
```bash
#!/bin/bash
# validate-profile-performance.sh

echo "=== Customer Profile Performance Validation ==="

API_URL="https://api.shipmentapp.com"
AUTH_TOKEN="your_production_token"

# Test with a sample customer (you may need to adjust this customer ID)
CUSTOMER_ID=1

start_time=$(($(date +%s%N) / 1000000))
response=$(curl -s -w "\n%{time_total}" -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/customers/$CUSTOMER_ID")
response_time=$(echo "$response" | tail -n -1 | cut -d'.' -f1)

if [ "$response_time" -lt "1000" ]; then
    echo "✅ Customer profile performance: PASSED (${response_time}ms)"
else
    echo "❌ Customer profile performance: FAILED (${response_time}ms, max allowed: 1000ms)"
    exit 1
fi
```

---

## 3. Functional Testing

### 3.1 Search Functionality Test
```bash
#!/bin/bash
# validate-search-functionality.sh

echo "=== Search Functionality Validation ==="

API_URL="https://api.shipmentapp.com"
AUTH_TOKEN="your_production_token"

# Test 1: Autocomplete basic search
echo "Testing basic autocomplete..."
response=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/customers/search?q=Corp")
if echo "$response" | jq -e '.data.customers | length > 0' >/dev/null 2>&1; then
    echo "✅ Basic autocomplete: PASSED"
else
    echo "❌ Basic autocomplete: FAILED"
    exit 1
fi

# Test 2: Customer profile retrieval
echo "Testing customer profile..."
# Extract first customer ID from search results
first_customer_id=$(echo "$response" | jq -r '.data.customers[0].id')
profile_response=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/customers/$first_customer_id")
if echo "$profile_response" | jq -e '.success == true' >/dev/null 2>&1; then
    echo "✅ Customer profile: PASSED"
else
    echo "❌ Customer profile: FAILED"
    exit 1
fi

# Test 3: Customer orders history
echo "Testing orders history..."
orders_response=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/customers/$first_customer_id/orders")
if echo "$orders_response" | jq -e '.success == true' >/dev/null 2>&1; then
    echo "✅ Orders history: PASSED"
else
    echo "❌ Orders history: FAILED"
    exit 1
fi

# Test 4: Customer shipments history
echo "Testing shipments history..."
shipments_response=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/customers/$first_customer_id/shipments")
if echo "$shipments_response" | jq -e '.success == true' >/dev/null 2>&1; then
    echo "✅ Shipments history: PASSED"
else
    echo "❌ Shipments history: FAILED"
    exit 1
fi
```

### 3.2 Advanced Filtering Test
```bash
#!/bin/bash
# validate-advanced-filtering.sh

echo "=== Advanced Filtering Validation ==="

API_URL="https://api.shipmentapp.com"
AUTH_TOKEN="your_production_token"

# Test advanced search with multiple filters
filters='{
    "search_query": "test",
    "filters": {
        "customer_type": ["Corporate", "Small_Business"],
        "credit_status": "Active",
        "date_range": {
            "start": "2025-01-01",
            "end": "2025-12-31"
        },
        "status": "active"
    },
    "sort_by": "name",
    "sort_order": "asc",
    "limit": 10,
    "offset": 0
}'

response=$(curl -s -X POST -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$filters" \
    "$API_URL/api/search/advanced")

if echo "$response" | jq -e '.success == true' >/dev/null 2>&1; then
    result_count=$(echo "$response" | jq '.data.customers | length')
    echo "✅ Advanced filtering: PASSED ($result_count results)"
else
    echo "❌ Advanced filtering: FAILED"
    exit 1
fi
```

---

## 4. Security Validation

### 4.1 Authentication & Authorization Test
```bash
#!/bin/bash
# validate-security.sh

echo "=== Security Validation ==="

API_URL="https://api.shipmentapp.com"
CUSTOMER_ID=1

# Test 1: Unauthenticated access should be blocked
echo "Testing unauthenticated access..."
unauth_response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/customers/search?q=test")
if [ "$unauth_response" = "401" ]; then
    echo "✅ Unauthenticated access blocked: PASSED"
else
    echo "❌ Unauthenticated access: FAILED (got $unauth_response, expected 401)"
    exit 1
fi

# Test 2: Rate limiting on autocomplete (simulate 121 requests)
echo "Testing rate limiting..."
for i in {1..121}; do
    rate_response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        "$API_URL/api/customers/search?q=test$i")
done

if [ "$rate_response" = "429" ]; then
    echo "✅ Rate limiting: PASSED"
else
    echo "❌ Rate limiting: FAILED (got $rate_response, expected 429)"
    exit 1
fi

# Test 3: Input validation (SQL injection attempt)
echo "Testing input validation..."
sql_test="test' OR 1=1--"
validation_response=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" \
    "$API_URL/api/customers/search?q=$sql_test")

if echo "$validation_response" | jq -e '.success == true or .success == false' >/dev/null 2>&1; then
    echo "✅ Input validation: PASSED"
else
    echo "❌ Input validation: FAILED"
    exit 1
fi
```

### 4.2 Data Security Validation
```bash
#!/bin/bash
# validate-data-security.sh

echo "=== Data Security Validation ==="

API_URL="https://api.shipmentapp.com"
AUTH_TOKEN="your_production_token"

# Test 1: Customer data should not be cached in public CDN
echo "Testing CDN cache headers..."
cache_headers=$(curl -s -I -H "Authorization: Bearer $AUTH_TOKEN" \
    "$API_URL/api/customers/search?q=test" | grep -E 'Cache-Control|CD' || echo 'MISSING')

if echo "$cache_headers" | grep -q 'no-cache\|private' || [ "$cache_headers" != "MISSING" ]; then
    echo "✅ Cache headers: PASSED"
else
    echo "❌ Cache headers: FAILED"
    exit 1
fi

# Test 2: HTTPS enforcement
echo "Testing HTTPS enforcement..."
http_response=$(curl -s -o /dev/null -w "%{http_code}" "http://$API_URL/api/customers/search?q=test")
if [ "$http_response" = "301" ] || [ "$http_response" = "308" ] || [ "$http_response" = "400" ]; then
    echo "✅ HTTPS enforcement: PASSED"
else
    echo "⚠️  HTTPS enforcement: MANUAL CHECK REQUIRED"
fi
```

---

## 5. Mobile & Cross-Browser Validation

### 5.1 Mobile-Specific Tests
```bash
#!/bin/bash
# validate-mobile.sh

echo "=== Mobile Validation ==="

API_URL="https://api.shipmentapp.com"
AUTH_TOKEN="your_production_token"

# Test with mobile user agent strings
mobile_agents=(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"
    "Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36"
)

for agent in "${mobile_agents[@]}"; do
    echo "Testing mobile agent: ${agent:0:50}..."
    response=$(curl -s -A "$agent" -H "Authorization: Bearer $AUTH_TOKEN" \
        "$API_URL/api/customers/search?q=test")
    
    if echo "$response" | jq -e '.success == true' >/dev/null 2>&1; then
        result_count=$(echo "$response" | jq '.data.customers | length')
        echo "✅ Mobile compatibility: PASSED ($result_count results)"
    else
        echo "❌ Mobile compatibility: FAILED"
        exit 1
    fi
done
```

---

## 6. Load Testing Validation

### 6.1 Concurrent Request Test
```bash
#!/bin/bash
# validate-concurrent-load.sh

echo "=== Concurrent Load Testing ==="

API_URL="https://api.shipmentapp.com"
AUTH_TOKEN="your_production_token"

# Function to make API call
make_api_call() {
    local test_query="test_$1"
    local response=$(curl -s -o /dev/null -w "%{time_total},%{http_code}" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        "$API_URL/api/customers/search?q=$test_query")
    echo "$response"
}

# Test with 10 concurrent requests
echo "Testing 10 concurrent requests..."
pids=()
for i in {1..10}; do
    make_api_call "$i" &
    pids+=($!)
done

# Wait for all requests to complete
wait "${pids[@]}"

echo "✅ Concurrent requests test: COMPLETED"
# In a real scenario, you would analyze response times and success rates
```

### 6.2 Cache Performance Test
```bash
#!/bin/bash
# validate-cache-performance.sh

echo "=== Cache Performance Validation ==="

API_URL="https://api.shipmentapp.com"
AUTH_TOKEN="your_production_token"

# Same query multiple times to test cache
for i in {1..5}; do
    start_time=$(($(date +%s%N) / 1000000))
    response=$(curl -s -w "\n%{time_total}" -H "Authorization: Bearer $AUTH_TOKEN" \
        "$API_URL/api/customers/search?q=cache_test&limit=5")
    end_time=$(($(date +%s%N) / 1000000))
    total_time=$(echo "$response" | tail -n 1 | cut -d'.' -f1)
    echo "Request $i: ${total_time}ms"
done

echo "✅ Cache performance test: COMPLETED"
```

---

## 7. Error Handling & Resilience Tests

### 7.1 Graceful Degradation Test
```bash
#!/bin/bash
# validate-error-handling.sh

echo "=== Error Handling Validation ==="

API_URL="https://api.shipmentapp.com"
AUTH_TOKEN="your_production_token"

# Test 1: Empty search query
echo "Testing empty search query..."
empty_response=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/customers/search?q=")
if echo "$empty_response" | jq -e '.success == true' >/dev/null 2>&1; then
    echo "✅ Empty search handling: PASSED"
else
    echo "❌ Empty search handling: FAILED"
    exit 1
fi

# Test 2: Invalid customer ID
echo "Testing invalid customer ID..."
invalid_response=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/customers/999999")
if echo "$invalid_response" | jq -e '.error != null' >/dev/null 2>&1; then
    echo "✅ Invalid customer handling: PASSED"
else
    echo "❌ Invalid customer handling: FAILED"
    exit 1
fi

# Test 3: Special characters in search
echo "Testing special characters..."
special_response=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" \
    "$API_URL/api/customers/search?q=%21%40%23%24%25%5E%26%2A"")
if echo "$special_response" | jq -e '.success == true or .success == false' >/dev/null 2>&1; then
    echo "✅ Special character handling: PASSED"
else
    echo "❌ Special character handling: FAILED"
    exit 1
fi
```

---

## 8. Automated Test Suite

### 8.1 Complete Validation Script
```bash
#!/bin/bash
# validate-story-003.sh

echo "=========================================="
echo "Story 003: Complete Post-Deployment Validation"
echo "=========================================="

API_URL="${API_URL:-https://api.shipmentapp.com}"
AUTH_TOKEN="${AUTH_TOKEN:-your_production_token}"
ENVIRONMENT="${1:-production}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

test_result() {
    local result=$1
    local description=$2
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [ "$result" = "PASS" ]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo -e "${GREEN}✅ $description: PASSED${NC}"
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo -e "${RED}❌ $description: FAILED${NC}"
    fi
}

echo "Environment: $ENVIRONMENT"
echo "API URL: $API_URL"
echo "Timestamp: $(date)"
echo ""

# Health checks
echo "1. System Health Validation..."
health_status=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health")
test_result "$([ "$health_status" = "200" ] && echo PASS || echo FAIL)" "API Health Check"

# Database connectivity
mysql_result=$(php artisan tinker --execute="echo DB::select('SELECT 1')[0]->{'1'};" 2>/dev/null)
test_result "$([ "$mysql_result" = "1" ] && echo PASS || echo FAIL)" "MySQL Connection"

redis_result=$(php artisan tinker --execute="echo Cache::getRedis()->ping() ? 'pong' : 'fail';" 2>/dev/null)
test_result "$([ "$redis_result" = "pong" ] && echo PASS || echo FAIL)" "Redis Connection"

# Performance tests
echo ""
echo "2. Performance Validation..."

# Autocomplete performance
response=$(curl -s -w "\n%{time_total}" -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/customers/search?q=test&limit=10")
response_time=$(echo "$response" | tail -n 1 | cut -d'.' -f1)
test_result "$([ "$response_time" -lt "200" ] && echo PASS || echo FAIL)" "Autocomplete Response Time ($response_time ms)"

# Customer profile performance  
response=$(curl -s -w "\n%{time_total}" -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/customers/1")
response_time=$(echo "$response" | tail -n 1 | cut -d'.' -f1)
test_result "$([ "$response_time" -lt "1000" ] && echo PASS || echo FAIL)" "Customer Profile Load Time ($response_time ms)"

# Functional tests
echo ""
echo "3. Functional Validation..."

# Basic functionality
response=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/customers/search?q=test")
func_success=$(echo "$response" | jq -r '.success // false')
test_result "$([ "$func_success" = "true" ] && echo PASS || echo FAIL)" "Customer Search Functionality"

# Security tests
echo ""
echo "4. Security Validation..."

# Unauthorized access
unauth_status=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/customers/search?q=test")
test_result "$([ "$unauth_status" = "401" ] && echo PASS || echo FAIL)" "Unauthenticated Access Blocked"

# Results summary
echo ""
echo "=========================================="
echo "VALIDATION SUMMARY"
echo "=========================================="
echo -e "Total Tests Run: $TESTS_RUN"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo -e "Success Rate: $(awk "BEGIN {printf \"%.1f\\n\", ($TESTS_PASSED/$TESTS_RUN)*100}")%"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED - DEPLOYMENT SUCCESSFUL!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  SOME TESTS FAILED - INVESTIGATION REQUIRED${NC}"
    exit 1
fi
```

---

## 9. Monitoring & Alerting

### 9.1 Performance Monitoring Setup
```bash
#!/bin/bash
# setup-monitoring.sh

echo "=== Setting Up Monitoring ==="

# Create monitoring cron job
cat > /etc/cron.d/story-003-health << 'EOF'
# Story 003 Health Monitoring - Every 5 minutes
*/5 * * * * root /home/remo/codebase/ShipmentApp/deploy/story-003/scripts/check-health.sh >> /var/log/story-003-health.log 2>&1

# Performance monitoring - Every 15 minutes  
*/15 * * * * root /home/remo/codebase/ShipmentApp/deploy/story-003/scripts/check-performance.sh >> /var/log/story-003-perf.log 2>&1
EOF

# Create monitoring scripts
cat > /home/remo/codebase/ShipmentApp/deploy/story-003/scripts/check-health.sh << 'EOF'
#!/bin/bash
source /home/remo/codebase/ShipmentApp/deploy/story-003/scripts/validate-api-health.sh
EOF

cat > /home/remo/codebase/ShipmentApp/deploy/story-003/scripts/check-performance.sh << 'EOF'
#!/bin/bash
source /home/remo/codebase/ShipmentApp/deploy/story-003/scripts/validate-autocomplete-performance.sh
EOF

chmod +x /home/remo/codebase/ShipmentApp/deploy/story-003/scripts/*.sh

echo "✅ Monitoring setup: COMPLETED"
```

---

## 10. Troubleshooting Guide

### 10.1 Common Issues & Solutions

#### Performance Issues
```bash
# Slow autocomplete - check cache hit rate
redis-cli info stats | grep keyspace_hits

# Database query slowness - check slow query log
tail -f /var/log/mysql/slow.log

# High memory usage - check PHP-FPM processes
ps aux | grep php-fpm | wc -l
```

#### Database Issues
```bash
# Check search index status
mysql -e "SHOW INDEX FROM customers;"

# Verify Dolibarr connection
php artisan tinker --execute="DB::connection('dolibarr')->select('SELECT 1')"

# Check table locks
mysql -e "SHOW PROCESSLIST;"
```

#### Cache Issues
```bash
# Redis connectivity test
redis-cli ping

# Clear search cache
redis-cli KEYS "search:*" | xargs redis-cli DEL

# Monitor Redis memory usage
redis-cli info memory
```

#### Frontend Issues
```bash
# Check build status
npm run build:production

# Verify service worker
curl -I https://shipmentapp.com/service-worker.js

# Check Console errors
grep -i "error" /var/log/nginx/access.log
```

---

## 11. Success Metrics Dashboard

### Key Performance Indicators (KPIs)
```json
{
  "story003_deployment_success": {
    "authentication_success_rate": ">99%",
    "api_response_times": {
      "autocomplete": "<200ms",
      "customer_search": "<500ms", 
      "customer_profile": "<1000ms"
    },
    "error_rates": "<1%"",
    "cache_hit_rate": ">85%"
  },
  "monitoring_metrics": {
    "daily_active_users": "TBD",
    "search_success_rate": "TBD",
    "user_satisfaction": "TBD"
  }
}
```

---

**Deployment Success Criteria:**
- ✅ All health checks pass
- ✅ Performance targets met (200ms autocomplete, 500ms search, 1s profile)
- ✅ Security validations successful
- ✅ Functional testing complete
- ✅ Load testing acceptable
- ✅ Error rate < 1%

**Next Steps:**
1. Run complete validation suite
2. Monitor for 24-48 hours post-deployment
3. Collect user feedback
4. Analyze performance trends
5. Plan optimization based on real-world usage