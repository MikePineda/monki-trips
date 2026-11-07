import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  input,
  model,
} from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkIconComponent } from '../icon/icon.component'
import { provideUiI18n } from '../ui-i18n'

const KEYS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0']

/**
 * The quick-expense keypad: amounts are never typed in a text field. Twelve
 * 56 px keys in mono with tabular figures (digits, the decimal separator and
 * delete) that edit `value`, a plain digit string the sheet formats as the
 * hero amount. The decimal key is a dot; the formatter localises it.
 * `decimals` caps the fraction (0 for a currency without decimals);
 * `autofocus` puts the focus on the first key so a sheet opens ready, and
 * a hardware keyboard types too (digits, `.`/`,`, Backspace) while a key
 * has the focus.
 */
@Component({
  selector: 'mk-keypad',
  imports: [TranslocoPipe, MkIconComponent],
  viewProviders: [provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'mk-keypad', '(keydown)': 'onKey($event)' },
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-1);
    }
    .mk-keypad__key {
      min-height: var(--row-height);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: var(--surface-1);
      color: var(--ink-1);
      cursor: pointer;
      transition: background-color var(--duration-fast) var(--ease-out);
    }
    .mk-keypad__key:active {
      background: var(--surface-2);
    }
    .mk-keypad__key--delete {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--icon);
    }
  `,
  template: `
    @for (key of keys; track key) {
      <button
        type="button"
        class="mk-keypad__key mk-type-code-display"
        [attr.data-testid]="'ui.keypad.' + key"
        (click)="press(key)"
      >
        {{ key }}
      </button>
    }
    <button
      type="button"
      class="mk-keypad__key mk-keypad__key--delete"
      data-testid="ui.keypad.delete"
      [attr.aria-label]="'ui.keypad.delete' | transloco"
      (click)="erase()"
    >
      <mk-icon name="delete" />
    </button>
  `,
})
export class MkKeypadComponent {
  /** Digits typed so far, at most one decimal separator and two decimals. */
  readonly value = model('')
  /** Most digits after the separator. */
  readonly decimals = input(2)
  readonly autofocus = input(false)

  protected readonly keys = KEYS
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef)

  constructor() {
    afterNextRender(() => {
      if (this.autofocus()) {
        this.host.nativeElement.querySelector<HTMLButtonElement>('button')?.focus()
      }
    })
  }

  protected onKey(event: KeyboardEvent): void {
    if (/^[0-9]$/.test(event.key)) {
      this.press(event.key)
    } else if (event.key === '.' || event.key === ',') {
      this.press('.')
    } else if (event.key === 'Backspace') {
      this.erase()
    } else {
      return
    }
    event.preventDefault()
  }

  protected press(key: string): void {
    const current = this.value()
    if (key === '.') {
      if (current.includes('.') || this.decimals() === 0) return
      this.value.set(current === '' ? '0.' : `${current}.`)
      return
    }
    const decimals = current.split('.')[1]
    if (decimals !== undefined && decimals.length >= this.decimals()) return
    if (current === '0') {
      this.value.set(key)
      return
    }
    this.value.set(current + key)
  }

  protected erase(): void {
    this.value.update((current) => current.slice(0, -1))
  }
}
