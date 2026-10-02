import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../components/Card'
import { Icon } from '../components/Icon'
import { StatusChip } from '../components/StatusChip'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ReceiptThumb } from '../components/ReceiptThumb'
import { formatDate, formatEur, formatVatRate } from '../lib/format'
import { useReceipts, useReceiptActions, removeReceipts } from '../lib/store'
import { CATEGORIES } from '../lib/categories'
import { toCsv, downloadText } from '../lib/exporters'

type StatusFilter = 'alle' | 'geprueft' | 'zu-pruefen'
type SortKey = 'date' | 'merchant' | 'gross'

export function Belege() {
  const receipts = useReceipts()
  const { markVerified, setCategory } = useReceiptActions()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('alle')
  const [category, setCategoryFilter] = useState<string>('')
  const [vatFilter, setVatFilter] = useState<string>('')
  const [sort, setSort] = useState<SortKey>('date')
  const [asc, setAsc] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [categoryMenu, setCategoryMenu] = useState(false)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = receipts.filter((r) => {
      if (status === 'geprueft' && r.status !== 'geprueft') return false
      if (status === 'zu-pruefen' && r.status === 'geprueft') return false
      if (category && r.category !== category) return false
      if (vatFilter && String(Math.round(r.vatRate * 100)) !== vatFilter) return false
      if (!q) return true
      // Searching the amount as well makes "49,80" find the receipt.
      return (
        r.merchant.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.note.toLowerCase().includes(q) ||
        r.gross.toFixed(2).replace('.', ',').includes(q)
      )
    })

    return rows.sort((a, b) => {
      const dir = asc ? 1 : -1
      if (sort === 'merchant') return dir * a.merchant.localeCompare(b.merchant, 'de')
      if (sort === 'gross') return dir * (a.gross - b.gross)
      return dir * a.date.localeCompare(b.date)
    })
  }, [receipts, query, status, category, vatFilter, sort, asc])

  const selectedRows = visible.filter((r) => selected.has(r.id))
  const totals = selectedRows.reduce(
    (acc, r) => ({ net: acc.net + r.net, vat: acc.vat + r.vatAmount, gross: acc.gross + r.gross }),
    { net: 0, vat: 0, gross: 0 },
  )

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allVisibleSelected ? new Set() : new Set(visible.map((r) => r.id)))
  }

  function sortBy(key: SortKey) {
    if (sort === key) setAsc(!asc)
    else {
      setSort(key)
      setAsc(key === 'merchant')
    }
  }

  async function doDelete() {
    await removeReceipts(selected)
    setSelected(new Set())
    setConfirmDelete(false)
  }

  function resetFilters() {
    setQuery('')
    setStatus('alle')
    setCategoryFilter('')
    setVatFilter('')
  }

  const filtersActive = Boolean(query || status !== 'alle' || category || vatFilter)

  const SortArrow = ({ k }: { k: SortKey }) =>
    sort === k ? <Icon name={asc ? 'arrow_upward' : 'arrow_downward'} className="text-[14px]" /> : null

  return (
    <div className="mx-auto max-w-[1280px] space-y-space-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-headline-lg text-on-surface">Belegarchiv</h1>
            <span className="rounded-full bg-secondary-container px-2.5 py-1 text-label-sm text-on-secondary-container">
              {receipts.length} Belege
            </span>
          </div>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Vollständig revisionssicher und revisionskonform nach GoBD strukturiert.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadText(`belegio-archiv-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(visible))}
            disabled={visible.length === 0}
            className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-label-md text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-40"
          >
            <Icon name="download" className="text-[18px]" />
            CSV export
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 rounded-lg bg-primary-container px-3 py-2 text-label-md text-on-primary shadow-sm transition-opacity hover:opacity-95"
          >
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
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nach Händler, Notiz oder Betrag suchen"
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2 pl-10 pr-3 text-body-md focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[#0F766E26]"
            />
          </label>

          <select
            value={category}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-label-md text-on-surface focus:border-primary focus:outline-none"
          >
            <option value="">Alle Kategorien</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={vatFilter}
            onChange={(e) => setVatFilter(e.target.value)}
            className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-label-md text-on-surface focus:border-primary focus:outline-none"
          >
            <option value="">MwSt.: Alle</option>
            <option value="19">19 %</option>
            <option value="7">7 %</option>
            <option value="0">0 %</option>
          </select>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {(
            [
              ['alle', `Alle (${receipts.length})`, undefined],
              ['geprueft', `Geprüft (${receipts.filter((r) => r.status === 'geprueft').length})`, '#16A34A'],
              ['zu-pruefen', `Zu prüfen (${receipts.filter((r) => r.status !== 'geprueft').length})`, '#D97706'],
            ] as const
          ).map(([value, label, dot]) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-label-sm transition-colors ${
                status === value
                  ? 'bg-primary-container text-on-primary'
                  : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {dot && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />}
              {label}
            </button>
          ))}
          {filtersActive && (
            <button onClick={resetFilters} className="ml-auto text-label-sm text-primary hover:underline">
              Filter zurücksetzen
            </button>
          )}
        </div>
      </Card>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="relative flex items-center gap-3 rounded-xl border border-primary/30 bg-secondary-container px-4 py-3">
          <Icon name="check_circle" className="text-[18px] text-primary" />
          <span className="text-label-md text-on-secondary-container">
            {selected.size} Belege ausgewählt · Summe {formatEur(totals.gross)}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setCategoryMenu((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-label-sm text-on-surface transition-colors hover:bg-surface-container-low"
              >
                <Icon name="sell" className="text-[16px]" />
                Kategorie ändern
              </button>
              {categoryMenu && (
                <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-outline-variant bg-surface-container-lowest py-1 shadow-lg">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={async () => {
                        await setCategory(selected, c)
                        setCategoryMenu(false)
                      }}
                      className="block w-full px-3 py-2 text-left text-label-md text-on-surface hover:bg-surface-container-low"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => void markVerified(selected)}
              className="flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-label-sm text-on-surface transition-colors hover:bg-surface-container-low"
            >
              <Icon name="task_alt" className="text-[16px]" />
              Als geprüft markieren
            </button>

            <button
              onClick={() =>
                downloadText(`belegio-auswahl-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(selectedRows))
              }
              className="flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-label-sm text-on-surface transition-colors hover:bg-surface-container-low"
            >
              <Icon name="ios_share" className="text-[16px]" />
              Exportieren (Auswahl)
            </button>

            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 rounded-lg border border-error/30 bg-error-container px-3 py-1.5 text-label-sm text-on-error-container transition-opacity hover:opacity-90"
            >
              <Icon name="delete" className="text-[16px]" />
              Löschen
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card className="!p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-outline-variant text-left text-label-sm uppercase tracking-[0.05em] text-[#64748B]">
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAll}
                  className="rounded border-outline text-primary focus:ring-primary"
                />
              </th>
              <th className="w-20 py-3">Vorschau</th>
              <th className="py-3">
                <button onClick={() => sortBy('merchant')} className="flex items-center gap-1 uppercase tracking-[0.05em] hover:text-on-surface">
                  Händler <SortArrow k="merchant" />
                </button>
              </th>
              <th className="w-28 py-3">
                <button onClick={() => sortBy('date')} className="flex items-center gap-1 uppercase tracking-[0.05em] hover:text-on-surface">
                  Datum <SortArrow k="date" />
                </button>
              </th>
              <th className="w-44 py-3">Kategorie</th>
              <th className="w-24 py-3 text-right">MwSt.-Satz</th>
              <th className="w-28 py-3 text-right">Netto</th>
              <th className="w-28 py-3 text-right">
                <button onClick={() => sortBy('gross')} className="ml-auto flex items-center gap-1 uppercase tracking-[0.05em] hover:text-on-surface">
                  Brutto <SortArrow k="gross" />
                </button>
              </th>
              <th className="w-36 py-3 pl-5">Status</th>
              <th className="w-10 py-3" />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const isSelected = selected.has(r.id)
              return (
                <tr
                  key={r.id}
                  className={`h-[52px] cursor-pointer border-b border-outline-variant text-body-md transition-colors hover:bg-[#F8FAFC] ${
                    isSelected ? 'border-l-2 border-l-primary bg-[#F0FDFA]' : ''
                  }`}
                  onClick={() => navigate(`/belege/${r.id}/pruefen`)}
                >
                  <td className="px-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(r.id)}
                      className="rounded border-outline text-primary focus:ring-primary"
                    />
                  </td>
                  <td>
                    <ReceiptThumb blob={r.image} className="h-9 w-9 rounded-md border border-outline-variant" />
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
                  <td className="pl-5">
                    <StatusChip status={r.status} />
                  </td>
                  <td>
                    <Icon name="chevron_right" className="text-[18px] text-on-surface-variant" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {visible.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Icon name="receipt_long" className="text-[32px] text-on-surface-variant" />
            <p className="text-headline-sm text-on-surface">
              {receipts.length === 0 ? 'Noch keine Belege' : 'Keine Treffer'}
            </p>
            <p className="text-body-sm text-on-surface-variant">
              {receipts.length === 0
                ? 'Lade auf der Übersicht einen Beleg hoch — er erscheint dann hier.'
                : 'Für diese Filter gibt es keine Belege.'}
            </p>
            {receipts.length > 0 && (
              <button onClick={resetFilters} className="mt-1 text-label-md text-primary hover:underline">
                Filter zurücksetzen
              </button>
            )}
          </div>
        )}

        {visible.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-body-sm text-on-surface-variant">
              {selected.size > 0 ? (
                <>
                  Auswahl-Summe · Netto {formatEur(totals.net)} · MwSt. {formatEur(totals.vat)} · Gesamt brutto{' '}
                  <span className="font-medium text-on-surface">{formatEur(totals.gross)}</span>
                </>
              ) : (
                <>
                  Gesamt · Netto {formatEur(visible.reduce((s, r) => s + r.net, 0))} · Brutto{' '}
                  <span className="font-medium text-on-surface">
                    {formatEur(visible.reduce((s, r) => s + r.gross, 0))}
                  </span>
                </>
              )}
            </span>
            <span className="text-body-sm text-on-surface-variant">
              Zeige {visible.length} von {receipts.length} Belegen
            </span>
          </div>
        )}
      </Card>

      {confirmDelete && (
        <ConfirmDialog
          title={`${selected.size} Beleg(e) löschen?`}
          body="Die Belege und ihre Bilder werden endgültig aus der lokalen Datenbank entfernt. Das kann nicht rückgängig gemacht werden."
          confirmLabel="Endgültig löschen"
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
