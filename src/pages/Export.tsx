import { Card } from '../components/Card'
import { Icon } from '../components/Icon'
import { formatEur } from '../lib/format'

const STEPS = [
  { n: 1, label: 'Schritt 1', title: 'Zeitraum' },
  { n: 2, label: 'Schritt 2', title: 'Format & Optionen' },
  { n: 3, label: 'Abschluss', title: 'Download & Übergabe' },
]

const FORMATS = [
  {
    id: 'csv',
    icon: 'table_view',
    title: 'CSV (Excel)',
    tag: '.csv / .xlsx',
    desc: 'Für eigene Tabellenkalkulation und EÜR-Übersichten. Beinhaltet alle Buchungsdaten, Steuersätze und Notizen.',
  },
  {
    id: 'pdf',
    icon: 'picture_as_pdf',
    title: 'PDF-Paket für Steuerberater',
    tag: 'ZIP-Archiv',
    badge: 'Empfohlen',
    desc: 'Alle Belege als durchsuchbare PDFs, sortiert nach Datum mit vorangestelltem Deckblatt und Summenblatt.',
    selected: true,
  },
  {
    id: 'datev',
    icon: 'account_balance',
    title: 'DATEV-kompatible CSV',
    tag: 'Buchungssatz',
    badge: 'Pro',
    desc: 'Direkter Buchungssatz nach SKR03 / SKR04 Kontenrahmen für reibungslose Übergabe an Kanzleien.',
  },
]

export function Export() {
  return (
    <div className="mx-auto max-w-[1200px] space-y-space-lg">
      <div>
        <h1 className="text-headline-lg text-on-surface">Steuer- &amp; Buchhaltungsexport</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Erstelle finanzamts- und DATEV-konforme Auswertungen für deinen Steuerberater oder die EÜR.
        </p>
      </div>

      {/* Stepper */}
      <Card className="!py-4">
        <ol className="flex items-center">
          {STEPS.map((s, i) => {
            const done = s.n === 1
            const active = s.n === 2
            return (
              <li key={s.n} className="flex flex-1 items-center gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-label-sm ${
                    done
                      ? 'bg-primary text-white'
                      : active
                        ? 'border-2 border-primary text-primary'
                        : 'border border-outline-variant text-on-surface-variant'
                  }`}
                >
                  {done ? <Icon name="check" className="text-[16px]" /> : s.n}
                </span>
                <div className="leading-tight">
                  <p className="text-label-sm text-on-surface-variant">{s.label}</p>
                  <p className={`text-label-md ${active || done ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                    {s.title}
                  </p>
                </div>
                {i < STEPS.length - 1 && <span className="mx-3 h-px flex-1 bg-outline-variant" />}
              </li>
            )
          })}
        </ol>
      </Card>

      <div className="grid grid-cols-[1fr_360px] gap-space-md">
        <div className="space-y-space-md">
          {/* Step 1 */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-headline-sm text-on-surface">1. Zeitraum festlegen</h2>
              <span className="text-label-sm tabular-nums text-on-surface-variant">01.09.2026 – 30.09.2026</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {['Dieser Monat (Sep 2026)', 'Letztes Quartal (Q2)', 'Jahr 2026'].map((p, i) => (
                <button
                  key={p}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-label-md transition-colors ${
                    i === 0
                      ? 'bg-primary-container text-on-primary'
                      : 'border border-outline-variant text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  {i === 0 && <Icon name="check" className="text-[16px]" />}
                  {p}
                </button>
              ))}
            </div>
            <button className="mt-2 flex items-center gap-1.5 text-label-sm text-primary hover:underline">
              <Icon name="tune" className="text-[16px]" />
              Benutzerdefiniert
            </button>
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
                    f.selected
                      ? 'border-primary bg-secondary-container/40'
                      : 'border-outline-variant hover:bg-surface-container-low'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    defaultChecked={f.selected}
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
            <div className="space-y-2">
              {[
                { label: 'Belegbilder an PDF anhängen', checked: true },
                { label: 'Beleg-IDs auf Kassenbons stempeln', checked: true },
                { label: 'Nur geprüfte Belege exportieren', checked: false },
              ].map((o) => (
                <label key={o.label} className="flex cursor-pointer items-center gap-2.5 text-body-md text-on-surface">
                  <input
                    type="checkbox"
                    defaultChecked={o.checked}
                    className="rounded border-outline text-primary focus:ring-primary"
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </Card>
        </div>

        {/* Live summary */}
        <div className="space-y-space-md">
          <Card className="!bg-inverse-surface !text-inverse-on-surface">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-headline-sm text-inverse-on-surface">Live-Zusammenfassung</h2>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-label-sm">Sep 2026</span>
            </div>

            <dl className="space-y-3 text-body-md">
              {[
                ['Anzahl Belege', '37 Belege'],
                ['Summe Netto', formatEur(1836.78)],
                ['Umsatzsteuer', formatEur(348.12)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-white/10 pb-2">
                  <dt className="text-white/70">{k}</dt>
                  <dd className="tabular-nums">{v}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1">
                <dt className="text-label-md">Gesamtbetrag Brutto</dt>
                <dd className="text-headline-md tabular-nums">{formatEur(2184.9)}</dd>
              </div>
            </dl>

            <div className="mt-4 rounded-lg bg-[#D97706]/15 p-3">
              <p className="flex items-start gap-1.5 text-body-sm text-[#FCD34D]">
                <Icon name="warning" className="mt-0.5 text-[16px]" />
                5 Belege noch nicht geprüft. Diese werden mit Status „vorläufig" exportiert.
              </p>
              <button className="mt-1.5 text-label-sm text-[#FCD34D] underline">Jetzt vor Export prüfen</button>
            </div>

            <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-3 text-label-md text-on-primary transition-opacity hover:opacity-95">
              <Icon name="download" className="text-[18px]" />
              Export erstellen (PDF + CSV)
            </button>

            <p className="mt-2 text-center text-label-sm text-white/60">Geschätzte Dateigröße: ca. 8,4 MB</p>
          </Card>

          <Card className="!bg-surface-container-low">
            <p className="flex items-start gap-2 text-body-sm text-on-surface-variant">
              <Icon name="verified_user" className="mt-0.5 text-[18px] text-primary" />
              Alle Exporte erfüllen die Anforderungen der GoBD für digitale Belegarchivierung.
            </p>
          </Card>

          <Card>
            <p className="text-label-md text-on-surface">Fragen zur DATEV-Übergabe?</p>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Lies unseren Leitfaden für Freiberufler oder teile den Link mit deiner Kanzlei.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
