/**
 * Pure geometry for the PaddleOCR engine (see paddleWorker.ts): turning the
 * detector's probability map into text boxes, decoding the recogniser's
 * output, and grouping boxes into receipt lines. No browser APIs here, so
 * all of it runs under `npm test`.
 */
import type { OcrLine, OcrWord } from './parseReceipt'

/** A text region as a rotated rectangle, in source-image pixels. */
export type TextBox = {
  cx: number
  cy: number
  /** Along the text direction. */
  width: number
  /** Across the text direction. */
  height: number
  /** Radians, rotation of the text direction from horizontal. */
  angle: number
  /** Mean detector probability inside the region, 0..1. */
  score: number
}

export type ReadBox = TextBox & { text: string; confidence: number }

/** DB post-processing defaults from PaddleOCR. */
const BIN_THRESH = 0.3
const BOX_THRESH = 0.6
const UNCLIP_RATIO = 1.5
const MIN_SIDE = 3

/**
 * Finds text regions in the detector's probability map (DB algorithm).
 *
 * The detector marks a shrunken core of every text line; each connected
 * blob above the threshold becomes one box, expanded back by the "unclip"
 * distance. Short blobs (a lone price like "8,84") get too little shape for
 * a reliable angle, so they inherit the dominant angle of the long ones.
 *
 * @param prob  Probability map, row-major, `w × h`.
 * @param scale Map pixels → source pixels.
 */
export function boxesFromProbMap(prob: Float32Array, w: number, h: number, scale: number): TextBox[] {
  const label = new Int32Array(w * h)
  const stack = new Int32Array(w * h)
  type Blob = { cx: number; cy: number; cxx: number; cyy: number; cxy: number; n: number; sum: number; pts: Int32Array }
  const blobs: Blob[] = []

  for (let start = 0; start < w * h; start++) {
    if (label[start] || prob[start] <= BIN_THRESH) continue
    const id = blobs.length + 1
    let top = 0
    stack[top++] = start
    label[start] = id
    const members: number[] = []
    while (top) {
      const p = stack[--top]
      members.push(p)
      const x = p % w
      const y = (p - x) / w
      if (x > 0 && !label[p - 1] && prob[p - 1] > BIN_THRESH) (label[p - 1] = id), (stack[top++] = p - 1)
      if (x < w - 1 && !label[p + 1] && prob[p + 1] > BIN_THRESH) (label[p + 1] = id), (stack[top++] = p + 1)
      if (y > 0 && !label[p - w] && prob[p - w] > BIN_THRESH) (label[p - w] = id), (stack[top++] = p - w)
      if (y < h - 1 && !label[p + w] && prob[p + w] > BIN_THRESH) (label[p + w] = id), (stack[top++] = p + w)
    }
    if (members.length < MIN_SIDE * MIN_SIDE) {
      blobs.push({ cx: 0, cy: 0, cxx: 0, cyy: 0, cxy: 0, n: 0, sum: 0, pts: new Int32Array(0) })
      continue
    }
    let sx = 0, sy = 0, sum = 0
    for (const p of members) {
      sx += p % w
      sy += Math.floor(p / w)
      sum += prob[p]
    }
    const n = members.length
    const cx = sx / n
    const cy = sy / n
    let cxx = 0, cyy = 0, cxy = 0
    for (const p of members) {
      const dx = (p % w) - cx
      const dy = Math.floor(p / w) - cy
      cxx += dx * dx
      cyy += dy * dy
      cxy += dx * dy
    }
    blobs.push({ cx, cy, cxx: cxx / n, cyy: cyy / n, cxy: cxy / n, n, sum, pts: Int32Array.from(members) })
  }

  const usable = blobs.filter((b) => b.n > 0 && b.sum / b.n >= BOX_THRESH)

  // Angle of each blob's principal axis, folded to (-45°, 45°].
  const principal = (b: Blob) => {
    let a = 0.5 * Math.atan2(2 * b.cxy, b.cxx - b.cyy)
    if (a > Math.PI / 4) a -= Math.PI / 2
    if (a <= -Math.PI / 4) a += Math.PI / 2
    return a
  }
  const elongation = (b: Blob) => {
    const tr = b.cxx + b.cyy
    const det = b.cxx * b.cyy - b.cxy * b.cxy
    const disc = Math.sqrt(Math.max(tr * tr / 4 - det, 0))
    return Math.sqrt((tr / 2 + disc) / Math.max(tr / 2 - disc, 1e-6))
  }
  const longAngles = usable.filter((b) => elongation(b) >= 4).map(principal).sort((a, b) => a - b)
  const pageAngle = longAngles.length ? longAngles[Math.floor(longAngles.length / 2)] : 0

  const boxes: TextBox[] = []
  for (const b of usable) {
    const angle = elongation(b) >= 4 ? principal(b) : pageAngle
    const ux = Math.cos(angle), uy = Math.sin(angle)
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity
    for (const p of b.pts) {
      const dx = (p % w) - b.cx
      const dy = Math.floor(p / w) - b.cy
      const u = dx * ux + dy * uy
      const v = -dx * uy + dy * ux
      if (u < u0) u0 = u
      if (u > u1) u1 = u
      if (v < v0) v0 = v
      if (v > v1) v1 = v
    }
    // +1: pixel extents are inclusive.
    const bw = u1 - u0 + 1
    const bh = v1 - v0 + 1
    if (Math.min(bw, bh) < MIN_SIDE) continue

    // Unclip: grow by area × ratio / perimeter, as DB was trained to expect.
    const d = (bw * bh * UNCLIP_RATIO) / (2 * (bw + bh))
    const width = bw + 2 * d
    const height = bh + 2 * d
    if (Math.min(width, height) < MIN_SIDE + 2) continue

    // Centre of the extent box, which may differ from the pixel centroid.
    const mu = (u0 + u1) / 2
    const mv = (v0 + v1) / 2
    const cx = b.cx + mu * ux - mv * uy + 0.5
    const cy = b.cy + mu * uy + mv * ux + 0.5
    boxes.push({ cx: cx * scale, cy: cy * scale, width: width * scale, height: height * scale, angle, score: b.sum / b.n })
  }
  return boxes
}

