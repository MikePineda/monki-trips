import type { ShareInbox, SharedItem } from '../app/core/offline/share-inbox'

/** A synthetic shared PDF, as the service worker would store it. */
export function sharedItem(overrides: Partial<SharedItem> = {}): SharedItem {
  const blob = new Blob(['%PDF-1.4 synthetic'], { type: 'application/pdf' })
  return {
    id: 'shared-1',
    name: 'boarding-pass.pdf',
    type: 'application/pdf',
    size: blob.size,
    blob,
    title: null,
    text: null,
    url: null,
    receivedAt: '2026-11-07T11:00:00.000Z',
    ...overrides,
  }
}

/** The share inbox in memory. */
export class FakeShareInbox implements ShareInbox {
  constructor(public items: SharedItem[] = []) {}

  async list(): Promise<SharedItem[]> {
    return [...this.items]
  }

  async remove(id: string): Promise<void> {
    this.items = this.items.filter((item) => item.id !== id)
  }
}
