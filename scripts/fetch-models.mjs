// Downloads the PaddleOCR models into public/models/paddle/ so the app can
// serve them itself. Runs before `npm run dev` and `npm run build`; files that
// are already present and match their checksum are not downloaded again.
//
// Every file is pinned by SHA-256: a changed or tampered upstream file is
// rejected instead of being shipped to users.

import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const DIR = join(import.meta.dirname, '..', 'public', 'models', 'paddle')

const MODELS = [
  {
    // PP-OCRv5 mobile text detector (finds where the text lines are). Apache-2.0.
    file: 'det.onnx',
    url: 'https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/master/onnx/PP-OCRv5/det/ch_PP-OCRv5_det_mobile.onnx',
    sha256: '4d97c44a20d30a81aad087d6a396b08f786c4635742afc391f6621f5c6ae78ae',
  },
  {
    // PP-OCRv5 mobile recogniser for Latin script, incl. German umlauts and €. Apache-2.0.
    file: 'rec.onnx',
    url: 'https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/latin/rec.onnx',
    sha256: '614ffc2d6d3902d360fad7f1b0dd455ee45e877069d14c4e51a99dc4ef144409',
  },
  {
    file: 'dict.txt',
    url: 'https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/latin/dict.txt',
    sha256: '3c0a8a79b612653c25f765271714f71281e4e955962c153e272b7b8c1d2b13ff',
  },
]

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

await mkdir(DIR, { recursive: true })

for (const { file, url, sha256: expected } of MODELS) {
  const target = join(DIR, file)
  const existing = await readFile(target).catch(() => null)
  if (existing && sha256(existing) === expected) continue

  process.stdout.write(`Lade ${file} … `)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status} von ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const actual = sha256(buf)
  if (actual !== expected) {
    throw new Error(`${file}: Prüfsumme stimmt nicht (erwartet ${expected}, erhalten ${actual}). Datei verworfen.`)
  }
  await writeFile(`${target}.part`, buf)
  await rename(`${target}.part`, target)
  console.log(`${(buf.length / 1e6).toFixed(1)} MB, Prüfsumme ok`)
}
