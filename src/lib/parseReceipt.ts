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
  /** Tesseract's own confidence in the word the value was read from (0..1). */
  ocrConfidence?: number
}

/**
 * Whether the amounts back each other up.
 *
 * Only figures that were actually read off the receipt count as evidence: a
 * value the parser calculated from another value always "agrees" with it, so
 * it proves nothing.
 */
export type Verification =
  /** Independently read amounts agree (net + VAT = gross, or VAT matches the printed rate). */
  | 'bestaetigt'
  /** Amounts are consistent only because some were calculated from others. */
  | 'abgeleitet'
  /** Read amounts contradict each other. */
  | 'widerspruch'
  /** No usable total. */
  | 'keine'

export type ParsedReceipt = {
  merchant: ParsedField<string>
  date: ParsedField<string> // ISO yyyy-mm-dd
  net: ParsedField<number>
  vatAmount: ParsedField<number>
  gross: ParsedField<number>
  vatRate: ParsedField<number> // 0.19 | 0.07 | 0
  category: string
  verification: Verification
  /** True only when verification is 'bestaetigt'. Drives automatic approval. */
  arithmeticValid: boolean
  rawText: string
  /** Step-by-step trace of what the parser did, for the developer panel. */
  trace: string[]
}

// ─── OCR layout input ─────────────────────────────────────────────────────

export type Bbox = { x0: number; y0: number; x1: number; y1: number }
export type OcrWord = { text: string; confidence: number; bbox: Bbox }
/** One text line as Tesseract found it, with word positions and the baseline tilt. */
export type OcrLine = { text: string; words: OcrWord[]; bbox: Bbox; baseline?: Bbox }

type Line = { text: string; words: OcrWord[]; bbox?: Bbox; slope: number }

// ─── Digit correction ─────────────────────────────────────────────────────

/** Letters OCR commonly returns in place of digits. */
const CONFUSABLE: Record<string, string> = {
  O: '0', o: '0', Q: '0', D: '0', S: '5', s: '5', I: '1', l: '1', '|': '1', B: '8',
}
const C = '[\\dOoQDSsIl|B]'
/** Amount-shaped token, e.g. "4S,8O" or "l.469,l3". Bounded so words like "SUMME" never match. */
const AMOUNT_LIKE = new RegExp(`(?<![\\p{L}\\d])${C}{1,6}(?:[.,]${C}{3})*[.,]${C}{2}(?![\\p{L}\\d])`, 'gu')
/** Date-shaped token, e.g. "12.O9.2026". */
const DATE_LIKE = /(?<![\p{L}\d])[\dOoIl]{1,2}[.\-/][\dOoIl]{1,2}[.\-/][\dOoIl]{2,4}(?![\p{L}\d])/gu

/**
 * Replaces look-alike letters inside amount- and date-shaped tokens only.
 * A token must already contain at least one real digit, so ordinary words are
 * never rewritten.
 */
export function fixDigits(text: string): { text: string; fixes: string[] } {
  const fixes: string[] = []
  // "49, 80" → "49,80": OCR sometimes inserts a space after the separator.
  let out = text.replace(/(\d)([.,])\s+(\d{2})(?!\d)/g, (m, a, sep, b) => {
    fixes.push(`"${m}" → "${a}${sep}${b}"`)
    return `${a}${sep}${b}`
  })
  const repair = (token: string) => {
    if (!/\d/.test(token) || !/[^\d.,\-/]/.test(token)) return token
    const fixed = token.replace(/[OoQDSsIl|B]/g, (ch) => CONFUSABLE[ch])
    fixes.push(`"${token}" → "${fixed}"`)
    return fixed
  }
  out = out.replace(AMOUNT_LIKE, repair).replace(DATE_LIKE, repair)
  return { text: out, fixes }
}

// ─── Amounts ──────────────────────────────────────────────────────────────

