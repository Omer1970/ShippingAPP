import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { 
  switchMap, 
  catchError, 
  map, 
  filter,
  concatMap,
  delay,
  retry,
  take,
  timeout
} from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

// Queue item interfaces
export interface QueueItem {
  id: string;
  type: 'delivery' | 'signature' | 'photo' | 'status-update';
  data: any;
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  error?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface QueueStatus {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  expired: number;
}

export interface QueueMetrics {
  averageProcessingTime: number;
  successRate: number;
  failureRate: number;
  oldestItemAge: number;
  newestItemAge: number;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineQueueService {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private readonly STORAGE_KEY = 'delivery_queue';
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly ITEM_EXPIRY_DAYS = 7;
  private readonly DEFAULT_RETRY_ATTEMPTS = 3;
  private readonly PROCESSING_INTERVAL = 30000; // 30 seconds
  private readonly OFFLINE_BUFFER_SIZE = 50;
  
  private processingInterval: any = null;
  private metrics: { startTime: number; success: number; failure: number } = 
    { startTime: Date.now(), success: 0, failure: 0 };

  constructor(private http: HttpClient) {
    this.initializeQueue();
    this.startBackgroundProcessing();
  }

  /**
   * Initialize queue from local storage
   */
  private initializeQueue(): void {
    try {
      const storedData = localStorage.getItem(this.STORAGE_KEY);
      if (storedData) {
        const items = JSON.parse(storedData);
        
        // Filter out expired and completed items
        this.queue = items.filter((item: QueueItem) => 
          !this.isItemExpired(item) && item.status !== 'completed'
        );
        
        this.persistQueue();
      }
    } catch (error) {
      console.error('Failed to initialize queue from storage:', error);
      this.queue = [];
    }
  }

  /**
   * Check if item is expired
   */
  private isItemExpired(item: QueueItem): boolean {
    const expiryTime = this.ITEM_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - item.timestamp > expiryTime;
  }

  /**
   * Check if app is online
   */
  private isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Add item to offline queue
   */
  addToQueue(
    type: QueueItem['type'],
    method: QueueItem['method'],
    url: string,
    data: any,
    priority: QueueItem['priority'] = 'medium',
    maxRetries: number = this.DEFAULT_RETRY_ATTEMPTS
  ): Observable<string> {
    const item: QueueItem = {
      id: uuidv4(),
      type,
      method,
      url,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries,
      status: 'pending',
      priority
    };

    return this.addItemToQueue(item);
  }

  /**
   * Add delivery confirmation to queue
   */
  queueDeliveryConfirmation(shipmentId: number, confirmationData: any): Observable<string> {
    const url = `/deliveries/${shipmentId}/confirm`;
    return this.addToQueue('delivery', 'POST', url, confirmationData, 'high');
  }

  /**
   * Add signature upload to queue
   */
  queueSignatureUpload(deliveryId: number, signatureData: any): Observable<string> {
    const url = `/deliveries/${deliveryId}/signature`;
    return this.addToQueue('signature', 'POST', url, signatureData, 'high');
  }

  /**
   * Add photo upload to queue
   */
  queuePhotoUpload(deliveryId: number, photoData: any): Observable<string> {
    const url = `/deliveries/${deliveryId}/photo`;
    return this.addToQueue('photo', 'POST', url, photoData, 'medium');
  }

  /**
   * Add status update to queue
   */
  queueStatusUpdate(deliveryId: number, statusData: any): Observable<string> {
    const url = `/deliveries/${deliveryId}/status`;
    return this.addToQueue('status-update', 'PUT', url, statusData, 'high');
  }

  /**
   * Add item to queue with storage persistence
   */
  private addItemToQueue(item: QueueItem): Observable<string> {
    // Check queue size limit
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      // Remove oldest low priority items
      const index = this.queue.findIndex(q => q.priority === 'low');
      if (index !== -1) {
        this.queue.splice(index, 1);
      } else {
        // Remove oldest item if no low priority items
        this.queue.shift();
      }
    }

    this.queue.push(item);
    this.sortQueueByPriority();
    this.persistQueue();

    // Start processing if online
    if (this.isOnline()) {
      this.processNextItem().subscribe();
    }

    return of(item.id);
  }

