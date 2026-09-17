/**
 * Extracts the tax-relevant fields from the raw OCR text of a German receipt.
 *
 * Receipts vary wildly, so every field carries a confidence score and the UI
 * asks the user to confirm anything uncertain. Nothing here is authoritative —
 * it is a best-effort pre-fill for the review screen.
 */

export type Confidence = number // 0..1

export type ParsedField<T> = {
  value: T
  confidence: Confidence
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
function findLabelledAmount(lines: string[], label: RegExp, exclude?: RegExp): number | null {
  for (let i = 0; i < lines.length; i++) {
    if (!label.test(lines[i])) continue
    if (exclude?.test(lines[i])) continue

    const amounts = lines[i].match(/-?\d[\d.,]*/g)
    if (amounts?.length) {
      const parsed = parseGermanAmount(amounts[amounts.length - 1])
      if (parsed !== null && parsed > 0) return parsed
    }
    // Some layouts put the label and the figure on separate lines.
    const next = lines[i + 1]?.match(/-?\d[\d.,]*/g)
    if (next?.length) {
      const parsed = parseGermanAmount(next[next.length - 1])
      if (parsed !== null && parsed > 0) return parsed
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
      return { value: iso, confidence: 0.92 }
    }
  }

  // yyyy-mm-dd, as printed on some invoices.
  const isoMatch = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (isoMatch) return { value: isoMatch[0], confidence: 0.9 }

  return { value: today, confidence: 0.2 }
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
      return { value: cleaned, confidence: strong ? 0.9 : 0.6 }
    }
  }
  return { value: '', confidence: 0 }
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

  // "Zwischensumme"/"Nettosumme" are subtotals, never the amount actually paid.
  const NOT_GROSS = /zwischensumme|nettosumme|netto|mwst|ust|umsatzsteuer|steuer/i
  let gross = findLabelledAmount(lines, /gesamt|summe|total|zu zahlen|endbetrag|bar\b|ec[\s-]?card/i, NOT_GROSS)
  let net = findLabelledAmount(lines, /netto|zwischensumme|nettobetrag/i)
  let vatAmount = findLabelledAmount(lines, /mwst|ust|umsatzsteuer|steuer|19\s*%|7\s*%/i)

  // Fall back to the largest number on the receipt, which is usually the total.
  if (gross === null) {
    const all = (rawText.match(/\d[\d.,]*/g) ?? [])
      .map(parseGermanAmount)
      .filter((n): n is number => n !== null && n > 0 && n < 100000)
    if (all.length) gross = Math.max(...all)
  }

  // Detect the rate from the printed percentage, else infer it.
  let vatRate: number | null = null
  let rateConfidence = 0.5
  if (/\b19([.,]0+)?\s*%/.test(rawText)) {
    vatRate = 0.19
    rateConfidence = 0.9
  } else if (/\b7([.,]0+)?\s*%/.test(rawText)) {
    vatRate = 0.07
    rateConfidence = 0.9
  }

  if (vatRate === null && net !== null && vatAmount !== null && net > 0) {
    const implied = vatAmount / net
    vatRate = Math.abs(implied - 0.19) < 0.015 ? 0.19 : Math.abs(implied - 0.07) < 0.01 ? 0.07 : 0.19
    rateConfidence = 0.6
  }
  if (vatRate === null) {
    vatRate = 0.19
    rateConfidence = 0.35
  }

  // Derive whichever of net/vat/gross is missing.
  if (gross !== null && net === null && vatAmount !== null) net = gross - vatAmount
  if (gross !== null && net === null) net = gross / (1 + vatRate)
  if (net !== null && vatAmount === null && gross !== null) vatAmount = gross - net
  if (net !== null && vatAmount === null) vatAmount = net * vatRate
  if (gross === null && net !== null && vatAmount !== null) gross = net + vatAmount

  net = net === null ? 0 : round2(net)
  vatAmount = vatAmount === null ? 0 : round2(vatAmount)
  gross = gross === null ? 0 : round2(gross)

  const arithmeticValid = gross > 0 && Math.abs(round2(net + vatAmount) - gross) < 0.02

  // Agreement between the three figures is the best evidence the read was right.
  const amountConfidence = arithmeticValid ? 0.94 : gross > 0 ? 0.55 : 0.1

  return {
    merchant,
    date,
    net: { value: net, confidence: amountConfidence },
    vatAmount: { value: vatAmount, confidence: amountConfidence },
    gross: { value: gross, confidence: gross > 0 ? amountConfidence : 0.1 },
    vatRate: { value: vatRate, confidence: rateConfidence },
    category: guessCategory(rawText, merchant.value),
    arithmeticValid,
    rawText,
  }
}

/** Mean confidence across the fields that matter for bookkeeping. */
export function overallConfidence(p: ParsedReceipt): number {
  return (p.merchant.confidence + p.date.confidence + p.gross.confidence + p.vatRate.confidence) / 4
}
