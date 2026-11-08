/**
 * A synthetic booking confirmation as a one-page PDF with a real text
 * layer, built in memory for J19 (invented ferry line, places and code).
 * Enough text that the API reads it with the text model, not vision.
 */
export function syntheticBookingPdf(): Buffer {
  const lines = [
    'DEMO FERRY LINES - BOOKING CONFIRMATION',
    'Booking reference DEMO42',
    'Port Vellmar to Aldermoor',
    'Departure 2 March 2027 at 09:00 local time',
    'Arrival 2 March 2027 at 11:30 local time',
    'One adult passenger, deck seat',
    'Total paid EUR 48.00',
    'Synthetic test document',
  ]
  const text = `BT /F1 12 Tf 72 720 Td 16 TL ${lines.map((line) => `(${line}) '`).join(' ')} ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let body = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body))
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(body)
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  body += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(body, 'latin1')
}
