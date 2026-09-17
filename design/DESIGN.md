---
name: Precision Fiscal
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3e4947'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6e7977'
  outline-variant: '#bdc9c6'
  surface-tint: '#006a63'
  primary: '#005c55'
  on-primary: '#ffffff'
  primary-container: '#0f766e'
  on-primary-container: '#a3faef'
  inverse-primary: '#80d5cb'
  secondary: '#3b665f'
  on-secondary: '#ffffff'
  secondary-container: '#bdece2'
  on-secondary-container: '#416c65'
  tertiary: '#005f26'
  on-tertiary: '#ffffff'
  tertiary-container: '#007a33'
  on-tertiary-container: '#a1ffad'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9cf2e8'
  primary-fixed-dim: '#80d5cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#00504a'
  secondary-fixed: '#bdece2'
  secondary-fixed-dim: '#a2d0c6'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#224e47'
  tertiary-fixed: '#7ffc97'
  tertiary-fixed-dim: '#62df7d'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005320'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  numeric-data:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers a calm, authoritative, and frictionless accounting environment tailored to German freelancers (*Freiberufler* and *Selbstständige*). The aesthetic synthesizes Swiss modernism with modern European fintech sensibilities: disciplined structure, ample white space, and subtle, high-fidelity tactile feedback. 

Every interaction must project two non-negotiable values: absolute tax compliance reliability (*Grundsätze zur ordnungsmäßigen Führung und Aufbewahrung von Büchern, Aufzeichnungen und Unterlagen in elektronischer Form* / GoBD-ready posture) and uncompromising data sovereignty. The interface reduces the anxiety of tax preparation and receipts management through stable, muted palettes, clear hierarchy, and immediate visual confirmation of local, private AI extraction.

## Colors

The palette is engineered for prolonged daily focus during bookkeeping workflows. The dominant canvas uses cool, clean neutrals paired with a concentrated deep teal primary for decisive administrative actions.

- **Primary Canvas & Surfaces**: Base desktop canvas is `#F8FAFC`, providing contrast against `#FFFFFF` elevated cards and work surfaces.
- **Brand Primary**: `#0F766E` (Deep Teal) provides grounded, regulatory authority. Interactive hovers shift to `#115E59`, and active states settle at `#134E4A`.
- **Surface Tint & Accents**: `#CCFBF1` (Light Teal) is reserved for selected row backgrounds, active nav pill indicators, and subtle informational highlighting.
- **Typography & Structure**: Primary data and headers utilize `#0F172A` (Slate 900) for strict legibility. Secondary metadata, timestamps, and VAT categorizations use `#64748B` (Slate 500). Structural strokes, table grids, and input boundaries strictly adhere to `#E2E8F0` (Slate 200).
- **Compliance & Semantic Signals**:
  - *Success (Matched / Exported / Validated)*: `#16A34A` with `#DCFCE7` background.
  - *Warning (Review Needed / Ambiguous Tax Rate)*: `#D97706` with `#FEF3C7` background.
  - *Error (Missing Field / Unreadable / Failed)*: `#DC2626` with `#FEE2E2` background.

## Typography

Typography relies on a single workhorse family: **Inter**. To support rigorous financial data review, all tabular displays, financial sums, tax IDs, and date fields must enable open-type tabular numbers via CSS `font-feature-settings: 'tnum' 1, 'cv05' 1`.

- **Formatting Rules (German Locale - `de-DE`)**:
  - Currency: Always formatted with a trailing euro sign and non-breaking space (e.g., `1.234,56 €`).
  - Dates: Formatted with dots as `DD.MM.YYYY` (e.g., `12.09.2026`).
  - Percentage: Values formatted with a comma and trailing space (e.g., `19,0 % MwSt.` or `7,0 %`).
- **Hierarchy Scale**:
  - **Page Titles**: 28px (`headline-lg`), semibold (600), -0.02em tracking.
  - **Section Titles & Metric Cards**: 18px (`headline-sm`), semibold (600), -0.01em tracking.
  - **Standard Interface Text**: 14px and 15px (`body-md` / `body-lg`), 400 regular.
  - **Form Labels & Metadata**: 12px and 13px (`label-sm` / `body-sm`), 500 medium for crisp clarity in dense desktop layouts.

## Layout & Spacing

The layout is built around a rigorous 8px base rhythm. This desktop-first workspace accommodates complex split-screen tasks (e.g., document PDF viewer alongside extracted AI structured fields).

