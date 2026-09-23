/** The tax categories a receipt can be filed under, with their SKR03 accounts. */
export const CATEGORIES = [
  'Bewirtung',
  'Reise',
  'Fahrtkosten',
  'Software & Tools',
  'Telekommunikation',
  'Bürobedarf',
  'Sonstiges',
] as const

export type Category = (typeof CATEGORIES)[number]

/**
 * SKR03 account numbers, used by the DATEV export.
 * These are the common defaults for freelancers; a tax advisor may map differently.
 */
export const SKR03: Record<string, string> = {
  'Bewirtung': '4650',
  'Reise': '4670',
  'Fahrtkosten': '4530',
  'Software & Tools': '4980',
  'Telekommunikation': '4920',
  'Bürobedarf': '4930',
  'Sonstiges': '4900',
}

export const VAT_RATES = [0.19, 0.07, 0] as const
