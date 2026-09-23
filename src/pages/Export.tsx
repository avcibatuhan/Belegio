import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../components/Card'
import { Icon } from '../components/Icon'
import { formatEur } from '../lib/format'
import { useReceipts } from '../lib/store'
import { toCsv, toDatev, toSummaryText, downloadText } from '../lib/exporters'

type Period = 'monat' | 'quartal' | 'jahr' | 'alle'
type Format = 'csv' | 'paket' | 'datev'

const FORMATS: { id: Format; icon: string; title: string; tag: string; badge?: string; desc: string }[] = [
  {
    id: 'csv',
    icon: 'table_view',
    title: 'CSV (Excel)',
    tag: '.csv',
    desc: 'Für eigene Tabellenkalkulation und EÜR-Übersichten. Beinhaltet alle Buchungsdaten, Steuersätze und Notizen.',
  },
  {
    id: 'paket',
    icon: 'description',
    title: 'Auswertung + CSV',
    tag: '.txt + .csv',
    badge: 'Empfohlen',
    desc: 'Eine lesbare Zusammenfassung mit Summen je Kategorie, zusammen mit der vollständigen CSV-Datei.',
  },
  {
    id: 'datev',
    icon: 'account_balance',
    title: 'DATEV-kompatible CSV',
    tag: 'Buchungssatz',
    desc: 'Buchungssätze nach SKR03-Kontenrahmen für die Übergabe an Kanzleien.',
  },
]

