/**
 * Extracts the tax-relevant fields from the raw OCR text of a German receipt.
 *
 * Receipts vary wildly, so every field carries a confidence score and the UI
 * asks the user to confirm anything uncertain. Nothing here is authoritative —
 * it is a best-effort pre-fill for the review screen.
 */

export type Confidence = number // 0..1

/**
 * How a field's value came about. Shown in the developer panel so it is obvious
 * what the OCR actually read versus what the parser worked out or guessed.
 */
export type Source =
  /** Read straight off a labelled line, e.g. "SUMME EUR 49,80". */
  | 'gelesen'
  /** Calculated from other fields, e.g. net = gross − VAT. */
  | 'berechnet'
  /** No evidence on the receipt; a default was applied. */
  | 'geraten'
  /** Not found at all. */
  | 'fehlt'

export type ParsedField<T> = {
  value: T
  confidence: Confidence
  source: Source
  /** The receipt line the value came from, for tracing a wrong read. */
  evidence?: string
}

export type ParsedReceipt = {
  merchant: ParsedField<string>
  date: ParsedField<string> // ISO yyyy-mm-dd
  net: ParsedField<number>
  vatAmount: ParsedField<number>
  gross: ParsedField<number>
  vatRate: ParsedField<number> // 0.19 | 0.07 | 0
  category: string
  /** True when net + vat === gross, which is a strong signal the read was correct. */
  arithmeticValid: boolean
  rawText: string
  /** Step-by-step trace of what the parser did, for the developer panel. */
  trace: string[]
}

/** "1.234,56" or "1234.56" → 1234.56 */
function parseGermanAmount(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace(/[^\d.,-]/g, '')
  if (!cleaned) return null

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  let normalised: string

  if (lastComma > lastDot) {
    // German: dots group thousands, comma is the decimal separator.
    normalised = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    normalised = cleaned.replace(/,/g, '')
  } else {
    normalised = cleaned.replace(',', '.')
  }

  const n = Number.parseFloat(normalised)
  return Number.isFinite(n) ? Math.abs(n) : null
}

/**
 * Finds the amount on the line matching `label`, searching the next line as a
 * fallback. Lines matching `exclude` are skipped, which keeps "Zwischensumme"
 * from being read as the grand total.
 */
type AmountHit = { value: number; line: string } | null

function findLabelledAmount(lines: string[], label: RegExp, exclude?: RegExp): AmountHit {
  for (let i = 0; i < lines.length; i++) {
    if (!label.test(lines[i])) continue
    if (exclude?.test(lines[i])) continue

    const amounts = lines[i].match(/-?\d[\d.,]*/g)
    if (amounts?.length) {
      const parsed = parseGermanAmount(amounts[amounts.length - 1])
      if (parsed !== null && parsed > 0) return { value: parsed, line: lines[i] }
    }
    // Some layouts put the label and the figure on separate lines.
    const next = lines[i + 1]?.match(/-?\d[\d.,]*/g)
    if (next?.length) {
      const parsed = parseGermanAmount(next[next.length - 1])
      if (parsed !== null && parsed > 0) return { value: parsed, line: `${lines[i]} ⏎ ${lines[i + 1]}` }
    }
  }
  return null
}

function parseDate(text: string): ParsedField<string> {
  const today = new Date().toISOString().slice(0, 10)

  // dd.mm.yyyy / dd.mm.yy — by far the most common on German receipts.
  const dotted = text.match(/\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})\b/)
  if (dotted) {
    const day = Number(dotted[1])
    const month = Number(dotted[2])
    let year = Number(dotted[3])
    if (year < 100) year += 2000

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      return { value: iso, confidence: 0.92, source: 'gelesen', evidence: dotted[0] }
    }
  }

  // yyyy-mm-dd, as printed on some invoices.
  const isoMatch = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (isoMatch) return { value: isoMatch[0], confidence: 0.9, source: 'gelesen', evidence: isoMatch[0] }

  // Nothing date-like on the receipt — fall back to today so the field is usable.
  return { value: today, confidence: 0.2, source: 'geraten' }
}

/** Lines that are clearly not a merchant name. */
const NON_MERCHANT = /rechnung|quittung|beleg|kassenbon|datum|uhrzeit|tel|www|http|str\.|straße|filiale|vielen dank|danke/i

