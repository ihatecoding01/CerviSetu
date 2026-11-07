# Codename Orion: UI & Design System Specification
**CerviSetu HPV Immunization & Rural Cervical Cancer Referral Platform**

---

## 1. Executive Summary & Creative Direction

### 1.1 What is Codename Orion?
**Codename Orion** is the unified, luminous Pink & Blue clinical design language developed for CerviSetu. It supersedes both the dark cyberpunk aesthetic of initial prototypes and the high-contrast orange gateway styling. 

Codename Orion merges the clinical precision of Swiss Grotesque design with a warm, humane touch specifically tailored for Indian oncology and rural healthcare operations. It delivers immediate cognitive clarity across multilingual frontline environments—from ASHA smartphone home visits in rural districts to high-throughput hospital oncology workstations and patient-facing vernacular care companions.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CODENAME ORION PALETTE                          │
├──────────────────────────┬──────────────────────────┬──────────────────┤
│    60% Luminous Canvas   │   30% Clinical Medical   │  10% Cervical    │
│    #FAFAFC / #FFFFFF     │   #2B66E4 / #0284C7      │  #9D174D / #F43F5E│
│ (Calm, paper-pure base)  │ (Diagnostic structure)   │ (Health accents) │
└──────────────────────────┴──────────────────────────┴──────────────────┘
```

### 1.2 The "Anti-AI Slop" Design Directive
Every interface component strictly adheres to clinical dignity:
1. **Zero Gimmicky Emojis**: Replaced entirely by curated 1.5px stroke vector glyphs from `lucide-react` or domain-specific SVG iconography.
2. **Zero Cyberpunk Neons**: High-saturation green/purple neon glows have been eliminated. In their place are diffused ambient radial scrims, calibrated pastel alerts, and soft luminous backdrops.
3. **Authentic Data Density**: Functional UI elements—such as dot-matrix histograms, diagonal hatch progress tracks, tabular monospace telemetry, and cryptographic audit ledger chips—replace decorative fluff.
4. **Accessible Multilingual Typography**: Designed from the ground up for clean script rendering across 7 Indic languages (Hindi, Bhojpuri, Bengali, Marathi, Tamil, Telugu, and English).

---

## 2. Master Color Tokens & Palette Specifications

### 2.1 Clinical Medical Blues (Structure, Triage & Navigation)

| Token Name | Hex Code | RGB / RGBA | Tailwind Reference | Semantic Role & Clinical Context |
|---|---|---|---|---|
| `--color-primary` | `#2B66E4` | `rgb(43, 102, 228)` | `blue-600` | Vibrant Medical Blue. Primary interactive buttons, active tab borders, primary trend telemetry. |
| `--color-secondary` | `#0284C7` | `rgb(2, 132, 199)` | `sky-600` | Orion Sky Blue. Patient portal accent, map pins, secondary action pills, focus rings. |
| `--color-sky-accent` | `#0EA5E9` | `rgb(14, 165, 233)` | `sky-500` | Luminous sky highlight, active audio soundwaves, interactive link hover states. |
| `--color-cobalt-deep` | `#0369A1` | `rgb(3, 105, 161)` | `sky-700` | High-contrast label text on sky tinted backgrounds, clinician badge outlines. |
| `--color-navy-dark` | `#1E40AF` | `rgb(30, 64, 175)` | `blue-800` | Deep blue text for informational alerts and active table headers. |
| `--color-primary-glow`| `#60A5FA` | `rgb(96, 165, 250)` | `blue-400` | Soft blue glowing orb centers and subtle hover ring projections. |
| `--color-sky-tint-1` | `#EFF6FF` | `rgb(239, 246, 255)` | `blue-50` | Soft blue canvas tint for clinical sub-cards and intake drop zones. |
| `--color-sky-tint-2` | `#F0F9FF` | `rgb(240, 249, 255)` | `sky-50` | Ambient card gradient stop and hovering row highlight. |
| `--color-sky-tint-3` | `#E0F2FE` | `rgb(224, 242, 254)` | `sky-100` | Badge background, card gradient terminus, and active chip outline. |

### 2.2 Cervical Health Pinks & Roses (ASHA, Screening & Warmth)

