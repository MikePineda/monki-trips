import { DialogRef } from '@angular/cdk/dialog'
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkIconButtonComponent } from '../icon-button/icon-button.component'
import { MkIconComponent } from '../icon/icon.component'
import { provideUiI18n } from '../ui-i18n'

let nextTitleId = 0

/** The part of the CDK dialog container that names the dialog (what MatDialogTitle uses). */
interface LabelledContainer {
  _addAriaLabelledBy(id: string): void
  _removeAriaLabelledBy(id: string): void
}

function isLabelledContainer(container: unknown): container is LabelledContainer {
  return typeof (container as Partial<LabelledContainer>)?._addAriaLabelledBy === 'function'
}

/**
 * The frame of a bottom sheet opened through SheetService: the 36 × 4
 * handle in `line-strong`, the title in heading with a 44 px close button,
 * then the projected content; at most one `block` primary button at the end
 * (`[mkSheetFooter]`), 16 px above the safe area. Closing goes through the
 * CDK DialogRef when one is in scope.
 */
@Component({
  selector: 'mk-sheet',
  imports: [MkIconComponent, MkIconButtonComponent, TranslocoPipe],
  viewProviders: [provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mk-sheet' },
  styles: `
    :host {
      display: block;
      padding: var(--space-1) var(--space-2) calc(var(--space-2) + env(safe-area-inset-bottom, 0px));
      color: var(--ink-1);
    }
    .mk-sheet__handle {
      width: 36px;
      height: 4px;
      margin: 0 auto var(--space-2);
      border-radius: var(--radius-full);
      background: var(--line-strong);
    }
    .mk-sheet__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      min-height: var(--tap-target);
      margin-bottom: var(--space-1);
    }
    .mk-sheet__title {
      margin: 0;
    }
    .mk-sheet__footer {
      margin-top: var(--space-2);
    }
    .mk-sheet__footer:empty {
      display: none;
    }
  `,
  template: `
    <div class="mk-sheet__handle" aria-hidden="true"></div>
    <header class="mk-sheet__header">
      <h2 class="mk-sheet__title mk-type-heading" [id]="titleId">{{ title() }}</h2>
      @if (ref) {
        <button
          mk-icon-button
          type="button"
          data-testid="ui.sheet.close"
          [attr.aria-label]="'ui.sheet.close' | transloco"
          (click)="ref.close()"
        >
          <mk-icon name="x" />
        </button>
      }
    </header>
    <ng-content />
    <div class="mk-sheet__footer"><ng-content select="[mkSheetFooter]" /></div>
  `,
})
export class MkSheetComponent {
  readonly title = input.required<string>()

  protected readonly ref = inject(DialogRef, { optional: true })
  protected readonly titleId = `mk-sheet-title-${nextTitleId++}`

  constructor() {
    // A sheet opened without `label` is named by its own title.
    const container = this.ref?.containerInstance
    if (this.ref && !this.ref.config.ariaLabel && isLabelledContainer(container)) {
      container._addAriaLabelledBy(this.titleId)
      inject(DestroyRef).onDestroy(() => container._removeAriaLabelledBy(this.titleId))
    }
  }
}
