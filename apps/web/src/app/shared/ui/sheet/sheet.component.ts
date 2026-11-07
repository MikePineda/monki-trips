import { DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkIconComponent } from '../icon/icon.component'
import { provideUiI18n } from '../ui-i18n'

/**
 * The frame of a bottom sheet opened through SheetService: grab handle,
 * title and a close button, then the projected content. Closing goes
 * through the CDK DialogRef when one is in scope.
 */
@Component({
  selector: 'mk-sheet',
  imports: [MkIconComponent, TranslocoPipe],
  viewProviders: [provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mk-sheet' },
  styles: `
    :host {
      display: block;
      padding: 0.5rem 1rem calc(1rem + env(safe-area-inset-bottom, 0px));
    }
    .mk-sheet__handle {
      width: 2.5rem;
      height: 0.25rem;
      margin: 0 auto 0.75rem;
      border-radius: 999px;
      background: var(--line-strong);
    }
    .mk-sheet__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.75rem;
    }
    .mk-sheet__title {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--ink-1);
    }
    .mk-sheet__close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.75rem;
      height: 2.75rem;
      margin-right: -0.75rem;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--ink-2);
      cursor: pointer;
    }
  `,
  template: `
    <div class="mk-sheet__handle" aria-hidden="true"></div>
    <header class="mk-sheet__header">
      <h2 class="mk-sheet__title">{{ title() }}</h2>
      @if (ref) {
        <button
          type="button"
          class="mk-sheet__close"
          data-testid="ui.sheet.close"
          [attr.aria-label]="'ui.sheet.close' | transloco"
          (click)="ref.close()"
        >
          <mk-icon name="x" />
        </button>
      }
    </header>
    <ng-content />
  `,
})
export class MkSheetComponent {
  readonly title = input.required<string>()

  protected readonly ref = inject(DialogRef, { optional: true })
}
