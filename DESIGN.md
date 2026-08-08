---
name: SERVIX
description: Self-hosted infra + VPN-subscription-business cockpit — light, Operate-mode admin panel built on Radix UI primitives, OpenSea-referenced shape and elevation language.
colors:
  editorial-magenta: "#cf00a3"
  ink: "#04111d"
  ink-accent: "#04111d"
  ink-magenta: "#99007c"
  text-secondary: "#4b5563"
  text-muted: "#656b71"
  sky-count-line: "#38bdf8"
  plum-glow: "rgba(147, 27, 121, 0.14)"
  page: "#ffffff"
  sidebar-surface: "#f7f8fa"
  divider-gray: "#e5e8eb"
  floating-surface: "rgba(250, 250, 248, 0.92)"
  white: "#ffffff"
  shadow-black: "#000000"
  danger: "#dc2626"
  success: "#12823b"
  warning: "#995906"
typography:
  display:
    fontFamily: "GT Eesti Pro Display, system-ui, -apple-system, sans-serif"
    fontWeight: 500
  body:
    fontFamily: "GT Eesti Pro Text, system-ui, -apple-system, sans-serif"
    fontWeight: 400
rounded:
  xs: "3px"
  sm: "8px"
  compact: "9px"
  md: "10px"
  lg: "12px"
  xl: "14px"
  2xl: "16px"
  3xl: "18px"
  4xl: "20px"
  5xl: "24px"
  pill: "999px"
spacing:
  2: "2px"
  4: "4px"
  6: "6px"
  8: "8px"
  10: "10px"
  12: "12px"
  16: "16px"
  20: "20px"
  24: "24px"
  32: "32px"
components:
  button-primary:
    backgroundColor: "{colors.editorial-magenta}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "11px 18px"
  button-danger:
    backgroundColor: "rgba(239, 68, 68, 0.1)"
    textColor: "{colors.danger}"
    rounded: "{rounded.pill}"
    padding: "11px 18px"
  badge-category:
    backgroundColor: "{colors.editorial-magenta}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
---

# Design System: SERVIX

## Overview

**Creative North Star: "The Operator's Ledger, Ported from OpenSea"**

SERVIX is a single-operator cockpit, not a team product — one person tracking their own servers, domains, certificates, and a VPN-reselling business's real subscriber economics (MRR, churn, subscriber lifetime) in one place, self-hosted, with nothing routed through a third-party SaaS. The system reads as a precise financial/infrastructure ledger: quiet neutral surfaces carry the weight, and one saturated color — an assertive magenta — is reserved for the things that are actually actionable or alive (the brand mark, primary actions, the active nav state, links), never spent on decoration. The rest of the palette — neutrals, text hierarchy, semantic status colors, shape and elevation language — is a direct, explicit port from OpenSea, requested twice: first as a shape/elevation reference (pills, real shadows, white/gray neutrals), then as a full color-level port (the actual near-black/gray text hierarchy and semantic hues OpenSea uses, not just its overall lightness). The magenta accent was the one color explicitly pinned out of scope across both passes.

Built entirely on Radix UI primitives (`radix-ui` unified package) for every interactive/overlay component — Dialog, Select, DropdownMenu, Accordion, Tooltip, Tabs, Toast, Popover — styled to this system rather than left at defaults. Framer Motion supplies entrance/exit motion on top of Radix's behavior layer (focus trapping, ARIA, keyboard nav, swipe gestures), never replacing it.

