import { DOCUMENT, DestroyRef, Injectable, inject, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { SwUpdate, type VersionReadyEvent } from '@angular/service-worker'
import { TranslocoService } from '@jsverse/transloco'
import { filter } from 'rxjs'
import { ToastService, type ToastHandle } from '../../shared/ui/toast/toast.service'

/**
 * New builds: when the service worker has a new version ready it shows one
 * persistent "new version" toast whose action reloads; the app never
 * reloads on its own (someone may be typing an expense). It checks for
 * updates when the app comes back to the foreground, and flags an
 * unrecoverable cache state so the shell can offer a reload.
 */
@Injectable({ providedIn: 'root' })
export class UpdateService {
  private readonly updates = inject(SwUpdate)
  private readonly toasts = inject(ToastService)
  private readonly transloco = inject(TranslocoService)
  private readonly document = inject(DOCUMENT)
  private readonly destroyRef = inject(DestroyRef)
  private readonly unrecoverableState = signal(false)
  private readonly versionReadyState = signal(false)
  private toast: ToastHandle | null = null
  private started = false

  /** The cached build is broken: only a reload helps. */
  readonly unrecoverable = this.unrecoverableState.asReadonly()

  /** A new version waits for a reload (`VERSION_READY`): the running copy is not the latest. */
  readonly versionReady = this.versionReadyState.asReadonly()

  /** The service worker is registered for this build (off in development and specs). */
  get enabled(): boolean {
    return this.updates.isEnabled
  }

  /** Asks the worker for a newer version now; resolves whether one was found. */
  async checkNow(): Promise<boolean> {
    if (!this.updates.isEnabled) {
      return false
    }
    return this.updates.checkForUpdate().catch(() => false)
  }

  start(): void {
    if (this.started || !this.updates.isEnabled) {
      return
    }
    this.started = true

    this.updates.versionUpdates
      .pipe(
        filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.versionReadyState.set(true)
        this.offerReload()
      })

    this.updates.unrecoverable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.unrecoverableState.set(true))

    const onVisible = () => {
      if (this.document.visibilityState === 'visible') {
        void this.updates.checkForUpdate().catch(() => undefined)
      }
    }
    this.document.addEventListener('visibilitychange', onVisible)
    this.destroyRef.onDestroy(() =>
      this.document.removeEventListener('visibilitychange', onVisible)
    )
  }

  /** Activates the waiting version by reloading the page. */
  reload(): void {
    this.document.defaultView?.location.reload()
  }

  private offerReload(): void {
    if (this.toast) {
      return
    }
    this.toast = this.toasts.show({
      message: this.transloco.translate('update.ready'),
      persistent: true,
      action: {
        label: this.transloco.translate('update.reload'),
        run: () => this.reload(),
      },
    })
  }
}
