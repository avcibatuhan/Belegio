import { createWorker, PSM, type Worker } from 'tesseract.js'
import type { OcrLine } from './parseReceipt'

/** Progress reported while the language model downloads and the page is read. */
export type OcrProgress = {
  /** 'laden' while fetching the model, 'lesen' while recognising. */
  phase: 'laden' | 'lesen'
  /** 0..1 */
  progress: number
}

/**
 * Page segmentation mode: how Tesseract assumes the page is laid out.
 *
 * - SINGLE_BLOCK (6): one uniform block, read line by line. Fits receipts,
 *   which are a single column, and keeps "SUMME EUR … 49,80" on one line.
 * - AUTO (3): looks for columns and blocks. Better for A4 invoices with a
 *   real multi-column layout, worse for tilted receipt photos, where it splits
 *   labels from their amounts.
 */
export type PageMode = PSM.SINGLE_BLOCK | PSM.AUTO
export { PSM }

export type OcrResult = {
  text: string
  lines: OcrLine[]
  /** Tesseract's mean confidence for the page, 0..100. */
  confidence: number
}

let workerPromise: Promise<Worker> | null = null

/**
 * The logger is fixed when the worker is created, so it must not close over
 * one caller's callback: it forwards to whichever job is running now.
 * (Capturing the first caller sent every later job's progress to the first
 * job's row.)
 */
let currentProgress: ((p: OcrProgress) => void) | undefined

/**
 * Tesseract worker, created once and reused.
 *
 * The German model (~2 MB) is fetched on first use and then cached by the
 * browser, so subsequent receipts start immediately.
 */
function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('deu', 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') {
          currentProgress?.({ phase: 'lesen', progress: m.progress })
        } else if (m.status.includes('loading') || m.status.includes('initializ')) {
          currentProgress?.({ phase: 'laden', progress: m.progress })
        }
      },
    }).catch((err) => {
      // Let the next attempt rebuild the worker instead of caching the failure.
      workerPromise = null
      throw err
    })
  }
  return workerPromise
}

/**
 * Runs OCR and returns the text together with its line and word layout.
 * Calls must not overlap: the worker handles one image at a time.
 */
export async function recognise(
  image: Blob,
  mode: PageMode,
  onProgress?: (p: OcrProgress) => void,
): Promise<OcrResult> {
  currentProgress = onProgress
  try {
    const worker = await getWorker()
    await worker.setParameters({
      tessedit_pageseg_mode: mode,
      // Keep the gap between a label and its amount, so the line reads as it looks.
      preserve_interword_spaces: '1',
    })
    const { data } = await worker.recognize(image, {}, { text: true, blocks: true })

    const lines: OcrLine[] = (data.blocks ?? []).flatMap((block) =>
      block.paragraphs.flatMap((para) =>
        para.lines.map((line) => ({
          text: line.text.replace(/\n$/, ''),
          bbox: line.bbox,
          baseline: line.baseline,
          words: line.words.map((w) => ({ text: w.text, confidence: w.confidence, bbox: w.bbox })),
        })),
      ),
    )
    return { text: data.text, lines, confidence: data.confidence }
  } finally {
    currentProgress = undefined
  }
}

/** Releases the worker and its WASM memory. */
export async function terminateOcr(): Promise<void> {
  if (!workerPromise) return
  const worker = await workerPromise.catch(() => null)
  workerPromise = null
  await worker?.terminate()
}
