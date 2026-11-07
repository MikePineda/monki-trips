import { CLIENT_MAX_DOCUMENT_BYTES, checkUploadFile } from './document-upload-check'

describe('checkUploadFile', () => {
  it('accepts a pdf under the client limit', () => {
    expect(checkUploadFile({ size: 1024, type: 'application/pdf', name: 'voucher.pdf' })).toEqual({
      ok: true,
    })
  })

  it('accepts any image type', () => {
    expect(checkUploadFile({ size: 10, type: 'image/heic', name: 'x.heic' })).toEqual({ ok: true })
  })

  it('upload rejects files above the client limit', () => {
    expect(
      checkUploadFile({
        size: CLIENT_MAX_DOCUMENT_BYTES + 1,
        type: 'application/pdf',
        name: 'big.pdf',
      })
    ).toEqual({ ok: false, reason: 'too_large' })
    expect(
      checkUploadFile({ size: CLIENT_MAX_DOCUMENT_BYTES, type: 'application/pdf', name: 'a.pdf' })
    ).toEqual({ ok: true })
  })

  it('rejects a type the vault does not keep, by extension when the browser reports none', () => {
    expect(checkUploadFile({ size: 10, type: 'application/zip', name: 'a.zip' })).toEqual({
      ok: false,
      reason: 'unsupported',
    })
    expect(checkUploadFile({ size: 10, type: '', name: 'scan.PDF' })).toEqual({ ok: true })
    expect(checkUploadFile({ size: 10, type: '', name: 'photo.jpg' })).toEqual({ ok: true })
    expect(checkUploadFile({ size: 10, type: '', name: 'notes.txt' })).toEqual({
      ok: false,
      reason: 'unsupported',
    })
  })

  it('an empty file is unsupported', () => {
    expect(checkUploadFile({ size: 0, type: 'application/pdf', name: 'a.pdf' })).toEqual({
      ok: false,
      reason: 'unsupported',
    })
  })
})
