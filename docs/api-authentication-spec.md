# Authentication API Specification

## Overview

This document specifies the authentication API endpoints for ShipmentApp's Dolibarr-integrated authentication system. All authentication endpoints require HTTPS and follow RESTful conventions.

## Base URL

```
https://api.shipmentapp.com/api
```

## Authentication Headers

All authenticated requests must include the Authorization header:

```
Authorization: Bearer {token}
```

## Endpoints

### POST /auth/login

Authenticate user with Dolibarr credentials.

#### Request

**Headers:**
```
Content-Type: application/json
Accept: application/json
```

**Body:**
```json
{
  "email": "string",
  "password": "string",
  "device_name": "string"
}
```

**Field Descriptions:**
- `email` (required): Valid email address of Dolibarr user
- `password` (required): User's Dolibarr password
- `device_name` (required): Device identifier for token management

#### Response

**Success (200 OK):**
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

**Field Descriptions:**
- `user.id`: Local ShipmentApp user ID
- `user.dolibarr_user_id`: Original Dolibarr user ID
- `user.name`: Full name from Dolibarr
- `user.email`: Email address
- `user.role`: User role (admin|warehouse|driver)
- `token`: Laravel Sanctum API token

**Error Responses:**

**Invalid Credentials (401 Unauthorized):**
```json
{
  "message": "Authentication failed",
  "errors": {
    "email": ["Invalid Dolibarr credentials."]
  }
}
```

**Account Deactivated (401 Unauthorized):**
```json
{
  "message": "Authentication failed",
  "errors": {
    "email": ["Account is deactivated."]
  }
}
```

**Dolibarr Connection Failure (401 Unauthorized):**
```json
{
  "message": "Authentication failed",
  "errors": {
    "email": ["Invalid Dolibarr credentials."]
  }
}
```

**Validation Error (422 Unprocessable Entity):**
```json
{
  "message": "Validation error",
  "errors": {
    "email": ["The email field is required."],
    "password": ["The password field is required."],
    "device_name": ["The device name field is required."]
  }
}
```

**Rate Limited (429 Too Many Requests):**
```json
{
  "message": "Too many attempts. Please try again later."
}
```

### POST /auth/logout

Logout current user and invalidate token.

#### Request

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
Accept: application/json
```

**Body:**
```json
{}
```

#### Response

**Success (200 OK):**
```json
{
  "message": "Logout successful"
}
```

**Error (401 Unauthorized):**
```json
{
  "message": "Unauthenticated."
}
```

### GET /auth/user

Get current authenticated user information.

#### Request

**Headers:**
```
Authorization: Bearer {token}
Accept: application/json
```

#### Response

**Success (200 OK):**
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

**Error (401 Unauthorized):**
```json
{
  "message": "Unauthenticated."
}
```

### POST /auth/refresh

Refresh authentication token.

#### Request

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
Accept: application/json
```

**Body:**
```json
{}
```

#### Response

**Success (200 OK):**
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

**Error (401 Unauthorized):**
```json
{
  "message": "Unauthenticated."
}
```

## Error Handling

### Standard Error Response Format

```json
{
  "message": "Error description",
  "errors": {
    "field_name": ["Array of field-specific errors"]
  }
}
```

### Common Error Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid request format |
| 401 | Unauthorized - Invalid or expired token |
| 422 | Unprocessable Entity - Validation errors |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |
| 502 | Bad Gateway - Dolibarr connection failed |
| 504 | Gateway Timeout - Dolibarr timeout |

## Rate Limiting

### Login Endpoint
- **Limit**: 60 requests per minute
- **Scope**: Per IP address
- **Headers**: Includes rate limit information

### Example Rate Limit Headers
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1640995200
```

## Security Considerations

### Password Security
- Passwords are validated against Dolibarr's hash format (MD5 or bcrypt)
- No password storage in ShipmentApp database
- Passwords never logged or cached

### Token Security
- Tokens expire after 24 hours
- Each device gets a unique token
- Tokens can be revoked individually

### Connection Security
- All requests require HTTPS
- Dolibarr database uses read-only connection
- Connection timeouts configured (5 seconds)

## Frontend Integration

### Angular Service Example

```typescript
// Login
this.authService.login({
  email: 'user@example.com',
  password: 'password123',
  device_name: 'Chrome Desktop'
}).subscribe({
  next: (response) => {
    // Login successful
    console.log('User:', response.user);
    console.log('Token:', response.token);
  },
  error: (error) => {
    // Handle errors
    if (error.status === 401) {
      // Invalid credentials
    } else if (error.status === 502) {
      // Dolibarr connection failed
    }
  }
});
```

### Error Handling Example

```typescript
handleLoginError(error: any): string {
  if (error.status === 0) {
    return 'Network error - Dolibarr connection failed';
  } else if (error.status === 401) {
    return 'Invalid Dolibarr credentials';
  } else if (error.status === 502) {
    return 'Dolibarr ERP system is unavailable';
  } else if (error.status === 504) {
    return 'Dolibarr connection timeout';
  }
  return 'An error occurred during authentication';
}
```

## Testing

### API Testing Examples

```bash
# Successful login
curl -X POST https://api.shipmentapp.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "driver@company.com",
    "password": "secure_password",
    "device_name": "Test Device"
  }'

# Get current user
curl -X GET https://api.shipmentapp.com/api/auth/user \
  -H "Authorization: Bearer 1|abc123def456..."

# Logout
curl -X POST https://api.shipmentapp.com/api/auth/logout \
  -H "Authorization: Bearer 1|abc123def456..."
```

## Performance

### Response Time Targets
- Login: < 500ms
- Token validation: < 100ms
- User retrieval: < 200ms

### Caching
- User data cached for 1 hour
- Session data stored in Redis
- Connection pooling enabled

## Monitoring

### Key Metrics
- Authentication success rate
- Average response time
- Dolibarr connection health
- Error rate by type

### Health Check Endpoint
```
GET /api/auth/health
```

**Response:**
```json
{
  "status": "healthy",
  "dolibarr_connected": true,
  "redis_connected": true,
  "timestamp": "2023-01-01T00:00:00Z"
}
```

## Version History

### v1.0.0
- Initial Dolibarr authentication integration
- Basic login/logout functionality
- User synchronization
- Role mapping

### v1.1.0
- Added device name support
- Enhanced error handling
- Improved connection failure handling
- Added comprehensive logging

## Support

For API integration support:

1. Check API logs for detailed error information
2. Verify Dolibarr database connectivity
3. Review authentication configuration
4. Monitor rate limiting status
5. Check SSL certificate validity

For additional support, provide:
- Request/response details
- Error messages and status codes
- Timestamp of the issue
- User agent information