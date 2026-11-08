/**
 * Builds small, real PDFs for tests: one Helvetica text page per entry of
 * `pages` (each a list of lines), or a page with no text layer at all, like
 * a scanned booking. Synthetic content only.
 */
export function syntheticPdf(pages: (string[] | null)[]): Buffer {
  const objects: string[] = []
  const add = (body: string) => {
    objects.push(body)
    return objects.length
  }
  const catalog = add('')
  const tree = add('')
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const kids: number[] = []
  for (const lines of pages) {
    const content = lines
      ? 'BT /F1 11 Tf 72 740 Td 14 TL ' +
        lines.map((line) => `(${line.replace(/[()\\]/g, '\\$&')}) '`).join(' ') +
        ' ET'
      : '0 0 1 rg 72 72 200 200 re f'
    const stream = add(
      `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`
    )
    kids.push(
      add(
        `<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 612 792] /Contents ${stream} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`
      )
    )
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${tree} 0 R >>`
  objects[tree - 1] =
    `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(out, 'latin1'))
    out += `${index + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = Buffer.byteLength(out, 'latin1')
  out +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

/** A synthetic ferry booking, as text lines. */
export const FERRY_BOOKING_LINES = [
  'Example Ferries - Booking confirmation',
  'Booking reference: TEST01',
  'North Pier to Example Island',
  'Departure 25 Jan 2027 09:00 local time',
  'Arrival 25 Jan 2027 11:30 local time',
  'Passengers: 2 adults. Seats 12A, 12B',
  'Total paid: THB 1,200.00',
]
