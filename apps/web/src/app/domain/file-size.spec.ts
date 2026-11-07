import { formatFileSize } from './file-size'

describe('formatFileSize', () => {
  it('small files in kB, larger ones in MB with one decimal', () => {
    expect(formatFileSize(512, 'en-AU')).toBe('1 kB')
    expect(formatFileSize(24_576, 'en-AU')).toBe('24 kB')
    expect(formatFileSize(2.5 * 1024 * 1024, 'en-AU')).toBe('2.5 MB')
  })

  it('follows the locale for the decimal mark', () => {
    expect(formatFileSize(2.5 * 1024 * 1024, 'es-MX')).toBe('2.5 MB')
    expect(formatFileSize(1536 * 1024 * 1024, 'en-AU')).toBe('1.5 GB')
  })

  it('an unknown size is empty', () => {
    expect(formatFileSize(null, 'en-AU')).toBe('')
  })
})
