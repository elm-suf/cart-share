import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ListRegistryService, ListRegistryEntry } from '../services/list-registry.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
})
export class LandingComponent implements OnInit {
  private router = inject(Router);
  private listRegistryService = inject(ListRegistryService);

  lists: ListRegistryEntry[] = [];

  ngOnInit(): void {
    this.lists = this.listRegistryService.getLists();
  }

  onCreateList(): void {
    fetch('/api/lists', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then((data: { shareToken: string; creatorToken: string }) => {
        // Save the creatorToken to localStorage mapped by the shareToken
        localStorage.setItem(`creator_token_${data.shareToken}`, data.creatorToken);
        
        // Navigate to the new list page
        this.router.navigate(['/list', data.shareToken]);
      })
      .catch((err) => {
        console.error('Error creating grocery list:', err);
        alert('Failed to create grocery list. Please try again.');
      });
  }
}
