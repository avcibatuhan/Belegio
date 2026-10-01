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

// ─── Tax tables and real-receipt regressions ──────────────────────────────

test('regression: tax table maps each heading to the figure below it', () => {
  // Real receipt (Dorfladen): every label used to take the last figure of the row.
  const layout = [
    line([word('Dringenberger', 20, 10), word('Dorfladen', 200, 10), word('UG', 330, 10)]),
    line([word('MwSt.%', 100, 300), word('Steuer:', 290, 300), word('Netto', 545, 300), word('Brutto', 760, 300)]),
    line([word('7%', 70, 340), word('Mwst.', 140, 340), word('0,62', 285, 340), word('€', 375, 340),
      word('8,75', 525, 340), word('€', 613, 340), word('9,37', 747, 340), word('€', 836, 340)]),
    line([word('Total:', 480, 400), word('9,37', 746, 400)]),
  ]
  const p = parseReceipt(layout.map((l) => l.text).join('\n'), layout)
  assert.equal(p.vatAmount.value, 0.62)
  assert.equal(p.net.value, 8.75)
  assert.equal(p.gross.value, 9.37)
  assert.equal(p.verification, 'bestaetigt')
})

test('tax table without word positions is matched by order', () => {
  const p = parseReceipt(lines('Firma GmbH', 'MwSt.%  Steuer  Netto  Brutto', '19%  1,60  8,40  10,00', 'Summe 10,00'))
  assert.equal(p.vatAmount.value, 1.6)
  assert.equal(p.net.value, 8.4)
  assert.equal(p.verification, 'bestaetigt')
})

test('a table with one row per VAT rate is not read as a single rate', () => {
  const p = parseReceipt(lines(
    'REWE Markt GmbH', 'MwSt  Netto  Steuer  Brutto', 'A 7%  10,00  0,70  10,70', 'B 19%  20,00  3,80  23,80', 'SUMME 34,50',
  ))
  assert.notEqual(p.verification, 'bestaetigt')
  assert.equal(p.gross.value, 34.5)
})

test('date glued to the time is still read', () => {
  // PaddleOCR dropped the space: "04.01.2020 10:14:40" → "04.01.202010:14:40".
  assert.equal(parseReceipt(lines('Firma GmbH', 'Datum: 04.01.202010:14:40', 'Summe 9,37')).date.value, '2020-01-04')
})

test('regression: real pharmacy receipt as PaddleOCR reads it is verified', () => {
  const p = parseReceipt(lines(
    'Feld-Apotheke', 'Frau Cunkenheimer', 'Gordonstrasse 2', '21079 Hamburg',
    '04172784 1 *      1.50 EUR      1.50', 'Summe EUR      8.84', 'Nettobetrag      EUR      7.43',
    'MWST 19.0%      EUR      1,41', 'Gegeben      Bar      EUR      14.00', 'zurück      EUR      5.16',
    'Steuernummer      4764100684', '13.09.2018      16:06      Kasse 1',
  ))
  assert.equal(p.gross.value, 8.84)
  assert.equal(p.net.value, 7.43)
  assert.equal(p.vatAmount.value, 1.41)
  assert.equal(p.date.value, '2018-09-13')
  assert.equal(p.verification, 'bestaetigt')
})

test('regression: a misread total that fits the rate but not net + VAT is a contradiction', () => {
  // Low-res photo: "89,50" read as "89,58". 89,58 × 19/119 = 14,30 ≈ 14,29, but 75,21 + 14,29 ≠ 89,58.
  const p = parseReceipt(lines('ARAL Tankstelle', 'SUMME EUR 89,58', 'MwSt 19% 14,29', 'Netto 75,21'))
  assert.equal(p.verification, 'widerspruch')
})

test('rate check allows only cent rounding', () => {
  // 89,50 × 19/119 = 14,2899 → 14,29 ✓
  assert.equal(parseReceipt(lines('Bäckerei Schmidt', 'SUMME EUR 89,50', 'MwSt 19% 14,29')).verification, 'bestaetigt')
  // 89,58 × 19/119 = 14,3027 — more than half a cent from 14,29, so not proof (the old 2-cent tolerance accepted it)
  assert.notEqual(parseReceipt(lines('Bäckerei Schmidt', 'SUMME EUR 89,58', 'MwSt 19% 14,29')).verification, 'bestaetigt')
})

test('merchant: lone punctuation specks between words are dropped', () => {
  assert.equal(parseReceipt(lines('REWE Markt : GmbH', 'SUMME 49,80')).merchant.value, 'REWE Markt GmbH')
  assert.equal(parseReceipt(lines('Feld-Apotheke', 'SUMME 8,84')).merchant.value, 'Feld-Apotheke')
})
