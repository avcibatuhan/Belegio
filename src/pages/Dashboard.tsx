import { Link } from 'react-router-dom'
import { Card, CardHeader } from '../components/Card'
import { Icon } from '../components/Icon'
import { CATEGORY_SPLIT, MONTHLY_SPEND } from '../lib/mockData'
import { formatEur } from '../lib/format'

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

/** Pure-SVG donut so the chart carries no extra dependency. */
function Donut() {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <svg viewBox="0 0 140 140" className="h-40 w-40 -rotate-90" role="img" aria-label="Ausgaben nach Kategorie">
      {CATEGORY_SPLIT.map((slice) => {
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
  const max = Math.max(...MONTHLY_SPEND.map((m) => m.value))
  const total = CATEGORY_SPLIT.reduce((sum, c) => sum + c.value, 0)

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
          value={formatEur(2184.9)}
          hint="+12 % ggü. Vormonat"
          hintIcon="trending_up"
          hintClass="text-tertiary"
          icon="payments"
        />
        <MetricCard
          label="Vorsteuer"
          value={formatEur(348.12)}
          hint="100 % voll abzugsfähig"
          hintIcon="check_circle"
          icon="account_balance"
        />
        <MetricCard label="Belege" value="37" hint="gesamt im Monat erfasst" icon="receipt_long" />

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
            <p className="text-headline-lg tabular-nums text-[#B45309]">5</p>
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

      {/* Upload dropzone */}
      <Card className="border-2 border-dashed !border-outline-variant !bg-surface-container-low">
        <Link to="/upload" className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-container">
            <Icon name="cloud_upload" className="text-[24px] text-primary" />
          </span>
          <p className="text-headline-sm text-on-surface">Neuen Beleg hochladen</p>
          <p className="text-body-sm text-on-surface-variant">
            Dateien hier ablegen oder <span className="text-primary underline">klicken zum Auswählen</span>
          </p>
          <div className="mt-2 flex items-center gap-2">
            {['PDF', 'JPG', 'PNG', 'ZUGFeRD'].map((f) => (
              <span key={f} className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm text-on-surface-variant">
                {f}
              </span>
            ))}
            <span className="flex items-center gap-1 text-label-sm text-on-surface-variant">
              <Icon name="lock" className="text-[14px]" />
              Lokale OCR-Extraktion
            </span>
          </div>
        </Link>
      </Card>

      {/* Charts */}
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
            {MONTHLY_SPEND.map((m, i) => {
              const isLast = i === MONTHLY_SPEND.length - 1
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
              <Donut />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-label-sm text-on-surface-variant">Gesamt</span>
                <span className="text-label-md tabular-nums text-on-surface">{formatEur(total)}</span>
              </div>
            </div>
            <ul className="flex-1 space-y-2">
              {CATEGORY_SPLIT.map((c) => (
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
    </div>
  )
}
