import type { ReceiptStatus } from '../components/StatusChip'

export type Receipt = {
  id: string
  merchant: string
  note: string
  date: string
  category: string
  vatRate: number
  net: number
  gross: number
  status: ReceiptStatus
}

/** Placeholder rows mirroring the Stitch reference screens. Replaced by IndexedDB later. */
export const RECEIPTS: Receipt[] = [
  { id: 'r1', merchant: 'REWE Markt GmbH', note: 'Köln Filiale 764 · Bewirtung', date: '2026-09-12', category: 'Bewirtung', vatRate: 0.07, net: 41.85, gross: 44.78, status: 'geprueft' },
  { id: 'r2', merchant: 'Deutsche Bahn AG', note: 'ICE Berlin – Frankfurt · Hinfahrt', date: '2026-09-10', category: 'Reise', vatRate: 0.07, net: 119.75, gross: 128.13, status: 'geprueft' },
  { id: 'r3', merchant: 'Figma Inc.', note: 'Monatliche Professional · US-Reverse Charge', date: '2026-09-08', category: 'Software', vatRate: 0.19, net: 15.0, gross: 17.85, status: 'geprueft' },
  { id: 'r4', merchant: 'Telekom Deutschland GmbH', note: 'Business Glasfaser 250 · Sept 2026', date: '2026-09-04', category: 'Telekommunikation', vatRate: 0.19, net: 49.99, gross: 59.49, status: 'zu-pruefen' },
  { id: 'r5', merchant: 'Apple Distribution Int.', note: 'iCloud+ 2TB & Developer Program', date: '2026-09-02', category: 'Software', vatRate: 0.19, net: 9.99, gross: 11.89, status: 'geprueft' },
  { id: 'r6', merchant: 'Deutsche Bahn GmbH', note: 'Flex Desk Münsterdorf · September', date: '2026-09-01', category: 'Bürobedarf', vatRate: 0.19, net: 250.0, gross: 297.5, status: 'zu-pruefen' },
]

/** Monthly spend for the dashboard bar chart. */
export const MONTHLY_SPEND = [
  { month: 'Apr', value: 1620 },
  { month: 'Mai', value: 1740 },
  { month: 'Jun', value: 1585 },
  { month: 'Jul', value: 1690 },
  { month: 'Aug', value: 1610 },
  { month: 'Sep', value: 2184.9 },
]

/** Category split for the dashboard donut. */
export const CATEGORY_SPLIT = [
  { label: 'Büro', value: 764.72, share: 0.35, color: '#0F766E' },
  { label: 'Software & Tools', value: 611.77, share: 0.28, color: '#2A9D8F' },
  { label: 'Reise', value: 393.28, share: 0.18, color: '#5EC4B6' },
  { label: 'Bewirtung', value: 262.19, share: 0.12, color: '#9AD9D0' },
  { label: 'Sonstiges', value: 152.94, share: 0.07, color: '#CDE9E5' },
]