function parseMerchant(lines: string[]): ParsedField<string> {
  // The merchant is almost always in the first few lines, in caps or title case.
  for (const line of lines.slice(0, 6)) {
    const t = line.trim()
    if (t.length < 3 || t.length > 48) continue
    if (NON_MERCHANT.test(t)) continue
    if (/^[\d\s.,:/-]+$/.test(t)) continue // pure numbers / dates
    if (!/[A-Za-zÄÖÜäöüß]{3}/.test(t)) continue

    const cleaned = t.replace(/[*|_]+/g, '').trim()
    if (cleaned) {
      // A legal-form suffix is a strong hint we found the real name.
      const strong = /\b(GmbH|AG|KG|OHG|e\.K\.|UG|SE|mbH|Inc\.?|Ltd\.?)\b/i.test(cleaned)
      return { value: cleaned, confidence: strong ? 0.9 : 0.6, source: 'gelesen', evidence: t }
    }
  }
  return { value: '', confidence: 0, source: 'fehlt' }
}

/**
 * Guesses a tax category, for a sensible pre-selection.
 *
 * The merchant name is checked first and against the first lines only: a
 * supermarket receipt may well list an item called "Super E10", and the shop
 * decides the category, not a line item.
 */
function guessCategory(text: string, merchant: string): string {
  const head = `${merchant}\n${text.split('\n').slice(0, 4).join('\n')}`.toLowerCase()

  const byMerchant: [RegExp, string][] = [
    [/rewe|edeka|aldi|lidl|penny|kaufland|supermarkt/, 'Bewirtung'],
    [/aral|shell|esso|tankstelle|total\s|jet\b/, 'Fahrtkosten'],
    [/bahn|db\b|lufthansa|flug|hotel|booking|taxi|uber/, 'Reise'],
    [/telekom|vodafone|o2\b|mobilfunk/, 'Telekommunikation'],
    [/hetzner|adobe|microsoft|google|figma|apple|aws|github/, 'Software & Tools'],
    [/media markt|saturn|conrad|staples|bürobedarf/, 'Bürobedarf'],
    [/restaurant|café|cafe|bäckerei|gaststätte|pizzeria/, 'Bewirtung'],
  ]
  for (const [re, cat] of byMerchant) if (re.test(head)) return cat

  // Fall back to the whole text for receipts whose header did not identify the shop.
  const t = text.toLowerCase()
  if (/bewirtung|trinkgeld|speisen|getränke/.test(t)) return 'Bewirtung'
  if (/fahrkarte|ticket|bahncard/.test(t)) return 'Reise'
  if (/diesel|super e10|benzin|kraftstoff/.test(t)) return 'Fahrtkosten'
  if (/software|lizenz|abo|subscription|cloud|hosting|server/.test(t)) return 'Software & Tools'
  if (/papier|drucker|toner|ordner/.test(t)) return 'Bürobedarf'
  return 'Sonstiges'
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function parseReceipt(rawText: string): ParsedReceipt {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const merchant = parseMerchant(lines)
  const date = parseDate(rawText)

  const trace: string[] = []
  trace.push(`OCR lieferte ${lines.length} nicht-leere Zeilen (${rawText.length} Zeichen).`)
  trace.push(
    merchant.source === 'gelesen'
      ? `Händler aus Zeile erkannt: "${merchant.evidence}".`
      : 'Händler nicht erkannt — keine der ersten 6 Zeilen sah wie ein Name aus.',
  )
  trace.push(
    date.source === 'gelesen'
      ? `Datum erkannt: "${date.evidence}" → ${date.value}.`
      : 'Kein Datum gefunden — heutiges Datum eingesetzt.',
  )

  // "Zwischensumme"/"Nettosumme" are subtotals, never the amount actually paid.
  const NOT_GROSS = /zwischensumme|nettosumme|netto|mwst|ust|umsatzsteuer|steuer/i
  const grossHit = findLabelledAmount(lines, /gesamt|summe|total|zu zahlen|endbetrag|bar\b|ec[\s-]?card/i, NOT_GROSS)
  const netHit = findLabelledAmount(lines, /netto|zwischensumme|nettobetrag/i)
  const vatHit = findLabelledAmount(lines, /mwst|ust|umsatzsteuer|steuer|19\s*%|7\s*%/i)

  let gross = grossHit?.value ?? null
  let net = netHit?.value ?? null
  let vatAmount = vatHit?.value ?? null

  let grossSource: Source = grossHit ? 'gelesen' : 'fehlt'
  let netSource: Source = netHit ? 'gelesen' : 'fehlt'
  let vatSource: Source = vatHit ? 'gelesen' : 'fehlt'

  trace.push(grossHit ? `Brutto gelesen aus: "${grossHit.line}".` : 'Keine Brutto-/Summenzeile gefunden.')
  trace.push(netHit ? `Netto gelesen aus: "${netHit.line}".` : 'Keine Nettozeile gefunden.')
  trace.push(vatHit ? `MwSt.-Betrag gelesen aus: "${vatHit.line}".` : 'Keine MwSt.-Zeile gefunden.')

  // Fall back to the largest number on the receipt, which is usually the total.
  if (gross === null) {
    const all = (rawText.match(/\d[\d.,]*/g) ?? [])
      .map(parseGermanAmount)
      .filter((n): n is number => n !== null && n > 0 && n < 100000)
    if (all.length) {
      gross = Math.max(...all)
      grossSource = 'geraten'
      trace.push(`Brutto ersatzweise als größter Betrag auf dem Beleg angenommen: ${gross}.`)
    }
  }

  // Detect the rate from the printed percentage, else infer it.
  let vatRate: number | null = null
  let rateConfidence = 0.5
  let rateSource: Source = 'fehlt'
  let rateEvidence: string | undefined

  const pct19 = rawText.match(/\b19([.,]0+)?\s*%/)
  const pct7 = rawText.match(/\b7([.,]0+)?\s*%/)
  if (pct19) {
    vatRate = 0.19
    rateConfidence = 0.9
    rateSource = 'gelesen'
    rateEvidence = pct19[0]
  } else if (pct7) {
    vatRate = 0.07
    rateConfidence = 0.9
    rateSource = 'gelesen'
    rateEvidence = pct7[0]
  }
  trace.push(
    rateSource === 'gelesen'
      ? `MwSt.-Satz direkt vom Beleg gelesen: "${rateEvidence}".`
      : 'Kein Prozentsatz auf dem Beleg gefunden.',
  )

  if (vatRate === null && net !== null && vatAmount !== null && net > 0) {
    const implied = vatAmount / net
    vatRate = Math.abs(implied - 0.19) < 0.015 ? 0.19 : Math.abs(implied - 0.07) < 0.01 ? 0.07 : 0.19
    rateConfidence = 0.6
    rateSource = 'berechnet'
    trace.push(`MwSt.-Satz aus Betrag/Netto berechnet (${(implied * 100).toFixed(1)} %) → ${vatRate * 100} %.`)
  }
  if (vatRate === null) {
    vatRate = 0.19
    rateConfidence = 0.35
    rateSource = 'geraten'
    trace.push('MwSt.-Satz nicht ermittelbar — Standardsatz 19 % angenommen.')
  }

  // Derive whichever of net/vat/gross is missing.
  if (gross !== null && net === null && vatAmount !== null) {
    net = gross - vatAmount
    netSource = 'berechnet'
    trace.push('Netto berechnet als Brutto − MwSt.')
  } else if (gross !== null && net === null) {
    net = gross / (1 + vatRate)
    netSource = 'berechnet'
    trace.push(`Netto berechnet als Brutto ÷ (1 + ${vatRate}).`)
  }
  if (vatAmount === null && net !== null && gross !== null) {
    vatAmount = gross - net
    vatSource = 'berechnet'
    trace.push('MwSt. berechnet als Brutto − Netto.')
  } else if (vatAmount === null && net !== null) {
    vatAmount = net * vatRate
    vatSource = 'berechnet'
    trace.push(`MwSt. berechnet als Netto × ${vatRate}.`)
  }
  if (gross === null && net !== null && vatAmount !== null) {
    gross = net + vatAmount
    grossSource = 'berechnet'
    trace.push('Brutto berechnet als Netto + MwSt.')
  }

  net = net === null ? 0 : round2(net)
  vatAmount = vatAmount === null ? 0 : round2(vatAmount)
  gross = gross === null ? 0 : round2(gross)

  const arithmeticValid = gross > 0 && Math.abs(round2(net + vatAmount) - gross) < 0.02
  trace.push(
    arithmeticValid
      ? `Rechenprobe bestanden: ${net} + ${vatAmount} = ${gross}.`
      : `Rechenprobe fehlgeschlagen: ${net} + ${vatAmount} ≠ ${gross}. Beleg wird zur Prüfung markiert.`,
  )

  // Agreement between the three figures is the best evidence the read was right.
  const amountConfidence = arithmeticValid ? 0.94 : gross > 0 ? 0.55 : 0.1

  const category = guessCategory(rawText, merchant.value)
  trace.push(`Kategorie zugeordnet: ${category}.`)

  return {
    merchant,
    date,
    net: { value: net, confidence: amountConfidence, source: netSource, evidence: netHit?.line },
    vatAmount: { value: vatAmount, confidence: amountConfidence, source: vatSource, evidence: vatHit?.line },
    gross: {
      value: gross,
      confidence: gross > 0 ? amountConfidence : 0.1,
      source: grossSource,
      evidence: grossHit?.line,
    },
    vatRate: { value: vatRate, confidence: rateConfidence, source: rateSource, evidence: rateEvidence },
    category,
    arithmeticValid,
    rawText,
    trace,
  }
}

/** Mean confidence across the fields that matter for bookkeeping. */
export function overallConfidence(p: ParsedReceipt): number {
  return (p.merchant.confidence + p.date.confidence + p.gross.confidence + p.vatRate.confidence) / 4
}
