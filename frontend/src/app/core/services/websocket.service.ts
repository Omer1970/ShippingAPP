import { Injectable } from '@angular/core';
import { Subject, Observable, BehaviorSubject, fromEvent, merge, of } from 'rxjs';
import { filter, map, catchError, share, takeUntil, switchMap } from 'rxjs/operators';
import Pusher from 'pusher-js';

import { DeliveryUpdate } from '../models/delivery.model';
import { environment } from '../../../environments/environment';

export interface WebSocketConnection {
  connected: boolean;
  channel?: any;
  subscriptionCount: number;
}

export interface DeliveryUpdateEvent {
  delivery_id: number;
  shipment_id: number;
  status: string;
  user_id: number;
  event_type: string;
  update_data: any;
  has_signature: boolean;
  signature_quality: number | null;
  photo_count: number;
  gps_coordinates: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  synced_to_erp: boolean;
  erp_sync_at: string | null;
  delivered_at: string | null;
  recipient_name: string;
  timestamp: string;
  verification_hash: string;
}

export interface SignatureProgressEvent {
  delivery_id: number;
  shipment_id: number;
  progress_type: 'started' | 'drawing' | 'completed' | 'cleared';
  timestamp: string;
  canvas_size?: {
    width: number;
    height: number;
  };
  stroke_count?: number;
  current_quality?: number;
  final_quality?: number;
  is_legally_valid?: boolean;
  reason?: string;
}

export interface DeliveryLocationEvent {
  delivery_id: number;
  shipment_id: number;
  user_id: number;
  coordinates: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  update_type: string;
  timestamp: string;
  status: string;
  current_address: string;
  speed_kmh?: number;
  battery_level?: number;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private pusherClient: Pusher;
  private connectionStatus$ = new BehaviorSubject<WebSocketConnection>({
    connected: false,
    subscriptionCount: 0
  });
  private messageSubject = new Subject<any>();
  private destroyed$ = new Subject<void>();
  
  // Subjects for different message types
  private deliveryUpdates$ = new Subject<DeliveryUpdateEvent>();
  private signatureProgress$ = new Subject<SignatureProgressEvent>();
  private photoUploadProgress$ = new Subject<any>();
  private connectionStatusMessages$ = new Subject<any>();
  private deliveryLocation$ = new Subject<DeliveryLocationEvent>();

  // Keep track of subscribed channels
  private subscribedChannels = new Set<string>();
  private channelInstances = new Map<string, any>();

  constructor() {
    this.initializePusher();
  }

  /**
   * Initialize Pusher client connection
   */
  private initializePusher(): void {
    try {
      this.pusherClient = new Pusher(environment.pusher?.key || 'shipment-app-key', {
        cluster: environment.pusher?.cluster || 'mt1',
        encrypted: environment.pusher?.encrypted || false,
        wsHost: environment.pusher?.wsHost || 'localhost',
        wsPort: environment.pusher?.wsPort || 6001,
        enabledTransports: ['ws', 'wss'],
        forceTLS: false,
        // Auth endpoint for private channels
        authEndpoint: `${environment.apiUrl}/broadcasting/auth`,
        auth: {
          headers: {
            'Authorization': `Bearer ${this.getAuthToken()}`,
            'Content-Type': 'application/json'
          }
        }
      });

      // Set up connection state monitoring
      this.setupConnectionMonitoring();

    } catch (error) {
      console.error('Failed to initialize Pusher client:', error);
      this.handleConnectionError(error);
    }
  }

  /**
   * Set up connection state monitoring
   */
  private setupConnectionMonitoring(): void {
    if (!this.pusherClient) return;

    // Connection established
    this.pusherClient.connection.bind('connected', () => {
      console.log('WebSocket connected');
      this.updateConnectionStatus(true);
      this.subscribeToChannel('delivery-updates');
    });

    // Connection disconnected
    this.pusherClient.connection.bind('disconnected', () => {
      console.log('WebSocket disconnected');
      this.updateConnectionStatus(false);
    });

    // Connection error
    this.pusherClient.connection.bind('error', (error: any) => {
      console.error('WebSocket connection error:', error);
      this.handleConnectionError(error);
    });

    // Connection state change monitoring
    this.pusherClient.connection.bind('state_change', (states: any) => {
      console.log('Pusher connection state changed:', states.current);
      
      switch (states.current) {
        case 'connected':
          this.onReconnected();
          break;
        case 'connecting':
          console.log('Attempting to reconnect...');
          break;
        case 'unavailable':
        case 'failed':
          this.handleConnectionFailure();
          break;
      }
    });
  }

  /**
   * Subscribe to delivery status updates for a specific delivery
   */
  public subscribeToDeliveryUpdates(deliveryId: number): Observable<DeliveryUpdateEvent> {
    const channelName = `private-delivery.${deliveryId}`;
    
    if (!this.isSubscribed(channelName)) {
      this.subscribeToChannel(channelName, [
        'delivery.status.updated'
      ], (data: DeliveryUpdateEvent) => {
        this.deliveryUpdates$.next(data);
      });
    }

    return this.deliveryUpdates$.pipe(
      filter(update => update.delivery_id === deliveryId),
      takeUntil(this.destroyed$)
    );
  }

