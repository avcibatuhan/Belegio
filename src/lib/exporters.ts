import type { StoredReceipt } from './db'
import { SKR03 } from './categories'

/** Formats a number the way German accounting software expects: 1234.5 → "1234,50". */
function num(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

/** ISO yyyy-mm-dd → dd.mm.yyyy */
function deDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

/** Wraps a value in quotes and escapes any quotes inside it. */
function cell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/**
 * Plain CSV for spreadsheets.
 * Semicolon-separated, because that is what German Excel expects.
 */
export function toCsv(receipts: StoredReceipt[]): string {
  const header = [
    'Datum',
    'Händler',
    'Kategorie',
    'Netto',
    'MwSt-Satz',
    'MwSt-Betrag',
    'Brutto',
    'Status',
    'Notiz',
  ]

  const rows = receipts.map((r) =>
    [
      deDate(r.date),
      cell(r.merchant),
      cell(r.category),
      num(r.net),
      `${Math.round(r.vatRate * 100)}%`,
      num(r.vatAmount),
      num(r.gross),
      r.status === 'geprueft' ? 'Geprüft' : 'Vorläufig',
      cell(r.note),
    ].join(';'),
  )

  // A BOM makes Excel open the file as UTF-8 rather than mangling the umlauts.
  return '﻿' + [header.join(';'), ...rows].join('\r\n')
}

/**
 * DATEV-style booking records (EXTF "Buchungsstapel" simplified).
 *
 * This is a pragmatic subset: enough columns for a tax advisor to import the
 * essentials. A full EXTF header block should be added before relying on it
 * for a real handover.
 */
export function toDatev(receipts: StoredReceipt[]): string {
  const header = [
    'Umsatz (ohne Soll/Haben-Kz)',
    'Soll/Haben-Kennzeichen',
    'WKZ Umsatz',
    'Konto',
    'Gegenkonto (ohne BU-Schlüssel)',
    'BU-Schlüssel',
    'Belegdatum',
    'Belegfeld 1',
    'Buchungstext',
  ]

  const rows = receipts.map((r, i) => {
    // BU key tells DATEV which VAT rate applies.
    const bu = r.vatRate === 0.19 ? '9' : r.vatRate === 0.07 ? '2' : '0'
    const [, m, d] = r.date.split('-')
    return [
      num(r.gross),
      'S', // expense = debit
      'EUR',
      SKR03[r.category] ?? '4900',
      '1200', // bank
      bu,
      `${d}${m}`, // DATEV wants DDMM
      cell(`BEL-${String(i + 1).padStart(4, '0')}`),
      cell(r.merchant.slice(0, 60)),
    ].join(';')
  })

  return '﻿' + [header.join(';'), ...rows].join('\r\n')
}

/** A human-readable summary, used as the cover sheet of the PDF bundle. */
export function toSummaryText(receipts: StoredReceipt[], periodLabel: string): string {
  const net = receipts.reduce((s, r) => s + r.net, 0)
  const vat = receipts.reduce((s, r) => s + r.vatAmount, 0)
  const gross = receipts.reduce((s, r) => s + r.gross, 0)
  const unverified = receipts.filter((r) => r.status !== 'geprueft').length

  const byCategory = new Map<string, number>()
  for (const r of receipts) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + r.gross)

  const lines = [
    'Belegio — Auswertung',
    `Zeitraum: ${periodLabel}`,
    `Erstellt am: ${deDate(new Date().toISOString().slice(0, 10))}`,
    '',
    `Anzahl Belege:      ${receipts.length}`,
    `Summe Netto:        ${num(net)} EUR`,
    `Summe Umsatzsteuer: ${num(vat)} EUR`,
    `Summe Brutto:       ${num(gross)} EUR`,
    '',
    'Nach Kategorie:',
    ...[...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([c, v]) => `  ${c.padEnd(22)} ${num(v)} EUR`),
    '',
    unverified > 0
      ? `Hinweis: ${unverified} Beleg(e) sind noch nicht geprüft und als "vorläufig" enthalten.`
      : 'Alle Belege sind geprüft.',
    '',
    'Einzelbelege:',
    ...receipts.map(
      (r) =>
        `  ${deDate(r.date)}  ${r.merchant.slice(0, 30).padEnd(30)} ${num(r.gross).padStart(10)} EUR  ${r.category}`,
    ),
  ]

  return lines.join('\n')
}

/** Triggers a browser download for generated text content. */
export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  downloadBlob(filename, blob)
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke on the next tick so the download has definitely started.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
