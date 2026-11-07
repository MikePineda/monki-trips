import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { isDone } from '@monkitrips/shared'
import { OFFLINE_DB } from '../../core/offline/offline-db'
import type { TaskRecord } from '../../core/offline/records'
import { SyncService } from '../../core/offline/sync.service'
import {
  PRE_TRIP_TEMPLATE,
  TEMPLATE_CATEGORIES,
  templateItem,
  templateTitleKey,
  type TemplateCategory,
} from '../../domain/pre-trip-template'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkCheckRowComponent } from '../../shared/ui/list/check-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import { MkProgressComponent } from '../../shared/ui/progress/progress.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { taskTitleKey } from './task-title'
import { provideTasksI18n } from './tasks-i18n'
import { TasksStore } from './tasks.store'

interface ChecklistGroup {
  category: TemplateCategory
  tasks: TaskRecord[]
}

/**
 * The pre-trip checklist: the template's items as ordinary tasks of the
 * trip, grouped by category (documents, gear, before leaving) with the
 * progress on top. "Add the pre-trip checklist" queues the missing items
 * through the outbox (idempotent by item key, online or offline); ticking
 * an item is ticking the task.
 */
@Component({
  selector: 'app-checklist-page',
  imports: [
    TranslocoPipe,
    MkButtonComponent,
    MkEmptyStateComponent,
    MkIconComponent,
    MkSectionComponent,
    MkStackComponent,
    MkCheckRowComponent,
    MkListComponent,
    MkProgressComponent,
    MkTextComponent,
  ],
  providers: [provideTasksI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="3">
      <h1 mk-text variant="title" data-testid="checklist.title">
        {{ 'tasks.checklist.title' | transloco }}
      </h1>

      @if (items().length === 0) {
        <mk-empty-state
          mascot="excited"
          [title]="'tasks.checklist.emptyTitle' | transloco"
          [body]="'tasks.checklist.emptyBody' | transloco"
          data-testid="checklist.empty"
        >
          <button
            mkEmptyAction
            mk-button
            type="button"
            [loading]="adding()"
            data-testid="checklist.add"
            (click)="addTemplate()"
          >
            <mk-icon name="plus" [size]="18" />
            {{ 'tasks.checklist.add' | transloco }}
          </button>
        </mk-empty-state>
      } @else {
        <mk-progress
          variant="steps"
          [label]="'tasks.checklist.progress' | transloco"
          [value]="doneCount()"
          [max]="items().length"
          data-testid="checklist.progress"
        />
        @for (group of groups(); track group.category) {
          <mk-section
            [eyebrow]="'tasks.checklist.category.' + group.category | transloco"
            [attr.data-testid]="'checklist.category.' + group.category"
          >
            <mk-list>
              @for (task of group.tasks; track task.id) {
                <mk-check-row
                  [title]="titleOf(task)"
                  [checked]="isDone(task)"
                  [pending]="task.syncState === 'pending'"
                  testId="checklist.item"
                  [attr.data-item-key]="task.templateItemKey"
                  (checkedChange)="setDone(task, $event)"
                />
              }
            </mk-list>
          </mk-section>
        }
        @if (missing() > 0) {
          <button
            mk-button
            variant="secondary"
            type="button"
            [loading]="adding()"
            data-testid="checklist.addMissing"
            (click)="addTemplate()"
          >
            {{ 'tasks.checklist.addMissing' | transloco }}
          </button>
        }
      }
    </mk-stack>
  `,
})
export default class ChecklistPage {
  /** Bound from the parent route's parameter. */
  readonly tripId = input.required<string>()

  private readonly store = inject(TasksStore)
  private readonly database = inject(OFFLINE_DB)
  private readonly sync = inject(SyncService)
  private readonly toasts = inject(ToastService)
  private readonly transloco = inject(TranslocoService)

  protected readonly isDone = isDone
  protected readonly adding = signal(false)

  private readonly tasks = this.store.forTrip(this.tripId)

  /** The trip's tasks that belong to the template, in template order. */
  protected readonly items = computed(() => {
    const byKey = new Map(
      this.tasks()
        .filter((task) => templateItem(task.templateItemKey))
        .map((task) => [task.templateItemKey as string, task])
    )
    return PRE_TRIP_TEMPLATE.flatMap((item) => {
      const task = byKey.get(item.key)
      return task ? [task] : []
    })
  })
  protected readonly doneCount = computed(() => this.items().filter((task) => isDone(task)).length)
  protected readonly missing = computed(() => PRE_TRIP_TEMPLATE.length - this.items().length)
  protected readonly groups = computed<ChecklistGroup[]>(() =>
    TEMPLATE_CATEGORIES.map((category) => ({
      category,
      tasks: this.items().filter(
        (task) => templateItem(task.templateItemKey)?.category === category
      ),
    })).filter((group) => group.tasks.length > 0)
  )

  constructor() {
    this.sync.requestSync()
  }

  protected titleOf(task: TaskRecord): string {
    const key = taskTitleKey(task)
    return key ? this.transloco.translate(key, { title: task.title }) : task.title
  }

  protected async addTemplate(): Promise<void> {
    // The trip row is read when asked, not through a live query: the guard cached it already.
    const trip = await (await this.database).trips.get(this.tripId())
    if (!trip) {
      return
    }
    this.adding.set(true)
    try {
      const added = await this.store.addTemplate(this.tripId(), trip.startDate, (itemKey) =>
        this.transloco.translate(`tasks.${templateTitleKey(itemKey)}`)
      )
      this.toasts.show({
        message:
          added > 0
            ? this.transloco.translate('tasks.toast.templateAdded', { count: added })
            : this.transloco.translate('tasks.toast.templateComplete'),
      })
    } finally {
      this.adding.set(false)
    }
  }

  protected async setDone(task: TaskRecord, done: boolean): Promise<void> {
    await this.store.setDone(task.id, done)
    this.toasts.showUndo(
      this.transloco.translate(done ? 'tasks.toast.done' : 'tasks.toast.reopened'),
      () => void this.store.setDone(task.id, !done)
    )
  }
}
