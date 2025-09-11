# ShipmentApp Code Standards and Conventions

## PHP/Laravel Standards (Backend)

### Code Style
- Follow PSR-12 coding standards
- Use meaningful variable and method names
- Type hint where possible (PHP 8.1+ features)
- Use PHPDoc for complex methods
- Maximum line length: 120 characters
- Indentation: 4 spaces (no tabs)

### Laravel Conventions
- Use Laravel's built-in features (Eloquent, Validation, etc.)
- Follow naming conventions for controllers, models, migrations
- Use Laravel's service container for dependency injection
- Implement proper middleware for cross-cutting concerns
- Use resource controllers for RESTful endpoints

### File Organization
```
backend/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   ├── Middleware/
│   │   └── Requests/  # Form request validation
│   ├── Models/
│   ├── Services/      # Business logic
│   ├── Repositories/  # Data access layer
│   └── Exceptions/    # Custom exceptions
├── database/
│   ├── migrations/
│   ├── seeders/
│   └── factories/
├── routes/
│   ├── web.php
│   ├── api.php
│   └── channels.php
└── tests/
```

### Naming Conventions
- **Controllers**: PascalCase + Controller suffix (`ShipmentController`)
- **Models**: PascalCase, singular (`User`, `Order`)
- **Methods**: camelCase (`getUserShipments()`)
- **Routes**: kebab-case with meaningful names
- **Database Tables**: snake_case, plural (`users`, `shipments`)
- **Database Columns**: snake_case (`created_at`, `user_id`)

## TypeScript/Angular Standards (Frontend)

### Code Style
- Use Angular style guide and TypeScript best practices
- Strong typing throughout the application
- Use TypeScript strict mode
- Maximum line length: 100 characters
- Use Prettier for formatting (configured in package.json)

### Angular Conventions
- Use standalone components (Angular 17+) where applicable
- Follow reactive programming patterns with RxJS
- Use services for business logic
- Implement proper separation of concerns
- Use Angular CLI for file generation

### File Organization
```
frontend/src/
├── app/
│   ├── core/           # Singleton services, models, guards
│   ├── features/       # Feature modules (auth, dashboard)
│   ├── shared/         # Shared components, pipes, directives
│   └── app.routes.ts   # Root routing configuration
├── environments/       # Environment-specific settings
└── assets/            # Static assets
```

### Naming Conventions
- **Components**: PascalCase with component suffix (`LoginComponent`)
- **Services**: camelCase with service suffix (`authService`)
- **Files**: Kebab-case (`login-form.component.ts`)
- **Methods**: camelCase (`getUser()`)
- **Interfaces**: PascalCase with 'I' prefix (`IUser`, optional)
- **Enums**: PascalCase (`UserRole`)

## Testing Standards

### Backend Testing
- Use PHPUnit for unit and feature tests
- Test file naming: `{ClassName}Test.php`
- Use factories for test data generation
- Follow Arrange-Act-Assert pattern
- Test both success and error scenarios

### Frontend Testing
- Use Jasmine for unit tests
- Test file naming: `{component-name}.spec.ts`
- Test service methods and component behavior
- Mock external dependencies
- Test user interactions and DOM updates

## API Standards

### RESTful API Design
- Use proper HTTP methods (GET, POST, PUT, DELETE)
- Use resource-based URLs (`/api/users`, `/api/shipments`)
- Implement proper HTTP status codes
- Use consistent JSON response format
- Version APIs when necessary (`/api/v1/`)

### Response Format
```json
{
  "data": {
    // Response payload
  },
  "message": "Operation successful",
  "status": "success",
  "errors": []
}
```

## Database Standards

### Migration Standards
- Use descriptive migration names
- Include both up() and down() methods
- Add foreign key constraints properly
- Include indexes for frequently queried columns
- Use consistent column naming conventions

### Model Standards
- Use Eloquent relationships appropriately
- Implement proper validation rules
- Use scopes for common queries
- Follow single responsibility principle
- Document complex business logic

## Security Standards

### Authentication
- Use Laravel Sanctum for API authentication
- Store tokens securely
- Implement proper CORS configuration
- Validate all incoming requests
- Hash passwords properly

### Data Validation
- Validate all user inputs
- Use Laravel's validation rules
- Sanitize data before storage
- Implement proper rate limiting
- Use prepared statements for database queries

## Documentation Standards

### Code Comments
- Use PHPDoc for PHP methods
- Use TypeScript JSDoc for complex functions
- Comment business logic and non-obvious code
- Keep comments up-to-date with code changes
- Use meaningful comment structure

### API Documentation
- Document all API endpoints
- Include request/response examples
- Specify authentication requirements
- Document error responses
- Use consistent documentation format

## Git and Version Control

### Commit Messages
- Use clear, descriptive commit messages
- Follow conventional commits format (optional)
- Reference issue numbers when applicable
- Keep first line under 50 characters
- Add detailed description if needed

### Branch Strategy
- Use feature branches for new development
- Follow naming conventions: `feature/story-description`
- Keep commits focused and atomic
- Review code before merging
- Use pull requests for collaboration

## Performance Guidelines

### Backend Performance
- Use eager loading to prevent N+1 queries
- Implement pagination for large datasets
- Cache frequently accessed data
- Use proper database indexing
- Optimize slow queries

### Frontend Performance
- Lazy load feature modules
- Use OnPush change detection where applicable
- Implement proper unsubscribe patterns
- Optimize bundle size
- Use trackBy functions in *ngFor loops

## Error Handling

### Backend Errors
- Use proper HTTP status codes
- Provide meaningful error messages
- Log errors appropriately
- Handle exceptions gracefully
- Validate all inputs

### Frontend Errors
- Implement global error handling
- Show user-friendly error messages
- Log errors for debugging
- Handle network errors properly
- Provide fallback UI states

## Configuration Management

### Environment Variables
- Use environment variables for configuration
- Never commit secrets to version control
- Use appropriate environment-specific settings
- Document required environment variables
- Validate configuration on startup

### Build Configuration
- Use production builds for deployment
- Optimize build settings appropriately
- Generate source maps for debugging
- Bundle size monitoring
- Enable production optimizations