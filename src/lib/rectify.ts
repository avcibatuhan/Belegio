/**
 * Finds the receipt in a photo and straightens it (crop + perspective).
 *
 * A receipt is a bright, colourless sheet on a usually darker or more
 * colourful background. The steps:
 *   1. "paper score" per pixel = darkest colour channel (white paper scores
 *      high; a yellow, wooden or grey table scores lower), blurred so the
 *      printed text does not punch holes in the sheet,
 *   2. Otsu's threshold splits paper from background,
 *   3. the largest connected bright region is taken as the receipt,
 *   4. its convex hull is reduced to the four-cornered shape of largest area,
 *   5. a homography maps those four corners to an upright rectangle.
 *
 * When the result does not look like a sheet of paper, nothing is cropped:
 * a bad crop would cut off text, which is worse than no crop at all.
 *
 * Pure functions on RGBA arrays, so they run under `npm test`.
 */

export type Point = { x: number; y: number }
/** Corners in order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point]

export type QuadResult =
  | { found: true; quad: Quad; coverage: number; fit: number }
  | { found: false; reason: string }

/** Smaller than this share of the photo, the region is too small to be a receipt. */
const MIN_COVERAGE = 0.12
/** Larger than this, the receipt already fills the photo: nothing to crop. */
const MAX_COVERAGE = 0.92
/** Quad area / hull area: below this, the region is not four-cornered. */
const MIN_FIT = 0.88
/** Region pixels / hull area: below this, the region is a scatter, not a sheet. */
const MIN_SOLIDITY = 0.7

/**
 * Locates the receipt in a small RGBA image (a few hundred pixels across is
 * plenty). Returns corners in that image's pixel coordinates.
 */
export function findReceiptQuad(rgba: Uint8ClampedArray, w: number, h: number): QuadResult {
  const n = w * h
  const score = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    score[i] = Math.min(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2])
  }
  const blurred = boxBlur(score, w, h, Math.max(1, Math.round(Math.max(w, h) / 120)))

  const t = otsu(blurred)
  const mask = new Uint8Array(n)
  for (let i = 0; i < n; i++) mask[i] = blurred[i] > t ? 1 : 0

  const region = largestComponent(mask, w, h)
  if (!region) return { found: false, reason: 'keine helle Fläche gefunden' }

  const hull = convexHull(region.edge)
  const hullArea = polygonArea(hull)
  const coverage = hullArea / n
  if (coverage < MIN_COVERAGE) return { found: false, reason: `Fläche zu klein (${pct(coverage)})` }
  if (coverage > MAX_COVERAGE) return { found: false, reason: `Beleg füllt das Bild bereits (${pct(coverage)})` }
  if (region.size / hullArea < MIN_SOLIDITY) return { found: false, reason: 'Fläche ist kein zusammenhängendes Blatt' }

  const quad = largestQuad(hull)
  const fit = polygonArea(quad) / hullArea
  if (fit < MIN_FIT) return { found: false, reason: `Form ist nicht viereckig (${pct(fit)})` }

  return { found: true, quad: orderCorners(quad), coverage, fit }
}

const pct = (v: number) => `${Math.round(v * 100)} %`

/** Output size for a quad: the longer of each pair of opposite edges. */
export function rectSize(q: Quad): { width: number; height: number } {
  const d = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
  return {
    width: Math.round(Math.max(d(q[0], q[1]), d(q[3], q[2]))),
    height: Math.round(Math.max(d(q[0], q[3]), d(q[1], q[2]))),
  }
}

/**
 * Straightens the quad in `src` into an upright `outW × outH` image
 * (perspective warp with bilinear sampling).
 */
