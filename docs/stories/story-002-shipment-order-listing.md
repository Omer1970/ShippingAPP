# Story 002: Basic Shipment and Order Listing

**Epic:** Epic 001 - Core Authentication & User Management  
**Status:** Draft  
**Priority:** High  
**Estimated Effort:** 8 points  
**Assigned to:** Unassigned  

---

## Goal & Context

**What:** Implement basic shipment and order listing functionality that allows authenticated users to view and browse shipments and orders from Dolibarr ERP system.

**Why:** After successful authentication (Story 001), users need immediate access to their delivery and warehouse data to perform their daily operations. This provides the core data visibility that drives the entire application's value proposition.

**Epic Context:** This is the second story in Epic 001 and builds directly on the authentication foundation. It enables users to see their work data and prepares for the search functionality (Story 003).

**Dependencies:** Story 001 (User Authentication System) - Users must be authenticated before accessing shipment/order data

---

## Technical Implementation

### Key Files to Create/Modify

**Backend (Laravel):**
- `app/Services/DolibarrDataService.php` - New service for fetching shipment/order data from Dolibarr
- `app/Http/Controllers/Api/ShipmentController.php` - New controller for shipment endpoints
- `app/Http/Controllers/Api/OrderController.php` - New controller for order endpoints  
- `app/Models/Shipment.php` - New model for shipment data
- `app/Models/Order.php` - New model for order data
- `app/Http/Resources/ShipmentResource.php` - Resource for shipment API responses
- `app/Http/Resources/OrderResource.php` - Resource for order API responses
- `routes/api.php` - Add shipment and order routes
- `config/database.php` - Dolibarr connection configuration (reuse existing)

**Frontend (Angular):**
- `src/app/core/services/shipment.service.ts` - Service for shipment data management
- `src/app/core/services/order.service.ts` - Service for order data management
- `src/app/features/dashboard/` - Dashboard component for listing shipments/orders
- `src/app/core/models/shipment.model.ts` - Shipment interface definitions
- `src/app/core/models/order.model.ts` - Order interface definitions
- `src/app/shared/components/shipment-list/` - Reusable shipment list component
- `src/app/shared/components/order-list/` - Reusable order list component

### Technology Requirements

**Backend Stack:**
- Laravel 10+ with PHP 8.1+
- Laravel Sanctum for API authentication (reuse from Story 001)
- MySQL for application data storage
- PostgreSQL for Dolibarr ERP connection (read-only)
- Redis for data caching

**Frontend Stack:**
- Angular 16+ with TypeScript
- Angular Material for UI components
- RxJS for reactive data management
- Angular HttpClient for API communication

### API Specifications

**Shipment Endpoints:**
- `GET /api/shipments` - List all shipments with pagination
- `GET /api/shipments/{id}` - Get single shipment details
- `GET /api/shipments/my` - Get shipments assigned to current user
- `GET /api/shipments/status/{status}` - Get shipments by status

**Order Endpoints:**
- `GET /api/orders` - List all orders with pagination
- `GET /api/orders/{id}` - Get single order details
- `GET /api/orders/customer/{customerId}` - Get orders for specific customer
- `GET /api/orders/status/{status}` - Get orders by status

**Request/Response Format:**
```json
{
    "success": true,
    "data": {
        "shipments": [
            {
                "id": 1,
                "dolibarr_shipment_id": 12345,
                "reference": "SH2025001",
                "customer_name": "ABC Company",
                "delivery_address": "123 Main St, City",
                "status": "in_transit",
                "expected_delivery": "2025-09-15",
                "assigned_driver": "John Driver",
                "total_weight": 25.5,
                "total_value": 1500.00
            }
        ],
        "pagination": {
            "current_page": 1,
            "total_pages": 5,
            "total_items": 47,
            "items_per_page": 10
        }
    }
}
```

### Data Models

**Shipment Model Requirements:**
- id (primary key)
- dolibarr_shipment_id (int, required - ERP integration)
- reference (string, required - shipment reference number)
- customer_id (int, required)
- customer_name (string, required)
- delivery_address (text, required)
- status (enum: pending, in_transit, delivered, cancelled)
- expected_delivery (date, required)
- assigned_driver_id (int, optional)
- total_weight (decimal, optional)
- total_value (decimal, optional)
- created_from_dolibarr (timestamp)
- last_synced (timestamp)
- timestamps (created_at, updated_at)

