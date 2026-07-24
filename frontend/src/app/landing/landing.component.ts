import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [HlmButton],
  templateUrl: './landing.component.html',
})
export class LandingComponent {
  private router = inject(Router);

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