**Key Characteristics:**
- Restrained color strategy: OpenSea's own near-achromatic white/gray neutrals and dark-navy text hierarchy + one magenta accent — not a full palette, not a drenched surface, and not a tinted neutral scale (an earlier pass tried a colored neutral family; it was explicitly superseded).
- A real, independent secondary/muted text hierarchy (`--text2`, `--muted`) — distinct solid grays, not one ink color at varying opacity, matching how OpenSea actually structures its type hierarchy rather than this system's earlier alpha-based shortcut.
- Pill-first shape language: buttons, badges, pills, search fields, and avatars are fully rounded (`--radius-pill`); cards/modals use large but finite radii (20-24px), never sharp corners.
- Real resting elevation on cards/widgets (a soft two-layer shadow), reversing an earlier "flat by default" rule — a white page needs the shadow to separate white-on-white surfaces at all.
- Danger/success (`#dc2626`/`#12823b`) are grounded in real OpenSea screenshots the user supplied, not memory — a first pass here cited specific hex codes as "OpenSea's actual referenced hues" without ever verifying them against real pixels (this tool has no way to sample a live page's colors) and was visibly wrong when compared side-by-side. Warning/amber has no screenshot reference and is still a disclosed estimate, not a verified one.
- Every text/status color is verified against *every* background it actually renders on, not just the lightest one — a muted gray that passed against the white page failed against the slightly darker sidebar until checked explicitly.
- Every Radix overlay/menu primitive is already in use; there is no hand-rolled dropdown, dialog, or toast left in the codebase.

## Colors

Restrained strategy: OpenSea's own near-white/near-black neutrals carry the interface, one magenta accent carries brand and action, three of OpenSea's own semantic hues (darkened for contrast) carry status.

### Primary
- **Editorial Magenta** (`#cf00a3`): the brand accent — primary buttons' fill, active nav state, links, focus rings, category badges, the primary chart series (spend/revenue). Explicitly pinned unchanged across three direction passes this session, including the two OpenSea-reference passes. Used sparingly by design; large expanses of solid magenta only appear on primary CTAs and category badges, never as a background wash for whole regions.
- **Ink Magenta** (`#99007c`): a darkened shade of Magenta, used only where Magenta itself would fail text contrast (badge text, the favicon-placeholder letter) — same hue, functionally a "primary-800" step.

### Secondary
- **Sky Count-Line** (`#38bdf8`): the one place a second saturated hue appears outside data visualization's own necessity — the trend chart's subscriber-*count* line and its area fill (`rgba(56, 189, 248, 0.12)`), used only to distinguish it from the primary magenta spend/revenue line on the same chart. Pre-dates this session's work; not used anywhere outside that one chart.
- **Plum Glow** (`rgba(147, 27, 121, 0.14)`): a muted secondary glow in the login screen's decorative two-color radial-gradient background, paired with a magenta glow at the same alpha. Purely decorative, scoped to `.login-screen::before`; not used anywhere else.

### Neutral
- **Ink** (`#04111d`): body text, headings — OpenSea's actual dark navy-black, not pure black and not this system's earlier invented `#07040b`.
- **Text Secondary** (`#4b5563`): a real, independent solid gray for secondary/emphasized-but-not-primary text (labels, sub-values) — replaces what used to be `--text` at 90% opacity. Clears 7.1-7.6:1 against both Page and Sidebar Surface.
- **Text Muted** (`#656b71`): the lightest text tier — hints, meta, pagination. Ported from OpenSea's own muted gray (`~#8a939b`) but darkened further than the minimum: their raw value only clears ~3.1:1 against white (fine for large text under WCAG 1.4.11, not for the small secondary text this fills here), and even a version that just cleared 4.5:1 against the white page still failed against the slightly darker Sidebar Surface (4.27:1) — this value was chosen by checking both backgrounds explicitly, not just the lighter one, and clears 5.0-5.4:1 on each.
- **Page** (`#ffffff`): the base page/content background. Pure white — this went through two prior states this session (a near-gray `#e7e9e7`, then a tinted blush `#f4ecf0`) before landing here on the OpenSea reference, whose own content areas are genuinely white/near-white, not colored.
- **Sidebar Surface** (`#f7f8fa`): the sidebar background — OpenSea's own light panel gray, the classic "surface-1 on white" pairing.
- **Divider Gray** (`#e5e8eb`): OpenSea's own border/divider gray — `--color-bg3`, currently defined in `:root` but with zero consumers, reserved for a future third surface tier rather than the differently-invented gray an earlier pass used here.
- **Floating Surface** (`rgba(250, 250, 248, 0.92)`, ranging 0.6–0.96 by context): a near-white, semi-opaque background reserved for elevated/floating panels only — dropdowns, tooltips, the modal card, the account menu, search-select panels, toasts — always paired with `backdrop-filter: blur()`. Almost indistinguishable from Page now that Page is itself white; floating panels differentiate themselves by shadow and blur here, not a big color jump.
- **White** (`#ffffff`): reserved for content sitting on top of a saturated fill — button labels on the accent fill, badge/pill text on solid danger/warning/category/neutral-pill backgrounds — plus the one non-UI exception, the QR-code image's own backdrop, which must stay pure white regardless of theme for the code to stay scannable.
- **Shadow Black** (`#000000`): the *only* place true black appears in the system, and never as a visible fill on its own — always a low-alpha box-shadow or dimming scrim (the modal backdrop, the mobile sidebar drawer's backdrop). Deliberately pure black rather than a tint of Ink: a shadow/scrim's job is to recede behind whatever it's shadowing or dimming, not to carry brand hue.

### Named Rules
**The Solid-Gray-Not-Alpha-Black Rule.** Text Secondary and Text Muted are independent solid colors, not `--text` at reduced opacity. An alpha-blended "gray" renders differently depending on what's behind it (the earlier version of this system's muted text was measurably a different effective color on the sidebar than on the page); a solid gray, verified against every background it actually appears on, doesn't have that failure mode.

**The Solid Status Rule.** Status badges (overdue/due-soon/category chips) use a *solid, opaque* background with the darkened semantic color and white text — never a translucent low-alpha wash with colored text on top of the page background.

**The Flat-Button Rule.** Primary/CTA buttons are a single flat fill, never a gradient — a direct OpenSea reference (its buttons are solid color, brightness/hover carries interactivity).

**The Check-Every-Background Rule.** A text/status color is verified against every background it actually renders on, not just the palest one in the system. The muted-gray regression this session (passed against Page, failed against Sidebar Surface) is the concrete reason this rule exists, not a hypothetical.

## Typography

**Display Font:** GT Eesti Pro Display (with system-ui, -apple-system, sans-serif fallback)
**Body Font:** GT Eesti Pro Text (with the same fallback stack)

**Character:** A clean, humanist grotesque pairing — Display for numbers, headings, and brand moments (amounts, page titles, stat-card values), Text for everything read at length (body copy, inputs, table cells, hints). Untouched by the OpenSea shape/elevation pass — that request was about color and geometry, not typefaces, and swapping fonts would be a much larger, riskier change than the one asked for.

### Hierarchy
- **Display / hero** (700, 26px, GT Eesti Pro Display): the single largest number on a page — a stat-card's headline value.
- **Headline** (500, 20px, GT Eesti Pro Display): page `<h1>`s, prominent numbers.
- **Title** (500, 18px, GT Eesti Pro Display): modal/dialog headings.
- **Subheading** (400/500, 16px): section subheadings.
- **Body / emphasis** (500, 14px): emphasized body text, primary button labels, nav labels.
- **Body / default** (400, 13px): default body text, inputs, list rows — the interface's most common text size.
- **Label / meta** (400-600, 12px): default secondary/meta text — hints, sub-values, table cells.
- **Micro-label** (600, 11px, uppercase, 0.02-0.04em tracking): uppercase micro-labels, stat-card labels, badge text.
- **Caption** (400-700, 10px): the rarest step — pagination hints, tiny captions.

### Named Rules
**The One-Scale Rule.** Every font-size in the stylesheet is one of 10 named steps (`--text-2xs` through `--text-4xl`); no ad-hoc pixel value appears outside that set.

## Layout

A sidebar + content shell (`display: flex`), the sidebar `position: sticky` and full-height, the content area flexing to fill the remainder. Desktop sidebar collapses from 252px to an 80px icon rail (a real reflow of the content sibling, animated via `transition: width`, kept deliberately — a `grid-template-columns` alternative was evaluated and costs the same layout recalculation since the collapse is between two known fixed widths). Below 900px the sidebar becomes a `position: fixed` overlay drawer sliding in via `transform: translateX()` — genuinely cheap, unlike the desktop case, because there's no sibling reflow to produce.

Spacing follows an 18-step scale (`--space-2` through `--space-64`, named after their own pixel value) extracted from an audit of the 325 padding/margin/gap declarations already in the codebase — not invented fresh. A separate two-step "layout tier" (`--space-48`, `--space-64`) is reserved for page-region gaps, kept apart from the 2-32px component-spacing range.

Touch targets follow a `@media (pointer: coarse)` rule that bumps 32-34px icon buttons to 40px specifically on touch-capable devices — pointer-gated rather than viewport-gated.

## Elevation & Depth

Layered, not flat — real, visible soft-shadow elevation on every in-flow card/widget at rest, a deliberate reversal of this system's earlier "flat by default" rule (that rule was tuned for a differently-colored, busier surface; a pure-white page needs a shadow to separate a white card from a white page at all, since there's no longer a fill-color difference to lean on). Interactive cards (asset cards, provider cards) lift further on hover; static dashboard tiles (stat cards) keep only the resting shadow, since they're not clickable and a hover change would imply an affordance that isn't there.

