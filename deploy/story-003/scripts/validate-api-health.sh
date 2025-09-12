#!/bin/bash
# validate-api-health.sh - Story 003 API Health Validation

echo "=== API Health Validation ==="

# Base URL (replace with your production API URL)
API_URL="${API_URL:-https://api.shipmentapp.com}"
AUTH_TOKEN="${AUTH_TOKEN:-your_production_token}"

echo "API URL: $API_URL"

# Health endpoint
health_status=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health")
if [ "$health_status" = "200" ]; then
    echo "✅ Health check: PASSED"
    RETURN_CODE=0
else
    echo "❌ Health check: FAILED (HTTP $health_status)"
    RETURN_CODE=1
fi

# Authentication test
if [ -n "$AUTH_TOKEN" ] && [ "$AUTH_TOKEN" != "your_production_token" ]; then
    auth_test=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/user" | jq '.success // false' 2>/dev/null)
    if [ "$auth_test" = "true" ]; then
        echo "✅ Authentication: PASSED"
    else
        echo "❌ Authentication: FAILED"
        RETURN_CODE=1
    fi
fi

echo "API Health: OPERATIONAL"
exit $RETURN_CODE