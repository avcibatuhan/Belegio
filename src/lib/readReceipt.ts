import { recognise, PSM, type OcrProgress, type PageMode } from './ocr'
import { preprocessForOcr } from './preprocess'
import { parseReceipt, readQuality, type ParsedReceipt, type Verification } from './parseReceipt'

type Pass = { name: string; image: 'vorverarbeitet' | 'original'; mode: PageMode }

/**
 * Reading strategies, best first, from measurements on photographed receipts.
 * The last one keeps the old automatic layout for A4 invoices with real columns.
 */
const PASSES: Pass[] = [
  { name: 'Vorverarbeitet · PSM 6', image: 'vorverarbeitet', mode: PSM.SINGLE_BLOCK },
  { name: 'Original · PSM 6', image: 'original', mode: PSM.SINGLE_BLOCK },
  { name: 'Original · PSM 3', image: 'original', mode: PSM.AUTO },
]

export type PassSummary = {
  name: string
  verification: Verification
  gross: number
  /** Tesseract's page confidence, 0..100. */
  pageConfidence: number
  score: number
  ms: number
  chosen: boolean
}

export type ReadResult = {
  parsed: ParsedReceipt
  passes: PassSummary[]
  ocrMs: number
}

export type ReadProgress = OcrProgress & { pass: number; passes: number }

/**
 * Reads a receipt with up to three strategies and keeps the best result.
 *
 * Stops at the first pass whose amounts are independently confirmed (read
 * net + VAT = read gross), so a clean receipt costs a single pass. Otherwise
 * every pass runs and the highest-quality read wins.
 */
export async function readReceipt(file: Blob, onProgress?: (p: ReadProgress) => void): Promise<ReadResult> {
  const start = performance.now()
  let cleaned: Blob | null = null
  const runs: { summary: PassSummary; parsed: ParsedReceipt }[] = []

  for (let i = 0; i < PASSES.length; i++) {
    const pass = PASSES[i]
    const t0 = performance.now()

    let image: Blob = file
    if (pass.image === 'vorverarbeitet') {
      try {
        cleaned ??= await preprocessForOcr(file)
        image = cleaned
      } catch {
        // Unusual formats the canvas cannot decode: skip straight to the original.
        continue
      }
    }

    const ocr = await recognise(image, pass.mode, (p) =>
      onProgress?.({ ...p, pass: i + 1, passes: PASSES.length }),
    )
    const parsed = parseReceipt(ocr.text, ocr.lines)
    runs.push({
      parsed,
      summary: {
        name: pass.name,
        verification: parsed.verification,
        gross: parsed.gross.value,
        pageConfidence: Math.round(ocr.confidence),
        score: Math.round(readQuality(parsed, ocr.confidence)),
        ms: Math.round(performance.now() - t0),
        chosen: false,
      },
    })

    if (parsed.verification === 'bestaetigt') break
  }

  if (!runs.length) throw new Error('Das Bild konnte nicht gelesen werden.')

  const best = runs.reduce((a, b) => (b.summary.score > a.summary.score ? b : a))
  best.summary.chosen = true

  const passes = runs.map((r) => r.summary)
  best.parsed.trace.unshift(
    ...passes.map(
      (p, i) =>
        `Durchgang ${i + 1} (${p.name}): ${p.verification}, Brutto ${p.gross}, OCR ${p.pageConfidence} %, ` +
        `Bewertung ${p.score}, ${p.ms} ms${p.chosen ? ' ← gewählt' : ''}`,
    ),
  )

  return { parsed: best.parsed, passes, ocrMs: Math.round(performance.now() - start) }
}
