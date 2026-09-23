import { useNavigate } from 'react-router-dom'
import { Card } from '../components/Card'
import { Icon } from '../components/Icon'
import { UploadDropzone } from '../components/UploadDropzone'
import { useReceiptUpload } from '../lib/useReceiptUpload'

export function Upload() {
  const navigate = useNavigate()
  // Saving defaults to the shared store, so the archive sees new receipts at once.
  const { jobs, addFiles, dismiss } = useReceiptUpload()

  const finished = jobs.filter((j) => j.stage === 'fertig').length
  const failed = jobs.filter((j) => j.stage === 'fehler').length

  return (
    <div className="mx-auto max-w-[1200px] space-y-space-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-headline-lg text-on-surface">Beleg hochladen</h1>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Scanne und digitalisiere Quittungen, Rechnungen und Bewirtungsbelege direkt im Browser.
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1.5 text-label-sm text-on-surface-variant">
          <span className="h-2 w-2 rounded-full bg-tertiary" />
          WebAssembly-OCR lokal
        </span>
      </div>

      <UploadDropzone jobs={jobs} onFiles={addFiles} onDismiss={dismiss} />

      {(finished > 0 || failed > 0) && (
        <Card className="!bg-surface-container-low">
          <div className="flex items-center gap-3">
            <Icon name="done_all" className="text-[20px] text-primary" />
            <p className="flex-1 text-body-md text-on-surface">
              {finished} Beleg(e) verarbeitet
              {failed > 0 && `, ${failed} fehlgeschlagen`}.
            </p>
            <button
              onClick={() => navigate('/belege')}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-label-md text-on-surface transition-colors hover:bg-surface-container-low"
            >
              Zum Archiv
            </button>
            <button
              onClick={() => navigate('/pruefen')}
              className="rounded-lg bg-primary-container px-3 py-2 text-label-md text-on-primary transition-opacity hover:opacity-95"
            >
              Jetzt prüfen
            </button>
          </div>
        </Card>
      )}

      <Card className="!bg-surface-container-low">
        <div className="flex items-start gap-3">
          <Icon name="lock" className="mt-0.5 text-[20px] text-primary" />
          <div>
            <p className="text-label-md text-on-surface">Deine Belege verlassen nie deinen Rechner.</p>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              OCR und Datenextraktion laufen vollständig clientseitig im WebAssembly-Kern deines Browsers. Nach
              außen geht ausschließlich das Sprachmodell der Texterkennung — niemals ein Belegbild.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
