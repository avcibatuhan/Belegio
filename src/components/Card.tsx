import type { ReactNode } from 'react'

type CardProps = {
  children: ReactNode
  className?: string
}

/** White surface, 12px radius, 20px padding, subtle shadow — per DESIGN.md. */
export function Card({ children, className = '' }: CardProps) {
  return (
    <section
      className={`rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm ${className}`}
    >
      {children}
    </section>
  )
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-headline-sm text-on-surface">{title}</h2>
        {subtitle && <p className="mt-0.5 text-body-sm text-on-surface-variant">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
