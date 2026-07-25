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
  public isOffline = signal<boolean>(!navigator.onLine);
  public items = signal<Item[]>([]);
  public error = signal<string | null>(null);

  constructor() {
    window.addEventListener('online', () => this.isOffline.set(false));
    window.addEventListener('offline', () => this.isOffline.set(true));
  }

  private getSyncQueue(): WsMessageClient[] {
    if (!this.currentShareToken) return [];
    const q = localStorage.getItem(`sync_queue_${this.currentShareToken}`);
    return q ? JSON.parse(q) : [];
  }

  private setSyncQueue(queue: WsMessageClient[]) {
    if (!this.currentShareToken) return;
    localStorage.setItem(`sync_queue_${this.currentShareToken}`, JSON.stringify(queue));
  }

  private saveToCache() {
    if (!this.currentShareToken) return;
    localStorage.setItem(`grocery_items_${this.currentShareToken}`, JSON.stringify(this.items()));
  }

  private loadFromCache() {
    if (!this.currentShareToken) return;
    const cached = localStorage.getItem(`grocery_items_${this.currentShareToken}`);
    if (cached) {
      this.items.set(JSON.parse(cached));
    }
  }

  connect(shareToken: string) {
    if (this.ws && this.currentShareToken === shareToken && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }
    
    this.disconnect();
    this.currentShareToken = shareToken;
    this.intentionalDisconnect = false;
    this.reconnectAttempts = 0;
    this.error.set(null);
    
    this.loadFromCache();
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
          
          // Replay queue
          const q = this.getSyncQueue();
          if (q.length > 0) {
            q.forEach(msg => {
              if (msg.type === 'item_add' || msg.type === 'item_update') {
                this.items.update(curr => {
                  if (curr.some(i => i.id === msg.item.id)) {
                    return curr.map(i => i.id === msg.item.id && msg.item.updated_at >= i.updated_at ? msg.item : i).sort((a, b) => a.position - b.position);
                  }
                  return [...curr, msg.item].sort((a, b) => a.position - b.position);
                });
              } else if (msg.type === 'item_delete') {
                this.items.update(curr => curr.filter(i => i.id !== msg.itemId));
              }
              
              if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(msg));
              }
            });
            this.setSyncQueue([]);
          }
          
          this.saveToCache();
        } else if (message.type === 'item_broadcast') {
          this.handleBroadcast(message);
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

  private handleBroadcast(message: any) {
    const { action, item, itemId } = message;
    this.items.update(current => {
      if (action === 'add' && item) {
        // Prevent duplicate if we already applied optimistically
        if (current.some(i => i.id === item.id)) {
          return current.map(i => i.id === item.id && item.updated_at >= i.updated_at ? item : i).sort((a, b) => a.position - b.position);
        }
        return [...current, item].sort((a, b) => a.position - b.position);
      } else if (action === 'update' && item) {
        return current.map(i => {
          if (i.id === item.id) {
            return item.updated_at >= i.updated_at ? item : i;
          }
          return i;
        }).sort((a, b) => a.position - b.position);
      } else if (action === 'delete' && itemId) {
        return current.filter(i => i.id !== itemId);
      }
      return current;
    });
    this.saveToCache();
  }

  addItem(item: Item) {
    this.items.update(current => [...current, item].sort((a, b) => a.position - b.position));
    this.saveToCache();
    
    const msg: WsMessageClient = { type: 'item_add', item };
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      const q = this.getSyncQueue();
      q.push(msg);
      this.setSyncQueue(q);
    }
  }

  updateItem(item: Item) {
    this.items.update(current => current.map(i => i.id === item.id ? item : i).sort((a, b) => a.position - b.position));
    this.saveToCache();
    
    const msg: WsMessageClient = { type: 'item_update', item };
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      const q = this.getSyncQueue();
      q.push(msg);
      this.setSyncQueue(q);
    }
  }

  deleteItem(itemId: string) {
    this.items.update(current => current.filter(i => i.id !== itemId));
    this.saveToCache();
    
    const msg: WsMessageClient = { type: 'item_delete', itemId };
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      const q = this.getSyncQueue();
      q.push(msg);
      this.setSyncQueue(q);
    }
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

