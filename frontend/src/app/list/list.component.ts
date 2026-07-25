import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { environment } from '../../environments/environment';
import { ListRegistryService } from '../services/list-registry.service';
import { WebsocketService } from '../services/websocket.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { Item } from '../shared/websocket';

interface ListData {
  shareToken: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

@Component({
  selector: 'app-list',
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule, DragDropModule],
  templateUrl: './list.component.html',
})
export class ListComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private listRegistryService = inject(ListRegistryService);
  public wsService = inject(WebsocketService);

  shareToken = signal<string | null>(null);
  listData = signal<ListData | null>(null);
  loading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);
  shareUrl = signal<string>('');
  linkCopied = signal<boolean>(false);
  
  showNicknamePrompt = signal<boolean>(false);
  nicknameInput = signal<string>('');

  isCreator = signal<boolean>(false);
  isEditingName = signal<boolean>(false);
  editNameInput = signal<string>('');
  isRotating = signal<boolean>(false);

  newItemName = signal<string>('');
  newItemQuantity = signal<string>('');

  activeItems = computed(() => this.wsService.items().filter(i => !i.checked));
  checkedItems = computed(() => this.wsService.items().filter(i => i.checked));

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('shareToken');
    this.shareToken.set(token);

    if (token) {
      this.shareUrl.set(`${window.location.origin}/list/${token}`);
      this.fetchListDetails(token);
      this.wsService.connect(token);
    } else {
      this.errorMessage.set('Invalid list link.');
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.wsService.disconnect();
  }

  fetchListDetails(token: string): void {
    fetch(`${environment.apiUrl}/lists/${token}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404 || res.status === 410) {
            this.listRegistryService.removeList(token);
            throw new Error(res.status === 404 ? 'List not found.' : 'List has expired or been deleted.');
          }
          throw new Error('Failed to load list.');
        }
        return res.json();
      })
      .then((data: ListData) => {
        this.listData.set(data);
        
        // Auto-register list
        const creatorToken = localStorage.getItem(`creator_token_${token}`);
        const isCreator = !!creatorToken;
        this.isCreator.set(isCreator);
        
        this.listRegistryService.addList({
          shareToken: token,
          name: data.name,
          isCreator,
          joinedAt: Date.now(),
          lastAccessedAt: Date.now()
        });

        // Check for nickname
        if (!this.listRegistryService.getNickname()) {
          this.showNicknamePrompt.set(true);
        }

        this.loading.set(false);
      })
      .catch((err: Error) => {
        console.error('Error loading list details:', err);
        this.errorMessage.set(err.message || 'An unexpected error occurred.');
        this.loading.set(false);
      });
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.shareUrl()).then(() => {
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    }).catch((err) => {
      console.error('Failed to copy link:', err);
    });
  }
  
  saveNickname(): void {
    const name = this.nicknameInput().trim() || 'Someone';
    this.listRegistryService.setNickname(name);
    this.showNicknamePrompt.set(false);
  }
  
  skipNickname(): void {
    this.listRegistryService.setNickname('Someone');
    this.showNicknamePrompt.set(false);
  }

  startEditingName(): void {
    this.editNameInput.set(this.listData()?.name || '');
    this.isEditingName.set(true);
  }

  saveListName(): void {
    const name = this.editNameInput().trim();
    if (!name || name === this.listData()?.name) {
      this.isEditingName.set(false);
      return;
    }

    const token = this.shareToken();
    const creatorToken = localStorage.getItem(`creator_token_${token}`);
    
    if (!token || !creatorToken) return;

    fetch(`${environment.apiUrl}/lists/${token}/name`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, creatorToken }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to update name');
        return res.json();
      })
      .then((data) => {
        const currentData = this.listData();
        if (currentData) {
          this.listData.set({ ...currentData, name: data.name });
        }
        
        // Update registry
        this.listRegistryService.updateListName(token, data.name);
      })
      .catch((err) => {
        console.error('Error updating list name:', err);
        alert('Failed to update list name.');
      })
      .finally(() => {
        this.isEditingName.set(false);
      });
  }

  rotateLink(): void {
    if (!confirm('Are you sure you want to rotate the share link? The current link will stop working for everyone.')) {
      return;
    }
    
    const token = this.shareToken();
    const creatorToken = localStorage.getItem(`creator_token_${token}`);
    
    if (!token || !creatorToken) return;

    this.isRotating.set(true);
    fetch(`${environment.apiUrl}/lists/${token}/rotate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ creatorToken }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to rotate link');
        return res.json();
      })
      .then((data) => {
        if (data.newShareToken) {
          const newToken = data.newShareToken;
          
          // Update localStorage
          localStorage.setItem(`creator_token_${newToken}`, creatorToken);
          localStorage.removeItem(`creator_token_${token}`);
          
          // Update list registry
          this.listRegistryService.updateListToken(token, newToken);
          
          // Navigate to new list
          this.router.navigate(['/list', newToken]);
        }
      })
      .catch((err) => {
        console.error('Error rotating link:', err);
        alert('Failed to rotate list link.');
      })
      .finally(() => {
        this.isRotating.set(false);
      });
  }

  addNewItem(): void {
    const name = this.newItemName().trim();
    if (!name || !this.listData()) return;

    const quantity = this.newItemQuantity().trim();
    
    // Find highest position
    const items = this.wsService.items();
    const position = items.length > 0 ? Math.max(...items.map(i => i.position)) + 65536 : 65536;

    const newItem: Item = {
      id: crypto.randomUUID(),
      list_id: 0, // Not used by client
      name,
      quantity,
      checked: false,
      position,
      updated_at: Date.now(),
      editor: this.listRegistryService.getNickname() || 'Someone'
    };

    this.wsService.addItem(newItem);
    
    this.newItemName.set('');
    this.newItemQuantity.set('');
  }

  toggleItem(item: Item): void {
    const updatedItem: Item = {
      ...item,
      checked: !item.checked,
      updated_at: Date.now(),
      editor: this.listRegistryService.getNickname() || 'Someone'
    };
    this.wsService.updateItem(updatedItem);
  }

  deleteItem(id: string): void {
    this.wsService.deleteItem(id);
  }

  drop(event: CdkDragDrop<Item[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    const currentActive = this.activeItems();
    const item = currentActive[event.previousIndex];
    
    const items = [...currentActive];
    items.splice(event.previousIndex, 1);
    items.splice(event.currentIndex, 0, item);

    let newPosition = 0;
    if (event.currentIndex === 0) {
      newPosition = items[1].position - 1.0;
    } else if (event.currentIndex === items.length - 1) {
      newPosition = items[items.length - 2].position + 1.0;
    } else {
      const prev = items[event.currentIndex - 1];
      const next = items[event.currentIndex + 1];
      newPosition = (prev.position + next.position) / 2.0;
    }

    const updatedItem: Item = {
      ...item,
      position: newPosition,
      updated_at: Date.now(),
      editor: this.listRegistryService.getNickname() || 'Someone'
    };

    this.wsService.updateItem(updatedItem);
  }
}
