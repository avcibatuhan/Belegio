import { useCallback, useRef, useState } from 'react'
import { readReceipt } from './readReceipt'
import { overallConfidence, type ParsedField } from './parseReceipt'
import { type StoredReceipt } from './db'
import { addReceipt } from './store'

export type JobStage = 'warten' | 'laden' | 'lesen' | 'extrahieren' | 'fertig' | 'fehler'

export type UploadJob = {
  id: string
  fileName: string
  fileSize: number
  previewUrl: string
  stage: JobStage
  /** 0..1 within the current stage. */
  progress: number
  /** Extra status, e.g. which reading pass is running. */
  detail?: string
  error?: string
  result?: StoredReceipt
}

/** Flattens a parsed field for the developer inspector. */
function field<T>(f: ParsedField<T>, value: string) {
  return { value, confidence: f.confidence, source: f.source, evidence: f.evidence, ocrConfidence: f.ocrConfidence }
}

const MAX_BYTES = 25 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff']

function validate(file: File): string | null {
  if (file.size > MAX_BYTES) return 'Datei ist größer als 25 MB.'
  if (file.type === 'application/pdf') return 'PDF wird noch nicht unterstützt — bitte ein Foto oder einen Scan hochladen.'
  if (!ACCEPTED.includes(file.type)) return 'Nicht unterstütztes Format. Bitte JPG, PNG oder WEBP verwenden.'
  return null
}

export function useReceiptUpload(
  onSaved?: () => void,
  /** Defaults to the shared store so every page sees the new receipt. */
  save: (r: StoredReceipt) => Promise<void> = addReceipt,
) {
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

        const { parsed, passes, ocrMs } = await readReceipt(file, (p) => {
          update(id, {
            stage: p.phase,
            progress: p.progress,
            detail: p.passes > 1 && p.pass > 1 ? `Durchgang ${p.pass}/${p.passes}` : undefined,
          })
        })

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
          // Only independently confirmed amounts may skip human review.
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
              'Händler': field(parsed.merchant, parsed.merchant.value || '—'),
              'Datum': field(parsed.date, parsed.date.value),
              'Netto': field(parsed.net, String(parsed.net.value)),
              'MwSt.-Betrag': field(parsed.vatAmount, String(parsed.vatAmount.value)),
              'Brutto': field(parsed.gross, String(parsed.gross.value)),
              'MwSt.-Satz': field(parsed.vatRate, `${Math.round(parsed.vatRate.value * 100)} %`),
              'Kategorie': { value: parsed.category, confidence: 1, source: 'berechnet' },
            },
            trace: parsed.trace,
            verification: parsed.verification,
            passes,
            ocrMs,
          },
          image: file,
          createdAt: Date.now(),
        }

        await save(receipt)
        update(id, { stage: 'fertig', progress: 1, result: receipt })
        onSaved?.()
      } catch (err) {
        update(id, {
          stage: 'fehler',
          error: err instanceof Error ? err.message : 'Verarbeitung fehlgeschlagen.',
        })
      }
    },
    [onSaved, save, update],
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
