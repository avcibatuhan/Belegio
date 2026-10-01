import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixDigits, parseReceipt, type OcrLine } from './parseReceipt'

const lines = (...l: string[]) => l.join('\n')

test('regression: OCR-damaged subtotal is not taken as the total', () => {
  // The exact failure seen on a photographed receipt: "Zwischensumme" read as
  // "Zuischensumme", so the subtotal slipped past the exclusion rule.
  const p = parseReceipt(lines(
    'REWE Markt GmbH',
    'Zuischensumme 41,85',
    'MaSt 7% 3,26',
    'SUMME EUR 49,80',
    'Datum 12.09.2026',
  ))
  assert.equal(p.gross.value, 49.8)
})

test('regression: a calculated value never passes the arithmetic check', () => {
  // Total line lost entirely: only the subtotal and VAT survive OCR.
  const p = parseReceipt(lines('REWE Markt GmbH', 'Zuischensumme 41,85', 'MaSt 7% 7,95', 'Datum 12.09.2026'))
  assert.notEqual(p.verification, 'bestaetigt')
  assert.equal(p.arithmeticValid, false)
})

test('all three amounts read and consistent → verified', () => {
  const p = parseReceipt(lines('Hetzner Online GmbH', 'Netto 101,00', 'MwSt. 19% 19,19', 'Gesamtbetrag 120,19', '08.09.2026'))
  assert.equal(p.verification, 'bestaetigt')
  assert.equal(p.net.source, 'gelesen')
})

test('net missing but VAT matches the printed rate → verified', () => {
  const p = parseReceipt(lines('REWE Markt GmbH', 'SUMME EUR 49,80', 'MwSt 7% 3,26', '12.09.2026'))
  assert.equal(p.net.source, 'berechnet')
  assert.equal(p.verification, 'bestaetigt')
})

test('net missing and no printed rate → only derived, not verified', () => {
  const p = parseReceipt(lines('Bäckerei Schmidt', 'SUMME EUR 12,40', 'MwSt 0,81', '12.09.2026'))
  assert.equal(p.verification, 'abgeleitet')
})

test('read amounts that contradict each other are flagged', () => {
  const p = parseReceipt(lines('Hetzner Online GmbH', 'Netto 101,00', 'MwSt. 19% 19,19', 'Gesamtbetrag 128,19'))
  assert.equal(p.verification, 'widerspruch')
})

test('a total smaller than the net amount is rejected', () => {
  const p = parseReceipt(lines('Firma GmbH', 'Summe Artikel 9,99', 'Netto 100,00', 'MwSt. 19% 19,00', 'Gesamt 119,00'))
  assert.equal(p.gross.value, 119)
})

test('"Netto 7 %" is not read as the VAT amount', () => {
  const p = parseReceipt(lines('REWE Markt GmbH', 'SUMME EUR 49,80', 'Netto 7% 46,54', 'MwSt 7% 3,26'))
  assert.equal(p.vatAmount.value, 3.26)
  assert.equal(p.net.value, 46.54)
})

test('"Gesamt inkl. MwSt." still counts as the total', () => {
  const p = parseReceipt(lines('Telekom GmbH', 'Netto 49,99', 'MwSt. 19% 9,50', 'Gesamt inkl. MwSt. 59,49'))
  assert.equal(p.gross.value, 59.49)
  assert.equal(p.vatAmount.value, 9.5)
})

test('cash tendered and change are not the total', () => {
  const p = parseReceipt(lines('Bäckerei Schmidt', 'SUMME 12,40', 'Gegeben Bar 20,00', 'Rückgeld 7,60'))
  assert.equal(p.gross.value, 12.4)
})

test('a tax ID line does not become the VAT amount', () => {
  const p = parseReceipt(lines('Firma GmbH', 'Steuer-Nr. 12/345/67890', 'Artikel 14,90', 'Summe 14,90'))
  assert.notEqual(p.vatAmount.source, 'gelesen')
})

test('a date is never read as a money amount', () => {
  const p = parseReceipt(lines('Firma GmbH', 'Datum 12.09.2026', 'Summe EUR 5,50'))
  assert.equal(p.gross.value, 5.5)
  assert.equal(p.date.value, '2026-09-12')
})

test('digit fixer repairs look-alike letters in amounts and dates', () => {
  assert.equal(fixDigits('SUMME EUR 4S,8O').text, 'SUMME EUR 45,80')
  assert.equal(fixDigits('Total l.469,l3').text, 'Total 1.469,13')
  assert.equal(fixDigits('Datum 12.O9.2026').text, 'Datum 12.09.2026')
  assert.equal(fixDigits('Summe 49, 80').text, 'Summe 49,80')
})

