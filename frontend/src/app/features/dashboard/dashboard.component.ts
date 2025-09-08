import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { AuthService } from '../../core/services';
import { User } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  isLoading = false;
  
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.setupAuthStateSubscription();
    this.loadCurrentUser();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupAuthStateSubscription(): void {
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.currentUser = state.user;
        this.isLoading = state.isLoading;
      });
  }

  private loadCurrentUser(): void {
    if (!this.currentUser) {
      this.authService.getCurrentUser()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (user) => {
            console.log('Current user loaded:', user);
          },
          error: (error) => {
            console.error('Failed to load current user:', error);
          }
        });
    }
  }

  logout(): void {
    this.authService.logout()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.router.navigate(['/login']);
        },
        error: (error) => {
          console.error('Logout error:', error);
          this.router.navigate(['/login']);
        }
      });
  }
}