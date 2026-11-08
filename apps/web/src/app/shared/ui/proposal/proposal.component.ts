import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkIconComponent } from '../icon/icon.component'
import type { IconName } from '../icon/icon-names'
import { provideUiI18n } from '../ui-i18n'

export type ProposalTone = 'good' | 'warning' | 'serious' | 'neutral'

/** A flag on one change (a night that loses its bed): icon in the status colour, the word in ink. */
export interface ProposalFlag {
  tone: Exclude<ProposalTone, 'neutral'>
  icon: IconName
  label: string
}

/** One line of the diff: what a field was and what it becomes (`before` absent for something new). */
export interface ProposalChange {
  label: string
  before?: string | null
  after: string
  /** Codes, times and amounts in mono, like a ticket. */
  mono?: boolean
  flag?: ProposalFlag
}

/** Where a decided proposal ended: accepted, rejected, expired or failed, as icon plus word. */
export interface ProposalStatus {
  tone: ProposalTone
  icon: IconName
  label: string
}

/**
 * A change the assistant proposes, as a boarding pass: `surface-1` paper
 * with a 1 px `line-strong` edge and radius 8. Top: the kind in
 * `eyebrow` with its icon, the title, the summary; then the diff, one
 * row per change with its label, the value before in `ink-3`, an arrow
 * and the value after (screen readers hear "Before" and "After"), and a
 * flag (icon plus word, never colour alone). A perforation with two
 * notches separates the stub: the decision buttons
 * (`[mkProposalActions]`) or, once decided, the status, and an optional
 * `[mkProposalNote]` (why it failed). No accent on the paper.
 */
