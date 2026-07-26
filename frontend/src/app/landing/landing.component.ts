import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService, GroceryList } from '../services/supabase.service';
import { AuthModalComponent } from '../auth/auth.component';
import { ListRegistryService, ListRegistryEntry } from '../services/list-registry.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, FormsModule, AuthModalComponent],
  templateUrl: './landing.component.html',
})
export class LandingComponent implements OnInit {
  private router = inject(Router);
  public supabaseService = inject(SupabaseService);
  private listRegistryService = inject(ListRegistryService);

  lists = signal<GroceryList[]>([]);
  localLists = signal<ListRegistryEntry[]>([]);
  
  showCreatePrompt = signal<boolean>(false);
  showAuthModal = signal<boolean>(false);
  newListNameInput = signal<string>('');
  loading = signal<boolean>(false);

  constructor() {
    // Re-fetch lists whenever auth state changes
    effect(() => {
      const user = this.supabaseService.currentUser();
      if (user) {
        this.loadUserLists();
      } else {
        this.localLists.set(this.listRegistryService.getLists());
      }
    });
  }

  ngOnInit(): void {
    if (this.supabaseService.currentUser()) {
      this.loadUserLists();
    } else {
      this.localLists.set(this.listRegistryService.getLists());
    }
  }

  async loadUserLists(): Promise<void> {
    try {
      const listsData = await this.supabaseService.getUserLists();
      this.lists.set(listsData);
    } catch (err) {
      console.error('Failed to load user lists:', err);
    }
  }

  onCreateList(): void {
    this.showCreatePrompt.set(true);
  }

  cancelCreateList(): void {
    this.showCreatePrompt.set(false);
    this.newListNameInput.set('');
  }

  async submitCreateList(): Promise<void> {
    const name = this.newListNameInput().trim();
    this.loading.set(true);

    try {
      const { shareToken } = await this.supabaseService.createList(name);
      this.router.navigate(['/list', shareToken]);
    } catch (err) {
      console.error('Error creating list in Supabase:', err);
      alert('Failed to create grocery list. Please try again.');
    } finally {
      this.loading.set(false);
      this.showCreatePrompt.set(false);
      this.newListNameInput.set('');
    }
  }

  async onLogout(): Promise<void> {
    await this.supabaseService.signOut();
    this.lists.set([]);
    this.localLists.set(this.listRegistryService.getLists());
  }
}