test('digit fixer leaves words alone', () => {
  for (const s of ['SUMME EUR', 'MwSt 7%', 'Mostrichsosse', 'Bio Espresso 500g', 'EC-Karte', 'SO,OO']) {
    assert.equal(fixDigits(s).text, s)
  }
})

test('parser applies digit fixes end to end', () => {
  const p = parseReceipt(lines('REWE Markt GmbH', 'SUMME EUR 4S,8O', 'Datum 12.O9.2026'))
  assert.equal(p.gross.value, 45.8)
  assert.equal(p.date.value, '2026-09-12')
})

test('merchant: "Tankstelle" is not mistaken for a phone line', () => {
  const p = parseReceipt(lines('ARAL Tankstelle', 'Berliner Str. 40', 'Super E10 45,20 L 89,50', 'SUMME EUR 89,50'))
  assert.equal(p.merchant.value, 'ARAL Tankstelle')
})

test('merchant: a line carrying a price is never the shop name', () => {
  const p = parseReceipt(lines('Tel. 030 1234567', 'Super E10 45,20 L 89,50', 'SUMME EUR 89,50'))
  assert.notEqual(p.merchant.value, 'Super E10 45,20 L 89,50')
})

test('OCR-damaged "Netto" ("uetto") is still the net, not the VAT', () => {
  // Seen on a 6° tilted photo: "Netto 7%" → "uetto 7%", "MwSt 7%" → "unst 7%".
  const p = parseReceipt(lines('REWE Markt GmbH', 'SUMME EUR 49,80', 'uetto 7% 46,54', 'unst 7% 3,26'))
  assert.equal(p.net.value, 46.54)
  assert.equal(p.vatAmount.value, 3.26)
  assert.equal(p.verification, 'bestaetigt')
})

test('merchant: a stray margin speck is dropped, a real name is kept', () => {
  assert.equal(parseReceipt(lines('A           ARAL Tankstelle', 'SUMME 89,50')).merchant.value, 'ARAL Tankstelle')
  assert.equal(parseReceipt(lines('A1 Autoservice GmbH', 'SUMME 89,50')).merchant.value, 'A1 Autoservice GmbH')
})

// ─── Layout: word confidence and position ─────────────────────────────────

const word = (text: string, x0: number, y0: number, conf = 95) => ({
  text, confidence: conf, bbox: { x0, y0, x1: x0 + text.length * 12, y1: y0 + 24 },
})
const line = (words: ReturnType<typeof word>[], slope = 0): OcrLine => {
  const x0 = Math.min(...words.map((w) => w.bbox.x0))
  const x1 = Math.max(...words.map((w) => w.bbox.x1))
  const y0 = Math.min(...words.map((w) => w.bbox.y0))
  const y1 = Math.max(...words.map((w) => w.bbox.y1))
  return {
    text: words.map((w) => w.text).join(' '),
    words,
    bbox: { x0, y0, x1, y1 },
    baseline: { x0, y0: y1, x1, y1: y1 + (x1 - x0) * slope },
  }
}

test('position fallback joins a label with its amount when OCR split the row', () => {
  // Tesseract returned "SUMME EUR" and "49,80" as separate lines.
  const layout = [
    line([word('REWE', 20, 10), word('Markt', 80, 10), word('GmbH', 160, 10)]),
    line([word('SUMME', 20, 200), word('EUR', 100, 200)], 0.05),
    line([word('EC-Karte', 20, 240)]),
    line([word('49,80', 400, 216)]), // same visual row, shifted down by the tilt
  ]
  const p = parseReceipt(layout.map((l) => l.text).join('\n'), layout)
  assert.equal(p.gross.value, 49.8)
  assert.match(p.gross.evidence ?? '', /SUMME EUR ⟶ 49,80/)
})

test('low OCR word confidence lowers an unverified amount', () => {
  const layout = [
    line([word('Bäckerei', 20, 10), word('Schmidt', 130, 10)]),
    line([word('SUMME', 20, 60), word('12,40', 300, 60, 41)]),
  ]
  const p = parseReceipt(layout.map((l) => l.text).join('\n'), layout)
  assert.equal(p.gross.ocrConfidence, 0.41)
  assert.ok(p.gross.confidence <= 0.41)
  assert.ok(p.trace.some((t) => t.startsWith('Unsicher gelesen')))
})
