# Story 003: Customer Search and Profile Management

**Epic:** Epic 002 - Search & Customer Management (Phase 2)  
**Status:** Pending Implementation  
**Frontend Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 8 points  
**Assigned to:** Unassigned  

---

## Goal & Context

**What:** Implement comprehensive customer search functionality with autocomplete, detailed customer profiles, and complete order/shipment history integration, along with advanced filtering capabilities for enhanced data discovery.

**Why:** Users need rapid access to customer information to provide exceptional service, understand customer history, and make informed delivery decisions. This functionality enables the core customer-centric workflow that differentiates ShipmentApp from basic delivery tools.

**Epic Context:** This is the third story in the product development and represents the first Phase 2 feature set. It builds on Stories 001 and 002, adding customer-focused search capabilities critical for the value proposition.

**Dependencies:** Stories 001 and 002 must be completed (authentication and basic shipment/order listing) as this story requires those data foundations

---

## Technical Implementation

### Key Files to Create/Modify

**Backend (Laravel):**
- `app/Http/Controllers/Api/CustomerController.php` - New controller for customer search endpoints
- `app/Http/Controllers/Api/SearchController.php` - Search aggregation controller
- `app/Services/CustomerSearchService.php` - Advanced customer search with autocomplete
- `app/Services/DolibarrCustomerService.php` - Enhanced service for fetching customer data from Dolibarr
- `app/Models/Customer.php` - Customer data model with search relationships
- `app/Http/Resources/CustomerResource.php` - Resource for customer API responses
- `app/Http/Resources/CustomerListResource.php` - Resource for customer list responses
- `app/Http/Resources/CustomerHistoryResource.php` - Resource for customer history data
- `config/search.php` - Search configuration and autocomplete settings
- `database/migrations/2025_09_12_120000_create_customer_search_index_table.php` - Search indexing table

**Frontend (Angular):**
- `src/app/core/services/customer.service.ts` - Service for customer data management and search
- `src/app/core/services/search.service.ts` - Global search service with autocomplete
- `src/app/features/customer-search/` - Customer search feature module
- `src/app/features/customer-profile/` - Customer profile view component
- `src/app/shared/components/search-autocomplete/` - Reusable autocomplete component
- `src/app/shared/components/customer-card/` - Customer information card component
- `src/app/core/models/customer.model.ts` - Customer interface definitions
- `src/app/core/models/search.model.ts` - Search result interface definitions
- `src/app/shared/pipes/customer-highlight.pipe.ts` - Search result highlighting pipe

### Technology Requirements

**Backend Stack:**
- Laravel 10+ with PHP 8.1+
- Laravel Sanctum for API authentication (reuse existing)
- Laravel Scout for search functionality with MySQL driver
- Redis for autocomplete caching and search result caching
- MySQL for customer data storage and search indexing
- PostgreSQL for Dolibarr ERP connection (read-only)

**Frontend Stack:**
- Angular 16+ with TypeScript
- Angular Material for UI components with autocomplete
- RxJS for reactive search and debouncing
- Angular HttpClient for API communication
- Angular CDK for advanced overlay positioning

### API Specifications

**Customer Search Endpoints:**
- `GET /api/customers/search?q={query}` - Autocomplete customer search (returns top 10)
- `GET /api/customers/{id}` - Get full customer profile with order/shipment history
- `GET /api/customers/{id}/orders` - Get customer order history with pagination
- `GET /api/customers/{id}/shipments` - Get customer shipment history with pagination
- `GET /api/customers/{id}/stats` - Get customer statistics and metrics
- `GET /api/search?type=customer&q={query}` - Global search with type filtering

**Advanced Search Endpoints:**
- `POST /api/search/advanced` - Advanced search with multiple filters
- `GET /api/filters/customers` - Get available filter options for customers
- `GET /api/search/suggestions?q={query}` - Search suggestions across all data types

**Request/Response Format:**
```json
{
    "success": true,
    "data": {
        "customers": [
            {
                "id": 1,
                "dolibarr_customer_id": 12345,
                "name": "ABC Corporation",
                "email": "orders@abc-corp.com",
                "phone": "+1-555-123-4567",
                "address": "123 Business Park, Suite 400, Dallas, TX 75201",
                "customer_type": "Corporate",
                "credit_status": "Active",
                "total_orders": 47,
                "total_shipments": 52,
                "last_order": "2025-09-10",
                "total_value": 28500.75,
                "search_score": 0.95
            }
        ],
        "autocomplete": {
            "suggestions": ["ABC Corporation", "ABC Consulting", "ABC Manufacturing"],
            "total_results": 3,
            "search_time_ms": 156
        }
    }
}
```

