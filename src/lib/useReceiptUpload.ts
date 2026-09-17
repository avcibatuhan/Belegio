import { useCallback, useRef, useState } from 'react'
import { recognise } from './ocr'
import { overallConfidence, parseReceipt } from './parseReceipt'
import { saveReceipt, type StoredReceipt } from './db'

export type JobStage = 'warten' | 'laden' | 'lesen' | 'extrahieren' | 'fertig' | 'fehler'

export type UploadJob = {
  id: string
  fileName: string
  fileSize: number
  previewUrl: string
  stage: JobStage
  /** 0..1 within the current stage. */
  progress: number
  error?: string
  result?: StoredReceipt
}

const MAX_BYTES = 25 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff']

function validate(file: File): string | null {
  if (file.size > MAX_BYTES) return 'Datei ist größer als 25 MB.'
  if (file.type === 'application/pdf') return 'PDF wird noch nicht unterstützt — bitte ein Foto oder einen Scan hochladen.'
  if (!ACCEPTED.includes(file.type)) return 'Nicht unterstütztes Format. Bitte JPG, PNG oder WEBP verwenden.'
  return null
}

export function useReceiptUpload(onSaved?: () => void) {
  const [jobs, setJobs] = useState<UploadJob[]>([])
  const urlsRef = useRef<string[]>([])

  const update = useCallback((id: string, patch: Partial<UploadJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)))
  }, [])

  const process = useCallback(
    async (file: File, id: string) => {
      const invalid = validate(file)
      if (invalid) {
        update(id, { stage: 'fehler', error: invalid })
        return
      }

      try {
        update(id, { stage: 'laden', progress: 0 })

        const ocrStart = performance.now()
        const text = await recognise(file, (p) => {
          update(id, { stage: p.phase, progress: p.progress })
        })
        const ocrMs = Math.round(performance.now() - ocrStart)

        update(id, { stage: 'extrahieren', progress: 1 })
        const parseStart = performance.now()
        const parsed = parseReceipt(text)
        const parseMs = Math.round(performance.now() - parseStart)

        if (parsed.gross.value <= 0) {
          update(id, {
            stage: 'fehler',
            error: 'Kein Betrag erkannt. Bitte mit besserem Licht erneut aufnehmen oder manuell erfassen.',
          })
          return
        }

        const overall = overallConfidence(parsed)
        const receipt: StoredReceipt = {
          id,
          merchant: parsed.merchant.value || 'Unbekannter Händler',
          note: file.name,
          date: parsed.date.value,
          category: parsed.category,
          vatRate: parsed.vatRate.value,
          net: parsed.net.value,
          vatAmount: parsed.vatAmount.value,
          gross: parsed.gross.value,
          // Anything uncertain must be confirmed by a human before it counts as verified.
          status: overall >= 0.85 && parsed.arithmeticValid ? 'geprueft' : 'zu-pruefen',
          confidence: {
            merchant: parsed.merchant.confidence,
            date: parsed.date.confidence,
            gross: parsed.gross.confidence,
            vatRate: parsed.vatRate.confidence,
            overall,
          },
          arithmeticValid: parsed.arithmeticValid,
          rawText: parsed.rawText,
          diagnostics: {
            fields: {
              'Händler': {
                value: parsed.merchant.value || '—',
                confidence: parsed.merchant.confidence,
                source: parsed.merchant.source,
                evidence: parsed.merchant.evidence,
              },
              'Datum': {
                value: parsed.date.value,
                confidence: parsed.date.confidence,
                source: parsed.date.source,
                evidence: parsed.date.evidence,
              },
              'Netto': {
                value: String(parsed.net.value),
                confidence: parsed.net.confidence,
                source: parsed.net.source,
                evidence: parsed.net.evidence,
              },
              'MwSt.-Betrag': {
                value: String(parsed.vatAmount.value),
                confidence: parsed.vatAmount.confidence,
                source: parsed.vatAmount.source,
                evidence: parsed.vatAmount.evidence,
              },
              'Brutto': {
                value: String(parsed.gross.value),
                confidence: parsed.gross.confidence,
                source: parsed.gross.source,
                evidence: parsed.gross.evidence,
              },
              'MwSt.-Satz': {
                value: `${Math.round(parsed.vatRate.value * 100)} %`,
                confidence: parsed.vatRate.confidence,
                source: parsed.vatRate.source,
                evidence: parsed.vatRate.evidence,
              },
              'Kategorie': {
                value: parsed.category,
                confidence: 1,
                source: 'berechnet',
              },
            },
            trace: parsed.trace,
            ocrMs,
            parseMs,
          },
          image: file,
          createdAt: Date.now(),
        }

        await saveReceipt(receipt)
        update(id, { stage: 'fertig', progress: 1, result: receipt })
        onSaved?.()
      } catch (err) {
        update(id, {
          stage: 'fehler',
          error: err instanceof Error ? err.message : 'Verarbeitung fehlgeschlagen.',
        })
      }
    },
    [onSaved, update],
  )

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files)
      if (!list.length) return

      const created = list.map((file) => {
        const url = URL.createObjectURL(file)
        urlsRef.current.push(url)
        return {
          id: crypto.randomUUID(),
          fileName: file.name,
          fileSize: file.size,
          previewUrl: url,
          stage: 'warten' as JobStage,
          progress: 0,
        }
      })

      setJobs((prev) => [...created, ...prev])

      // Sequential: the OCR worker handles one page at a time.
      void created.reduce(
        (chain, job, i) => chain.then(() => process(list[i], job.id)),
        Promise.resolve(),
      )
    },
    [process],
  )

  const dismiss = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id))
  }, [])

  const clearFinished = useCallback(() => {
    setJobs((prev) => prev.filter((j) => j.stage !== 'fertig'))
  }, [])

  return { jobs, addFiles, dismiss, clearFinished }
}
