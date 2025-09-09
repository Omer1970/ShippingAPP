import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, timer } from 'rxjs';
import { catchError, map, tap, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';

import { User } from '../models/user.model';
import { LoginResponse, LoginCredentials, AuthState } from '../models/auth.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = `${environment.apiUrl}${environment.apiPrefix}/auth`;
  private readonly TOKEN_KEY = 'access_token';
  private readonly USER_KEY = 'user';
  
  private authStateSubject = new BehaviorSubject<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    isDolibarrConnected: true
  });
  
  public authState$ = this.authStateSubject.asObservable();
  
  private refreshTokenTimer: any;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.initializeAuth();
  }

  private initializeAuth(): void {
    const token = this.getStoredToken();
    const user = this.getStoredUser();
    
    if (token && user) {
      this.updateAuthState({
        user,
        token: token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        isDolibarrConnected: true
      });
    }
  }

  private getStoredToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private getStoredUser(): User | null {
    const userData = localStorage.getItem(this.USER_KEY);
    return userData ? JSON.parse(userData) : null;
  }

  private storeAuthData(token: string, user: User): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  private clearAuthData(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  private updateAuthState(state: Partial<AuthState>): void {
    const currentState = this.authStateSubject.value;
    this.authStateSubject.next({ ...currentState, ...state });
  }

  private scheduleTokenRefresh(expiresIn: number): void {
    this.cancelTokenRefresh();
    
    const refreshTime = Math.max((expiresIn - 60) * 1000, 60000);
    
    this.refreshTokenTimer = timer(refreshTime).subscribe(() => {
      this.refreshToken().subscribe();
    });
  }

  private cancelTokenRefresh(): void {
    if (this.refreshTokenTimer) {
      this.refreshTokenTimer.unsubscribe();
      this.refreshTokenTimer = null;
    }
  }

  login(credentials: LoginCredentials): Observable<LoginResponse> {
    this.updateAuthState({ isLoading: true, error: null });
    
    return this.http.post<LoginResponse>(`${this.API_URL}/login`, credentials).pipe(
      tap(response => {
        this.handleAuthSuccess(response);
      }),
      catchError(this.handleAuthError.bind(this)),
      tap(() => {
        this.updateAuthState({ isLoading: false });
      })
    );
  }

  logout(): Observable<void> {
    this.updateAuthState({ isLoading: true });
    
    return this.http.post<void>(`${this.API_URL}/logout`, {}).pipe(
      catchError(error => {
        console.error('Logout error:', error);
        return throwError(() => error);
      }),
      tap(() => {
        this.handleLogout();
      }),
      tap(() => {
        this.updateAuthState({ isLoading: false });
      })
    );
  }

  refreshToken(): Observable<{ user: User }> {
    return this.http.post<{ user: User }>(`${this.API_URL}/refresh`, {}).pipe(
      tap(response => {
        const currentToken = this.getStoredToken();
        if (currentToken) {
          this.updateAuthState({
            user: response.user,
            isAuthenticated: true,
            error: null
          });
        }
      }),
      catchError(error => {
        this.handleLogout();
        return throwError(() => error);
      })
    );
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.API_URL}/user`).pipe(
      catchError(this.handleAuthError.bind(this))
    );
  }

  isAuthenticated(): boolean {
    return this.authStateSubject.value.isAuthenticated;
  }

  getCurrentUserValue(): User | null {
    return this.authStateSubject.value.user;
  }

  getToken(): string | null {
    return this.authStateSubject.value.token;
  }

  private handleAuthSuccess(response: LoginResponse): void {
    this.storeAuthData(response.access_token, response.user);
    this.updateAuthState({
      user: response.user,
      token: response.access_token,
      isAuthenticated: true,
      error: null,
      isDolibarrConnected: true
    });
  }

  private handleLogout(): void {
    this.clearAuthData();
    this.updateAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
      isDolibarrConnected: true
    });
    this.router.navigate(['/login']);
  }

  private handleAuthError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';
    let isDolibarrConnected = true;
    
    if (error.error?.message) {
      errorMessage = error.error.message;
      if (errorMessage.toLowerCase().includes('dolibarr')) {
        isDolibarrConnected = false;
        errorMessage = 'Dolibarr connection failed. Please try again later.';
      }
    } else if (error.status === 401) {
      errorMessage = 'Invalid Dolibarr credentials';
    } else if (error.status === 422) {
      errorMessage = 'Validation error';
    } else if (error.status === 0) {
      errorMessage = 'Network error - Dolibarr connection failed';
      isDolibarrConnected = false;
    } else if (error.status === 500) {
      errorMessage = 'Server error - Dolibarr integration issue';
      isDolibarrConnected = false;
    }
    
    this.updateAuthState({ error: errorMessage, isDolibarrConnected });
    
    if (error.status === 401) {
      this.handleLogout();
    }
    
    return throwError(() => ({
      message: errorMessage,
      errors: error.error?.errors,
      status: error.status,
      isDolibarrConnected
    }));
  }
}