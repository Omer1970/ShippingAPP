# ShipmentApp Testing Guidelines

## Testing Framework Overview

### Backend (Laravel/PHP)
- **Unit Testing**: PHPUnit 10.x
- **Feature Testing**: Laravel's built-in testing tools
- **Test Location**: `/backend/tests/`
- **Coverage**: Feature and Unit test directories available

### Frontend (Angular/TypeScript)
- **Unit Testing**: Karma + Jasmine
- **E2E Testing**: Protractor
- **Test Location**: `/frontend/src/`
- **Configuration**: Angular CLI test configurations

## Running Tests

### Backend Testing
```bash
# Run all tests
docker-compose exec backend php artisan test

# Run with coverage
docker-compose exec backend php artisan test --coverage

# Run specific feature test
docker-compose exec backend php artisan test tests/Feature/AuthTest.php

# Run specific unit test
docker-compose exec backend php artisan test tests/Unit/YourTest.php

# Run tests in parallel (if configured)
docker-compose exec backend php artisan test --parallel

# Generate coverage report
docker-compose exec backend php artisan test --coverage-html coverage/
```

### Frontend Testing
```bash
# Run all unit tests (from project root)
docker-compose exec frontend ng test

# Run tests in watch mode
docker-compose exec frontend ng test --watch

# Run with coverage
docker-compose exec frontend ng test --code-coverage

# Run specific test file
docker-compose exec frontend ng test --include='**/app.component.spec.ts'

# Run e2e tests
docker-compose exec frontend npm run e2e

# Run specific e2e test suite
docker-compose exec frontend npm run e2e:auth
docker-compose exec frontend npm run e2e:security
docker-compose exec frontend npm run e2e:integration

# Run all e2e tests
docker-compose exec frontend npm run e2e:all
```

## Test Organization

### Backend Test Structure
```
backend/tests/
├── Feature/
│   ├── AuthTest.php           # Authentication endpoints
│   ├── DolibarrAuthTest.php   # ERP authentication integration
│   └── DolibarrSyncTest.php   # ERP data synchronization
└── Unit/
    └── (Unit test files)
```

### Frontend Test Structure
```
frontend/src/
└── app/
    ├── core/
    │   ├── services/        # Business logic tests
    │   ├── guards/          # Route protection tests
    │   └── interceptors/    # HTTP interceptor tests
    ├── features/
    │   └── auth/            # Authentication component tests
    └── shared/              # Utility and helper tests
```

## Test Writing Guidelines

### Backend Best Practices
1. **Feature Tests**: Test complete user workflows
2. **Unit Tests**: Test individual methods and functions
3. **Database**: Use in-memory SQLite or test database
4. **Fixtures**: Use factories for test data creation
5. **Mocking**: Mock external services (Dolibarr API)

### Frontend Best Practices
1. **Component Tests**: Test component behavior and templates
2. **Service Tests**: Test business logic and API integration
3. **Integration Tests**: Test service-component interactions
4. **Mocking**: Mock API calls and external dependencies
5. **State Management**: Test authentication state handling

## Test Environment Configuration

### Backend Test Environment
```bash
# Set test environment
cp backend/.env.example backend/.env.testing

# Configure test database (SQLite in-memory)
DB_CONNECTION=sqlite
DB_DATABASE=:memory:

# Run migrations for tests
docker-compose exec backend php artisan migrate --env=testing
```

### Frontend Test Environment
```bash
# Test configuration in angular.json
# Environment files for testing in src/environments/
# Karma configuration: karma.conf.js
# Protractor configuration: protractor.conf.js
```

## Continuous Integration Testing

### Git Pre-commit Hooks (if configured)
```bash
# Run both backend and frontend tests
php artisan test && npm test
```

### Docker-based Testing
```bash
# Run all project tests
docker-compose exec backend php artisan test & docker-compose exec frontend ng test

# Run with coverage reports
docker-compose exec backend php artisan test --coverage & docker-compose exec frontend ng test --code-coverage
```

## Test Reporting and Coverage

### Backend Coverage Reports
```bash
# Generate HTML coverage report
docker-compose exec backend php artisan test --coverage-html coverage/

# View coverage metrics
docker-compose exec backend php artisan test --coverage --min=80

# Coverage report location
backend/coverage/index.html
```

### Frontend Coverage Reports
```bash
# Enable coverage in karma.conf.js
# Coverage reports generated in frontend/coverage/

# View coverage report
open frontend/coverage/index.html
```

## Common Testing Tasks

### Testing Authentication Flow
```bash
# Backend auth tests
docker-compose exec backend php artisan test tests/Feature/AuthTest.php

# Frontend auth component tests
docker-compose exec frontend ng test --include='**/auth*.spec.ts'

# E2E auth flow tests
docker-compose exec frontend npm run e2e:auth
```

### Testing API Endpoints
```bash
# Test specific API endpoint
docker-compose exec backend php artisan test --filter="test_user_can_login"

# Test API error handling
docker-compose exec backend php artisan test tests/Feature/ErrorHandlingTest.php
```

### Testing Database Operations
```bash
# Test database migrations
docker-compose exec backend php artisan migrate:fresh --seed
docker-compose exec backend php artisan test --filter="*database*"
```

## Debugging Tests

### Backend Debugging
```bash
# Run single test with verbose output
docker-compose exec backend php artisan test --filter="specific_test_name" -vvv

# Use dd() or var_dump() in test methods
# Enable test database query logging
```

### Frontend Debugging
```bash
# Run tests with detailed output
docker-compose exec frontend ng test --reporters=verbose

# Debug specific test
docker-compose exec frontend ng test --include='**/*spec.ts' --reporters=progress

# Use browser dev tools during test execution
# Add debugger statements in test files
```

## Performance Testing

### Backend Performance
```bash
# Benchmark API endpoints
docker-compose exec backend php artisan test --benchmark

# Memory usage testing
docker-compose exec backend php artisan test --memory-events
```

### Frontend Performance
```bash
# Build performance test
docker-compose exec frontend npm run build --stats-json
# Analyze with webpack-bundle-analyzer
```

## Security Testing

### API Security Tests
```bash
# Test authentication bypass attempts
docker-compose exec backend php artisan test tests/Feature/SecurityTest.php

# Test rate limiting
docker-compose exec backend php artisan test tests/Feature/RateLimitTest.php
```

### Frontend Security Tests
```bash
# Test XSS protection
docker-compose exec frontend npm run e2e:security

# Test CSRF protection (if applicable)
docker-compose exec frontend ng test --include='*security*.spec.ts'
```