  /**
   * Process next item in queue
   */
  processNextItem(): Observable<any> {
    if (this.isProcessing || !this.isOnline()) {
      return of(null);
    }

    const nextItem = this.getNextProcessableItem();
    if (!nextItem) {
      return of(null);
    }

    // Set item as processing
    nextItem.status = 'processing';
    this.persistQueue();

    return this.executeQueueItem(nextItem);
  }

  /**
   * Execute individual queue item
   */
  private executeQueueItem(item: QueueItem): Observable<any> {
    const startTime = Date.now();
    
    return this.http.request(item.method, item.url, {
      body: item.data,
      headers: {
        'X-Queue-Id': item.id,
        'X-Retry-Count': item.retryCount.toString()
      }
    }).pipe(
      timeout(30000), // 30 second timeout
      map(response => {
        this.updateItemStatus(item.id, 'completed');
        this.metrics.success++;
        
        console.log(`Queue item ${item.id} completed successfully`, {
          type: item.type,
          duration: Date.now() - startTime,
          retryCount: item.retryCount
        });
        
        return response;
      }),
      catchError(error => {
        console.error(`Queue item ${item.id} failed`, {
          type: item.type,
          error: error.message,
          retryCount: item.retryCount,
          maxRetries: item.maxRetries
        });

        return this.handleQueueItemError(item, error, startTime);
      }),
      switchMap(() => this.processNextItem())
    );
  }

  /**
   * Handle queue item execution error
   */
  private handleQueueItemError(item: QueueItem, error: any, startTime: number): Observable<any> {
    const isNetworkError = error.status === 0 || error.status >= 500;
    const isEligibleForRetry = item.retryCount < item.maxRetries && isNetworkError;

    if (isEligibleForRetry) {
      return this.retryQueueItem(item);
    } else {
      this.updateItemStatus(item.id, 'failed', error.message);
      this.metrics.failure++;
      
      console.warn(`Queue item ${item.id} permanently failed`, {
        type: item.type,
        error: error.message,
        maxRetriesReached: item.retryCount >= item.maxRetries
      });

      return throwError(() => error);
    }
  }

  /**
   * Retry failed queue item
   */
  retryQueueItem(item: QueueItem): Observable<any> {
    item.retryCount++;
    item.status = 'pending'; // Reset status for retry
    this.persistQueue();

    console.log(`Retrying queue item ${item.id}`, {
      retryAttempt: item.retryCount,
      maxRetries: item.maxRetries,
      nextDelay: this.getRetryDelay(item.retryCount)
    });

    // Schedule retry with exponential backoff
    const delay = this.getRetryDelay(item.retryCount);

    return of(null).pipe(
      delay(delay),
      switchMap(() => this.executeQueueItem(item))
    );
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private getRetryDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 60000); // Max 1 minute
  }

  /**
   * Get next processable item (non-expired, pending, sorted by priority)
   */
  private getNextProcessableItem(): QueueItem | null {
    return this.queue
      .filter(item => 
        item.status === 'pending' && 
        !this.isItemExpired(item) &&
        item.retryCount < item.maxRetries
      )
      .sort((a, b) => {
        // Priority sort: high -> medium -> low
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        // Then by oldest first
        return a.timestamp - b.timestamp;
      })[0] || null;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): QueueStatus {
    const status = {
      total: this.queue.length,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      expired: 0
    };

    this.queue.forEach(item => {
      switch (item.status) {
        case 'pending': status.pending++; break;
        case 'processing': status.processing++; break;
        case 'completed': status.completed++; break;
        case 'failed': status.failed++; break;
      }
    });

    return status;
  }

  /**
   * Get queue metrics
   */
  getQueueMetrics(): QueueMetrics {
    const pendingItems = this.queue.filter(item => item.status === 'pending' || item.status === 'processing');
    const completedItems = this.queue.filter(item => item.status === 'completed');
    const failedItems = this.queue.filter(item => item.status === 'failed');
    
    const total = this.metrics.success + this.metrics.failure;
    const successRate = total > 0 ? (this.metrics.success / total) * 100 : 0;
    const failureRate = total > 0 ? (this.metrics.failure / total) * 100 : 0;

    const oldestItem = this.queue.reduce((oldest, item) => 
      item.timestamp < oldest.timestamp ? item : oldest, 
      { timestamp: Date.now() }
    );

    const newestItem = this.queue.reduce((newest, item => 
      item.timestamp > newest.timestamp ? item : newest,
      { timestamp: Date.now() }
    ));

    return {
      averageProcessingTime: this.calculateAverageProcessingTime(completedItems),
      successRate,
      failureRate,
      oldestItemAge: Date.now() - oldestItem.timestamp,
      newestItemAge: Date.now() - newestItem.timestamp
    };
  }