- **Master Frame Structure**:
  - **Sidebar**: Fixed `240px` left column running top-to-bottom. Houses navigation, accounting filters, and the prominent, reassuring privacy stamp.
  - **Header**: Fixed `64px` height running across the workspace from `left: 240px`. Houses global search (quick OCR scan search), export shortcuts, notifications, and profile indicator.
  - **Content Area**: Fluid layout with a minimum width of `1040px`. Uses an outer canvas margin of `32px` (`2rem`) and inter-card gutters of `24px` (`1.5rem`).
- **Dual-Pane Invoice Inspection Layout**:
  - When reviewing a scanned document, the content area shifts to a 50/50 split or a 60/40 split (60% zoomable receipt viewer, 40% extracted invoice fields editor) with an internal gap of `24px`.

## Elevation & Depth

Visual hierarchy uses a crisp dual-layer strategy: low-contrast border definitions coupled with soft, ultra-diffuse ambient shadows. Heavy dropshadows are prohibited to maintain a clean document-centric workspace.

- **Level 0 (Canvas Base)**: `#F8FAFC`, flat.
- **Level 1 (Cards, Data Tables, Form Containers)**: Surface `#FFFFFF`, border `1px solid #E2E8F0`, shadow `0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.03)`.
- **Level 2 (Hovered Cards, Dropdowns, Datepickers, Floating Palettes)**: Surface `#FFFFFF`, border `1px solid #E2E8F0`, shadow `0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04)`.
- **Level 3 (Modals, OCR Document Previews)**: Surface `#FFFFFF`, shadow `0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.06)`, with backdrop overlay `rgba(15, 23, 42, 0.45)` with `backdrop-filter: blur(4px)`.

## Shapes

The geometric signature of the design system is a standardized **12px (`0.75rem`)** radius for primary containers and interactive surfaces, balancing fintech precision with a modern, human approach.

- **Cards & Data Panels**: `12px` border radius (`rounded-lg` preset mapping).
- **Inputs & Action Buttons**: `8px` border radius for compact operational components.
- **Badges, Status Chips, & Filter Pills**: Fully rounded pill shapes (`9999px`) to visually contrast against square-aligned financial ledgers.
- **Sidebar**: Flush to outer borders; internal nav item indicators use an `8px` corner radius.

## Components

### Buttons
- **Primary**: Background `#0F766E`, text `#FFFFFF`, font-weight 500, height 40px, padding `0 16px`, border-radius 8px. Hover: `#115E59`. Active: `#134E4A`. Focus ring: 2px offset with `#0F766E33`.
- **Secondary / Ghost**: Background `#FFFFFF`, border `1px solid #E2E8F0`, text `#0F172A`. Hover: `#F8FAFC` and border `#CBD5E1`.
- **AI Action (Trigger Scan / Re-extract)**: Dual-tone styling with `#CCFBF1` background, `#0F766E` text, and a subtle icon badge.

### Inputs & Form Fields
- Height 40px, surface `#FFFFFF`, border `1px solid #E2E8F0`, border-radius 8px, padding `0 12px`, text 14px `#0F172A`.
- Focus state: border `#0F766E`, box-shadow `0 0 0 3px rgba(15, 118, 110, 0.15)`, outline none.
- Currency and Number fields: Must align right with internal suffixes (e.g., `EUR` or `€`) pinned to the right edge in `#64748B`.

### Status Chips & Badges
- **Privacy Badge**: Specific component placed at the base of the left sidebar. Container uses `#0F766E` at 10% opacity, border `1px solid #0F766E20`, text `#0F766E`, 12px medium font, pill-shaped, content: `🔒 100% lokal verarbeitet`.
- **Extraction Status Chips**: Pill shape, 24px height, padding `2px 10px`, font size 12px, font-weight 500.
  - *Geprüft (Verified)*: `#DCFCE7` background, `#16A34A` text.
  - *Prüfung ausstehend (Pending)*: `#FEF3C7` background, `#D97706` text.
  - *Fehlerhaft (Error)*: `#FEE2E2` background, `#DC2626` text.

### Tables & Receipt Lists
- Fixed column widths for monetary sums, dates, and action menus.
- Row heights: 52px for standard rows, allowing easy mouse targeting.
- Header styling: 12px uppercase, `#64748B`, tracking 0.05em, bottom border `1px solid #E2E8F0`.
- Alternate hover state: Row transitions to `#F8FAFC`; selected row shifts to `#F0FDFA` with a `2px` left border in `#0F766E`.

### Cards & Document Inspection Containers
- Main overview metric cards (e.g., *Vorsteuer laufender Monat*, *Ausstehende Belege*): `#FFFFFF` background, 12px radius, `20px` internal padding, subtle shadow.
- Scan Viewport: Integrated document canvas with `#F1F5F9` background, `#E2E8F0` border, with bounded zoom and rotate controls floating top-right.