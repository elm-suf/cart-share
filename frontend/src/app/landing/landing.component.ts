import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ListRegistryService, ListRegistryEntry } from '../services/list-registry.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './landing.component.html',
})
export class LandingComponent implements OnInit {
  private router = inject(Router);
  private listRegistryService = inject(ListRegistryService);

  lists: ListRegistryEntry[] = [];
  
  showCreatePrompt = signal<boolean>(false);
  newListNameInput = signal<string>('');

  ngOnInit(): void {
    this.lists = this.listRegistryService.getLists();
  }

  onCreateList(): void {
    this.showCreatePrompt.set(true);
  }

  cancelCreateList(): void {
    this.showCreatePrompt.set(false);
    this.newListNameInput.set('');
  }

  submitCreateList(): void {
    const name = this.newListNameInput().trim();
    const payload = name ? { name } : {};

    fetch(`${environment.apiUrl}/lists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then((data: { shareToken: string; creatorToken: string }) => {
        localStorage.setItem(`creator_token_${data.shareToken}`, data.creatorToken);
        this.router.navigate(['/list', data.shareToken]);
      })
      .catch((err) => {
        console.error('Error creating grocery list:', err);
        alert('Failed to create grocery list. Please try again.');
      })
      .finally(() => {
        this.showCreatePrompt.set(false);
        this.newListNameInput.set('');
      });
  }
}
