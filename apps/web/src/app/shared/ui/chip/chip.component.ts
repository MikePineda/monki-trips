import { NgTemplateOutlet } from '@angular/common'
import { ChangeDetectionStrategy, Component, input, model } from '@angular/core'
import { MkIconComponent } from '../icon/icon.component'
import type { IconName } from '../icon/icon-names'

/**
 * filter: the default chip (hairline on surface-1; selectable as a toggle).
 * status: surface-2 fill, `line` border, status icon in its colour and the
 * word in ink. tag: a static label (a category).
 */
export type ChipVariant = 'filter' | 'status' | 'tag'

/** The colour of a status chip's icon; the word stays in ink. */
export type ChipTone = 'neutral' | 'good' | 'warning' | 'serious' | 'critical'

/**
 * A 32 px label with radius 4 and an optional 16 px icon. With `selectable`
 * it is a toggle button that reports `selected` through a two-way binding
 * and `aria-pressed`; selected means an accent-soft wash and an accent
 * border (interaction, not data). Route chips are `mk-route-chip`.
 */
@Component({
  selector: 'mk-chip',
  imports: [NgTemplateOutlet, MkIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'mk-chip',
    '[attr.data-variant]': 'variant()',
    '[attr.data-tone]': 'tone()',
    '[class.mk-chip--selected]': 'selected()',
  },
  styles: `
    /*
     * A 32 px chip with a 44 px hit area: 6 px above and below, and 2 px of
     * margin so the hit areas of a wrapped row (8 px gap) never overlap.
     */
    :host {
      display: inline-flex;
      max-width: 100%;
      margin-block: 2px;
    }
    .mk-chip__body {
      display: inline-flex;
      align-items: center;
      gap: var(--space-half);
      min-height: 32px;
      max-width: 100%;
      padding: 0 var(--space-1);
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-sm);
      background: var(--surface-1);
      color: var(--ink-1);
      transition: background-color var(--duration-fast) var(--ease-out);
    }
    .mk-chip__label {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    button.mk-chip__body {
      position: relative;
      min-width: var(--tap-target);
      justify-content: center;
      cursor: pointer;
    }
    button.mk-chip__body::after {
      content: '';
      position: absolute;
      inset: -7px -1px;
    }
    button.mk-chip__body[aria-pressed='true'] {
      border-color: var(--accent);
      background: var(--accent-soft);
      color: var(--accent);
      font-weight: 600;
    }
    button.mk-chip__body:disabled {
      border-color: var(--line);
      background: var(--surface-2);
      color: var(--ink-3);
      cursor: not-allowed;
    }
    :host([data-variant='status']) .mk-chip__body {
      border-color: var(--line);
      background: var(--surface-2);
    }
    :host([data-variant='tag']) .mk-chip__body {
      border-color: var(--line);
      color: var(--ink-2);
    }
    :host([data-tone='good']) mk-icon {
      color: var(--status-good);
    }
    :host([data-tone='warning']) mk-icon {
      color: var(--status-warning);
    }
    :host([data-tone='serious']) mk-icon {
      color: var(--status-serious);
    }
    :host([data-tone='critical']) mk-icon {
      color: var(--status-critical);
    }
  `,
  template: `
    <!-- One ng-content, rendered in whichever branch is live: projected content cannot sit inside @if twice. -->
    <ng-template #body>
      @if (icon(); as icon) {
        <mk-icon [name]="icon" [size]="16" />
      }
      <span class="mk-chip__label"><ng-content /></span>
    </ng-template>
    @if (selectable()) {
      <button
        type="button"
        class="mk-chip__body mk-type-label"
        [attr.aria-pressed]="selected()"
        [disabled]="disabled()"
        (click)="toggle()"
      >
        <ng-container *ngTemplateOutlet="body" />
      </button>
    } @else {
      <span class="mk-chip__body mk-type-label">
        <ng-container *ngTemplateOutlet="body" />
      </span>
    }
  `,
})
export class MkChipComponent {
  readonly variant = input<ChipVariant>('filter')
  readonly tone = input<ChipTone>('neutral')
  readonly icon = input<IconName>()
  readonly selectable = input(false)
  readonly disabled = input(false)
  readonly selected = model(false)

  protected toggle(): void {
    this.selected.update((selected) => !selected)
  }
}
