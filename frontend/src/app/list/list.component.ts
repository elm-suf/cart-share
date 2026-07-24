import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ListRegistryService } from '../services/list-registry.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
export class ListComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private listRegistryService = inject(ListRegistryService);

  shareToken = signal<string | null>(null);
  listData = signal<ListData | null>(null);
  loading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);
  shareUrl = signal<string>('');
  
  showNicknamePrompt = signal<boolean>(false);
  nicknameInput = signal<string>('');

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('shareToken');
    this.shareToken.set(token);

    if (token) {
      this.shareUrl.set(`${window.location.origin}/list/${token}`);
      this.fetchListDetails(token);
    } else {
      this.errorMessage.set('Invalid list link.');
      this.loading.set(false);
    }
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
      alert('Share link copied to clipboard!');
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
}
