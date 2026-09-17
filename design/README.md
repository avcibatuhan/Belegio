# Belegio — Design Reference

Source: Google Stitch project `17604711462264700099` ("Belegio Receipt Scanner App").
Theme: **Precision Fiscal** — light, Inter, primary teal `#0F766E`.
Design system asset: `assets/7e682f544f1f434384d2809358fd9c5c`.

All UI copy is **German**. Product positioning: *GoBD-konform & Lokal* — OCR and
extraction run locally in the browser (WebAssembly); no server uploads.

## Screens

| # | File | Screen | Purpose |
|---|------|--------|---------|
| 1 | `01-dashboard` | Übersicht | KPIs (Ausgaben, Vorsteuer, Belege), upload dropzone, Ausgaben-nach-Monat bars, Nach-Kategorie donut, "Zu prüfen" alert |
| 2 | `02-upload` | Beleg hochladen | Batch dropzone (JPG/PNG/PDF/ZUGFeRD, max 25 MB) + queue showing the 4-step pipeline: Zuschneiden → OCR → Extraktion → Prüfung |
| 3 | `03-review` | Beleg prüfen | Split view — scan viewer (zoom/rotate, "Erkannte Bereiche") left; extracted fields right with per-field confidence, MwSt-Satz selector, validation ("Rechnerisch exakt validiert") |
| 4 | `04-list` | Belegarchiv | Filterable table (Händler, Datum, Kategorie, MwSt-Satz, Netto, Brutto, Status), bulk select + actions, pagination, GoBD-status footer |
| 5 | `05-export` | Export | 3-step wizard: Zeitraum → Format & Optionen (CSV / PDF-Paket / DATEV-CSV SKR03·SKR04) → Download; live summary sidebar |

## Files

- `screens/*.png` — reference screenshots
- `html/*.html` — Stitch-generated Tailwind HTML (full token config in `<script id="tailwind-config">`)
- `DESIGN.md` — color, typography and component spec
- `manifest.json` — screen id ↔ slug ↔ title

## Key tokens

```
primary            #005c55    primary-container   #0f766e
surface            #faf8ff    on-surface          #131b2e
surface-container  #eaedff    outline-variant     #bdc9c6
error              #ba1a1a    tertiary            #005f26
```

Status chips: Geprüft `#DCFCE7`/`#16A34A` · Prüfung ausstehend `#FEF3C7`/`#D97706` · Fehlerhaft `#FEE2E2`/`#DC2626`.

## Re-fetching from Stitch

`list_screens` returns `htmlCode`/`screenshot` as objects holding a `downloadUrl` —
fetch that URL separately to get the real bytes.
