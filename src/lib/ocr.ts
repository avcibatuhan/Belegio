import { createWorker, type Worker } from 'tesseract.js'

/** Progress reported while the language model downloads and the page is read. */
export type OcrProgress = {
  /** 'laden' while fetching the model, 'lesen' while recognising. */
  phase: 'laden' | 'lesen'
  /** 0..1 */
  progress: number
}

let workerPromise: Promise<Worker> | null = null

/**
 * Tesseract worker, created once and reused.
 *
 * The German traineddata (~15 MB) is fetched on first use and then cached by
 * the browser, so subsequent receipts start immediately.
 */
async function getWorker(onProgress?: (p: OcrProgress) => void): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('deu', 1, {
      logger: (m: { status: string; progress: number }) => {
        if (!onProgress) return
        if (m.status === 'recognizing text') {
          onProgress({ phase: 'lesen', progress: m.progress })
        } else if (m.status.includes('loading') || m.status.includes('initializ')) {
          onProgress({ phase: 'laden', progress: m.progress })
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

/** Runs OCR over an image file and returns the raw recognised text. */
export async function recognise(file: File, onProgress?: (p: OcrProgress) => void): Promise<string> {
  const worker = await getWorker(onProgress)
  const { data } = await worker.recognize(file)
  return data.text
}

/** Releases the worker and its WASM memory. */
export async function terminateOcr(): Promise<void> {
  if (!workerPromise) return
  const worker = await workerPromise.catch(() => null)
  workerPromise = null
  await worker?.terminate()
}
