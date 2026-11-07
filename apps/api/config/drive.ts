import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, services } from '@adonisjs/drive'

/**
 * Where document bytes live. `fs` (tests, local development) keeps them
 * under `tmp/drive` and serves them through a signed route; `s3` is any
 * S3-compatible bucket (MinIO in E2E and CI, the production bucket). Both
 * are private: files are reached through short signed URLs only.
 */
const driveConfig = defineConfig({
  default: env.get('DRIVE_DISK', 'fs'),
  services: {
    fs: services.fs({
      location: app.tmpPath('drive'),
      serveFiles: true,
      routeBasePath: '/drive/fs',
      visibility: 'private',
      appUrl: env.get('APP_URL'),
    }),
    s3: services.s3({
      credentials: {
        accessKeyId: env.get('S3_KEY')?.release() ?? '',
        secretAccessKey: env.get('S3_SECRET')?.release() ?? '',
      },
      region: env.get('S3_REGION') ?? 'auto',
      bucket: env.get('S3_BUCKET') ?? '',
      endpoint: env.get('S3_ENDPOINT'),
      forcePathStyle: true,
      visibility: 'private',
    }),
  },
})

export default driveConfig

declare module '@adonisjs/drive/types' {
  export interface DriveDisks extends InferDriveDisks<typeof driveConfig> {}
}
