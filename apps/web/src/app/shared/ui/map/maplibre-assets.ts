// MapLibre GL JS and the files it loads beside its code, emitted by the
// bundler under media/ with a content hash (`loader: 'file'` answers their
// URL). The library is imported from its URL at runtime instead of being
// bundled as a root chunk: the service worker prefetches every root script on
// install, and 1.1 MB of map code that cannot work offline has no place there.
import cssUrl from 'maplibre-gl/dist/maplibre-gl.css' with { loader: 'file' }
import libraryUrl from 'maplibre-gl/dist/maplibre-gl.mjs' with { loader: 'file' }
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs' with { loader: 'file' }

export { cssUrl, libraryUrl, workerUrl }
