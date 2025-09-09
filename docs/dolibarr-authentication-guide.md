# Dolibarr Authentication Integration Guide

## Overview

This document provides comprehensive information about the Dolibarr ERP authentication integration in ShipmentApp. The system allows users to authenticate using their existing Dolibarr credentials, eliminating the need for separate user management.

## Architecture

### Backend Components

#### 1. DolibarrAuthService (`app/Services/DolibarrAuthService.php`)
- **Purpose**: Handles authentication against Dolibarr database
- **Key Methods**:
  - `authenticate($email, $password)`: Validates user credentials
  - `getUserById($dolibarrUserId)`: Retrieves user data by Dolibarr ID
  - `testConnection()`: Verifies Dolibarr database connectivity
  - `clearUserCache($email)`: Clears cached user data

#### 2. AuthController (`app/Http/Controllers/Api/AuthController.php`)
- **Purpose**: API endpoints for authentication
- **Endpoints**:
  - `POST /api/auth/login`: User login
  - `POST /api/auth/logout`: User logout
  - `GET /api/auth/user`: Get current user
  - `POST /api/auth/refresh`: Refresh authentication token

#### 3. SyncDolibarrUsers Command (`app/Console/Commands/SyncDolibarrUsers.php`)
- **Purpose**: Synchronizes users from Dolibarr to local cache
- **Usage**:
  ```bash
  php artisan dolibarr:sync-users              # Sync all active users
  php artisan dolibarr:sync-users --full       # Full sync with deactivation
  php artisan dolibarr:sync-users --since="2023-01-01"  # Sync since date
  php artisan dolibarr:sync-users --dry-run    # Preview changes
  ```

### Frontend Components

#### 1. AuthService (`src/app/core/services/auth.service.ts`)
- **Purpose**: Handles authentication state and API communication
- **Key Features**:
  - Dolibarr connection status tracking
  - Automatic error handling for ERP issues
  - Token management with Sanctum integration

#### 2. LoginComponent (`src/app/features/auth/login/login.component.ts`)
- **Purpose**: User login interface
- **Features**:
  - Dolibarr-specific error messages
  - Connection failure handling
  - Device name detection for token management

#### 3. AuthGuard (`src/app/core/guards/auth.guard.ts`)
- **Purpose**: Route protection
- **Features**: Graceful handling of authentication failures

## Configuration

### Environment Variables

```bash
# Dolibarr Database Configuration
DOLIBARR_DB_HOST=127.0.0.1
DOLIBARR_DB_PORT=3306
DOLIBARR_DB_DATABASE=dolibarr
DOLIBARR_DB_USERNAME=readonly
DOLIBARR_DB_PASSWORD=your_password

# Authentication Settings
AUTH_TOKEN_EXPIRY=24
AUTH_RATE_LIMIT=60
```

### Database Configuration

The system connects to Dolibarr using a read-only database connection configured in `config/database.php`:

```php
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
    'options' => [
        PDO::ATTR_TIMEOUT => 5,
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ],
],
```

## Authentication Flow

### 1. User Login Process

```
User → Frontend Login → AuthService → AuthController → DolibarrAuthService
                                                           ↓
User ← Frontend Response ← AuthService ← AuthController ← Dolibarr DB
```

### 2. Detailed Steps

1. **User submits credentials** via login form
2. **Frontend validates** form inputs
3. **AuthService sends request** to `/api/auth/login`
4. **AuthController validates** request data
5. **DolibarrAuthService authenticates** against Dolibarr database
6. **User data is cached** in Redis for performance
7. **Local user record** is created/updated with Dolibarr data
8. **Sanctum token** is generated and returned
9. **Frontend stores** token and user data

### 3. User Synchronization

```
Cron Job → SyncDolibarrUsers → Dolibarr DB → Local Users
```

## Role Mapping

Dolibarr users are mapped to ShipmentApp roles based on:

1. **Admin Rights**: Users with `admin = 1` in Dolibarr → `admin` role
2. **Group Membership**: Based on Dolibarr user groups:
   - Groups containing "warehouse" or "logistics" → `warehouse` role
   - Groups containing "driver" or "delivery" → `driver` role
3. **Default**: Users without specific groups → `driver` role

## Error Handling

### Dolibarr Connection Failures

The system handles various connection scenarios:

