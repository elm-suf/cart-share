import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

export interface GroceryList {
  id: string;
  share_token: string;
  creator_token_hash: string;
  user_id?: string | null;
  name: string;
  created_at: number;
  updated_at: number;
  last_active_at: number;
}

export interface GroceryItem {
  id: string;
  list_id: string;
  name: string;
  quantity?: string | null;
  checked: boolean;
  position: number;
  updated_at: number;
  editor?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private client: SupabaseClient;
  public currentUser = signal<User | null>(null);

  constructor() {
    this.client = createClient(environment.supabaseUrl, environment.supabaseKey);

    // Initialize session and auth state listener
    this.client.auth.getSession().then(({ data }) => {
      this.currentUser.set(data.session?.user ?? null);
    });

    this.client.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      const current = this.currentUser();
      // Only update signal if user actually changed — prevents re-triggering
      // effects on tab focus (Supabase re-validates session on visibility change)
      if (newUser?.id !== current?.id) {
        this.currentUser.set(newUser);
      }
    });
  }

  // --- AUTHENTICATION ---

  async signUp(usernameInput: string, password: string) {
    const raw = usernameInput.trim();
    const cleanUsername = raw.includes('@') ? raw.split('@')[0] : raw;
    const sanitized = cleanUsername.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    
    if (!sanitized) {
      throw new Error('Username must contain at least one valid letter or number.');
    }

    const email = `${sanitized}@example.com`;

    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: { username: raw }
      }
    });
    if (error) throw error;

    // If sign up succeeded but session is null (due to Supabase email confirmation setting), auto-signin
    if (!data.session) {
      try {
        return await this.signIn(raw, password);
      } catch {
        // Return signup data if auto-signin fails
        return data;
      }
    }
    return data;
  }

  async signIn(usernameInput: string, password: string) {
    const raw = usernameInput.trim();
    const cleanUsername = raw.includes('@') ? raw.split('@')[0] : raw;
    const sanitized = cleanUsername.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const email = `${sanitized}@example.com`;

    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
    this.currentUser.set(null);
  }

  // --- LIST MANAGEMENT ---

  private async hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private generateRandomHex(length = 32): string {
    const array = new Uint8Array(length / 2);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async createList(name?: string): Promise<{ shareToken: string; creatorToken: string; list: GroceryList }> {
    const shareToken = this.generateRandomHex(32);
    const creatorToken = this.generateRandomHex(32);
    const creatorTokenHash = await this.hashToken(creatorToken);
    const now = Date.now();
    const listName = name?.trim() || `Grocery List — ${new Date().toLocaleDateString()}`;
    const user = this.currentUser();

    const { data, error } = await this.client
      .from('lists')
      .insert({
        share_token: shareToken,
        creator_token_hash: creatorTokenHash,
        user_id: user?.id || null,
        name: listName,
        created_at: now,
        updated_at: now,
        last_active_at: now
      })
      .select()
      .single();

    if (error) throw error;

    localStorage.setItem(`creator_token_${shareToken}`, creatorToken);

    // Also save to user_saved_lists so getUserLists picks it up immediately
    if (user) {
      this.saveListToAccount(data.id);
    }

    return { shareToken, creatorToken, list: data as GroceryList };
  }

  async getListByShareToken(shareToken: string): Promise<GroceryList | null> {
    const { data, error } = await this.client
      .from('lists')
      .select('*')
      .eq('share_token', shareToken)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    // Update last_active_at asynchronously
    this.client
      .from('lists')
      .update({ last_active_at: Date.now() })
      .eq('id', data.id)
      .then();

    return data as GroceryList;
  }

  async getUserLists(): Promise<GroceryList[]> {
    const user = this.currentUser();
    if (!user) return [];

    const { data, error } = await this.client
      .from('user_saved_lists')
      .select('lists(*)')
      .eq('user_id', user.id);

    if (error) throw error;

    return (data || [])
      .map((row: any) => {
        const list = Array.isArray(row.lists) ? row.lists[0] : row.lists;
        return list as GroceryList;
      })
      .filter((list): list is GroceryList => !!list?.id)
      .sort((a, b) => b.updated_at - a.updated_at);
  }

  async saveListToAccount(listId: string): Promise<void> {
    const user = this.currentUser();
    if (!user) return;

    const { error } = await this.client
      .from('user_saved_lists')
      .upsert(
        { user_id: user.id, list_id: listId, joined_at: Date.now() },
        { onConflict: 'user_id,list_id' }
      );

    if (error) {
      console.error('Failed to save list to account:', error);
    }
  }

  async updateListName(shareToken: string, newName: string, creatorToken: string): Promise<void> {
    const list = await this.getListByShareToken(shareToken);
    if (!list) throw new Error('List not found');

    const inputHash = await this.hashToken(creatorToken);
    if (inputHash !== list.creator_token_hash) {
      throw new Error('Forbidden: Only the creator can edit list name');
    }

    const { error } = await this.client
      .from('lists')
      .update({ name: newName.trim(), updated_at: Date.now() })
      .eq('id', list.id);

    if (error) throw error;
  }

  async rotateShareToken(shareToken: string, creatorToken: string): Promise<string> {
    const list = await this.getListByShareToken(shareToken);
    if (!list) throw new Error('List not found');

    const inputHash = await this.hashToken(creatorToken);
    if (inputHash !== list.creator_token_hash) {
      throw new Error('Forbidden: Only the creator can rotate share link');
    }

    const newShareToken = this.generateRandomHex(32);
    const { error } = await this.client
      .from('lists')
      .update({ share_token: newShareToken, updated_at: Date.now() })
      .eq('id', list.id);

    if (error) throw error;

    localStorage.removeItem(`creator_token_${shareToken}`);
    localStorage.setItem(`creator_token_${newShareToken}`, creatorToken);

    return newShareToken;
  }

  // --- ITEM OPERATIONS ---

  async getItems(listId: string): Promise<GroceryItem[]> {
    const { data, error } = await this.client
      .from('items')
      .select('*')
      .eq('list_id', listId)
      .order('position', { ascending: true });

    if (error) throw error;
    return (data || []) as GroceryItem[];
  }

  async addItem(item: Partial<GroceryItem> & { list_id: string; name: string; position: number }): Promise<GroceryItem> {
    const id = item.id || crypto.randomUUID();
    const now = Date.now();

    const { data, error } = await this.client
      .from('items')
      .insert({
        id,
        list_id: item.list_id,
        name: item.name,
        quantity: item.quantity || null,
        checked: item.checked || false,
        position: item.position,
        updated_at: now,
        editor: item.editor || null
      })
      .select()
      .single();

    if (error) throw error;

    this.client
      .from('lists')
      .update({ updated_at: now, last_active_at: now })
      .eq('id', item.list_id)
      .then();

    return data as GroceryItem;
  }

  async updateItem(item: Partial<GroceryItem> & { id: string; list_id: string }): Promise<void> {
    const now = Date.now();
    const { error } = await this.client
      .from('items')
      .update({
        ...item,
        updated_at: now
      })
      .eq('id', item.id);

    if (error) throw error;

    this.client
      .from('lists')
      .update({ updated_at: now, last_active_at: now })
      .eq('id', item.list_id)
      .then();
  }

  async deleteItem(itemId: string, listId: string): Promise<void> {
    const { error } = await this.client
      .from('items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;

    this.client
      .from('lists')
      .update({ updated_at: Date.now(), last_active_at: Date.now() })
      .eq('id', listId)
      .then();
  }

  // --- REALTIME SUBSCRIPTIONS ---

  subscribeToItems(listId: string, onUpdate: () => void) {
    const channel = this.client
      .channel(`items_list_${listId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `list_id=eq.${listId}`
        },
        () => {
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      this.client.removeChannel(channel);
    };
  }
}
