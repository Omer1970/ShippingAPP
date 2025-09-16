import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { SignatureCanvasComponent } from './signature-canvas.component';
import { CommonModule } from '@angular/common';
import { SignatureService } from '../../core/services/signature.service';
import { OffliectionQueueService } from '../../core/services/offline-queue.service';
import { Subject, BehaviorSubject } from 'rxjs';
import { PLATFORM_ID } from '@angular/core';

// Mock Classes
class MockSignatureService {
  signatureData$ = new Subject<any>();
  sentProgress$ = new Subject<any>();
  mockCanvasService = (serviceSignatureService) => {
    this.signatureData$.next({
      signature_data: 'data:image/png;base64,iVBORw0KGgoAAAANSU...',
      signature_quality: 0.9
    });
    this.sentProgress$.next({
      progress_type: 'completed',
      final_quality: 0.9
    });
  };

  validateSignature = jasmine.createSpy('validateSignature');
  getSignatureQuality = jasmine.createSpy('getSignatureQuality');
  saveSignatureTemplate = jasmine.createSpy('saveSignatureTemplate');
}

class MockOfflineQueueService {
  isOffline = jasmine.createSpy('isOffline');
  checkSignatureCompatibility = jasmine.createSpy('checkSignatureCompatibility');
}

class MockPlatform {
  isBrowser = true;
  isServer = false;
}

// Test Configuration
let canvasSupported = true;
let touchEventSupported = true;
let webGL2Supported = true;
let getContextSupported = true;

// Mock Canvas Context
class MockCanvasRenderingContext2D {
   moveTo = jasmine.createSpy('moveTo');
   lineTo = jasmine.createSpy('lineTo');
   stroke = jasmine.createSpy('stroke');
   beginPath = jasmine.createSpy('beginPath');
   clearRect = jasmine.createSpy('clearRect');
   strokeStyle = '#000000';
   lineWidth = 2;
   lineCap = 'round';
   lineJoin = 'round';
   getImageData = jasmine.createSpy('getImageData');
   putImageData = jasmine.createSpy('putImageData');
   constructor() {
     // Set up spy properties
     this.moveTo.and.returnValue(this);
     this.lineTo.and.returnValue(this);
     this.stroke.and.returnValue(this);
     this.beginPath.and.returnValue(this);
     this.clearRect.and.returnValue(this);
     this.getImageData.and.returnValue({
       data: new Uint8ClampedArray(200 * 100 * 4),
       width: 200,
       height: 100
     });
     this.putImageData.and.returnValue(this);
   }
}

// Mock Canvas
class MockCanvas {
   width = 500;
   height = 200;
   getContext = jasmine.createSpy('getContext');
   toDataURL = jasmine.createSpy('toDataURL');
   addEventListener = jasmine.createSpy('addEventListener');
   removeEventListener = jasmine.createSpy('removeEventListener');
   widthSetter = jasmine.createSpy('widthSetter');
   heightSetter = jasmine.createSpy('heightSetter');

   getBoundingClientRect = jasmine.createSpy('getBoundingClientRect').and.returnValue({
     left: 100,
     top: 50,
     width: 500,
     height: 200
   });

   constructor(contextOptions = null) {
     this.getContext.and.returnValue(new MockCanvasRenderingContext2D());
     this.toDataURL.and.returnValue('data:image/png;base64,iVBORw0KGgoAAAANSU...');
     this.addEventListener.and.returnValue(undefined);
     this.removeEventListener.and.returnValue(undefined);
   }

   set width(newWidth: number) {
     this.widthSetter(newWidth);
     this._width = newWidth;
   }

   get width(): number {
     return this._width || 500;
   }

   set height(newHeight: number) {
     this.heightSetter(newHeight);
     this._height = newHeight;
   }

   get height(): number {
     return this._height || 200;
   }
}

// Mock Navigator
class MockNavigator {
  language = 'en-US';
  languages = ['en-US', 'en'];
  userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  getBattery() {
    return Promise.resolve({
      level: 0.75,
      charging: false
    });
  }
}

