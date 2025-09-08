import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { of } from 'rxjs';

import { PublicGuard } from './public.guard';
import { AuthService } from '../services';
import { User } from '../models';

describe('PublicGuard', () => {
  let guard: PublicGuard;
  let authServiceMock: jasmine.SpyObj<AuthService>;
  let routerMock: jasmine.SpyObj<Router>;

  const mockUser: User = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z'
  };

  const mockRoute = {
    queryParams: {}
  } as ActivatedRouteSnapshot;
  const mockRouterState = {} as RouterStateSnapshot;

  beforeEach(() => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', [''], {
      authState$: of({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      })
    });

    const routerSpy = jasmine.createSpyObj('Router', ['createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        PublicGuard,
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    });

    guard = TestBed.inject(PublicGuard);
    authServiceMock = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    routerMock = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  describe('canActivate', () => {
    it('should return true when user is not authenticated', (done) => {
      const result = guard.canActivate(mockRoute, mockRouterState);
      if (result instanceof Observable) {
        result.subscribe((res: boolean | UrlTree) => {
          expect(res).toBeTrue();
          done();
        });
      } else {
        expect(result).toBeTrue();
        done();
      }
    });

    it('should redirect to dashboard when user is authenticated', (done) => {
      authServiceMock.authState$ = of({
        user: mockUser,
        accessToken: 'test-token',
        isAuthenticated: true,
        isLoading: false,
        error: null
      });

      const mockUrlTree = {} as UrlTree;
      routerMock.createUrlTree.and.returnValue(mockUrlTree);

      const result = guard.canActivate(mockRoute, mockRouterState);
      if (result instanceof Observable) {
        result.subscribe((res: boolean | UrlTree) => {
          expect(res).toBe(mockUrlTree);
          expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
          done();
        });
      }
    });

    it('should redirect to returnUrl when provided in query params', (done) => {
      authServiceMock.authState$ = of({
        user: mockUser,
        accessToken: 'test-token',
        isAuthenticated: true,
        isLoading: false,
        error: null
      });

      const testRoute = {
        queryParams: { returnUrl: '/profile' }
      } as unknown as ActivatedRouteSnapshot;

      const mockUrlTree = {} as UrlTree;
      routerMock.createUrlTree.and.returnValue(mockUrlTree);

      const result = guard.canActivate(testRoute, mockRouterState);
      if (result instanceof Observable) {
        result.subscribe(() => {
          expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/profile']);
          done();
        });
      }
    });
  });
});