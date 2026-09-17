import { Icon } from './Icon'

/** Extraction/verification states a receipt can be in. */
export type ReceiptStatus = 'geprueft' | 'zu-pruefen' | 'fehlerhaft'

/** Colours are fixed by DESIGN.md rather than the Material token set. */
const STYLES: Record<ReceiptStatus, { bg: string; fg: string; icon: string; label: string }> = {
  geprueft: { bg: '#DCFCE7', fg: '#16A34A', icon: 'check_circle', label: 'Geprüft' },
  'zu-pruefen': { bg: '#FEF3C7', fg: '#D97706', icon: 'schedule', label: 'Zu prüfen' },
  fehlerhaft: { bg: '#FEE2E2', fg: '#DC2626', icon: 'error', label: 'Fehlerhaft' },
}

export function StatusChip({ status, label }: { status: ReceiptStatus; label?: string }) {
  const s = STYLES[status]
  return (
    <span
      className="inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-label-sm font-medium"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      <Icon name={s.icon} className="text-[14px]" />
      {label ?? s.label}
    </span>
  )
}