/** Start of the period, inclusive. */
function periodStart(period: Period, now: Date): string {
  const y = now.getFullYear()
  if (period === 'jahr') return `${y}-01-01`
  if (period === 'quartal') {
    const q = Math.floor(now.getMonth() / 3)
    return `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`
  }
  if (period === 'monat') return `${y}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  return '0000-01-01'
}

export function Export() {
  const receipts = useReceipts()
  const navigate = useNavigate()

  const [period, setPeriod] = useState<Period>('monat')
  const [format, setFormat] = useState<Format>('paket')
  const [onlyVerified, setOnlyVerified] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const now = new Date()
  const from = periodStart(period, now)

  const selected = useMemo(() => {
    return receipts
      .filter((r) => r.date >= from)
      .filter((r) => (onlyVerified ? r.status === 'geprueft' : true))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [receipts, from, onlyVerified])

  const net = selected.reduce((s, r) => s + r.net, 0)
  const vat = selected.reduce((s, r) => s + r.vatAmount, 0)
  const gross = selected.reduce((s, r) => s + r.gross, 0)
  const unverified = selected.filter((r) => r.status !== 'geprueft').length

  const periodLabel =
    period === 'monat'
      ? now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
      : period === 'quartal'
        ? `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`
        : period === 'jahr'
          ? String(now.getFullYear())
          : 'Alle Belege'

  function runExport() {
    if (selected.length === 0) return
    const stamp = new Date().toISOString().slice(0, 10)

    if (format === 'csv') {
      downloadText(`belegio-${stamp}.csv`, toCsv(selected))
      setDone(`belegio-${stamp}.csv`)
    } else if (format === 'datev') {
      downloadText(`belegio-datev-${stamp}.csv`, toDatev(selected))
      setDone(`belegio-datev-${stamp}.csv`)
    } else {
      downloadText(`belegio-auswertung-${stamp}.txt`, toSummaryText(selected, periodLabel), 'text/plain;charset=utf-8')
      // Give the browser a moment before the second download, or it may drop it.
      setTimeout(() => downloadText(`belegio-${stamp}.csv`, toCsv(selected)), 600)
      setDone(`belegio-auswertung-${stamp}.txt + .csv`)
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-space-lg">
      <div>
        <h1 className="text-headline-lg text-on-surface">Steuer- &amp; Buchhaltungsexport</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Erstelle finanzamts- und DATEV-konforme Auswertungen für deinen Steuerberater oder die EÜR.
        </p>
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-space-md">
        <div className="space-y-space-md">
          {/* Step 1 */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-headline-sm text-on-surface">1. Zeitraum festlegen</h2>
              <span className="text-label-sm tabular-nums text-on-surface-variant">
                ab {from === '0000-01-01' ? 'Beginn' : from.split('-').reverse().join('.')}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ['monat', `Dieser Monat (${now.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })})`],
                  ['quartal', `Dieses Quartal (Q${Math.floor(now.getMonth() / 3) + 1})`],
                  ['jahr', `Jahr ${now.getFullYear()}`],
                  ['alle', 'Alle Belege'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => {
                    setPeriod(value)
                    setDone(null)
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-label-md transition-colors ${
                    period === value
                      ? 'bg-primary-container text-on-primary'
                      : 'border border-outline-variant text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  {period === value && <Icon name="check" className="text-[16px]" />}
                  {label}
                </button>
              ))}
            </div>
          </Card>

          {/* Step 2 */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-headline-sm text-on-surface">2. Exportformat wählen</h2>
              <span className="text-label-sm text-on-surface-variant">1 ausgewählt</span>
            </div>
            <div className="space-y-2">
              {FORMATS.map((f) => (
                <label
                  key={f.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    format === f.id
                      ? 'border-primary bg-secondary-container/40'
                      : 'border-outline-variant hover:bg-surface-container-low'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    checked={format === f.id}
                    onChange={() => {
                      setFormat(f.id)
                      setDone(null)
                    }}
                    className="mt-1 text-primary focus:ring-primary"
                  />
                  <Icon name={f.icon} className="mt-0.5 text-[20px] text-primary" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-label-md text-on-surface">{f.title}</span>
                      {f.badge && (
                        <span className="rounded-full bg-primary-container px-2 py-0.5 text-label-sm text-on-primary">
                          {f.badge}
                        </span>
                      )}
                      <span className="ml-auto text-label-sm text-on-surface-variant">{f.tag}</span>
                    </div>
                    <p className="mt-1 text-body-sm text-on-surface-variant">{f.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </Card>

          {/* Step 3 */}
          <Card>
            <h2 className="mb-3 text-headline-sm text-on-surface">3. Einstellungen vor dem Export</h2>
            <label className="flex cursor-pointer items-center gap-2.5 text-body-md text-on-surface">
              <input
                type="checkbox"
                checked={onlyVerified}
                onChange={(e) => {
                  setOnlyVerified(e.target.checked)
                  setDone(null)
                }}
                className="rounded border-outline text-primary focus:ring-primary"
              />
              Nur geprüfte Belege exportieren
            </label>
            <p className="mt-2 text-body-sm text-on-surface-variant">
              Belegbilder werden noch nicht mitexportiert — das kommt mit dem PDF-Paket.
            </p>
          </Card>
        </div>

        {/* Live summary */}
        <div className="space-y-space-md">
          <Card className="!bg-inverse-surface !text-inverse-on-surface">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-headline-sm text-inverse-on-surface">Live-Zusammenfassung</h2>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-label-sm">{periodLabel}</span>
            </div>

            <dl className="space-y-3 text-body-md">
              {[
                ['Anzahl Belege', `${selected.length} Belege`],
                ['Summe Netto', formatEur(net)],
                ['Umsatzsteuer', formatEur(vat)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-white/10 pb-2">
                  <dt className="text-white/70">{k}</dt>
                  <dd className="tabular-nums">{v}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1">
                <dt className="text-label-md">Gesamtbetrag Brutto</dt>
                <dd className="text-headline-md tabular-nums">{formatEur(gross)}</dd>
              </div>
            </dl>

            {unverified > 0 && (
              <div className="mt-4 rounded-lg bg-[#D97706]/15 p-3">
                <p className="flex items-start gap-1.5 text-body-sm text-[#FCD34D]">
                  <Icon name="warning" className="mt-0.5 text-[16px]" />
                  {unverified} Beleg(e) noch nicht geprüft. Diese werden mit Status „vorläufig" exportiert.
                </p>
                <button
                  onClick={() => navigate('/pruefen')}
                  className="mt-1.5 text-label-sm text-[#FCD34D] underline"
                >
                  Jetzt vor Export prüfen
                </button>
              </div>
            )}

            <button
              onClick={runExport}
              disabled={selected.length === 0}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-3 text-label-md text-on-primary transition-opacity hover:opacity-95 disabled:opacity-40"
            >
              <Icon name="download" className="text-[18px]" />
              {selected.length === 0 ? 'Keine Belege im Zeitraum' : 'Export erstellen'}
            </button>

            {done && (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-label-sm text-[#9CF2E8]">
                <Icon name="check_circle" className="text-[14px]" />
                {done} heruntergeladen
              </p>
            )}
          </Card>

          <Card className="!bg-surface-container-low">
            <p className="flex items-start gap-2 text-body-sm text-on-surface-variant">
              <Icon name="verified_user" className="mt-0.5 text-[18px] text-primary" />
              Die Dateien werden lokal in deinem Browser erzeugt — es werden keine Daten übertragen.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
