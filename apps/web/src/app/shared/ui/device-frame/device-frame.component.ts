import { ChangeDetectionStrategy, Component, input } from '@angular/core'

/**
 * A 390 × 844 phone frame for the style guide's mock screens: `surface-0`,
 * a `line-strong` edge, the top and bottom safe areas drawn as the status
 * bar and the home indicator, content clipped. Screens are projected as
 * content; a sheet mock goes in `[mkFrameSheet]` and renders over the scrim.
 */
@Component({
  selector: 'mk-device-frame',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'mk-device-frame', '[attr.data-sheet]': 'sheet() ? "" : null' },
  styles: `
    :host {
      position: relative;
      display: flex;
      flex-direction: column;
      width: 390px;
      height: 844px;
      max-width: 100%;
      box-sizing: border-box;
      overflow: hidden;
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-lg);
      background: var(--surface-0);
      color: var(--ink-1);
    }
    .mk-frame__status {
      flex: none;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      height: 47px;
      padding: 0 28px 8px;
      box-sizing: border-box;
      color: var(--ink-2);
      font: 600 14px/16px var(--font-sans);
      font-variant-numeric: tabular-nums;
    }
    .mk-frame__cells {
      display: flex;
      gap: 6px;
    }
    .mk-frame__cells i {
      display: block;
      width: 14px;
      height: 10px;
      background: currentColor;
    }
    .mk-frame__cells i:last-child {
      width: 24px;
      height: 11px;
      border-radius: var(--radius-sm);
    }
    .mk-frame__screen {
      flex: 1 1 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .mk-frame__scroll {
      flex: 1 1 0;
      min-height: 0;
      overflow: hidden;
    }
    .mk-frame__fab {
      position: absolute;
      right: var(--space-2);
      bottom: calc(34px + var(--tab-bar-height) + var(--space-2));
    }
    .mk-frame__fab:empty {
      display: none;
    }
    .mk-frame__home {
      position: absolute;
      left: 50%;
      bottom: 8px;
      width: 134px;
      height: 5px;
      margin-left: -67px;
      border-radius: var(--radius-full);
      background: var(--ink-2);
      pointer-events: none;
    }
    .mk-frame__scrim {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      background: var(--scrim);
    }
    .mk-frame__sheet {
      border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
      background: var(--surface-1);
      box-shadow: var(--elevation-1);
      padding-bottom: 34px;
    }
    .mk-frame__scrim:not([data-open]) {
      display: none;
    }
  `,
  template: `
    <div class="mk-frame__status" aria-hidden="true">
      <span>9:41</span>
      <span class="mk-frame__cells"><i></i><i></i><i></i></span>
    </div>
    <div class="mk-frame__screen">
      <ng-content select="[mkFrameTop]" />
      <div class="mk-frame__scroll"><ng-content /></div>
      <ng-content select="[mkFrameBottom]" />
    </div>
    <div class="mk-frame__fab"><ng-content select="[mkFrameFab]" /></div>
    <div class="mk-frame__scrim" [attr.data-open]="sheet() ? '' : null">
      <div class="mk-frame__sheet"><ng-content select="[mkFrameSheet]" /></div>
    </div>
    <div class="mk-frame__home" aria-hidden="true"></div>
  `,
})
export class MkDeviceFrameComponent {
  /** Show the projected sheet over a scrim. */
  readonly sheet = input(false)
}
