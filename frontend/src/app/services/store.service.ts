import { Injectable, signal, computed, effect, NgZone, inject } from '@angular/core';
import { SupabaseService, GroceryList, GroceryItem } from './supabase.service';
import { ListRegistryService } from './list-registry.service';

// --- Offline Operation Types ---

export interface OfflineOp {
  id: string;
  type: 'add' | 'update' | 'delete';
  timestamp: number;
  payload: Record<string, unknown>;
}

// --- Cache Keys ---

const CACHE_PREFIX = 'cs_cache:';
const PENDING_OPS_KEY = 'cs_pending_ops';

function cacheKey(scope: string): string {
  return `${CACHE_PREFIX}${scope}`;
}

// --- Cache Helpers ---

function readCache<T>(scope: string): T | null {
  try {
    const raw = localStorage.getItem(cacheKey(scope));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeCache<T>(scope: string, data: T): void {
  try {
    localStorage.setItem(cacheKey(scope), JSON.stringify(data));
  } catch {
    // localStorage full — silently ignore
  }
}

function readPendingOps(): OfflineOp[] {
  try {
    const raw = localStorage.getItem(PENDING_OPS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineOp[];
  } catch {
    return [];
  }
}

function writePendingOps(ops: OfflineOp[]): void {
  try {
    localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(ops));
  } catch {
    // localStorage full — silently ignore
  }
}

@Injectable({
  providedIn: 'root'
})
export class StoreService {
  private supabase = inject(SupabaseService);
  private listRegistry = inject(ListRegistryService);
  private ngZone = inject(NgZone);

  // --- Signals ---

  /** User's lists (dashboard) */
  readonly userLists = signal<GroceryList[]>([]);

  /** Currently active list (list detail view) */
  readonly currentList = signal<GroceryList | null>(null);

  /** Items for the current list */
  readonly currentItems = signal<GroceryItem[]>([]);

  /** Whether the browser is online */
  readonly isOnline = signal<boolean>(navigator.onLine);

  /** Queued offline mutations */
  readonly pendingOps = signal<OfflineOp[]>(readPendingOps());

  /** Whether a user-lists fetch is in flight */
  readonly userListsLoading = signal<boolean>(false);

  /** Whether a list detail fetch is in flight */
  readonly listLoading = signal<boolean>(false);

  /** Error for list detail view */
  readonly listError = signal<string | null>(null);

  // --- Computed ---

  readonly activeItems = computed(() =>
    this.currentItems()
      .filter(i => !i.checked)
      .sort((a, b) => a.position - b.position)
  );

  readonly checkedItems = computed(() =>
    this.currentItems()
      .filter(i => i.checked)
      .sort((a, b) => b.updated_at - a.updated_at)
  );

  readonly hasPendingOps = computed(() => this.pendingOps().length > 0);

  // --- Deduplication ---

  private userListsPromise: Promise<void> | null = null;
  /** Timestamp of the last successful userLists fetch */
  private userListsFetchedAt = 0;
  /** Minimum ms between refetches (30 seconds) */
  private static readonly USER_LISTS_STALE_MS = 30_000;

  private unsubscribeRealtime: (() => void) | null = null;
  private currentSubscribedListId: string | null = null;

  constructor() {
    // Hydrate from cache immediately
    const cachedLists = readCache<GroceryList[]>('userLists');
    if (cachedLists) {
      this.userLists.set(cachedLists);
    }

    // Listen to online/offline events
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('online', () => {
        this.ngZone.run(() => {
          this.isOnline.set(true);
          this.flushPendingOps();
        });
      });
      window.addEventListener('offline', () => {
        this.ngZone.run(() => {
          this.isOnline.set(false);
        });
      });
    });

    // Persist pending ops whenever they change
    effect(() => {
      writePendingOps(this.pendingOps());
    });
  }

  // ===========================
  //  USER LISTS (Dashboard)
  // ===========================

  /**
   * Load user lists from Supabase. Deduplicates concurrent calls
   * and skips refetch if data was loaded within the staleness window.
   * Uses stale-while-revalidate: returns cached data immediately,
   * then updates signal once the fetch completes.
   */
  loadUserLists(): Promise<void> {
    // Return existing in-flight promise to deduplicate
    if (this.userListsPromise) return this.userListsPromise;

    // Skip refetch if data is still fresh
    if (Date.now() - this.userListsFetchedAt < StoreService.USER_LISTS_STALE_MS) {
      return Promise.resolve();
    }

    this.userListsLoading.set(true);

    this.userListsPromise = this.supabase.getUserLists()
      .then(lists => {
        this.userLists.set(lists);
        writeCache('userLists', lists);
        this.userListsFetchedAt = Date.now();
      })
      .catch(err => {
        console.error('Failed to load user lists:', err);
        // Keep stale data — already hydrated from cache
      })
      .finally(() => {
        this.userListsLoading.set(false);
        this.userListsPromise = null;
      });

    return this.userListsPromise;
  }

  /** Clear user lists (on logout) */
  clearUserLists(): void {
    this.userLists.set([]);
    this.userListsFetchedAt = 0;
    try {
      localStorage.removeItem(cacheKey('userLists'));
    } catch { /* ignore */ }
  }

  // ===========================
  //  LIST DETAIL
  // ===========================

  /**
   * Load a single list by share token. Hydrates from cache first,
   * then fetches fresh data. Also loads items and sets up realtime.
   */
  async loadList(shareToken: string): Promise<void> {
    this.listLoading.set(true);
    this.listError.set(null);

    // 1. Try to hydrate from in-memory userLists (coming from dashboard)
    let list = this.userLists().find(l => l.share_token === shareToken);

    // 2. Fallback to cache if not in memory
    if (!list) {
      const cachedList = readCache<GroceryList>(`list:${shareToken}`);
      if (cachedList) {
        list = cachedList;
      }
    }

    // Set immediate cached/in-memory list if we found one
    if (list) {
      this.currentList.set(list);
      const cachedItems = readCache<GroceryItem[]>(`items:${list.id}`);
      if (cachedItems) {
        this.currentItems.set(cachedItems);
      }
    }

    try {
      // 3. Only fetch from network if we don't have the list yet
      if (!list) {
        const fetchedList = await this.supabase.getListByShareToken(shareToken);
        if (!fetchedList) {
          this.listLoading.set(false);
          this.listError.set('This list does not exist or has been deleted.');
          this.currentList.set(null);
          this.currentItems.set([]);
          return;
        }
        list = fetchedList;
        this.currentList.set(list);
        writeCache(`list:${shareToken}`, list);
      }

      // Register in local list registry
      this.listRegistry.addList({
        shareToken: list.share_token,
        name: list.name,
        isCreator: !!localStorage.getItem(`creator_token_${list.share_token}`),
        joinedAt: Date.now(),
        lastAccessedAt: Date.now()
      });

      // Load items & connect realtime
      await this.loadItems(list.id);
      this.setupRealtime(list.id);

    } catch (err) {
      console.error('Failed to fetch list details:', err);
      if (!list) {
        this.listError.set('Failed to connect to cloud database.');
      }
      // If we have cached data, show that (stale) — no error
    } finally {
      this.listLoading.set(false);
    }
  }

  /** Load items for a list and cache them */
  async loadItems(listId: string): Promise<void> {
    try {
      const items = await this.supabase.getItems(listId);
      this.currentItems.set(items);
      writeCache(`items:${listId}`, items);
    } catch (err) {
      console.error('Failed to load items:', err);
      // Keep stale data from cache
    }
  }

  /** Set up realtime subscription, tearing down any previous one */
  private setupRealtime(listId: string): void {
    // Don't re-subscribe if already subscribed to the same list
    if (this.currentSubscribedListId === listId && this.unsubscribeRealtime) {
      return;
    }

    this.teardownRealtime();
    this.currentSubscribedListId = listId;
    this.unsubscribeRealtime = this.supabase.subscribeToItems(listId, () => {
      this.loadItems(listId);
    });
  }

  /** Tear down realtime subscription */
  teardownRealtime(): void {
    if (this.unsubscribeRealtime) {
      this.unsubscribeRealtime();
      this.unsubscribeRealtime = null;
      this.currentSubscribedListId = null;
    }
  }

  /** Clear current list state (when navigating away) */
  clearCurrentList(): void {
    this.teardownRealtime();
    this.currentList.set(null);
    this.currentItems.set([]);
    this.listError.set(null);
  }

  // ===========================
  //  ITEM MUTATIONS
  // ===========================

  /**
   * Add an item. Optimistic update + Supabase write.
   * Falls back to offline queue if not connected.
   */
  async addItem(item: Partial<GroceryItem> & { list_id: string; name: string; position: number }): Promise<void> {
    const tempId = item.id || crypto.randomUUID();
    const now = Date.now();
    const optimisticItem: GroceryItem = {
      id: tempId,
      list_id: item.list_id,
      name: item.name,
      quantity: item.quantity || null,
      checked: item.checked || false,
      position: item.position,
      updated_at: now,
      editor: item.editor || null
    };

    // Optimistic update
    this.currentItems.update(arr => [...arr, optimisticItem]);

    if (!this.isOnline()) {
      this.enqueuePendingOp({
        id: crypto.randomUUID(),
        type: 'add',
        timestamp: now,
        payload: { ...item, id: tempId }
      });
      return;
    }

    try {
      const created = await this.supabase.addItem({ ...item, id: tempId });
      // Replace optimistic with server version
      this.currentItems.update(arr =>
        arr.map(i => i.id === tempId ? created : i)
      );
      this.persistItemsCache();
    } catch (err) {
      console.error('Failed to add item:', err);
      // Revert optimistic update
      this.currentItems.update(arr => arr.filter(i => i.id !== tempId));
    }
  }

  /**
   * Update an item. Optimistic update + Supabase write.
   * Falls back to offline queue if not connected.
   */
  async updateItem(itemUpdate: Partial<GroceryItem> & { id: string; list_id: string }): Promise<void> {
    const now = Date.now();

    // Capture previous state for rollback
    const prevItems = this.currentItems();

    // Optimistic update
    this.currentItems.update(arr =>
      arr.map(i => i.id === itemUpdate.id ? { ...i, ...itemUpdate, updated_at: now } : i)
    );

    if (!this.isOnline()) {
      this.enqueuePendingOp({
        id: crypto.randomUUID(),
        type: 'update',
        timestamp: now,
        payload: { ...itemUpdate }
      });
      return;
    }

    try {
      await this.supabase.updateItem(itemUpdate);
      this.persistItemsCache();
    } catch (err) {
      console.error('Failed to update item:', err);
      // Revert
      this.currentItems.set(prevItems);
    }
  }

  /**
   * Delete an item. Optimistic update + Supabase write.
   * Falls back to offline queue if not connected.
   */
  async deleteItem(itemId: string, listId: string): Promise<void> {
    const now = Date.now();

    // Capture previous state for rollback
    const prevItems = this.currentItems();

    // Optimistic update
    this.currentItems.update(arr => arr.filter(i => i.id !== itemId));

    if (!this.isOnline()) {
      this.enqueuePendingOp({
        id: crypto.randomUUID(),
        type: 'delete',
        timestamp: now,
        payload: { itemId, listId }
      });
      return;
    }

    try {
      await this.supabase.deleteItem(itemId, listId);
      this.persistItemsCache();
    } catch (err) {
      console.error('Failed to delete item:', err);
      // Revert
      this.currentItems.set(prevItems);
    }
  }

  // ===========================
  //  OFFLINE QUEUE
  // ===========================

  private enqueuePendingOp(op: OfflineOp): void {
    this.pendingOps.update(ops => [...ops, op]);
    this.persistItemsCache();
  }

  /** Flush all pending operations — called when coming back online */
  async flushPendingOps(): Promise<void> {
    const ops = this.pendingOps();
    if (ops.length === 0) return;

    const remaining: OfflineOp[] = [];

    for (const op of ops) {
      try {
        switch (op.type) {
          case 'add': {
            const p = op.payload as Partial<GroceryItem> & { list_id: string; name: string; position: number };
            await this.supabase.addItem(p);
            break;
          }
          case 'update': {
            const p = op.payload as Partial<GroceryItem> & { id: string; list_id: string };
            await this.supabase.updateItem(p);
            break;
          }
          case 'delete': {
            const p = op.payload as { itemId: string; listId: string };
            await this.supabase.deleteItem(p.itemId, p.listId);
            break;
          }
        }
      } catch (err) {
        console.error('Failed to flush op:', op, err);
        remaining.push(op);
      }
    }

    this.pendingOps.set(remaining);

    // Re-fetch fresh data to reconcile after flush
    const list = this.currentList();
    if (list) {
      await this.loadItems(list.id);
    }
  }

  // ===========================
  //  HELPERS
  // ===========================

  /** Persist current items to localStorage cache */
  private persistItemsCache(): void {
    const list = this.currentList();
    if (list) {
      writeCache(`items:${list.id}`, this.currentItems());
    }
  }
}
