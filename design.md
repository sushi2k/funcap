# Funcap — Design

Companion to **requirements.md v6**, **architecture.md v2**, and **security.md**. This document is the design source of truth: the visual language, tokens, components, and copy voice for Funcap's UI. Its **reference implementation** is `funcap-design.html` — an offline, single-file mockup of the three core screens; this document is the written, buildable form of what that file shows.

Precedence: design serves the product and the security guard rails — it never overrides behaviour (requirements) or a guard rail (security). Where the build needs a design decision not covered here, follow the direction in §1 and extend consistently.

## 0. How to read this document

- **Tokens (§2–§5)** are canonical and map 1:1 onto the Tailwind theme (§10). Every colour, type, and spacing choice in the build derives from them.
- **Components (§6)** are the building blocks; **screens (§7)** compose them.
- The design is **offline-first**: system font stacks only, no web-font or CDN dependency (consistent with security.md DEP-2).

## 1. Design direction

**Subject & job.** Funcap is community amateur tennis — recurring tournaments, self-reported scores, a public scoreboard. The product's heart is two things: the **scoreboard** (its single most-viewed surface) and the **two-player score handshake** (one reports, the other approves, the result locks). The design leads with both.

**Direction: hard court, not clay.** A deep petrol/court-blue on a cool off-white, white cards, hairline rules. Calm and precise rather than warm and editorial.

**Deliberately avoided.** The common "elegant" default — warm cream background, high-contrast serif display, terracotta accent — is exactly where a tennis brief drifts. We chose a cool hard-court palette, a grotesque + monospace pairing (no display serif), and a restrained single accent instead.

**Principles.**
- **Spend boldness once.** The signature is the **score box** and scorecard numerals; everything around them stays quiet.
- **Optic yellow is a signal, not décor.** The one tennis-ball accent appears only as the brand dot and the live "In play" indicator — never as a fill or for text.
- **Scorecard typography.** All scores and ranks use a monospace with tabular figures, echoing an umpire's card.
- **The handshake is the emotional centre.** The approval and dispute moments get the most considered treatment.
- **Restraint and precision.** A minimal direction earns its elegance through spacing, type, and detail — not decoration.

## 2. Colour tokens

Cool hard-court palette. (CSS variable → hex → role.)

| Token | Hex | Role / usage |
|---|---|---|
| `--court` | `#16464e` | Primary brand. Primary buttons, focus ring, active indicators, "locked/confirmed" |
| `--court-deep` | `#0d3036` | Darker court. Button hover, text on light tints, emphasis |
| `--ink` | `#13242a` | Primary text |
| `--muted` | `#5e737a` | Secondary text |
| `--faint` | `#8a9aa0` | Tertiary text, column labels, ranks, footnotes |
| `--line` | `#dde5e6` | Hairline borders, row separators |
| `--line-strong` | `#cdd8da` | Stronger borders (inputs, secondary buttons) |
| `--surface` | `#eef3f3` | Page background (cool paper) |
| `--card` | `#ffffff` | Cards and primary surfaces |
| `--ball` | `#c7d930` | Optic-yellow accent — **brand dot and live indicator only** |

Contrast: `--ink`, `--court`, and `--court-deep` on `--card`/`--surface` meet WCAG AA for text. `--faint` is for non-essential labels only. `--ball` is never used for text or as a large fill.

## 3. Status colours (mapped to match state)

Status is always conveyed by **text label + colour**, never colour alone. Mapped to the match state machine (requirements §6.4).

| Match state | UI label | Foreground | Tint background |
|---|---|---|---|
| `CONFIRMED` (locked) | "Locked" | `--ok` = `#16464e` | `--ok-bg` = `#e2eced` |
| `PENDING` (awaiting approval) | "Awaiting your approval" | `--pending` = `#9a6b1f` (ochre) | `--pending-bg` = `#f6edda` |
| `DISPUTED` | "With an admin" | `--dispute` = `#a8442d` (clay-red) | `--dispute-bg` = `#f6e4de` |
| `VOIDED` | "Voided" | `--faint`, with strikethrough on the score | — |
| Tournament in play | "In play" | `--court-deep` + `--ball` dot | — |

## 4. Typography

Two roles, no display serif. The monospace-for-data rule is the signature.

- **Sans (UI & headings):** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- **Mono (scores, ranks, all tabular data):** `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`, always with `font-variant-numeric: tabular-nums`.

**Rule:** any number a player reads as data — a set score, a rank, W–L, points, win % — is set in mono with tabular figures. Prose and labels are sans.

Type scale (size / weight / tracking):

