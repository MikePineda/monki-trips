import { ChangeDetectionStrategy, Component, input, model } from '@angular/core'
import { MkIconComponent } from '../icon/icon.component'
import type { IconName } from '../icon/icon-names'

/**
 * A small labelled pill: a static tag (route `ORG → DST`, a category) or,
 * with `selectable`, a toggle button that reports `selected` through a
 * two-way binding and `aria-pressed`. Hairline border, no fill on data.
 */
@Component({
  selector: 'mk-chip',
  imports: [MkIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'mk-chip', '[class.mk-chip--selected]': 'selected()' },
  styles: `
    :host {
      display: inline-flex;
    }
    .mk-chip__body {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      min-height: 2rem;
      padding: 0 0.75rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface-1);
      color: var(--ink-2);
      font: inherit;
      font-size: 0.875rem;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    button.mk-chip__body {
      cursor: pointer;
    }
    button.mk-chip__body[aria-pressed='true'] {
      border-color: var(--accent);
      color: var(--accent);
    }
    button.mk-chip__body:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
  `,
  template: `
    @if (selectable()) {
      <button
        type="button"
        class="mk-chip__body"
        [attr.aria-pressed]="selected()"
        [disabled]="disabled()"
        (click)="toggle()"
      >
        @if (icon(); as icon) {
          <mk-icon [name]="icon" [size]="16" />
        }
        <ng-content />
      </button>
    } @else {
      <span class="mk-chip__body">
        @if (icon(); as icon) {
          <mk-icon [name]="icon" [size]="16" />
        }
        <ng-content />
      </span>
    }
  `,
})
export class MkChipComponent {
  readonly icon = input<IconName>()
  readonly selectable = input(false)
  readonly disabled = input(false)
  readonly selected = model(false)

  protected toggle(): void {
    this.selected.update((selected) => !selected)
  }
}
