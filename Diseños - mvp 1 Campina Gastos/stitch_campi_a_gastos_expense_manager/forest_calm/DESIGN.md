---
name: Forest Calm
colors:
  surface: '#f6faf9'
  surface-dim: '#d7dbda'
  surface-bright: '#f6faf9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f4f3'
  surface-container: '#FFFFFF'
  surface-container-high: '#e5e9e8'
  surface-container-highest: '#dfe3e2'
  on-surface: '#181c1c'
  on-surface-variant: '#404846'
  inverse-surface: '#2c3131'
  inverse-on-surface: '#edf2f1'
  outline: '#707976'
  outline-variant: '#c0c8c5'
  surface-tint: '#3a665d'
  primary: '#00221c'
  on-primary: '#ffffff'
  primary-container: '#053931'
  on-primary-container: '#75a398'
  inverse-primary: '#a1d0c4'
  secondary: '#256863'
  on-secondary: '#ffffff'
  secondary-container: '#adefe7'
  on-secondary-container: '#2c6e69'
  tertiary: '#00221d'
  on-tertiary: '#ffffff'
  tertiary-container: '#003933'
  on-tertiary-container: '#49a99b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#bcece0'
  primary-fixed-dim: '#a1d0c4'
  on-primary-fixed: '#00201b'
  on-primary-fixed-variant: '#204e46'
  secondary-fixed: '#adefe7'
  secondary-fixed-dim: '#91d2cb'
  on-secondary-fixed: '#00201e'
  on-secondary-fixed-variant: '#00504b'
  tertiary-fixed: '#95f3e3'
  tertiary-fixed-dim: '#79d7c8'
  on-tertiary-fixed: '#00201c'
  on-tertiary-fixed-variant: '#005048'
  background: '#f6faf9'
  on-background: '#181c1c'
  surface-variant: '#EAF5F3'
  text-primary: '#1F2937'
  text-secondary: '#6B7280'
  outline-subtle: '#D7E6E2'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  title-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  currency-display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.03em
  currency-display-mobile:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 42px
    letterSpacing: -0.025em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-md: 1.5rem
  gutter-lg: 2rem
  margin: 1rem
  margin-md: 2rem
  margin-lg: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

This design system establishes an atmosphere of domestic equilibrium, financial transparency, and organic calmness. Engineered specifically for shared domestic finance—household bills, grocery tallies, utility distributions, and rent allocation—the UI rejects the visual anxiety of Wall Street dashboards, hyper-dense spreadsheets, and aggressive banking interfaces. Instead, it draws from calm technology, contemporary Nordic interior aesthetics, and Material Design 3 principles.

The target demographic encompasses modern families, shared domestic partnerships, and communal roommates who prioritize equity, clarity, and harmony over transactional tension. The visual language utilizes deep woodland evergreen tones, cool sea-glass mint accents, and expansive pale pine mist backgrounds. The aesthetic embraces tactile soft minimalism: elevated rounded containers, generous touch zones, quiet surface shifts, and purposeful numeric hierarchy that treats money as a natural utility rather than an emotional stressor.

## Colors

The palette is rooted in an organic, low-frequency chromatic spectrum. The primary deep woodland teal (`#053931`) anchors core actions, selected navigation elements, and primary balance metrics, projecting reliability and permanence. The secondary teal (`#00524D`) provides tonal depth for supporting functional groups and segmented controls. The tertiary seafoam mint (`#48A89A`) acts as a deliberate accent—reserved for split confirmations, positive settlement tags, active slider tracks, and affirmative micro-interactions.

Neutral tones form the vast majority of the optical footprint. The default canvas utilizes `#F6FAF9`, a soothing off-white with an imperceptible evergreen tint that prevents glare during evening domestic planning. Card surfaces lift off this field in pure `#FFFFFF`, while auxiliary grouping containers settle into `#EAF5F3`. Text strictly avoids harsh pure blacks, employing `#1F2937` for effortless legibility and `#6B7280` for sub-labels and supporting metadata.

## Typography

The type system is built uniformly upon Inter, utilizing its deep geometric clarity, high x-height, and tabular numeral support to maintain absolute readability in financial ledgers. Typography establishes hierarchy not through heavy decoration, but through distinct scale contrast and calibrated weight steps.

Numerical metrics and running balance totals utilize dedicated currency tokens (`currency-display` and `currency-display-mobile`) with tabular lining figures (`font-variant-numeric: tabular-nums; tnum`) to prevent jitter across dynamically changing split figures. Headings prioritize tighter tracking (`-0.03em` to `-0.01em`) to create dense, confident anchors over wide whitespace fields, while utility labels and tabular headers lean into slightly positive tracking for instant legibility at reduced sizes.

## Layout & Spacing

Layouts follow a modular, fluid column framework built on an 8px base rhythm. For mobile viewpoints (under 600px), a 4-column structure with 16px outer margins ensures tight, cohesive scanning with tap targets pinned to full width or comfortable single-column spans. Medium viewports (tablets, 600px–1023px) expand to an 8-column grid with 24px gutters, transitioning primary budgeting summaries to persistent top-level cards while individual splits line up in clean pairs. Desktop viewports (1024px+) adopt a 12-column layout with max-width constrained to 1200px to maintain reading line lengths, separating persistent member allocation sidebars from the running ledger stream.

