import type { Routes } from '@angular/router'

/**
 * Top-level routes. The shell frames the Phase 0 placeholder pages; `/`
 * and unknown paths go to the trip list.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layouts/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'trips' },
      { path: 'trips', loadComponent: () => import('./features/trips/trips.page') },
      { path: 'styleguide', loadComponent: () => import('./features/styleguide/styleguide.page') },
    ],
  },
  { path: '**', redirectTo: 'trips' },
]
