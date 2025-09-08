import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, map, take } from 'rxjs';

import { AuthService } from '../services';

@Injectable({
  providedIn: 'root'
})
export class PublicGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return this.authService.authState$.pipe(
      take(1),
      map(authState => {
        if (!authState.isAuthenticated) {
          return true;
        }

        const returnUrl = route.queryParams['returnUrl'] || '/dashboard';
        return this.router.createUrlTree([returnUrl]);
      })
    );
  }
}