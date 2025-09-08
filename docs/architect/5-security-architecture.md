# 5. Security Architecture

## 5.1 Authentication & Authorization

### 5.1.1 Authentication Strategy
- **Method:** Laravel Sanctum SPA authentication
- **Token Type:** Personal Access Tokens
- **Token Expiry:** 24 hours (configurable)
- **Refresh Strategy:** Automatic token refresh on activity

### 5.1.2 Authorization Levels
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

## 5.2 Data Security

### 5.2.1 Encryption
- **In Transit:** TLS 1.3 for all API communications
- **At Rest:** AES-256 encryption for sensitive data
- **Database:** Encrypted database connections
- **Files:** Encrypted signature files and documents

### 5.2.2 Data Privacy
- **PII Protection:** Hash/encrypt customer personal information
- **GDPR Compliance:** Data retention policies and deletion procedures
- **Access Logging:** Log all data access for audit purposes
- **Data Minimization:** Store only necessary data

## 5.3 API Security

### 5.3.1 Request Security
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

### 5.3.2 Response Security
- **Data Sanitization:** Remove sensitive data from responses
- **CORS Configuration:** Restrict cross-origin requests
- **Security Headers:** Implement security headers (CSP, HSTS, etc.)

## 5.4 File Security

### 5.4.1 Signature Files
- **Storage:** Secure file storage with access controls
- **Encryption:** Encrypt signature files at rest
- **Access Control:** Signed URLs for temporary access
- **Retention:** Automatic deletion after retention period

---