/**
 * A money amount: two decimals, optional thousands groups.
 * The look-arounds stop a date like "12.09.2026" from being read as 12,09.
 */
const MONEY = /(?<![\d.,])\d+(?:[.,]\d{3})*[.,]\d{2}(?!\d|[.,]\d)/g

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

const centerY = (b: Bbox) => (b.y0 + b.y1) / 2

/** Tesseract's confidence for the word containing `token`, as 0..1. */
function wordConfidence(line: Line, token: string): number | undefined {
  const word = line.words.find((w) => fixDigits(w.text).text.includes(token))
  return word ? word.confidence / 100 : undefined
}

type AmountHit = { value: number; line: string; ocrConfidence?: number; how: string }

/**
 * Amounts on lines matching `label`, in reading order.
 *
 * Lines matching `exclude` are skipped, which keeps "Zwischensumme" from being
 * read as the grand total. When a label line carries no amount, two fallbacks
 * are tried: a word on the same visual row found by its position (Tesseract
 * sometimes splits a row in two), then the next text line.
 */
function findLabelledAmounts(lines: Line[], label: RegExp, exclude?: RegExp): AmountHit[] {
  const hits: AmountHit[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!label.test(line.text) || exclude?.test(line.text)) continue

    const amounts = line.text.match(MONEY)
    if (amounts?.length) {
      const token = amounts[amounts.length - 1]
      const value = parseGermanAmount(token)
      if (value !== null && value > 0) {
        hits.push({ value, line: line.text, ocrConfidence: wordConfidence(line, token), how: 'Zeile' })
        continue
      }
    }

    const geo = sameRowAmount(lines, i)
    if (geo) {
      hits.push(geo)
      continue
    }

    const next = lines[i + 1]
    const nextAmounts = next?.text.match(MONEY)
    if (next && nextAmounts?.length) {
      const token = nextAmounts[nextAmounts.length - 1]
      const value = parseGermanAmount(token)
      if (value !== null && value > 0) {
        hits.push({
          value,
          line: `${line.text} ⏎ ${next.text}`,
          ocrConfidence: wordConfidence(next, token),
          how: 'Folgezeile',
        })
      }
    }
  }
  return hits
}

/**
 * Finds an amount to the right of line `i` on the same visual row, following
 * the tilt of the line's baseline. Needs word positions from the OCR layout.
 */
function sameRowAmount(lines: Line[], i: number): AmountHit | null {
  const label = lines[i]
  if (!label.bbox) return null

  const height = label.bbox.y1 - label.bbox.y0
  const cy = centerY(label.bbox)
  let best: { word: OcrWord; line: Line; off: number } | null = null

  for (const other of lines) {
    if (other === label) continue
    for (const word of other.words) {
      const fixed = fixDigits(word.text).text
      if (!fixed.match(MONEY) || word.bbox.x0 < label.bbox.x1) continue
      const dx = (word.bbox.x0 + word.bbox.x1) / 2 - (label.bbox.x0 + label.bbox.x1) / 2
      const off = Math.abs(centerY(word.bbox) - (cy + label.slope * dx))
      if (off < height * 0.6 && (!best || off < best.off)) best = { word, line: other, off }
    }
  }
  if (!best) return null

  const token = fixDigits(best.word.text).text.match(MONEY)![0]
  const value = parseGermanAmount(token)
  if (value === null || value <= 0) return null
  return {
    value,
    line: `${label.text} ⟶ ${best.word.text}`,
    ocrConfidence: best.word.confidence / 100,
    how: 'Position',
  }
}

// ─── Date, merchant, category ─────────────────────────────────────────────

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

/**
 * Lines that are clearly not a merchant name. "tel" is word-bounded: as a bare
 * substring it rejected "Tankstelle" and "Hotel".
 */
const NON_MERCHANT = /rechnung|quittung|beleg|kassenbon|datum|uhrzeit|\btel\b|telefon|www|http|str\.|straße|filiale|vielen dank|danke/i

