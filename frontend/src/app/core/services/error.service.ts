import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface AppError {
  message: string;
  type: 'error' | 'warning' | 'info';
  code?: string;
  timestamp?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorService {
  private errorSubject = new Subject<AppError>();
  public errors$: Observable<AppError> = this.errorSubject.asObservable();

  handleError(error: any, context?: string): void {
    console.error(`Error occurred${context ? ` in ${context}` : ''}:`, error);
    
    const appError: AppError = {
      message: this.extractErrorMessage(error),
      type: 'error',
      code: error.code || error.status?.toString(),
      timestamp: new Date()
    };

    this.errorSubject.next(appError);
  }

  handleWarning(message: string, code?: string): void {
    const warning: AppError = {
      message,
      type: 'warning',
      code,
      timestamp: new Date()
    };

    this.errorSubject.next(warning);
  }

  handleInfo(message: string, code?: string): void {
    const info: AppError = {
      message,
      type: 'info',
      code,
      timestamp: new Date()
    };

    this.errorSubject.next(info);
  }

  private extractErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error;
    }

    if (error?.message) {
      return error.message;
    }

    if (error?.error?.message) {
      return error.error.message;
    }

    if (error?.status === 0) {
      return 'Network error. Please check your connection.';
    }

    if (error?.status === 401) {
      return 'Unauthorized. Please login again.';
    }

    if (error?.status === 403) {
      return 'Access forbidden. You don\'t have permission to perform this action.';
    }

    if (error?.status === 404) {
      return 'Resource not found.';
    }

    if (error?.status === 422) {
      return 'Validation error. Please check your input.';
    }

    if (error?.status === 500) {
      return 'Internal server error. Please try again later.';
    }

    if (error?.status) {
      return `Error ${error.status}: ${error.statusText || 'Unknown error'}`;
    }

    return 'An unexpected error occurred. Please try again.';
  }
}