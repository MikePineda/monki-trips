import type { Routes } from '@angular/router'
import { authGuard } from './core/session/auth.guard'
import { currentTripGuard } from './core/session/current-trip.guard'
import { tripMemberGuard } from './core/session/trip-member.guard'

/**
 * Top-level routes. `auth-layout` frames the public pages (sign-in, sign-up,
 * invitations, e-mail verification, password reset); the shell frames the
 * trip list, the not-found page, the share inbox and settings behind
 * `authGuard`; the trip shell (`/t/:tripId`) adds `tripMemberGuard` and the
 * five tabs. `/t/current` resolves the active trip (manifest shortcut).
 * `/styleguide` is public. Unknown paths go to the trip list.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'trips' },
  {
    path: '',
    loadComponent: () =>
      import('./layouts/auth/auth-layout.component').then((m) => m.AuthLayoutComponent),
    children: [
      { path: 'login', loadComponent: () => import('./features/auth/login.page') },
      { path: 'signup', loadComponent: () => import('./features/auth/signup.page') },
      { path: 'invite/:token', loadComponent: () => import('./features/auth/invite.page') },
      { path: 'verify-email', loadComponent: () => import('./features/auth/verify-email.page') },
      {
        path: 'forgot-password',
        loadComponent: () => import('./features/auth/forgot-password.page'),
      },
      {
        path: 'reset-password',
        loadComponent: () => import('./features/auth/reset-password.page'),
      },
    ],
  },
  {
    path: '',
    loadComponent: () => import('./layouts/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: 'trips', loadComponent: () => import('./features/trips/trips.page') },
      { path: 'not-found', loadComponent: () => import('./features/trips/trip-not-found.page') },
      { path: 'share', loadComponent: () => import('./features/share/share-inbox.page') },
      { path: 'settings', loadComponent: () => import('./features/settings/settings.page') },
    ],
  },
  { path: 'styleguide', loadComponent: () => import('./features/styleguide/styleguide.page') },
  { path: 't/current/add', canActivate: [currentTripGuard], children: [] },
  {
    path: 't/:tripId',
    loadComponent: () =>
      import('./layouts/trip-shell/trip-shell.component').then((m) => m.TripShellComponent),
    canActivate: [authGuard, tripMemberGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'today' },
      ...(['today', 'plan', 'docs', 'money', 'add'] as const).map((section) => ({
        path: section,
        loadComponent: () => import('./features/trip/trip-placeholder.page'),
        data: { section },
      })),
      {
        path: 'more',
        children: [
          { path: '', pathMatch: 'full', loadComponent: () => import('./features/trip/more.page') },
          { path: 'members', loadComponent: () => import('./features/trip/members.page') },
          {
            path: 'activity',
            loadComponent: () => import('./features/trip/activity-placeholder.page'),
          },
          { path: 'settings', loadComponent: () => import('./features/settings/settings.page') },
          { path: 'offline', loadComponent: () => import('./features/offline/offline.page') },
        ],
      },
    ],
  },
  { path: '**', redirectTo: 'trips' },
]