  /**
   * Subscribe to user's delivery updates
   */
  public subscribeToUserDeliveries(userId: number): Observable<DeliveryUpdateEvent> {
    const channelName = `private-user.${userId}.deliveries`;
    
    if (!this.isSubscribed(channelName)) {
      this.subscribeToChannel(channelName, [
        'delivery.status.updated',
        'delivery.location.updated'
      ], (data: DeliveryUpdateEvent | DeliveryLocationEvent) => {
        if ('event_type' in data) {
          this.deliveryUpdates$.next(data as DeliveryUpdateEvent);
        }
      });
    }

    return this.deliveryUpdates$.pipe(
      filter(update => update.user_id === userId),
      takeUntil(this.destroyed$)
    );
  }

  /**
   * Subscribe to signature progress for a specific delivery
   */
  public subscribeToSignatureProgress(deliveryId: number): Observable<SignatureProgressEvent> {
    const channelName = `private-delivery.${deliveryId}.signature`;
    
    if (!this.isSubscribed(channelName)) {
      this.subscribeToChannel(channelName, [
        'signature.progress'
      ], (data: SignatureProgressEvent) => {
        this.signatureProgress$.next(data);
      });
    }

    return this.signatureProgress$.pipe(
      filter(progress => progress.delivery_id === deliveryId),
      takeUntil(this.destroyed$)
    );
  }

  /**
   * Subscribe to delivery location tracking
   */
  public subscribeToDeliveryTracking(deliveryId: number): Observable<DeliveryLocationEvent> {
    const channelName = `private-delivery.${deliveryId}.tracking`;
    
    if (!this.isSubscribed(channelName)) {
      this.subscribeToChannel(channelName, [
        'delivery.location.updated'
      ], (data: DeliveryLocationEvent) => {
        this.deliveryLocation$.next(data);
      });
    }

    return this.deliveryLocation$.pipe(
      filter(location => location.delivery_id === deliveryId),
      takeUntil(this.destroyed$)
    );
  }

  /**
   * Subscribe to delivery tracking by shipment ID (public channel)
   */
  public subscribeToShipmentTracking(shipmentId: number): Observable<DeliveryLocationEvent> {
    const channelName = `delivery-tracking.${shipmentId}`;
    
    if (!this.isSubscribed(channelName)) {
      this.subscribeToChannel(channelName, [
        'delivery.location.updated'
      ], (data: DeliveryLocationEvent) => {
        this.deliveryLocation$.next(data);
      });
    }

    return this.deliveryLocation$.pipe(
      filter(location => location.shipment_id === shipmentId),
      takeUntil(this.destroyed$)
    );
  }

  /**
   * Generic channel subscription helper
   */
  private subscribeToChannel(channelName: string, eventNames: string[], handler: (data: any) => void): void {
    if (this.isSubscribed(channelName)) {
      console.log(`Already subscribed to channel: ${channelName}`);
      return;
    }

    try {
      let channel;

      if (channelName.startsWith('private-') || channelName.startsWith('presence-')) {
        channel = this.pusherClient.subscribe(channelName);
      } else {
        channel = this.pusherClient.subscribe(channelName);
      }

      this.channelInstances.set(channelName, channel);
      this.subscribedChannels.add(channelName);

      console.log(`Subscribed to channel: ${channelName}`);

      // Bind to each event
      eventNames.forEach(eventName => {
        channel.bind(eventName, (data: any) => {
          console.log(`Received ${eventName} event on ${channelName}:`, data);
          handler(data);
        });
      });

      // Handle channel errors
      this.setupChannelErrorHandling(channelName, channel);

      this.updateSubscriptionCount();

    } catch (error) {
      console.error(`Failed to subscribe to channel ${channelName}:`, error);
      this.handleChannelSubscriptionError(channelName, error);
    }
  }

  /**
   * Set up channel error handling
   */
  private setupChannelErrorHandling(channelName: string, channel: any): void {
    channel.bind('pusher:subscription_error', (status: any) => {
      console.error(`Subscription error for channel ${channelName}:`, status);
      this.removeSubscription(channelName);
    });

    channel.bind('pusher:subscription_succeeded', () => {
      console.log(`Subscription succeeded for channel ${channelName}`);
    });
  }

  /**
   * Unsubscribe from a specific channel
   */
  public unsubscribe(channelName: string): void {
    if (!this.isSubscribed(channelName)) {
      return;
    }

    try {
      this.pusherClient.unsubscribe(channelName);
      this.removeSubscription(channelName);
      console.log(`Unsubscribed from channel: ${channelName}`);
    } catch (error) {
      console.error(`Failed to unsubscribe from channel ${channelName}:`, error);
    }
  }

  /**
   * Unsubscribe from all channels
   */
  public unsubscribeAll(): void {
    this.subscribedChannels.forEach(channelName => {
      this.unsubscribe(channelName);
    });
  }

  /**
   * Send a delivery status update event
   */
  public sendDeliveryUpdate(deliveryId: number, eventType: string, updateData: any = {}): Observable<boolean> {
    console.log(`Sending delivery update request for delivery ${deliveryId}`);
    
    // TODO: Implement API call to trigger delivery update event
    return of(true);
  }