@Component({
  selector: 'mk-proposal',
  imports: [TranslocoPipe, MkIconComponent],
  viewProviders: [provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'mk-proposal',
    '[attr.data-tone]': 'status()?.tone ?? null',
  },
  styles: `
    :host {
      position: relative;
      display: block;
      overflow: hidden;
      min-width: 0;
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-md);
      background: var(--surface-1);
      color: var(--ink-1);
    }
    .mk-proposal__top {
      display: flex;
      flex-direction: column;
      gap: var(--space-half);
      padding: var(--space-2) var(--space-2) var(--space-1);
    }
    .mk-proposal__kind {
      display: inline-flex;
      align-items: center;
      gap: var(--space-half);
      margin: 0;
      color: var(--ink-2);
    }
    .mk-proposal__title,
    .mk-proposal__summary {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .mk-proposal__summary {
      color: var(--ink-2);
    }
    .mk-proposal__changes {
      margin: 0;
      padding: 0 var(--space-2) var(--space-2);
    }
    .mk-proposal__change {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--space-1) 0;
      min-width: 0;
    }
    .mk-proposal__change:not(:last-child) {
      border-bottom: 1px solid var(--line);
    }
    .mk-proposal__label {
      color: var(--ink-2);
    }
    .mk-proposal__values {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-half) var(--space-1);
      margin: 0;
      min-width: 0;
    }
    .mk-proposal__before {
      color: var(--ink-3);
      overflow-wrap: anywhere;
    }
    .mk-proposal__arrow {
      color: var(--ink-3);
    }
    .mk-proposal__after {
      overflow-wrap: anywhere;
    }
    .mk-proposal__flag {
      display: inline-flex;
      align-items: center;
      gap: var(--space-half);
      color: var(--ink-1);
    }
    .mk-proposal__flag[data-tone='good'] mk-icon,
    .mk-proposal__status[data-tone='good'] mk-icon {
      color: var(--status-good);
    }
    .mk-proposal__flag[data-tone='warning'] mk-icon,
    .mk-proposal__status[data-tone='warning'] mk-icon {
      color: var(--status-warning);
    }
    .mk-proposal__flag[data-tone='serious'] mk-icon,
    .mk-proposal__status[data-tone='serious'] mk-icon {
      color: var(--status-serious);
    }
    .mk-proposal__status[data-tone='neutral'] mk-icon {
      color: var(--ink-3);
    }
    .mk-proposal__perforation {
      position: relative;
      height: 0;
      margin: 0 var(--space-2);
      border-top: 1px dashed var(--line-strong);
    }
    .mk-proposal__perforation::before,
    .mk-proposal__perforation::after {
      content: '';
      position: absolute;
      top: -8px;
      width: 16px;
      height: 16px;
      box-sizing: border-box;
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-full);
      background: var(--surface-0);
    }
    .mk-proposal__perforation::before {
      left: calc(-1 * var(--space-2) - 9px);
    }
    .mk-proposal__perforation::after {
      right: calc(-1 * var(--space-2) - 9px);
    }
    .mk-proposal__stub {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-2);
    }
    .mk-proposal__status {
      display: inline-flex;
      align-items: center;
      gap: var(--space-half);
      margin: 0;
    }
    .mk-proposal__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
    }
    .mk-proposal__actions:empty {
      display: none;
    }
  `,
  template: `
    <div class="mk-proposal__top">
      <p class="mk-proposal__kind mk-type-eyebrow">
        <mk-icon [name]="icon()" [size]="16" />
        {{ kind() }}
      </p>
      @if (headingLevel() === 2) {
        <h2 class="mk-proposal__title mk-type-heading">{{ title() }}</h2>
      } @else {
        <h3 class="mk-proposal__title mk-type-heading">{{ title() }}</h3>
      }
      @if (summary(); as summary) {
        <p class="mk-proposal__summary mk-type-body">{{ summary }}</p>
      }
    </div>
    @if (changes().length > 0) {
      <dl class="mk-proposal__changes" [attr.aria-label]="'ui.proposal.changes' | transloco">
        @for (change of changes(); track $index) {
          <div class="mk-proposal__change" data-testid="ui.proposal.change">
            <dt class="mk-proposal__label mk-type-caption">{{ change.label }}</dt>
            <dd class="mk-proposal__values">
              @if (change.before !== undefined && change.before !== null) {
                <span
                  class="mk-proposal__before"
                  [class.mk-type-code]="change.mono"
                  [class.mk-type-body]="!change.mono"
                  data-testid="ui.proposal.before"
                  ><span class="mk-sr-only">{{ 'ui.proposal.before' | transloco }}: </span
                  >{{ change.before }}</span
                >
                <mk-icon class="mk-proposal__arrow" name="arrow-right" [size]="16" />
              }
              <span
                class="mk-proposal__after"
                [class.mk-type-code]="change.mono"
                [class.mk-type-body-strong]="!change.mono"
                data-testid="ui.proposal.after"
              >
                @if (change.before !== undefined && change.before !== null) {
                  <span class="mk-sr-only">{{ 'ui.proposal.after' | transloco }}: </span>
                }
                {{ change.after }}</span
              >
            </dd>
            @if (change.flag; as flag) {
              <dd
                class="mk-proposal__values"
                data-testid="ui.proposal.flag"
                [attr.data-tone]="flag.tone"
              >
                <span class="mk-proposal__flag mk-type-label" [attr.data-tone]="flag.tone">
                  <mk-icon [name]="flag.icon" [size]="16" />
                  {{ flag.label }}
                </span>
              </dd>
            }
          </div>
        }
      </dl>
    }
    <div class="mk-proposal__perforation" aria-hidden="true"></div>
    <div class="mk-proposal__stub">
      @if (status(); as status) {
        <p
          class="mk-proposal__status mk-type-body-strong"
          [attr.data-tone]="status.tone"
          data-testid="ui.proposal.status"
        >
          <mk-icon [name]="status.icon" [size]="20" />
          {{ status.label }}
        </p>
      }
      <div class="mk-proposal__actions"><ng-content select="[mkProposalActions]" /></div>
      <ng-content select="[mkProposalNote]" />
    </div>
  `,
})
export class MkProposalComponent {
  /** What kind of change: "Expense", "Task", "Plan change". */
  readonly kind = input.required<string>()
  readonly icon = input.required<IconName>()
  readonly title = input.required<string>()
  readonly summary = input<string | null>()
  readonly changes = input<readonly ProposalChange[]>([])
  /** Set once decided; the stub then shows it instead of buttons. */
  readonly status = input<ProposalStatus | null>(null)
  readonly headingLevel = input<2 | 3>(3)
}