### Data Models

**Customer Model Requirements:**
- id (primary key)
- dolibarr_customer_id (int, required - ERP integration)
- name (string, required - customer name, indexed for search)
- email (string, optional - customer email)
- phone (string, optional - customer phone number)
- address (text, optional - customer address)
- customer_type (enum: Individual, Corporate, Small_Business, Government)
- credit_status (enum: Active, On_Hold, Suspended, Closed)
- payment_terms (string, optional - payment terms)
- tax_number (string, optional - tax identification)
- preferred_delivery_time (string, optional - delivery preferences)
- special_instructions (text, optional - delivery instructions)
- latitude (decimal, optional - GPS coordinates)
- longitude (decimal, optional - GPS coordinates)
- created_from_dolibarr (timestamp)
- last_synced (timestamp)
- search_vector (text, indexed - full-text search data)
- timestamps (created_at, updated_at, last_search_at)

**Customer Search Index Model:**
- id (primary key)
- customer_id (foreign key)
- search_terms (text, indexed - denormalized search data)
- search_metadata (json - additional searchable fields)
- popularity_weight (float - search popularity scoring)
- last_updated (timestamp)

### Integration Points

**Dolibarr ERP Integration:**
- **Customer Table**: Fetch from `llx_societe` table in Dolibarr
- **Customer Categories**: Join with `llx_categorie_societe` for customer categorization
- **Addresses**: Fetch from `llx_societe_address` for multiple delivery addresses
- **Contact Information**: Join with `llx_socpeople` for contact details
- **Payment Terms**: Join with `llx_cond_reglement` for payment information
- **Full-Text Indexing**: Build search vector from customer name, addresses, contacts
- **Real-time Sync**: Webhook-based updates for customer data changes
- **Search Cache**: Redis-cached search results (TTL: 5 minutes) for autocomplete

**Frontend-Backend Integration:**
- Angular services with reactive search using RxJS operators
- Type-ahead search with debouncing (300ms delay)
- Progressive loading for customer profiles (show basic info, then load history)
- Caching of recent searches in local storage
- Mobile-optimized search interface with virtual keyboard considerations
---

## Technical References

**Database Schema:** See `docs/architect/2-database-design-schema.md` for detailed table structures and search indexing
**API Specifications:** See `docs/architect/3-api-specifications.md#customer-search-endpoints` for complete API documentation
**Frontend Architecture:** See `docs/architect/6-frontend-architecture.md#search-and-autocomplete` for search implementation patterns

---

## Implementation Details

### Assumptions
- Dolibarr contains customer data in `llx_societe` table with comprehensive contact information
- Customer data contains names, addresses, emails, and phone numbers suitable for searching
- Search performance requires indexing for sub-2-second response times
- Mobile users need autocomplete for faster data entry on touch devices
- Customer history includes 12+ months of orders and shipments for comprehensive view
- Advanced filtering supports date ranges, status combinations, and location-based searches
- Search popularity tracking improves result relevance over time

### Security Requirements
- All search endpoints require authentication (reuse existing Sanctum)
- Users can only search customers they have permission to view
- Rate limiting on autocomplete endpoints (120 requests per minute)
- Search query validation to prevent injection attacks
- Customer data access restricted by role (drivers vs warehouse staff)
- No customer data caching in CDN or public caches
- Audit trail for customer profile access
- GDPR-compliant search logging with user consent

### Performance Requirements
- Autocomplete response time < 200ms (5x faster than 2s requirement)
- Customer search results < 500ms for all queries
- Customer profile load time < 1 second including history
- Advanced search with filtering < 2 seconds (per requirement)
- Search result caching with 85%+ hit rate for autocomplete
- Full-text search indexing for 50,000+ customer records
- Progressive loading for customer history (load basic info first)
- Database query optimization with proper indexing strategy

### Error Handling
- 401 Unauthorized for unauthenticated requests
- 403 Forbidden for unauthorized customer data access
- 404 Not Found for missing customers
- 422 Unprocessable Entity for invalid search queries
- 500 Internal Server Error for system failures
- Graceful handling of Dolibarr connectivity issues
- Cache fallback when primary search fails
- Clear error messages for frontend display

