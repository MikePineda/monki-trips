import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { MkIconComponent } from '../icon/icon.component'
import { provideUiI18n } from '../ui-i18n'
import { PDF_RENDERER, type RenderedPdf } from './pdf-renderer'

type PreviewState = 'idle' | 'loading' | 'ready' | 'failed'

/**
 * The quick view of a document's bytes: an image through an object URL
 * (revoked when the blob changes or the view goes), a PDF drawn page by
 * page by pdf.js (lazy), anything else an honest "no preview" line. Pages
 * sit on `surface-1` with a `line` hairline, never in a card.
 */
@Component({
  selector: 'mk-document-preview',
  imports: [TranslocoPipe, MkIconComponent],
  viewProviders: [provideUiI18n()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'mk-document-preview', '[attr.data-state]': 'state()' },
  styles: `
    :host {
      display: block;
    }
    .mk-document-preview__image,
    .mk-document-preview__pages canvas {
      display: block;
      width: 100%;
      height: auto;
      border: 1px solid var(--line);
      background: var(--surface-1);
    }
    .mk-document-preview__pages {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }
    .mk-document-preview__note {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      margin: 0;
      padding: var(--space-2) 0;
      color: var(--ink-2);
    }
  `,
  template: `
    @if (kind() === 'image' && objectUrl(); as src) {
      <img
        class="mk-document-preview__image"
        [src]="src"
        [alt]="label()"
        data-testid="ui.preview.image"
      />
    }
    <div
      #pages
      class="mk-document-preview__pages"
      role="img"
      [attr.aria-label]="label()"
      [hidden]="kind() !== 'pdf'"
      data-testid="ui.preview.pdf"
    ></div>
    @if (state() === 'loading') {
      <p class="mk-document-preview__note mk-type-caption" data-testid="ui.preview.loading">
        <mk-icon name="loader-circle" [size]="16" />{{ 'ui.preview.loading' | transloco }}
      </p>
    } @else if (state() === 'failed' || kind() === 'other') {
      <p class="mk-document-preview__note mk-type-caption" data-testid="ui.preview.none">
        <mk-icon name="file-text" [size]="16" />{{ 'ui.preview.none' | transloco }}
      </p>
    }
  `,
})
export class MkDocumentPreviewComponent {
  readonly blob = input<Blob | null>(null)
  /** The document's MIME type (the blob's own type when it has one wins). */
  readonly mime = input<string | null>(null)
  /** Accessible name: the document title. */
  readonly label = input.required<string>()

  private readonly renderer = inject(PDF_RENDERER)
  private readonly url = URL
  private readonly pages = viewChild.required<ElementRef<HTMLElement>>('pages')
  private rendered: RenderedPdf | null = null
  private generation = 0

  protected readonly objectUrl = signal<string | null>(null)
  protected readonly state = signal<PreviewState>('idle')
  protected readonly kind = computed(() => {
    const type = this.blob()?.type || this.mime() || ''
    if (type.startsWith('image/')) return 'image' as const
    if (type === 'application/pdf') return 'pdf' as const
    return 'other' as const
  })

  constructor() {
    effect(() => {
      const blob = this.blob()
      const kind = this.kind()
      const host = this.pages().nativeElement
      untracked(() => this.show(blob, kind, host))
    })
    inject(DestroyRef).onDestroy(() => this.clear())
  }

  private show(blob: Blob | null, kind: 'image' | 'pdf' | 'other', host: HTMLElement): void {
    this.clear(host)
    const mine = (this.generation += 1)
    if (!blob) {
      this.state.set('idle')
      return
    }
    if (kind === 'image') {
      this.objectUrl.set(this.url.createObjectURL(blob))
      this.state.set('ready')
      return
    }
    if (kind !== 'pdf') {
      this.state.set('idle')
      return
    }
    this.state.set('loading')
    void blob
      .arrayBuffer()
      .then((data) => this.renderer(data, host, host.clientWidth || 360))
      .then(
        (rendered) => {
          if (mine !== this.generation) {
            rendered.destroy()
            return
          }
          this.rendered = rendered
          this.state.set('ready')
        },
        () => {
          if (mine === this.generation) this.state.set('failed')
        }
      )
  }

  private clear(host?: HTMLElement): void {
    const url = this.objectUrl()
    if (url) {
      this.url.revokeObjectURL(url)
      this.objectUrl.set(null)
    }
    this.rendered?.destroy()
    this.rendered = null
    host?.replaceChildren()
  }
}
