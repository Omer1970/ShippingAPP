# Technical Architecture Document
**ShipmentApp - Mobile Delivery Management System**

---

## Document Information
- **Project Name:** ShipmentApp Technical Architecture
- **Version:** 1.0
- **Date:** September 8, 2025
- **Document Type:** System Architecture & Technical Specification
- **Prepared By:** Alex - System Architect
- **Status:** Ready for Development Implementation

---

## Table of Contents
1. [System Architecture Overview](#1-system-architecture-overview)
2. [Database Design & Schema](#2-database-design--schema)
3. [API Specifications](#3-api-specifications)
4. [ERP Integration Strategy](#4-erp-integration-strategy)
5. [Security Architecture](#5-security-architecture)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Backend Architecture](#7-backend-architecture)
8. [Deployment Architecture](#8-deployment-architecture)
9. [Performance & Scalability](#9-performance--scalability)
10. [Implementation Roadmap](#10-implementation-roadmap)

---

## 1. System Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile Apps   │    │   Web Browsers  │    │   Tablets       │
│   (iOS/Android) │    │   (Chrome/Safari│    │   (iPad/Android)│
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼───────────────┐
                    │     Angular PWA Frontend    │
                    │   (Service Worker, Cache)   │
                    └─────────────┬───────────────┘
                                  │ HTTPS/REST API
                    ┌─────────────▼───────────────┐
                    │      Laravel Backend        │
                    │  (API, Auth, Business Logic)│
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │      Redis Cache/Queue      │
                    │   (Session, Jobs, Cache)    │
                    └─────────────┬───────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
┌─────────▼───────────┐ ┌─────────▼───────────┐ ┌─────────▼───────────┐
│   MySQL Database    │ │   File Storage      │ │   Dolibarr ERP      │
│ (App Data, Users)   │ │ (Signatures, Docs)  │ │ (Orders, Customers) │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

### 1.2 Technology Stack

#### 1.2.1 Frontend Stack
- **Framework:** Angular 16+ with TypeScript
- **UI Library:** Angular Material + Custom Components
- **PWA:** Service Workers, Web App Manifest
- **State Management:** NgRx (for complex state)
- **HTTP Client:** Angular HttpClient with interceptors
- **Build Tool:** Angular CLI with Webpack

#### 1.2.2 Backend Stack
- **Framework:** Laravel 10+ with PHP 8.1+
- **API:** RESTful APIs with JSON responses
- **Authentication:** Laravel Sanctum (SPA authentication)
- **Queue System:** Redis with Laravel Horizon
- **Caching:** Redis for application cache
- **File Storage:** Laravel Storage with S3/local disk

#### 1.2.3 Database & Storage
- **Primary Database:** MySQL 8.0+
- **Cache/Sessions:** Redis 6.0+
- **File Storage:** AWS S3 or local storage
- **ERP Database:** Dolibarr MySQL (read-only access)

#### 1.2.4 Infrastructure
- **Web Server:** Nginx with PHP-FPM
- **Process Manager:** Supervisor for queue workers
- **SSL/TLS:** Let's Encrypt or commercial certificates
- **Monitoring:** Laravel Telescope + custom logging

---

## 2. Database Design & Schema

### 2.1 Database Architecture

#### 2.1.1 Primary Application Database (MySQL)
**Purpose:** Store application-specific data, user sessions, cached ERP data

#### 2.1.2 ERP Database Integration (Dolibarr)
**Purpose:** Read-only access to orders, customers, shipments data

### 2.2 Application Database Schema

#### 2.2.1 Users Table
```sql
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified_at TIMESTAMP NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('driver', 'warehouse', 'admin') NOT NULL DEFAULT 'driver',
    dolibarr_user_id INT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_dolibarr_user_id (dolibarr_user_id)
);
```

#### 2.2.2 Delivery Confirmations Table
```sql
CREATE TABLE delivery_confirmations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dolibarr_shipment_id INT NOT NULL,
    dolibarr_order_id INT NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    delivery_address TEXT NOT NULL,
    signature_data LONGTEXT NULL, -- Base64 encoded signature
    signature_file_path VARCHAR(500) NULL,
    delivery_notes TEXT NULL,
    gps_latitude DECIMAL(10, 8) NULL,
    gps_longitude DECIMAL(11, 8) NULL,
    delivered_at TIMESTAMP NOT NULL,
    synced_to_erp BOOLEAN DEFAULT FALSE,
    sync_attempts INT DEFAULT 0,
    last_sync_attempt TIMESTAMP NULL,
    sync_error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_dolibarr_shipment_id (dolibarr_shipment_id),
    INDEX idx_dolibarr_order_id (dolibarr_order_id),
    INDEX idx_user_id (user_id),
    INDEX idx_delivered_at (delivered_at),
    INDEX idx_synced_to_erp (synced_to_erp)
);
```

#### 2.2.3 ERP Sync Log Table
```sql
CREATE TABLE erp_sync_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    operation_type ENUM('read', 'write', 'update') NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id INT NULL,
    status ENUM('success', 'failed', 'pending') NOT NULL,
    request_data JSON NULL,
    response_data JSON NULL,
    error_message TEXT NULL,
    execution_time_ms INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_operation_type (operation_type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);
```

#### 2.2.4 User Sessions Table (Laravel Sanctum)
```sql
CREATE TABLE personal_access_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tokenable_type VARCHAR(255) NOT NULL,
    tokenable_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    token VARCHAR(64) UNIQUE NOT NULL,
    abilities TEXT NULL,
    last_used_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_tokenable (tokenable_type, tokenable_id),
    INDEX idx_token (token)
);
```

### 2.3 Dolibarr ERP Database Integration

#### 2.3.1 Key Dolibarr Tables (Read-Only Access)
```sql
-- Orders/Commands
llx_commande (
    rowid, ref, fk_soc, date_commande, fk_statut, 
    total_ht, total_ttc, note_private, note_public
)

-- Customers/Third Parties
llx_societe (
    rowid, nom, address, zip, town, phone, email, 
    client, fournisseur, code_client
)

-- Shipments
llx_expedition (
    rowid, ref, fk_commande, date_expedition, 
    fk_statut, note_private, note_public
)

-- Shipment Details
llx_expeditiondet (
    rowid, fk_expedition, fk_product, qty, 
    description, rang
)

-- Products
llx_product (
    rowid, ref, label, description, price, 
    weight, volume
)
```

#### 2.3.2 Database Connection Strategy
- **Read-Only Connection:** Separate MySQL connection for Dolibarr
- **Connection Pooling:** Optimize database connections
- **Query Optimization:** Use indexes and limit result sets
- **Caching Strategy:** Cache frequently accessed data in Redis

---

## 3. API Specifications

### 3.1 API Architecture

#### 3.1.1 RESTful API Design
- **Base URL:** `https://api.shipmentapp.com/v1/`
- **Authentication:** Bearer token (Laravel Sanctum)
- **Content Type:** `application/json`
- **Response Format:** JSON with consistent structure

#### 3.1.2 Standard Response Format
```json
{
    "success": true,
    "data": {},
    "message": "Operation completed successfully",
    "errors": [],
    "meta": {
        "timestamp": "2025-09-08T10:30:00Z",
        "version": "1.0",
        "pagination": {
            "current_page": 1,
            "total_pages": 10,
            "per_page": 20,
            "total_items": 200
        }
    }
}
```

### 3.2 Authentication Endpoints

#### 3.2.1 POST /auth/login
**Purpose:** User authentication and token generation

**Request:**
```json
{
    "email": "driver@company.com",
    "password": "secure_password",
    "device_name": "iPhone 14 Pro"
}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "user": {
            "id": 1,
            "name": "John Driver",
            "email": "driver@company.com",
            "role": "driver"
        },
        "token": "1|abc123def456...",
        "expires_at": "2025-09-15T10:30:00Z"
    },
    "message": "Login successful"
}
```

#### 3.2.2 POST /auth/logout
**Purpose:** Revoke authentication token

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
    "success": true,
    "message": "Logged out successfully"
}
```

### 3.3 Shipments Endpoints

#### 3.3.1 GET /shipments
**Purpose:** Retrieve all shipments with filtering and pagination

**Query Parameters:**
- `page` (int): Page number (default: 1)
- `per_page` (int): Items per page (default: 20, max: 100)
- `status` (string): Filter by status (pending, in_transit, delivered)
- `customer_id` (int): Filter by customer ID
- `date_from` (date): Filter from date (YYYY-MM-DD)
- `date_to` (date): Filter to date (YYYY-MM-DD)
- `search` (string): Search in customer name, address, or reference

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": 123,
            "reference": "EXP-2025-001",
            "order_id": 456,
            "order_reference": "CMD-2025-001",
            "customer": {
                "id": 789,
                "name": "ABC Company Ltd",
                "phone": "+1234567890",
                "email": "contact@abc.com"
            },
            "delivery_address": {
                "street": "123 Main Street",
                "city": "New York",
                "zip": "10001",
                "country": "USA"
            },
            "status": "pending",
            "scheduled_date": "2025-09-08",
            "items": [
                {
                    "product_id": 101,
                    "name": "Product A",
                    "quantity": 5,
                    "description": "High quality product"
                }
            ],
            "total_weight": 25.5,
            "delivery_notes": "Handle with care",
            "created_at": "2025-09-07T14:30:00Z"
        }
    ],
    "meta": {
        "pagination": {
            "current_page": 1,
            "total_pages": 5,
            "per_page": 20,
            "total_items": 95
        }
    }
}
```

#### 3.3.2 GET /shipments/{id}
**Purpose:** Get detailed shipment information

**Response:**
```json
{
    "success": true,
    "data": {
        "id": 123,
        "reference": "EXP-2025-001",
        "order_id": 456,
        "customer": { /* customer details */ },
        "delivery_address": { /* address details */ },
        "items": [ /* item details */ ],
        "delivery_note_url": "/api/v1/shipments/123/delivery-note",
        "status": "pending",
        "tracking_info": {
            "current_location": "Warehouse",
            "last_update": "2025-09-08T09:00:00Z"
        }
    }
}
```

#### 3.3.3 GET /shipments/{id}/delivery-note
**Purpose:** Generate delivery note for signature

**Response:**
```json
{
    "success": true,
    "data": {
        "shipment_id": 123,
        "delivery_note": {
            "header": {
                "company_name": "Delivery Company",
                "company_address": "456 Business Ave",
                "date": "2025-09-08",
                "reference": "EXP-2025-001"
            },
            "customer": { /* customer info */ },
            "items": [ /* items list */ ],
            "terms": "Please sign to confirm receipt of goods",
            "signature_required": true
        }
    }
}
```

#### 3.3.4 POST /shipments/{id}/confirm-delivery
**Purpose:** Confirm delivery with digital signature

**Request:**
```json
{
    "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "delivery_notes": "Delivered to reception desk",
    "gps_coordinates": {
        "latitude": 40.7128,
        "longitude": -74.0060
    },
    "delivered_at": "2025-09-08T15:30:00Z"
}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "confirmation_id": 789,
        "shipment_id": 123,
        "status": "delivered",
        "signature_saved": true,
        "erp_sync_status": "pending"
    },
    "message": "Delivery confirmed successfully"
}
```

### 3.4 Orders Endpoints

#### 3.4.1 GET /orders
**Purpose:** Retrieve all orders with filtering

**Query Parameters:** Similar to shipments endpoint

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": 456,
            "reference": "CMD-2025-001",
            "customer": { /* customer details */ },
            "status": "confirmed",
            "order_date": "2025-09-05",
            "total_amount": 1250.00,
            "currency": "USD",
            "items": [ /* order items */ ],
            "shipments": [
                {
                    "id": 123,
                    "reference": "EXP-2025-001",
                    "status": "pending"
                }
            ]
        }
    ]
}
```

### 3.5 Customers Endpoints

#### 3.5.1 GET /customers/search
**Purpose:** Search customers by name, email, or phone

**Query Parameters:**
- `q` (string): Search query (minimum 2 characters)
- `limit` (int): Maximum results (default: 10, max: 50)

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": 789,
            "name": "ABC Company Ltd",
            "email": "contact@abc.com",
            "phone": "+1234567890",
            "address": "123 Main Street, New York, 10001",
            "customer_since": "2023-01-15",
            "total_orders": 25,
            "last_order_date": "2025-09-01"
        }
    ]
}
```

#### 3.5.2 GET /customers/{id}
**Purpose:** Get customer profile with order and shipment history

**Response:**
```json
{
    "success": true,
    "data": {
        "id": 789,
        "name": "ABC Company Ltd",
        "contact_info": { /* contact details */ },
        "addresses": [ /* delivery addresses */ ],
        "statistics": {
            "total_orders": 25,
            "total_shipments": 30,
            "last_order_date": "2025-09-01",
            "customer_since": "2023-01-15"
        },
        "recent_orders": [ /* last 10 orders */ ],
        "recent_shipments": [ /* last 10 shipments */ ]
    }
}
```

### 3.6 Calendar Endpoints

#### 3.6.1 GET /calendar/deliveries
**Purpose:** Get scheduled deliveries for calendar view

**Query Parameters:**
- `date_from` (date): Start date (YYYY-MM-DD)
- `date_to` (date): End date (YYYY-MM-DD)
- `view` (string): day, week, month (default: day)

**Response:**
```json
{
    "success": true,
    "data": {
        "2025-09-08": [
            {
                "shipment_id": 123,
                "time_slot": "09:00-12:00",
                "customer_name": "ABC Company",
                "address": "123 Main Street",
                "status": "pending",
                "priority": "normal"
            }
        ],
        "2025-09-09": [ /* next day deliveries */ ]
    }
}
```

---

## 4. ERP Integration Strategy

### 4.1 Integration Architecture

#### 4.1.1 Connection Strategy
- **Database Connection:** Direct MySQL connection to Dolibarr database
- **Read-Only Access:** Prevent accidental data modification
- **Connection Pooling:** Optimize database connections
- **Fallback Strategy:** Graceful handling of ERP downtime

#### 4.1.2 Data Synchronization

**Real-Time Sync (Critical Data):**
- Order status changes
- Customer information updates
- Shipment status updates

**Batch Sync (Non-Critical Data):**
- Product catalog updates
- Historical data
- Reporting data

**Event-Driven Sync:**
- Delivery confirmations
- Signature uploads
- Status updates

### 4.2 Dolibarr Integration Points

#### 4.2.1 Data Reading (FROM Dolibarr)
```php
// Laravel Service Class Example
class DolibarrService
{
    public function getOrders($filters = [])
    {
        $query = DB::connection('dolibarr')
            ->table('llx_commande as c')
            ->join('llx_societe as s', 'c.fk_soc', '=', 's.rowid')
            ->select([
                'c.rowid as id',
                'c.ref as reference',
                'c.date_commande as order_date',
                'c.total_ttc as total_amount',
                'c.fk_statut as status',
                's.nom as customer_name',
                's.phone as customer_phone',
                's.email as customer_email'
            ]);

        // Apply filters
        if (isset($filters['customer_id'])) {
            $query->where('c.fk_soc', $filters['customer_id']);
        }

        if (isset($filters['status'])) {
            $query->where('c.fk_statut', $filters['status']);
        }

        return $query->paginate(20);
    }

    public function getShipments($filters = [])
    {
        return DB::connection('dolibarr')
            ->table('llx_expedition as e')
            ->join('llx_commande as c', 'e.fk_commande', '=', 'c.rowid')
            ->join('llx_societe as s', 'c.fk_soc', '=', 's.rowid')
            ->select([
                'e.rowid as id',
                'e.ref as reference',
                'e.date_expedition as shipment_date',
                'e.fk_statut as status',
                'c.ref as order_reference',
                's.nom as customer_name'
            ])
            ->where('e.fk_statut', '!=', 3) // Not cancelled
            ->paginate(20);
    }
}
```

#### 4.2.2 Data Writing (TO Dolibarr)
```php
// Delivery Confirmation Sync
class DeliveryConfirmationSync
{
    public function syncToDolibarr($confirmationId)
    {
        $confirmation = DeliveryConfirmation::find($confirmationId);

        try {
            // Update shipment status in Dolibarr
            DB::connection('dolibarr')
                ->table('llx_expedition')
                ->where('rowid', $confirmation->dolibarr_shipment_id)
                ->update([
                    'fk_statut' => 2, // Delivered status
                    'date_delivery' => $confirmation->delivered_at,
                    'note_private' => $confirmation->delivery_notes
                ]);

            // Upload signature file
            $this->uploadSignatureFile($confirmation);

            // Mark as synced
            $confirmation->update([
                'synced_to_erp' => true,
                'last_sync_attempt' => now()
            ]);

        } catch (Exception $e) {
            // Log error and retry later
            $confirmation->update([
                'sync_attempts' => $confirmation->sync_attempts + 1,
                'sync_error_message' => $e->getMessage(),
                'last_sync_attempt' => now()
            ]);

            throw $e;
        }
    }
}
```

### 4.3 Error Handling & Retry Strategy

#### 4.3.1 Connection Failures
- **Retry Logic:** Exponential backoff (1s, 2s, 4s, 8s, 16s)
- **Circuit Breaker:** Stop attempts after 5 consecutive failures
- **Fallback:** Use cached data when ERP is unavailable
- **Monitoring:** Alert administrators of prolonged outages

#### 4.3.2 Data Consistency
- **Transaction Management:** Use database transactions for critical operations
- **Conflict Resolution:** Last-write-wins for most data, manual resolution for conflicts
- **Audit Trail:** Log all sync operations for troubleshooting

---

## 5. Security Architecture

### 5.1 Authentication & Authorization

#### 5.1.1 Authentication Strategy
- **Method:** Laravel Sanctum SPA authentication
- **Token Type:** Personal Access Tokens
- **Token Expiry:** 24 hours (configurable)
- **Refresh Strategy:** Automatic token refresh on activity

#### 5.1.2 Authorization Levels
```php
// Role-Based Access Control
enum UserRole: string
{
    case DRIVER = 'driver';
    case WAREHOUSE = 'warehouse';
    case ADMIN = 'admin';
}

// Permission Matrix
$permissions = [
    'driver' => [
        'shipments.view_all',
        'orders.view_all',
        'customers.search',
        'deliveries.confirm',
        'calendar.view'
    ],
    'warehouse' => [
        'shipments.view_all',
        'shipments.update_status',
        'orders.view_all',
        'customers.view_all',
        'reports.view'
    ],
    'admin' => [
        '*' // All permissions
    ]
];
```

### 5.2 Data Security

#### 5.2.1 Encryption
- **In Transit:** TLS 1.3 for all API communications
- **At Rest:** AES-256 encryption for sensitive data
- **Database:** Encrypted database connections
- **Files:** Encrypted signature files and documents

#### 5.2.2 Data Privacy
- **PII Protection:** Hash/encrypt customer personal information
- **GDPR Compliance:** Data retention policies and deletion procedures
- **Access Logging:** Log all data access for audit purposes
- **Data Minimization:** Store only necessary data

### 5.3 API Security

#### 5.3.1 Request Security
```php
// Rate Limiting
Route::middleware(['auth:sanctum', 'throttle:60,1'])->group(function () {
    Route::get('/shipments', [ShipmentController::class, 'index']);
    Route::post('/shipments/{id}/confirm-delivery', [ShipmentController::class, 'confirmDelivery']);
});

// Input Validation
class ConfirmDeliveryRequest extends FormRequest
{
    public function rules()
    {
        return [
            'signature_data' => 'required|string|max:2000000', // 2MB max
            'delivery_notes' => 'nullable|string|max:1000',
            'gps_coordinates.latitude' => 'nullable|numeric|between:-90,90',
            'gps_coordinates.longitude' => 'nullable|numeric|between:-180,180',
            'delivered_at' => 'required|date|before_or_equal:now'
        ];
    }
}
```

#### 5.3.2 Response Security
- **Data Sanitization:** Remove sensitive data from responses
- **CORS Configuration:** Restrict cross-origin requests
- **Security Headers:** Implement security headers (CSP, HSTS, etc.)

### 5.4 File Security

#### 5.4.1 Signature Files
- **Storage:** Secure file storage with access controls
- **Encryption:** Encrypt signature files at rest
- **Access Control:** Signed URLs for temporary access
- **Retention:** Automatic deletion after retention period

---

## 6. Frontend Architecture

### 6.1 Angular Application Structure

```
src/
├── app/
│   ├── core/                 # Singleton services, guards
│   │   ├── auth/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   └── services/
│   ├── shared/               # Shared components, pipes, directives
│   │   ├── components/
│   │   ├── pipes/
│   │   └── directives/
│   ├── features/             # Feature modules
│   │   ├── dashboard/
│   │   ├── shipments/
│   │   ├── orders/
│   │   ├── customers/
│   │   └── calendar/
│   ├── layout/               # Layout components
│   └── app-routing.module.ts
├── assets/                   # Static assets
├── environments/             # Environment configurations
└── styles/                   # Global styles
```

### 6.2 State Management

#### 6.2.1 NgRx Store Structure
```typescript
// Application State
interface AppState {
  auth: AuthState;
  shipments: ShipmentsState;
  orders: OrdersState;
  customers: CustomersState;
  ui: UIState;
}

// Shipments State Example
interface ShipmentsState {
  shipments: Shipment[];
  selectedShipment: Shipment | null;
  loading: boolean;
  error: string | null;
  filters: ShipmentFilters;
  pagination: PaginationInfo;
}
```

### 6.3 PWA Configuration

#### 6.3.1 Service Worker Strategy
```typescript
// Service Worker Registration
import { SwUpdate } from '@angular/service-worker';

@Injectable()
export class UpdateService {
  constructor(private swUpdate: SwUpdate) {
    if (swUpdate.isEnabled) {
      swUpdate.available.subscribe(() => {
        if (confirm('New version available. Load?')) {
          window.location.reload();
        }
      });
    }
  }
}
```

#### 6.3.2 Caching Strategy
- **App Shell:** Cache core application files
- **API Data:** Cache frequently accessed data with TTL
- **Images:** Cache signature images and icons
- **Offline Support:** Basic functionality when offline

---

## 7. Backend Architecture

### 7.1 Laravel Application Structure

```
app/
├── Http/
│   ├── Controllers/
│   │   ├── Api/
│   │   │   ├── AuthController.php
│   │   │   ├── ShipmentController.php
│   │   │   ├── OrderController.php
│   │   │   └── CustomerController.php
│   │   └── Middleware/
│   ├── Requests/
│   └── Resources/
├── Models/
│   ├── User.php
│   ├── DeliveryConfirmation.php
│   └── ErpSyncLog.php
├── Services/
│   ├── DolibarrService.php
│   ├── DeliveryService.php
│   └── SyncService.php
├── Jobs/
│   ├── SyncDeliveryToErp.php
│   └── ProcessSignatureUpload.php
└── Console/
    └── Commands/
```

### 7.2 Service Layer Architecture

#### 7.2.1 Service Classes
```php
// Delivery Service Example
class DeliveryService
{
    public function __construct(
        private DolibarrService $dolibarrService,
        private SignatureService $signatureService
    ) {}

    public function confirmDelivery(int $shipmentId, array $data): DeliveryConfirmation
    {
        DB::beginTransaction();

        try {
            // Create delivery confirmation
            $confirmation = DeliveryConfirmation::create([
                'dolibarr_shipment_id' => $shipmentId,
                'user_id' => auth()->id(),
                'signature_data' => $data['signature_data'],
                'delivery_notes' => $data['delivery_notes'],
                'delivered_at' => $data['delivered_at']
            ]);

            // Process signature
            $this->signatureService->processSignature($confirmation);

            // Queue ERP sync
            SyncDeliveryToErp::dispatch($confirmation->id);

            DB::commit();
            return $confirmation;

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}
```

### 7.3 Queue System

#### 7.3.1 Job Classes
```php
// ERP Sync Job
class SyncDeliveryToErp implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 5;
    public $backoff = [60, 120, 300, 600, 1200]; // Exponential backoff

    public function __construct(private int $confirmationId) {}

    public function handle(DeliveryConfirmationSync $syncService)
    {
        $syncService->syncToDolibarr($this->confirmationId);
    }

    public function failed(Throwable $exception)
    {
        // Handle permanent failure
        Log::error('ERP sync failed permanently', [
            'confirmation_id' => $this->confirmationId,
            'error' => $exception->getMessage()
        ]);
    }
}
```

---

## 8. Deployment Architecture

### 8.1 Infrastructure Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   CDN/CloudFlare│    │   SSL Termination│
│   (Nginx/HAProxy)│    │   (Static Assets)│    │   (Let's Encrypt) │
└─────────┬───────┘    └─────────────────┘    └─────────────────┘
          │
┌─────────▼───────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Server 1  │    │   Web Server 2  │    │   Web Server N  │
│   (Nginx+PHP-FPM)│    │   (Nginx+PHP-FPM)│    │   (Nginx+PHP-FPM)│
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
┌─────────▼───────┐    ┌─────────▼───────┐    ┌─────────▼───────┐
│   MySQL Master │    │   Redis Cluster │    │   File Storage  │
│   (Primary DB)  │    │   (Cache/Queue) │    │   (S3/Local)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │
┌─────────▼───────┐
│   MySQL Slave   │
│   (Read Replica)│
└─────────────────┘
```

### 8.2 Environment Configurations

#### 8.2.1 Production Environment
```bash
# .env.production
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.shipmentapp.com

DB_CONNECTION=mysql
DB_HOST=mysql-master.internal
DB_PORT=3306
DB_DATABASE=shipmentapp
DB_USERNAME=app_user
DB_PASSWORD=secure_password

REDIS_HOST=redis-cluster.internal
REDIS_PASSWORD=redis_password
REDIS_PORT=6379

DOLIBARR_DB_HOST=dolibarr-db.internal
DOLIBARR_DB_DATABASE=dolibarr
DOLIBARR_DB_USERNAME=readonly_user
DOLIBARR_DB_PASSWORD=readonly_password

FILESYSTEM_DISK=s3
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=shipmentapp-files
```

#### 8.2.2 Docker Configuration
```dockerfile
# Dockerfile
FROM php:8.1-fpm-alpine

# Install dependencies
RUN apk add --no-cache     nginx     supervisor     mysql-client     redis

# Install PHP extensions
RUN docker-php-ext-install     pdo_mysql     redis     gd     zip

# Copy application
COPY . /var/www/html
WORKDIR /var/www/html

# Install Composer dependencies
RUN composer install --no-dev --optimize-autoloader

# Set permissions
RUN chown -R www-data:www-data /var/www/html

EXPOSE 80
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
```

### 8.3 Deployment Pipeline

#### 8.3.1 CI/CD Pipeline (GitHub Actions)
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: 8.1
      - name: Install dependencies
        run: composer install
      - name: Run tests
        run: php artisan test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          ssh user@server 'cd /var/www/html && git pull'
          ssh user@server 'cd /var/www/html && composer install --no-dev'
          ssh user@server 'cd /var/www/html && php artisan migrate --force'
          ssh user@server 'cd /var/www/html && php artisan config:cache'
          ssh user@server 'sudo systemctl reload nginx'
```

---

## 9. Performance & Scalability

### 9.1 Performance Optimization

#### 9.1.1 Database Optimization
- **Indexing Strategy:** Optimize queries with proper indexes
- **Query Optimization:** Use query builder efficiently
- **Connection Pooling:** Optimize database connections
- **Read Replicas:** Separate read/write operations

#### 9.1.2 Caching Strategy
```php
// Redis Caching Example
class ShipmentService
{
    public function getShipments($filters = [])
    {
        $cacheKey = 'shipments:' . md5(serialize($filters));

        return Cache::remember($cacheKey, 300, function () use ($filters) {
            return $this->dolibarrService->getShipments($filters);
        });
    }
}
```

#### 9.1.3 API Optimization
- **Response Compression:** Gzip compression for API responses
- **Pagination:** Limit result sets with pagination
- **Field Selection:** Allow clients to specify required fields
- **HTTP Caching:** Use ETags and Last-Modified headers

### 9.2 Scalability Planning

#### 9.2.1 Horizontal Scaling
- **Load Balancing:** Distribute traffic across multiple servers
- **Stateless Design:** Ensure application is stateless
- **Database Sharding:** Plan for database scaling
- **Microservices:** Consider service separation for future growth

#### 9.2.2 Monitoring & Alerting
```php
// Performance Monitoring
class PerformanceMiddleware
{
    public function handle($request, Closure $next)
    {
        $start = microtime(true);

        $response = $next($request);

        $duration = microtime(true) - $start;

        if ($duration > 1.0) { // Log slow requests
            Log::warning('Slow request detected', [
                'url' => $request->url(),
                'duration' => $duration,
                'memory' => memory_get_peak_usage(true)
            ]);
        }

        return $response;
    }
}
```

---

## 10. Implementation Roadmap

### 10.1 Phase 1: Foundation (Weeks 1-4)

#### Week 1-2: Backend Setup
- [ ] Laravel application setup and configuration
- [ ] Database schema creation and migrations
- [ ] Dolibarr database connection setup
- [ ] Basic authentication system (Laravel Sanctum)
- [ ] Core API endpoints (auth, basic CRUD)

#### Week 3-4: Frontend Setup
- [ ] Angular application setup with PWA configuration
- [ ] UI component library setup (Angular Material)
- [ ] Authentication service and guards
- [ ] Basic routing and navigation
- [ ] API service layer

### 10.2 Phase 2: Core Features (Weeks 5-6)

#### Week 5: Data Integration
- [ ] Dolibarr service implementation
- [ ] Shipments and orders API endpoints
- [ ] Customer search functionality
- [ ] Data caching implementation
- [ ] Error handling and retry logic

#### Week 6: UI Implementation
- [ ] Dashboard screen implementation
- [ ] Shipments list and detail screens
- [ ] Customer search and profile screens
- [ ] Calendar view implementation
- [ ] Responsive design optimization

### 10.3 Phase 3: Digital Signatures (Weeks 7-8)

#### Week 7: Signature System
- [ ] Signature canvas component
- [ ] Delivery note generation
- [ ] File storage system setup
- [ ] Signature processing and validation

#### Week 8: ERP Integration
- [ ] Delivery confirmation API
- [ ] ERP sync job implementation
- [ ] Queue system setup
- [ ] Sync monitoring and error handling

### 10.4 Phase 4: Testing & Deployment (Weeks 9-10)

#### Week 9: Testing
- [ ] Unit tests for backend services
- [ ] Integration tests for API endpoints
- [ ] Frontend component testing
- [ ] End-to-end testing
- [ ] Performance testing

#### Week 10: Deployment
- [ ] Production environment setup
- [ ] CI/CD pipeline configuration
- [ ] Security audit and penetration testing
- [ ] User acceptance testing
- [ ] Production deployment and monitoring

---

## Appendix A: Database Indexes

```sql
-- Performance Indexes
CREATE INDEX idx_delivery_confirmations_composite ON delivery_confirmations 
(dolibarr_shipment_id, synced_to_erp, delivered_at);

CREATE INDEX idx_users_active_role ON users (is_active, role);

CREATE INDEX idx_erp_sync_logs_status_created ON erp_sync_logs (status, created_at);

-- Full-text search indexes
ALTER TABLE delivery_confirmations ADD FULLTEXT(delivery_notes);
```

## Appendix B: Configuration Files

### Laravel Configuration
```php
// config/database.php - Dolibarr Connection
'dolibarr' => [
    'driver' => 'mysql',
    'host' => env('DOLIBARR_DB_HOST', '127.0.0.1'),
    'port' => env('DOLIBARR_DB_PORT', '3306'),
    'database' => env('DOLIBARR_DB_DATABASE', 'dolibarr'),
    'username' => env('DOLIBARR_DB_USERNAME', 'readonly'),
    'password' => env('DOLIBARR_DB_PASSWORD', ''),
    'charset' => 'utf8mb4',
    'collation' => 'utf8mb4_unicode_ci',
    'prefix' => '',
    'strict' => true,
    'engine' => null,
    'options' => [
        PDO::ATTR_TIMEOUT => 5,
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ],
],
```

---

**Document Prepared By:** Alex - System Architect  
**Review Status:** Ready for Development Team Review  
**Next Steps:** Begin Phase 1 implementation with backend foundation  

---
*This technical architecture document provides comprehensive guidance for implementing ShipmentApp with scalable, secure, and maintainable code. All architectural decisions are based on industry best practices and optimized for the specific requirements outlined in the PRD.*
