#!/usr/bin/env node
/**
 * Writes `voucher.pdf`, the synthetic one-page PDF journey J04 uploads:
 * an invented ferry voucher (no real person, place or booking code).
 * Plain PDF 1.4 with a Helvetica text stream; the cross-reference table
 * is computed, so the file opens in pdf.js and sniffs as application/pdf.
 * Run `node e2e/fixtures/make-voucher-pdf.mjs` after changing the text.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const lines = ['DEMO FERRY VOUCHER', 'Port Vellmar to Aldermoor', 'Synthetic test document']
const text = lines
  .map(
    (line, index) => `BT /F1 ${index === 0 ? 24 : 14} Tf 72 ${720 - index * 32} Td (${line}) Tj ET`
  )
  .join('\n')

const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
]

let body = '%PDF-1.4\n'
const offsets = []
objects.forEach((object, index) => {
  offsets.push(Buffer.byteLength(body))
  body += `${index + 1} 0 obj\n${object}\nendobj\n`
})
const xref = Buffer.byteLength(body)
body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
body += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`

writeFileSync(fileURLToPath(new URL('./voucher.pdf', import.meta.url)), body)
