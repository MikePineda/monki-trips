import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { FormField, form, maxLength, pattern, required, submit } from '@angular/forms/signals'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import {
  TASK_PRIORITIES,
  TASK_URGENCIES,
  groupTasksByUrgency,
  isDone,
  type TaskPriority,
  type TaskUrgency,
} from '@monkitrips/shared'
import { LangStore } from '../../core/i18n/lang.store'
import { fieldError } from '../../core/forms/field-error'
import { CLOCK } from '../../core/offline/clock'
import { liveSignal } from '../../core/offline/live'
import type { EventRecord, TaskRecord } from '../../core/offline/records'
import { SyncService } from '../../core/offline/sync.service'
import { TIME_ZONE } from '../../core/offline/time-zone'
import { formatDayDate } from '../../domain/day-date'
import { localToday } from '../../domain/local-today'
import { formatLocaleFor } from '../../domain/locale'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkEmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import { MkIconButtonComponent } from '../../shared/ui/icon-button/icon-button.component'
import { MkIconComponent } from '../../shared/ui/icon/icon.component'
import { MkRowComponent, MkRowGrowDirective } from '../../shared/ui/layout/row.component'
import { MkSectionComponent } from '../../shared/ui/layout/section.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkCheckRowComponent } from '../../shared/ui/list/check-row.component'
import { MkListComponent } from '../../shared/ui/list/list.component'
import type { RowStatus } from '../../shared/ui/list/list-row.component'
import { SheetService } from '../../shared/ui/sheet/sheet.service'
import { MkSwitchComponent } from '../../shared/ui/switch/switch.component'
import { MkTextComponent } from '../../shared/ui/text/text.component'
import { ToastService } from '../../shared/ui/toast/toast.service'
import { TaskEditSheet, type TaskEditData, type TaskEditResult } from './task-edit.sheet'
import { taskTitleKey } from './task-title'
import { provideTasksI18n } from './tasks-i18n'
import { TasksStore } from './tasks.store'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

interface QuickAddModel {
  title: string
  dueOn: string
  priority: TaskPriority
  eventId: string
}

interface TaskGroup {
  urgency: TaskUrgency
  tasks: TaskRecord[]
}

/**
 * The trip's tasks by urgency (overdue, today, this week, later, no date),
 * done ones behind a switch, a quick add at the top and an edit sheet per
 * row. Everything reads and writes the device's copy: ticking, adding,
 * editing and deleting work offline and sync later. A task that comes
 * from a document (a "print this" task) links to the document.
 */
