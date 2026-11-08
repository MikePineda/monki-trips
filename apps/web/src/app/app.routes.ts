import type { Route, Routes } from '@angular/router'
import { authGuard } from './core/session/auth.guard'
import { currentTripGuard } from './core/session/current-trip.guard'
import { tripHomeGuard } from './core/session/trip-home.guard'
import { tripMemberGuard } from './core/session/trip-member.guard'

/**
 * Top-level routes. `auth-layout` frames the public pages (sign-in, sign-up,
 * invitations, e-mail verification, password reset); the shell frames the
 * trip list, the not-found page, the share inbox and settings behind
 * `authGuard`; the trip shell (`/t/:tripId`) adds `tripMemberGuard` and the
 * five tabs. `/t/current` resolves the active trip (manifest shortcut).
 * `/styleguide` is public. Unknown paths go to the trip list.
 */
/**
 * Settings, under the shell and under a trip's More tab. The account
 * section is its child route, so features/settings never imports
 * features/account.
 */
export function settingsRoute(path: string): Route {
  return {
    path,
    loadComponent: () => import('./features/settings/settings.page'),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/account/account-section.component').then(
            (m) => m.AccountSectionComponent
          ),
      },
    ],
  }
}

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
      settingsRoute('settings'),
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
      // Today while the trip is ongoing, the summary otherwise.
      { path: '', pathMatch: 'full', canActivate: [tripHomeGuard], children: [] },
      { path: 'summary', loadComponent: () => import('./features/trip/summary.page') },
      {
        path: 'plan',
        loadComponent: () => import('./features/plan/plan.page'),
        children: [
          { path: 'nights', children: [] },
          {
            path: 'e/:eventId',
            loadComponent: () => import('./features/plan/event-detail.outlet'),
          },
        ],
      },
      {
        path: 'money',
        loadComponent: () => import('./features/money/money-pages').then((m) => m.MoneyPage),
      },
      {
        path: 'add',
        loadComponent: () => import('./features/money/money-pages').then((m) => m.QuickExpensePage),
      },
      {
        path: 'docs',
        loadComponent: () => import('./features/docs/docs.page'),
        children: [
          {
            path: ':docId',
            loadComponent: () => import('./features/docs/document-detail.outlet'),
          },
        ],
      },
      { path: 'today', loadComponent: () => import('./features/today/today.page') },
      {
        path: 'more',
        children: [
          { path: '', pathMatch: 'full', loadComponent: () => import('./features/trip/more.page') },
          { path: 'tasks', loadComponent: () => import('./features/tasks/tasks.page') },
          { path: 'checklist', loadComponent: () => import('./features/tasks/checklist.page') },
          { path: 'emergency', loadComponent: () => import('./features/emergency/emergency.page') },
          {
            path: 'phrases',
            loadComponent: () => import('./features/phrases/phrases.page'),
            children: [
              {
                path: 'show/:cardKey',
                loadComponent: () =>
                  import('./features/phrases/phrases.page').then((m) => m.PhraseShowPage),
              },
            ],
          },
          {
            path: 'members',
            loadComponent: () => import('./features/trip/members/members.page'),
          },
          {
            path: 'activity',
            loadComponent: () => import('./features/trip/activity/activity.page'),
          },
          settingsRoute('settings'),
          { path: 'offline', loadComponent: () => import('./features/offline/offline.page') },
        ],
      },
    ],
  },
  { path: '**', redirectTo: 'trips' },
]
