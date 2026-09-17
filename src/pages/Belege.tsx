import { Card } from '../components/Card'
import { Icon } from '../components/Icon'
import { StatusChip } from '../components/StatusChip'
import { RECEIPTS } from '../lib/mockData'
import { formatDate, formatEur, formatVatRate } from '../lib/format'

const SELECTED = new Set(['r1', 'r2', 'r3'])

export function Belege() {
  // Totals are derived from the selected rows so the bulk bar and the footer agree.
  const totals = RECEIPTS.filter((r) => SELECTED.has(r.id)).reduce(
    (acc, r) => ({ net: acc.net + r.net, vat: acc.vat + (r.gross - r.net), gross: acc.gross + r.gross }),
    { net: 0, vat: 0, gross: 0 },
  )

  return (
    <div className="mx-auto max-w-[1280px] space-y-space-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-headline-lg text-on-surface">Belegarchiv</h1>
            <span className="rounded-full bg-secondary-container px-2.5 py-1 text-label-sm text-on-secondary-container">
              37 Belege
            </span>
          </div>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Vollständig revisionssicher und revisionskonform nach GoBD strukturiert.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-label-md text-on-surface transition-colors hover:bg-surface-container-low">
            <Icon name="library_add" className="text-[18px]" />
            Stapel-Upload
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-primary-container px-3 py-2 text-label-md text-on-primary shadow-sm transition-opacity hover:opacity-95">
            <Icon name="add" className="text-[18px]" />
            Neuer Beleg
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card className="!p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[260px] flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant"
            />
            <input
              placeholder="Nach Händler, Notiz oder Betrag suchen"
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2 pl-10 pr-3 text-body-md focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[#0F766E26]"
            />
          </label>

          {[
            { icon: 'date_range', label: '01.09.2026 – 30.09.2026' },
            { icon: 'sell', label: 'Kategorien', badge: '3' },
            { icon: 'percent', label: 'MwSt.: Alle' },
          ].map((f) => (
            <button
              key={f.label}
              className="flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-label-md text-on-surface transition-colors hover:bg-surface-container-low"
            >
              <Icon name={f.icon} className="text-[18px]" />
              {f.label}
              {f.badge && (
                <span className="rounded-full bg-secondary-container px-1.5 text-label-sm text-on-secondary-container">
                  {f.badge}
                </span>
              )}
              <Icon name="expand_more" className="text-[16px]" />
            </button>
          ))}

          <div className="ml-auto flex items-center gap-1 rounded-lg border border-outline-variant p-0.5">
            <button className="flex items-center gap-1.5 rounded-md bg-secondary-container px-2.5 py-1.5 text-label-sm text-on-secondary-container">
              <Icon name="table_rows" className="text-[16px]" />
              Tabelle
            </button>
            <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-label-sm text-on-surface-variant">
              <Icon name="grid_view" className="text-[16px]" />
              Galerie
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {[
            { label: 'Alle (37)', active: true },
            { label: 'Geprüft (32)', dot: '#16A34A' },
            { label: 'Zu prüfen (5)', dot: '#D97706' },
          ].map((chip) => (
            <button
              key={chip.label}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-label-sm transition-colors ${
                chip.active
                  ? 'bg-primary-container text-on-primary'
                  : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {chip.dot && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chip.dot }} />}
              {chip.label}
            </button>
          ))}
          <button className="ml-auto text-label-sm text-primary hover:underline">Filter zurücksetzen</button>
        </div>
      </Card>

      {/* Bulk action bar */}
      <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-secondary-container px-4 py-3">
        <Icon name="check_circle" className="text-[18px] text-primary" />
        <span className="text-label-md text-on-secondary-container">
          {SELECTED.size} Belege ausgewählt · Summe {formatEur(totals.gross)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {[
            { icon: 'sell', label: 'Kategorie ändern' },
            { icon: 'task_alt', label: 'Als geprüft markieren' },
            { icon: 'ios_share', label: 'Exportieren (Auswahl)' },
          ].map((a) => (
            <button
              key={a.label}
              className="flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-label-sm text-on-surface transition-colors hover:bg-surface-container-low"
            >
              <Icon name={a.icon} className="text-[16px]" />
              {a.label}
            </button>
          ))}
          <button className="flex items-center gap-1.5 rounded-lg border border-error/30 bg-error-container px-3 py-1.5 text-label-sm text-on-error-container transition-opacity hover:opacity-90">
            <Icon name="delete" className="text-[16px]" />
            Löschen
          </button>
        </div>
      </div>

      {/* Table */}
      <Card className="!p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-outline-variant text-left text-label-sm uppercase tracking-[0.05em] text-[#64748B]">
              <th className="w-12 px-4 py-3">
                <input type="checkbox" className="rounded border-outline text-primary focus:ring-primary" />
              </th>
              <th className="w-20 py-3">Vorschau</th>
              <th className="py-3">Händler</th>
              <th className="w-28 py-3">Datum</th>
              <th className="w-44 py-3">Kategorie</th>
              <th className="w-24 py-3 text-right">MwSt.-Satz</th>
              <th className="w-28 py-3 text-right">Netto</th>
              <th className="w-28 py-3 text-right">Brutto</th>
              <th className="w-32 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {RECEIPTS.map((r) => {
              const selected = SELECTED.has(r.id)
              return (
                <tr
                  key={r.id}
                  className={`h-[52px] border-b border-outline-variant text-body-md transition-colors hover:bg-[#F8FAFC] ${
                    selected ? 'border-l-2 border-l-primary bg-[#F0FDFA]' : ''
                  }`}
                >
                  <td className="px-4">
                    <input
                      type="checkbox"
                      defaultChecked={selected}
                      className="rounded border-outline text-primary focus:ring-primary"
                    />
                  </td>
                  <td>
                    <div className="h-9 w-9 rounded-md border border-outline-variant bg-surface-container" />
                  </td>
                  <td>
                    <p className="text-label-md text-on-surface">{r.merchant}</p>
                    <p className="text-body-sm text-on-surface-variant">{r.note}</p>
                  </td>
                  <td className="tabular-nums text-on-surface-variant">{formatDate(r.date)}</td>
                  <td>
                    <span className="rounded-full bg-surface-container px-2.5 py-1 text-label-sm text-on-surface-variant">
                      {r.category}
                    </span>
                  </td>
                  <td className="text-right tabular-nums text-on-surface-variant">{formatVatRate(r.vatRate)}</td>
                  <td className="text-right tabular-nums text-on-surface">{formatEur(r.net)}</td>
                  <td className="text-right font-medium tabular-nums text-on-surface">{formatEur(r.gross)}</td>
                  <td className="pl-2">
                    <StatusChip status={r.status} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-body-sm text-on-surface-variant">
            Auswahl-Summe · Netto {formatEur(totals.net)} · MwSt. {formatEur(totals.vat)} · Gesamt brutto{' '}
            <span className="font-medium text-on-surface">{formatEur(totals.gross)}</span>
          </span>
          <div className="flex items-center gap-3">
            <span className="text-body-sm text-on-surface-variant">Zeige 1–10 von 37 Belegen</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4].map((p) => (
                <button
                  key={p}
                  className={`h-8 w-8 rounded-lg text-label-sm transition-colors ${
                    p === 1
                      ? 'bg-primary-container text-on-primary'
                      : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Footer status */}
      <div className="grid grid-cols-3 gap-space-md">
        <Card className="!p-4">
          <p className="text-label-sm text-on-surface-variant">Revisionssicherheit</p>
          <p className="mt-1 flex items-center gap-1.5 text-label-md text-on-surface">
            GoBD-Status: <span className="text-tertiary">Vollständig</span>
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-label-sm text-on-surface-variant">Finanzamt &amp; DATEV</p>
          <p className="mt-1 text-label-md text-on-surface">USt-Voranmeldung Q3</p>
        </Card>
        <Card className="!flex !items-center !justify-center !bg-surface-container-low">
          <span className="flex items-center gap-2 text-label-sm text-on-surface-variant">
            <Icon name="inventory_2" className="text-[18px]" />
            Referenzarchiv
          </span>
        </Card>
      </div>
    </div>
  )
}
