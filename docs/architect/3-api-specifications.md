# 3. API Specifications

## 3.1 API Architecture

### 3.1.1 RESTful API Design
- **Base URL:** `https://api.shipmentapp.com/v1/`
- **Authentication:** Bearer token (Laravel Sanctum)
- **Content Type:** `application/json`
- **Response Format:** JSON with consistent structure

### 3.1.2 Standard Response Format
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

## 3.2 Authentication Endpoints

### 3.2.1 POST /auth/login
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

### 3.2.2 POST /auth/logout
**Purpose:** Revoke authentication token

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
    "success": true,
    "message": "Logged out successfully"
}
```

## 3.3 Shipments Endpoints

### 3.3.1 GET /shipments
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

### 3.3.2 GET /shipments/{id}
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

### 3.3.3 GET /shipments/{id}/delivery-note
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

### 3.3.4 POST /shipments/{id}/confirm-delivery
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

## 3.4 Orders Endpoints

### 3.4.1 GET /orders
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

## 3.5 Customers Endpoints

### 3.5.1 GET /customers/search
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

### 3.5.2 GET /customers/{id}
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

## 3.6 Calendar Endpoints

### 3.6.1 GET /calendar/deliveries
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