**Order Model Requirements:**
- id (primary key)
- dolibarr_order_id (int, required - ERP integration)
- reference (string, required - order reference number)
- customer_id (int, required)
- customer_name (string, required)
- order_date (date, required)
- status (enum: pending, processing, shipped, delivered, cancelled)
- total_amount (decimal, required)
- shipping_address (text, required)
- billing_address (text, required)
- created_from_dolibarr (timestamp)
- last_synced (timestamp)
- timestamps (created_at, updated_at)

### Integration Points

**Dolibarr ERP Integration:**
- **Read-Only Access**: Connect to Dolibarr database for shipment/order data
- **Shipment Table**: Fetch from `llx_expedition` table in Dolibarr
- **Order Table**: Fetch from `llx_commande` table in Dolibarr
- **Customer Data**: Join with `llx_societe` for customer information
- **Status Mapping**: Map Dolibarr status codes to application statuses
- **Data Caching**: Cache frequently accessed shipment/order data (TTL: 30 minutes)
- **Sync Strategy**: Real-time fetch with caching, periodic sync for updates

**Frontend-Backend Integration:**
- Angular services consume Laravel API endpoints
- Reactive data management with RxJS
- Loading states and error handling
- Pagination and filtering on frontend
- Responsive design for mobile devices

---

## Technical References

**Database Schema:** See `docs/architect/2-database-design-schema.md` for detailed table structures
**API Specifications:** See `docs/architect/3-api-specifications.md#shipment-order-endpoints` for complete API docs
**Frontend Architecture:** See `docs/architect/6-frontend-architecture.md#data-management` for state management patterns

---

## Implementation Details

### Assumptions
- Dolibarr ERP contains shipment data in `llx_expedition` table
- Dolibarr ERP contains order data in `llx_commande` table
- Customer information available in `llx_societe` table
- Basic authentication is implemented (Story 001 complete)
- Users have appropriate permissions to view shipment/order data
- Mobile-first design requirements for touch interfaces

### Security Requirements
- All endpoints require authentication (reuse Sanctum from Story 001)
- Users can only view data they have permission to access
- Rate limiting on API endpoints (60 requests per minute)
- Input validation for all query parameters
- SQL injection prevention through parameterized queries
- Data sanitization before caching
- No write operations against Dolibarr database

### Performance Requirements
- List API response time < 500ms
- Individual record fetch < 200ms
- Pagination support for large datasets (10, 25, 50, 100 items per page)
- Cache hit rate > 85% for frequently accessed data
- Lazy loading for detailed views
- Optimized database queries with proper indexing

### Error Handling
- 401 Unauthorized for unauthenticated requests
- 403 Forbidden for unauthorized access attempts
- 404 Not Found for missing records
- 500 Internal Server Error for system failures
- Graceful handling of Dolibarr connection failures
- Clear error messages for frontend display

---

## Testing Strategy

### Unit Tests (Backend)
- `tests/Unit/DolibarrDataServiceTest.php` - Service layer testing
- `tests/Feature/ShipmentTest.php` - Shipment API endpoint testing
- `tests/Feature/OrderTest.php` - Order API endpoint testing
- Test data mapping from Dolibarr to local models
- Test pagination and filtering logic
- Test caching behavior and TTL expiration
- Test error handling for connection failures

### Integration Tests (Frontend)
- `src/app/core/services/shipment.service.spec.ts` - Shipment service testing
- `src/app/core/services/order.service.spec.ts` - Order service testing
- `src/app/features/dashboard/dashboard.component.spec.ts` - Dashboard testing
- Test data loading and display
- Test pagination controls
- Test error handling and loading states
- Test responsive design behavior

### Manual Testing Scenarios
1. **Happy Path:** User logs in and sees their assigned shipments/orders
2. **Pagination:** User navigates through multiple pages of results
3. **Filtering:** User filters shipments by status or date range
4. **Mobile View:** User accesses dashboard on mobile device
5. **Connection Failure:** System handles Dolibarr connectivity issues
6. **Empty State:** User sees appropriate message when no data available
7. **Large Dataset:** System handles 1000+ shipments/orders efficiently

### Success Criteria
- User can view list of shipments within 2 seconds of login
- User can view list of orders within 2 seconds of navigation
- Pagination works correctly for all page sizes
- Mobile interface is fully functional and touch-optimized
- Data accurately reflects Dolibarr information
- Loading states provide clear user feedback
- Error messages are helpful and actionable
- Dashboard is responsive across all target devices

---

## Acceptance Criteria

