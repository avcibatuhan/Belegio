import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardHeader } from '../components/Card'
import { Icon } from '../components/Icon'
import { UploadDropzone } from '../components/UploadDropzone'
import { formatEur } from '../lib/format'
import { useReceiptUpload } from '../lib/useReceiptUpload'
import { allReceipts, clearReceipts, type StoredReceipt } from '../lib/db'
// Loaded lazily and only in development, so it is absent from production builds.
const DevInspector = lazy(() =>
  import('../components/DevInspector').then((m) => ({ default: m.DevInspector })),
)

function MetricCard({
  label,
  value,
  hint,
  hintIcon,
  hintClass = 'text-on-surface-variant',
  icon,
}: {
  label: string
  value: string
  hint: string
  hintIcon?: string
  hintClass?: string
  icon: string
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <span className="text-label-md text-on-surface-variant">{label}</span>
        <Icon name={icon} className="text-[18px] text-on-surface-variant" />
      </div>
      <p className="mt-3 text-headline-lg tabular-nums text-on-surface">{value}</p>
      <p className={`mt-1 flex items-center gap-1 text-body-sm ${hintClass}`}>
        {hintIcon && <Icon name={hintIcon} className="text-[14px]" />}
        {hint}
      </p>
    </Card>
  )
}

type Slice = { label: string; value: number; share: number; color: string }

/** Pure-SVG donut so the chart carries no extra dependency. */
function Donut({ slices }: { slices: Slice[] }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <svg viewBox="0 0 140 140" className="h-40 w-40 -rotate-90" role="img" aria-label="Ausgaben nach Kategorie">
      {slices.map((slice) => {
        const length = slice.share * circumference
        const dash = `${length} ${circumference - length}`
        const el = (
          <circle
            key={slice.label}
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth="18"
            strokeDasharray={dash}
            strokeDashoffset={-offset}
          />
        )
        offset += length
        return el
      })}
    </svg>
  )
}

