import { Card } from '../components/Card'
import { Icon } from '../components/Icon'
import { formatEur } from '../lib/format'

function FieldLabel({ children, confidence }: { children: string; confidence?: { text: string; tone: 'ok' | 'warn' } }) {
  return (
    <div className="mb-1 flex items-center justify-between">
      <label className="text-label-md text-on-surface">
        {children} <span className="text-error">*</span>
      </label>
      {confidence && (
        <span
          className="flex items-center gap-1 text-label-sm"
          style={{ color: confidence.tone === 'ok' ? '#16A34A' : '#D97706' }}
        >
          <Icon name={confidence.tone === 'ok' ? 'check_circle' : 'warning'} className="text-[14px]" />
          {confidence.text}
        </span>
      )}
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[#0F766E26]'

export function Review() {
  return (
    <div className="mx-auto max-w-[1280px]">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <nav className="flex items-center gap-2 text-body-sm text-on-surface-variant">
          <span>Belege</span>
          <Icon name="chevron_right" className="text-[16px]" />
          <span>Zu prüfen</span>
          <Icon name="chevron_right" className="text-[16px]" />
          <span className="rounded-md bg-surface-container px-2 py-0.5 text-label-md text-on-surface">REWE Markt GmbH</span>
        </nav>
        <span className="text-label-sm text-on-surface-variant">Beleg 1 von 5 zu prüfen</span>
      </div>

      <div className="grid grid-cols-[1fr_440px] gap-space-md">
        {/* Scan viewer */}
        <Card className="!bg-surface-container-low">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {['zoom_in', 'zoom_out', 'rotate_right', 'crop'].map((ic) => (
                <button
                  key={ic}
                  className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high"
                >
                  <Icon name={ic} className="text-[18px]" />
                </button>
              ))}
            </div>
            <span className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
              <span className="h-2 w-2 rounded-full bg-tertiary" />
              Erkannte Bereiche
            </span>
          </div>

          {/* Receipt facsimile — placeholder for the real scan canvas */}
          <div className="flex min-h-[520px] items-start justify-center rounded-lg border border-outline-variant bg-[#F1F5F9] p-6">
            <div className="w-[300px] rounded-md bg-white p-5 font-mono text-[11px] leading-relaxed text-slate-700 shadow-md">
              <p className="mb-3 text-center text-[13px] font-bold tracking-wide">REWE Markt GmbH</p>
              <p className="text-center text-[10px] text-slate-500">Filiale 764 · Berlin Prenzlauer Berg</p>
              <div className="my-3 border-t border-dashed border-slate-300" />
              <div className="space-y-1">
                <div className="flex justify-between"><span>Bio Espresso 500g</span><span>14,90</span></div>
                <div className="flex justify-between"><span>Premium Mostrichsoße</span><span>4,45</span></div>
                <div className="flex justify-between"><span>Tannenwasser Box</span><span>4,45</span></div>
                <div className="flex justify-between"><span>Bio Selleriesaft 1L</span><span>11,65</span></div>
                <div className="flex justify-between"><span>Hafermilch Barista 1L</span><span>2,20</span></div>
                <div className="flex justify-between"><span>Rosmarin, frisch</span><span>5,80</span></div>
              </div>
              <div className="my-3 border-t border-dashed border-slate-300" />
              <div className="flex justify-between"><span>Zwischensumme (Netto)</span><span>41,85 €</span></div>
              <div className="flex justify-between"><span>Gesamt MwSt. (7 %)</span><span>7,95 €</span></div>
              <div className="mt-2 rounded bg-emerald-50 px-2 py-1.5 ring-2 ring-emerald-500">
                <div className="flex justify-between text-[13px] font-bold"><span>SUMME EUR</span><span>49,80 €</span></div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-label-sm text-on-surface-variant">
            <span>Scanauflösung 300 DPI (elektronische OCR-Ebene)</span>
            <span>PDF-Hash: 4a2f8b9e…25cd</span>
          </div>
        </Card>

        {/* Extracted fields */}
        <div className="space-y-space-md">
          <Card>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-headline-sm text-on-surface">Extrahierte Belegdaten</h2>
                  <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-label-sm text-[#16A34A]">
                    94 % Konfidenz
                  </span>
                </div>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  Automatisch vorbefüllt durch lokale On-Device-OCR. Bitte kurz bestätigen.
                </p>
              </div>
              <button className="flex shrink-0 items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-2 text-label-sm text-on-surface transition-colors hover:bg-surface-container-low">
                <Icon name="refresh" className="text-[16px]" />
                Neu scannen
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <FieldLabel confidence={{ text: 'Sicher (96 %)', tone: 'ok' }}>Händler / Aussteller</FieldLabel>
                <input className={inputClass} defaultValue="REWE Markt GmbH" />
              </div>

              <div>
                <FieldLabel confidence={{ text: 'Bitte prüfen (71 %)', tone: 'warn' }}>Belegdatum</FieldLabel>
                <input
                  className={`${inputClass} !border-[#D97706] !bg-[#FFFBEB]`}
                  defaultValue="12.09.2026"
                />
                <p className="mt-1 flex items-start gap-1 text-body-sm text-[#92400E]">
                  <Icon name="info" className="mt-0.5 text-[14px]" />
                  Monatsformat unklar erkannt (9. 09. 2026 oder 12. Sept. 2026). Bitte mit Beleg abgleichen.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Steuer-Kategorie</FieldLabel>
                  <select className={inputClass} defaultValue="buero">
                    <option value="buero">Büro (Büromaterial &amp; Bedarf)</option>
                    <option value="bewirtung">Bewirtung</option>
                    <option value="reise">Reise</option>
                    <option value="software">Software &amp; Tools</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Zahlungsart</FieldLabel>
                  <select className={inputClass} defaultValue="ec">
                    <option value="ec">EC-Karte / Girocard</option>
                    <option value="kredit">Kreditkarte</option>
                    <option value="bar">Barzahlung</option>
                    <option value="ueberweisung">Überweisung</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-outline-variant pt-4">
                <p className="mb-3 text-label-sm uppercase tracking-[0.05em] text-on-surface-variant">
                  Beträge &amp; Vorsteuer
                </p>

                <div className="space-y-3">
                  <div>
                    <FieldLabel confidence={{ text: 'Sicher', tone: 'ok' }}>Nettobetrag</FieldLabel>
                    <div className="relative">
                      <input className={`${inputClass} pr-12 text-right tabular-nums`} defaultValue="41,85" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-body-sm text-[#64748B]">EUR</span>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-label-md text-on-surface">MwSt.-Satz (Umsatzsteuer)</label>
                    <div className="flex gap-2">
                      {['19 % (Standard)', '7 % (Ermäßigt)', '0 % (Steuerfrei)'].map((r, i) => (
                        <button
                          key={r}
                          className={`flex-1 rounded-lg border px-2 py-2 text-label-sm transition-colors ${
                            i === 1
                              ? 'border-primary bg-secondary-container text-on-secondary-container'
                              : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>MwSt.-Betrag</FieldLabel>
                      <div className="relative">
                        <input className={`${inputClass} pr-12 text-right tabular-nums`} defaultValue="7,95" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-body-sm text-[#64748B]">EUR</span>
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Gesamtbetrag (Brutto)</FieldLabel>
                      <div className="relative">
                        <input
                          className={`${inputClass} !border-primary !bg-secondary-container pr-12 text-right font-semibold tabular-nums`}
                          defaultValue="49,80"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-body-sm text-primary">EUR</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#F0FDF4] px-3 py-2 text-body-sm text-[#15803D]">
                  <Icon name="verified" className="text-[16px]" />
                  Rechnerisch exakt validiert: {formatEur(41.85)} + {formatEur(7.95)} = {formatEur(49.8)}
                </div>
              </div>
            </div>
          </Card>

          {/* Action bar */}
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-2.5 text-label-md text-error transition-colors hover:bg-error-container">
              <Icon name="delete" className="text-[18px]" />
              Verwerfen
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-2.5 text-label-md text-on-surface transition-colors hover:bg-surface-container-low">
              <Icon name="skip_next" className="text-[18px]" />
              Überspringen
            </button>
            <button className="ml-auto rounded-lg border border-outline-variant px-3 py-2.5 text-label-md text-on-surface transition-colors hover:bg-surface-container-low">
              Nur speichern
            </button>
            <button className="flex items-center gap-1.5 rounded-lg bg-primary-container px-4 py-2.5 text-label-md text-on-primary shadow-sm transition-opacity hover:opacity-95">
              Speichern &amp; nächster Beleg
              <Icon name="arrow_forward" className="text-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
