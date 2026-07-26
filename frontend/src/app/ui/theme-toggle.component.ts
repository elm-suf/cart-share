import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService, Theme } from '../services/theme.service';
import { HlmButtonImports } from './button/src';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSun, lucideMoon, lucideLaptop } from '@ng-icons/lucide';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule, ...HlmButtonImports, NgIcon],
  providers: [provideIcons({ lucideSun, lucideMoon, lucideLaptop })],
  template: `
    <button hlmBtn variant="ghost" size="icon-sm" (click)="toggleTheme()" aria-label="Toggle theme">
      @if (currentTheme() === 'light') {
        <ng-icon name="lucideSun" class="text-foreground" />
      } @else if (currentTheme() === 'dark') {
        <ng-icon name="lucideMoon" class="text-foreground" />
      } @else {
        <ng-icon name="lucideLaptop" class="text-foreground" />
      }
      <span class="sr-only">Toggle theme</span>
    </button>
  `,
})
export class ThemeToggleComponent {
  private themeService = inject(ThemeService);
  
  public currentTheme = this.themeService.theme;
  
  toggleTheme() {
    const themes: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(this.themeService.theme());
    const nextIndex = (currentIndex + 1) % themes.length;
    this.themeService.setTheme(themes[nextIndex]);
  }
}
