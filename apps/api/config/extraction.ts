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