### Shadow Vocabulary
- **card** (`box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 6px 16px rgba(0,0,0,0.06)`): the resting elevation for every in-flow card/widget — barely-there, just enough to lift a white surface off a white page.
- **card-hover** (`box-shadow: 0 2px 4px rgba(0,0,0,0.06), 0 12px 28px rgba(0,0,0,0.1)`): the hover state for genuinely clickable cards only.
- **sm** (`box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3)`): the mobile menu button — a small floating chip.
- **md** (`box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45)`): dropdowns, popovers, the account menu — mid-elevation floating panels.
- **lg** (`box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5)`): modals — the highest elevation tier.

### Named Rules
**The No-Offset Rule.** Every shadow in the system is `0 <Y> <blur> rgba(0,0,0,<alpha>)` (single- or double-layer) — no x-offset, no spread, ever.

## Shapes

**Pill-first**, on direct request: buttons, badges/pills, category chips, search inputs, icon buttons, and avatars/favicon placeholders all use `--radius-pill` (999px) — fully rounded regardless of the control's height, not a fixed large px value that would stop looking round past a certain size. Everything else uses an 11-step radius scale (`--radius-3` through `--radius-24`, plus the pill token), same extraction-then-extend method as spacing: `14px` is the new workhorse for standard inputs/selects; `20-24px` is reserved for large containers (cards, the modal card) — larger than the previous pass's 16-18px, for a softer, more generous feel; `8-10px` still covers a handful of compact/legacy controls not yet touched by this pass. `3px` is the scrollbar thumb pill (tokenized); `2px`/`11px` remain the two documented single-purpose literals (flag-icon corner rounding, one specific icon-tile). Borders are always `1px solid`, using `--border` (a near-black line at 14% opacity) or, on floating/glass surfaces, `--glass-border` — now a **neutral** hairline (`rgba(4, 4, 8, 0.08)`), not accent-tinted as it was through the prior two passes: OpenSea's own cards define themselves with shadow and a barely-visible neutral line, not a brand-colored outline on every panel.