| Token Name | Hex Code | RGB / RGBA | Tailwind Reference | Semantic Role & Clinical Context |
|---|---|---|---|---|
| `--color-pink-deep` | `#9D174D` | `rgb(157, 23, 77)` | `pink-800` | Orion Dark Pink / Magenta. ASHA mobilizer branding, key callout pills, primary women's health headers. |
| `--color-pink-hover` | `#831843` | `rgb(131, 24, 67)` | `pink-900` | Dark pink button active/press state. |
| `--color-pink` | `#F43F5E` | `rgb(244, 63, 94)` | `rose-500` | Cervical Health Rose. Follow-up urgent pulse orbs, VIA acetowhite highlight tags. |
| `--color-pink-glow` | `#FB7185` | `rgb(251, 113, 133)`| `rose-400` | Luminous radial glow stop for ambient hero elements. |
| `--color-pink-light` | `#FFF1F2` | `rgb(255, 241, 242)`| `rose-50` | Soft pink card tint, alert backgrounds for immediate care notices. |
| `--color-pink-tint-1` | `#FDF2F8` | `rgb(253, 242, 248)`| `pink-50` | Gentle ambient gradient middle-stop in warm cards. |
| `--color-pink-tint-2` | `#FCE7F3` | `rgb(252, 231, 243)`| `pink-100` | Pill badge background for ASHA home visit status and screening cards. |
| `--color-pink-tint-3` | `#FFF2F6` | `rgb(255, 242, 246)`| Custom hex | Subtle paper tint for high-density clinical encounter cards. |

### 2.3 Canvas, Neutrals & Structural Obsidian

| Token Name | Hex Code | RGB / RGBA | Role & Usage |
|---|---|---|---|
| `--background` | `#FAFAFC` | `rgb(250, 250, 252)` | Master application viewport canvas (matte, cool, non-glare). |
| `--card` | `#FFFFFF` | `rgb(255, 255, 255)` | Pure white card surfaces, modals, popovers, and floating drawers. |
| `--color-black` | `#111418` | `rgb(17, 20, 24)` | Neue Montreal Deep Slate. Master text color, high-contrast headings, primary borders. |
| `--color-charcoal` | `#0F172A` | `rgb(15, 23, 42)` | Slate-900. High-authority action buttons, dark pills, and footer anchors. |
| `--subtle-foreground`| `#334155` | `rgb(51, 65, 85)` | Slate-700. Secondary text, table headers, descriptions. |
| `--muted-foreground` | `#64748B` | `rgb(100, 116, 139)` | Slate-500. Metadata, timestamps, breadcrumbs, field labels. |
| `--border-hairline` | — | `rgba(17, 20, 24, 0.08)` | Default card and divider border. Ultra-crisp, non-obtrusive. |
| `--border-strong` | — | `rgba(17, 20, 24, 0.15)` | Form input borders, active card wrappers, table outer boundaries. |

### 2.4 Semantic Triage & Clinical Alert Hierarchy

| Level | Background Fill | Border | Text | Context & Action |
|---|---|---|---|---|
| **Tier 4: Critical** | `#FFF1F2` (`rose-50`) | `#FECDD3` (`rose-200`) | `#9F1239` (`rose-800`) | Day 12-14 overdue referrals, suspicious invasive lesion red flags, urgent specialist escalation. |
| **Tier 3: Attention** | `#FFFBEB` (`amber-50`) | `#FDE68A` (`amber-200`) | `#92400E` (`amber-800`) | Day 7-11 follow-up pending, non-diagnostic guardrail notices, unresolved ASHA home visit attempts. |
| **Tier 2: Routine** | `#F0FDF4` (`emerald-50`)| `#BBF7D0` (`emerald-200`)| `#166534` (`emerald-800`)| Normal VIA screening findings, arrival confirmed at KEM Hospital, verified cryptographic audit ledger block. |
| **Tier 1: Guidance** | `#F0F9FF` (`sky-50`) | `#BAE6FD` (`sky-200`) | `#075985` (`sky-800`) | Ayushman Bharat PM-JAY scheme assistance, hospital navigation instructions, appointment reminders. |

---

## 3. Ambient Lighting, Gradients & Depth System

### 3.1 The Orion Gradient Palette
Rather than heavy saturated linear gradients, Orion uses subtle 145° to 160° angled pastel transitions with white origins to keep cards crisp, legible, and airy.