  /**
   * Send signature progress event
   */
  public sendSignatureProgress(deliveryId: number, progressType: string, signatureData: any = {}): Observable<boolean> {
    console.log(`Sending signature progress for delivery ${deliveryId}: ${progressType}`);
    
    // TODO: Implement API call to trigger signature progress event
    return of(true);
  }

  /**
   * Send location update event
   */
  public sendLocationUpdate(deliveryId: number, coordinates: { latitude: number, longitude: number, accuracy?: number }): Observable<boolean> {
    console.log(`Sending location update for delivery ${deliveryId}:`, coordinates);
    
    // TODO: Implement API call to trigger location update event
    return of(true);
  }

  /**
   * Get connection status observable
   */
  public getConnectionStatus(): Observable<WebSocketConnection> {
    return this.connectionStatus$.asObservable();
  }

  /**
   * Check if connected to WebSocket
   */
  public isConnected(): boolean {
    return this.pusherClient?.connection.state === 'connected';
  }

  /**
   * Reconnect to WebSocket
   */
  public reconnect(): void {
    if (this.pusherClient) {
      console.log('Attempting WebSocket reconnection...');
      this.pusherClient.connection.reconnect();
    }
  }

  /**
   * Disconnect from WebSocket
   */
  public disconnect(): void {
    this.unsubscribeAll();
    
    if (this.pusherClient) {
      this.pusherClient.disconnect();
    }
    
    this.updateConnectionStatus(false);
  }

  /**
   * Clean up service
   */
  public ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
    this.disconnect();
  }

  // Private helper methods

  private getAuthToken(): string {
    // TODO: Get from auth service
    return localStorage.getItem('auth_token') || '';
  }

  private isSubscribed(channelName: string): boolean {
    return this.subscribedChannels.has(channelName);
  }

  private updateConnectionStatus(connected: boolean): void {
    this.connectionStatus$.next({
      connected,
      subscriptionCount: this.subscribedChannels.size
    });
  }

  private updateSubscriptionCount(): void {
    const currentStatus = this.connectionStatus$.value;
    this.connectionStatus$.next({
      ...currentStatus,
      subscriptionCount: this.subscribedChannels.size
    });
  }

  private removeSubscription(channelName: string): void {
    this.subscribedChannels.delete(channelName);
    this.channelInstances.delete(channelName);
    this.updateSubscriptionCount();
  }

  private handleConnectionError(error: any): void {
    console.error('WebSocket connection error:', error);
    this.updateConnectionStatus(false);
  }

  private handleConnectionFailure(): void {
    console.error('WebSocket connection failed');
    this.updateConnectionStatus(false);
  }

  private handleChannelSubscriptionError(channelName: string, error: any): void {
    console.error(`Channel subscription error for ${channelName}:`, error);
    this.removeSubscription(channelName);
  }

  private onReconnected(): void {
    console.log('WebSocket reconnected - resubscribing to channels');
    this.updateConnectionStatus(true);

    // Resubscribe to all channels that were previously subscribed
    const channelsToResubscribe = Array.from(this.subscribedChannels);
    
    // Clear current subscriptions and re-establish
    this.subscribedChannels.clear();
    this.channelInstances.clear();

    // Resubscribe with appropriate handlers
    setTimeout(() => {
      channelsToResubscribe.forEach(channelName => {
        // Re-establish the subscriptions based on channel patterns
        if (channelName.includes('.signature')) {
          const deliveryId = this.extractDeliveryIdFromChannel(channelName);
          if (deliveryId) {
            this.subscribeToSignatureProgress(deliveryId);
          }
        } else if (channelName.includes('.tracking')) {
          const deliveryId = this.extractDeliveryIdFromChannel(channelName);
          if (deliveryId) {
            this.subscribeToDeliveryTracking(deliveryId);
          }
        } else if (channelName.includes('delivery.') && !channelName.includes('.signature') && !channelName.includes('.tracking')) {
          const deliveryId = this.extractDeliveryIdFromChannel(channelName);
          if (deliveryId) {
            this.subscribeToDeliveryUpdates(deliveryId);
          }
        } else if (channelName.includes('user.') && channelName.includes('.deliveries')) {
          const userId = this.extractUserIdFromChannel(channelName);
          if (userId) {
            this.subscribeToUserDeliveries(userId);
          }
        } else if (channelName.includes('delivery-tracking.')) {
          const shipmentId = this.extractShipmentIdFromChannel(channelName);
          if (shipmentId) {
            this.subscribeToShipmentTracking(shipmentId);
          }
        }
      });
    }, 1000); // Delay to ensure connection is stable
  }

  private extractDeliveryIdFromChannel(channelName: string): number | null {
    const match = channelName.match(/delivery\.(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  private extractUserIdFromChannel(channelName: string): number | null {
    const match = channelName.match(/user\.(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  private extractShipmentIdFromChannel(channelName: string): number | null {
    const match = channelName.match(/delivery-tracking\.(\d+)/);
    return match ? parseInt(match[1]) : null;
  }