export function Dashboard() {
  const [stored, setStored] = useState<StoredReceipt[]>([])

  const reload = useCallback(() => {
    void allReceipts().then(setStored)
  }, [])

  useEffect(reload, [reload])

  const { jobs, addFiles, dismiss } = useReceiptUpload(reload)

  const clearAll = useCallback(async () => {
    await clearReceipts()
    reload()
  }, [reload])

  const [inspect, setInspect] = useState<StoredReceipt | null>(null)

  const live = stored.length > 0
  const liveGross = stored.reduce((s, r) => s + r.gross, 0)
  const liveVat = stored.reduce((s, r) => s + r.vatAmount, 0)
  const livePending = stored.filter((r) => r.status !== 'geprueft').length

  // Category split derived from the stored receipts, largest share first.
  const SLICE_COLORS = ['#0F766E', '#2A9D8F', '#5EC4B6', '#9AD9D0', '#CDE9E5']
  const liveCategories = Object.entries(
    stored.reduce<Record<string, number>>((acc, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + r.gross
      return acc
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value], i) => ({
      label,
      value,
      share: liveGross > 0 ? value / liveGross : 0,
      color: SLICE_COLORS[i % SLICE_COLORS.length],
    }))

  const categories = liveCategories
  const total = categories.reduce((sum, c) => sum + c.value, 0)

  // Spend grouped by the month each receipt is dated, oldest first.
  const byMonth = new Map<string, number>()
  for (const r of stored) {
    const key = r.date.slice(0, 7) // yyyy-mm
    byMonth.set(key, (byMonth.get(key) ?? 0) + r.gross)
  }
  const monthly = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([key, value]) => ({
      month: new Date(`${key}-01`).toLocaleDateString('de-DE', { month: 'short' }),
      value,
    }))
  const max = Math.max(...monthly.map((m) => m.value), 1)

  return (
    <div className="mx-auto max-w-[1200px] space-y-space-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-headline-lg text-on-surface">Guten Tag, Batuhan</h1>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Hier ist Ihre aktuelle GoBD-Finanzübersicht im Steuerjahr 2026.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-label-md text-on-surface transition-colors hover:bg-surface-container-low">
            <Icon name="calendar_month" className="text-[18px]" />
            September 2026
            <Icon name="expand_more" className="text-[18px]" />
          </button>
          <Link
            to="/upload"
            className="flex items-center gap-2 rounded-lg bg-primary-container px-3 py-2 text-label-md text-on-primary shadow-sm transition-opacity hover:opacity-95"
          >
            <Icon name="upload_file" className="text-[18px]" />
            Beleg hochladen
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-space-md">
        <MetricCard
          label="Ausgaben diesen Monat"
          value={formatEur(liveGross)}
          hint={`aus ${stored.length} erfassten Belegen`}
          hintIcon="receipt_long"
          icon="payments"
        />
        <MetricCard
          label="Vorsteuer"
          value={formatEur(liveVat)}
          hint="100 % voll abzugsfähig"
          hintIcon="check_circle"
          icon="account_balance"
        />
        <MetricCard
          label="Belege"
          value={String(stored.length)}
          hint="gesamt im Monat erfasst"
          icon="receipt_long"
        />

        {/* Attention card — amber, distinct from the metric cards */}
        <Card className="!border-[#FCD34D] !bg-[#FFFBEB]">
          <div className="flex items-start justify-between">
            <span className="flex items-center gap-1.5 text-label-md text-[#D97706]">
              <Icon name="warning" className="text-[18px]" />
              Zu prüfen
            </span>
            <span className="h-2 w-2 rounded-full bg-[#D97706]" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-headline-lg tabular-nums text-[#B45309]">{livePending}</p>
            <Link
              to="/belege"
              className="rounded-lg bg-[#D97706] px-3 py-1.5 text-label-sm text-white transition-opacity hover:opacity-95"
            >
              Jetzt prüfen
            </Link>
          </div>
          <p className="mt-1 text-body-sm text-[#92400E]">Belege erfordern manuelle Freigabe</p>
        </Card>
      </div>

      {/* Upload — processed in place, no navigation away from the dashboard */}
      <UploadDropzone jobs={jobs} onFiles={addFiles} onDismiss={dismiss} />

      {!live && jobs.length === 0 && (
        <Card className="!bg-surface-container-low">
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Icon name="insights" className="text-[32px] text-on-surface-variant" />
            <p className="text-headline-sm text-on-surface">Noch keine Auswertung</p>
            <p className="max-w-md text-body-sm text-on-surface-variant">
              Lade oben deinen ersten Beleg hoch. Sobald er verarbeitet ist, erscheinen hier deine Ausgaben,
              die Vorsteuer und die Aufschlüsselung nach Kategorie.
            </p>
          </div>
        </Card>
      )}

      {/* Charts — only meaningful once receipts exist */}
      {live && (
      <div className="grid grid-cols-3 gap-space-md">
        <Card className="col-span-2">
          <CardHeader
            title="Ausgaben nach Monat"
            subtitle="Rückblick über die letzten 6 Kalendermonate"
            action={
              <span className="rounded-full bg-secondary-container px-2.5 py-1 text-label-sm text-on-secondary-container">
                Halbjahr 2026
              </span>
            }
          />
          <div className="flex h-56 items-end justify-between gap-4 px-2">
            {monthly.map((m, i) => {
              const isLast = i === monthly.length - 1
              return (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
                  {isLast && (
                    <span className="text-label-sm tabular-nums text-on-surface">{formatEur(m.value)}</span>
                  )}
                  <div
                    className={`w-full rounded-t-lg ${isLast ? 'bg-primary' : 'bg-secondary-container'}`}
                    style={{ height: `${(m.value / max) * 170}px` }}
                  />
                  <span className="text-label-sm text-on-surface-variant">{m.month}</span>
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Nach Kategorie"
            subtitle="Aufschlüsselung im September"
            action={<span className="text-label-sm text-on-surface-variant">100 % zugeordnet</span>}
          />
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <Donut slices={categories} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-label-sm text-on-surface-variant">Gesamt</span>
                <span className="text-label-md tabular-nums text-on-surface">{formatEur(total)}</span>
              </div>
            </div>
            <ul className="flex-1 space-y-2">
              {categories.map((c) => (
                <li key={c.label} className="flex items-center gap-2 text-body-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="flex-1 text-on-surface-variant">
                    {c.label} ({Math.round(c.share * 100)} %)
                  </span>
                  <span className="tabular-nums text-on-surface">{formatEur(c.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
      )}

      {/* Developer panel: inspect what the OCR and parser actually did. */}
      {import.meta.env.DEV && stored.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
              Dev
            </span>
            <h2 className="text-headline-sm text-on-surface">Gespeicherte Belege ({stored.length})</h2>
            <span className="text-body-sm text-on-surface-variant">
              — zum Prüfen anklicken: erkannte Felder, Ablauf und OCR-Rohtext
            </span>
            <button
              onClick={() => void clearAll()}
              className="ml-auto rounded-lg border border-error/30 px-3 py-1.5 text-label-sm text-error transition-colors hover:bg-error-container"
            >
              Alle löschen
            </button>
          </div>
          <div className="space-y-1.5">
            {stored.map((r) => {
              const weak = r.diagnostics
                ? Object.entries(r.diagnostics.fields).filter(
                    ([, f]) => f.source === 'fehlt' || f.source === 'geraten',
                  )
                : []
              return (
                <button
                  key={r.id}
                  onClick={() => setInspect(r)}
                  className="flex w-full items-center gap-3 rounded-lg border border-outline-variant p-2.5 text-left transition-colors hover:bg-surface-container-low"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: r.arithmeticValid ? '#16A34A' : '#DC2626' }}
                  />
                  <span className="min-w-0 flex-1 truncate text-label-md text-on-surface">{r.merchant}</span>
                  <span className="shrink-0 text-body-sm tabular-nums text-on-surface-variant">
                    {formatEur(r.gross)}
                  </span>
                  <span className="shrink-0 text-body-sm text-on-surface-variant">{r.category}</span>
                  {weak.length > 0 && (
                    <span className="shrink-0 rounded bg-[#FEF3C7] px-1.5 py-0.5 text-[11px] text-[#B45309]">
                      {weak.length} unsicher
                    </span>
                  )}
                  <span className="shrink-0 text-body-sm tabular-nums text-on-surface-variant">
                    {Math.round(r.confidence.overall * 100)} %
                  </span>
                  <Icon name="chevron_right" className="shrink-0 text-[18px] text-on-surface-variant" />
                </button>
              )
            })}
          </div>
        </Card>
      )}

      {import.meta.env.DEV && inspect && (
        <Suspense fallback={null}>
          <DevInspector receipt={inspect} onClose={() => setInspect(null)} />
        </Suspense>
      )}
    </div>
  )
}
