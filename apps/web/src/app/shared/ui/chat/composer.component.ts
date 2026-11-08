import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core'

/**
 * The bottom of a chat: the projected `<mk-field>` with its
 * `<textarea mkInput>` and the send (or stop) button side by side, then
 * an optional `[mkComposerNote]` line (what is left of the month's
 * allowance). It sticks above the tab bar while the conversation
 * scrolls, on `surface-0` with a `line` hairline on top, bleeding to the
 * page gutter. When an on-screen keyboard covers the bottom of the
 * layout viewport (iOS keeps the tab bar under it), the visual viewport
 * says how much: while the composer holds the focus it rises by that
 * inset so the text being typed stays in view (without the focus there is
 * no keyboard of its own, and a collapsing toolbar must not move it). The textarea starts one line tall and grows with
 * its content up to a third of the screen.
 */
@Component({
  selector: 'mk-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    'class': 'mk-composer',
    '[style.--mk-keyboard-inset.px]': 'keyboardInset()',
  },
  styles: `
    .mk-composer {
      position: sticky;
      z-index: 1;
      bottom: max(
        calc(var(--tab-bar-height) + env(safe-area-inset-bottom, 0px)),
        var(--mk-keyboard-inset, 0px)
      );
      display: flex;
      flex-direction: column;
      gap: var(--space-half);
      margin: 0 calc(-1 * var(--page-gutter, var(--space-2)));
      padding: var(--space-1) var(--page-gutter, var(--space-2));
      border-top: 1px solid var(--line);
      background: var(--surface-0);
    }
    .mk-composer__row {
      display: flex;
      align-items: flex-end;
      gap: var(--space-1);
      min-width: 0;
    }
    .mk-composer__row > mk-field {
      flex: 1 1 0;
      min-width: 0;
    }
    .mk-composer__row > [mk-button] {
      flex: none;
    }
    .mk-composer .mk-field textarea.mk-input {
      min-height: var(--space-6);
      max-height: 33dvh;
      padding: var(--space-1) var(--space-2);
      resize: none;
      field-sizing: content;
    }
    .mk-composer__note:empty {
      display: none;
    }
  `,
  template: `
    <div class="mk-composer__row"><ng-content /></div>
    <div class="mk-composer__note"><ng-content select="[mkComposerNote]" /></div>
  `,
})
export class MkComposerComponent {
  /** CSS px of the layout viewport an on-screen keyboard covers (0 without one). */
  protected readonly keyboardInset = signal(0)

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement

  constructor() {
    const win = inject(DOCUMENT).defaultView
    const viewport = win?.visualViewport
    if (!win || !viewport) {
      return
    }
    const measure = () => {
      const focused = this.host.contains(this.host.ownerDocument.activeElement)
      const covered = win.innerHeight - viewport.height - viewport.offsetTop
      this.keyboardInset.set(focused ? Math.max(0, Math.round(covered)) : 0)
    }
    viewport.addEventListener('resize', measure)
    viewport.addEventListener('scroll', measure)
    this.host.addEventListener('focusin', measure)
    // After the blur lands, so activeElement has moved on.
    const later = () => setTimeout(measure)
    this.host.addEventListener('focusout', later)
    inject(DestroyRef).onDestroy(() => {
      viewport.removeEventListener('resize', measure)
      viewport.removeEventListener('scroll', measure)
      this.host.removeEventListener('focusin', measure)
      this.host.removeEventListener('focusout', later)
    })
  }
}
