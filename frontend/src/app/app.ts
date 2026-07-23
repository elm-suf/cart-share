import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  title = 'CartShare';

  onCreateList(): void {
    console.log('Create list clicked — will be wired to backend in Ticket 02');
    alert('Create list clicked!\n(Real list creation coming in Ticket 02)');
  }
}
