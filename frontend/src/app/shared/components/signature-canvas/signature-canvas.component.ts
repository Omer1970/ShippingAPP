import { 
  Component, 
  ElementRef, 
  ViewChild, 
  AfterViewInit, 
  OnDestroy, 
  Input, 
  Output, 
  EventEmitter,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { SignatureCanvasConfig, SignatureCaptureResult, SignatureStroke, SignatureValidationData } from '../../../core/models/signature.model';

@Component({
  selector: 'app-signature-canvas',
  templateUrl: './signature-canvas.component.html',
  styleUrls: ['./signature-canvas.component.scss'],
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule
  ],
  standalone: true
})
export class SignatureCanvasComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('signatureCanvas', { static: false }) canvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('overlayCanvas', { static: false }) overlayCanvas!: ElementRef<HTMLCanvasElement>;
  
  @Input() config: Partial<SignatureCanvasConfig> = {};
  @Input() width = 600;
  @Input() height = 200;
  @Input() backgroundColor = '#ffffff';
  @Input() penColor = '#000000';
  @Input() penWidth = 2;
  @Input() enablePressure = true;
  @Input() enableVelocity = true;
  @Input() enableSmoothing = true;
  @Input() showControls = true;
  @Input() showQualityIndicator = true;
  @Input() autoValidate = true;
  @Input() minQuality = 0.3;
  
  @Output() signatureComplete = new EventEmitter<SignatureCaptureResult>();
  @Output() signatureStart = new EventEmitter<void>();
  @Output() signatureProgress = new EventEmitter<number>();
  @Output() signatureClear = new EventEmitter<void>();
  @Output() validationComplete = new EventEmitter<SignatureCaptureResult>();
  
  // Component state
  isDrawing = false;
  isCapturing = false;
  currentPath: SignatureStroke[] = [];
  allPaths: Array<SignatureStroke[]> = [];
  lastPoint: SignatureStroke | null = null;
  currentPoint: SignatureStroke | null = null;
  
  // Canvas context
  private ctx!: CanvasRenderingContext2D;
  private overlayCtx!: CanvasRenderingContext2D;
  
  // Touch/stylus support
  private touchIdentifier: number | null = null;
  private isStylus = false;
  private lastPressure = 1.0;
  private lastTime = 0;
  
  // Drawing State
  private animationFrameId: number | null = null;
  private strokeStartTime = 0;
  private currentStrokeTime = 0;
  
  // Quality Tracking
  signatureQuality = 0;
  signatureScore = 0;
  isQualityValid = false;
  qualityIssues: string[] = [];
  qualityRecommendations: string[] = [];

  // Configuration
  private canvasConfig: SignatureCanvasConfig;

  constructor() {
    this.canvasConfig = this.getDefaultConfig();
  }

  ngOnInit(): void {
    this.updateCanvasConfig();
    this.loadConfiguration();
  }

  ngAfterViewInit(): void {
    this.initializeCanvas();
    this.setupEventListeners();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Update configuration with input values
   */
  private updateCanvasConfig(): void {
    this.canvasConfig = {
      ...this.canvasConfig,
      ...this.config,
      width: this.width,
      height: this.height,
      backgroundColor: this.backgroundColor,
      penColor: this.penColor,
      penWidth: this.penWidth,
      enablePressure: this.enablePressure,
      enableVelocity: this.enableVelocity,
      enableSmoothing: this.enableSmoothing
    };
  }

  /**
   * Load configuration from storage if available
   */
  private loadConfiguration(): void {
    const stored = localStorage.getItem('signature_canvas_config');
    if (stored) {
      try {
        const config = JSON.parse(stored);
        Object.assign(this.canvasConfig, config);
      } catch (error) {
        console.warn('Failed to load signature canvas configuration:', error);
      }
    }
  }

  /**
   * Initialize canvas and contexts
   */
  private initializeCanvas(): void {
    if (!this.canvas || !this.overlayCanvas) return;
    
    const canvas = this.canvas.nativeElement;
    const overlayCanvas = this.overlayCanvas.nativeElement;
    
    // Set canvas dimensions with DPI scaling for better rendering
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = this.canvasConfig.width * dpr;
    canvas.height = this.canvasConfig.height * dpr;
    canvas.style.width = this.canvasConfig.width + 'px';
    canvas.style.height = this.canvasConfig.height + 'px';
    
    overlayCanvas.width = this.canvasConfig.width * dpr;
    overlayCanvas.height = this.canvasConfig.height * dpr;
    overlayCanvas.style.width = this.canvasConfig.width + 'px';
    overlayCanvas.style.height = this.canvasConfig.height + 'px';
    
    // Set up base canvas context
    const ctx = canvas.getContext('2d');
    const overlayCtx = overlayCanvas.getContext('2d');
    
    if (ctx && overlayCtx) {
      this.ctx = ctx;
      this.overlayCtx = overlayCtx;
      
      // Scale context for DPI
      this.ctx.scale(dpr, dpr);
      this.overlayCtx.scale(dpr, dpr);
      
      // Initial setup
      this.clearCanvas();
      this.drawBackground();
      
      // Prevent default canvas interactions
      canvas.style.touchAction = 'none';
      canvas.style.userSelect = 'none';
      canvas.style.webkitUserSelect = 'none';
    }
  }

  /**
   * Setup canvas event listeners
   */
  private setupEventListeners(): void {
    const canvas = this.canvas.nativeElement;
    
    // Mouse events
    canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    
    // Touch events
    canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
    canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
    canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
    canvas.addEventListener('touchcancel', this.handleTouchCancel.bind(this));
    
    // Pointer events (modern browsers)
    canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
    canvas.addEventListener('pointermove', this.handlePointerMove.bind(this));
    canvas.addEventListener('pointerup', this.handlePointerUp.bind(this));
    canvas.addEventListener('pointercancel', this.handlePointerCancel.bind(this));
    canvas.addEventListener('pointercancel', this.handlePointerCancel.bind(this));
    
    // Window events
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // Keyboard events (for accessibility)
    canvas.setAttribute('tabindex', '0');
    canvas.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  /**
   * Mouse event handlers
   */
  private handleMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.startDrawing();
    this.isStylus = false;
    
    const point = this.getCanvasPoint(event);
    this.beginStroke(point, this.lastPressure);
  }
  
  private handleMouseMove(event: MouseEvent): void {
    if (!this.isDrawing) return;
    
    const point = this.getCanvasPoint(event);
    this.addStrokePoint(point, this.lastPressure, new Date().getTime());
  }
  
  private handleMouseUp(event: MouseEvent): void {
    if (!this.isDrawing) return;
    
    this.endDrawing();
  }
  
  private handleMouseLeave(event: MouseEvent): void {
    if (this.isDrawing) {
      this.endDrawing();
    }
  }

  /**
   * Touch event handlers
   */
  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault();
    this.startDrawing();
    
    const touch = event.touches[0];
    this.touchIdentifier = touch.identifier;
    
    const point = this.getCanvasPoint(touch);
    this.beginStroke(point, this.lastPressure);
  }
  
  private handleTouchMove(event: TouchEvent): void {
    if (!this.isDrawing || !this.touchIdentifier) return;
    
    event.preventDefault();
    
    const touch = Array.from(event.touches).find(t => t.identifier === this.touchIdentifier);
    if (!touch) return;
    
    const point = this.getCanvasPoint(touch);
    this.addStrokePoint(point, this.lastPressure, new Date().getTime());
  }
  
  private handleTouchEnd(event: TouchEvent): void {
    if (!this.isDrawing) return;
    
    this.endDrawing();
    this.touchIdentifier = null;
  }
  
  private handleTouchCancel(event: TouchEvent): void {
    if (this.isDrawing) {
      this.endDrawing();
    }
    this.touchIdentifier = null;
  }

  /**
   * Pointer event handlers (recommended for modern browsers)
   */
  private handlePointerDown(event: PointerEvent): void {
    event.preventDefault();
    this.startDrawing();
    
    this.isStylus = event.pointerType === 'pen' || event.pointerType === 'stylus';
    const pressure = event.pressure !== undefined ? event.pressure : this.lastPressure;
    this.lastPressure = pressure;
    
    const point = this.getCanvasPoint(event);
    this.beginStroke(point, pressure);
  }
  
  private handlePointerMove(event: PointerEvent): void {
    if (!this.isDrawing) return;
    
    event.preventDefault();
    
    const pressure = event.pressure !== undefined ? event.pressure : this.lastPressure;
    this.lastPressure = pressure;
    
    const point = this.getCanvasPoint(event);
    this.addStrokePoint(point, pressure, new Date().getTime());
  }
  
  private handlePointerUp(event: PointerEvent): void {
    if (!this.isDrawing) return;
    
    this.endDrawing();
  }
  
  private handlePointerCancel(event: PointerEvent): void {
    if (this.isDrawing) {
      this.endDrawing();
    }
  }

  /**
   * Get point coordinates relative to canvas
   */
  private getCanvasPoint(event: MouseEvent | Touch | PointerEvent): SignatureStroke {
    const canvas = this.canvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      pressure: this.lastPressure,
      time: new Date().getTime()
    };
  }

  /**
   * Start drawing sequence
   */
  private startDrawing(): void {
    this.isDrawing = true;
    this.isCapturing = true;
    this.strokeStartTime = new Date().getTime();
    this.currentPath = [];
  }

  /**
   * Begin a new stroke
   */
  private async beginStroke(point: SignatureStroke, pressure: number): Promise<void> {
    this.signatureStart.emit();
    
    // Add initial point
    this.currentPath.push(point);
    this.lastPoint = point;
    
    // Clear overlay for new stroke
    this.clearOverlay();
    
    // Simulate some initial point for visual feedback
    this.drawPoint(this.ctx, point, pressure);
  }

  /**
   * Add point to current stroke
   */
  private async addStrokePoint(point: SignatureStroke, pressure: number, timestamp: number): Promise<void> {
    this.currentPoint = point;
    this.currentPath.push(point);
    
    // Draw the stroke segment
    if (this.canvasConfig.enableSmoothing) {
      this.drawSmoothLine(this.ctx, this.lastPoint!, point, pressure);
    } else {
      this.drawLine(this.ctx, this.lastPoint!, point, pressure);
    }
    
    // Update last point
    this.lastPoint = point;
    this.currentStrokeTime = timestamp;
    
    // Calculate real-time quality if enabled
    if (this.canvasConfig.enableSmoothing && this.autoValidate) {
      this.updateRealTimeQuality();
    }
    
    // Emit progress - debounced to avoid too many events
    this.debouncedProgressEmit(-1);
  }

  /**
   * End drawing sequence
   */
  private endDrawing(): void {
    if (!this.isDrawing) return;
    
    this.isDrawing = false;
    
    // Add current path to all paths
    if (this.currentPath.length > 0) {
      this.allPaths.push([...this.currentPath]);
    }
    
    // Run final validation if enabled
    if (this.autoValidate) {
      this.runSignatureValidation();
    }
    
    // Reset drawing state
    this.lastPoint = null;
    this.currentPoint = null;
    this.currentPath = [];
  }

  /**
   * Draw a single point
   */
  private drawPoint(ctx: CanvasRenderingContext2D, point: SignatureStroke, pressure: number): void {
    const radius = (this.canvasConfig.penWidth * pressure);
    
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = this.canvasConfig.penColor;
    ctx.fill();
  }

  /**
   * Draw a line segment (basic implementation)
   */
  private drawLine(
    ctx: CanvasRenderingContext2D, 
    start: SignatureStroke, 
    end: SignatureStroke, 
    pressure: number
  ): void {
    const lineWidth = this.canvasConfig.penWidth * Math.max(pressure, 0.3);
    
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this.canvasConfig.penColor;
    ctx.stroke();
  }

  /**
   * Draw a smooth line with curve-fitting
   */
  private drawSmoothLine(
    ctx: CanvasRenderingContext2D, 
    start: SignatureStroke, 
    end: SignatureStroke, 
    pressure: number
  ): void {
    if (this.canvasConfig.enableSmoothing) {
      // Interpolate pressure smoothly
      const smoothPressure = this.smoothPressure(start, end, pressure);
      
      // Draw smooth quadratic curve
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const lineWidth = this.canvasConfig.penWidth * Math.max(smoothPressure, 0.3);
      
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.quadraticCurveTo(
        midX - this.lastPressure * 2,
        midY - this.lastPressure * 2,
        end.x,
        end.y
      );
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = this.canvasConfig.penColor;
      ctx.stroke();
    } else {
      this.drawLine(ctx, start, end, pressure);
    }
  }

  /**
   * Smooth pressure transition
   */
  private smoothPressure(start: SignatureStroke, end: SignatureStroke, currentPressure: number): number {
    if (this.lastPressure !== undefined) {
      return (this.lastPressure + currentPressure) / 2;
    }
    return currentPressure;
  }

  /**
   * Clear entire canvas
   */
  public clearCanvas(): void {
    if (!this.ctx || !this.canvas) return;
    
    this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
    this.allPaths = [];
    this.currentPath = [];
    this.lastPoint = null;
    this.currentPoint = null;
    this.signatureQuality = 0;
    this.signatureScore = 0;
    this.isQualityValid = false;
    this.qualityIssues = [];
    this.qualityRecommendations = [];
    
    this.drawBackground();
    this.clearOverlay();
    this.signatureClear.emit();
  }

  /**
   * Clear overlay canvas
   */
  private clearOverlay(): void {
    if (!this.overlayCtx || !this.overlayCanvas) return;
    
    this.overlayCtx.clearRect(0, 0, this.overlayCanvas.nativeElement.width, this.overlayCanvas.nativeElement.height);
  }

  /**
   * Draw background pattern
   */
  private drawBackground(): void {
    if (!this.ctx || !this.overlayCtx) return;
    
    // Main canvas background
    this.ctx.fillStyle = this.canvasConfig.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvasConfig.width, this.canvasConfig.height);
    
    // Overlay background (slightly transparent)
    this.overlayCtx.fillStyle = this.canvasConfig.backgroundColor + '00'; // Transparent
    this.overlayCtx.fillRect(0, 0, this.canvasConfig.width, this.canvasConfig.height);
    
    // Draw signature guide lines
    this.drawGuideLines();
  }

  /**
   * Draw signature guide lines
   */
  private drawGuideLines(): void {
    if (!this.overlayCtx) return;
    
    this.overlayCtx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
    this.overlayCtx.lineWidth = 1;
    this.overlayCtx.setLineDash([5, 5]);
    
    // Horizontal baseline
    const baselineY = this.canvasConfig.height * 0.75;
    this.overlayCtx.beginPath();
    this.overlayCtx.moveTo(0, baselineY);
    this.overlayCtx.lineTo(this.canvasConfig.width, baselineY);
    this.overlayCtx.stroke();
    
    this.overlayCtx.setLineDash([]);
  }

  /**
   * Update real-time quality metrics (placeholder)
   */
  private updateRealTimeQuality(): void {
    // This would run a lightweight real-time quality analysis
    // For now, we'll implement a basic calculation
    
    if (this.allPaths.length + (this.currentPath.length > 0 ? 1 : 0) > 0) {
      const totalPoints = this.allPaths.reduce((sum, path) => sum + path.length, 0) + this.currentPath.length;
      const totalStrokes = this.allPaths.length + (this.currentPath.length > 0 ? 0.5 : 0);
      
      // Basic quality approximation
      const pointsScore = Math.min(totalPoints / 100, 1.0);
      const strokesScore = Math.min(totalStrokes / 10, 1.0);
      
      this.signatureQuality = (pointsScore + strokesScore) / 2;
      this.signatureProgress.emit(this.signatureQuality);
    }
  }

  /**
   * Run signature validation (placeholder for full implementation)
   */
  private runSignatureValidation(): void {
    if (!this.autoValidate) return;
    
    // This would connect to a signature service for full validation
    // For now, we'll implement basic local validation
    
    const totalPoints = this.allPaths.reduce((sum, path) => sum + path.length, 0);
    const totalStrokes = this.allPaths.length;
    
    // Basic validation
    this.isQualityValid = totalPoints >= 50 && totalStrokes >= 3;
    this.signatureQuality = Math.min(this.calculateBasicQuality(), 1.0);
    
    // Create capture result
    const result: SignatureCaptureResult = {
      data: this.canvas.nativeElement.toDataURL('image/png'),
      quality: this.signatureQuality,
      validation: this.createBasicValidationData(),
      metadata: {
        width: this.canvasConfig.width,
        height: this.canvasConfig.height,
        capture_time: new Date().getTime() - this.strokeStartTime,
        stroke_count: totalStrokes,
        total_points: totalPoints,
        device_type: this.isStylus ? 'stylus' : 'touch',
        touch_points: this.allPaths.flat(),
        canvas_data: this.canvas.nativeElement.toDataURL()
      }
    };
    
    this.isQualityValid = this.signatureQuality >= this.minQuality;
    this.validationComplete.emit(result);
    this.signatureComplete.emit(result);
  }

  /**
   * Calculate basic quality score
   */
  private calculateBasicQuality(): number {
    const totalPoints = this.allPaths.reduce((sum, path) => sum + path.length, 0);
    const totalStrokes = this.allPaths.length;
    
    // Weighted scoring
    let score = 0;
    
    // Points-based scoring
    score += Math.min(totalPoints / 200, 0.6); // Up to 60% for sufficient points
    
    // Stroke count scoring  
    score += Math.min(totalStrokes / 10, 0.3); // Up to 30% for stroke complexity
    
    // Style bonus (if using stylus)
    score += this.isStylus ? 0.1 : 0;
    
    return Math.min(score, 1.0);
  }

  /**
   * Create basic validation data
   */
  private createBasicValidationData(): SignatureValidationData {
    // This would create comprehensive validation data
    // For now, return basic metrics
    
    return {
      total_strokes: this.allPaths.length,
      total_points: this.allPaths.reduce((sum, path) => sum + path.length, 0),
      avg_points_per_stroke: this.allPaths.length > 0 ? 
        this.allPaths.reduce((sum, path) => sum + path.length, 0) / this.allPaths.length : 0,
      total_distance: this.calculateTotalDistance(),
      bounding_box: this.calculateBoundingBox(),
      aspect_ratio: 1.0, // Placeholder
      area_covered: 0.5, // Placeholder
      drawing_time: this.currentStrokeTime - this.strokeStartTime,
      pressure_range: { min: 0.5, max: 1.0, avg: this.lastPressure },
      velocity_analysis: { avg_velocity: 1.0, min_velocity: 0.5, max_velocity: 2.0 }
    };
  }

  /**
   * Calculate total drawing distance
   */
  private calculateTotalDistance(): number {
    let totalDistance = 0;
    
    this.allPaths.forEach(path => {
      for (let i = 1; i < path.length; i++) {
        const dx = path[i].x - path[i - 1].x;
        const dy = path[i].y - path[i - 1].y;
        totalDistance += Math.sqrt(dx * dx + dy * dy);
      }
    });
    
    return totalDistance;
  }

  /**
   * Calculate bounding box
   */
  private calculateBoundingBox(): { min_x: number; min_y: number; max_x: number; max_y: number; center_x: number; center_y: number } {
    if (this.allPaths.length === 0) {
      return { min_x: 0, min_y: 0, max_x: 0, max_y: 0, center_x: 0, center_y: 0 };
    }
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    this.allPaths.forEach(path => {
      path.forEach(point => {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      });
    });
    
    return {
      min_x: minX,
      min_y: minY,
      max_x: maxX,
      max_y: maxY,
      center_x: (minX + maxX) / 2,
      center_y: (minY + maxY) / 2
    };
  }

  /**
   * Debounced progress emission
   */
  private debouncedProgressEmit(delay = 200): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    this.animationFrameId = requestAnimationFrame(() => {
      this.signatureProgress.emit(this.signatureQuality);
    });
  }

  /**
   * Handle resize
   */
  private handleResize(): void {
    setTimeout(() => {
      this.initializeCanvas();
      this.redrawAllPaths();
    }, 100);
  }

  /**
   * Handle keyboard events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        if (this.isDrawing) {
          this.endDrawing();
        }
        break;
      case 'Delete':
      case 'Backspace':
        this.clearCanvas();
        break;
      case 'Enter':
        if (!this.isDrawing && this.allPaths.length > 0) {
          this.submitSignature();
        }
        break;
    }
  }

  /**
   * Submit signature (public method)
   */
  public submitSignature(): void {
    if (this.allPaths.length === 0) return;
    
    this.isCapturing = false;
    this.runSignatureValidation();
  }

  /**
   * Redraw all existing paths
   */
  private redrawAllPaths(): void {
    if (this.allPaths.length === 0 || !this.ctx) return;
    
    this.allPaths.forEach(path => {
      if (path.length > 1) {
        this.ctx.beginPath();
        this.ctx.moveTo(path[0].x, path[0].y);
        
        for (let i = 1; i < path.length; i++) {
          this.ctx.lineTo(path[i].x, path[i].y);
        }
        
        this.ctx.lineWidth = this.canvasConfig.penWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = this.canvasConfig.penColor;
        this.ctx.stroke();
      }
    });
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): SignatureCanvasConfig {
    return {
      width: this.width,
      height: this.height,
      backgroundColor: this.backgroundColor,
      penColor: this.penColor,
      penWidth: this.penWidth,
      minPenWidth: 1,
      maxPenWidth: 5,
      smoothingFactor: 0.85,
      velocityFilterWeight: 0.7,
      enablePressure: this.enablePressure,
      enableVelocity: this.enableVelocity,
      enableSmoothing: this.enableSmoothing
    };
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    // Remove event listeners
    if (this.canvas) {
      const canvas = this.canvas.nativeElement;
      canvas.removeEventListener('mousedown', this.handleMouseDown.bind(this));
      canvas.removeEventListener('mousemove', this.handleMouseMove.bind(this));
      canvas.removeEventListener('mouseup', this.handleMouseUp.bind(this));
      canvas.removeEventListener('mouseleave', this.handleMouseLeave.bind(this));
      canvas.removeEventListener('touchstart', this.handleTouchStart.bind(this));
      canvas.removeEventListener('touchmove', this.handleTouchMove.bind(this));
      canvas.removeEventListener('touchend', this.handleTouchEnd.bind(this));
      canvas.removeEventListener('touchcancel', this.handleTouchCancel.bind(this));
      canvas.removeEventListener('pointerdown', this.handlePointerDown.bind(this));
      canvas.removeEventListener('pointermove', this.handlePointerMove.bind(this));
      canvas.removeEventListener('pointerup', this.handlePointerUp.bind(this));
      canvas.removeEventListener('pointercancel', this.handlePointerCancel.bind(this));
      canvas.removeEventListener('keydown', this.handleKeyDown.bind(this));
    }
    
    window.removeEventListener('resize', this.handleResize.bind(this));
  }

  /**
   * Public method to undo last stroke
   */
  public undo(): void {
    if (this.allPaths.length > 0 && !this.isDrawing) {
      this.allPaths.pop();
      this.redrawCanvas();
    }
  }

  /**
   * Public method to get current signature data
   */
  public getCurrentSignature(): string | null {
    if (!this.canvas || this.allPaths.length === 0) return null;
    return this.canvas.nativeElement.toDataURL('image/png');
  }

  /**
   * Redraw the entire canvas
   */
  private redrawCanvas(): void {
    this.clearCanvas();
    this.redrawAllPaths();
    
    if (this.autoValidate && this.allPaths.length > 0) {
      this.updateRealTimeQuality();
    }
  }
}