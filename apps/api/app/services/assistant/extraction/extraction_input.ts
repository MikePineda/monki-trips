import {
  EXTRACTION_IMAGE_MIMES,
  EXTRACTION_MAX_IMAGE_BYTES,
  EXTRACTION_MAX_PDF_PAGES,
  EXTRACTION_MAX_TEXT_CHARS,
} from '@monkitrips/shared'
import { ApiException } from '#exceptions/api_exception'
import type { LlmDocumentBlock, LlmImageBlock } from '#services/llm/llm_provider'
import { readPdfText } from '#services/assistant/extraction/pdf_text'
import { EXTRACTION_MIN_TEXT_CHARS } from '#config/extraction'

/** What reaches the model: a PDF's text (the cheap text model) or the file itself (the vision model). */
export type ExtractionInput =
  | { source: 'text'; text: string; truncated: boolean }
  | { source: 'vision'; block: LlmImageBlock | LlmDocumentBlock }

type ImageMime = LlmImageBlock['mimeType']

function isImageMime(mime: string): mime is ImageMime {
  return (EXTRACTION_IMAGE_MIMES as readonly string[]).includes(mime)
}

/** Letters and digits: whitespace and punctuation do not make a text layer. */
function meaningfulLength(text: string): number {
  return text.replace(/[^\p{L}\p{N}]/gu, '').length
}

/**
 * Text first, vision second. A PDF is read on the server and its text
 * (first `EXTRACTION_MAX_PDF_PAGES` pages, `EXTRACTION_MAX_TEXT_CHARS`
 * characters) is what the model sees; only when that text is too thin (a
 * scan) or the file is an image does the file itself go to the vision
 * model, bounded to `EXTRACTION_MAX_IMAGE_BYTES` and, for a PDF, its pages.
 *
 * Refusals: 415 `E_UNSUPPORTED_FILE` for a type the model cannot read
 * (HEIC, anything not a PDF or a JPEG/PNG/WebP/GIF), 503
 * `E_EXTRACTION_UNAVAILABLE` when vision is needed and not configured, 413
 * `E_FILE_TOO_LARGE` over the bounds. `mime` is the sniffed type, never
 * the name the client gave.
 */
export async function extractionInputOf(
  bytes: Buffer,
  mime: string,
  options: { vision: boolean }
): Promise<ExtractionInput> {
  if (mime === 'application/pdf') {
    const read = await readPdfText(bytes, {
      maxPages: EXTRACTION_MAX_PDF_PAGES,
      maxChars: EXTRACTION_MAX_TEXT_CHARS,
    })
    if (meaningfulLength(read.text) >= EXTRACTION_MIN_TEXT_CHARS) {
      return { source: 'text', text: read.text, truncated: read.truncated }
    }
    if (!options.vision) throw new ApiException('E_EXTRACTION_UNAVAILABLE')
    const pages = read.pages ?? EXTRACTION_MAX_PDF_PAGES
    if (pages > EXTRACTION_MAX_PDF_PAGES || bytes.length > EXTRACTION_MAX_IMAGE_BYTES) {
      throw new ApiException('E_FILE_TOO_LARGE')
    }
    return {
      source: 'vision',
      block: {
        type: 'document',
        mimeType: 'application/pdf',
        data: bytes.toString('base64'),
        pages,
      },
    }
  }
  if (!isImageMime(mime)) throw new ApiException('E_UNSUPPORTED_FILE')
  if (!options.vision) throw new ApiException('E_EXTRACTION_UNAVAILABLE')
  if (bytes.length > EXTRACTION_MAX_IMAGE_BYTES) throw new ApiException('E_FILE_TOO_LARGE')
  return {
    source: 'vision',
    block: { type: 'image', mimeType: mime, data: bytes.toString('base64') },
  }
}