/**
 * Greedy CTC decoding: best class per time step, repeats collapsed, blanks
 * (class 0) dropped. Confidence is the mean probability of the kept steps.
 *
 * @param probs Softmax output, `steps × classes`, row-major.
 * @param chars Character for each class index; index 0 is the blank.
 */
export function ctcDecode(probs: Float32Array, steps: number, classes: number, chars: string[]) {
  let text = ''
  let sum = 0
  let kept = 0
  let prev = -1
  for (let t = 0; t < steps; t++) {
    let best = 0
    let bestP = -Infinity
    const row = t * classes
    for (let c = 0; c < classes; c++) {
      if (probs[row + c] > bestP) (bestP = probs[row + c]), (best = c)
    }
    if (best !== 0 && best !== prev) {
      text += chars[best] ?? ''
      sum += bestP
      kept++
    }
    prev = best
  }
  return { text, confidence: kept ? sum / kept : 0 }
}

/**
 * Groups recognised boxes into receipt lines, in reading order.
 *
 * Boxes are compared in a frame rotated by the page tilt, so a slanted row
 * ("Summe EUR" far left, "8,84" far right) still lands on one line. Wide gaps
 * become runs of spaces, the way Tesseract's preserve_interword_spaces renders
 * them, so the parser sees the same shape of text from either engine.
 */
export function groupIntoLines(boxes: ReadBox[]): OcrLine[] {
  const live = boxes.filter((b) => b.text.trim())
  if (!live.length) return []

  const sorted = [...live].map((b) => b.angle).sort((a, b) => a - b)
  const tilt = sorted[Math.floor(sorted.length / 2)]
  const cos = Math.cos(tilt), sin = Math.sin(tilt)
  const toPage = (b: ReadBox) => ({ x: b.cx * cos + b.cy * sin, y: -b.cx * sin + b.cy * cos })

  type Row = { y: number; h: number; items: { box: ReadBox; x: number }[] }
  const rows: Row[] = []
  for (const box of [...live].sort((a, b) => toPage(a).y - toPage(b).y)) {
    const p = toPage(box)
    const row = rows.find((r) => Math.abs(r.y - p.y) < 0.5 * Math.min(r.h, box.height))
    if (row) {
      row.items.push({ box, x: p.x })
      row.y = (row.y * (row.items.length - 1) + p.y) / row.items.length
    } else {
      rows.push({ y: p.y, h: box.height, items: [{ box, x: p.x }] })
    }
  }
  rows.sort((a, b) => a.y - b.y)

  return rows.map((row) => {
    const items = row.items.sort((a, b) => a.x - b.x)
    let text = ''
    const words: OcrWord[] = []
    items.forEach(({ box, x }, i) => {
      if (i > 0) {
        const prev = items[i - 1]
        const gap = x - box.width / 2 - (prev.x + prev.box.width / 2)
        text += gap > box.height * 1.5 ? '      ' : ' '
      }
      text += box.text.trim()
      words.push(...splitWords(box))
    })
    const xs = words.flatMap((w) => [w.bbox.x0, w.bbox.x1])
    const ys = words.flatMap((w) => [w.bbox.y0, w.bbox.y1])
    const bbox = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
    const span = bbox.x1 - bbox.x0
    return {
      text,
      words,
      bbox,
      baseline: { x0: bbox.x0, y0: bbox.y1, x1: bbox.x1, y1: bbox.y1 + span * Math.tan(tilt) },
    }
  })
}

/**
 * Splits one recognised box into words with estimated positions, assuming
 * evenly wide characters (true for the monospaced fonts on most receipts).
 */
function splitWords(box: ReadBox): OcrWord[] {
  const text = box.text.trim()
  const cos = Math.cos(box.angle), sin = Math.sin(box.angle)
  const out: OcrWord[] = []
  const re = /\S+/g
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const a = (m.index / text.length - 0.5) * box.width
    const b = ((m.index + m[0].length) / text.length - 0.5) * box.width
    const xs = [a, b].flatMap((u) => [-1, 1].map((s) => box.cx + u * cos - (s * box.height) / 2 * sin))
    const ys = [a, b].flatMap((u) => [-1, 1].map((s) => box.cy + u * sin + (s * box.height) / 2 * cos))
    out.push({
      text: m[0],
      confidence: box.confidence * 100,
      bbox: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) },
    })
  }
  return out
}
