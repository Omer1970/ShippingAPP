# Story 003: Customer Search and Profile Management
# Deployment Checklist

**Story ID:** STORY-003  
**Status:** QA PASS - Ready for Production  
**Deployment Date:** ___/___/____  
**Deployer:** _____________________  
**QA Approval:** Quinn - September 12, 2025  

---

## 1. Pre-Deployment Infrastructure Checks

### 1.1 Server Requirements Verification

#### Backend Server Requirements
- [ ] **PHP Version:** 8.1+ verified on production server
- [ ] **Laravel Version:** 10+ compatibility confirmed
- [ ] **MySQL Version:** 8.0+ with full-text search support
- [ ] **Redis Version:** 6.0+ with clustering support (if applicable)
- [ ] **Nginx Version:** 1.20+ with PHP-FPM configuration
- [ ] **Available RAM:** Minimum 4GB, recommended 8GB+
- [ ] **Disk Space:** Minimum 20GB free space (logs, cache, uploads)
- [ ] **CPU Cores:** Minimum 2 cores, recommended 4+ cores

#### Frontend Server Requirements
- [ ] **Node.js Version:** 18.x LTS installed
- [ ] **Angular CLI Version:** 16+ available
- [ ] **Build Tools:** npm/yarn package manager
- [ ] **CDN Configuration:** Static asset delivery ready

### 1.2 Database Connectivity
- [ ] **MySQL Master:** Primary database connectivity verified
- [ ] **MySQL Read Replica:** Secondary database connectivity verified
- [ ] **Redis Cluster:** Cache/queue connectivity established
- [ ] **Dolibarr ERP:** PostgreSQL connection to Dolibarr database verified

### 1.3 Network & Security
- [ ] **Firewall Rules:** Port 443 (HTTPS), 80 (HTTP), 3306 (MySQL if internal), 6379 (Redis if internal)
- [ ] **SSL Certificates:** Valid certificates installed and auto-renewal configured
- [ ] **CDN Configuration:** Static asset caching configured (24-hour TTL)
- [ ] **Rate Limiting:** Configured at reverse proxy level (120 requests/minute for search)

---

## 2. Environment Configuration Setup

### 2.1 Environment Variables

#### Backend Environment (.env.production)
```bash
# Copy from staging environment and verify changes:
cp .env.staging .env.production

# Critical variables to verify:
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.shipmentapp.com

# Database connections
DB_CONNECTION=mysql
DB_HOST=mysql-master.internal
DB_PORT=3306
DB_DATABASE=shipmentapp
DB_USERNAME=app_user

# Redis configuration
REDIS_HOST=redis-cluster.internal
REDIS_PASSWORD=redis_password
REDIS_PORT=6379

# Dolibarr ERP integration
DOLIBARR_DB_HOST=dolibarr-db.internal
DOLIBARR_DB_DATABASE=dolibarr
DOLIBARR_DB_USERNAME=readonly_user

# Security settings
SANCTUM_STATEFUL_DOMAINS=shipmentapp.com,api.shipmentapp.com
SESSION_DOMAIN=.shipmentapp.com
```

#### Frontend Environment
```bash
# Environment production file
export environment='production'
export apiUrl='https://api.shipmentapp.com'
export searchDebounceMs='300'
export cacheTimeoutMs='300000'
export maxAutocompleteResults='10'
export maxSearchResults='50'
```

### 2.2 Configuration Files
- [ ] **Laravel Configuration:** Run `php artisan config:cache` after deployment
- [ ] **Search Configuration:** `backend/config/search.php` verified with production values
- [ ] **Frontend Build:** Environment-specific build configuration applied
- [ ] **Nginx Configuration:** API routes and static file serving configured

---

## 3. Database Deployment Steps

### 3.1 Schema Migration
```bash
# Execute migration on production database
cd /var/www/html/backend
php artisan migrate --force

# Verify migration success
php artisan migrate:status
```

### 3.2 Search Index Setup
```bash
# Create or update search indexes
php artisan scout:import "App\Models\Customer"

# Verify index creation  
php artisan tinker
>>> \App\Models\Customer::searchable()->count()
```

### 3.3 Data Validation
- [ ] **Customer Table:** Verify Dolibarr sync data integrity
- [ ] **Search Index:** Confirm full-text search functionality
- [ ] **Foreign Key Relationships:** Validate all constraints
- [ ] **Performance:** Check query execution times on production data

---

## 4. Backend Deployment Process

