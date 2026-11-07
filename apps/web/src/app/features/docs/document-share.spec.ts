import { fileOf, shareOrDownload, type ShareTarget } from './document-share'

describe('shareOrDownload', () => {
  function target(nav: ShareTarget['navigator']) {
    const clicks: { href: string; download: string }[] = []
    const revoked: string[] = []
    const doc = document.implementation.createHTMLDocument('t')
    const create = doc.createElement.bind(doc)
    doc.createElement = ((tag: string) => {
      const element = create(tag)
      if (tag === 'a') {
        element.click = () => {
          const a = element as HTMLAnchorElement
          clicks.push({ href: a.getAttribute('href') ?? '', download: a.download })
        }
      }
      return element
    }) as typeof doc.createElement
    const value: ShareTarget = {
      navigator: nav,
      document: doc,
      url: { createObjectURL: () => 'blob:fake', revokeObjectURL: (url) => revoked.push(url) },
    }
    return { value, clicks, revoked }
  }

  const file = fileOf(new Blob(['%PDF'], { type: 'application/pdf' }), 'Ferry voucher')

  it('names the file after the title with the extension of its type', () => {
    expect(file.name).toBe('Ferry voucher.pdf')
    expect(fileOf(new Blob(['x'], { type: 'image/png' }), 'scan.png').name).toBe('scan.png')
  })

  it('shares the file when the browser can share files', async () => {
    const shared: ShareData[] = []
    const { value, clicks } = target({
      canShare: () => true,
      share: async (data?: ShareData) => {
        shared.push(data ?? {})
      },
    })

    expect(await shareOrDownload(value, file, 'Ferry voucher')).toBe('shared')
    expect(shared[0].files?.[0].name).toBe('Ferry voucher.pdf')
    expect(clicks).toEqual([])
  })

  it('downloads through an anchor when files cannot be shared', async () => {
    const { value, clicks, revoked } = target({
      canShare: () => false,
      share: async () => undefined,
    })

    expect(await shareOrDownload(value, file, 'Ferry voucher')).toBe('downloaded')
    expect(clicks).toEqual([{ href: 'blob:fake', download: 'Ferry voucher.pdf' }])
    await vi.waitFor(() => expect(revoked).toEqual(['blob:fake']))
  })

  it('a cancelled share sheet is not an error', async () => {
    const { value } = target({
      canShare: () => true,
      share: async () => {
        throw new DOMException('cancelled', 'AbortError')
      },
    })
    expect(await shareOrDownload(value, file, 'x')).toBe('cancelled')
  })
})
