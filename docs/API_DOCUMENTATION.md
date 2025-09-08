# ShipmentApp Authentication API Documentation

## Overview

The ShipmentApp Authentication API provides secure user authentication using Laravel Sanctum tokens. This documentation covers all authentication endpoints, request/response formats, error handling, and security considerations.

## Base URL

```
Production: https://api.shipmentapp.com/api
Development: http://localhost:8000/api
```

## Authentication

The API uses Bearer token authentication with Laravel Sanctum. Include the token in the Authorization header:

```
Authorization: Bearer {your_access_token}
```

## Rate Limiting

Authentication endpoints are rate-limited to prevent brute force attacks:
- Login attempts: 60 requests per minute per IP
- Other auth endpoints: Standard API rate limits apply

## Endpoints

### 1. User Login

**POST** `/auth/login`

Authenticates a user and returns an access token.

#### Request

**Headers:**
```
Content-Type: application/json
Accept: application/json
```

**Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "device_name": "web_browser"
}
```

**Field Requirements:**
- `email` (string, required): Valid email address
- `password` (string, required): Minimum 8 characters
- `device_name` (string, required): Device identifier for token management

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "user@example.com",
      "email_verified_at": "2024-01-15T10:30:00Z",
      "created_at": "2024-01-01T08:00:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    },
    "token": "1|laravel_sanctum_token_here",
    "expires_at": "2024-01-16T10:30:00Z"
  }
}
```

#### Error Responses

**401 Unauthorized - Invalid Credentials:**
```json
{
  "success": false,
  "message": "Authentication failed",
  "errors": {
    "email": ["The provided credentials are incorrect."]
  }
}
```

**401 Unauthorized - Account Deactivated:**
```json
{
  "success": false,
  "message": "Authentication failed",
  "errors": {
    "email": ["Your account has been deactivated."]
  }
}
```

**422 Unprocessable Entity - Validation Error:**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": {
    "email": ["The email field is required."],
    "password": ["The password field is required."]
  }
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "message": "An error occurred during authentication",
  "errors": {
    "general": ["Please try again later."]
  }
}
```

### 2. Get Current User

**GET** `/auth/user`

Retrieves the currently authenticated user's profile.

#### Request

**Headers:**
```
Authorization: Bearer {access_token}
Accept: application/json
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "User profile retrieved successfully",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "user@example.com",
      "email_verified_at": "2024-01-15T10:30:00Z",
      "created_at": "2024-01-01T08:00:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  }
}
```

#### Error Responses

**401 Unauthorized:**
```json
{
  "success": false,
  "message": "User not authenticated"
}
```

### 3. User Logout

**POST** `/auth/logout`

Logs out the authenticated user and revokes all access tokens.

#### Request

**Headers:**
```
Authorization: Bearer {access_token}
Accept: application/json
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Logout successful"
}
```

#### Error Responses

**500 Internal Server Error:**
```json
{
  "success": false,
  "message": "An error occurred during logout",
  "errors": {
    "general": ["Please try again later."]
  }
}
```

### 4. Refresh Token

**POST** `/auth/refresh`

Refreshes the current access token and revokes the old one.

#### Request

**Headers:**
```
Authorization: Bearer {current_access_token}
Accept: application/json
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "user@example.com",
      "email_verified_at": "2024-01-15T10:30:00Z",
      "created_at": "2024-01-01T08:00:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    },
    "token": "2|new_laravel_sanctum_token_here",
    "expires_at": "2024-01-16T12:30:00Z"
  }
}
```

#### Error Responses

**401 Unauthorized:**
```json
{
  "success": false,
  "message": "User not authenticated"
}
```

### 5. Health Check

**GET** `/health`

Public endpoint to check API health status.

#### Request

**Headers:**
```
Accept: application/json
```

#### Success Response (200 OK)

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0"
}
```

## Data Models

### User Model