| Role | Size | Weight | Tracking |
|---|---|---|---|
| Hero title (tournament) | 30px | 660 | −0.02em |
| Screen title | 24px | 650 | −0.02em |
| Wordmark | 19px | 650 | −0.01em |
| Section / card title | 15px | 620 | — |
| Body | 15px | 400 | — |
| Player name | 15px | 560 | — |
| Set score (mono) | 15px | 400 (winner 600) | — |
| Meta / secondary | 14px | 400 | — |
| Eyebrow (uppercase) | 11.5px | 650 | 0.14em |
| Column header (uppercase) | 11px | 650 | 0.08em |
| Chip / footnote | 12–12.5px | 600 / 400 | — |
| Tiebreak superscript | 9px | 400 | — |

Body line-height 1.5; headings 1.1. Use sentence case everywhere except the small uppercase eyebrows and table headers (which encode "label", not emphasis).

## 5. Spacing, radius, shadow, motion

- **Spacing:** 4px base scale — 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 64. Card padding 16–20px; section gaps 16px; page max-width **880px**, padding 40px (28px tablet, 16px mobile).
- **Radius:** `--r` = 11px (cards), `--r-sm` = 7px (controls, chips, score boxes); pills use 99px (segmented control, chips, "you" tag).
- **Shadow:** `--sh` = `0 1px 2px rgba(13,48,54,.04), 0 8px 24px rgba(13,48,54,.05)` — one soft, cool elevation for cards. No heavy or warm shadows.
- **Motion (minimal):** panel fade-in 0.35s; live-dot pulse 2.4s; hover transitions 0.12–0.15s. **All motion is disabled under `prefers-reduced-motion`.**

## 6. Components

| Component | Anatomy & purpose | States / variants | Rules |
|---|---|---|---|
| **Brand mark** | Optic-yellow ball glyph (11px circle, inset ring + small arc) + "Funcap" wordmark | — | The ball is one of only two places `--ball` appears |
| **Top bar / tabs** | Sticky white bar, bottom hairline; text tabs | Active tab = `--ink` text + 2px `--court` underline (the "court-line" motif) | Tabs are `role=tablist`; the build adds arrow-key roving focus |
| **Live indicator** | Pulsing `--ball` dot + "In play" in `--court-deep` | Static under reduced-motion | Tournament-state only |
| **Baseline rule** | 2px line under the hero: `--court` for the first 64px, then `--line` | — | A subtle court-marking cue; decorative, used once |
| **Segmented control** | Pill group (Season / Career) | Active = white fill + shadow + `--ink`; rest `--muted` | For switching equivalent views, not navigation |
| **Card** | White surface, `--line` border, `--r` radius, `--sh` | `card-head` (title + optional control/chip); `card-foot` (faint, on `#fbfdfd`) | The default container for every block |
| **Standings table** | Rank · Player · Played · W–L · metric | Top-3 rank in `--court` + heavier; row hover `#f7fafa`; "you" pill on the current player | Numeric columns right-aligned and mono; sheds "Played" on mobile |
| **Score boxes** *(signature)* | A row of set cells; mono digits | Winner's set = `--ok-bg` fill + heavier + `--court-deep`; tiebreak as a 9px superscript inside the cell | See note below |
| **Match row** | "vs Name · date" (muted) + result line + score + status chip | Locked / disputed / lost / won | Hairline separators; one row per match |
| **Status chip** | Pill, 12px/600 | ok · pending · dispute (per §3) | Always text + colour, never colour alone |
| **Buttons** | `btn` secondary (white, `--line-strong`, hover→`--court`); `btn primary` (`--court` fill, hover `--court-deep`); `btn ghost` (transparent, `--muted`, hover→`--dispute` for destructive) | default / hover / focus-visible | One primary per view; destructive actions use ghost+`--dispute` ("It's wrong", "Void match") |
| **Form control** | Label (12.5px/600/`--muted`) + input (`--line-strong`, `--r-sm`, `#fbfdfd`) | — | Set-score inputs are 54px, mono, centred |
| **Flag (admin)** | Mono tag (ochre tint) + sentence with a muted secondary clause | fast-confirm · exclusive-pair | Non-blocking; informs review only |

**Score box — the signature, in detail.** Each completed set is one cell (min-width 30px, height 34px, `--r-sm`, mono 15px, faint `#fbfdfd` background). The set a player *won* is tinted `--ok-bg`, bordered `#bcd0d2`, weighted 600 in `--court-deep`. A tiebreak is shown as a small 9px `--faint` superscript inside the winning cell (e.g. `7⁵` = 7–6, tiebreak to 5). This component is reused identically in standings context, match rows, the approval card, and the dispute view — it is the one element that should make Funcap recognisable.