## Components

### Buttons
- **Shape:** fully rounded pills (`--radius-pill`) on all three variants — one shared shape, color-only variants, a step further than the previous pass's `12px` radius. (Originally six near-duplicate button classes; three — `.btn-accent`/`.btn-ghost`/`.btn-icon` — turned out to be dead CSS with zero call sites and were removed rather than merged.)
- **Primary:** flat solid magenta fill (no gradient — see the Flat-Button Rule), white text, `12px 20px` padding, GT Eesti Pro Display.
- **Secondary:** transparent background, `1px solid var(--border)`, ink text, `11px 18px` padding, GT Eesti Pro Text.
- **Danger:** pale-red translucent background (`rgba(240, 68, 56, 0.1)`) with `1px solid rgba(240, 68, 56, 0.3)` border and darkened-red text (`--danger`), same `11px 18px` padding as Secondary.
- **Hover / Focus:** Primary brightens (`filter: brightness(1.1)`); Secondary/Danger shift background opacity. All three, plus icon buttons and nav links, get a `2px solid` magenta `outline` on `:focus-visible`.

### Badges / Pills
- **Shape:** fully rounded (`--radius-pill`) — was a moderate `8px` in an earlier pass; this pass makes them genuine pills.
- **Style, urgent states:** solid, opaque background in the semantic color, white text, no border (`border-color: transparent` explicitly — the base `.pill` rule below has a border, and without overriding it the color leaks through as a faint ring on the filled fill, caught by comparing a screenshot against the intended flat look).
- **Style, neutral state:** unfilled — transparent background, `1px solid var(--border)`, `var(--text2)` text. A record that isn't expiring soon has nothing urgent to announce, so the plain due-date pill and the no-due-state pill (both share the base `.pill` class) get a quiet outline instead of competing for the same visual weight as an actual overdue/due-soon pill. This reverses an earlier version of this rule that filled every pill state solidly, including the neutral one — a real regression caught by the user comparing against the reference.
- **Category badges:** background = the user's chosen category color exactly; text = white when that clears 4.5:1, otherwise a progressively darkened shade of the *same* color, computed in `lib/contrastText.js`. No border (never had one).
- **Status pills** (`.pill.is-overdue` / `.pill.is-soon`): solid `--danger` / `--warning` background, white text, no border.

