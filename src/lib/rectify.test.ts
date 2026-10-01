import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findReceiptQuad, homography, warpQuad, type Point } from './rectify'

/** A white quadrilateral "receipt" with dark text stripes on a coloured table. */
function photo(w: number, h: number, corners: Point[], table = [200, 170, 30]) {
  const rgba = new Uint8ClampedArray(w * h * 4)
  const inside = (x: number, y: number) => {
    let sign = 0
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4]
      const c = Math.sign((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x))
      if (c && sign && c !== sign) return false
      if (c) sign = c
    }
    return true
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      const paper = inside(x, y)
      const ink = paper && y % 12 < 2 // full-width printed lines must not split the sheet
      const [r, g, b] = paper ? (ink ? [40, 40, 40] : [235, 232, 228]) : table
      rgba.set([r, g, b, 255], o)
    }
  }
  return rgba
}

const near = (a: Point, b: Point, tol: number) => Math.hypot(a.x - b.x, a.y - b.y) <= tol

test('finds a tilted receipt on a yellow table and orders its corners', () => {
  const corners = [{ x: 90, y: 40 }, { x: 230, y: 60 }, { x: 200, y: 370 }, { x: 60, y: 350 }]
  const r = findReceiptQuad(photo(300, 400, corners), 300, 400)
  assert.ok(r.found, r.found ? '' : r.reason)
  if (!r.found) return
  r.quad.forEach((p, i) => assert.ok(near(p, corners[i], 8), `corner ${i}: ${JSON.stringify(p)} vs ${JSON.stringify(corners[i])}`))
})

test('finds a receipt on a grey table (no colour difference, only brightness)', () => {
  const corners = [{ x: 50, y: 50 }, { x: 250, y: 30 }, { x: 260, y: 360 }, { x: 70, y: 370 }]
  const r = findReceiptQuad(photo(300, 400, corners, [110, 110, 110]), 300, 400)
  assert.ok(r.found)
})

test('a receipt that already fills the photo is left alone', () => {
  const corners = [{ x: 0, y: 0 }, { x: 299, y: 0 }, { x: 299, y: 399 }, { x: 0, y: 399 }]
  const r = findReceiptQuad(photo(300, 400, corners), 300, 400)
  assert.equal(r.found, false)
})

test('homography maps the four corners exactly', () => {
  const from = [{ x: 0, y: 0 }, { x: 99, y: 0 }, { x: 99, y: 199 }, { x: 0, y: 199 }]
  const to = [{ x: 10, y: 5 }, { x: 120, y: 20 }, { x: 110, y: 230 }, { x: 0, y: 210 }]
  const H = homography(from, to)
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i]
    const z = H[6] * x + H[7] * y + 1
    assert.ok(Math.abs((H[0] * x + H[1] * y + H[2]) / z - to[i].x) < 1e-6)
    assert.ok(Math.abs((H[3] * x + H[4] * y + H[5]) / z - to[i].y) < 1e-6)
  }
})

test('warping the detected quad yields only paper, no table', () => {
  const corners = [{ x: 90, y: 40 }, { x: 230, y: 60 }, { x: 200, y: 370 }, { x: 60, y: 350 }]
  const src = photo(300, 400, corners)
  const r = findReceiptQuad(src, 300, 400)
  assert.ok(r.found)
  if (!r.found) return
  const out = warpQuad(src, 300, 400, r.quad, 140, 300)
  let yellow = 0
  for (let i = 0; i < out.length; i += 4) if (out[i + 2] < 100 && out[i] > 150) yellow++
  assert.ok(yellow / (140 * 300) < 0.03, `table share ${yellow / (140 * 300)}`)
})