export function warpQuad(
  src: Uint8ClampedArray, sw: number, sh: number, q: Quad, outW: number, outH: number,
): Uint8ClampedArray {
  const H = homography(
    [{ x: 0, y: 0 }, { x: outW - 1, y: 0 }, { x: outW - 1, y: outH - 1 }, { x: 0, y: outH - 1 }],
    q,
  )
  const out = new Uint8ClampedArray(outW * outH * 4)
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const z = H[6] * x + H[7] * y + 1
      const fx = Math.min(Math.max((H[0] * x + H[1] * y + H[2]) / z, 0), sw - 1)
      const fy = Math.min(Math.max((H[3] * x + H[4] * y + H[5]) / z, 0), sh - 1)
      const x0 = Math.floor(fx), y0 = Math.floor(fy)
      const x1 = Math.min(x0 + 1, sw - 1), y1 = Math.min(y0 + 1, sh - 1)
      const ax = fx - x0, ay = fy - y0
      const o = (y * outW + x) * 4
      for (let c = 0; c < 3; c++) {
        const top = src[(y0 * sw + x0) * 4 + c] * (1 - ax) + src[(y0 * sw + x1) * 4 + c] * ax
        const bot = src[(y1 * sw + x0) * 4 + c] * (1 - ax) + src[(y1 * sw + x1) * 4 + c] * ax
        out[o + c] = top * (1 - ay) + bot * ay
      }
      out[o + 3] = 255
    }
  }
  return out
}

/** Grows a quad around its centre, so the paper's edge is not shaved off. */
export function growQuad(q: Quad, factor: number, w: number, h: number): Quad {
  const cx = q.reduce((s, p) => s + p.x, 0) / 4
  const cy = q.reduce((s, p) => s + p.y, 0) / 4
  return q.map((p) => ({
    x: Math.min(Math.max(cx + (p.x - cx) * factor, 0), w - 1),
    y: Math.min(Math.max(cy + (p.y - cy) * factor, 0), h - 1),
  })) as Quad
}

// ─── Building blocks ──────────────────────────────────────────────────────

/** Separable box blur via running sums. */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  for (let y = 0; y < h; y++) {
    let acc = 0
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(Math.max(x, 0), w - 1)]
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / (2 * r + 1)
      acc += src[y * w + Math.min(x + r + 1, w - 1)] - src[y * w + Math.max(x - r, 0)]
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(Math.max(y, 0), h - 1) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / (2 * r + 1)
      acc += tmp[Math.min(y + r + 1, h - 1) * w + x] - tmp[Math.max(y - r, 0) * w + x]
    }
  }
  return out
}

/** Otsu's method: the threshold that best separates two brightness groups. */
export function otsu(values: Float32Array): number {
  const hist = new Float64Array(256)
  for (const v of values) hist[Math.min(255, Math.max(0, Math.round(v)))]++
  const total = values.length
  let sumAll = 0
  for (let i = 0; i < 256; i++) sumAll += i * hist[i]
  let wB = 0, sumB = 0, best = 0, bestVar = -1
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (!wB) continue
    const wF = total - wB
    if (!wF) break
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sumAll - sumB) / wF
    const between = wB * wF * (mB - mF) ** 2
    if (between > bestVar) (bestVar = between), (best = t)
  }
  return best
}

/**
 * Largest 4-connected region of the mask: its pixel count and, per row, its
 * leftmost and rightmost pixel (all the convex hull needs).
 */
function largestComponent(mask: Uint8Array, w: number, h: number) {
  const seen = new Uint8Array(mask.length)
  const stack = new Int32Array(mask.length)
  let best: { size: number; edge: Point[] } | null = null

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue
    let top = 0
    stack[top++] = start
    seen[start] = 1
    let size = 0
    const left = new Map<number, number>()
    const right = new Map<number, number>()
    while (top) {
      const p = stack[--top]
      size++
      const x = p % w
      const y = (p - x) / w
      if (!(left.get(y)! <= x)) left.set(y, x)
      if (!(right.get(y)! >= x)) right.set(y, x)
      const visit = (q: number) => {
        if (mask[q] && !seen[q]) (seen[q] = 1), (stack[top++] = q)
      }
      if (x > 0) visit(p - 1)
      if (x < w - 1) visit(p + 1)
      if (y > 0) visit(p - w)
      if (y < h - 1) visit(p + w)
    }
    if (!best || size > best.size) {
      const edge: Point[] = []
      for (const [y, x] of left) edge.push({ x, y }, { x: right.get(y)! + 1, y })
      for (const [y, x] of left) edge.push({ x, y: y + 1 }, { x: right.get(y)! + 1, y: y + 1 })
      best = { size, edge }
    }
  }
  return best
}

