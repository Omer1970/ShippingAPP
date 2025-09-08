import { Routes } from '@angular/router';
import { PublicGuard } from '../../core/guards';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then(m => m.LoginComponent),
    canActivate: [PublicGuard]
  }
];