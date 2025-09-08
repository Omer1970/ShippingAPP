import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi, HttpClient, HTTP_INTERCEPTORS } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { AuthInterceptor } from './auth.interceptor';
import { AuthService } from '../services';

describe('AuthInterceptor', () => {
  let authServiceMock: jasmine.SpyObj<AuthService>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', ['getAccessToken', 'refreshToken']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        {
          provide: HTTP_INTERCEPTORS,
          useClass: AuthInterceptor,
          multi: true
        },
        { provide: AuthService, useValue: authServiceSpy }
      ]
    });

    authServiceMock = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should be created', () => {
    const interceptor = TestBed.inject(HTTP_INTERCEPTORS);
    expect(interceptor).toBeTruthy();
  });

  describe('intercept', () => {
    it('should add authorization header when token exists', () => {
      authServiceMock.getAccessToken.and.returnValue('test-token');

      const testReq = TestBed.inject(HttpClient).get('/api/test');
      
      const req = httpMock.expectOne('/api/test');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush({});
    });

    it('should not add authorization header when no token exists', () => {
      authServiceMock.getAccessToken.and.returnValue(null);

      const testReq = TestBed.inject(HttpClient).get('/api/test');
      
      const req = httpMock.expectOne('/api/test');
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({});
    });

    it('should handle 401 error and attempt token refresh', () => {
      authServiceMock.getAccessToken.and.returnValue('old-token');
      authServiceMock.refreshToken.and.returnValue(of({
        access_token: 'new-token',
        token_type: 'Bearer',
        expires_in: 3600
      }));

      const testReq = TestBed.inject(HttpClient).get('/api/test');
      
      const req = httpMock.expectOne('/api/test');
      req.flush({}, { status: 401, statusText: 'Unauthorized' });

      const retryReq = httpMock.expectOne('/api/test');
      expect(retryReq.request.headers.get('Authorization')).toBe('Bearer new-token');
      retryReq.flush({});
    });

    it('should logout when token refresh fails', () => {
      authServiceMock.getAccessToken.and.returnValue('old-token');
      authServiceMock.refreshToken.and.returnValue(throwError(() => new Error('Refresh failed')));

      const testReq = TestBed.inject(HttpClient).get('/api/test');
      
      const req = httpMock.expectOne('/api/test');
      req.flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(authServiceMock.refreshToken).toHaveBeenCalled();
    });

    it('should pass through non-401 errors', () => {
      authServiceMock.getAccessToken.and.returnValue('test-token');

      const testReq = TestBed.inject(HttpClient).get('/api/test');
      
      const req = httpMock.expectOne('/api/test');
      req.flush({}, { status: 500, statusText: 'Server Error' });

      testReq.subscribe({
        error: (error) => {
          expect(error.status).toBe(500);
        }
      });
    });
  });
});