import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'list/:shareToken',
    loadComponent: () => import('./list/list.component').then((m) => m.ListComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
