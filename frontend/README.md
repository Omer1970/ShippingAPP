# Angular Authentication System

A complete Angular frontend authentication system designed to work with Laravel backend API.

## Features

- **User Authentication**: Login/logout functionality with JWT token management
- **Route Protection**: Auth guards for protecting authenticated routes
- **Token Management**: Automatic token refresh and HTTP interceptor for API requests
- **Reactive Forms**: Form validation with Angular Reactive Forms
- **Error Handling**: Comprehensive error handling and user feedback
- **Responsive Design**: Mobile-friendly UI with SCSS styling
- **Unit Testing**: Complete test coverage with Jasmine and Karma

## API Endpoints

The system integrates with the following Laravel backend endpoints:

- `POST /api/auth/login` - User authentication
- `POST /api/auth/logout` - User logout
- `GET /api/auth/user` - Get current user profile
- `POST /api/auth/refresh` - Refresh authentication token

## Project Structure

```
src/
├── app/
│   ├── core/
│   │   ├── models/          # TypeScript interfaces
│   │   ├── services/        # Authentication and error services
│   │   ├── guards/          # Route protection guards
│   │   └── interceptors/    # HTTP interceptors
│   ├── features/
│   │   ├── auth/            # Authentication feature module
│   │   └── dashboard/       # Protected dashboard
│   ├── shared/              # Shared components and validators
│   └── app.*               # Main app configuration
├── environments/            # Environment configurations
└── styles.scss             # Global styles
```

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Update `src/environments/environment.ts` with your API URL:
   ```typescript
   export const environment = {
     production: false,
     apiUrl: 'http://localhost:8000',  // Your Laravel backend URL
     apiPrefix: '/api'
   };
   ```

3. **Start development server:**
   ```bash
   ng serve
   ```

4. **Build for production:**
   ```bash
   ng build --configuration production
   ```

## Configuration

### Backend Integration

Ensure your Laravel backend is configured to:
- Accept CORS requests from your Angular app
- Return proper JWT tokens with user data
- Handle token refresh requests
- Provide user profile endpoints

### Environment Variables

Update the environment files based on your deployment:

- `src/environments/environment.ts` - Development
- `src/environments/environment.prod.ts` - Production

## Usage

### Authentication Flow

1. **Login**: Users access `/login` to authenticate
2. **Dashboard**: Authenticated users are redirected to `/dashboard`
3. **Token Management**: Automatic token refresh on expiration
4. **Logout**: Clears tokens and redirects to login

### Route Protection

- **AuthGuard**: Protects authenticated routes
- **PublicGuard**: Prevents authenticated users from accessing login

### Services

- **AuthService**: Handles authentication logic and state management
- **ErrorService**: Global error handling and user notifications

## Testing

Run the test suite:

```bash
# Run all tests
ng test

# Run tests with coverage
ng test --code-coverage

# Run tests in watch mode
ng test --watch
```

## Components

### LoginComponent
- Reactive form with email/password validation
- Error handling and user feedback
- Loading states and accessibility

### DashboardComponent
- Protected route requiring authentication
- User profile display
- Logout functionality

## Interceptors

### AuthInterceptor
- Automatically adds JWT tokens to API requests
- Handles 401 errors with token refresh
- Prevents multiple simultaneous refresh requests

### ErrorInterceptor
- Global HTTP error handling
- User-friendly error messages
- Status code-based error categorization

## Best Practices

1. **Type Safety**: Strong TypeScript typing throughout
2. **Reactive Programming**: RxJS for async operations
3. **Separation of Concerns**: Clear module structure
4. **Error Handling**: Comprehensive error management
5. **Testing**: Unit tests for all services and components
6. **Security**: Secure token storage and management

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

This project is part of the authentication system implementation. Follow your organization's licensing guidelines. 

## Support

For issues or questions:
1. Check the test files for usage examples
2. Review the component documentation
3. Ensure backend API compatibility

---

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
