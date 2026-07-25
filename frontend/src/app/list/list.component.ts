import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ListRegistryService } from '../services/list-registry.service';
import { WebsocketService } from '../services/websocket.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  imports: [RouterModule, CommonModule, FormsModule],
  templateUrl: './list.component.html',
})
export class ListComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
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
    fetch(`/api/lists/${token}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error('List not found.');
          if (res.status === 410) throw new Error('List has expired or been deleted.');
          throw new Error('Failed to load list.');
        }
        return res.json();
      })
      .then((data: ListData) => {
        this.listData.set(data);
        
        // Auto-register list
        const isCreator = !!localStorage.getItem(`creator_token_${token}`);
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
}
