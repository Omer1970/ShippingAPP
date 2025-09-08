export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: number;
    name: string;
    email: string;
    email_verified_at?: string;
    created_at: string;
    updated_at: string;
  };
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface ApiError {
  message: string;
  errors?: { [key: string]: string[] };
  status?: number;
}