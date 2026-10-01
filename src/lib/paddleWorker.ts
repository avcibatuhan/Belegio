/// <reference lib="webworker" />
/**
 * PaddleOCR in a Web Worker, so reading never freezes the page.
 *
 * Two small neural networks run through ONNX Runtime (WebAssembly):
 *   1. the detector marks where text lines are (a probability map),
 *   2. the recogniser reads each line crop into characters.
 * Everything runs locally; the models are served by the app itself.
 */
import * as ort from 'onnxruntime-web/wasm'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import { boxesFromProbMap, ctcDecode, groupIntoLines, type ReadBox } from './textBoxes'

ort.env.wasm.wasmPaths = { wasm: wasmUrl }
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1

/** Detector input size. Large enough that receipt text stays ~20 px tall. */
const DET_LONG_SIDE = 1600
const DET_MAX_UPSCALE = 2
/** The PP-OCRv5 recogniser reads crops 48 px tall. */
const REC_HEIGHT = 48
/** Narrow crops are padded to this width, as in PaddleOCR. */
const REC_MIN_WIDTH = 320

export type WorkerRequest =
  | { id: number; type: 'read'; image: ImageBitmap; models: { det: string; rec: string; dict: string } }
export type WorkerResponse =
  | { id: number; type: 'progress'; phase: 'laden' | 'lesen'; progress: number }
  | { id: number; type: 'done'; result: { text: string; lines: ReturnType<typeof groupIntoLines>; confidence: number; boxes: number } }
  | { id: number; type: 'error'; message: string }

type Engine = { det: ort.InferenceSession; rec: ort.InferenceSession; chars: string[] }
let engine: Promise<Engine> | null = null

async function fetchWithProgress(url: string, onBytes: (n: number) => void): Promise<Uint8Array> {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`Modell konnte nicht geladen werden: ${url} (HTTP ${res.status})`)
  const reader = res.body.getReader()
  const parts: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value)
    size += value.length
    onBytes(value.length)
  }
  const out = new Uint8Array(size)
  let off = 0
  for (const p of parts) out.set(p, off), (off += p.length)
  return out
}

function load(models: { det: string; rec: string; dict: string }, report: (p: number) => void): Promise<Engine> {
  engine ??= (async () => {
    const TOTAL = 12.7e6 // approximate download size, for the progress bar only
    let loaded = 0
    const tick = (n: number) => report(Math.min((loaded += n) / TOTAL, 0.99))
    const [detBytes, recBytes, dictText] = await Promise.all([
      fetchWithProgress(models.det, tick),
      fetchWithProgress(models.rec, tick),
      fetch(models.dict).then((r) => r.text()),
    ])
    const options: ort.InferenceSession.SessionOptions = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }
    const det = await ort.InferenceSession.create(detBytes, options)
    const rec = await ort.InferenceSession.create(recBytes, options)
    const dict = dictText.split('\n')
    if (dict[dict.length - 1] === '') dict.pop()
    // Class 0 is the CTC blank; the model appends a space as the last class.
    return { det, rec, chars: ['', ...dict, ' '] }
  })().catch((err) => {
    engine = null
    throw err
  })
  return engine
}

/** Canvas pixels → NCHW float tensor, BGR order as PaddleOCR was trained. */
function toTensor(data: Uint8ClampedArray, w: number, h: number, padW: number, norm: (v: number, c: number) => number) {
  const plane = h * padW
  const out = new Float32Array(3 * plane)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const o = y * padW + x
      out[o] = norm(data[i + 2], 0)
      out[plane + o] = norm(data[i + 1], 1)
      out[2 * plane + o] = norm(data[i], 2)
    }
  }
  return new ort.Tensor('float32', out, [1, 3, h, padW])
}

const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]

async function detect(e: Engine, image: ImageBitmap) {
  // One uniform scale, padded to multiples of 32. (Stretching each axis to a
  // multiple of 32 separately shifted boxes sideways and cut off last digits.)
  // Small photos are enlarged so their text is big enough for the detector.
  const scale = Math.min(DET_LONG_SIDE / Math.max(image.width, image.height), DET_MAX_UPSCALE)
  const sw = Math.round(image.width * scale)
  const sh = Math.round(image.height * scale)
  const w = Math.ceil(sw / 32) * 32
  const h = Math.ceil(sh / 32) * 32
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, sw, sh)
  const { data } = ctx.getImageData(0, 0, w, h)
  const input = toTensor(data, w, h, w, (v, c) => (v / 255 - MEAN[c]) / STD[c])
  const out = await e.det.run({ [e.det.inputNames[0]]: input })
  const map = out[e.det.outputNames[0]]
  const [, , mh, mw] = map.dims
  return boxesFromProbMap(map.data as Float32Array, mw, mh, w / mw / scale)
}

async function recognise(e: Engine, image: ImageBitmap, box: Omit<ReadBox, 'text' | 'confidence'>) {
  const w = Math.max(8, Math.round((REC_HEIGHT * box.width) / box.height))
  const padW = Math.max(w, REC_MIN_WIDTH)
  const canvas = new OffscreenCanvas(w, REC_HEIGHT)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(w / 2, REC_HEIGHT / 2)
  ctx.scale(w / box.width, REC_HEIGHT / box.height)
  ctx.rotate(-box.angle)
  ctx.translate(-box.cx, -box.cy)
  ctx.drawImage(image, 0, 0)
  const { data } = ctx.getImageData(0, 0, w, REC_HEIGHT)
  const input = toTensor(data, w, REC_HEIGHT, padW, (v) => (v / 255 - 0.5) / 0.5)
  const out = await e.rec.run({ [e.rec.inputNames[0]]: input })
  const probs = out[e.rec.outputNames[0]]
  const [, steps, classes] = probs.dims
  return ctcDecode(probs.data as Float32Array, steps, classes, e.chars)
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const { id, image, models } = ev.data
  const post = (m: WorkerResponse) => self.postMessage(m)
  try {
    const e = await load(models, (progress) => post({ id, type: 'progress', phase: 'laden', progress }))
    post({ id, type: 'progress', phase: 'lesen', progress: 0.05 })

    const found = await detect(e, image)
    const boxes: ReadBox[] = []
    for (let i = 0; i < found.length; i++) {
      boxes.push({ ...found[i], ...(await recognise(e, image, found[i])) })
      post({ id, type: 'progress', phase: 'lesen', progress: 0.1 + (0.9 * (i + 1)) / found.length })
    }
    image.close()

    const lines = groupIntoLines(boxes)
    const read = boxes.filter((b) => b.text.trim())
    const confidence = read.length ? (read.reduce((s, b) => s + b.confidence, 0) / read.length) * 100 : 0
    post({
      id,
      type: 'done',
      result: { text: lines.map((l) => l.text).join('\n'), lines, confidence, boxes: boxes.length },
    })
  } catch (err) {
    post({ id, type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