---

## Testing Strategy

### Unit Tests (Backend)
- `tests/Unit/CustomerSearchServiceTest.php` - Search algorithm testing
- `tests/Unit/DolibarrCustomerServiceTest.php` - Customer data service testing
- `tests/Feature/CustomerSearchTest.php` - Search API endpoint testing
- `tests/Feature/CustomerProfileTest.php` - Customer profile endpoint testing
- Test autocomplete performance under 200ms
- Test search relevance scoring algorithms
- Test advanced filtering combinations
- Test security and authorization rules

### Integration Tests (Frontend)
- `src/app/core/services/customer.service.spec.ts` - Customer service testing
- `src/app/core/services/search.service.spec.ts` - Search service testing
- `src/app/features/customer-search/customer-search.component.spec.ts` - Search component testing
- `src/app/shared/components/search-autocomplete/search-autocomplete.component.spec.ts` - Autocomplete component testing
- Test type-ahead search with debouncing
- Test mobile keyboard optimization
- Test search result highlighting
- Test accessibility implementation

### Manual Testing Scenarios
1. **Happy Path:** User searches for customer and finds complete profile within 2 seconds
2. **Autocomplete:** User types partial customer name and sees relevant suggestions
3. **Advanced Filtering:** User combines date range, status, and location filters
4. **Mobile Keyboard:** Search interface adapts to mobile keyboard behavior
5. **Empty Results:** System handles searches with no matching customers gracefully
6. **Large Dataset:** Performance remains acceptable with 50,000+ customers
7. **Connection Issues:** Search functionality handles temporary ERP disconnections
8. **Voice Input:** Search works with speech-to-text on mobile devices

### Success Criteria
- Customer search results appear within 2 seconds per requirement
- Autocomplete suggestions display within 200ms
- Complete customer profile loads within 1 second
- Advanced filtering returns results within 2 seconds
- Search history and recent items cached for offline access
- Mobile interface fully optimized for touch input
- Voice search integration on supported devices

---

## Acceptance Criteria

✅ **Functional Requirements:**
- [ ] Backend API provides customer search with autocomplete functionality
- [ ] Customer search returns top 10 relevant results within 2 seconds
- [ ] Autocomplete suggestions display within 200ms of typing
- [ ] Customer profile includes complete order history with pagination
- [ ] Customer profile includes complete shipment history with pagination
- [ ] Advanced filtering supports date range, status, location, and customer filters
- [ ] Search functionality accessible within 3 taps from main dashboard
- [ ] Mobile interface includes touch-optimized keyboard handling
- [ ] Search results highlight matching terms
- [ ] Voice input integration on supported mobile devices

✅ **Non-Functional Requirements:**
- [ ] Autocomplete response time < 200ms (10x improvement over requirement)
- [ ] Customer search response time < 500ms (4x improvement over requirement)
- [ ] Full customer profile load time < 1 second including history
- [ ] Advanced search with filtering < 2 seconds (according to requirement)
- [ ] Search result cache hit rate > 85% for frequent queries
- [ ] Mobile interface optimized for all target devices (iPhone, Android)
- [ ] Progressive loading maintains perceived performance
- [ ] Accessibility compliance (WCAG 2.1 AA) for search interface

✅ **Security Requirements:**
- [ ] All search endpoints require authentication
- [ ] Rate limiting prevents abuse (120 requests/minute for autocomplete)
- [ ] Customer data access restricted by user role and permissions
- [ ] Search queries validated to prevent injection attacks
- [ ] Customer access audit trail maintained
- [ ] GDPR-compliant search logging implemented

✅ **Integration Requirements:**
- [ ] Customer data syncs from Dolibarr `llx_societe` table
- [ ] Full-text search indexing includes customer details and addresses
- [ ] Real-time updates via webhooks for customer data changes
- [ ] Search vector updates automatically when customer data changes
- [ ] Redis caching implemented for search results

✅ **Testing Requirements:**
- [ ] Unit tests cover search algorithms with 95%+ coverage
- [ ] Integration tests validate API endpoints under load
- [ ] Frontend tests verify autocomplete behavior
- [ ] Performance tests validate response time requirements
- [ ] Security tests verify authorization and access controls
- [ ] Accessibility tests confirm WCAG 2.1 AA compliance

---

## Tasks