/** Andrew's monotone chain. */
export function convexHull(points: Point[]): Point[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  if (pts.length < 3) return pts
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: Point[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Point[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

export function polygonArea(poly: Point[]): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length]
    a += p.x * q.y - q.x * p.y
  }
  return Math.abs(a) / 2
}

/** The four hull vertices spanning the largest area. */
export function largestQuad(input: Point[]): Point[] {
  const hull = simplify(input)
  const n = hull.length
  if (n <= 4) return hull
  const tri = (a: Point, b: Point, c: Point) => Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2
  let best = -1
  let quad: Point[] = hull.slice(0, 4)
  // Every diagonal i–k; the best third and fourth corners on either side.
  for (let i = 0; i < n; i++) {
    for (let k = i + 2; k < n; k++) {
      let bestJ = -1, aJ = -1
      for (let j = i + 1; j < k; j++) {
        const a = tri(hull[i], hull[j], hull[k])
        if (a > aJ) (aJ = a), (bestJ = j)
      }
      let bestL = -1, aL = -1
      for (let l = k + 1; l < n + i; l++) {
        const a = tri(hull[i], hull[k], hull[l % n])
        if (a > aL) (aL = a), (bestL = l % n)
      }
      if (bestJ < 0 || bestL < 0) continue
      if (aJ + aL > best) {
        best = aJ + aL
        quad = [hull[i], hull[bestJ], hull[k], hull[bestL]]
      }
    }
  }
  return quad
}

/**
 * Drops hull vertices that barely bend the outline (less than a pixel off the
 * line through their neighbours). Real corners survive; the search stays fast.
 */
function simplify(hull: Point[]): Point[] {
  let pts = hull
  for (let changed = true; changed && pts.length > 4; ) {
    changed = false
    const keep: Point[] = []
    for (let i = 0; i < pts.length; i++) {
      const a = keep.length ? keep[keep.length - 1] : pts[pts.length - 1]
      const b = pts[i]
      const c = pts[(i + 1) % pts.length]
      const base = Math.hypot(c.x - a.x, c.y - a.y)
      const off = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / (base || 1)
      if (off < 1 && pts.length - (i - keep.length) > 4) changed = true
      else keep.push(b)
    }
    pts = keep
  }
  return pts
}

/** Puts four corners in the order top-left, top-right, bottom-right, bottom-left. */
export function orderCorners(pts: Point[]): Quad {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
  // Clockwise on screen (y grows downwards), starting from the upper-left.
  const sorted = [...pts].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx))
  let start = 0
  for (let i = 1; i < 4; i++) if (sorted[i].x + sorted[i].y < sorted[start].x + sorted[start].y) start = i
  return [0, 1, 2, 3].map((i) => sorted[(start + i) % 4]) as Quad
}

/** 3×3 homography (as 8 numbers, h33 = 1) mapping `from[i]` to `to[i]`. */
export function homography(from: Point[], to: Point[]): number[] {
  const A: number[][] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i]
    const { x: u, y: v } = to[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u])
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v])
  }
  // Gaussian elimination with partial pivoting on the 8×9 augmented matrix.
  for (let c = 0; c < 8; c++) {
    let p = c
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
    ;[A[c], A[p]] = [A[p], A[c]]
    for (let r = 0; r < 8; r++) {
      if (r === c) continue
      const f = A[r][c] / A[c][c]
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k]
    }
  }
  return A.map((row, i) => row[8] / row[i])
}
