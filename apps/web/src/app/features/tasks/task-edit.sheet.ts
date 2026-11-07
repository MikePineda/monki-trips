import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { FormField, form, maxLength, pattern, required, submit } from '@angular/forms/signals'
import { TranslocoPipe } from '@jsverse/transloco'
import { TASK_PRIORITIES, type TaskPriority } from '@monkitrips/shared'
import { fieldError } from '../../core/forms/field-error'
import type { TaskRecord } from '../../core/offline/records'
import { MkButtonComponent } from '../../shared/ui/button/button.component'
import { MkFieldComponent } from '../../shared/ui/field/field.component'
import { MkInputDirective } from '../../shared/ui/field/input.directive'
import { MkRowComponent, MkRowGrowDirective } from '../../shared/ui/layout/row.component'
import { MkStackComponent } from '../../shared/ui/layout/stack.component'
import { MkSheetComponent } from '../../shared/ui/sheet/sheet.component'
import { provideTasksI18n } from './tasks-i18n'
import { TasksStore, type TaskChanges } from './tasks.store'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export interface TaskEditData {
  task: TaskRecord
  /** Events of the trip a task may be linked to (id and title). */
  events: readonly { id: string; title: string }[]
}

/** What the sheet closed with: the task was saved, deleted, or left alone. */
export type TaskEditResult = { outcome: 'saved' } | { outcome: 'deleted'; task: TaskRecord }

interface TaskEditModel {
  title: string
  notes: string
  dueOn: string
  priority: TaskPriority
  eventId: string
}

/**
 * The edit sheet of one task: title, notes, due date, priority and the
 * event it belongs to; "Delete task" at the end. Writes go through the
 * tasks store (optimistic, offline-capable) and the sheet closes with what
 * happened so the page can offer undo.
 */
@Component({
  selector: 'app-task-edit-sheet',
  imports: [
    TranslocoPipe,
    FormField,
    MkSheetComponent,
    MkFieldComponent,
    MkInputDirective,
    MkButtonComponent,
    MkStackComponent,
    MkRowComponent,
    MkRowGrowDirective,
  ],
  providers: [provideTasksI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mk-sheet [title]="'tasks.edit.title' | transloco">
      <form novalidate (submit)="save($event)">
        <mk-stack gap="2">
          <mk-field
            [label]="'tasks.edit.name' | transloco"
            [required]="true"
            [error]="fieldError(form.title)"
          >
            <input
              mkInput
              type="text"
              autocomplete="off"
              [formField]="form.title"
              data-testid="tasks.edit.title"
            />
          </mk-field>
          <mk-row gap="2" align="start">
            <mk-field
              mkRowGrow
              [label]="'tasks.edit.dueOn' | transloco"
              [error]="fieldError(form.dueOn)"
            >
              <input mkInput type="date" [formField]="form.dueOn" data-testid="tasks.edit.dueOn" />
            </mk-field>
            <mk-field mkRowGrow [label]="'tasks.edit.priority' | transloco">
              <select mkInput [formField]="form.priority" data-testid="tasks.edit.priority">
                @for (priority of priorities; track priority) {
                  <option [value]="priority">{{ 'tasks.priority.' + priority | transloco }}</option>
                }
              </select>
            </mk-field>
          </mk-row>
          @if (data.events.length > 0) {
            <mk-field [label]="'tasks.edit.event' | transloco">
              <select mkInput [formField]="form.eventId" data-testid="tasks.edit.event">
                <option value="">{{ 'tasks.edit.noEvent' | transloco }}</option>
                @for (event of data.events; track event.id) {
                  <option [value]="event.id">{{ event.title }}</option>
                }
              </select>
            </mk-field>
          }
          <mk-field [label]="'tasks.edit.notes' | transloco" [error]="fieldError(form.notes)">
            <textarea
              mkInput
              rows="3"
              [formField]="form.notes"
              data-testid="tasks.edit.notes"
            ></textarea>
          </mk-field>
          <button
            mk-button
            variant="destructive"
            size="md"
            type="button"
            [disabled]="busy()"
            data-testid="tasks.edit.delete"
            (click)="remove()"
          >
            {{ 'tasks.edit.delete' | transloco }}
          </button>
          <button
            mk-button
            size="block"
            type="submit"
            [loading]="busy()"
            data-testid="tasks.edit.save"
          >
            {{ 'tasks.edit.save' | transloco }}
          </button>
        </mk-stack>
      </form>
    </mk-sheet>
  `,
})
export class TaskEditSheet {
  protected readonly data = inject<TaskEditData>(DIALOG_DATA)
  private readonly store = inject(TasksStore)
  private readonly ref = inject<DialogRef<TaskEditResult>>(DialogRef)

  protected readonly priorities = TASK_PRIORITIES
  protected readonly fieldError = fieldError
  protected readonly busy = signal(false)
  protected readonly model = signal<TaskEditModel>({
    title: this.data.task.title,
    notes: this.data.task.notes ?? '',
    dueOn: this.data.task.dueOn ?? '',
    priority: this.data.task.priority,
    eventId: this.data.task.eventId ?? '',
  })
  protected readonly form = form(this.model, (path) => {
    required(path.title)
    maxLength(path.title, 200)
    maxLength(path.notes, 2000)
    pattern(path.dueOn, ISO_DATE)
  })

  protected async save(event: Event): Promise<void> {
    event.preventDefault()
    await submit(this.form, async () => {
      this.busy.set(true)
      try {
        const value = this.model()
        const changes: TaskChanges = {
          title: value.title.trim(),
          notes: value.notes.trim() || null,
          dueOn: value.dueOn || null,
          priority: value.priority,
          eventId: value.eventId || null,
        }
        await this.store.update(this.data.task.id, changes)
        this.ref.close({ outcome: 'saved' })
      } finally {
        this.busy.set(false)
      }
      return undefined
    })
  }

  protected async remove(): Promise<void> {
    this.busy.set(true)
    try {
      await this.store.remove(this.data.task.id)
      this.ref.close({ outcome: 'deleted', task: this.data.task })
    } finally {
      this.busy.set(false)
    }
  }
}