✅ **Functional Requirements:**
- [ ] User can view list of all shipments after authentication
- [ ] User can view list of all orders after authentication
- [ ] Shipments display key information (reference, customer, status, delivery date)
- [ ] Orders display key information (reference, customer, status, order date, amount)
- [ ] Pagination controls work correctly for large datasets
- [ ] Mobile interface is touch-optimized and responsive
- [ ] Data loads within acceptable time limits (<2 seconds)
- [ ] Loading states provide clear user feedback
- [ ] Error messages are displayed for connection issues
- [ ] Data accurately reflects Dolibarr ERP information

✅ **Non-Functional Requirements:**
- [ ] API response time < 500ms for list endpoints
- [ ] Individual record fetch < 200ms
- [ ] Cache hit rate > 85% for frequently accessed data
- [ ] Mobile interface works on target devices (iPhone, Android)
- [ ] System handles 1000+ records efficiently
- [ ] Error handling is comprehensive and user-friendly
- [ ] Security requirements are met (authentication, rate limiting)

✅ **Security Requirements:**
- [ ] All endpoints require valid authentication
- [ ] Users can only access data they have permission to view
- [ ] Rate limiting prevents API abuse (60 requests/minute)
- [ ] Input validation prevents injection attacks
- [ ] No write operations performed against Dolibarr database

✅ **Testing Requirements:**
- [ ] Unit tests cover service layer logic
- [ ] Integration tests verify API endpoints
- [ ] Frontend tests validate UI components
- [ ] Manual testing scenarios are documented and executed
- [ ] Performance benchmarks are met

---

**Next Steps:** This story builds on the authentication foundation and provides the core data visibility that enables user productivity. After completion, the team can proceed with search functionality (Story 003) and customer management features.

---

## Tasks

### Backend Implementation
- [ ] **Task 2.1:** Create DolibarrDataService for fetching shipment/order data
- [ ] **Task 2.2:** Implement shipment data mapping from Dolibarr `llx_expedition`
- [ ] **Task 2.3:** Implement order data mapping from Dolibarr `llx_commande`
- [ ] **Task 2.4:** Create ShipmentController with list and detail endpoints
- [ ] **Task 2.5:** Create OrderController with list and detail endpoints
- [ ] **Task 2.6:** Implement pagination logic for large datasets
- [ ] **Task 2.7:** Set up Redis caching for shipment/order data (30min TTL)
- [ ] **Task 2.8:** Create API resources for consistent response format
- [ ] **Task 2.9:** Implement status mapping from Dolibarr codes
- [ ] **Task 2.10:** Add comprehensive error handling for connection failures

### Frontend Implementation
- [ ] **Task 2.11:** Create shipment service for API communication
- [ ] **Task 2.12:** Create order service for API communication
- [ ] **Task 2.13:** Build dashboard component for data listing
- [ ] **Task 2.14:** Create shipment list component with mobile optimization
- [ ] **Task 2.15:** Create order list component with mobile optimization
- [ ] **Task 2.16:** Implement pagination controls
- [ ] **Task 2.17:** Add loading states and error handling
- [ ] **Task 2.18:** Create responsive design for mobile devices
- [ ] **Task 2.19:** Implement data refresh mechanisms
- [ ] **Task 2.20:** Add filtering and sorting capabilities

### Testing & Validation
- [ ] **Task 2.21:** Write unit tests for DolibarrDataService
- [ ] **Task 2.22:** Create integration tests for shipment endpoints
- [ ] **Task 2.23:** Create integration tests for order endpoints
- [ ] **Task 2.24:** Test pagination with large datasets
- [ ] **Task 2.25:** Validate mobile interface functionality
- [ ] **Task 2.26:** Test caching behavior and performance
- [ ] **Task 2.27:** Verify Dolibarr data accuracy
- [ ] **Task 2.28:** Test error handling scenarios
- [ ] **Task 2.29:** Validate responsive design across devices
- [ ] **Task 2.30:** Perform end-to-end user workflow testing

---

## Dev Agent Record

**Agent Model Used:** James (Full Stack Developer)  
**Development Start Date:** TBD  
**Current Task:** Basic Shipment and Order Listing - IN PROGRESS  
**Status:** Draft - Ready for Development  

### Debug Log
- *Debug entries will be added during implementation*

### Completion Notes
- *Completion notes will be added as tasks are completed*

### File List
- *Files will be listed as they are created/modified*

### Change Log
- **v1.0** - Initial story creation based on PRD Phase 1 requirements

---

**Total Tasks:** 30  
**Completed Tasks:** 0  
**Remaining Tasks:** 30  
**Completion Percentage:** 0%