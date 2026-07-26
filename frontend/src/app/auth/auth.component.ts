import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../services/supabase.service';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.component.html'
})
export class AuthModalComponent {
  private supabaseService = inject(SupabaseService);

  @Output() close = new EventEmitter<void>();

  isSignUp = signal<boolean>(false);
  username = signal<string>('');
  password = signal<string>('');
  errorMessage = signal<string>('');
  loading = signal<boolean>(false);

  toggleMode(): void {
    this.isSignUp.update(val => !val);
    this.errorMessage.set('');
  }

  async onSubmit(): Promise<void> {
    const inputVal = this.username().trim();
    const passVal = this.password().trim();

    if (!inputVal || !passVal) {
      this.errorMessage.set('Please enter both username and password.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    try {
      if (this.isSignUp()) {
        await this.supabaseService.signUp(inputVal, passVal);
      } else {
        await this.supabaseService.signIn(inputVal, passVal);
      }
      this.close.emit();
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Authentication failed. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