```css
/* 1. Orion Subtle Dual-Tone (Gateway & Feature Tiles) */
.card-gradient-subtle {
  background: linear-gradient(160deg, #FFFFFF 0%, #FDF2F8 30%, #F0F9FF 70%, #FFFFFF 100%);
}

/* 2. Orion Warm Card (Container & Main Hero) */
.card-gradient-warm {
  background: linear-gradient(145deg, #FFFFFF 0%, #F8FAFC 45%, #FDF2F8 100%);
}

/* 3. Orion Blue Clinical Card */
.card-gradient-blue {
  background: linear-gradient(145deg, #FFFFFF 0%, #F0F9FF 45%, #E0F2FE 100%);
}

/* 4. Orion Pink Care Card */
.card-gradient-pink {
  background: linear-gradient(145deg, #FFFFFF 0%, #FFF2F6 45%, #FCE7F3 100%);
}

/* 5. Orion High-Density Data Table Card */
.card-gradient-table {
  background: linear-gradient(180deg, #FFFFFF 0%, #FCF8FA 45%, #F8FAFC 100%);
}
```

### 3.2 Ambient Radial Scrim (The Orion Backdrop)
Instead of flat gray backgrounds, viewport centers are illuminated with an ambient dual-color radial scrim that softens eye fatigue during prolonged clinical sessions.

```html
<!-- Ambient Radial Lighting Scrim -->
<div class="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
  <div class="w-[520px] sm:w-[680px] h-[520px] sm:h-[680px] rounded-full 
              bg-radial from-pink-200/30 via-sky-100/25 to-transparent 
              blur-3xl opacity-75 absolute top-4 left-1/2 -translate-x-1/2" />
</div>
```

### 3.3 Concentric Glowing Orbs
Used in the landing page, 3D cervix visualization, and telemetric pulse points.

```css
@keyframes pulse-subtle {
  0%, 100% { transform: scale(1); opacity: 0.9; }
  50% { transform: scale(1.03); opacity: 1; }
}

.animate-pulse-glow {
  animation: pulse-subtle 3s ease-in-out infinite;
}

.glowing-orb {
  background: radial-gradient(circle, #F43F5E 0%, #EC4899 35%, #F472B6 60%, rgba(251, 207, 232, 0.3) 80%, transparent 100%);
  box-shadow: 0 0 24px -2px rgba(236, 72, 153, 0.45);
}

.glowing-orb-blue {
  background: radial-gradient(circle, #0284C7 0%, #38BDF8 40%, #BAE6FD 70%, transparent 100%);
  box-shadow: 0 0 22px -2px rgba(56, 189, 248, 0.4);
}
```

---

## 4. Quad-Font Typographic Hierarchy & Scale

Orion employs four distinct typeface families, each strictly assigned to a functional role:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        QUAD-FONT ARCHITECTURE                          │
├──────────────────────┬──────────────────────┬──────────────────────────┤
│ 1. Outfit (Sans)     │ 2. DM Sans (Sans)    │ 3. Playfair Display      │
│ Display Headings     │ Primary Body & UI    │ Editorial Subtitles Only │
│ Weights: 600-800     │ Weights: 400-700     │ Weight: 500-600 (Normal) │
├──────────────────────┴──────────────────────┴──────────────────────────┤
│ 4. Geist Mono / ui-monospace                                           │
│ Clinical Data, Tokens (PT-CASE-*), Timestamps, Hashes, Dosages         │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Type Scale Specification Table