@Component({
  selector: 'app-tasks-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    FormField,
    MkButtonComponent,
    MkEmptyStateComponent,
    MkFieldComponent,
    MkInputDirective,
    MkIconButtonComponent,
    MkIconComponent,
    MkRowComponent,
    MkRowGrowDirective,
    MkSectionComponent,
    MkStackComponent,
    MkCheckRowComponent,
    MkListComponent,
    MkSwitchComponent,
    MkTextComponent,
  ],
  providers: [provideTasksI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-stack gap="3">
      <h1 mk-text variant="title" data-testid="tasks.title">{{ 'tasks.title' | transloco }}</h1>

      <form novalidate (submit)="add($event)" data-testid="tasks.add">
        <mk-stack gap="1">
          <mk-row gap="1" align="end">
            <mk-field
              mkRowGrow
              [label]="'tasks.add.title' | transloco"
              [error]="fieldError(form.title)"
            >
              <input
                mkInput
                type="text"
                autocomplete="off"
                [placeholder]="'tasks.add.titlePlaceholder' | transloco"
                [formField]="form.title"
                data-testid="tasks.add.title"
              />
            </mk-field>
            <button mk-button type="submit" [loading]="adding()" data-testid="tasks.add.submit">
              <mk-icon name="plus" [size]="18" />
              {{ 'tasks.add.submit' | transloco }}
            </button>
          </mk-row>
          <mk-row gap="1" align="start" [wrap]="true">
            <mk-field
              mkRowGrow
              [label]="'tasks.add.dueOn' | transloco"
              [error]="fieldError(form.dueOn)"
            >
              <input mkInput type="date" [formField]="form.dueOn" data-testid="tasks.add.dueOn" />
            </mk-field>
            <mk-field mkRowGrow [label]="'tasks.add.priority' | transloco">
              <select mkInput [formField]="form.priority" data-testid="tasks.add.priority">
                @for (priority of priorities; track priority) {
                  <option [value]="priority">{{ 'tasks.priority.' + priority | transloco }}</option>
                }
              </select>
            </mk-field>
            @if (events().length > 0) {
              <mk-field mkRowGrow [label]="'tasks.add.event' | transloco">
                <select mkInput [formField]="form.eventId" data-testid="tasks.add.event">
                  <option value="">{{ 'tasks.add.noEvent' | transloco }}</option>
                  @for (event of events(); track event.id) {
                    <option [value]="event.id">{{ event.title }}</option>
                  }
                </select>
              </mk-field>
            }
          </mk-row>
        </mk-stack>
      </form>

      @if (open().length === 0) {
        <mk-empty-state
          icon="list-checks"
          [title]="'tasks.empty.title' | transloco"
          [body]="'tasks.empty.body' | transloco"
          data-testid="tasks.empty"
        />
      }
      @for (group of groups(); track group.urgency) {
        <mk-section
          [eyebrow]="('tasks.group.' + group.urgency | transloco) + ' · ' + group.tasks.length"
          [attr.data-testid]="'tasks.group.' + group.urgency"
        >
          <mk-list>
            @for (task of group.tasks; track task.id) {
              <mk-check-row
                [title]="titleOf(task)"
                [meta]="metaOf(task)"
                [checked]="false"
                [pending]="task.syncState === 'pending'"
                [status]="statusOf(task)"
                testId="tasks.item"
                [attr.data-task-id]="task.id"
                (checkedChange)="setDone(task, $event)"
              >
                @if (task.origin === 'document' && task.sourceDocumentId) {
                  <a
                    mkRowTrailing
                    mk-icon-button
                    size="sm"
                    tone="accent"
                    [routerLink]="['/t', tripId(), 'docs', task.sourceDocumentId]"
                    [attr.aria-label]="'tasks.row.openDocument' | transloco"
                    data-testid="tasks.item.document"
                  >
                    <mk-icon name="printer" />
                  </a>
                }
                <button
                  mkRowTrailing
                  mk-icon-button
                  size="sm"
                  type="button"
                  [attr.aria-label]="'tasks.row.edit' | transloco"
                  data-testid="tasks.item.edit"
                  (click)="edit(task)"
                >
                  <mk-icon name="pencil" />
                </button>
              </mk-check-row>
            }
          </mk-list>
        </mk-section>
      }

      @if (done().length > 0) {
        <mk-switch
          [checked]="showDone()"
          (checkedChange)="showDone.set($event)"
          testId="tasks.showDone"
        >
          {{ 'tasks.showDone' | transloco }} · {{ done().length }}
        </mk-switch>
        @if (showDone()) {
          <mk-section [eyebrow]="'tasks.group.done' | transloco" data-testid="tasks.group.done">
            <mk-list>
              @for (task of done(); track task.id) {
                <mk-check-row
                  [title]="titleOf(task)"
                  [meta]="metaOf(task)"
                  [checked]="true"
                  [pending]="task.syncState === 'pending'"
                  testId="tasks.item"
                  [attr.data-task-id]="task.id"
                  (checkedChange)="setDone(task, $event)"
                >
                  <button
                    mkRowTrailing
                    mk-icon-button
                    size="sm"
                    type="button"
                    [attr.aria-label]="'tasks.row.edit' | transloco"
                    data-testid="tasks.item.edit"
                    (click)="edit(task)"
                  >
                    <mk-icon name="pencil" />
                  </button>
                </mk-check-row>
              }
            </mk-list>
          </mk-section>
        }
      }
    </mk-stack>
  `,
})
export default class TasksPage {
  /** Bound from the parent route's parameter. */
  readonly tripId = input.required<string>()

  private readonly store = inject(TasksStore)
  private readonly sync = inject(SyncService)
  private readonly sheets = inject(SheetService)
  private readonly toasts = inject(ToastService)
  private readonly transloco = inject(TranslocoService)
  private readonly lang = inject(LangStore)
  private readonly clock = inject(CLOCK)
  private readonly timeZone = inject(TIME_ZONE)

  protected readonly priorities = TASK_PRIORITIES
  protected readonly fieldError = fieldError
  protected readonly adding = signal(false)
  protected readonly showDone = signal(false)
  protected readonly model = signal<QuickAddModel>({
    title: '',
    dueOn: '',
    priority: 'normal',
    eventId: '',
  })
  protected readonly form = form(this.model, (path) => {
    required(path.title)
    maxLength(path.title, 200)
    pattern(path.dueOn, ISO_DATE)
  })

  private readonly today = signal(localToday(this.clock(), this.timeZone))
  private readonly tasks = this.store.forTrip(this.tripId)
  private readonly allEvents = liveSignal<EventRecord[]>((db) => db.events.toArray(), [])

  protected readonly events = computed(() =>
    this.allEvents().filter((event) => event.tripId === this.tripId())
  )
  protected readonly open = computed(() => this.tasks().filter((task) => !isDone(task)))
  protected readonly done = computed(() =>
    this.tasks()
      .filter((task) => isDone(task))
      .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
  )
  /** Urgency groups in order, empty ones left out. */
  protected readonly groups = computed<TaskGroup[]>(() => {
    const grouped = groupTasksByUrgency(this.open(), this.today())
    return TASK_URGENCIES.map((urgency) => ({ urgency, tasks: grouped[urgency] })).filter(
      (group) => group.tasks.length > 0
    )
  })

  constructor() {
    this.sync.requestSync()
  }

  protected titleOf(task: TaskRecord): string {
    const key = taskTitleKey(task)
    return key ? this.transloco.translate(key, { title: task.title }) : task.title
  }

  protected metaOf(task: TaskRecord): string {
    if (!task.dueOn) {
      return this.transloco.translate('tasks.row.noDate')
    }
    const date = formatDayDate(task.dueOn, formatLocaleFor(this.lang.lang()))
    return this.transloco.translate('tasks.row.due', { date })
  }

  protected statusOf(task: TaskRecord): RowStatus | undefined {
    return task.priority === 'high'
      ? {
          tone: 'serious',
          icon: 'alert-triangle',
          label: this.transloco.translate('tasks.priority.high'),
        }
      : undefined
  }

  protected async add(event: Event): Promise<void> {
    event.preventDefault()
    await submit(this.form, async () => {
      this.adding.set(true)
      try {
        const value = this.model()
        await this.store.add({
          tripId: this.tripId(),
          title: value.title,
          dueOn: value.dueOn || null,
          priority: value.priority,
          eventId: value.eventId || null,
        })
        this.model.set({ title: '', dueOn: '', priority: 'normal', eventId: '' })
        this.form().reset()
      } finally {
        this.adding.set(false)
      }
      return undefined
    })
  }

  /** Ticks or reopens with an undo toast. */
  protected async setDone(task: TaskRecord, done: boolean): Promise<void> {
    await this.store.setDone(task.id, done)
    this.toasts.showUndo(
      this.transloco.translate(done ? 'tasks.toast.done' : 'tasks.toast.reopened'),
      () => void this.store.setDone(task.id, !done)
    )
  }

  protected edit(task: TaskRecord): void {
    const data: TaskEditData = { task, events: this.events() }
    const ref = this.sheets.open<TaskEditResult, TaskEditData>(TaskEditSheet, {
      data,
      label: this.transloco.translate('tasks.edit.title'),
    })
    ref.closed.subscribe((result) => {
      if (result?.outcome === 'deleted') {
        const deleted = result.task
        this.toasts.showUndo(
          this.transloco.translate('tasks.toast.deleted'),
          () => void this.store.restore(deleted)
        )
      } else if (result?.outcome === 'saved') {
        this.toasts.show({ message: this.transloco.translate('tasks.toast.saved') })
      }
    })
  }
}
