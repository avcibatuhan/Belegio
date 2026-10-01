import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boxesFromProbMap, ctcDecode, groupIntoLines, type ReadBox } from './textBoxes'

test('CTC decoding collapses repeats and drops blanks', () => {
  const chars = ['', 'a', 'b']
  // steps: a a _ a b b  → "aab"
  const seq = [1, 1, 0, 1, 2, 2]
  const probs = new Float32Array(seq.flatMap((c) => chars.map((_, k) => (k === c ? 0.9 : 0.05))))
  const r = ctcDecode(probs, seq.length, chars.length, chars)
  assert.equal(r.text, 'aab')
  assert.ok(Math.abs(r.confidence - 0.9) < 1e-6)
})

test('detector map: one blob per text line, grown back to full size', () => {
  const w = 100, h = 40
  const prob = new Float32Array(w * h)
  // Two horizontal "shrunk" text cores.
  for (let y = 5; y < 9; y++) for (let x = 10; x < 60; x++) prob[y * w + x] = 0.9
  for (let y = 25; y < 29; y++) for (let x = 70; x < 90; x++) prob[y * w + x] = 0.9
  const boxes = boxesFromProbMap(prob, w, h, 2).sort((a, b) => a.cy - b.cy)
  assert.equal(boxes.length, 2)
  assert.ok(Math.abs(boxes[0].cx - 70) < 2, `cx ${boxes[0].cx}`) // centre 35 px in map → 70 in source
  assert.ok(boxes[0].width > 100 && boxes[0].height > 8) // unclipped beyond the 50×4 core, ×2 scale
  assert.ok(Math.abs(boxes[0].angle) < 0.01)
})

test('detector map: weak blobs are ignored', () => {
  const w = 50, h = 20
  const prob = new Float32Array(w * h)
  for (let y = 5; y < 10; y++) for (let x = 5; x < 40; x++) prob[y * w + x] = 0.4 // above 0.3, mean below 0.6
  assert.equal(boxesFromProbMap(prob, w, h, 1).length, 0)
})

const box = (text: string, cx: number, cy: number, width: number, angle = 0): ReadBox => ({
  text, cx, cy, width, height: 24, angle, score: 0.9, confidence: 0.95,
})

test('lines: a label and its far-right amount on a tilted photo form one line', () => {
  const tilt = 0.05 // ≈ 3°
  const boxes = [
    box('Summe EUR', 120, 400, 180, tilt),
    box('8,84', 700, 400 + 580 * Math.tan(tilt), 70, tilt),
    box('Nettobetrag', 130, 440, 200, tilt),
    box('7,43', 700, 440 + 570 * Math.tan(tilt), 70, tilt),
  ]
  const lines = groupIntoLines(boxes)
  assert.equal(lines.length, 2)
  assert.match(lines[0].text, /^Summe EUR\s+8,84$/)
  assert.match(lines[1].text, /^Nettobetrag\s+7,43$/)
  assert.equal(lines[0].words.length, 3)
})