describe('SignatureCanvasComponent', () => {
  let component: SignatureCanvasComponent;
  let fixture: ComponentFixture<SignatureCanvasComponent>;
  let signatureService: MockSignatureService;
  let offlineQueueService: MockOfflineQueueService;
  let platform: MockPlatform;
  let mockCanvas: MockCanvas;
  let mockContext: MockCanvasRenderingContext2D;
  let elQuerySelectorSpy: jasmine.Spy;

  beforeEach(async () => {
    signatureService = new MockSignatureService();
    offlineQueueService = new MockOfflineQueueService();
    platform = new MockPlatform();

    // Create mock canvas element with access to spies
    mockCanvas = new MockCanvas();
    mockContext = mockCanvas.getContext.call() as any;

    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [SignatureCanvasComponent],
      providers: [
        { provide: SignatureService, useValue: signatureService },
        { provide: OfflineQueueService, useValue: offlineQueueService },
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: MockPlatform, useValue: platform }
      ]
    }).compileComponents();

    // Mock document mutations and global APIs
    const canvasElement = document.createElement('canvas');
    Object.defineProperty(canvasElement, 'getContext', {
      value: jasmine.createSpy('getContext').and.returnValue(mockContext)
    });
    Object.defineProperty(canvasElement, 'toDataURL', {
      value: jasmine.createSpy('toDataURL').and.returnValue('data:image/png;base64,iVBORw0KGgo...')
    });
    Object.defineProperty(canvasElement, 'width', { value: 500 });
    Object.defineProperty(canvasElement, 'height', { value: 200 });
    Object.defineProperty(canvasElement, 'addEventListener', {
      value: jasmine.createSpy('addEventListener')
    });
    Object.defineProperty(canvasElement, 'removeEventListener', {
      value: jasmine.createSpy('removeEventListener')
    });
    Object.defineProperty(canvasElement, 'getBoundingClientRect', {
      value: jasmine.createSpy('getBoundingClientRect').and.returnValue({
        left: 100,
        top: 50,
        right: 600,
        bottom: 250,
        width: 500,
        height: 200
      })
    });

    // Mock all querySelector calls to return the canvas element
    elQuerySelectorSpy = spyOn(document.body, 'querySelector').and.callFake((selector: string) => {
      if (selector.includes('canvas') || selector.includes('signature')) {
        return canvasElement as any;
      }
      return null;
    });

    // Mock global API calls
    spyOn(window, 'getComputedStyle').and.returnValue({
      getPropertyValue() { return '16'; }
    } as any);
    spyOn(navigator, 'userAgent', 'get').and.returnValue('Mozilla/5.0');

    // Mock window listeners
    const resizeListenerSpy = jasmine.createSpy('resizeListener');
    spyOn(window, 'addEventListener').and.callFake((event: string, callback: EventListener) => {
      if (event === 'resize') {
        resizeListenerSpy(event);
      }
    });
    spyOn(window, 'removeEventListener').and.returnValue(undefined);

    fixture = TestBed.createComponent(SignatureCanvasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Canvas Initialization', () => {
    it('should initialize canvas element and context', () => {
      expect(component.canvas).toBeDefined();
      expect(component.canvasContext).toBeDefined();
      expect(component.canvas).not.toBeNull();
      expect(component.canvasContext).not.toBeNull();
      expect(elQuerySelectorSpy).toHaveBeenCalled();
    });

    it('should initialize with default properties', () => {
      expect(component.strokeWidth).toBe(2);
      expect(component.strokeColor).toBe('#000000');
      expect(component.isEraserMode).toBeFalse();
      expect(component.signatureQuality).toBeUndefined();
      expect(component.isDrawing).toBeFalse();
      expect(component.hasSignature).toBeFalse();
      expect(component.signatureStrokes).toEqual([]);
    });

    it('should setup event listeners for mouse and touch input', () => {
      expect(component.canvas).toBeDefined();
      expect(component.canvas.addEventListener).toHaveBeenCalledWith('mousedown', jasmine.any(Function));
      expect(component.canvas.addEventListener).toHaveBeenCalledWith('mousemove', jasmine.any(Function));
      expect(component.canvas.addEventListener).toHaveBeenCalledWith('mouseup', jasmine.any(Function));
      expect(component.canvas.addEventListener).toHaveBeenCalledWith('touchstart', jasmine.any(Function));
      expect(component.canvas.addEventListener).toHaveBeenCalledWith('touchmove', jasmine.any(Function));
      expect(component.canvas.addEventListener).toHaveBeenCalledWith('touchend', jasmine.any(Function));
    });
  });

  describe('Drawing Operations', () => {
    let startDrawingSpy: jasmine.Spy;
    let drawSpy: jasmine.Spy;
    let stopDrawingSpy: jasmine.Spy;

    beforeEach(() => {
      startDrawingSpy = spyOn(component, 'startDrawing');
      drawSpy = spyOn(component, 'draw');
      stopDrawingSpy = spyOn(component, 'stopDrawing');
    });

    it('should start drawing on mousedown', () => {
      const mockEvent = new MouseEvent('mousedown', {
        clientX: 200,
        clientY: 100,
        button: 0
      });
      component.canvas.dispatchEvent(mockEvent);
      expect(startDrawingSpy).toHaveBeenCalledWith(mockEvent);
    });

    it('should handle touchstart events', () => {
      const mockTouch = new Touch({
        identifier: 1,
        target: component.canvas,
        clientX: 200,
        clientY: 100,
        force: 0.8,
        radiusX: 10,
        radiusY: 10,
        rotationAngle: 0,
        pageX: 200,
        pageY: 100
      } as any);

      const mockTouchEvent = new TouchEvent('touchstart', {
        touches: [mockTouch],
        changedTouches: [mockTouch],
        targetTouches: [mockTouch],
        bubbles: true,
        cancelable: true
      });

      component.canvas.dispatchEvent(mockTouchEvent);
      expect(startDrawingSpy).toHaveBeenCalledWith(mockTouchEvent);
    });

    it('should draw when mouse moves while drawing', () => {
      component.isDrawing = true;
      const mockEvent = new MouseEvent('mousemove', {
        clientX: 250,
        clientY: 120,
        button: 0
      });

      component.canvas.dispatchEvent(mockEvent);
      expect(drawSpy).toHaveBeenCalledWith(mockEvent);
    });

    it('should stop drawing on mouseup', () => {
      component.isDrawing = true;
      const mockEvent = new MouseEvent('mouseup', {
        clientX: 300,
        clientY: 150,
        button: 0
      });

      component.canvas.dispatchEvent(mockEvent);
      expect(stopDrawingSpy).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe('Signature Quality Assessment', () => {
    it('should validate signature quality', () => {
      const validSignatureData = {
        signature_data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        signature_quality: 0.85
      };

      const invalidSignatureData = {
        signature_data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        signature_quality: 0.35
      };

      signatureService.validateSignature.and.returnValue(true);
      signatureService.getSignatureQuality.and.returnValue(0.85);

      component.signatureData = validSignatureData;
      component.updateSignatureQuality();

      expect(component.signatureQuality).toBe(0.85);
      expect(component.hasValidSignature).toBeTrue();
      expect(component.signatureQualityLabel).toBe('Good');
      expect(signatureService.validateSignature).toHaveBeenCalledWith(validSignatureData);

      // Test with poor quality signature
      component.signatureData = invalidSignatureData;
      signatureService.getSignatureQuality.and.returnValue(0.35);
      component.updateSignatureQuality();

      expect(component.signatureQuality).toBe(0.35);
      expect(component.hasValidSignature).toBeFalse();
      expect(component.signatureQualityLabel).toBe('Poor');
    });

    it('should emit signature data on completion', () => {
      spyOn(component.signatureDataChange, 'emit');

      // Complete signature drawing
      const signatureData = {
        signature_data: 'data:image/png;base64,iVBORw0KGgoAAAANSU...',
        signature_quality: 0.9
      };

      component.onSignatureCompleted(signatureData);

      expect(component.signatureDataChange.emit).toHaveBeenCalledWith(signatureData);
      expect(component.hasSignature).toBeTrue();
    });

    it('should count signature strokes', () => {
      const stroke1 = [{ x: 100, y: 50 }, { x: 120, y: 60 }];
      const stroke2 = [{ x: 150, y: 80 }, { x: 170, y: 90 }];

      component.startDrawing({ clientX: 100, clientY: 50 } as MouseEvent);
      component.signatureStrokes.push(stroke1);
      component.endDrawing();
      component.startDrawing({ clientX: 150, clientY: 80 } as MouseEvent);
      component.signatureStrokes.push(stroke2);
      component.endDrawing();

      expect(component.signatureStrokes.length).toBe(2);
    });
  });

  describe('Canvas Operations', () => {
    it('should get correct mouse position', () => {
      const mockEvent = new MouseEvent('mousedown', {
        clientX: 200,
        clientY: 100
      });

      const position = component.getMousePosition(mockEvent);
      expect(position.x).toBeGreaterThan(0);
      expect(position.y).toBeGreaterThan(0);
    });

    it('should draw line on canvas', () => {
      const mockContext = component.canvasContext;

      component.drawLine(100, 50, 150, 80);

      expect(mockContext.beginPath).toHaveBeenCalled();
      expect(mockContext.moveTo).toHaveBeenCalledWith(100, 50);
      expect(mockContext.lineTo).toHaveBeenCalledWith(150, 80);
      expect(mockContext.stroke).toHaveBeenCalled();
      expect(mockContext.lineWidth).toBe(component.strokeWidth);
    });

    it('should clear canvas', () => {
      const clearSpy = spyOn(component, 'clearCanvas').and.callThrough();
      const drawSpy = spyOn(component, 'clearCanvas').and.callThrough();

      component.clearSignature();

      expect(component.hasSignature).toBeFalse();
      expect(component.signatureData).toBeUndefined();
      expect(clearSpy).toHaveBeenCalled();

      expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, mockCanvas.width, mockCanvas.height);
    });

    it('should handle canvas resize', () => {
      const resizeObserver = spyOn(window, 'addEventListener').and.returnValue(undefined);

      // Trigger resize event
      window.dispatchEvent(new Event('resize'));

      expect(resizeObserver).toHaveBeenCalledWith('resize', jasmine.any(Function));
    });
  });

  describe('Touch and Stylus Support', () => {
    it('should handle pressure-sensitive stylus input', () => {
      const mockTouchEvent = new TouchEvent('touchstart', {
        touches: [new Touch({
          identifier: 1,
          target: component.canvas,
          clientX: 200,
          clientY: 100,
          force: 0.8,
          radiusX: 10,
          radiusY: 10,
          rotationAngle: 0
        } as any)],
        changedTouches: [],
        targetTouches: []
      });

      component.handleTouchStart(mockTouchEvent);

      expect(component.isDrawing).toBeTrue();
      expect(component.strokeForce).toBe(0.8);
    });

    it('should detect stylus vs finger input', () => {
      const stylusTouch = new TouchEvent('touchstart', {
        touches: [new Touch({
          identifier: 1,
          target: component.canvas,
          clientX: 200,
          clientY: 100,
          force: 0.8,
          radiusX: 2,
          radiusY: 2 // Small radius indicates stylus
        } as any)]
      });

      const fingerTouch = new TouchEvent('touchstart', {
        touches: [new Touch({
          identifier: 2,
          target: component.canvas,
          clientX: 250,
          clientY: 150,
          force: 0.4,
          radiusX: 15,
          radiusY: 15 // Large radius indicates finger
        } as any)]
      });

      component.handleTouchStart(stylusTouch);
      expect(component.isStylus).toBeTrue();

      component.handleTouchStart(fingerTouch);
      expect(component.isStylus).toBeFalse();
    });

    it('should handle multi-touch gracefully', () => {
      const multitouchEvent = new TouchEvent('touchstart', {
        touches: [
          new Touch({ identifier: 1, clientX: 100, clientY: 100 } as any),
          new Touch({ identifier: 2, clientX: 200, clientY: 200 } as any)
        ]
      });

      spyOn(console, 'warn');

      component.handleTouchStart(multitouchEvent);

      expect(console.warn).toHaveBeenCalledWith('Multi-touch not supported');
      expect(component.isDrawing).toBeTrue(); // Should work with first touch
    });
  });

  describe('Offline Functionality', () => {
    it('should handle offline signature storage', () => {
      offlineQueueService.isOffline.and.returnValue(true);

      component.signatureData = {
        signature_data: 'data:image/png;base64,iVBORw0KGgoAAAA...',
        signature_quality: 0.85
      };

      component.onSignatureCompleted(component.signatureData);
    });

    it('should detect signature compatibility offline', () => {
      offlineQueueService.isOffline.and.returnValue(true);

      const signatureData = {
        signature_data: 'data:image/png;base64,iVBORw0KGgoAAAA...',
        signature_quality: 0.9
      };

      offlineQueueService.checkSignatureCompatibility.and.returnValue(true);

      component.signatureData = signatureData;
      component.updateSignatureQuality();

      expect(offlineQueueService.checkSignatureCompatibility).toHaveBeenCalledWith(signatureData);
    });
  });

  describe('Component Lifecycle and Cleanup', () => {
    it('should clean up properly on destroy', () => {
      component.unsaved = true;
      const confirmSpy = spyOn(window, 'confirm').and.returnValue(true);

      component.ngOnDestroy();

      expect(confirmSpy).toHaveBeenCalledWith('You have an unsaved signature. Are you sure you want to leave?');
      expect(component.canvasContext).toBeNull();
    });

    it('should unsubscribe from service observables on destroy', () => {
      const unsubscribeSpy = jasmine.createSpy('unsubscribe');
      component.subscription = { unsubscribe: unsubscribeSpy } as any;

      component.ngOnDestroy();

      expect(unsubscribeSpy).toHaveBeenCalled();
    });
  });

  describe('Security and Validation', () => {
    it('should validate minimum signature requirements', () => {
      const insufficientSignature = {
        signature_data: 'data:image/png;base64,aW1n',
        signature_quality: 0.65,
        stroke_count: 1
      };

      const validSignature = {
        signature_data: 'data:image/png;base64,iVBORw0KGgoAAAANSU...',
        signature_quality: 0.85,
        stroke_count: 5
      };

      expect(component.isMinimumSignatureValid(insufficientSignature)).toBeFalse();
      expect(component.isMinimumSignatureValid(validSignature)).toBeTrue();
    });

    it('should prevent replay attacks with time tracking', () => {
      const signatureWithTimestamp = {
        signature_data: 'data:image/png;base64,iVBORw0KGgoAAAANSU...',
        signature_quality: 0.9,
        timestamp: Date.now()
      };

      component.lastSignatureTimestamp = Date.now() - 1000; // 1 second ago

      expect(component.isNewSignature(signatureWithTimestamp)).toBeTrue();

      component.lastSignatureTimestamp = Date.now() - 5000; // 5 seconds ago

      expect(component.isNewSignature(signatureWithTimestamp)).toBeTrue();
    });
  });

  describe('Visual Feedback and Animation', () => {
    it('should provide visual feedback during drawing', () => {
      component.captureStartTime = Date.now() - 2000; // 2 seconds ago

      component.startDrawing({ clientX: 100, clientY: 100 } as MouseEvent);

      expect(component.signatureProgress).toBeGreaterThan(0);
    });

    it('should animate canvas elements', () => {
      spyOn(component, 'animateDrawing');

      component.startDrawing({ clientX: 100, clientY: 100 } as MouseEvent);

      // Animation should be triggered
      expect(component.animateDrawing).toHaveBeenCalled();
    });

    it('should show quality indicator', () => {
      component.signatureQuality = 0.9;

      component.updateQualityIndicator();

      expect(component.qualityColor).toBe('green');
    });
  });

});