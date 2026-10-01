import { useState } from 'react'
import { Icon } from './Icon'
import type { StoredReceipt } from '../lib/db'

/**
 * Developer-only panel: shows exactly what the OCR read, which fields the
 * parser resolved, how it resolved them, and what it could not find.
 *
 * This is a development aid, not part of the product UI. It is rendered only
 * when import.meta.env.DEV is true, so it never reaches a production build.
 */

const SOURCE_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  gelesen: { bg: '#DCFCE7', fg: '#15803D', label: 'gelesen' },
  berechnet: { bg: '#DBEAFE', fg: '#1D4ED8', label: 'berechnet' },
  geraten: { bg: '#FEF3C7', fg: '#B45309', label: 'geraten' },
  fehlt: { bg: '#FEE2E2', fg: '#B91C1C', label: 'fehlt' },
}

function SourceChip({ source }: { source: string }) {
  const s = SOURCE_STYLE[source] ?? SOURCE_STYLE.fehlt
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  )
}

function Bar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 85 ? '#16A34A' : pct >= 60 ? '#D97706' : '#DC2626'
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-200">
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </span>
      <span className="w-9 text-right tabular-nums text-[11px]" style={{ color }}>
        {pct} %
      </span>
    </span>
  )
}

export function DevInspector({ receipt, onClose }: { receipt: StoredReceipt; onClose: () => void }) {
  const [tab, setTab] = useState<'felder' | 'ablauf' | 'ocr'>('felder')
  const d = receipt.diagnostics

  const imageUrl = URL.createObjectURL(receipt.image)

  const missing = d ? Object.entries(d.fields).filter(([, f]) => f.source === 'fehlt' || f.source === 'geraten') : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
          <span className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
            Dev
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{receipt.note}</p>
            <p className="text-xs text-slate-500">
              {receipt.merchant} · {receipt.gross.toFixed(2)} € ·{' '}
              {d
                ? d.passes
                  ? `Lesen ${d.ocrMs} ms · ${d.passes.length} Durchgang/Durchgänge · Prüfung: ${d.verification}`
                  : `OCR ${d.ocrMs} ms · Parser ${d.parseMs ?? 0} ms`
                : 'keine Diagnosedaten'}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-slate-500 hover:bg-slate-200">
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        {/* Summary strip */}
        <div className="flex items-center gap-4 border-b border-slate-200 px-5 py-2.5 text-xs">
          <span className="flex items-center gap-1.5">
            <Icon
              name={receipt.arithmeticValid ? 'check_circle' : 'error'}
              className={`text-[16px] ${receipt.arithmeticValid ? 'text-green-600' : 'text-red-600'}`}
            />
            <span className={receipt.arithmeticValid ? 'text-green-700' : 'text-red-700'}>
              Rechenprobe {receipt.arithmeticValid ? 'bestanden' : 'fehlgeschlagen'}
            </span>
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-600">
            Gesamt-Konfidenz <strong>{Math.round(receipt.confidence.overall * 100)} %</strong>
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-600">
            Status <strong>{receipt.status}</strong>
          </span>
          {missing.length > 0 && (
            <>
              <span className="text-slate-400">|</span>
              <span className="text-amber-700">
                {missing.length} Feld(er) nicht sicher gelesen: {missing.map(([k]) => k).join(', ')}
              </span>
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 px-5 pt-2">
          {(
            [
              ['felder', 'Felder'],
              ['ablauf', 'Ablauf'],
              ['ocr', 'OCR-Rohtext'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-t px-3 py-1.5 text-xs font-medium ${
                tab === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="grid flex-1 grid-cols-[260px_1fr] gap-4 overflow-hidden p-5">
          <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
            <img src={imageUrl} alt="" className="w-full rounded" />
          </div>

          <div className="overflow-auto">
            {!d && <p className="text-sm text-slate-500">Für diesen Beleg wurden keine Diagnosedaten gespeichert.</p>}

            {d && tab === 'felder' && (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="py-2">Feld</th>
                    <th className="py-2">Wert</th>
                    <th className="py-2">Herkunft</th>
                    <th className="py-2">Konfidenz</th>
                    <th className="py-2" title="Tesseracts eigene Sicherheit für das gelesene Wort">OCR-Wort</th>
                    <th className="py-2">Belegzeile</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(d.fields).map(([name, f]) => (
                    <tr key={name} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-2 font-medium text-slate-700">{name}</td>
                      <td className="py-2 pr-2 font-mono text-slate-900">{f.value}</td>
                      <td className="py-2 pr-2">
                        <SourceChip source={f.source} />
                      </td>
                      <td className="py-2 pr-2">
                        <Bar value={f.confidence} />
                      </td>
                      <td className="py-2 pr-2">
                        {f.ocrConfidence !== undefined ? <Bar value={f.ocrConfidence} /> : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="py-2 font-mono text-[11px] text-slate-500">
                        {f.evidence ? `"${f.evidence}"` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {d && tab === 'ablauf' && d.passes && (
              <table className="mb-4 w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="py-1.5">Durchgang</th>
                    <th className="py-1.5">Prüfung</th>
                    <th className="py-1.5 text-right">Brutto</th>
                    <th className="py-1.5 text-right">OCR</th>
                    <th className="py-1.5 text-right">Bewertung</th>
                    <th className="py-1.5 text-right">Zeit</th>
                  </tr>
                </thead>
                <tbody>
                  {d.passes.map((p) => (
                    <tr key={p.name} className={`border-b border-slate-100 ${p.chosen ? 'bg-green-50 font-medium' : ''}`}>
                      <td className="py-1.5">{p.chosen ? '✓ ' : ''}{p.name}</td>
                      <td className="py-1.5" title={p.error}>
                        {p.error ? <span className="text-red-700">fehlgeschlagen</span> : p.verification}
                      </td>
                      <td className="py-1.5 text-right font-mono">{p.gross}</td>
                      <td className="py-1.5 text-right">{p.pageConfidence} %</td>
                      <td className="py-1.5 text-right font-mono">{p.score}</td>
                      <td className="py-1.5 text-right">{p.ms} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {d && tab === 'ablauf' && (
              <ol className="space-y-1.5 text-xs">
                {d.trace.map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-5 shrink-0 text-right tabular-nums text-slate-400">{i + 1}.</span>
                    <span className="text-slate-700">{step}</span>
                  </li>
                ))}
              </ol>
            )}

            {tab === 'ocr' && (
              <pre className="whitespace-pre-wrap rounded-lg bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
                {receipt.rawText || '(kein Text erkannt)'}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
