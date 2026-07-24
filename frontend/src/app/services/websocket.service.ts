import { Injectable, signal, OnDestroy } from '@angular/core';
import { Item, WsMessageServer, WsMessageClient } from '../shared/websocket';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService implements OnDestroy {
  private ws: WebSocket | null = null;
  private currentShareToken: string | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectTimeoutId: any = null;
  private intentionalDisconnect = false;

  // State
  public isConnected = signal<boolean>(false);
  public items = signal<Item[]>([]);
  public error = signal<string | null>(null);

  connect(shareToken: string) {
    if (this.ws && this.currentShareToken === shareToken && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }
    
    this.disconnect();
    this.currentShareToken = shareToken;
    this.intentionalDisconnect = false;
    this.reconnectAttempts = 0;
    this.error.set(null);
    
    this.establishConnection();
  }

  private establishConnection() {
    if (!this.currentShareToken) return;

    // Determine WS URL (use wss:// if https)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // For dev, proxy routes /ws to the backend. In prod, it should be the same.
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.isConnected.set(true);
      this.reconnectAttempts = 0;
      this.error.set(null);

      // Join the room
      const joinMsg: WsMessageClient = { type: 'join', shareToken: this.currentShareToken! };
      this.ws?.send(JSON.stringify(joinMsg));
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WsMessageServer = JSON.parse(event.data);
        if (message.type === 'sync') {
          this.items.set(message.items);
        } else if (message.type === 'error') {
          this.error.set(message.message);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message', e);
      }
    };

    this.ws.onclose = () => {
      this.isConnected.set(false);
      
      if (!this.intentionalDisconnect) {
        this.attemptReconnect();
      }
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      // onclose will handle reconnection
    };
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.error.set('Failed to connect to the server after multiple attempts.');
      return;
    }

    const backoffMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Max 30s
    this.reconnectAttempts++;
    
    console.log(`Attempting to reconnect in ${backoffMs}ms... (Attempt ${this.reconnectAttempts} of ${this.maxReconnectAttempts})`);
    
    clearTimeout(this.reconnectTimeoutId);
    this.reconnectTimeoutId = setTimeout(() => {
      this.establishConnection();
    }, backoffMs);
  }

  disconnect() {
    this.intentionalDisconnect = true;
    clearTimeout(this.reconnectTimeoutId);
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected.set(false);
    this.currentShareToken = null;
    this.items.set([]);
  }

  ngOnDestroy() {
    this.disconnect();
  }
}
