import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDropList, CdkDrag, moveItemInArray } from '@angular/cdk/drag-drop';
import { SupabaseService, GroceryItem } from '../services/supabase.service';
import { StoreService } from '../services/store.service';
import { ListRegistryService } from '../services/list-registry.service';
import { AuthModalComponent } from '../auth/auth.component';
import { HlmButtonImports } from '../ui/button/src';
import { HlmInputImports } from '../ui/input/src';
import { HlmSpinnerImports } from '../ui/spinner/src';
import { ThemeToggleComponent } from '../ui/theme-toggle.component';

@Component({
  selector: 'app-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CdkDropList, CdkDrag, AuthModalComponent, ThemeToggleComponent, ...HlmButtonImports, ...HlmInputImports, ...HlmSpinnerImports],
  templateUrl: './list.component.html',
})
export class ListComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabaseService = inject(SupabaseService);
  public store = inject(StoreService);
  private listRegistryService = inject(ListRegistryService);

  // Delegate to store
  loading = this.store.listLoading;
  errorMessage = this.store.listError;
  listData = this.store.currentList;
  items = this.store.currentItems;
  activeItems = this.store.activeItems;
  checkedItems = this.store.checkedItems;

  // Local user state
  userNickname = signal<string>('');
  showNicknamePrompt = signal<boolean>(false);
  nicknameInput = signal<string>('');

  // Editing state
  isEditingName = signal<boolean>(false);
  editNameInput = signal<string>('');

  // Rotation state
  isRotating = signal<boolean>(false);
  linkCopied = signal<boolean>(false);

  // New item inputs
  newItemName = signal<string>('');
  newItemQuantity = signal<string>('');

  showAuthModal = signal<boolean>(false);

  isCreator = computed(() => {
    const list = this.listData();
    if (!list) return false;
    const creatorToken = localStorage.getItem(`creator_token_${list.share_token}`);
    return !!creatorToken;
  });

  constructor() {
    effect(() => {
      const user = this.supabaseService.currentUser();
      if (user && user.user_metadata?.['username']) {
        this.userNickname.set(user.user_metadata['username']);
        this.showNicknamePrompt.set(false);
        this.showAuthModal.set(false);
      } else {
        const savedNick = localStorage.getItem('cart_share_nickname');
        if (savedNick) {
          this.userNickname.set(savedNick);
        } else {
          this.showNicknamePrompt.set(true);
        }
      }
    }, { allowSignalWrites: true });

    // Save list to account once when both user and list are available
    const savedListIds = new Set<string>();
    effect(() => {
      const user = this.supabaseService.currentUser();
      const list = this.listData();
      if (user && list && !savedListIds.has(list.id)) {
        savedListIds.add(list.id);
        this.supabaseService.saveListToAccount(list.id);
      }
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const shareToken = params.get('shareToken');
      if (shareToken) {
        this.store.loadList(shareToken);
      } else {
        this.store.listError.set('No share token provided.');
      }
    });
  }

  ngOnDestroy(): void {
    this.store.clearCurrentList();
  }

  saveNickname(): void {
    const name = this.nicknameInput().trim();
    if (name) {
      this.userNickname.set(name);
      localStorage.setItem('cart_share_nickname', name);
    }
    this.showNicknamePrompt.set(false);
  }

  skipNickname(): void {
    this.showNicknamePrompt.set(false);
  }

  startEditingName(): void {
    if (!this.isCreator()) return;
    this.isEditingName.set(true);
    this.editNameInput.set(this.listData()?.name || '');
  }

  async saveListName(): Promise<void> {
    const list = this.listData();
    const newName = this.editNameInput().trim();
    
    if (!list || !newName || newName === list.name) {
      this.isEditingName.set(false);
      return;
    }

    const creatorToken = localStorage.getItem(`creator_token_${list.share_token}`);
    if (!creatorToken) return;

    try {
      await this.supabaseService.updateListName(list.share_token, newName, creatorToken);
      this.store.currentList.update(l => l ? { ...l, name: newName } : null);
      this.listRegistryService.updateListName(list.share_token, newName);
    } catch (err) {
      console.error('Failed to update list name:', err);
      alert('Failed to update list name. Ensure you are the list creator.');
    } finally {
      this.isEditingName.set(false);
    }
  }

  async rotateLink(): Promise<void> {
    const list = this.listData();
    if (!list) return;

    const creatorToken = localStorage.getItem(`creator_token_${list.share_token}`);
    if (!creatorToken) return;

    if (!confirm('Are you sure you want to rotate the link? The old share link will stop working immediately.')) {
      return;
    }

    this.isRotating.set(true);
    try {
      const newShareToken = await this.supabaseService.rotateShareToken(list.share_token, creatorToken);
      this.router.navigate(['/list', newShareToken]);
    } catch (err) {
      console.error('Failed to rotate link:', err);
      alert('Failed to rotate link.');
    } finally {
      this.isRotating.set(false);
    }
  }

  copyLink(): void {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    });
  }

  async addNewItem(): Promise<void> {
    const name = this.newItemName().trim();
    const qty = this.newItemQuantity().trim();
    const list = this.listData();

    if (!name || !list) return;

    const maxPos = this.items().reduce((max, i) => Math.max(max, i.position), 0);
    const newPos = maxPos + 1000;

    const newItem: Partial<GroceryItem> & { list_id: string; name: string; position: number } = {
      list_id: list.id,
      name,
      quantity: qty || null,
      checked: false,
      position: newPos,
      editor: this.userNickname() || 'Someone'
    };

    this.newItemName.set('');
    this.newItemQuantity.set('');

    await this.store.addItem(newItem);
  }

  async toggleItem(item: GroceryItem): Promise<void> {
    const list = this.listData();
    if (!list) return;

    await this.store.updateItem({
      id: item.id,
      list_id: list.id,
      checked: !item.checked,
      editor: this.userNickname() || 'Someone'
    });
  }

  async deleteItem(itemId: string): Promise<void> {
    const list = this.listData();
    if (!list) return;

    await this.store.deleteItem(itemId, list.id);
  }

  async drop(event: any): Promise<void> {
    const active = [...this.activeItems()];
    moveItemInArray(active, event.previousIndex, event.currentIndex);

    let newPosition: number;
    if (active.length === 1) {
      newPosition = 1000;
    } else if (event.currentIndex === 0) {
      newPosition = active[1].position / 2;
    } else if (event.currentIndex === active.length - 1) {
      newPosition = active[active.length - 2].position + 1000;
    } else {
      const prevPos = active[event.currentIndex - 1].position;
      const nextPos = active[event.currentIndex + 1].position;
      newPosition = (prevPos + nextPos) / 2;
    }

    const movedItem = active[event.currentIndex];
    const list = this.listData();
    if (!list) return;

    await this.store.updateItem({
      id: movedItem.id,
      list_id: list.id,
      position: newPosition,
      editor: this.userNickname() || 'Someone'
    });
  }
}