## 7. Screens

Three screens are designed in the reference file; the rest follow from the same components.

- **Scoreboard (public, guest-readable).** Hero (tournament name, "Week x of y", player and match counts) over the baseline rule; a single card with the Season/Career segmented toggle, the standings table, and a foot that explains the active metric. Public surface shows **`display_name`, results, and standings only — never `email` or any PII** (security.md DAL-4). Season ranks by points (= wins); Career by win %, with the footnote noting players under 10 matches aren't ranked yet (requirements §10).
- **My matches (player).** Screen title + a single "Report a score" primary action; an **approval card** when a result awaits the player ("Marco Feld reported a match against you — does this look right?" with **It's wrong** / **Approve**); a "Recent" list of match rows with status chips; and the **Report a score** form (opponent select + per-set inputs + "Send for approval", with the note "Your opponent confirms it, then the result locks").
- **Admin (admin).** A "Needs a decision" card per dispute showing the reported score, the rejection reason, and **Void match** / **Set the score**, with the note "Both players are notified · your decision is recorded in the audit log" (ties to security.md AUD-1/2). A "Worth a look" list surfaces non-blocking flags.

**Not yet designed** (extend using §6): authentication (login / register / **MFA enrolment** with a locally-generated QR), profile (incl. the 1–10 `self_level`), notifications, and tournament create/configure. Keep the same hard-court palette, the card as the container, and the player's-side voice.

## 8. Voice & copy

Words are design material; write them from the player's side of the screen.

- **Name things by what people do, not how the system works.** "Report a score", not "Submit match record". "Locked", not "state: CONFIRMED".
- **Active voice; an action keeps its name through the flow.** The button "Approve" leads to an approved result; "Report a score" → "Send for approval" → "Awaiting your approval".
- **Failure and emptiness give direction, in the interface's voice.** A dispute reads "We only played two sets."; the empty admin queue should invite ("Nothing to decide right now."), not apologise.
- **Sentence case, plain verbs, no filler.** Each element does one job — a label labels, a note explains the consequence ("then the result locks").

## 9. Accessibility & responsive

- **Focus:** every interactive element shows a visible 2px `--court` focus ring (`:focus-visible`, 2px offset).
- **Colour is never the only signal:** status chips carry text; the score box uses tint **and** weight; voided scores add strikethrough.
- **Reduced motion:** all animation is disabled under `prefers-reduced-motion`.
- **Semantics:** standings use a real `<table>`; tabs use `role=tablist`/`tab`/`tabpanel` (the build completes arrow-key navigation). Score boxes carry an `aria-label` with the readable score ("6–2, 3–6, 7–6, tiebreak to 5").
- **Responsive:** single column throughout, max-width 880px. Under 560px the standings table sheds its "Played" column, the top bar wraps (season chip drops to its own line), and action buttons go full-width. Targets stay comfortable on touch.

## 10. Mapping to the build (Tailwind)

The tokens become the Tailwind theme; nothing here needs a CSS-in-JS layer.

- **`theme.extend.colors`:** `court`, `court-deep`, `ink`, `muted`, `faint`, `line`, `line-strong`, `surface`, `card`, `ball`, plus `ok`/`pending`/`dispute` and their `*-bg` tints (§2–§3).
- **`fontFamily`:** `sans` and `mono` set to the exact system stacks in §4 — **no `@font-face`, no Google Fonts** (offline, DEP-2). Use the `tabular-nums` utility on all data.
- **`borderRadius`:** `sm` = 7px, `DEFAULT`/`card` = 11px; pills via `rounded-full`.
- **`boxShadow.card`:** the §5 value.
- **Components** live where architecture §6/§11 puts them: the **Scoreboard renders in a Server Component from DTOs** (no PII); interactive pieces (approval card, report form, admin actions) are Client Components calling the route handlers.
- **Guard-rail ties:** user text (notably `display_name`) renders through React's default escaping — **no `dangerouslySetInnerHTML`** (security.md IN-3); names are constrained to 2–30 chars (requirements §3) so the standings layout never needs to handle arbitrary length.

## 11. Open design decisions

- **Accent identity.** The palette is petrol-blue (hard court) with an optic-yellow signal. If the community's identity is clay or grass, this is a **token swap** in §2 — the structure and type system are unaffected.
- **Scope.** Only the three product-defining screens are designed; auth, profile, notifications, and tournament admin are intentionally deferred to keep the system focused (§7).
- **Logo.** The ball-glyph wordmark is a placeholder mark, not a finished identity.