function parseMerchant(lines: Line[]): ParsedField<string> {
  // The merchant is almost always in the first few lines, in caps or title case.
  for (const line of lines.slice(0, 6)) {
    const t = line.text.trim()
    if (t.length < 3 || t.length > 48) continue
    if (NON_MERCHANT.test(t)) continue
    if (/^[\d\s.,:/-]+$/.test(t)) continue // pure numbers / dates
    if (t.match(MONEY)) continue // an item or total line, not a shop name
    if (!/[A-Za-zÄÖÜäöüß]{3}/.test(t)) continue

    // Drop specks read as a lone letter before a wide gap: "A      ARAL Tankstelle".
    const cleaned = t.replace(/[*|_]+/g, '').replace(/^(\S\s{2,})+/, '').trim()
    if (cleaned) {
      // A legal-form suffix is a strong hint we found the real name.
      const strong = /\b(GmbH|AG|KG|OHG|e\.K\.|UG|SE|mbH|Inc\.?|Ltd\.?)\b/i.test(cleaned)
      const words = line.words.filter((w) => w.text.trim())
      const ocrConfidence = words.length
        ? words.reduce((s, w) => s + w.confidence, 0) / words.length / 100
        : undefined
      return { value: cleaned, confidence: strong ? 0.9 : 0.6, source: 'gelesen', evidence: t, ocrConfidence }
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

// ─── Labels ───────────────────────────────────────────────────────────────

/**
 * Subtotals and tax lines are never the amount paid. The patterns tolerate
 * typical OCR damage: "Zuischensumme", "Zw.-Summe", "MaSt" for "MwSt".
 */
const SUBTOTAL = /z\S{0,2}ischen|zw\.?\s*-?\s*s[uv]m|ischen\s*-?\s*s[uv]m|sub\s*-?\s*total/i
const TAX = /m\Sst\b|\bust\b|umsatzsteuer|steuer/i
/** Cash handed over and change returned are not the total either. */
const TENDER = /gegeben|r[uü]ckgeld|zur[uü]ck/i

/** "Steuer-Nr. 12/345/67890", "USt-IdNr." — identifiers, not tax amounts. */
const TAX_ID = /steuer\s*-?\s*(nr|nummer)|st\.?\s*-?\s*nr|ust\s*-?\s*id/i

const GROSS_LABEL = /gesamt|summe|total|zu\s*zahlen|endbetrag|bar\b|ec[\s-]?card/i
/** Tolerates a damaged first letter: OCR has returned "uetto" for "Netto". */
const NET_LABEL = /\b\S?etto\b|nettobetrag/i
const VAT_LABEL = /m\Sst\b|\bust\b|umsatzsteuer|steuer|19\s*%|7\s*%/i

/** A tax word only disqualifies a total line when it is not "inkl. MwSt.". */
const GROSS_EXCLUDE = new RegExp(
  `${SUBTOTAL.source}|${NET_LABEL.source}|${TENDER.source}|(?<!inkl\\.?\\s{0,3})(?:${TAX.source})`,
  'i',
)
/** "Netto 7 %" and "Gesamt inkl. MwSt." mention tax but carry other amounts. */
const VAT_EXCLUDE = new RegExp(`${SUBTOTAL.source}|${NET_LABEL.source}|${TAX_ID.source}|inkl`, 'i')

/** Below this, Tesseract's own confidence in a word is treated as unreliable. */
const WEAK_WORD = 0.7

// ─── Main ─────────────────────────────────────────────────────────────────

/**
 * @param rawText Text from the OCR.
 * @param layout  Optional line and word layout from the OCR. When present it
 *                enables word confidences and the position-based fallback.
 */
export function parseReceipt(rawText: string, layout?: OcrLine[]): ParsedReceipt {
  const trace: string[] = []
  const fixes: string[] = []

  const source: Line[] = layout?.length
    ? layout.map((l) => ({
        text: l.text.trim(),
        words: l.words,
        bbox: l.bbox,
        slope: l.baseline && l.baseline.x1 !== l.baseline.x0
          ? (l.baseline.y1 - l.baseline.y0) / (l.baseline.x1 - l.baseline.x0)
          : 0,
      }))
    : rawText.split('\n').map((t) => ({ text: t.trim(), words: [], slope: 0 }))

  const lines: Line[] = source
    .map((l) => {
      const fixed = fixDigits(l.text)
      fixes.push(...fixed.fixes)
      return { ...l, text: fixed.text }
    })
    .filter((l) => l.text)
  const text = lines.map((l) => l.text).join('\n')

  trace.push(
    `OCR lieferte ${lines.length} nicht-leere Zeilen (${rawText.length} Zeichen)` +
      (layout?.length ? ', mit Wortpositionen.' : '.'),
  )
  if (fixes.length) trace.push(`Ziffernkorrektur: ${fixes.join(', ')}.`)

  const merchant = parseMerchant(lines)
  const date = parseDate(text)

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

  const netHit = findLabelledAmounts(lines, NET_LABEL)[0] ?? null
  const vatHit = findLabelledAmounts(lines, VAT_LABEL, VAT_EXCLUDE)[0] ?? null
  const grossHits = findLabelledAmounts(lines, GROSS_LABEL, GROSS_EXCLUDE)

  // The total can never be smaller than the net amount or the tax on it.
  const floor = Math.max(netHit?.value ?? 0, vatHit?.value ?? 0)
  const grossHit = grossHits.find((h) => h.value >= floor) ?? null
  const rejected = grossHits.filter((h) => h.value < floor)
  if (rejected.length) {
    trace.push(
      `Verworfen als Brutto (kleiner als Netto/MwSt.): ${rejected.map((h) => `"${h.line}"`).join(', ')}.`,
    )
  }

  let gross = grossHit?.value ?? null
  let net = netHit?.value ?? null
  let vatAmount = vatHit?.value ?? null

  let grossSource: Source = grossHit ? 'gelesen' : 'fehlt'
  let netSource: Source = netHit ? 'gelesen' : 'fehlt'
  let vatSource: Source = vatHit ? 'gelesen' : 'fehlt'

  const describe = (hit: AmountHit) =>
    `"${hit.line}"` +
    (hit.how !== 'Zeile' ? ` [${hit.how}]` : '') +
    (hit.ocrConfidence !== undefined ? ` (OCR ${Math.round(hit.ocrConfidence * 100)} %)` : '')
  trace.push(grossHit ? `Brutto gelesen aus: ${describe(grossHit)}.` : 'Keine Brutto-/Summenzeile gefunden.')
  trace.push(netHit ? `Netto gelesen aus: ${describe(netHit)}.` : 'Keine Nettozeile gefunden.')
  trace.push(vatHit ? `MwSt.-Betrag gelesen aus: ${describe(vatHit)}.` : 'Keine MwSt.-Zeile gefunden.')

  // Fall back to the largest money amount on the receipt, which is usually the total.
  if (gross === null) {
    const all = (text.match(MONEY) ?? [])
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

  const pct19 = text.match(/\b19([.,]0+)?\s*%/)
  const pct7 = text.match(/\b7([.,]0+)?\s*%/)
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

  // ─── Verification: only independently read figures count ──────────────
  const allRead = netSource === 'gelesen' && vatSource === 'gelesen' && grossSource === 'gelesen'
  const sumMatches = allRead && Math.abs(round2(net + vatAmount) - gross) < 0.02
  const rateMatches =
    vatSource === 'gelesen' &&
    grossSource === 'gelesen' &&
    rateSource === 'gelesen' &&
    Math.abs((gross * vatRate) / (1 + vatRate) - vatAmount) < 0.02
  const sane = gross >= net && gross >= vatAmount

  const verification: Verification =
    gross <= 0
      ? 'keine'
      : sane && (sumMatches || rateMatches)
        ? 'bestaetigt'
        : !sane || (allRead && !sumMatches)
          ? 'widerspruch'
          : 'abgeleitet'

  trace.push(
    verification === 'bestaetigt'
      ? sumMatches
        ? `Rechenprobe bestanden mit gelesenen Werten: ${net} + ${vatAmount} = ${gross}.`
        : `Rechenprobe bestanden: MwSt. ${vatAmount} passt zu Brutto ${gross} bei ${vatRate * 100} %.`
      : verification === 'abgeleitet'
        ? 'Keine echte Rechenprobe möglich — mindestens ein Betrag wurde berechnet, nicht gelesen. Beleg wird zur Prüfung markiert.'
        : verification === 'widerspruch'
          ? `Gelesene Beträge widersprechen sich: ${net} + ${vatAmount} ≠ ${gross}. Beleg wird zur Prüfung markiert.`
          : 'Kein verwertbarer Gesamtbetrag gefunden.',
  )

  // Agreement between independently read figures is the best evidence the read was right.
  const base =
    verification === 'bestaetigt' ? 0.94 : verification === 'abgeleitet' ? 0.6 : verification === 'widerspruch' ? 0.4 : 0.1

  /** Unverified amounts can be no more trusted than the OCR's own reading of them. */
  const amountConfidence = (ocr?: number) =>
    verification === 'bestaetigt' || ocr === undefined ? base : Math.min(base, ocr)

  for (const [name, hit] of [['Brutto', grossHit], ['Netto', netHit], ['MwSt.', vatHit]] as const) {
    if (hit?.ocrConfidence !== undefined && hit.ocrConfidence < WEAK_WORD) {
      trace.push(`Unsicher gelesen: ${name} "${hit.line}" (OCR ${Math.round(hit.ocrConfidence * 100)} %).`)
    }
  }

  const category = guessCategory(text, merchant.value)
  trace.push(`Kategorie zugeordnet: ${category}.`)

  return {
    merchant,
    date,
    net: {
      value: net,
      confidence: amountConfidence(netHit?.ocrConfidence),
      source: netSource,
      evidence: netHit?.line,
      ocrConfidence: netHit?.ocrConfidence,
    },
    vatAmount: {
      value: vatAmount,
      confidence: amountConfidence(vatHit?.ocrConfidence),
      source: vatSource,
      evidence: vatHit?.line,
      ocrConfidence: vatHit?.ocrConfidence,
    },
    gross: {
      value: gross,
      confidence: gross > 0 ? amountConfidence(grossHit?.ocrConfidence) : 0.1,
      source: grossSource,
      evidence: grossHit?.line,
      ocrConfidence: grossHit?.ocrConfidence,
    },
    vatRate: { value: vatRate, confidence: rateConfidence, source: rateSource, evidence: rateEvidence },
    category,
    verification,
    arithmeticValid: verification === 'bestaetigt',
    rawText,
    trace,
  }
}

/** Mean confidence across the fields that matter for bookkeeping. */
export function overallConfidence(p: ParsedReceipt): number {
  return (p.merchant.confidence + p.date.confidence + p.gross.confidence + p.vatRate.confidence) / 4
}

/**
 * Ranks competing reads of the same receipt (see readReceipt.ts).
 * Verified amounts dominate; then how many fields were genuinely read.
 */
export function readQuality(p: ParsedReceipt, pageConfidence: number): number {
  const read = [p.merchant, p.date, p.net, p.vatAmount, p.gross, p.vatRate].filter(
    (f) => f.source === 'gelesen',
  ).length
  const verdict =
    p.verification === 'bestaetigt' ? 1000 : p.verification === 'abgeleitet' ? 0 : p.verification === 'widerspruch' ? -300 : -600
  return verdict + read * 50 + pageConfidence
}
