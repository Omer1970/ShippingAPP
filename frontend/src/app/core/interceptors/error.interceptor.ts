import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {

  constructor(private router: Router) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'An error occurred';
        
        if (error.error instanceof ErrorEvent) {
          errorMessage = `Error: ${error.error.message}`;
        } else {
          switch (error.status) {
            case 0:
              errorMessage = 'Network error. Please check your connection.';
              break;
            case 400:
              errorMessage = error.error?.message || 'Bad request';
              break;
            case 401:
              errorMessage = error.error?.message || 'Unauthorized';
              break;
            case 403:
              errorMessage = error.error?.message || 'Forbidden';
              break;
            case 404:
              errorMessage = error.error?.message || 'Resource not found';
              break;
            case 422:
              errorMessage = error.error?.message || 'Validation error';
              break;
            case 500:
              errorMessage = error.error?.message || 'Internal server error';
              break;
            default:
              errorMessage = error.error?.message || `Error ${error.status}: ${error.statusText}`;
          }
        }

        console.error('HTTP Error:', {
          status: error.status,
          message: errorMessage,
          url: request.url,
          method: request.method
        });

        return throwError(() => ({
          message: errorMessage,
          errors: error.error?.errors,
          status: error.status
        }));
      })
    );
  }
}