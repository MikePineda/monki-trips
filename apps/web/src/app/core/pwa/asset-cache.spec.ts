import { TestBed } from '@angular/core/testing'
import { FakeCacheStorage } from '../../../testing/fake-cache-storage'
import {
  AssetCache,
  CACHE_STORAGE,
  LOCALE_ASSETS,
  MASCOT_ASSETS,
  SERVICE_WORKER_CONTAINER,
} from './asset-cache'

describe('AssetCache', () => {
  let caches: FakeCacheStorage

  beforeEach(() => {
    caches = new FakeCacheStorage()
    TestBed.configureTestingModule({
      providers: [
        { provide: CACHE_STORAGE, useValue: caches },
        { provide: SERVICE_WORKER_CONTAINER, useValue: null },
      ],
    })
  })

  const url = (path: string) => new URL(path, document.baseURI).href

  it('reports both catalogues and the mascot only when every file is cached', async () => {
    const assets = TestBed.inject(AssetCache)
    expect(await assets.check()).toEqual({ locales: false, mascot: false })

    caches.put(url(LOCALE_ASSETS[0]))
    for (const path of MASCOT_ASSETS) caches.put(url(path))
    expect(await assets.check()).toEqual({ locales: false, mascot: true })

    caches.put(url(LOCALE_ASSETS[1]))
    expect(await assets.check()).toEqual({ locales: true, mascot: true })
  })

  it('without Cache Storage nothing counts as cached', async () => {
    TestBed.overrideProvider(CACHE_STORAGE, { useValue: null })

    expect(await TestBed.inject(AssetCache).check()).toEqual({ locales: false, mascot: false })
    expect(TestBed.inject(AssetCache).controlled()).toBe(false)
  })
})