### 4.1 Code Deployment
```bash
# Deploy backend code
cd /var/www/html/backend
git pull origin main

# Install/Update dependencies
composer install --no-dev --optimize-autoloader

# Set proper permissions
chown -R www-data:www-data /var/www/html/backend
chmod -R 755 /var/www/html/backend
chmod -R 775 /var/www/html/backend/storage
```

### 4.2 Service Configuration
```bash
# Cache configuration (run after .env update)
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Queue worker restart
sudo systemctl restart supervisor
# or
sudo systemctl restart queue-worker
```

### 4.3 API Validation
- [ ] **Health Check:** `GET /api/health` returns 200 status
- [ ] **Authentication Test:** Verify Sanctum token validation
- [ ] **Database Connection:** All database queries successful
- [ ] **Redis Connectivity:** Cache operations working

---

## 5. Frontend Deployment Process

### 5.1 Build Process
```bash
# Deploy frontend code
cd /var/www/html/frontend
git pull origin main

# Install dependencies
npm install

# Production build
npm run build:production

# Verify build output
ls -la dist/
```

### 5.2 Asset Deployment
```bash
# Upload to CDN or serve directly
# If CDN configured:
aws s3 sync dist/ s3://shipmentapp-cdn/ --delete
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"

# Or copy to web server
cp -r dist/* /var/www/html/public/
```

### 5.3 Service Worker Update
- [ ] **Cache Busting:** Verify service worker cache invalidation
- [ ] **PWA Functionality:** Test offline capabilities if implemented
- [ ] **Asset Integrity:** Check all static assets load correctly

---

## 6. Integration System Deployment

### 6.1 Dolibarr ERP Integration
```bash
# Verify database connection
php artisan tinker
>>> DB::connection('dolibarr')->select('SELECT COUNT(*) FROM llx_societe')

# Test customer sync service
php artisan customers:sync --test-mode
```

### 6.2 Redis Configuration
```bash
# Verify Redis connectivity
redis-cli ping
# Should return: PONG

# Check cache performance
redis-cli info stats
```

### 6.3 Search Service Indexing
```bash
# Build search index if not already done
php artisan search:reindex-customers

# Verify search functionality
php artisan tinker
>>> \App\Services\CustomerSearchService::search('test customer')->count()
```

---

## 7. Security Hardening

### 7.1 Authentication & Authorization
- [ ] **Rate Limiting:** Verify 120 requests/minute on `/api/customers/*` endpoints
- [ ] **CORS Configuration:** Proper allowed origins configured
- [ ] **Sanctum Middleware:** Authentication active on all protected endpoints
- [ ] **Role-Based Access:** Verify user role filtering in customer queries

### 7.2 Input Validation
- [ ] **SQL Injection Prevention:** Prepared statements verified
- [ ] **XSS Protection:** Output escaping in API responses
- [ ] **Request Validation:** Laravel validation rules active
- [ ] **Search Query Sanitization:** Special character filtering tested

### 7.3 Audit & Logging
- [ ] **Access Logging:** Customer profile access logged with user ID
- [ ] **Search Logging:** Search queries logged for analytics
- [ ] **Error Monitoring:** Application errors captured in logs
- [ ] **Security Headers:** CSP, HSTS, X-Frame-Options configured

---

## 8. Performance Optimization

### 8.1 Response Time Verification
- [ ] **Autocomplete Response:** <200ms target on production data
- [ ] **Customer Search:** <500ms target on production data  
- [ ] **Profile Loading:** <1s including order/shipment history
- [ ] **Cache Hit Rate:** >85% for frequent autocomplete queries

### 8.2 Database Performance
- [ ] **Query Optimization:** Execution plans verified for slow queries
- [ ] **Index Usage:** Check MySQL slow query log (< 1% slow queries)
- [ ] **Connection Pooling:** Database connections not exceeding limits
- [ ] **Full-Text Search:** MySQL FULLTEXT indexes performing optimally

### 8.3 Frontend Performance
- [ ] **Bundle Size:** <500KB for main JavaScript bundle
- [ ] **Lazy Loading:** Feature modules loaded on-demand
- [ ] **Asset Compression:** Gzip/Brotli compression active
- [ ] **Critical CSS:** Inline critical styles, defer non-critical

---

## 9. Functionality Tests

### 9.1 Core Functionality
- [ ] **Customer Search:** Returns relevant results for various queries
- [ ] **Autocomplete:** 10 relevant suggestions within 200ms
- [ ] **Customer Profile:** Complete data including orders/shipments
- [ ] **Advanced Filtering:** Multi-criteria search working correctly

