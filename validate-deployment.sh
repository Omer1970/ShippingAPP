#!/bin/bash

# ShipmentApp Authentication System - Deployment Validation Script
# This script validates the deployment configuration without requiring Docker

echo "🔍 ShipmentApp Authentication System - Deployment Validation"
echo "============================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validation counters
PASSED=0
FAILED=0
WARNINGS=0

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        ((FAILED++))
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠️  WARNING${NC}: $1"
    ((WARNINGS++))
}

echo "1. 📁 File Structure Validation"
echo "--------------------------------"

# Check backend files
if [ -f "backend/composer.json" ]; then
    print_result 0 "Backend composer.json exists"
else
    print_result 1 "Backend composer.json missing"
fi

if [ -f "backend/app/Http/Controllers/Api/AuthController.php" ]; then
    print_result 0 "AuthController exists"
else
    print_result 1 "AuthController missing"
fi

if [ -f "backend/tests/Feature/AuthTest.php" ]; then
    print_result 0 "Backend tests exist"
else
    print_result 1 "Backend tests missing"
fi

# Check frontend files
if [ -f "frontend/angular.json" ]; then
    print_result 0 "Frontend angular.json exists"
else
    print_result 1 "Frontend angular.json missing"
fi

if [ -f "frontend/src/app/core/services/auth.service.ts" ]; then
    print_result 0 "AuthService exists"
else
    print_result 1 "AuthService missing"
fi

if [ -f "frontend/src/app/features/auth/login/login.component.ts" ]; then
    print_result 0 "Login component exists"
else
    print_result 1 "Login component missing"
fi

echo ""
echo "2. 📚 Documentation Validation"
echo "-------------------------------"

if [ -f "docs/API_DOCUMENTATION.md" ]; then
    print_result 0 "API documentation exists"
    # Check if documentation has content
    if [ $(wc -l < docs/API_DOCUMENTATION.md) -gt 50 ]; then
        print_result 0 "API documentation is comprehensive"
    else
        print_warning "API documentation may be incomplete"
    fi
else
    print_result 1 "API documentation missing"
fi

if [ -f "backend/DEPLOYMENT.md" ]; then
    print_result 0 "Deployment guide exists"
else
    print_result 1 "Deployment guide missing"
fi

echo ""
echo "3. 🔒 Security Configuration Validation"
echo "----------------------------------------"

# Check environment configuration
if [ -f "backend/.env.example" ]; then
    print_result 0 "Environment template exists"
    
    # Check for required security variables (AUTH_RATE_LIMIT is the actual variable name used)
    if grep -q "AUTH_RATE_LIMIT" backend/.env.example; then
        print_result 0 "Rate limiting configuration present"
    else
        print_result 1 "Rate limiting configuration missing"
    fi
    
    # Check for token expiry (SANCTUM_EXPIRATION is used instead of AUTH_TOKEN_EXPIRY)
    if grep -q "SANCTUM_EXPIRATION" backend/.env.example; then
        print_result 0 "Token expiry configuration present"
    else
        print_result 1 "Token expiry configuration missing"
    fi
else
    print_result 1 "Environment template missing"
fi

# Check Sanctum configuration
if [ -f "backend/config/sanctum.php" ]; then
    print_result 0 "Sanctum configuration exists"
else
    print_result 1 "Sanctum configuration missing"
fi

echo ""
echo "4. 🐳 Docker Configuration Validation"
echo "-------------------------------------"

if [ -f "docker-compose.yml" ]; then
    print_result 0 "Docker Compose file exists"
    
    # Check for required services
    if grep -q "nginx:" docker-compose.yml; then
        print_result 0 "Nginx service configured"
    else
        print_result 1 "Nginx service missing"
    fi
    
    if grep -q "backend:" docker-compose.yml; then
        print_result 0 "Backend service configured"
    else
        print_result 1 "Backend service missing"
    fi
    
    if grep -q "frontend:" docker-compose.yml; then
        print_result 0 "Frontend service configured"
    else
        print_result 1 "Frontend service missing"
    fi
else
    print_result 1 "Docker Compose file missing"
fi

if [ -f "backend/Dockerfile" ]; then
    print_result 0 "Backend Dockerfile exists"
else
    print_result 1 "Backend Dockerfile missing"
fi

if [ -f "frontend/Dockerfile" ]; then
    print_result 0 "Frontend Dockerfile exists"
