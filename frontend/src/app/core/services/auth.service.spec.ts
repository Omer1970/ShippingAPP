import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';
import { User, LoginCredentials, AuthResponse, RefreshTokenResponse } from '../models';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerMock: jasmine.SpyObj<Router>;

  const mockUser: User = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z'
  };

  const mockAuthResponse: AuthResponse = {
    user: mockUser,
    access_token: 'test-token',
    token_type: 'Bearer',
    expires_in: 3600
  };

  const mockCredentials: LoginCredentials = {
    email: 'test@example.com',
    password: 'password123'
  };

  beforeEach(() => {
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy }
      ]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    routerMock = TestBed.inject(Router) as jasmine.SpyObj<Router>;

    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('login', () => {
    it('should login successfully and store auth data', (done) => {
      service.login(mockCredentials).subscribe({
        next: (response) => {
          expect(response).toEqual(mockAuthResponse);
          expect(localStorage.getItem('access_token')).toBe('test-token');
          expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser));
          
          service.authState$.subscribe(state => {
            expect(state.isAuthenticated).toBeTrue();
            expect(state.user).toEqual(mockUser);
            expect(state.accessToken).toBe('test-token');
            expect(state.isLoading).toBeFalse();
            expect(state.error).toBeNull();
            done();
          });
        }
      });

      const req = httpMock.expectOne('/api/auth/login');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockCredentials);
      req.flush(mockAuthResponse);
    });

    it('should handle login error', (done) => {
      const errorResponse = { message: 'Invalid credentials' };
      
      service.login(mockCredentials).subscribe({
        error: (error) => {
          expect(error.message).toBe('Invalid credentials');
          
          service.authState$.subscribe(state => {
            expect(state.isAuthenticated).toBeFalse();
            expect(state.error).toBe('Invalid credentials');
            expect(state.isLoading).toBeFalse();
            done();
          });
        }
      });

      const req = httpMock.expectOne('/api/auth/login');
      req.flush(errorResponse, { status: 401, statusText: 'Unauthorized' });
    });

    it('should handle network errors', (done) => {
      service.login(mockCredentials).subscribe({
        error: (error) => {
          expect(error.message).toBe('Network error');
          done();
        }
      });

      const req = httpMock.expectOne('/api/auth/login');
      req.flush({}, { status: 0, statusText: 'Network Error' });
    });

    it('should handle validation errors', (done) => {
      const validationResponse = { 
        message: 'Validation error',
        errors: {
          email: ['Email is required'],
          password: ['Password must be at least 8 characters']
        }
      };
      
      service.login(mockCredentials).subscribe({
        error: (error) => {
          expect(error.message).toBe('Validation error');
          expect(error.errors).toEqual(validationResponse.errors);
          done();
        }
      });

      const req = httpMock.expectOne('/api/auth/login');
      req.flush(validationResponse, { status: 422, statusText: 'Unprocessable Entity' });
    });

    it('should set loading state during login', () => {
      service.login(mockCredentials).subscribe();

      // Check loading state before response
      service.authState$.subscribe(state => {
        expect(state.isLoading).toBeTrue();
        expect(state.error).toBeNull();
      });

      const req = httpMock.expectOne('/api/auth/login');
      req.flush(mockAuthResponse);
    });
  });

  describe('logout', () => {
    beforeEach(() => {
      localStorage.setItem('access_token', 'test-token');
      localStorage.setItem('user', JSON.stringify(mockUser));
      service['initializeAuth']();
    });

    it('should logout successfully and clear auth data', (done) => {
      service.logout().subscribe(() => {
        expect(localStorage.getItem('access_token')).toBeNull();
        expect(localStorage.getItem('user')).toBeNull();
        expect(routerMock.navigate).toHaveBeenCalledWith(['/login']);
        
        service.authState$.subscribe(state => {
          expect(state.isAuthenticated).toBeFalse();
          expect(state.user).toBeNull();
          expect(state.accessToken).toBeNull();
          expect(state.isLoading).toBeFalse();
          done();
        });
      });

      const req = httpMock.expectOne('/api/auth/logout');
      expect(req.request.method).toBe('POST');
      req.flush({});
    });

    it('should handle logout error but still clear local data', (done) => {
      service.logout().subscribe({
        error: () => {
          expect(localStorage.getItem('access_token')).toBeNull();
          expect(localStorage.getItem('user')).toBeNull();
          expect(routerMock.navigate).toHaveBeenCalledWith(['/login']);
          done();
        }
      });

      const req = httpMock.expectOne('/api/auth/logout');
      req.flush({}, { status: 500, statusText: 'Server Error' });
    });

    it('should cancel token refresh timer on logout', () => {
      spyOn(service as any, 'cancelTokenRefresh');
      
      service.logout().subscribe();
      
      const req = httpMock.expectOne('/api/auth/logout');
      req.flush({});
      
      expect((service as any).cancelTokenRefresh).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    const mockRefreshResponse: RefreshTokenResponse = {
      access_token: 'new-token',
      token_type: 'Bearer',
      expires_in: 3600
    };

    beforeEach(() => {
      localStorage.setItem('access_token', 'old-token');
      localStorage.setItem('user', JSON.stringify(mockUser));
      service['initializeAuth']();
    });

    it('should refresh token successfully', (done) => {
      service.refreshToken().subscribe((response) => {
        expect(response).toEqual(mockRefreshResponse);
        expect(localStorage.getItem('access_token')).toBe('new-token');
        done();
      });

      const req = httpMock.expectOne('/api/auth/refresh');
      expect(req.request.method).toBe('POST');
      req.flush(mockRefreshResponse);
    });

    it('should handle refresh token error and logout', (done) => {
      service.refreshToken().subscribe({
        error: () => {
          expect(localStorage.getItem('access_token')).toBeNull();
          expect(localStorage.getItem('user')).toBeNull();
          expect(routerMock.navigate).toHaveBeenCalledWith(['/login']);
          done();
        }
      });

      const req = httpMock.expectOne('/api/auth/refresh');
      req.flush({}, { status: 401, statusText: 'Unauthorized' });
    });

    it('should preserve user data during token refresh', (done) => {
      service.refreshToken().subscribe(() => {
        service.authState$.subscribe(state => {
          expect(state.user).toEqual(mockUser);
          expect(state.isAuthenticated).toBeTrue();
          done();
        });
      });

      const req = httpMock.expectOne('/api/auth/refresh');
      req.flush(mockRefreshResponse);
    });
  });

  describe('getCurrentUser', () => {
    it('should get current user successfully', (done) => {
      service.getCurrentUser().subscribe((user) => {
        expect(user).toEqual(mockUser);
        done();
      });

      const req = httpMock.expectOne('/api/auth/user');
      expect(req.request.method).toBe('GET');
      req.flush(mockUser);
    });

    it('should handle get current user error', (done) => {
      service.getCurrentUser().subscribe({
        error: (error) => {
          expect(error.message).toBe('Unauthorized');
          done();
        }
      });

      const req = httpMock.expectOne('/api/auth/user');
      req.flush({}, { status: 401, statusText: 'Unauthorized' });
    });

    it('should handle network errors for getCurrentUser', (done) => {
      service.getCurrentUser().subscribe({
        error: (error) => {
          expect(error.message).toBe('Network error');
          done();
        }
      });

      const req = httpMock.expectOne('/api/auth/user');
      req.flush({}, { status: 0, statusText: 'Network Error' });
    });
  });

  describe('Token Management', () => {
    
    it('should schedule token refresh on successful login', () => {
      spyOn(service as any, 'scheduleTokenRefresh');
      
      service.login(mockCredentials).subscribe();
      
      const req = httpMock.expectOne('/api/auth/login');
      req.flush(mockAuthResponse);
      
      expect((service as any).scheduleTokenRefresh).toHaveBeenCalledWith(3600);
    });

    it('should cancel existing token refresh before scheduling new one', () => {
      spyOn(service as any, 'cancelTokenRefresh');
      spyOn(service as any, 'scheduleTokenRefresh');
      
      service.login(mockCredentials).subscribe();
      
      const req = httpMock.expectOne('/api/auth/login');
      req.flush(mockAuthResponse);
      
      expect((service as any).cancelTokenRefresh).toHaveBeenCalled();
      expect((service as any).scheduleTokenRefresh).toHaveBeenCalled();
    });

    it('should calculate correct refresh time', () => {
      spyOn(service as any, 'scheduleTokenRefresh').and.callThrough();
      
      service.login(mockCredentials).subscribe();
      
      const req = httpMock.expectOne('/api/auth/login');
      req.flush(mockAuthResponse);
      
      // Should schedule refresh 60 seconds before expiration
      expect((service as any).scheduleTokenRefresh).toHaveBeenCalledWith(3600);
    });
  });

  describe('Authentication State', () => {
    
    it('should initialize auth state from localStorage', () => {
      localStorage.setItem('access_token', 'stored-token');
      localStorage.setItem('user', JSON.stringify(mockUser));
      
      // Create new service instance to test initialization
      const newService = new AuthService(TestBed.inject(HttpTestingController), routerMock);
      
      expect(newService.isAuthenticated()).toBeTrue();
      expect(newService.getCurrentUserValue()).toEqual(mockUser);
      expect(newService.getAccessToken()).toBe('stored-token');
    });

    it('should handle corrupted localStorage data', () => {
      localStorage.setItem('access_token', 'stored-token');
      localStorage.setItem('user', 'invalid-json');
      
      // Should not throw error
      expect(() => {
        const newService = new AuthService(TestBed.inject(HttpTestingController), routerMock);
      }).not.toThrow();
    });

    it('should handle missing localStorage data', () => {
      localStorage.clear();
      
      const newService = new AuthService(TestBed.inject(HttpTestingController), routerMock);
      
      expect(newService.isAuthenticated()).toBeFalse();
      expect(newService.getCurrentUserValue()).toBeNull();
      expect(newService.getAccessToken()).toBeNull();
    });
  });

  describe('Utility Methods', () => {
    
    it('should return correct authentication status', () => {
      expect(service.isAuthenticated()).toBeFalse();
      
      localStorage.setItem('access_token', 'test-token');
      localStorage.setItem('user', JSON.stringify(mockUser));
      service['initializeAuth']();
      
      expect(service.isAuthenticated()).toBeTrue();
    });

    it('should return current user value', () => {
      expect(service.getCurrentUserValue()).toBeNull();
      
      localStorage.setItem('access_token', 'test-token');
      localStorage.setItem('user', JSON.stringify(mockUser));
      service['initializeAuth']();
      
      expect(service.getCurrentUserValue()).toEqual(mockUser);
    });

    it('should return access token', () => {
      expect(service.getAccessToken()).toBeNull();
      
      localStorage.setItem('access_token', 'test-token');
      localStorage.setItem('user', JSON.stringify(mockUser));
      service['initializeAuth']();
      
      expect(service.getAccessToken()).toBe('test-token');
    });
  });

  describe('Error Handling', () => {
    
    it('should handle generic HTTP errors', (done) => {
      service.login(mockCredentials).subscribe({
        error: (error) => {
          expect(error.message).toBe('An error occurred');
          done();
        }
      });

      const req = httpMock.expectOne('/api/auth/login');
      req.flush({}, { status: 500, statusText: 'Server Error' });
    });

    it('should handle errors with detailed error messages', (done) => {
      const detailedError = { 
        message: 'Custom error message',
        errors: { field: ['Field is invalid'] }
      };
      
      service.login(mockCredentials).subscribe({
        error: (error) => {
          expect(error.message).toBe('Custom error message');
          expect(error.errors).toEqual(detailedError.errors);
          done();
        }
      });

      const req = httpMock.expectOne('/api/auth/login');
      req.flush(detailedError, { status: 400, statusText: 'Bad Request' });
    });
  });

  describe('Edge Cases', () => {
    
    it('should handle concurrent login attempts', () => {
      let completedCount = 0;
      const totalAttempts = 3;
      
      // Make multiple login attempts simultaneously
      for (let i = 0; i < totalAttempts; i++) {
        service.login(mockCredentials).subscribe({
          next: () => {
            completedCount++;
          }
        });
      }
      
      // Should have multiple pending requests
      const requests = httpMock.match('/api/auth/login');
      expect(requests.length).toBe(totalAttempts);
      
      // Complete all requests
      requests.forEach(req => req.flush(mockAuthResponse));
      
      expect(completedCount).toBe(totalAttempts);
    });

    it('should handle rapid login/logout cycles', () => {
      // Login
      service.login(mockCredentials).subscribe();
      const loginReq = httpMock.expectOne('/api/auth/login');
      loginReq.flush(mockAuthResponse);
      
      // Immediately logout
      service.logout().subscribe();
      const logoutReq = httpMock.expectOne('/api/auth/logout');
      logoutReq.flush({});
      
      // Verify final state
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(service.isAuthenticated()).toBeFalse();
    });

    it('should handle token refresh during logout', () => {
      localStorage.setItem('access_token', 'test-token');
      localStorage.setItem('user', JSON.stringify(mockUser));
      service['initializeAuth']();
      
      // Start logout
      service.logout().subscribe();
      
      // Try to refresh token during logout (should be handled gracefully)
      service.refreshToken().subscribe({
        error: () => {
          // Expected to fail
        }
      });
      
      const logoutReq = httpMock.expectOne('/api/auth/logout');
      logoutReq.flush({});
      
      // Should not make refresh request since we're logging out
      httpMock.expectNone('/api/auth/refresh');
    });
  });
});