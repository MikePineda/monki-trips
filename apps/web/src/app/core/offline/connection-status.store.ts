import { Injectable, computed, inject, type Signal } from '@angular/core'
import { deriveConnectionStatus, type ConnectionStatus } from '../../domain/connection-status'
import { CLOCK } from './clock'
import { META_LAST_PULL_AT, MetaStore } from './meta.store'
import { OnlineStore } from './online.store'
import { OutboxStore } from './outbox.store'
import { SyncService } from './sync.service'

/** The shell header's connection indicator, derived from the offline core. */
@Injectable({ providedIn: 'root' })
export class ConnectionStatusStore {
  private readonly online = inject(OnlineStore).online
  private readonly sync = inject(SyncService)
  private readonly outbox = inject(OutboxStore)
  private readonly clock = inject(CLOCK)
  private readonly lastPullAt = inject(MetaStore).watch<string | null>(META_LAST_PULL_AT, null)

  readonly status: Signal<ConnectionStatus> = computed(() =>
    deriveConnectionStatus({
      online: this.online(),
      syncing: this.sync.syncing(),
      pendingCount: this.outbox.pendingCount(),
      failedCount: this.outbox.failedCount(),
      lastPullAt: this.lastPullAt(),
      now: new Date(this.clock()),
    })
  )
}