### Cards / Containers
- **Corner Style:** `20px` radius (`--radius-20`) — up from `16px`, for a softer, more generous shape.
- **Background:** `--glass-bg` (a ~4% ink tint over the page color — reads as a very subtle off-white against pure-white Page).
- **Shadow Strategy:** `--shadow-card` at rest, `--shadow-card-hover` on hover for clickable cards only (see Elevation & Depth — this reverses the prior "flat at rest" rule).
- **Border:** `1px solid var(--glass-border)` — now a neutral hairline, not accent-tinted (see Shapes).
- **Internal Padding:** `18px`, or `18px 20px` for stat cards.

### Inputs / Fields
- **Style:** `1px solid var(--border)` on a faint ink-tinted background (`rgba(4, 17, 29, 0.03)`), `14px` radius (up from `10px`). Search inputs specifically are full pills (`--radius-pill`), a distinct OpenSea signature (its search bars are famously pill-shaped).
- **Focus:** border shifts to solid magenta plus a soft `3px` accent-tinted ring (`box-shadow: 0 0 0 3px rgba(207, 0, 163, 0.14)`) — a more deliberate, "designed" focus state than the previous pass's plain border-opacity change, and closer to the ring treatment this kind of reference commonly uses.
- **Placeholder:** ink-tinted at 35% opacity — legible but clearly secondary to real input text.

### Avatars / Icon Tiles
- Favicon images and their letter-fallback placeholder, the sidebar account avatar: all now `--radius-pill` (true circles) rather than the previous pass's `8-10px` squircle — another direct OpenSea signature (circular avatars throughout).

### Navigation
- Sidebar nav items: icon + label, transparent at rest, a light ink-tinted hover state, and a magenta-tinted `active` state for the current route. Collapses to icon-only below the 80px rail width; mobile drops the sidebar for a `position: fixed` slide-in drawer instead, triggered by a floating pill-shaped menu button.
- Every dropdown/menu (account menu, category picker, country picker, Select fields) is Radix `DropdownMenu`/`Select`/`Popover`, not hand-rolled.

### Toasts (signature component)
Radix `Toast` (`Provider`/`Root`/`Viewport`/`Close`/`Description`), composed with Framer Motion via `asChild` + `forceMount` — Radix owns the auto-dismiss timer, swipe-to-dismiss gesture, and the `role="status"`/`aria-live` announcement, Framer Motion owns the slide-up-and-fade entrance/exit.

## Do's and Don'ts

### Do:
- **Do** use `--radius-pill` for any new button, badge, pill, search input, or avatar — the pill shape is the system's signature now, not an exception on a few components.
- **Do** give any new in-flow card/widget `--shadow-card` at rest (and `--shadow-card-hover` only if it's genuinely clickable) — flat cards on the white background read as unfinished, not minimal.
- **Do** use the darkened semantic tokens (`--danger`/`--success`/`--warning`) for anything that renders as text, per the 4.5:1 contrast requirement.
- **Do** reach for a Radix primitive first for anything overlay/menu/dialog-shaped.

### Don't:
- **Don't** reintroduce a gradient on the primary button — flat fill is a deliberate rule now, not a placeholder.
- **Don't** outline a card/panel in the magenta accent — `--glass-border` is neutral now; save magenta for things that are actionable.
- **Don't** use a translucent color wash as a badge/pill/status background with colored text on top.
- **Don't** introduce a shadow with an x-offset or spread.
- **Don't** hand-roll a dropdown, dialog, tooltip, or toast.