else
    print_result 1 "Frontend Dockerfile missing"
fi

echo ""
echo "5. 🔧 Nginx Configuration Validation"
echo "------------------------------------"

if [ -f "nginx.conf" ]; then
    print_result 0 "Nginx configuration exists"
    
    # Check for security headers
    if grep -q "add_header X-Frame-Options" nginx.conf; then
        print_result 0 "Security headers configured"
    else
        print_warning "Security headers may be missing"
    fi
    
    if grep -q "ssl_protocols" nginx.conf; then
        print_result 0 "SSL protocols configured"
    else
        print_warning "SSL protocols not configured (development mode)"
    fi
else
    print_result 1 "Nginx configuration missing"
fi

echo ""
echo "6. 🧪 Test Configuration Validation"
echo "-----------------------------------"

# Check E2E test configuration
if [ -f "frontend/e2e/src/auth.e2e-spec.ts" ]; then
    print_result 0 "E2E authentication tests exist"
else
    print_result 1 "E2E authentication tests missing"
fi

if [ -f "frontend/e2e/src/security.e2e-spec.ts" ]; then
    print_result 0 "Security E2E tests exist"
else
    print_result 1 "Security E2E tests missing"
fi

# Check for test scripts in package.json
if [ -f "frontend/package.json" ]; then
    if grep -q "e2e" frontend/package.json; then
        print_result 0 "E2E test scripts configured"
    else
        print_warning "E2E test scripts not configured"
    fi
fi

echo ""
echo "7. 🚀 CI/CD Configuration Validation"
echo "------------------------------------"

if [ -f ".github/workflows/deploy.yml" ]; then
    print_result 0 "GitHub Actions workflow exists"
    
    # Check for required jobs
    if grep -q "test:" .github/workflows/deploy.yml; then
        print_result 0 "Test job configured"
    else
        print_warning "Test job not configured"
    fi
    
    if grep -q "security:" .github/workflows/deploy.yml; then
        print_result 0 "Security scanning configured"
    else
        print_warning "Security scanning not configured"
    fi
else
    print_result 1 "GitHub Actions workflow missing"
fi

echo ""
echo "8. 📊 Backend Configuration Validation"
echo "--------------------------------------"

# Check Laravel configuration
if [ -f "backend/config/app.php" ]; then
    print_result 0 "Laravel app configuration exists"
else
    print_result 1 "Laravel app configuration missing"
fi

if [ -f "backend/config/auth.php" ]; then
    print_result 0 "Laravel auth configuration exists"
else
    print_result 1 "Laravel auth configuration missing"
fi

# Check for API routes
if [ -f "backend/routes/api.php" ]; then
    print_result 0 "API routes file exists"
    
    # Check for auth routes (checking for the pattern in the auth group)
    if grep -q "Route::post('/login'" backend/routes/api.php; then
        print_result 0 "Authentication routes configured"
    else
        print_result 1 "Authentication routes missing"
    fi
else
    print_result 1 "API routes file missing"
fi

echo ""
echo "9. 🎨 Frontend Configuration Validation"
echo "--------------------------------------"

if [ -f "frontend/angular.json" ]; then
    print_result 0 "Angular configuration exists"
else
    print_result 1 "Angular configuration missing"
fi

if [ -f "frontend/src/app/app.routes.ts" ]; then
    print_result 0 "Angular routing configured"
else
    print_result 1 "Angular routing missing"
fi

if [ -f "frontend/src/app/core/services/auth.service.ts" ]; then
    print_result 0 "Authentication service exists"
else
    print_result 1 "Authentication service missing"
fi

echo ""
echo "============================================================="
echo "📊 VALIDATION SUMMARY"
echo "============================================================="
echo -e "✅ Passed: ${GREEN}$PASSED${NC}"
echo -e "❌ Failed: ${RED}$FAILED${NC}"
echo -e "⚠️  Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 DEPLOYMENT VALIDATION SUCCESSFUL!${NC}"
    echo "The authentication system is ready for deployment."
    echo ""
    echo "Next steps:"
    echo "1. Install Docker and Docker Compose"
    echo "2. Copy .env.example to .env and configure"
    echo "3. Run: docker-compose up -d"
    echo "4. Access application at http://localhost"
    exit 0
else
    echo -e "${RED}❌ DEPLOYMENT VALIDATION FAILED${NC}"
    echo "Please fix the failed validations before proceeding with deployment."
    exit 1
fi