### 9.2 Mobile Functionality
- [ ] **Voice Search:** Speech-to-text working on supported devices
- [ ] **Touch Interface:** Mobile-optimized autocomplete behavior
- [ ] **Keyboard Handling:** Virtual keyboard optimizations active
- [ ] **Responsive Design:** UI adapts to mobile screen sizes

### 9.3 Accessibility
- [ ] **ARIA Labels:** Screen reader compatible interface
- [ ] **Keyboard Navigation:** Tab order and focus management
- [ ] **Color Contrast:** WCAG 2.1 AA compliance
- [ ] **Error Messaging:** Clear, descriptive error messages

---

## 10. Post-Deployment Validation

### 10.1 Immediate Health Checks (0-15 minutes)
```bash
# Check application status
curl -f https://api.shipmentapp.com/api/health

# Test customer search endpoint  
curl -H "Authorization: Bearer $DA_TOKEN" \
  "https://api.shipmentapp.com/api/customers/search?q=test&limit=5"

# Validate database connectivity
php artisan tinker --execute="echo 'DB Connected: ' . DB::select('SELECT 1')[0]->{'1'}"

# Verify Redis connectivity  
php artisan tinker --execute="echo 'Redis: ' . (Cache::getRedis()->ping() ? 'OK' : 'FAIL')"
```

### 10.2 Extended Monitoring (15-60 minutes)
- [ ] **User Acceptance:** Monitor initial user feedback
- [ ] **Error Rates:** Watch for increased application errors
- [ ] **Performance Metrics:** Monitor response time trends
- [ ] **User Session Analytics:** Verify user engagement metrics

### 10.3 Final Validation
- [ ] **Smoke Tests:** Run comprehensive test suite
- [ ] **Load Testing:** Validate performance under expected load
- [ ] ** Security Scanning:** Run automated security tests
- [ ] **Rollback Plan:** Confirm rollback procedures tested

---

## 11. Rollback Plan

### 11.1 Database Rollback
```bash
# If database migration needs rollback:
php artisan migrate:rollback --step=1 --force

# Restore search index if corrupted
php artisan search:reindex-customers --force
```

### 11.2 Code Rollback
```bash
# Revert to previous Git commit
git checkout previous-stable-commit
git reset --hard previous-stable-commit

# Restart services
sudo systemctl restart nginx
sudo systemctl restart php-fpm
```

### 11.3 Rollback Triggers
- Critical functionality failures affecting customer experience
- Performance degradation exceeding 2x baseline response times
- Security vulnerabilities discovered post-deployment
- Integration failures with Dolibarr ERP system

---

## 12. Success Criteria

### 12.1 Technical Metrics
- [ ] **Zero Critical Errors:** No 500 errors in first 24 hours
- [ ] **Performance Targets:** All response times within requirements
- [ ] **Uptime:** 99.9% availability in first week
- [ ] **Security:** No security scan failures

### 12.2 Business Metrics
- [ ] **User Adoption:** 80%+ of users successfully use search within first week
- [ ] **Search Success Rate:** 95%+ of searches return relevant results
- [ ] **Customer Satisfaction:** Positive user feedback collection
- [ ] **Performance Monitoring:** All KPIs meeting or exceeding targets

---

## 13. Sign-Off

### Deployment Team
- [ ] **Backend Lead:** _____________________ Date: _______
- [ ] **Frontend Lead:** _____________________ Date: _______
- [ ] **DevOps Engineer:** _____________________ Date: _______
- [ ] **QA Lead:** _____________________ Date: _______

### Stakeholder Approval
- [ ] **Product Manager:** _____________________ Date: _______
- [ ] **Operations Manager:** _____________________ Date: _______

### Final Status
- [ ] **Deployment Status:** _____________________
- [ ] **Performance Verification:** _____________________
- [ ] **Issue Resolution:** _____________________
- [ ] **Production Sign-Off:** _____________________ Date: _______

---

**Notes:**
- Complete this checklist during deployment process
- Document any deviations or issues encountered
- Update status in project management system
- Schedule post-deployment review meeting
- Archive completed checklist with deployment documentation

**Critical Escalation:**
If any critical issue is discovered during deployment:
1. Immediately implement rollback procedure
2. Notify on-call engineer and product manager
3. Document issue in ticketing system with highest priority
4. Schedule emergency review meeting