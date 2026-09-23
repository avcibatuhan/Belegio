import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './Icon'
import { ReceiptThumb } from './ReceiptThumb'
import { useReceipts } from '../lib/store'
import { formatDate, formatEur } from '../lib/format'

export function Topbar() {
  const receipts = useReceipts()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // Close the results when clicking anywhere else.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const q = query.trim().toLowerCase()
  const hits = q
    ? receipts
        .filter(
          (r) =>
            r.merchant.toLowerCase().includes(q) ||
            r.category.toLowerCase().includes(q) ||
            r.gross.toFixed(2).replace('.', ',').includes(q),
        )
        .slice(0, 6)
    : []

  const pending = receipts.filter((r) => r.status !== 'geprueft').length

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-outline-variant bg-surface px-margin">
      <div ref={boxRef} className="relative flex-1 max-w-md">
        <Icon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant"
        />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Belege, Händler oder Beträge suchen…"
          className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2 pl-10 pr-3 text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[#0F766E26]"
        />

        {open && q.length > 0 && (
          <div className="absolute left-0 top-full z-30 mt-1 w-full overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-lg">
            {hits.length === 0 ? (
              <p className="px-3 py-3 text-body-sm text-on-surface-variant">Keine Treffer für „{query}"</p>
            ) : (
              hits.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    navigate(`/belege/${r.id}/pruefen`)
                    setQuery('')
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-container-low"
                >
                  <ReceiptThumb blob={r.image} className="h-8 w-8 shrink-0 rounded border border-outline-variant" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-label-md text-on-surface">{r.merchant}</span>
                    <span className="block text-label-sm text-on-surface-variant">
                      {formatDate(r.date)} · {r.category}
                    </span>
                  </span>
                  <span className="shrink-0 text-label-md tabular-nums text-on-surface">{formatEur(r.gross)}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => navigate('/einstellungen')}
          className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low"
          title="Hilfe & Einstellungen"
        >
          <Icon name="help" />
        </button>

        <button
          onClick={() => navigate('/pruefen')}
          className="relative rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low"
          title={pending > 0 ? `${pending} Beleg(e) zu prüfen` : 'Keine offenen Belege'}
        >
          <Icon name="notifications" />
          {pending > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D97706] px-1 text-[10px] font-semibold text-white">
              {pending}
            </span>
          )}
        </button>

        <button
          onClick={() => navigate('/export')}
          className="flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-label-md text-on-surface transition-colors hover:bg-surface-container-low"
        >
          <Icon name="ios_share" className="text-[18px]" />
          <span>Export</span>
        </button>

        <div className="ml-2 flex items-center gap-2 border-l border-outline-variant pl-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-container text-label-sm font-semibold text-on-primary">
            BK
          </div>
          <div className="leading-tight">
            <span className="block text-label-sm font-medium text-on-surface">Batuhan K.</span>
            <span className="block text-label-sm text-on-surface-variant">Freiberufler</span>
          </div>
        </div>
      </div>
    </header>
  )
}