- **Network Timeouts**: Returns user-friendly error messages
- **Database Unavailable**: Graceful degradation with cached data
- **Authentication Failures**: Clear error messages for invalid credentials
- **Permission Issues**: Read-only access prevents data corruption

### Frontend Error Messages

- **Connection Errors**: "Dolibarr connection failed. Please try again later."
- **Invalid Credentials**: "Invalid Dolibarr credentials"
- **Network Issues**: "Network error - Dolibarr connection failed"
- **Server Errors**: "Server error - Dolibarr integration issue"

## Security Considerations

### 1. Read-Only Access

- Dolibarr database connection uses read-only credentials
- No write operations performed against Dolibarr
- User modifications only affect local cache

### 2. Data Sanitization

- All user input is validated and sanitized
- SQL injection prevention through Laravel's query builder
- XSS protection in frontend components

### 3. Token Security

- Laravel Sanctum provides secure token management
- Tokens expire after 24 hours
- Rate limiting prevents brute force attacks

### 4. Caching Strategy

- User data cached in Redis with 1-hour TTL
- Password hashes never cached
- Secure cache key generation

## Performance Optimization

### 1. Caching

- **User Cache**: 1-hour TTL for Dolibarr user data
- **Connection Pooling**: Efficient database connections
- **Redis Sessions**: Fast session storage

### 2. Query Optimization

- **Indexed Fields**: Email and dolibarr_user_id fields indexed
- **Selective Queries**: Only active users queried
- **Batch Operations**: Sync command processes users efficiently

## Testing

### Backend Tests

- **Unit Tests**: DolibarrAuthService functionality
- **Feature Tests**: API endpoint integration
- **Sync Tests**: User synchronization scenarios

### Frontend Tests

- **Service Tests**: AuthService behavior
- **Component Tests**: Login form validation
- **Integration Tests**: Authentication flow

## Monitoring and Logging

### Logged Events

- Authentication attempts (success/failure)
- Dolibarr connection failures
- User synchronization results
- Token refresh operations

### Monitoring Metrics

- Authentication success rate
- Dolibarr connection health
- Response times for auth endpoints
- Cache hit rates

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   - Check Dolibarr database connectivity
   - Verify firewall settings
   - Review connection pool configuration

2. **Authentication Failures**
   - Verify Dolibarr user status (active/inactive)
   - Check password hash compatibility
   - Review role mapping configuration

3. **Sync Issues**
   - Check Dolibarr database permissions
   - Verify user group configurations
   - Review sync command logs

### Debug Commands

```bash
# Test Dolibarr connection
php artisan tinker
>\App\Services\DolibarrAuthService::testConnection()

# Manual user sync
php artisan dolibarr:sync-users --dry-run

# Check authentication logs
tail -f storage/logs/laravel.log | grep -i "dolibarr"
```

## Deployment Checklist

- [ ] Dolibarr database connection configured
- [ ] Read-only database user created
- [ ] Environment variables set
- [ ] Redis cache configured
- [ ] Sync command scheduled (cron)
- [ ] SSL/TLS certificates installed
- [ ] Rate limiting configured
- [ ] Monitoring alerts set up

## API Reference

### Authentication Endpoints

#### POST /api/auth/login
**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "device_name": "iPhone 14 Pro"
}
```

**Response (Success):**
```json
{
  "user": {
    "id": 1,
    "dolibarr_user_id": 456,
    "name": "John Driver",
    "email": "driver@company.com",
    "role": "driver"
  },
  "token": "1|abc123def456..."
}
```

**Response (Error):**
```json
{
  "message": "Authentication failed",
  "errors": {
    "email": ["Invalid Dolibarr credentials."]
  }
}
```

#### POST /api/auth/logout
**Response:**
```json
{
  "message": "Logout successful"
}
```

#### GET /api/auth/user
**Response:**
```json
{
  "user": {
    "id": 1,
    "dolibarr_user_id": 456,
    "name": "John Driver",
    "email": "driver@company.com",
    "role": "driver"
  }
}
```

## Support

For issues related to Dolibarr authentication integration:

1. Check application logs in `storage/logs/laravel.log`
2. Verify Dolibarr database connectivity
3. Review sync command output
4. Check Redis cache status
5. Validate environment configuration

For additional support, refer to the troubleshooting section or contact the development team.