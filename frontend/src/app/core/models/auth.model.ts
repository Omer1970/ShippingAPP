export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  device_name?: string;
}

export interface LoginResponse {
  user: {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'warehouse' | 'driver';
    email_verified_at?: string;
    created_at: string;
    updated_at: string;
  };
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthState {
  user: {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'warehouse' | 'driver';
    email_verified_at?: string;
    created_at: string;
    updated_at: string;
  } | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isDolibarrConnected: boolean;
}

export interface ApiError {
  message: string;
  errors?: { [key: string]: string[] };
  status?: number;
}