import { Icon } from './Icon'

type Props = {
  title: string
  body: string
  confirmLabel: string
  /** Destructive actions get a red button; anything else uses the primary colour. */
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  destructive = true,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-xl bg-surface-container-lowest p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: destructive ? '#FEE2E2' : '#DCFCE7' }}
          >
            <Icon
              name={destructive ? 'warning' : 'help'}
              className="text-[20px]"
              // Inline colour: these semantic reds are fixed by DESIGN.md.
            />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-headline-sm text-on-surface">{title}</h2>
            <p className="mt-1 text-body-md text-on-surface-variant">{body}</p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-outline-variant px-4 py-2 text-label-md text-on-surface transition-colors hover:bg-surface-container-low"
          >
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className="rounded-lg px-4 py-2 text-label-md text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: destructive ? '#DC2626' : '#0F766E' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
