import {
  type ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core'
import { provideRouter, withComponentInputBinding } from '@angular/router'
import { provideServiceWorker } from '@angular/service-worker'
import { TranslocoService } from '@jsverse/transloco'
import { routes } from './app.routes'
import { provideI18n } from './core/i18n/i18n.providers'
import { SYNC_NOTIFIER, SyncService, type SyncNotifier } from './core/offline/sync.service'
import { OfflineBootRecorder } from './core/pwa/offline-boot'
import { UpdateService } from './core/pwa/update.service'
import { ThemeColorMeta } from './core/theme/theme-color'
import { ToastService } from './shared/ui/toast/toast.service'

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideI18n(),
    // sw.js handles the Share Target POST, then imports Angular's ngsw-worker.js.
    provideServiceWorker('sw.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    // Sync conflicts surface as a toast: the server's version won.
    {
      provide: SYNC_NOTIFIER,
      useFactory: (): SyncNotifier => {
        const toasts = inject(ToastService)
        const transloco = inject(TranslocoService)
        return {
          conflictResolved: () => toasts.show({ message: transloco.translate('sync.conflict') }),
        }
      },
    },
    provideAppInitializer(() => {
      inject(ThemeColorMeta)
      inject(UpdateService).start()
      inject(SyncService).start()
      // A start with no network came from the cache: that is the airplane-mode rehearsal.
      void inject(OfflineBootRecorder).record()
    }),
  ],
}
