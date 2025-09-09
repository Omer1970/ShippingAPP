export interface User {
  id: number;
  dolibarr_user_id?: number;
  name: string;
  email: string;
  role: 'admin' | 'warehouse' | 'driver';
  is_active?: boolean;
  email_verified_at?: string;
  created_at: string;
  updated_at: string;
}