/** German locale formatting — Belegio's UI is German throughout. */

const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
})

const dateFmt = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** 2184.9 → "2.184,90 €" */
export function formatEur(value: number): string {
  return eur.format(value)
}

/** ISO date string → "17.09.2026" */
export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso))
}

/** 0.19 → "19 %" */
export function formatVatRate(rate: number): string {
  return `${Math.round(rate * 100)} %`
}
