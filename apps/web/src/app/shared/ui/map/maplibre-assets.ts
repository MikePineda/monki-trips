// The files MapLibre loads beside its code, emitted by the bundler with a
// content hash (`loader: 'file'` answers their URL). Imported only together
// with MapLibre itself, in the map's lazy chunk.
import cssUrl from 'maplibre-gl/dist/maplibre-gl.css' with { loader: 'file' }
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs' with { loader: 'file' }

export { cssUrl, workerUrl }
