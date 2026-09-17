import { Card } from '../components/Card'
import { Icon } from '../components/Icon'

const STEPS = ['Zuschneiden', 'OCR', 'Extraktion', 'Prüfung'] as const

type QueueItem = {
  id: string
  file: string
  size: string
  meta: string
  kind: 'JPEG' | 'PDF' | 'PNG'
  /** Index of the step currently running; steps before it are done. */
  current: number
  state: 'bereit' | 'verarbeitet' | 'fehler'
  progressNote?: string
}

const QUEUE: QueueItem[] = [
  { id: 'q1', file: 'REWE_Beleg_20260912.jpg', size: '1,4 MB', meta: 'Betrag: 48,90 € · 99 % MwSt.', kind: 'JPEG', current: 4, state: 'bereit' },
  { id: 'q2', file: 'Rechnung_Hetzner_R9821.pdf', size: '420 KB', meta: 'Server & Hosting', kind: 'PDF', current: 2, state: 'verarbeitet', progressNote: 'Extraktion 80 %' },
  { id: 'q3', file: 'Tankstelle_Aral_Scan.png', size: '880 KB', meta: 'Tankquittung', kind: 'PNG', current: 1, state: 'fehler' },
]

function StepDot({ index, item }: { index: number; item: QueueItem }) {
  const done = index < item.current
  const failed = item.state === 'fehler' && index === item.current
  const active = !done && !failed && index === item.current

  const base = 'flex h-6 w-6 items-center justify-center rounded-full text-[14px]'
  if (failed) {
    return (
      <span className={`${base} bg-[#FEE2E2] text-[#DC2626]`}>
        <Icon name="close" className="text-[14px]" />
      </span>
    )
  }
  if (done) {
    return (
      <span className={`${base} bg-tertiary text-white`}>
        <Icon name="check" className="text-[14px]" />
      </span>
    )
  }
  return (
    <span
      className={`${base} ${active ? 'border-2 border-primary text-primary' : 'border border-outline-variant text-on-surface-variant'}`}
    >
      {index + 1}
    </span>
  )
}

function QueueRow({ item }: { item: QueueItem }) {
  const accent =
    item.state === 'fehler' ? 'border-l-2 border-l-[#DC2626]' : item.state === 'verarbeitet' ? 'border-l-2 border-l-primary' : ''

  return (
    <Card className={`!p-4 ${accent}`}>
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-container text-label-sm text-on-surface-variant">
          {item.kind}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-label-md text-on-surface">{item.file}</p>
            {item.state === 'bereit' && (
              <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-label-sm text-[#16A34A]">Bereit</span>
            )}
            {item.state === 'verarbeitet' && (
              <span className="rounded-full bg-secondary-container px-2 py-0.5 text-label-sm text-on-secondary-container">
                Verarbeitet
              </span>
            )}
            {item.state === 'fehler' && (
              <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-label-sm text-[#DC2626]">
                Erkennung fehlgeschlagen
              </span>
            )}
          </div>
          <p className="mt-0.5 text-body-sm text-on-surface-variant">
            {item.size} · {item.meta}
          </p>
        </div>

        {/* 4-step pipeline */}
        <div className="flex items-center gap-3">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <StepDot index={i} item={item} />
              <span className="text-label-sm text-on-surface-variant">
                {i + 1}. {label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {item.state === 'fehler' ? (
            <>
              <button className="rounded-lg border border-outline-variant px-3 py-2 text-label-md text-on-surface transition-colors hover:bg-surface-container-low">
                Manuell erfassen
              </button>
              <button className="flex items-center gap-1.5 rounded-lg bg-primary-container px-3 py-2 text-label-md text-on-primary transition-opacity hover:opacity-95">
                <Icon name="refresh" className="text-[18px]" />
                Erneut versuchen
              </button>
            </>
          ) : item.state === 'bereit' ? (
            <button className="flex items-center gap-1.5 rounded-lg bg-primary-container px-3 py-2 text-label-md text-on-primary transition-opacity hover:opacity-95">
              Jetzt prüfen
              <Icon name="arrow_forward" className="text-[18px]" />
            </button>
          ) : (
            <span className="text-label-sm text-on-surface-variant">{item.progressNote}</span>
          )}
        </div>
      </div>

      {item.state === 'fehler' && (
        <div className="mt-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3">
          <p className="text-body-sm font-medium text-[#B91C1C]">Bild zu unscharf – bitte erneut aufnehmen.</p>
          <p className="mt-0.5 text-body-sm text-[#DC2626]">
            Der OCR-Algorithmus konnte Steuernummer und Endbetrag nicht zweifelsfrei auflösen. Verwende besseres Licht
            oder erfasse den Beleg manuell.
          </p>
        </div>
      )}
    </Card>
  )
}

export function Upload() {
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
          WebAssembly-KI bereit (Lokal v2.4)
        </span>
      </div>

      <Card>
        <div className="rounded-xl border-2 border-dashed border-primary/40 bg-surface-container-low p-10 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-surface-container-lowest shadow-sm">
            <Icon name="description" className="text-[26px] text-primary" />
          </span>
          <p className="text-headline-sm text-on-surface">Belege hierher ziehen oder Datei auswählen</p>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Ziehe Belege gleichzeitig in dieses Feld für automatischen Batch-Import.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {['JPG', 'PNG', 'PDF', 'ZUGFeRD / XRechnung'].map((f) => (
              <span key={f} className="rounded-full bg-surface-container-high px-2.5 py-1 text-label-sm text-on-surface-variant">
                {f}
              </span>
            ))}
            <span className="text-label-sm text-on-surface-variant">max. 25 MB</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-outline-variant px-4 py-2 text-label-md text-on-surface transition-colors hover:bg-surface-container-low">
            <Icon name="photo_camera" className="text-[18px]" />
            Mit Kamera aufnehmen
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-outline-variant px-4 py-2 text-label-md text-on-surface transition-colors hover:bg-surface-container-low">
            <Icon name="mail" className="text-[18px]" />
            Aus E-Mail importieren
          </button>
        </div>
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-headline-sm text-on-surface">Upload-Warteschlange</h2>
            <span className="rounded-full bg-secondary-container px-2.5 py-0.5 text-label-sm text-on-secondary-container">
              3 Belege in Bearbeitung
            </span>
          </div>
          <span className="text-label-sm text-on-surface-variant">
            4-Schritte-Pipeline: Zuschneiden → OCR → Extraktion → Prüfung
          </span>
        </div>

        <div className="space-y-space-sm">
          {QUEUE.map((item) => (
            <QueueRow key={item.id} item={item} />
          ))}
        </div>
      </div>

      <Card className="!bg-surface-container-low">
        <div className="flex items-start gap-3">
          <Icon name="lock" className="mt-0.5 text-[20px] text-primary" />
          <div>
            <p className="text-label-md text-on-surface">Deine Belege verlassen nie deinen Rechner.</p>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Alle Berechnungen, OCR und Datenextraktion laufen 100 % clientseitig im WebAssembly-/Lokalkern deines
              Browsers. Keine externen API-Aufrufe, keine Server-Uploads, vollständige Wahrung der
              Steuergeheimnisse nach GoBD und DSGVO.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
