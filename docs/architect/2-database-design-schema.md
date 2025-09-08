# 2. Database Design & Schema

## 2.1 Database Architecture

### 2.1.1 Primary Application Database (MySQL)
**Purpose:** Store application-specific data, user sessions, cached ERP data

### 2.1.2 ERP Database Integration (Dolibarr)
**Purpose:** Read-only access to orders, customers, shipments data

## 2.2 Application Database Schema

### 2.2.1 Users Table
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

### 2.2.2 Delivery Confirmations Table
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

### 2.2.3 ERP Sync Log Table
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

### 2.2.4 User Sessions Table (Laravel Sanctum)
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

## 2.3 Dolibarr ERP Database Integration

### 2.3.1 Key Dolibarr Tables (Read-Only Access)
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

### 2.3.2 Database Connection Strategy
- **Read-Only Connection:** Separate MySQL connection for Dolibarr
- **Connection Pooling:** Optimize database connections
- **Query Optimization:** Use indexes and limit result sets
- **Caching Strategy:** Cache frequently accessed data in Redis

---
