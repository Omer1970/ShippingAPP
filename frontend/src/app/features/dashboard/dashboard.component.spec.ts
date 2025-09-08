import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';

import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../core/services';
import { User } from '../../core/models';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let authServiceMock: jasmine.SpyObj<AuthService>;
  let routerMock: jasmine.SpyObj<Router>;

  const mockUser: User = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z'
  };

  beforeEach(async () => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', ['logout', 'getCurrentUser'], {
      authState$: of({
        user: mockUser,
        accessToken: 'test-token',
        isAuthenticated: true,
        isLoading: false,
        error: null
      })
    });

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceSpy }
      ]
    }).compileComponents();

    authServiceMock = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    routerMock = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should set current user from auth state', () => {
      expect(component.currentUser).toEqual(mockUser);
      expect(component.isLoading).toBeFalse();
    });

    it('should call getCurrentUser if no user in state', () => {
      authServiceMock.authState$ = of({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });

      authServiceMock.getCurrentUser.and.returnValue(of(mockUser));

      const newComponent = new DashboardComponent(authServiceMock, routerMock);
      newComponent.ngOnInit();

      expect(authServiceMock.getCurrentUser).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    beforeEach(() => {
      authServiceMock.logout.and.returnValue(of(void 0));
      spyOn(routerMock, 'navigate');
    });

    it('should logout successfully and navigate to login', () => {
      component.logout();

      expect(authServiceMock.logout).toHaveBeenCalled();
      expect(routerMock.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should handle logout error and still navigate to login', () => {
      authServiceMock.logout.and.returnValue(of(void 0).pipe(
        () => { throw new Error('Logout failed'); }
      ));

      component.logout();

      expect(authServiceMock.logout).toHaveBeenCalled();
      expect(routerMock.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('ngOnDestroy', () => {
    it('should complete destroy subject', () => {
      spyOn(component['destroy$'], 'next');
      spyOn(component['destroy$'], 'complete');

      component.ngOnDestroy();

      expect(component['destroy$'].next).toHaveBeenCalled();
      expect(component['destroy$'].complete).toHaveBeenCalled();
    });
  });

  describe('template rendering', () => {
    it('should display user name in welcome message', () => {
      const compiled = fixture.nativeElement;
      const welcomeElement = compiled.querySelector('.user-name');
      expect(welcomeElement.textContent).toContain('Welcome, Test User');
    });

    it('should display user details', () => {
      const compiled = fixture.nativeElement;
      const userDetails = compiled.querySelectorAll('.detail-row');
      
      expect(userDetails.length).toBeGreaterThan(0);
      expect(userDetails[0].textContent).toContain('Test User');
      expect(userDetails[1].textContent).toContain('test@example.com');
    });

    it('should call logout when logout button is clicked', () => {
      spyOn(component, 'logout');
      const compiled = fixture.nativeElement;
      const logoutButton = compiled.querySelector('.btn-logout');
      
      logoutButton.click();
      
      expect(component.logout).toHaveBeenCalled();
    });
  });
});