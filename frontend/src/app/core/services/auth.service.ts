import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, timer } from 'rxjs';
import { catchError, map, tap, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';

import { User, AuthResponse, LoginCredentials, RefreshTokenResponse, AuthState } from '../models';
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
    accessToken: null,
    isAuthenticated: false,
    isLoading: false,
    error: null
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
        accessToken: token,
        isAuthenticated: true,
        isLoading: false,
        error: null
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

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    this.updateAuthState({ isLoading: true, error: null });
    
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, credentials).pipe(
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

  refreshToken(): Observable<RefreshTokenResponse> {
    return this.http.post<RefreshTokenResponse>(`${this.API_URL}/refresh`, {}).pipe(
      tap(response => {
        const currentUser = this.authStateSubject.value.user;
        if (currentUser) {
          this.handleAuthSuccess({
            user: currentUser,
            access_token: response.access_token,
            token_type: response.token_type,
            expires_in: response.expires_in
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

  getAccessToken(): string | null {
    return this.authStateSubject.value.accessToken;
  }

  private handleAuthSuccess(response: AuthResponse): void {
    this.storeAuthData(response.access_token, response.user);
    this.updateAuthState({
      user: response.user,
      accessToken: response.access_token,
      isAuthenticated: true,
      error: null
    });
    this.scheduleTokenRefresh(response.expires_in);
  }

  private handleLogout(): void {
    this.clearAuthData();
    this.cancelTokenRefresh();
    this.updateAuthState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      error: null
    });
    this.router.navigate(['/login']);
  }

  private handleAuthError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';
    
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.status === 401) {
      errorMessage = 'Invalid credentials';
    } else if (error.status === 422) {
      errorMessage = 'Validation error';
    } else if (error.status === 0) {
      errorMessage = 'Network error';
    }
    
    this.updateAuthState({ error: errorMessage });
    
    if (error.status === 401) {
      this.handleLogout();
    }
    
    return throwError(() => ({
      message: errorMessage,
      errors: error.error?.errors,
      status: error.status
    }));
  }
}