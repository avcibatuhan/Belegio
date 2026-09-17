import { useRef, useState, type DragEvent } from 'react'
import { Card } from './Card'
import { Icon } from './Icon'
import { formatEur, formatDate } from '../lib/format'
import type { UploadJob } from '../lib/useReceiptUpload'

const STAGE_LABEL: Record<UploadJob['stage'], string> = {
  warten: 'In Warteschlange',
  laden: 'OCR-Modell wird geladen',
  lesen: 'Beleg wird gelesen',
  extrahieren: 'Daten werden extrahiert',
  fertig: 'Fertig',
  fehler: 'Fehler',
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
    : `${Math.round(bytes / 1024)} KB`
}

function JobRow({ job, onDismiss }: { job: UploadJob; onDismiss: (id: string) => void }) {
  const busy = job.stage === 'laden' || job.stage === 'lesen' || job.stage === 'extrahieren'
  const pct = Math.round(job.progress * 100)

  return (
    <div
      className={`flex items-center gap-4 rounded-lg border bg-surface-container-lowest p-3 ${
        job.stage === 'fehler'
          ? 'border-l-2 border-l-[#DC2626] border-outline-variant'
          : job.stage === 'fertig'
            ? 'border-l-2 border-l-tertiary border-outline-variant'
            : 'border-outline-variant'
      }`}
    >
      <img
        src={job.previewUrl}
        alt=""
        className="h-14 w-14 shrink-0 rounded-md border border-outline-variant object-cover"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-label-md text-on-surface">{job.fileName}</p>
          <span className="shrink-0 text-label-sm text-on-surface-variant">{formatSize(job.fileSize)}</span>
        </div>

        {job.stage === 'fertig' && job.result ? (
          <p className="mt-0.5 truncate text-body-sm text-on-surface-variant">
            {job.result.merchant} · {formatDate(job.result.date)} ·{' '}
            <span className="font-medium text-on-surface">{formatEur(job.result.gross)}</span>
          </p>
        ) : job.stage === 'fehler' ? (
          <p className="mt-0.5 text-body-sm text-[#DC2626]">{job.error}</p>
        ) : (
          <>
            <p className="mt-0.5 text-body-sm text-on-surface-variant">
              {STAGE_LABEL[job.stage]}
              {busy && pct > 0 ? ` · ${pct} %` : '…'}
            </p>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {job.stage === 'fertig' && job.result && (
          <>
            <span
              className="rounded-full px-2.5 py-1 text-label-sm"
              style={
                job.result.status === 'geprueft'
                  ? { backgroundColor: '#DCFCE7', color: '#16A34A' }
                  : { backgroundColor: '#FEF3C7', color: '#D97706' }
              }
            >
              {Math.round(job.result.confidence.overall * 100)} % Konfidenz
            </span>
            <span className="text-label-sm text-on-surface-variant">{job.result.category}</span>
          </>
        )}
        <button
          onClick={() => onDismiss(job.id)}
          className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low"
          title="Aus Liste entfernen"
        >
          <Icon name="close" className="text-[18px]" />
        </button>
      </div>
    </div>
  )
}

type Props = {
  jobs: UploadJob[]
  onFiles: (files: FileList | File[]) => void
  onDismiss: (id: string) => void
}

export function UploadDropzone({ jobs, onFiles, onDismiss }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files)
  }

  const active = jobs.filter((j) => j.stage !== 'fertig' && j.stage !== 'fehler').length

  return (
    <div className="space-y-space-sm">
      <Card
        className={`border-2 border-dashed transition-colors ${
          dragging ? '!border-primary !bg-secondary-container/50' : '!border-outline-variant !bg-surface-container-low'
        }`}
      >
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 py-8 text-center"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-container">
            <Icon name={dragging ? 'download' : 'cloud_upload'} className="text-[24px] text-primary" />
          </span>
          <p className="text-headline-sm text-on-surface">
            {dragging ? 'Loslassen zum Hochladen' : 'Neuen Beleg hochladen'}
          </p>
          <p className="text-body-sm text-on-surface-variant">
            Dateien hier ablegen oder <span className="text-primary underline">klicken zum Auswählen</span>
          </p>
          <div className="mt-2 flex items-center gap-2">
            {['JPG', 'PNG', 'WEBP'].map((f) => (
              <span
                key={f}
                className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm text-on-surface-variant"
              >
                {f}
              </span>
            ))}
            <span className="flex items-center gap-1 text-label-sm text-on-surface-variant">
              <Icon name="lock" className="text-[14px]" />
              Lokale OCR-Extraktion
            </span>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onFiles(e.target.files)
            e.target.value = '' // allow re-selecting the same file
          }}
        />
      </Card>

      {jobs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <span className="text-label-md text-on-surface">Verarbeitung</span>
            {active > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-secondary-container px-2.5 py-0.5 text-label-sm text-on-secondary-container">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                {active} aktiv
              </span>
            )}
          </div>
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} onDismiss={onDismiss} />
          ))}
        </div>
      )}
    </div>
  )
}
