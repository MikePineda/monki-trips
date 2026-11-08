import { ChangeDetectionStrategy, Component, input } from '@angular/core'

export type ChatAuthor = 'member' | 'assistant'

/**
 * One turn of a chat inside `<mk-list>`: the author's name in `label`
 * (`ink-2` for the member, `ink-1` for the assistant), then the projected
 * text (`<p mk-text [preserveLines]="true">`, always interpolated) and,
 * under an answer, its proposals. Rows are separated by `line` hairlines
 * like every list; there are no bubbles and no cards. `busy` marks the
 * answer still streaming (`aria-busy`), so a screen reader waits for it.
 */
@Component({
  selector: 'mk-chat-message',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'mk-chat-message',
    'role': 'listitem',
    '[attr.data-author]': 'author()',
    '[attr.aria-busy]': 'busy() ? "true" : null',
  },
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-2) 0;
      min-width: 0;
      color: var(--ink-1);
    }
    :host(:not(:last-child)) {
      border-bottom: 1px solid var(--line);
    }
    .mk-chat-message__author {
      margin: 0;
      color: var(--ink-2);
    }
    :host([data-author='assistant']) .mk-chat-message__author {
      color: var(--ink-1);
    }
  `,
  template: `
    <p class="mk-chat-message__author mk-type-label">{{ name() }}</p>
    <ng-content />
  `,
})
export class MkChatMessageComponent {
  readonly author = input.required<ChatAuthor>()
  /** The author's display name: "You", "Kiko". */
  readonly name = input.required<string>()
  readonly busy = input(false)
}