| Level / Class | Font Family | Size (rem / px) | Line Height | Weight | Tracking | Text Wrap |
|---|---|---|---|---|---|---|
| `.heading-1` | `Outfit` | `3.75rem` (60px) | `1.0` (60px) | 700 / 800 | `-0.025em` | `balance` |
| `.heading-2` | `Outfit` | `3.00rem` (48px) | `1.0` (48px) | 700 | `-0.02em` | `balance` |
| `.heading-3` | `Outfit` | `2.25rem` (36px) | `2.5rem` (40px) | 600 / 700 | `-0.015em` | `balance` |
| `.heading-4` | `Outfit` | `1.875rem` (30px) | `2.25rem` (36px)| 600 | `-0.01em` | `balance` |
| `.heading-5` | `Outfit` | `1.50rem` (24px) | `2.0rem` (32px) | 600 | `normal` | `balance` |
| `.heading-6` | `Outfit` | `1.25rem` (20px) | `1.75rem` (28px)| 600 | `normal` | `balance` |
| `.title-1` | `DM Sans` | `1.25rem` (20px) | `1.75rem` (28px)| 500 / 600 | `-0.01em` | `pretty` |
| `.title-2` | `DM Sans` | `1.125rem` (18px) | `1.75rem` (28px)| 500 / 600 | `normal` | `pretty` |
| `.title-3` | `DM Sans` | `1.00rem` (16px) | `1.50rem` (24px)| 500 / 600 | `normal` | `pretty` |
| `.title-4` | `DM Sans` | `0.875rem` (14px) | `1.25rem` (20px)| 500 / 600 | `normal` | `pretty` |
| `.title-5` | `DM Sans` | `0.75rem` (12px) | `1.00rem` (16px)| 600 | `+0.01em` | `pretty` |
| `.body-1` | `DM Sans` | `1.00rem` (16px) | `1.50rem` (24px)| 600 | `normal` | `pretty` |
| `.body-2` | `DM Sans` | `1.00rem` (16px) | `1.50rem` (24px)| 500 | `normal` | `pretty` |
| `.body-3` | `DM Sans` | `1.00rem` (16px) | `1.50rem` (24px)| 400 | `normal` | `pretty` |
| `.body-4` | `DM Sans` | `0.875rem` (14px) | `1.25rem` (20px)| 600 | `normal` | `pretty` |
| `.body-5` | `DM Sans` | `0.875rem` (14px) | `1.25rem` (20px)| 500 | `normal` | `pretty` |
| `.body-6` | `DM Sans` | `0.875rem` (14px) | `1.25rem` (20px)| 400 | `normal` | `pretty` |
| `.caption-1` | `DM Sans` | `0.875rem` (14px) | `1.25rem` (20px)| 500 | `normal` | `pretty` |
| `.caption-3` | `DM Sans` | `0.75rem` (12px) | `1.00rem` (16px)| 600 | `+0.01em` | `pretty` |
| `.caption-5` | `DM Sans` | `0.75rem` (12px) | `1.00rem` (16px)| 400 | `normal` | `pretty` |
| `.font-mono-data` | `Geist / Mono`| `0.6875-0.875rem`| `1.2` - `1.4` | 500 / 600 | `0` | `nowrap` |

### 4.2 Editorial Serif Rule: Zero Italics
```css
/* Strictly NON-ITALIC clean serif for prominent editorial subheads only */
.font-subtitle-playfair {
  font-family: 'Playfair Display', serif;
  font-style: normal; /* Italics strictly forbidden in clinical UI */
  font-weight: 500;
}
```

### 4.3 Tabular Numeric Data
All clinical numbers, patient tokens (`PT-CASE-NISHI`), doses, and timestamps use tabular numbers with slashed zeros:
```css
.font-mono-data {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-feature-settings: "tnum" 1, "zero" 1;
}
```

---

## 5. Spatial Geometry, Corner Radii & Elevation

### 5.1 Corner Radius Tokens

```
  rounded-2xl (16px / 1rem)   ->  Primary container cards, modals, Patient Genie
  rounded-xl  (12px / 0.75rem)->  Bento grid tiles, category cards, input wrappers
  rounded-lg  (10px)          ->  .card-base, clinical telemetry cards, data tables
  rounded-md  (6px / 0.375rem)->  Buttons, search inputs, dropdown menus, filter pills
  rounded-full (9999px)       ->  Status badges, language selectors, avatar containers
```

### 5.2 Hairline Borders & Shadows
Orion avoids heavy drop shadows. Elevation is achieved through hairline borders layered over micro-shadows:

```css
/* Card Base Rule */
.card-base {
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  box-shadow: 0 2px 10px -2px rgba(15, 23, 42, 0.06);
}

/* Layered Shadow Tokens */
shadow-2xs: 0 1px 2px 0 rgba(15, 23, 42, 0.04);
shadow-xs:  0 1px 3px 0 rgba(15, 23, 42, 0.08), 0 1px 2px -1px rgba(15, 23, 42, 0.08);
shadow-sm:  0 2px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.06);
shadow-md:  0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04);
```

---

## 6. Textures, Micro-Interactions & Motion

### 6.1 Diagonal Hatch Patterns
Used to indicate capacity, pending follow-up time, or audit verification tracks:

```css
/* Standard Gray Hatch */
.bg-hatch {
  background-image: repeating-linear-gradient(
    -45deg,
    rgba(148, 163, 184, 0.25),
    rgba(148, 163, 184, 0.25) 2.5px,
    transparent 2.5px,
    transparent 7px
  );
}

/* Orion Blue Medical Hatch */
.bg-hatch-blue {
  background-image: repeating-linear-gradient(
    -45deg,
    rgba(43, 102, 228, 0.25),
    rgba(43, 102, 228, 0.25) 2.5px,
    transparent 2.5px,
    transparent 7px
  );
}
```

