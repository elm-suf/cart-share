import { Component, inject, signal, effect } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../services/supabase.service';
import { StoreService } from '../services/store.service';
import { AuthModalComponent } from '../auth/auth.component';
import { ListRegistryService, ListRegistryEntry } from '../services/list-registry.service';
import { HlmButtonImports } from '../ui/button/src';
import { HlmBadgeImports } from '../ui/badge/src';
import { HlmInputImports } from '../ui/input/src';
import { HlmSpinnerImports } from '../ui/spinner/src';
import { ThemeToggleComponent } from '../ui/theme-toggle.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AuthModalComponent,
    ThemeToggleComponent,
    ...HlmButtonImports,
    ...HlmBadgeImports,
    ...HlmInputImports,
    ...HlmSpinnerImports,
  ],
  templateUrl: './landing.component.html',
})
export class LandingComponent {
  private router = inject(Router);
  public supabaseService = inject(SupabaseService);
  public store = inject(StoreService);
  private listRegistryService = inject(ListRegistryService);

  localLists = signal<ListRegistryEntry[]>([]);

  showCreatePrompt = signal<boolean>(false);
  showAuthModal = signal<boolean>(false);
  newListNameInput = signal<string>('');
  loading = signal<boolean>(false);

  constructor() {
    // Single effect handles all auth state changes — no ngOnInit duplication
    effect(() => {
      const user = this.supabaseService.currentUser();
      if (user) {
        this.store.loadUserLists();
      } else {
        this.localLists.set(this.listRegistryService.getLists());
      }
    });
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
    this.store.clearUserLists();
    this.localLists.set(this.listRegistryService.getLists());
  }
}
