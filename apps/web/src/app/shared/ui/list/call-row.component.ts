import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { telHref } from '../../../domain/tel-href'
import { MkIconComponent } from '../icon/icon.component'

/**
 * A phone number to tap with one hand: the whole 64 px row is a `tel:`
 * link, the number in `code-display` (large, mono, tabular), the name
 * above it and an optional note below; a phone icon at the end in the
 * accent. A value with nothing to dial renders as a plain row.
 */
@Component({
  selector: 'mk-call-row',
  imports: [MkIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'mk-call-row', 'role': 'listitem', '[attr.data-testid]': 'testId()' },
  styles: `
    :host {
      display: block;
    }
    :host(:not(:last-child)) {
      border-bottom: 1px solid var(--line);
    }
    .mk-call-row__body {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      min-height: var(--space-8);
      padding: var(--space-1) 0;
      box-sizing: border-box;
      color: var(--ink-1);
      text-decoration: none;
    }
    a.mk-call-row__body:active {
      background: var(--surface-2);
    }
    .mk-call-row__text {
      display: flex;
      flex: 1 1 0;
      flex-direction: column;
      min-width: 0;
    }
    .mk-call-row__name {
      color: var(--ink-2);
    }
    .mk-call-row__number {
      color: var(--ink-1);
      overflow-wrap: anywhere;
    }
    .mk-call-row__note {
      color: var(--ink-3);
    }
    .mk-call-row__icon {
      flex: none;
      color: var(--accent);
    }
  `,
  template: `
    @if (href(); as href) {
      <a
        class="mk-call-row__body"
        [href]="href"
        [attr.data-testid]="testId() ? testId() + '.link' : null"
      >
        <span class="mk-call-row__text">
          <span class="mk-call-row__name mk-type-label">{{ name() }}</span>
          <span class="mk-call-row__number mk-type-code-display">{{ phone() }}</span>
          @if (note(); as note) {
            <span class="mk-call-row__note mk-type-caption">{{ note }}</span>
          }
        </span>
        <mk-icon class="mk-call-row__icon" name="phone" />
      </a>
    } @else {
      <div class="mk-call-row__body">
        <span class="mk-call-row__text">
          <span class="mk-call-row__name mk-type-label">{{ name() }}</span>
          <span class="mk-call-row__number mk-type-body">{{ phone() }}</span>
          @if (note(); as note) {
            <span class="mk-call-row__note mk-type-caption">{{ note }}</span>
          }
        </span>
      </div>
    }
  `,
})
export class MkCallRowComponent {
  readonly name = input.required<string>()
  readonly phone = input.required<string>()
  readonly note = input<string | null>()
  readonly testId = input<string>()

  protected readonly href = computed(() => telHref(this.phone()))
}