### Backend Implementation
- **Task 3.1:** Create Customer model with search indexing support
- **Task 3.2:** Implement DolibarrCustomerService for customer data fetching
- **Task 3.3:** Create CustomerSearchService with autocomplete algorithms
- **Task 3.4:** Build search indexing system with MySQL full-text search
- **Task 3.5:** Implement CustomerController with search and profile endpoints
- **Task 3.6:** Create customer search migration with proper indexing
- **Task 3.7:** Implement Redis caching for autocomplete results
- **Task 3.8:** Build advanced filtering engine for customer searches
- **Task 3.9:** Create API resources for customer data serialization
- **Task 3.10:** Implement search popularity tracking and relevance scoring
- **Task 3.11:** Add webhook listeners for real-time customer data updates
- **Task 3.12:** Implement security and authorization for customer endpoints
- **Task 3.13:** Create search configuration management system

### Frontend Implementation
- **Task 3.14:** Build customer service with search and profile methods
- **Task 3.15:** Create search service with reactive autocomplete
- **Task 3.16:** Implement search-autocomplete component with Material Design
- **Task 3.17:** Build customer-search feature module with routing
- **Task 3.18:** Create customer-profile component with tabbed interface
- **Task 3.19:** Implement customer-card component for result display
- **Task 3.20:** Add search highlighting pipe for result presentation
- **Task 3.21:** Implement voice search integration on mobile devices
- **Task 3.22:** Build advanced filtering component with date pickers
- **Task 3.23:** Create search history and recent items management
- **Task 3.24:** Implement mobile keyboard optimization
- **Task 3.25:** Add accessibility features for search interface
- **Task 3.26:** Create responsive design for search results layout

### Testing & Validation
- **Task 3.27:** Write unit tests for CustomerSearchService algorithms
- **Task 3.28:** Create integration tests for customer search endpoints
- **Task 3.29:** Write performance tests for search response times
- **Task 3.30:** Test autocomplete behavior with various input scenarios
- **Task 3.31:** Validate mobile keyboard optimization on target devices
- **Task 3.32:** Test search functionality with large customer datasets
- **Task 3.33:** Validate security and authorization rules
- **Task 3.34:** Test accessibility compliance for search interface
- **Task 3.35:** Perform load testing for concurrent search requests
- **Task 3.36:** Validate Redis caching behavior and performance gains

---

## Dev Agent Record

**Agent Model Used:** TBD  
**Development Start Date:** TBD  
**Current Task:** Customer Search and Profile Management - Pending  
**Status:** Story definition complete - Ready for implementation  

### Debug Log
- *Debug entries will be added during implementation*

### Completion Notes
- Story definition completed based on PRD requirements REQ-007, REQ-008, and REQ-009
- Comprehensive technical requirements defined for both backend and frontend
- Performance requirements set to exceed PRD specification (200ms autocomplete vs 2s requirement)
- Security and accessibility requirements included for enterprise readiness

**Test Files To Be Created:**
- `tests/Unit/CustomerSearchServiceTest.php` - Customer search algorithm tests
- `tests/Feature/CustomerSearchTest.php` - Customer search API endpoint tests
- `tests/Feature/CustomerProfileTest.php` - Customer profile endpoint tests
- `tests/Feature/SearchPerformanceTest.php` - Performance validation tests

**Frontend Files To Be Created:**
- `src/app/core/models/customer.model.ts` - Customer TypeScript interfaces
- `src/app/core/models/search.model.ts` - Search result interfaces
- `src/app/core/services/customer.service.ts` - Customer API service
- `src/app/core/services/search.service.ts` - Global search service
- `src/app/shared/components/search-autocomplete/` - Autocomplete component
- `src/app/features/customer-search/` - Customer search feature
- `src/app/features/customer-profile/` - Customer profile component

---

### Change Log
- **v1.0** - Initial story creation based on PRD Phase 2 requirements
- **v1.1** - Added comprehensive technical specifications and acceptance criteria
- **v1.2** - Finalized task breakdown and implementation requirements

---

**Total Tasks:** 36  
**Completed Tasks:** 0  
**Remaining Tasks:** 36  
**Completion Percentage:** 0%  
**Final Validation:** Pending implementation and testing

## QA Results
### Quality Gate Assessment: **PENDING** ⏳
**Review Status:** Awaiting implementation completion
**Next Review Phase:** Post-implementation validation