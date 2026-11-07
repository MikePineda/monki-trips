import { ChangeDetectionStrategy, Component, input } from '@angular/core'

/**
 * A numbered list of short instructions (the iOS install steps): the
 * number in mono / ink-3, the sentence in body.
 */
@Component({
  selector: 'mk-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mk-steps' },
  styles: `
    :host {
      display: block;
    }
    ol {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      margin: 0;
      padding: 0;
      list-style: none;
      counter-reset: mk-step;
    }
    li {
      display: flex;
      gap: var(--space-1);
      color: var(--ink-1);
    }
    li::before {
      counter-increment: mk-step;
      content: counter(mk-step);
      flex: none;
      width: var(--space-3);
      color: var(--ink-3);
      font: 500 16px/24px var(--font-mono);
    }
  `,
  template: `
    <ol>
      @for (step of steps(); track $index) {
        <li class="mk-type-body">{{ step }}</li>
      }
    </ol>
  `,
})
export class MkStepsComponent {
  readonly steps = input.required<readonly string[]>()
}
