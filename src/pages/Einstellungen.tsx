import { useState } from 'react'
import { Card, CardHeader } from '../components/Card'
import { Icon } from '../components/Icon'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useReceipts, removeAllReceipts } from '../lib/store'
import { toCsv, downloadText } from '../lib/exporters'
import { formatEur } from '../lib/format'

export function Einstellungen() {
  const receipts = useReceipts()
  const [confirmClear, setConfirmClear] = useState(false)

  const bytes = receipts.reduce((s, r) => s + (r.image?.size ?? 0), 0)
  const mb = (bytes / 1024 / 1024).toFixed(1).replace('.', ',')
  const gross = receipts.reduce((s, r) => s + r.gross, 0)

  return (
    <div className="mx-auto max-w-[900px] space-y-space-md">
      <div>
        <h1 className="text-headline-lg text-on-surface">Einstellungen</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Lokale Daten verwalten und nachvollziehen, wie Belegio arbeitet.
        </p>
      </div>

      <Card>
        <CardHeader title="Gespeicherte Daten" subtitle="Alles liegt ausschließlich in diesem Browser." />
        <div className="grid grid-cols-3 gap-space-md">
          {[
            ['Belege', String(receipts.length)],
            ['Belegbilder', `${mb} MB`],
            ['Summe brutto', formatEur(gross)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-outline-variant p-3">
              <p className="text-label-sm text-on-surface-variant">{label}</p>
              <p className="mt-1 text-headline-sm tabular-nums text-on-surface">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() =>
              downloadText(`belegio-sicherung-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(receipts))
            }
            disabled={receipts.length === 0}
            className="flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-label-md text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-40"
          >
            <Icon name="download" className="text-[18px]" />
            Daten als CSV sichern
          </button>
          <button
            onClick={() => setConfirmClear(true)}
            disabled={receipts.length === 0}
            className="flex items-center gap-2 rounded-lg border border-error/30 px-3 py-2 text-label-md text-error transition-colors hover:bg-error-container disabled:opacity-40"
          >
            <Icon name="delete_forever" className="text-[18px]" />
            Alle Belege löschen
          </button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Datenschutz" subtitle="Was den Rechner verlässt — und was nicht." />
        <ul className="space-y-2 text-body-md text-on-surface-variant">
          {[
            ['lock', 'Belegbilder und extrahierte Daten verlassen den Rechner nie.'],
            ['cloud_off', 'Keine Server-Uploads, keine Konten, kein Tracking.'],
            ['memory', 'Texterkennung läuft lokal: PaddleOCR-Modelle (~13 MB) liefert Belegio selbst aus.'],
            ['download', 'Einzige externe Anfrage: das Tesseract-Sprachmodell (einmalig, ~2 MB, danach im Cache).'],
            ['storage', 'Speicherort ist die IndexedDB dieses Browserprofils.'],
          ].map(([icon, text]) => (
            <li key={text} className="flex items-start gap-2">
              <Icon name={icon} className="mt-0.5 text-[18px] text-primary" />
              {text}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#FFFBEB] p-3 text-body-sm text-[#92400E]">
          <Icon name="warning" className="mt-0.5 text-[16px]" />
          Weil alles lokal liegt, gehen die Daten verloren, wenn du die Browserdaten löschst. Sichere regelmäßig
          per CSV-Export.
        </div>
      </Card>

      {confirmClear && (
        <ConfirmDialog
          title="Wirklich alle Belege löschen?"
          body={`${receipts.length} Beleg(e) samt Bildern werden endgültig entfernt. Sichere vorher per CSV, falls du die Daten noch brauchst.`}
          confirmLabel="Alles löschen"
          onConfirm={async () => {
            await removeAllReceipts()
            setConfirmClear(false)
          }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  )
}
