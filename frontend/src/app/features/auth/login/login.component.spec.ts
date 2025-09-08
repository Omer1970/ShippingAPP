import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';

import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services';
import { User, AuthResponse } from '../../../core/models';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authServiceMock: jasmine.SpyObj<AuthService>;
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

  beforeEach(async () => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', ['login', 'isAuthenticated'], {
      authState$: of({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      })
    });

    await TestBed.configureTestingModule({
      imports: [LoginComponent, ReactiveFormsModule],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceSpy }
      ]
    }).compileComponents();

    authServiceMock = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    routerMock = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should initialize form with empty values', () => {
      expect(component.loginForm).toBeDefined();
      expect(component.loginForm.get('email')?.value).toBe('');
      expect(component.loginForm.get('password')?.value).toBe('');
    });

    it('should set up form validation', () => {
      const emailControl = component.loginForm.get('email');
      const passwordControl = component.loginForm.get('password');

      expect(emailControl?.hasError('required')).toBeTrue();
      expect(passwordControl?.hasError('required')).toBeTrue();
    });

    it('should redirect to dashboard if already authenticated', () => {
      authServiceMock.isAuthenticated.and.returnValue(true);
      spyOn(routerMock, 'navigate');

      const newComponent = new LoginComponent(
        component['fb'],
        authServiceMock,
        routerMock,
        component['route']
      );
      newComponent.ngOnInit();

      expect(routerMock.navigate).toHaveBeenCalledWith(['/dashboard']);
    });
  });

  describe('onSubmit', () => {
    beforeEach(() => {
      authServiceMock.login.and.returnValue(of(mockAuthResponse));
      spyOn(routerMock, 'navigate');
    });

    it('should not submit if form is invalid', () => {
      component.onSubmit();
      expect(authServiceMock.login).not.toHaveBeenCalled();
    });

    it('should submit successfully with valid form', () => {
      component.loginForm.setValue({
        email: 'test@example.com',
        password: 'password123'
      });

      component.onSubmit();

      expect(authServiceMock.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
      expect(routerMock.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should handle login error', () => {
      const errorResponse = { message: 'Invalid credentials' };
      authServiceMock.login.and.returnValue(of(errorResponse).pipe(
        () => { throw errorResponse; }
      ));

      component.loginForm.setValue({
        email: 'test@example.com',
        password: 'wrongpassword'
      });

      component.onSubmit();

      expect(authServiceMock.login).toHaveBeenCalled();
      expect(component.error).toBe('Invalid credentials');
    });
  });

  describe('form validation', () => {
    it('should validate email format', () => {
      const emailControl = component.loginForm.get('email');
      
      emailControl?.setValue('invalid-email');
      expect(emailControl?.hasError('email')).toBeTrue();
      
      emailControl?.setValue('valid@email.com');
      expect(emailControl?.hasError('email')).toBeFalse();
    });

    it('should validate password minimum length', () => {
      const passwordControl = component.loginForm.get('password');
      
      passwordControl?.setValue('12345');
      expect(passwordControl?.hasError('minlength')).toBeTrue();
      
      passwordControl?.setValue('123456');
      expect(passwordControl?.hasError('minlength')).toBeFalse();
    });
  });

  describe('error messages', () => {
    it('should return correct email error message for required', () => {
      component.loginForm.get('email')?.setErrors({ required: true });
      expect(component.getEmailError()).toBe('Email is required');
    });

    it('should return correct email error message for invalid format', () => {
      component.loginForm.get('email')?.setErrors({ email: true });
      expect(component.getEmailError()).toBe('Please enter a valid email address');
    });

    it('should return correct password error message for required', () => {
      component.loginForm.get('password')?.setErrors({ required: true });
      expect(component.getPasswordError()).toBe('Password is required');
    });

    it('should return correct password error message for minlength', () => {
      component.loginForm.get('password')?.setErrors({ minlength: true });
      expect(component.getPasswordError()).toBe('Password must be at least 6 characters long');
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
});