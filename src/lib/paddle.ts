import type { OcrProgress, OcrResult } from './ocr'
import type { WorkerRequest, WorkerResponse } from './paddleWorker'

/**
 * PaddleOCR (PP-OCRv5), the deep-learning OCR engine. Reads phone photos
 * markedly better than Tesseract; runs in its own worker (paddleWorker.ts).
 *
 * The models (~13 MB) are served by the app from /models/paddle/, fetched by
 * scripts/fetch-models.mjs, and downloaded by the browser once per device.
 */

const base = import.meta.env.BASE_URL
const MODELS = {
  det: `${base}models/paddle/det.onnx`,
  rec: `${base}models/paddle/rec.onnx`,
  dict: `${base}models/paddle/dict.txt`,
}

let worker: Worker | null = null
let nextId = 1

function getWorker(): Worker {
  worker ??= new Worker(new URL('./paddleWorker.ts', import.meta.url), { type: 'module' })
  return worker
}

/**
 * Reads an image with PaddleOCR. Calls must not overlap.
 * Returns the same shape as Tesseract's `recognise`, so the parser treats both alike.
 */
export function recognisePaddle(image: ImageBitmap, onProgress?: (p: OcrProgress) => void): Promise<OcrResult> {
  const w = getWorker()
  const id = nextId++
  return new Promise((resolve, reject) => {
    const onMessage = (ev: MessageEvent<WorkerResponse>) => {
      const m = ev.data
      if (m.id !== id) return
      if (m.type === 'progress') return onProgress?.({ phase: m.phase, progress: m.progress })
      w.removeEventListener('message', onMessage)
      w.removeEventListener('error', onError)
      if (m.type === 'done') resolve({ text: m.result.text, lines: m.result.lines, confidence: m.result.confidence })
      else reject(new Error(m.message))
    }
    const onError = (ev: ErrorEvent) => {
      w.removeEventListener('message', onMessage)
      w.removeEventListener('error', onError)
      // A worker that failed to start is useless; build a fresh one next time.
      worker?.terminate()
      worker = null
      reject(new Error(ev.message || 'PaddleOCR-Worker konnte nicht gestartet werden.'))
    }
    w.addEventListener('message', onMessage)
    w.addEventListener('error', onError)
    const req: WorkerRequest = { id, type: 'read', image, models: MODELS }
    w.postMessage(req, [image])
  })
}
