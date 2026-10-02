import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '../components/Card'
import { Icon } from '../components/Icon'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ReceiptThumb } from '../components/ReceiptThumb'
import { formatEur } from '../lib/format'
import { useReceipts, updateReceipt, removeReceipt } from '../lib/store'
import { CATEGORIES } from '../lib/categories'
import type { StoredReceipt } from '../lib/db'

const inputClass =
  'w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[#0F766E26]'

/** "41,85" / "41.85" → 41.85 */
function parseAmount(raw: string): number {
  const n = Number.parseFloat(raw.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function amountToInput(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

function ConfidenceHint({ value, source }: { value: number; source?: string }) {
  const pct = Math.round(value * 100)
  const weak = source === 'geraten' || source === 'fehlt' || pct < 75
  return (
    <span
      className="flex items-center gap-1 text-label-sm"
      style={{ color: weak ? '#D97706' : '#16A34A' }}
    >
      <Icon name={weak ? 'warning' : 'check_circle'} className="text-[14px]" />
      {weak ? `Bitte prüfen (${pct} %)` : `Sicher (${pct} %)`}
    </span>
  )
}

export function Review() {
  const { id } = useParams<{ id: string }>()
  const receipts = useReceipts()
  const navigate = useNavigate()

  // Without an id, review the oldest unverified receipt — the "Jetzt prüfen" flow.
  const pending = useMemo(() => receipts.filter((r) => r.status !== 'geprueft'), [receipts])
  const receipt: StoredReceipt | undefined = id
    ? receipts.find((r) => r.id === id)
    : pending[pending.length - 1]

  const [merchant, setMerchant] = useState('')
  const [date, setDate] = useState('')
  const [category, setCategory] = useState('')
  const [net, setNet] = useState('')
  const [vatAmount, setVatAmount] = useState('')
  const [gross, setGross] = useState('')
  const [vatRate, setVatRate] = useState(0.19)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  // Load the receipt into the form whenever a different one is opened.
  useEffect(() => {
    if (!receipt) return
    setMerchant(receipt.merchant)
    setDate(receipt.date)
    setCategory(receipt.category)
    setNet(amountToInput(receipt.net))
    setVatAmount(amountToInput(receipt.vatAmount))
    setGross(amountToInput(receipt.gross))
    setVatRate(receipt.vatRate)
    setDirty(false)
    setSaved(false)
    setZoom(1)
    setRotation(0)
  }, [receipt?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const netNum = parseAmount(net)
  const vatNum = parseAmount(vatAmount)
  const grossNum = parseAmount(gross)
  const valid = grossNum > 0 && Math.abs(netNum + vatNum - grossNum) < 0.02

  function touch() {
    setDirty(true)
    setSaved(false)
  }

  /** Recomputes net and VAT from the gross when the rate changes. */
  function applyRate(rate: number) {
    setVatRate(rate)
    const g = parseAmount(gross)
    if (g > 0) {
      const n = g / (1 + rate)
      setNet(amountToInput(n))
      setVatAmount(amountToInput(g - n))
    }
    touch()
  }

  /** Fills whichever of the three amounts is implied by the other two. */
  function recalc() {
    const g = parseAmount(gross)
    if (g > 0) {
      const n = g / (1 + vatRate)
      setNet(amountToInput(n))
      setVatAmount(amountToInput(g - n))
      touch()
    }
  }

  async function save(markVerified: boolean) {
    if (!receipt) return
    await updateReceipt(receipt.id, {
      merchant: merchant.trim() || 'Unbekannter Händler',
      date,
      category,
      net: netNum,
      vatAmount: vatNum,
      gross: grossNum,
      vatRate,
      arithmeticValid: valid,
      status: markVerified ? 'geprueft' : receipt.status,
    })
    setDirty(false)
    setSaved(true)
  }

  async function saveAndNext() {
    await save(true)
    const rest = pending.filter((r) => r.id !== receipt?.id)
    if (rest.length > 0) navigate(`/belege/${rest[rest.length - 1].id}/pruefen`)
    else navigate('/belege')
  }

  async function doDelete() {
    if (!receipt) return
    await removeReceipt(receipt.id)
    setConfirmDelete(false)
    navigate('/belege')
  }

  if (!receipt) {
    return (
      <div className="mx-auto max-w-[700px]">
        <Card>
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <Icon name="task_alt" className="text-[32px] text-tertiary" />
            <p className="text-headline-sm text-on-surface">Nichts zu prüfen</p>
            <p className="text-body-sm text-on-surface-variant">
              {receipts.length === 0
                ? 'Lade zuerst auf der Übersicht einen Beleg hoch.'
                : 'Alle Belege sind geprüft.'}
            </p>
            <button
              onClick={() => navigate(receipts.length === 0 ? '/' : '/belege')}
              className="mt-2 rounded-lg bg-primary-container px-4 py-2 text-label-md text-on-primary"
            >
              {receipts.length === 0 ? 'Zur Übersicht' : 'Zum Archiv'}
            </button>
          </div>
        </Card>
      </div>
    )
  }

  const conf = receipt.confidence
  const diagFields = receipt.diagnostics?.fields

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="mb-4 flex items-center justify-between gap-4">
        <nav className="flex items-center gap-2 text-body-sm text-on-surface-variant">
          <button onClick={() => navigate('/belege')} className="hover:text-primary hover:underline">
            Belege
          </button>
          <Icon name="chevron_right" className="text-[16px]" />
          <span className="rounded-md bg-surface-container px-2 py-0.5 text-label-md text-on-surface">
            {receipt.merchant}
          </span>
        </nav>
        <span className="text-label-sm text-on-surface-variant">
          {pending.length > 0 ? `${pending.length} Beleg(e) zu prüfen` : 'Alle Belege geprüft'}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_440px] gap-space-md">
        {/* Scan viewer */}
        <Card className="!bg-surface-container-low">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high"
                title="Vergrößern"
              >
                <Icon name="zoom_in" className="text-[18px]" />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high"
                title="Verkleinern"
              >
                <Icon name="zoom_out" className="text-[18px]" />
              </button>
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high"
                title="Drehen"
              >
                <Icon name="rotate_right" className="text-[18px]" />
              </button>
              <button
                onClick={() => {
                  setZoom(1)
                  setRotation(0)
                }}
                className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high"
                title="Zurücksetzen"
              >
                <Icon name="restart_alt" className="text-[18px]" />
              </button>
              <span className="ml-1 text-label-sm tabular-nums text-on-surface-variant">
                {Math.round(zoom * 100)} %
              </span>
            </div>
            <span className="text-label-sm text-on-surface-variant">{receipt.note}</span>
          </div>

          <div className="flex min-h-[520px] items-start justify-center overflow-auto rounded-lg border border-outline-variant bg-[#F1F5F9] p-6">
            <ReceiptThumb
              blob={receipt.image}
              zoom={zoom}
              rotation={rotation}
              className="max-w-full rounded shadow-md transition-transform"
            />
          </div>
        </Card>

        {/* Extracted fields */}
        <div className="space-y-space-md">
          <Card>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-headline-sm text-on-surface">Extrahierte Belegdaten</h2>
                  <span
                    className="rounded-full px-2 py-0.5 text-label-sm"
                    style={
                      conf.overall >= 0.85
                        ? { backgroundColor: '#DCFCE7', color: '#16A34A' }
                        : { backgroundColor: '#FEF3C7', color: '#D97706' }
                    }
                  >
                    {Math.round(conf.overall * 100)} % Konfidenz
                  </span>
                </div>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  Automatisch vorbefüllt durch lokale On-Device-OCR. Bitte kurz bestätigen.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-label-md text-on-surface">Händler / Aussteller *</label>
                  <ConfidenceHint value={conf.merchant} source={diagFields?.['Händler']?.source} />
                </div>
                <input
                  className={inputClass}
                  value={merchant}
                  onChange={(e) => {
                    setMerchant(e.target.value)
                    touch()
                  }}
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-label-md text-on-surface">Belegdatum *</label>
                  <ConfidenceHint value={conf.date} source={diagFields?.['Datum']?.source} />
                </div>
                <input
                  type="date"
                  className={inputClass}
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value)
                    touch()
                  }}
                />
                {diagFields?.['Datum']?.source === 'geraten' && (
                  <p className="mt-1 flex items-start gap-1 text-body-sm text-[#92400E]">
                    <Icon name="info" className="mt-0.5 text-[14px]" />
                    Kein Datum auf dem Beleg erkannt — heutiges Datum eingesetzt. Bitte korrigieren.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-label-md text-on-surface">Steuer-Kategorie</label>
                <select
                  className={inputClass}
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value)
                    touch()
                  }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-outline-variant pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-label-sm uppercase tracking-[0.05em] text-on-surface-variant">
                    Beträge &amp; Vorsteuer
                  </p>
                  <button onClick={recalc} className="text-label-sm text-primary hover:underline">
                    Aus Brutto neu berechnen
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-label-md text-on-surface">Nettobetrag</label>
                    <div className="relative">
                      <input
                        className={`${inputClass} pr-12 text-right tabular-nums`}
                        value={net}
                        onChange={(e) => {
                          setNet(e.target.value)
                          touch()
                        }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-body-sm text-[#64748B]">
                        EUR
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-label-md text-on-surface">MwSt.-Satz (Umsatzsteuer)</label>
                    <div className="flex gap-2">
                      {([0.19, 0.07, 0] as const).map((rate) => (
                        <button
                          key={rate}
                          onClick={() => applyRate(rate)}
                          className={`flex-1 rounded-lg border px-2 py-2 text-label-sm transition-colors ${
                            vatRate === rate
                              ? 'border-primary bg-secondary-container text-on-secondary-container'
                              : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                          }`}
                        >
                          {rate === 0.19 ? '19 % (Standard)' : rate === 0.07 ? '7 % (Ermäßigt)' : '0 % (Steuerfrei)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-label-md text-on-surface">MwSt.-Betrag</label>
                      <div className="relative">
                        <input
                          className={`${inputClass} pr-12 text-right tabular-nums`}
                          value={vatAmount}
                          onChange={(e) => {
                            setVatAmount(e.target.value)
                            touch()
                          }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-body-sm text-[#64748B]">
                          EUR
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-label-md text-on-surface">Gesamtbetrag (Brutto)</label>
                      <div className="relative">
                        <input
                          className={`${inputClass} !border-primary !bg-secondary-container pr-12 text-right font-semibold tabular-nums`}
                          value={gross}
                          onChange={(e) => {
                            setGross(e.target.value)
                            touch()
                          }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-body-sm text-primary">
                          EUR
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-body-sm"
                  style={
                    valid
                      ? { backgroundColor: '#F0FDF4', color: '#15803D' }
                      : { backgroundColor: '#FEF2F2', color: '#B91C1C' }
                  }
                >
                  <Icon name={valid ? 'verified' : 'error'} className="text-[16px]" />
                  {valid
                    ? `Rechnerisch exakt validiert: ${formatEur(netNum)} + ${formatEur(vatNum)} = ${formatEur(grossNum)}`
                    : `Rechenprobe stimmt nicht: ${formatEur(netNum)} + ${formatEur(vatNum)} ≠ ${formatEur(grossNum)}`}
                </div>
              </div>
            </div>
          </Card>

          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2 [&>button]:whitespace-nowrap">
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-2.5 text-label-md text-error transition-colors hover:bg-error-container"
            >
              <Icon name="delete" className="text-[18px]" />
              Verwerfen
            </button>
            <button
              onClick={() => navigate('/belege')}
              className="flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-2.5 text-label-md text-on-surface transition-colors hover:bg-surface-container-low"
            >
              <Icon name="skip_next" className="text-[18px]" />
              Überspringen
            </button>
            <button
              onClick={() => void save(false)}
              disabled={!dirty}
              className="ml-auto rounded-lg border border-outline-variant px-3 py-2.5 text-label-md text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-40"
            >
              {saved && !dirty ? 'Gespeichert ✓' : 'Nur speichern'}
            </button>
            <button
              onClick={() => void saveAndNext()}
              className="flex items-center gap-1.5 rounded-lg bg-primary-container px-4 py-2.5 text-label-md text-on-primary shadow-sm transition-opacity hover:opacity-95"
            >
              Speichern &amp; nächster Beleg
              <Icon name="arrow_forward" className="text-[18px]" />
            </button>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Beleg verwerfen?"
          body={`"${receipt.merchant}" wird endgültig aus der lokalen Datenbank gelöscht.`}
          confirmLabel="Endgültig löschen"
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
