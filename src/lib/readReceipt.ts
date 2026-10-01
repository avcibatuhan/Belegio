import { recognise, PSM, type OcrProgress, type OcrResult, type PageMode } from './ocr'
import { recognisePaddle } from './paddle'
import { prepareImage, toOcrGray, type PreparedImage } from './preprocess'
import { parseReceipt, readQuality, type ParsedReceipt, type Verification } from './parseReceipt'

type Pass = {
  name: string
  engine: 'paddle' | 'tesseract'
  /** entzerrt: the straightened receipt; original: the file as uploaded; grau: grayscale + contrast. */
  image: 'entzerrt' | 'original' | 'grau'
  mode?: PageMode
}

/**
 * Reading strategies, best first, measured on photographed receipts.
 *
 * PaddleOCR reads photos best, and best of all on the straightened receipt.
 * Tesseract stays as an independent second opinion; it did better on the
 * photo as taken than on the straightened crop. The last pass keeps the
 * automatic layout for A4 invoices with real columns.
 */
const PASSES: Pass[] = [
  { name: 'PaddleOCR · entzerrt', engine: 'paddle', image: 'entzerrt' },
  { name: 'Tesseract · Original · PSM 6', engine: 'tesseract', image: 'original', mode: PSM.SINGLE_BLOCK },
  { name: 'Tesseract · Graustufen · PSM 6', engine: 'tesseract', image: 'grau', mode: PSM.SINGLE_BLOCK },
  { name: 'PaddleOCR · Original', engine: 'paddle', image: 'original' },
  { name: 'Tesseract · Original · PSM 3', engine: 'tesseract', image: 'original', mode: PSM.AUTO },
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
  /** Set when the pass could not run, e.g. the PaddleOCR models are missing. */
  error?: string
}

export type ReadResult = {
  parsed: ParsedReceipt
  passes: PassSummary[]
  ocrMs: number
  /** What the crop/straighten step did. */
  prepareNote: string
}

export type ReadProgress = OcrProgress & { pass: number; passes: number }

/**
 * Reads a receipt with several strategies (see PASSES) and keeps the best result.
 *
 * Stops at the first pass whose amounts are independently confirmed (read
 * net + VAT = read gross), so a clean receipt costs a single pass. Otherwise
 * every pass runs and the highest-quality read wins.
 */
export async function readReceipt(file: Blob, onProgress?: (p: ReadProgress) => void): Promise<ReadResult> {
  const start = performance.now()
  const runs: { summary: PassSummary; parsed: ParsedReceipt | null }[] = []

  let prepared: PreparedImage | null = null
  let prepareNote: string
  try {
    prepared = await prepareImage(file)
    prepareNote = prepared.note
  } catch {
    // Unusual formats the canvas cannot decode: read the original file only.
    prepareNote = 'Bild konnte nicht dekodiert werden — nur das Original wird gelesen.'
  }
  let gray: Blob | null = null

  for (let i = 0; i < PASSES.length; i++) {
    const pass =
      PASSES[i].image === 'entzerrt' && !prepared?.rectified
        ? { ...PASSES[i], name: PASSES[i].name.replace('entzerrt', 'Original') }
        : PASSES[i]
    const t0 = performance.now()
    const progress = (p: OcrProgress) => onProgress?.({ ...p, pass: i + 1, passes: PASSES.length })

    // Without a found receipt the straightened image is just the photo: no point reading it twice.
    if (pass.engine === 'paddle' && pass.image === 'original' && !prepared?.rectified) continue

    let ocr: OcrResult
    try {
      if (pass.engine === 'paddle') {
        const source = pass.image === 'entzerrt' ? prepared?.canvas : prepared?.photo
        if (!source) continue
        ocr = await recognisePaddle(await createImageBitmap(source), progress)
      } else {
        let image: Blob = file
        if (pass.image !== 'original') {
          if (!prepared) continue
          image = gray ??= await toOcrGray(prepared.photo)
        }
        ocr = await recognise(image, pass.mode ?? PSM.SINGLE_BLOCK, progress)
      }
    } catch (err) {
      runs.push({ parsed: null, summary: failed(pass.name, t0, err) })
      continue
    }

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

  const usable = runs.filter((r): r is { summary: PassSummary; parsed: ParsedReceipt } => r.parsed !== null)
  if (!usable.length) {
    throw new Error(runs.find((r) => r.summary.error)?.summary.error ?? 'Das Bild konnte nicht gelesen werden.')
  }

  const best = usable.reduce((a, b) => (b.summary.score > a.summary.score ? b : a))
  best.summary.chosen = true

  const passes = runs.map((r) => r.summary)
  best.parsed.trace.unshift(
    `Vorbereitung: ${prepareNote}`,
    ...passes.map((p, i) =>
      p.error
        ? `Durchgang ${i + 1} (${p.name}): fehlgeschlagen — ${p.error}`
        : `Durchgang ${i + 1} (${p.name}): ${p.verification}, Brutto ${p.gross}, OCR ${p.pageConfidence} %, ` +
          `Bewertung ${p.score}, ${p.ms} ms${p.chosen ? ' ← gewählt' : ''}`,
    ),
  )

  return { parsed: best.parsed, passes, ocrMs: Math.round(performance.now() - start), prepareNote }
}

function failed(name: string, t0: number, err: unknown): PassSummary {
  return {
    name,
    verification: 'keine',
    gross: 0,
    pageConfidence: 0,
    score: 0,
    ms: Math.round(performance.now() - t0),
    chosen: false,
    error: err instanceof Error ? err.message : String(err),
  }
}