### 6.2 Minimalist Striped Glyphs
Representing structured clinical protocols and operational tracking bars:

```css
.striped-glyph {
  display: inline-flex;
  flex-direction: column;
  justify-content: space-between;
  width: 16px;
  height: 22px;
  flex-shrink: 0;
}

.striped-glyph span {
  display: block;
  height: 2px;
  width: 100%;
  background-color: currentColor;
  border-radius: 1px;
}
```

### 6.3 Easing Motion Curves
All hover, modal expansion, and tab transitions use the calibrated Orion deceleration curve:

```css
.motion-base {
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  transition-duration: 500ms;
}

.motion-hover {
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  transition-duration: 300ms;
}
```

### 6.4 Reduced Motion Compliance
For patients or clinicians who enable operating system reduced motion:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 7. Component & Screen Architecture

### 7.1 Landing Page Hero & 3D Cervix Visualization
- **Layout**: Centered, balanced medical showcase flanked by clear callouts.
- **Interactive 3D Stage**: WebGL Three.js canvas embedded inside a luminous `card-gradient-warm` container.
- **Controls**: Minimalist circular buttons (`+`, `-`, rotate, expand) in pure white with hairline `border-black/15` and `shadow-2xs`.
- **14-Day Timeline Slider**: Track colored with Orion Sky Blue (`#0284C7`) progressing to Dark Pink (`#9D174D`) at Day 14 follow-up closure.

### 7.2 Care Gateway (`/gateway`)
The four primary entry pathways are laid out in an Orion Bento Grid:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                             CERVISETU GATEWAY                              │
│         Ambient Dual-Radial Light Scrim (#FCE7F3 to #E0F2FE)               │
├────────────────────────────────────────────────────────────────────────────┤
│  [ Search Hospitals & Facilities by District... (Hairline Input) ]         │
├────────────────────────────────────────────────────────────────────────────┤
│  [ Clinician & Staff ]   [ ASHA Mobilizer ]   [ Patient ]   [ Admin ]      │
│  Border: #0284C7         Border: #9D174D      Border: #0284C7 Border: Slate│
│  Button: #0F172A         Button: #9D174D      Button: White Button: Slate  │
│  Pill: Sky-50            Pill: Pink-50        Pill: White   Pill: Slate-50 │
└────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Patient Care Companion (Patient Genie)
- **Container**: `bg-white border-2 border-pink-200/80 rounded-2xl shadow-sm`.
- **Header Bar**: Gradient from `sky-50` via `white` to `pink-50/70`, badge: `Sarvam Voice Active` (`bg-emerald-100 text-emerald-800`).
- **Strict Non-Diagnostic Guardrail Callout**: `bg-amber-50/70 border border-amber-200/90 text-amber-900`.
- **Refusal Response Bubble**: `bg-rose-50/90 border-2 border-rose-300 text-rose-950` with an explicit shield alert badge.
- **Audio Playback**: Integrated `POST /api/genie/speak` with `bulbul:v4-flash` via Sarvam TTS.

### 7.4 Clinical Encounter & Ward Board
- **Status Badges**:
  - `REFERRED`: Dark pink text `#9D174D`, soft pink background `#FCE7F3`.
  - `VISITED / ARRIVED`: Emerald text `#166534`, background `#DCFCE7`.
  - `DECLINED`: Slate text `#475569`, background `#F1F5F9`.
- **High-Density Inputs**: Clean white cards with `border-black/12`, focus rings in `ring-2 ring-[#0284C7]`.

---

## 8. Design System Governance & Strict Rules of Engagement

1. **Rule of Color Restraint**: Never use raw, uncalibrated saturation (`#FF0000`, `#00FF00`, `#FF00FF`). Use only tokens from the Orion master table.
2. **Typography Pairing**: Never use `Playfair Display` for body text or buttons. It is strictly reserved for normal (non-italic) editorial subtitles.
3. **Contrast Compliance**: All text must meet WCAG AA contrast (minimum 4.5:1 for body text, 3:1 for large display headings).
4. **Mobile First Responsive Wrapping**: On viewports under 640px, all button groups wrap automatically (`flex-wrap: wrap`) to ensure Indic scripts do not overflow the screen.
5. **No Decorative Placeholders**: Every visual element must map to a clinical data point, hospital routing action, or patient welfare outcome.
