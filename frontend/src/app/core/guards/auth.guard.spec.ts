import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { of } from 'rxjs';

import { AuthGuard } from './auth.guard';
import { AuthService } from '../services';
import { User } from '../models';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let authServiceMock: jasmine.SpyObj<AuthService>;
  let routerMock: jasmine.SpyObj<Router>;

  const mockUser: User = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z'
  };

  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockRouterState = { url: '/dashboard' } as RouterStateSnapshot;

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
        AuthGuard,
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    });

    guard = TestBed.inject(AuthGuard);
    authServiceMock = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    routerMock = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  describe('canActivate', () => {
    it('should return true when user is authenticated', (done) => {
      authServiceMock.authState$ = of({
        user: mockUser,
        accessToken: 'test-token',
        isAuthenticated: true,
        isLoading: false,
        error: null
      });

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

    it('should redirect to login when user is not authenticated', (done) => {
      const mockUrlTree = {} as UrlTree;
      routerMock.createUrlTree.and.returnValue(mockUrlTree);

      const result = guard.canActivate(mockRoute, mockRouterState);
      if (result instanceof Observable) {
        result.subscribe((res: boolean | UrlTree) => {
          expect(res).toBe(mockUrlTree);
          expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/login'], {
            queryParams: { returnUrl: '/dashboard' }
          });
          done();
        });
      }
    });

    it('should include returnUrl in query params', (done) => {
      const testState = { url: '/protected/route' } as RouterStateSnapshot;
      const mockUrlTree = {} as UrlTree;
      routerMock.createUrlTree.and.returnValue(mockUrlTree);

      const result = guard.canActivate(mockRoute, testState);
      if (result instanceof Observable) {
        result.subscribe(() => {
          expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/login'], {
            queryParams: { returnUrl: '/protected/route' }
          });
          done();
        });
      }
    });
  });
});