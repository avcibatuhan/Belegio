import { findReceiptQuad, growQuad, rectSize, warpQuad, type Quad } from './rectify'

/**
 * Image preparation before OCR.
 *
 * 1. `prepareImage`: applies the EXIF rotation, then finds the receipt in the
 *    photo and straightens it (crop + perspective, see rectify.ts). Colour is
 *    kept; PaddleOCR reads this image directly.
 * 2. `toOcrGray`: grayscale, resize and contrast stretch for Tesseract.
 *
 * Deliberately NOT thresholded to pure black and white. Measured on a blurry
 * phone photo, thresholding filled in the gap of a "0" so it read as "8"
 * (49,80 → 49,88) and dropped accuracy from 6/6 fields to 0/6. Tesseract's
 * LSTM engine does its own binarisation and does it better on grayscale.
 */

/** Tesseract reads best when text is roughly 25–35 px tall. */
const TARGET_LONG_SIDE = 1600
const MAX_UPSCALE = 3
/** Larger images only cost time; phone photos are scaled down to this. */
const MAX_LONG_SIDE = 3200
/** Share of darkest and brightest pixels ignored when stretching contrast. */
const CLIP = 0.01
/** The receipt is searched for in a thumbnail of this size. */
const FIND_LONG_SIDE = 400
/** Keep a sliver of margin around the detected paper edge. */
const GROW = 1.02

export type PreparedImage = {
  /** The receipt, straightened when it was found; otherwise the photo. */
  canvas: HTMLCanvasElement
  /** The photo as taken (EXIF rotation applied, at most MAX_LONG_SIDE). */
  photo: HTMLCanvasElement
  /** Whether the receipt was found and straightened. */
  rectified: boolean
  /** Human-readable account of what happened, for the developer panel. */
  note: string
  /** Corners of the receipt in the (downscaled) photo, when found. */
  quad?: Quad
}

function canvas2d(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas wird von diesem Browser nicht unterstützt.')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return { canvas, ctx }
}

/** Decodes the photo, finds the receipt and straightens it. */
export async function prepareImage(file: Blob): Promise<PreparedImage> {
  // 'from-image' applies the EXIF rotation, so an upright phone photo stays upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(MAX_LONG_SIDE / Math.max(bitmap.width, bitmap.height), 1)
  const { canvas: photo, ctx } = canvas2d(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale))
  ctx.drawImage(bitmap, 0, 0, photo.width, photo.height)
  bitmap.close()

  const t = FIND_LONG_SIDE / Math.max(photo.width, photo.height)
  const { canvas: thumb, ctx: tctx } = canvas2d(Math.round(photo.width * t), Math.round(photo.height * t))
  tctx.drawImage(photo, 0, 0, thumb.width, thumb.height)
  const found = findReceiptQuad(tctx.getImageData(0, 0, thumb.width, thumb.height).data, thumb.width, thumb.height)
  if (!found.found) return { canvas: photo, photo, rectified: false, note: `Nicht zugeschnitten: ${found.reason}.` }

  const quad = growQuad(
    found.quad.map((p) => ({ x: p.x / t, y: p.y / t })) as Quad,
    GROW,
    photo.width,
    photo.height,
  )
  const { width, height } = rectSize(quad)
  const src = ctx.getImageData(0, 0, photo.width, photo.height)
  const warped = warpQuad(src.data, photo.width, photo.height, quad, width, height)
  const { canvas, ctx: octx } = canvas2d(width, height)
  octx.putImageData(new ImageData(warped as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0)

  return {
    canvas,
    photo,
    rectified: true,
    quad,
    note:
      `Beleg gefunden (${Math.round(found.coverage * 100)} % des Fotos, Passform ${Math.round(found.fit * 100)} %), ` +
      `zugeschnitten und entzerrt auf ${width}×${height} px.`,
  }
}

/** Grayscale, resize and contrast stretch for Tesseract. */
export async function toOcrGray(source: HTMLCanvasElement): Promise<Blob> {
  const long = Math.max(source.width, source.height)
  const scale =
    long < TARGET_LONG_SIDE
      ? Math.min(TARGET_LONG_SIDE / long, MAX_UPSCALE)
      : long > MAX_LONG_SIDE
        ? MAX_LONG_SIDE / long
        : 1
  const width = Math.round(source.width * scale)
  const height = Math.round(source.height * scale)
  const { canvas, ctx } = canvas2d(width, height)
  ctx.drawImage(source, 0, 0, width, height)

  const image = ctx.getImageData(0, 0, width, height)
  const px = image.data

  // Grayscale (Rec. 601 luma) and a histogram of it in one pass.
  const hist = new Uint32Array(256)
  for (let i = 0; i < px.length; i += 4) {
    const y = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2])
    px[i] = y
    hist[y]++
  }

  // Stretch so the darkest 1 % become black and the brightest 1 % white.
  const total = width * height
  let lo = 0
  let hi = 255
  for (let acc = 0; lo < 255 && (acc += hist[lo]) < total * CLIP; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]) < total * CLIP; hi--);
  const range = Math.max(hi - lo, 1)

  for (let i = 0; i < px.length; i += 4) {
    const v = Math.max(0, Math.min(255, Math.round(((px[i] - lo) * 255) / range)))
    px[i] = px[i + 1] = px[i + 2] = v
  }
  ctx.putImageData(image, 0, 0)

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht erzeugt werden.'))), 'image/png'),
  )
}