```json
{
  "id": 1,
  "name": "John Doe",
  "email": "user@example.com",
  "email_verified_at": "2024-01-15T10:30:00Z",
  "created_at": "2024-01-01T08:00:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### Auth Response

```json
{
  "user": { ...User },
  "access_token": "string",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

## Error Handling

All API responses follow a consistent error format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": {
    "field_name": ["Error message 1", "Error message 2"],
    "general": ["General error message"]
  }
}
```

### Common HTTP Status Codes

- **200 OK**: Successful request
- **401 Unauthorized**: Authentication required or failed
- **422 Unprocessable Entity**: Validation errors
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

## Security Considerations

### 1. Token Security
- Tokens expire after a configurable period (default: 24 hours)
- Tokens are automatically refreshed before expiration
- All tokens are revoked on logout
- Use HTTPS in production to prevent token interception

### 2. Rate Limiting
- Login attempts are rate-limited to prevent brute force attacks
- Implement account lockout after repeated failed attempts
- Monitor for suspicious login patterns

### 3. Password Requirements
- Minimum 8 characters
- Should include uppercase, lowercase, numbers, and special characters
- Passwords are hashed using bcrypt with appropriate cost factor

### 4. Input Validation
- All inputs are validated on the server-side
- Sanitize user inputs to prevent XSS and SQL injection
- Use prepared statements for database queries

### 5. CORS Configuration
- Configure CORS appropriately for your domains
- Only allow necessary HTTP methods
- Implement proper preflight handling

## Best Practices

### Client Implementation

1. **Token Storage**: Store tokens securely (httpOnly cookies preferred over localStorage)
2. **Token Refresh**: Implement automatic token refresh before expiration
3. **Error Handling**: Handle network errors and retry with exponential backoff
4. **Logout**: Always call the logout endpoint when user logs out
5. **Token Validation**: Validate token expiration before making API calls

### Frontend Example (Angular)

```typescript
// Login example
this.authService.login(credentials).subscribe({
  next: (response) => {
    // Store token securely
    localStorage.setItem('access_token', response.access_token);
    // Redirect to dashboard
    this.router.navigate(['/dashboard']);
  },
  error: (error) => {
    // Handle login error
    console.error('Login failed:', error.message);
  }
});

// API call with token
const headers = new HttpHeaders({
  'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
  'Content-Type': 'application/json'
});

this.http.get('/api/protected-endpoint', { headers }).subscribe(
  response => console.log(response),
  error => {
    if (error.status === 401) {
      // Token expired, redirect to login
      this.router.navigate(['/login']);
    }
  }
);
```

### Backend Integration

```php
// Middleware to protect routes
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/protected-endpoint', [ProtectedController::class, 'index']);
});

// Access authenticated user
public function index(Request $request)
{
    $user = $request->user();
    return response()->json(['user' => $user]);
}
```

## Rate Limiting Headers

Responses include rate limiting information:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1642233600
```

## Monitoring and Logging

### Authentication Events Logged
- Successful logins
- Failed login attempts
- Logouts
- Token refreshes
- Account lockouts

### Security Monitoring
- Monitor for brute force attempts
- Track unusual login patterns
- Alert on multiple failed attempts from same IP
- Monitor token refresh patterns

## Testing

### Test Endpoints

Use the following test credentials for development:

```
Email: test@example.com
Password: password123
```

### cURL Examples

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "device_name": "test_device"
  }'

# Get user profile
curl -X GET http://localhost:8000/api/auth/user \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Logout
curl -X POST http://localhost:8000/api/auth/logout \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Refresh token
curl -X POST http://localhost:8000/api/auth/refresh \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Versioning

API versioning is handled through URL versioning:
- Current version: `/api/v1/`
- Future versions: `/api/v2/`, etc.

## Support

For API support, please contact:
- Email: api-support@shipmentapp.com
- Documentation: https://docs.shipmentapp.com
- Status Page: https://status.shipmentapp.com

## Changelog

### v1.0.0 (Current)
- Initial authentication API release
- Login/logout functionality
- Token refresh mechanism
- User profile retrieval
- Rate limiting implementation