  /**
   * Calculate average processing time for completed items
   */
  private calculateAverageProcessingTime(completedItems: QueueItem[]): number {
    if (completedItems.length === 0) return 0;
    // This would need item completion timestamps for accurate calculation
    return completedItems.length * 2000; // Placeholder - 2 seconds per item
  }

  /**
   * Get specific item by ID
   */
  getQueueItem(id: string): QueueItem | null {
    return this.queue.find(item => item.id === id) || null;
  }

  /**
   * Get all items for specific delivery
   */
  getDeliveryQueueItems(deliveryId: number): QueueItem[] {
    return this.queue.filter(item => 
      item.data?.deliveryId === deliveryId || 
      item.data?.shipmentId === deliveryId ||
      item.url.includes(`/deliveries/${deliveryId}`)
    );
  }

  /**
   * Remove item from queue
   */
  removeQueueItem(id: string): Observable<boolean> {
    const index = this.queue.findIndex(item => item.id === id);
    if (index === -1) {
      return of(false);
    }

    this.queue.splice(index, 1);
    this.persistQueue();
    return of(true);
  }

  /**
   * Update item status
   */
  private updateItemStatus(id: string, status: QueueItem['status'], error?: string): void {
    const item = this.queue.find(item => item.id === id);
    if (item) {
      item.status = status;
      if (error) {
        item.error = error;
      }
      this.persistQueue();

      // Dispatch status update event
      window.dispatchEvent(new CustomEvent('queueItemUpdated', { 
        detail: { itemId: id, status, error } 
      }));
    }
  }

  /**
   * Sort queue items by priority
   */
  private sortQueueByPriority(): void {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    this.queue.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Persist queue to local storage
   */
  private persistQueue(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to persist queue:', error);
      
      // Fallback: persist only essential items if quota exceeded
      if (error.name === 'QuotaExceededError') {
        this.trimQueueToEssential();
      }
    }
  }

  /**
   * Trim queue to essential items only (high priority, recent)
   */
  private trimQueueToEssential(): void {
    const essentialItems = this.queue
      .filter(item => 
        item.priority === 'high' && 
        !this.isItemExpired(item) && 
        item.status !== 'completed'
      )
      .slice(0, this.OFFLINE_BUFFER_SIZE);

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(essentialItems));
  }

  /**
   * Start background processing
   */
  private startBackgroundProcessing(): void {
    // Process queue when app comes online
    window.addEventListener('online', () => {
      console.log('App came online, processing offline queue');
      this.processNextItem().subscribe();
    });

    // Process queue periodically
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(() => {
      if (this.isOnline() && this.isProcessing === false) {
        this.processNextItem().subscribe();
      }
    }, this.PROCESSING_INTERVAL);
  }

  /**
   * Force process all pending items
   */
  processAllPendingItems(): Observable<QueueStatus> {
    return from(this.queue.filter(item => item.status === 'pending')).pipe(
      concatMap(item => this.executeQueueItem(item).pipe(
        catchError(() => of(null))
      )),
      filter(result => result !== null),
      map(() => this.getQueueStatus())
    );
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    this.queue = [];
    this.persistQueue();
    
    // Dispatch queue cleared event
    window.dispatchEvent(new CustomEvent('queueCleared'));
  }

  /**
   * Export queue data for backup
   */
  exportQueueData(): string {
    return JSON.stringify({
      queue: this.queue,
      metrics: this.metrics,
      exportTimestamp: Date.now()
    });
  }

  /**
   * Import queue data from backup
   */
  importQueueData(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      if (parsed.queue && Array.isArray(parsed.queue)) {
        this.queue = parsed.queue;
        if (parsed.metrics) {
          this.metrics = { ...this.metrics, ...parsed.metrics };
        }
        this.persistQueue();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to import queue data:', error);
      return false;
    }
  }

  /**
   * Clean up service
   */
  ngOnDestroy(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    this.isProcessing = false;
  }
}