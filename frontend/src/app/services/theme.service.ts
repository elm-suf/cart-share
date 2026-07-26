import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  
  public theme = signal<Theme>('system');
  
  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Load saved theme
      const savedTheme = localStorage.getItem('theme') as Theme | null;
      if (savedTheme) {
        this.theme.set(savedTheme);
      }
      
      // Watch for system changes
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (this.theme() === 'system') {
          this.applyTheme('system');
        }
      });
    }

    // Effect to apply theme when it changes
    effect(() => {
      this.applyTheme(this.theme());
    });
  }

  public setTheme(theme: Theme) {
    this.theme.set(theme);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('theme', theme);
    }
  }

  private applyTheme(theme: Theme) {
    if (!isPlatformBrowser(this.platformId)) return;

    const root = document.documentElement;
    let isDark = false;

    if (theme === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      isDark = theme === 'dark';
    }

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
}
