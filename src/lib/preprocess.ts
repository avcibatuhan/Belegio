/**
 * Light clean-up of a photo before OCR: grayscale, resize, contrast stretch.
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

export async function preprocessForOcr(file: Blob): Promise<Blob> {
  // 'from-image' applies the EXIF rotation, so an upright phone photo stays upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })

  const long = Math.max(bitmap.width, bitmap.height)
  const scale =
    long < TARGET_LONG_SIDE
      ? Math.min(TARGET_LONG_SIDE / long, MAX_UPSCALE)
      : long > MAX_LONG_SIDE
        ? MAX_LONG_SIDE / long
        : 1
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas wird von diesem Browser nicht unterstützt.')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

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
