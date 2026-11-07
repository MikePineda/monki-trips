import { NgTemplateOutlet } from '@angular/common'
import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { RouterLink } from '@angular/router'
import { MkIconComponent } from '../icon/icon.component'
import type { IconName } from '../icon/icon-names'

/** Status shown at the trailing end: the icon takes the status colour, the word stays in ink. */
export interface RowStatus {
  tone: 'good' | 'warning' | 'serious' | 'critical'
  icon: IconName
  label: string
}

/**
 * A 56 px list row: optional leading Lucide icon in `icon`, title in body
 * at 500 (ellipsis), meta in caption / ink-3, and at the end a tabular
 * value, a status (icon + word) or a chevron. With `link` the whole row is
 * one navigation target. Extra content: `[mkRowLeading]`, `[mkRowTrailing]`.
 */
@Component({
  selector: 'mk-list-row',
  imports: [NgTemplateOutlet, RouterLink, MkIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'mk-list-row', 'role': 'listitem', '[attr.data-tone]': 'status()?.tone' },
  styles: `
    :host {
      display: block;
    }
    :host(:not(:last-child)) {
      border-bottom: 1px solid var(--line);
    }
    .mk-row__body {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      min-height: var(--row-height);
      padding: var(--space-1) 0;
      box-sizing: border-box;
      color: var(--ink-1);
      text-decoration: none;
      transition: background-color var(--duration-fast) var(--ease-out);
    }
    a.mk-row__body:active {
      background: var(--surface-2);
    }
    .mk-row__icon {
      color: var(--icon);
    }
    .mk-row__text {
      flex: 1 1 0;
      min-width: 0;
    }
    .mk-row__title {
      margin: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      color: var(--ink-1);
    }
    .mk-row__meta {
      margin: 0;
      color: var(--ink-3);
    }
    .mk-row__value {
      color: var(--ink-1);
      white-space: nowrap;
    }
    .mk-row__status {
      display: inline-flex;
      align-items: center;
      gap: var(--space-half);
      color: var(--ink-2);
      white-space: nowrap;
    }
    :host([data-tone='good']) .mk-row__status mk-icon {
      color: var(--status-good);
    }
    :host([data-tone='warning']) .mk-row__status mk-icon {
      color: var(--status-warning);
    }
    :host([data-tone='serious']) .mk-row__status mk-icon {
      color: var(--status-serious);
    }
    :host([data-tone='critical']) .mk-row__status mk-icon {
      color: var(--status-critical);
    }
    .mk-row__chevron {
      color: var(--ink-3);
    }
  `,
  template: `
    @if (link(); as link) {
      <a class="mk-row__body" [routerLink]="link" [attr.data-testid]="testId()">
        <ng-container *ngTemplateOutlet="body" />
      </a>
    } @else {
      <div class="mk-row__body" [attr.data-testid]="testId()">
        <ng-container *ngTemplateOutlet="body" />
      </div>
    }

    <ng-template #body>
      <ng-content select="[mkRowLeading]" />
      @if (icon(); as icon) {
        <mk-icon class="mk-row__icon" [name]="icon" />
      }
      <span class="mk-row__text">
        <span class="mk-row__title mk-type-body-strong">{{ title() }}</span>
        @if (meta(); as meta) {
          <span class="mk-row__meta mk-type-caption" [attr.data-mono]="monoMeta() ? '' : null">{{
            meta
          }}</span>
        }
      </span>
      @if (value(); as value) {
        <span class="mk-row__value mk-type-body">{{ value }}</span>
      }
      @if (status(); as status) {
        <span class="mk-row__status mk-type-label">
          <mk-icon [name]="status.icon" [size]="16" />
          {{ status.label }}
        </span>
      }
      <ng-content select="[mkRowTrailing]" />
      @if (chevron() || link()) {
        <mk-icon class="mk-row__chevron" name="chevron-right" />
      }
    </ng-template>
  `,
})
export class MkListRowComponent {
  readonly title = input.required<string>()
  readonly meta = input<string>()
  /** Meta set in mono (a booking reference, a time). */
  readonly monoMeta = input(false)
  readonly icon = input<IconName>()
  readonly value = input<string>()
  readonly status = input<RowStatus>()
  readonly chevron = input(false)
  readonly link = input<string | readonly string[]>()
  /** `data-testid` of the row's target. */
  readonly testId = input<string>()
}
