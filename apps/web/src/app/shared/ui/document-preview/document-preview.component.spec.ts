import { Component, signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { i18nTesting } from '../../../../testing/i18n-testing'
import { MkDocumentPreviewComponent } from './document-preview.component'
import { PDF_RENDERER, type PdfRenderer } from './pdf-renderer'

@Component({
  imports: [MkDocumentPreviewComponent],
  template: `<mk-document-preview [blob]="blob()" [mime]="mime()" label="Ferry voucher" />`,
})
class Host {
  readonly blob = signal<Blob | null>(null)
  readonly mime = signal<string | null>(null)
}

describe('MkDocumentPreviewComponent', () => {
  let created: Blob[]
  let revoked: string[]
  let rendered: { bytes: number; host: HTMLElement }[]

  beforeEach(() => {
    created = []
    revoked = []
    rendered = []
    let next = 0
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (blob: Blob) => {
        created.push(blob)
        next += 1
        return `blob:fake-${next}`
      },
      revokeObjectURL: (url: string) => revoked.push(url),
    })
    const renderer: PdfRenderer = async (data, host) => {
      rendered.push({ bytes: data.byteLength, host })
      host.appendChild(document.createElement('canvas'))
      return { pages: 1, destroy: () => undefined }
    }
    TestBed.configureTestingModule({
      imports: [Host, i18nTesting()],
      providers: [{ provide: PDF_RENDERER, useValue: renderer }],
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function render(blob: Blob | null, mime: string | null = null) {
    const fixture = TestBed.createComponent(Host)
    fixture.componentInstance.blob.set(blob)
    fixture.componentInstance.mime.set(mime)
    fixture.detectChanges()
    await fixture.whenStable()
    fixture.detectChanges()
    return fixture
  }

  it('quick view uses an object url for images', async () => {
    const image = new Blob(['png'], { type: 'image/png' })
    const fixture = await render(image)
    const img = (fixture.nativeElement as HTMLElement).querySelector<HTMLImageElement>(
      '[data-testid="ui.preview.image"]'
    )

    expect(created).toEqual([image])
    expect(img?.getAttribute('src')).toBe('blob:fake-1')
    expect(img?.alt).toBe('Ferry voucher')
    expect(rendered).toEqual([])

    fixture.componentInstance.blob.set(new Blob(['png2'], { type: 'image/png' }))
    fixture.detectChanges()
    await fixture.whenStable()
    expect(revoked).toEqual(['blob:fake-1'])

    fixture.destroy()
    expect(revoked).toEqual(['blob:fake-1', 'blob:fake-2'])
  })

  it('a pdf is drawn by the pdf renderer, never through an object url', async () => {
    const fixture = await render(new Blob(['%PDF-1.4'], { type: 'application/pdf' }))
    await vi.waitFor(() => expect(rendered).toHaveLength(1))
    fixture.detectChanges()

    expect(rendered[0].bytes).toBe(8)
    expect(created).toEqual([])
    expect((fixture.nativeElement as HTMLElement).querySelector('canvas')).not.toBeNull()
    await vi.waitFor(() => {
      fixture.detectChanges()
      expect(fixture.nativeElement.querySelector('mk-document-preview').dataset.state).toBe('ready')
    })
  })

  it('the mime decides when the blob has no type, and anything else says there is no preview', async () => {
    const pdf = await render(new Blob(['%PDF']), 'application/pdf')
    await vi.waitFor(() => expect(rendered).toHaveLength(1))
    pdf.destroy()

    const other = await render(new Blob(['zip']), 'application/zip')
    expect(other.nativeElement.querySelector('[data-testid="ui.preview.none"]')).not.toBeNull()
  })
})
