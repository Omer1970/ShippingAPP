import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';

import { GPSLocation } from '../models/delivery.model';

@Injectable({
  providedIn: 'root'
})
export class GeolocationService {
  private defaultTimeout = 30000; // 30 seconds
  private locationCache: { [key: string]: GPSLocation & { timestamp: number } } = {};
  private maxCacheAge = 5 * 60 * 1000; // 5 minutes

  constructor() {}

  /**
   * Get current GPS location with high accuracy
   */
  getCurrentLocation(options?: PositionOptions): Observable<GPSLocation> {
    const cacheKey = 'current_location';
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return new Observable(observer => {
        observer.next(cached as GPSLocation);
        observer.complete();
      });
    }

    return this.getLocationFromGeolocationAPI({
      enableHighAccuracy: true,
      timeout: options?.timeout || this.defaultTimeout,
      maximumAge: options?.maximumAge || 0
    }).pipe(
      timeout(options?.timeout || this.defaultTimeout),
      map((position: GeolocationPosition) => {
        const location: GPSLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(position.timestamp).toISOString()
        };
        
        // Cache the result
        this.storeInCache(cacheKey, location);
        
        return location;
      }),
      catchError(this.handleGeolocationError)
    );
  }

  /**
   * Get current GPS location with standard accuracy (faster)
   */
  getStandardLocation(options?: PositionOptions): Observable<GPSLocation> {
    const cacheKey = 'standard_location';
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return new Observable(observer => {
        observer.next(cached as GPSLocation);
        observer.complete();
      });
    }

    return this.getLocationFromGeolocationAPI({
      enableHighAccuracy: false,
      timeout: options?.timeout || 20000,
      maximumAge: options?.maximumAge || 30000 // Allow 30s old position
    }).pipe(
      timeout(options?.timeout || 20000),
      map((position: GeolocationPosition) => {
        const location: GPSLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(position.timestamp).toISOString()
        };
        
        this.storeInCache(cacheKey, location);
        return location;
      }),
      catchError(this.handleGeolocationError)
    );
  }

  /**
   * Get location from geolocation API
   */
  private getLocationFromGeolocationAPI(options: PositionOptions): Observable<GeolocationPosition> {
    return from(
      new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator || !navigator.geolocation) {
          reject(new Error('Geolocation is not supported by this browser'));
          return;
        }
        
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve(position);
          },
          (error) => {
            reject(error);
          },
          options
        );
      })
    );
  }

  /**
   * Watch geolocation for continuous tracking
   */
  watchLocation(
    callback: (location: GPSLocation) => void,
    errorCallback: (error: any) => void,
    options?: PositionOptions
  ): number {
    if (!navigator || !navigator.geolocation) {
      errorCallback(new Error('Geolocation is not supported by this browser'));
      return -1;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location: GPSLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(position.timestamp).toISOString()
        };
        
        callback(location);
      },
      (error) => {
        errorCallback(this.convertGeolocationError(error));
      },
      {
        enableHighAccuracy: options?.enableHighAccuracy || false,
        timeout: options?.timeout || this.defaultTimeout,
        maximumAge: options?.maximumAge || 30000
      }
    );

    return watchId;
  }

  /**
   * Clear location watch
   */
  clearWatch(watchId: number): void {
    if (navigator && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
  }

  /**
   * Check if geolocation is supported
   */
  isGeolocationSupported(): boolean {
    return !!(navigator && navigator.geolocation);
  }

  /**
   * Calculate distance between two locations
   */
  calculateDistance(location1: GPSLocation, location2: GPSLocation): number {
    // Haversine formula for great-circle distance
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.degreesToRadians(location2.latitude - location1.latitude);
    const dLon = this.degreesToRadians(location2.longitude - location1.longitude);
    
    const lat1 = this.degreesToRadians(location1.latitude);
    const lat2 = this.degreesToRadians(location2.latitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Check if location is within delivery radius
   */
  isWithinDeliveryRadius(actual: GPSLocation, expected: GPSLocation, maxRadius = 0.5): boolean {
    const distance = this.calculateDistance(actual, expected);
    const maxDistanceKm = maxRadius;
    
    // Check distance and GPS accuracy
    return distance <= maxDistanceKm && actual.accuracy <= 10; // Max 10m GPS accuracy
  }

  /**
   * Validate GPS location accuracy
   */
  validateGPSAccuracy(location: GPSLocation, maxAccuracy = 50): {
    valid: boolean;
    accuracy: number;
    status: 'excellent' | 'good' | 'fair' | 'poor' | 'unacceptable';
  } {
    let status: 'excellent' | 'good' | 'fair' | 'poor' | 'unacceptable';
    
    if (location.accuracy <= 5) {
      status = 'excellent';
    } else if (location.accuracy <= 15) {
      status = 'good';
    } else if (location.accuracy <= 25) {
      status = 'fair';
    } else if (location.accuracy <= 50) {
      status = 'poor';
    } else {
      status = 'unacceptable';
    }
    
    return {
      valid: location.accuracy <= maxAccuracy,
      accuracy: location.accuracy,
      status
    };
  }

  /**
   * Get current location with validation and fallback
   */
  getLocationWithFallback(options?: {
    highAccuracy?: boolean;
    maxRetries?: number;
    retryDelay?: number;
  }): Observable<GPSLocation> {
    const {
      highAccuracy = true,
      maxRetries = 3,
      retryDelay = 2000
    } = options || {};
    
    const getLocationMethod = highAccuracy ? 
      this.getCurrentLocation.bind(this) : 
      this.getStandardLocation.bind(this);
    
    return getLocationMethod().pipe(
      catchError((error, caught) => {
        if (maxRetries > 0) {
          console.warn(`GPS location failed, retrying... (${maxRetries} attempts left)`, error);
          return new Observable(observer => {
            setTimeout(() => {
              this.getLocationWithFallback({
                highAccuracy,
                maxRetries: maxRetries - 1,
                retryDelay
              }).subscribe({
                next: location => observer.next(location),
                error: err => observer.error(err),
                complete: () => observer.complete()
              });
            }, retryDelay);
          });
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Set location cache
   */
  setLocationCache(key: string, location: GPSLocation): void {
    this.storeInCache(key, location);
  }

  /**
   * Clear location cache
   */
  clearCache(): void {
    this.locationCache = {};
  }

  /**
   * Get cache for specific key
   */
  private getFromCache(key: string): GPSLocation | null {
    const cached = this.locationCache[key];
    if (cached && (Date.now() - cached.timestamp) < this.maxCacheAge) {
      return cached;
    }
    return null;
  }

  /**
   * Store location in cache
   */
  private storeInCache(key: string, location: GPSLocation): void {
    this.locationCache[key] = { ...location, timestamp: Date.now() };
  }

  /**
   * Handle geolocation errors
   */
  private handleGeolocationError = (error: any): Observable<never> => {
    let errorMessage = 'Unknown geolocation error';
    
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error.code) {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Location access denied. Please enable location services.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location information unavailable. Please check GPS.';
          break;
        case error.TIMEOUT:
          errorMessage = 'Location request timed out. Please check GPS.';
          break;
      }
    }
    
    return throwError(() => {
      const serviceError = new Error(errorMessage);
      (serviceError as any).code = typeof error === 'object' ? error.code : 'UNKNOWN';
      return serviceError;
    });
  }

  /**
   * Convert geolocation error to custom format
   */
  private convertGeolocationError(error: GeolocationPositionError): any {
    let message = 'Unknown geolocation error';
    let code = 'UNKNOWN';
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = 'Location access denied';
        code = 'PERMISSION_DENIED';
        break;
      case error.POSITION_UNAVAILABLE:
        message = 'Location information unavailable';
        code = 'POSITION_UNAVAILABLE';
        break;
      case error.TIMEOUT:
        message = 'Location request timed out';
        code = 'TIMEOUT';
        break;
    }
    
    return { 
      code,
      message,
      originalError: error
    };
  }

  /**
   * Convert degrees to radians
   */
  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}