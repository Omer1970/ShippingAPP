import { Routes } from '@angular/router';
import { AuthGuard } from '../../core/guards';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./dashboard.component').then(m => m.DashboardComponent),
    canActivate: [AuthGuard]
  }
];