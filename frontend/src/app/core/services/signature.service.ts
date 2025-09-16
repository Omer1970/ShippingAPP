import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { 
  SignatureCaptureResult, 
  SignatureValidationResult, 
  SignatureValidationData,
  SignatureTemplate,
  SignatureServiceConfig,
  SignatureType,
  SignatureCanvasConfig
} from '../models/signature.model';
import { ApiResponse } from '../models/api.model';

@Injectable({
  providedIn: 'root'
})
export class SignatureService {
  private apiUrl = `${environment.apiUrl}/signatures`;
  private config: SignatureServiceConfig = {
    apiEndpoint: this.apiUrl,
    validationEnabled: true,
    realTimeValidation: true,
    qualityThreshold: 0.7,
    canvasTemplatesAvailable: true,
    allowTemplateSwitching: true,
    maxRetries: 3,
    timeout: 30000,
    storageKey: 'delivery_signature_config'
  };

  constructor(private http: HttpClient) {
    this.loadConfigFromStorage();
  }

  /**
   * Validate signature template
   */
  validateTemplate(data: string): Observable<SignatureValidationResult> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/validate`, {
      signature_data: data,
      include_validation_details: true
    }).pipe(
      map(response => {
        if (response.success && response.data?.validation_result) {
          return response.data.validation_result as SignatureValidationResult;
        }
        throw new Error(response.message || 'Signature validation failed');
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Get signature by ID
   */
  getSignature(signatureId: number): Observable<DeliverySignature> {
    return this.http.get<ApiResponse>(`${this.apiUrl}/${signatureId}`)
      .pipe(
        map(response => {
          if (response.success && response.data?.signature) {
            return response.data.signature as DeliverySignature;
          }
          throw new Error(response.message || 'Signature not found');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Delete signature
   */
  deleteSignature(signatureId: number): Observable<boolean> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/${signatureId}`)
      .pipe(
        map(response => {
          return response.success;
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get signature template
   */
  getSignatureTemplate(): Observable<SignatureTemplate> {
    return this.http.get<ApiResponse>(`${this.apiUrl}/template`)
      .pipe(
        map(response => {
          if (response.success && response.data?.template) {
            return response.data.template as SignatureTemplate;
          }
          throw new Error(response.message || 'Signature template not available');
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Analyze signature quality in real-time
   */
  analyzeSignatureQuality(strokesData: any[]): SignatureValidationResult {
    const validation: SignatureValidationResult = {
      valid: true,
      quality: 0,
      score: 0,
      issues: [],
      warnings: [],
      recommendations: [],
      criteria: {
        coverage_score: 0,
        stroke_complexity_score: 0,
        pressure_score: 0,
        velocity_score: 0,
        aspect_ratio_score: 0,
        time_score: 0
      },
      summary: {
        confidence: 0,
        risk_level: 'low',
        quality_tier: 'fair'
      }
    };

    try {
      // Calculate signature coverage
      const coverageScore = this.calculateCoverageScore(strokesData);
      
      // Calculate stroke complexity
      const complexityScore = this.calculateComplexityScore(strokesData);
      
      // Calculate pressure/velocity scores
      const pressureScore = this.calculatePressureScore(strokesData);
      const velocityScore = this.calculateVelocityScore(strokesData);
      
      // Calculate aspect ratio
      const aspectRatioScore = this.calculateAspectRatioScore(strokesData);
      
      // Calculate time score (drawing duration)
      const timeScore = this.calculateTimeScore(strokesData);

      // Update criteria scores
      validation.criteria.coverage_score = coverageScore;
      validation.criteria.stroke_complexity_score = complexityScore;
      validation.criteria.pressure_score = pressureScore;
      validation.criteria.velocity_score = velocityScore;
      validation.criteria.aspect_ratio_score = aspectRatioScore;
      validation.criteria.time_score = timeScore;

      // Calculate overall quality score (weighted average)
      validation.score = (
        coverageScore * 0.25 +
        complexityScore * 0.2 +
        pressureScore * 0.15 +
        velocityScore * 0.15 +
        aspectRatioScore * 0.1 +
        timeScore * 0.15
      );

      validation.quality = Math.max(0, Math.min(1, validation.score));

      // Determine validation status
      if (validation.quality < 0.3) {
        validation.valid = false;
        validation.summary.quality_tier = 'poor';
        validation.summary.risk_level = 'high';
        validation.issues.push('Signature quality is too low');
        validation.recommendations.push('Please provide a clearer signature');
      } else if (validation.quality < 0.5) {
        validation.summary.quality_tier = 'fair';
        validation.summary.risk_level = 'medium';
        validation.warnings.push('Signature quality is below optimal');
        validation.recommendations.push('Try to sign more clearly');
      } else if (validation.quality < 0.8) {
        validation.summary.quality_tier = 'good';
        validation.summary.risk_level = 'low';
      } else {
        validation.summary.quality_tier = 'excellent';
        validation.summary.risk_level = 'low';
      }

      // Set confidence level
      validation.summary.confidence = validation.quality;

      // Add specific warnings based on criteria
      if (coverageScore < 0.3) {
        validation.warnings.push('Signature covers very limited area');
      }
      if (complexityScore < 0.2) {
        validation.warnings.push('Signature appears too simple');
      }
      if (timeScore < 0.2) {
        validation.warnings.push('Signature was drawn too quickly');
      }

    } catch (error) {
      console.error('Signature analysis error:', error);
      validation.valid = false;
      validation.issues.push('Unable to analyze signature');
      validation.summary.quality_tier = 'poor';
      validation.summary.risk_level = 'high';
    }

    return validation;
  }

  /**
   * Get default canvas configuration
   */
  getDefaultCanvasConfig(): SignatureCanvasConfig {
    return {
      width: 600,
      height: 200,
      backgroundColor: '#ffffff',
      penColor: '#000000',
      penWidth: 2,
      minPenWidth: 1,
      maxPenWidth: 5,
      smoothingFactor: 0.85,
      velocityFilterWeight: 0.7,
      enablePressure: true,
      enableVelocity: true,
      enableSmoothing: true
    };
  }

  /**
   * Calculate signature coverage score
   */
  private calculateCoverageScore(strokes: any[]): number {
    if (!strokes || strokes.length === 0) return 0;

    try {
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let totalPoints = 0;

      strokes.forEach(stroke => {
        if (stroke.points && Array.isArray(stroke.points)) {
          stroke.points.forEach((point: any) => {
            if (typeof point.x === 'number' && typeof point.y === 'number') {
              minX = Math.min(minX, point.x);
              maxX = Math.max(maxX, point.x);
              minY = Math.min(minY, point.y);
              maxY = Math.max(maxY, point.y);
              totalPoints++;
            }
          });
        }
      });

      if (totalPoints === 0) return 0;

      const boundingBoxArea = (maxX - minX) * (maxY - minY);
      const canvasArea = this.getDefaultCanvasConfig().width * this.getDefaultCanvasConfig().height;
      const coverageRatio = boundingBoxArea / canvasArea;

      // Score is proportional to coverage, but caps at 80% coverage
      return Math.min(coverageRatio * 1.25, 1.0);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate stroke complexity score
   */
  private calculateComplexityScore(strokes: any[]): number {
    if (!strokes || strokes.length === 0) return 0;

    const strokeCount = strokes.length;
    let totalPoints = 0;
    let strokeLengthSum = 0;

    strokes.forEach(stroke => {
      if (stroke.points && Array.isArray(stroke.points)) {
        totalPoints += stroke.points.length;
        strokeLengthSum += stroke.points.length;
      }
    });

    // Basic complexity metrics
    const avgPointsPerStroke = totalPoints / strokeCount;
    let complexity = 0;

    // More strokes generally means more complex signature
    complexity += Math.min(strokeCount / 10, 1.0) * 0.4;

    // Average points per stroke indicates detail level
    complexity += Math.min(avgPointsPerStroke / 50, 1.0) * 0.4;

    // Total points indicates overall complexity
    complexity += Math.min(totalPoints / 200, 1.0) * 0.2;

    return Math.min(complexity, 1.0);
  }

  /**
   * Calculate pressure score (placeholder implementation)
   */
  private calculatePressureScore(strokes: any[]): number {
    // This would analyze pressure data if available
    // For now, return a neutral score
    return 0.7;
  }

  /**
   * Calculate velocity score (placeholder implementation)
   */
  private calculateVelocityScore(strokes: any[]): number {
    // This would analyze drawing velocity
    // For now, return a neutral score
    return 0.7;
  }

  /**
   * Calculate aspect ratio score
   */
  private calculateAspectRatioScore(strokes: any[]): number {
    try {
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      strokes.forEach(stroke => {
        if (stroke.points && Array.isArray(stroke.points)) {
          stroke.points.forEach((point: any) => {
            if (typeof point.x === 'number' && typeof point.y === 'number') {
              minX = Math.min(minX, point.x);
              maxX = Math.max(maxX, point.x);
              minY = Math.min(minY, point.y);
              maxY = Math.max(maxY, point.y);
            }
          });
        }
      });

      const width = maxX - minX;
      const height = maxY - minY;
      
      if (width <= 0 || height <= 0) return 0;

      const aspectRatio = width / height;
      const canvasConfig = this.getDefaultCanvasConfig();
      const targetAspectRatio = canvasConfig.width / canvasConfig.height;

      // Score based on how close the signature aspect ratio is to the canvas
      const ratioDifference = Math.abs(aspectRatio - targetAspectRatio) / targetAspectRatio;
      return Math.max(0, 1.0 - ratioDifference);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate time score
   */
  private calculateTimeScore(strokes: any[]): number {
    if (!strokes || strokes.length === 0) return 0;

    try {
      let startTime = Infinity;
      let endTime = -Infinity;

      strokes.forEach(stroke => {
        if (stroke.points && Array.isArray(stroke.points)) {
          stroke.points.forEach((point: any) => {
            if (typeof point.time === 'number') {
              startTime = Math.min(startTime, point.time);
              endTime = Math.max(endTime, point.time);
            }
          });
        }
      });

      if (startTime === Infinity || endTime === -Infinity) {
        return 0.5; // Neutral score if no timing data
      }

      const drawingTime = endTime - startTime;
      
      // Ideal drawing time is between 1 and 10 seconds
      if (drawingTime < 1000) return 0.3; // Too fast
      if (drawingTime > 10000) return 0.6; // Reasonable
      
      return 0.8; // Good time range
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Load configuration from storage
   */
  private loadConfigFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (stored) {
        const storedConfig = JSON.parse(stored);
        this.config = { ...this.config, ...storedConfig };
      }
    } catch (error) {
      console.warn('Failed to load signature config from storage:', error);
    }
  }

  /**
   * Save configuration to storage
   */
  saveConfigToStorage(): void {
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(this.config));
    } catch (error) {
      console.warn('Failed to save signature config to storage:', error);
    }
  }

  /**
   * Get current service configuration
   */
  getConfig(): SignatureServiceConfig {
    return { ...this.config };
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<SignatureServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfigToStorage();
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Signature service error';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else {
      if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.status === 401) {
        errorMessage = 'Authentication required';
      } else if (error.status === 403) {
        errorMessage = 'Access denied';
      } else if (error.status === 404) {
        errorMessage = 'Signature not found';
      } else if (error.status === 429) {
        errorMessage = 'Rate limit exceeded';
      } else if (error.status === 422) {
        errorMessage = 'Validation error';
      } else if (error.status >= 500) {
        errorMessage = 'Server error occurred';
      }
    }
    
    console.error('SignatureService Error:', error);
    return throwError(() => new Error(errorMessage));
  }
}