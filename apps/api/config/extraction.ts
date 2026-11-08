/**
 * Reading bookings and receipts (WP 3.3). The size bounds shared with the
 * web app live in `@monkitrips/shared` (`EXTRACTION_MAX_*`); these are the
 * server's own knobs.
 */

/**
 * A PDF whose text layer has fewer letters and digits than this is read as
 * a scan: its pages go to the vision model instead of its text to the text
 * model. A real booking confirmation prints several hundred.
 */
export const EXTRACTION_MIN_TEXT_CHARS = 120

/** Output tokens one booking extraction may use (a long multi-leg itinerary fits). */
export const EXTRACTION_MAX_OUTPUT_TOKENS = 4_096

/** Output tokens one receipt extraction may use. */
export const RECEIPT_MAX_OUTPUT_TOKENS = 1_024

/**
 * Parsing a PDF's text runs in a worker thread (`pdf_text.ts`) with this
 * heap and this wall-clock limit; past either the file is refused and the
 * worker terminated. A real booking parses in well under a second.
 */
export const EXTRACTION_PDF_PARSE_TIMEOUT_MS = 5_000
export const EXTRACTION_PDF_PARSE_MEMORY_MB = 192

/**
 * A stored PDF larger than this is not read at all (refused from its
 * `size_bytes` before the bytes are fetched). Uploads may be up to 25 MB;
 * a booking confirmation is far smaller.
 */
export const EXTRACTION_MAX_PDF_BYTES = 10 * 1024 * 1024