Negative space functions as an active structural boundary. Generous vertical element gaps (`space-lg` to `space-2xl`) isolate expense batches by billing cycle or domestic category, eradicating the need for aggressive dividing rules.

## Elevation & Depth

Visual depth follows the Material Design 3 surface philosophy merged with ambient green daylight scattering. Flat, opaque drop shadows are strictly prohibited; elevation is expressed via layered surface tonal shifts combined with low-opacity, wide-radius ambient shadows tinted with `#053931`.

- **Level 0 (Flat / Canvas):** Baseline container (`#F6FAF9`), zero shadow. Used for page root, secondary utility drawers, and table backdrops.
- **Level 1 (Card / Rest):** Primary card surface (`#FFFFFF`), reinforced with a hairline border in `#D7E6E2` and a diffuse ambient plume: `box-shadow: 0 4px 20px -2px rgba(5, 57, 49, 0.05), 0 2px 6px -1px rgba(5, 57, 49, 0.03)`.
- **Level 2 (Hover / Interactive):** Active hover states, selectable member pills, and expense item interactions: `box-shadow: 0 8px 28px -4px rgba(5, 57, 49, 0.08), 0 4px 10px -2px rgba(5, 57, 49, 0.04)`.
- **Level 3 (Modal / Floating Action / Bottom Sheet):** Add-expense sheets, domestic split adjustment dialogs, and balance resolution popovers: `box-shadow: 0 16px 40px -8px rgba(5, 57, 49, 0.12), 0 6px 16px -4px rgba(5, 57, 49, 0.06)`. Surface tone remains `#FFFFFF`.

## Shapes

The design system adopts a welcoming, organic roundedness scale that mirrors domestic objects rather than industrial tools. Standard interactive components—such as form text inputs, standard buttons, and small detail cards—receive a baseline radius of `0.5rem` (8px). Medium surface containers and standard feed cards employ `rounded-lg` at `1rem` (16px), delivering an approachable, softly framed appearance.

Larger structural groupings, bottom sheets, master balance summaries, and hero cards scale to `rounded-xl` at `1.5rem` (24px). Avatars, member assignment indicators, toggle pills, and settlement tags utilize pill geometries (`border-radius: 9999px`) to immediately distinguish identity and metadata from structural content modules.

## Components

### Buttons
- **Primary Action (Add Expense, Settle Up):** Solid `#053931` fill, `#FFFFFF` text, `rounded` (8px) geometry, 48px height for touch ergonomics. Active states transition to `#00524D`. No harsh drop shadows; subtle scale animation (0.98) on press.
- **Secondary Action (Filter, Export, Recalculate):** `#EAF5F3` surface fill, `#00524D` text, 0 border, hover shift to `#D7E6E2`.
- **Outlined / Tertiary Action:** Transparent background, 1px border in `#D7E6E2`, `#00524D` text, transitioning to `#F6FAF9` background on hover.

### Cards
- **Expense & Summary Cards:** Baseline surface `#FFFFFF`, 16px padding (`space-md`) on mobile, 24px (`space-lg`) on desktop. Radius `rounded-lg` (16px). Border 1px solid `#D7E6E2`.
- **Hero Balance Card:** Surface `#053931` or `#EAF5F3`. When dark primary is chosen, text inverts to `#F6FAF9`, with tertiary `#48A89A` accents for split metrics and percentage progress tracks.

### Input Fields & Forms
- Inputs feature a soft container fill of `#FFFFFF` with a 1px border in `#D7E6E2`. On focus, the border shifts to `#00524D` at 2px with an ambient ring in `rgba(72, 168, 154, 0.25)`.
- Labels sit above inputs using `label-md` in `#1F2937`. Floating numerical amounts (expense cost entry) use 36px font sizing with currency tokens locked to `#6B7280`.

### Chips & Member Split Badges
- **Member Chip:** Pill shape (`9999px`), 32px height, containing a 24px circular avatar followed by member name and split percentage. Resting state: `#EAF5F3` background, `#00524D` text.
- **Status Tags (Paid, Pending, Settled):** 24px height, uppercase `label-sm`, 8px horizontal padding. "Paid" utilizes light mint background (`rgba(72, 168, 154, 0.15)`) with `#00524D` text. "Pending" utilizes `#F6FAF9` with `#6B7280` text.

### Split Ratio Sliders & Toggles
- Custom track sliders for manual utility splitting feature a 6px rail in `#EAF5F3`, active span in `#48A89A`, and a smooth circular 24px white knob backed by Level 2 ambient elevation.

### Lists & Ledger Rows
- Individual expense entries sit inside `#FFFFFF` cards or flat unbordered rows separated by `space-sm` gaps over `#F6FAF9`. Left side houses category iconography wrapped in a 40px rounded-lg container of `#EAF5F3`, center carries title and contextual date/payer subtext, and right side aligns right-aligned tabular currency figures.