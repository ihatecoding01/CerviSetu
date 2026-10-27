# CerviSetu UI/UX Design Overhaul Specification

> **Design Directive**: A complete, uncompromising overhaul of the CerviSetu interface. Modeled directly on the clinical design references in [`frontend/public/inspo/`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/frontend/public/inspo), this specification enforces **zero emojis**, **zero neon/cyberpunk aesthetics**, and **zero AI slop**. The system transitions from a dark neon theme to an ultra-refined, high-density Swiss-Grotesk clinical workstation.

---

## 1. Design Philosophy & Creative Direction

### The "Anti-AI Slop" & Pure Clinical Precision Mandate
The existing frontend relies on dark `#090d16` canvas backgrounds, neon emerald glowing borders, pinging animations, and emoji icons (`⚕️`, `📊`, `🔥`, `🔬`, `👩‍⚕️`, `📋`, `🔐`). In high-stakes oncology screening and rural healthcare tracking, this aesthetic diminishes clinical authority and increases cognitive fatigue.

The new design draws directly from:
- **`font and colours.png`**: Structured typographic hierarchy and a curated 4-color clinical palette.
- **`homepage.png`**: Hospital command center dashboard featuring clean white cards, subtle hairline dividers, dot-matrix sparklines, and structured staff/coverage bars.
- **`componets.png`**: Patient flow queues, multi-line trend telemetry, and actionable bottleneck resolution cards.
- **`components2.png`**: 12×5 dot-matrix histogram KPI cards and striped operational metric glyphs.
- **`components3.png`**: Matrix-based timeline planner with diagonal hatch fills and pastel alert cards.

### Core Visual Principles
1. **Light Clinical Canvas**: Pure white (`#FFFFFF`) card surfaces on crisp off-white (`#F8F9FA` / `#F3F4F6`) backgrounds with 1px precision borders (`#E5E7EB` / `#E2E8F0`).
2. **Authoritative Typography**: Neo-Grotesque sans-serif (Neue Montreal / Plus Jakarta Sans / Inter) with strict type scales (24px bold headings, 18px medium subheadings, 14px regular body text).
3. **No Emojis**: Every icon is rendered exclusively via thin-line SVG icons from `lucide-react` (1.5px to 2px stroke, monochromatic gray `#64748B` or dark obsidian `#111418`).
4. **Curated Color Restraint (No Neon)**: Primary action `#2B66E4` (Royal Cobalt), diagnostic cyan `#4A91A7`, warm watch gold `#D8CA21`, and structural black `#111418`. Status alerts use gentle pastel fills rather than high-saturation neon gradients.
5. **Authentic Data Density**: Functional UI elements—dot matrix histograms, striped glyphs, progress bars with diagonal hatch patterns, cryptographic audit hashes, and structured clinical tables.

---

## 2. Design System Tokens & Color Palette

### 2.1 The Master Inspo Palette (from `font and colours.png`)

| Token | Hex Code | Role & Usage |
|---|---|---|
| **Primary Accent** | `#2B66E4` | Interactive primary actions, "+ New Case" buttons, active focus rings, primary trend lines |
| **Clinical Cyan** | `#4A91A7` | Diagnostic AI indicators, secondary metrics, bed/patient telemetry, histopathology tags |
| **Warm Ochre Gold** | `#D8CA21` | Warning alerts, wait-time telemetry, watch-list cases, overdue status indicators |
| **Obsidian Dark** | `#111418` | Primary headings, active sidebar pill background, high-contrast labels, primary buttons |

### 2.2 Semantic Foundation & Neutrals

| Token | Value | Description |
|---|---|---|
| `--bg-canvas` | `#F8F9FA` | Main app background (soft, paper-white clinical surface) |
| `--bg-card` | `#FFFFFF` | Card, modal, and drawer surface |
| `--bg-subtle` | `#F1F5F9` | Hover states, table headers, inactive pill backgrounds |
| `--border-subtle` | `#E5E7EB` | Hairline 1px border on cards and separators |
| `--border-strong` | `#CBD5E1` | Input field borders, active tabs, divider lines |
| `--text-primary` | `#111418` | Deep obsidian for headings, metric values, and primary text |
| `--text-secondary` | `#4B5563` | Medium gray for table labels, subtitles, and metadata |
| `--text-muted` | `#9CA3AF` | Light gray for timestamps, breadcrumb dividers, disabled elements |

### 2.3 Soft Alert Pastels (Non-Neon, High Legibility)

| Alert Level | Background Tint | Border | Pill / Badge Fill | Text Color |
|---|---|---|---|---|
| **Critical (Tier 4)** | `#FFF1F0` | `#FED7D7` | `#E02424` | `#771D1D` |
| **High (Tier 3)** | `#FEF9C3` | `#FDE047` | `#D97706` | `#78350F` |
| **Medium (Tier 2)** | `#F0FDF4` | `#BBF7D0` | `#059669` | `#065F46` |
| **Low / Info (Tier 1)** | `#EFF6FF` | `#BFDBFE` | `#2B66E4` | `#1E40AF` |

---

## 3. Typographic Hierarchy

Following `font and colours.png`:
- **Font Family**: `'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Monospace Family**: `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace` (for patient tokens, audit hashes, AES keys)

```
Heading 1 (Page Title / Welcome): 24px | Weight: 700 (Bold) | Line-height: 1.25 | Letter-spacing: -0.02em
Heading 2 (Card Title / Engine):  18px | Weight: 600 (Semibold) | Line-height: 1.3 | Letter-spacing: -0.01em
Heading 3 (Section / Subtitle):   15px | Weight: 600 (Semibold) | Line-height: 1.4
Body (Standard UI / Table Text):  14px | Weight: 400 (Regular) | Line-height: 1.5
Caption / Micro-Text / Badges:    12px | Weight: 500 (Medium) | Line-height: 1.4 | Letter-spacing: 0.01em
Tiny Meta (Timestamps / Subtext): 11px | Weight: 500 (Medium) | Line-height: 1.3
```

---

## 4. Component-by-Component Redesign Mapping

### 4.1 Global Layout & Navigation (`DashboardLayout.tsx`)
- **Current State**: Dark `#0b1120` sidebar, `⚕️` emoji logo, emoji tab icons (`📊`, `📋`, `🔥`), dark borders.
- **Redesigned State** (modeled on `homepage.png`):
  - **Sidebar Surface**: Crisp white (`#FFFFFF`) with 1px right border (`#E5E7EB`).
  - **Brand Header**: CerviSetu logo with a clean geometric line mark (Lucide `Crosshair` or `ShieldCheck` in a 36px `#111418` dark tile), followed by `CerviSetu` (16px bold) and subtitle `Clinical AI Platform` (11px uppercase gray).
  - **Quick Search**: Inset input field with search icon and keyboard shortcut badge `⌘K`.
  - **Nav Items**:
    - Active State: Solid obsidian pill (`bg-[#111418] text-white font-medium shadow-sm`).
    - Inactive State: Light gray hover (`hover:bg-[#F3F4F6] text-[#4B5563]`).
    - Icons: Lucide line icons replacing all emojis:
      - Overview: `<LayoutDashboard className="h-4 w-4" />`
      - Clinical Intake: `<FileSpreadsheet className="h-4 w-4" />`
      - Image Triage: `<ScanLine className="h-4 w-4" />`
      - Escalation Matrix: `<Flame className="h-4 w-4" />`
      - ASHA Coordination: `<Users className="h-4 w-4" />`
      - Audit Ledger: `<ShieldCheck className="h-4 w-4" />`
  - **Sidebar Footer**: Network status pill (`● Online | v1.0`), plus `Log out` link with `<LogOut className="h-4 w-4" />`.
  - **Top Bar**:
    - Breadcrumbs: `← | ⌂ Home > Patient Intake`
    - Actions: `+ New Patient Case` button in solid `#2B66E4`, Notification bell button with count dot, and Clinician Profile avatar ("Dr. Morgan").

---

### 4.2 Overview Command Center (`OverviewPanel.tsx`)
Modeled on `homepage.png` and `components2.png`:

1. **4 KPI Metric Cards with 12×5 Dot-Matrix Sparklines**:
   - **Total Active Cases**: `1,284` with green delta `▲ 8.4% vs last week`, green dot-matrix histogram.
   - **Screening Adherence**: `87%` with `42 pending review`, blue (`#2B66E4`) dot-matrix histogram.
   - **Avg. Diagnostic Latency**: `24 min` with `▼ 12% faster`, yellow (`#D8CA21`) dot-matrix histogram.
   - **Severe Overdue (Tier 3–4)**: `38` cases with `▲ 12 above target`, cobalt blue dot-matrix histogram.
2. **CerviSetu AI Clinical Engine Banner**:
   - Clean white card featuring subtle architectural/network node illustration.
   - Dual benchmark statistics with minimalist horizontal striped glyphs:
     - `87%` Image Triage Sharpness | `42 Checked`
     - `24m` End-to-End Diagnostic Turnaround
   - AI Clinical Recommendation Bar: Soft blue gradient pill with:
     - "AI Clinical Alert: Case PT-RURAL-7891 is 8 days overdue with Stage III Biopsy. Tier 4 Authority Dossier compiled."
     - `[Apply Action]` button in black.
   - Live Engine Status: Minimalist soundwave/pulse with `[··] LIVE`.
3. **Split Grid (Bottom View)**:
   - **Left Column**: Cancer Screening Staging & Follow-up Coverage (progress bars in solid `#2B66E4` with percentage badges and diagonal hash fill for remaining margin; multi-segment capacity bar for Tiers 1–4).
   - **Right Column**: Critical Escalation Alerts (cards in soft rose `#FFF1F0`, amber `#FEF9C3`, and seafoam `#F0FDF4`, each with urgency badge, time elapsed, and `Resolve` action button).
4. **Patient Queue Data Table** (from `componets.png`):
   - Table columns: `Patient Token`, `Suspected Cancer`, `Days Overdue`, `Biopsy Status`, `Triage Urgency`, `Action`.
   - Subtle pastel pill badges for statuses (`Critical` in soft red, `Severe` in soft amber, `Stable` in soft teal).
   - `View Case` text button and options dropdown.

---

### 4.3 Clinical Intake & LangGraph Execution (`ClinicalIntake.tsx`)
- **Current State**: Neon dark form, emoji headings, glowing borders.
- **Redesigned State**:
  - Two-column ergonomic workstation layout:
    - **Left Column (Intake Workspace)**:
      - Document Ingestion: Clean dashed upload dropzone with Lucide `UploadCloud` icon, drag-and-drop for medical PDFs and JPG/PNG biopsy scans.
      - Patient Context: Clean floating-label inputs for Patient Name, Age/Gender, Village, District, Mobile (+91 format).
      - Clinical Examination Notes: Form textarea with clean border focus state (`border-[#2B66E4] ring-2 ring-[#2B66E4]/20`).
      - Fast preset selector buttons: `Sample Oral Case`, `Sample Cervical Case`, `Clear Form`.
      - Submit Button: Full-width solid `#2B66E4` primary button with `<ArrowRight className="h-4 w-4" />`.
    - **Right Column (LangGraph Multi-Agent Telemetry & Output)**:
      - Pipeline Stepper: 4 discrete stages (`OCR Intake` → `PII Encryption` → `Diagnostic AI` → `Rural Tracker`) with clean numbered circles and connected vertical progress line.
      - De-Identified Patient Vault Card: Shows `PT-ANON-XXXX` token in clean JetBrains Mono font, with AES-256 seal badge.
      - Diagnostic Impression Dossier: Structured clinical findings, estimated TNM stage, differential diagnoses rendered as clean light-gray chips, and clinical urgency indicator.

---

### 4.4 Image Quality & Blur Triage Inspector (`ImageQualityTriage.tsx`)
- **Current State**: Neon green progress bars, emojis, dark background.
- **Redesigned State**:
  - Sharpness Telemetry Gauge: Clean card with numerical Laplacian variance score (e.g. `142.6`), minimum pass threshold (`85.0`), and crisp high-frequency FFT ratio.
  - Three Inspection Criteria Cards:
    1. **Laplacian Spatial Variance**: Sharp vs. Blurry motion detection.
    2. **FFT High-Frequency Energy Ratio**: Tissue texture attenuation test.
    3. **Exposure & Contrast Distribution**: Glare / underexposure histogram check.
  - Interactive Scan Simulator: Dropdown to test `Sharp Histopathology Slide`, `Motion Blurred Dermoscopy`, or `Underexposed Cervigram Scan`.
  - Actionable Clinician Advice Box: Soft blue notification card with structured bullet points for field health workers on camera positioning and illumination.

---

### 4.5 Rural Escalation Matrix & Heatmap (`EscalationHeatmap.tsx`)
Modeled on `components3.png` Shift & Timeline Planner:
- **Matrix View**:
  - Columns: Overdue timeline milestones (`Day 1–2 SMS`, `Day 3–5 IVR`, `Day 6–7 ASHA`, `Day 8+ Authority`).
  - Rows: Cancer risk strata (`Stage IV Critical`, `Stage III Severe`, `Stage II Moderate`, `Stage I Early`).
  - Cells: High-density count badges with diagonal hatch backgrounds (`patterns`) to distinguish load severity.
  - Legend: Color-coded dots (`Fully Addressed` green `#10B981`, `In Transit` orange `#F97316`, `Unresolved Escalation` blue `#2B66E4`).
- **Interactive Escalation Timeline Slider**:
  - Precision slider (0 to 14 days overdue) with tick marks and current day pill.
  - Instant reactive tier evaluation showing exact notification dispatch payload:
    - Tier 1: Multilingual WhatsApp/SMS template.
    - Tier 2: Automated Hindi/Regional IVR voice call transcript.
    - Tier 3: Field ASHA worker dispatch ticket with GPS sector coordinates.
    - Tier 4: Emergency District Authority Dossier with unmasked patient address.

---

### 4.6 ASHA Field Worker Coordination (`AshaCoordination.tsx`)
Modeled on the Staffing Engine in `homepage.png` and `components2.png`:
- **Worker Roster Grid**: Clean cards for each field worker (e.g. `Sunita Devi - Sector 4`, `Pooja Sharma - Mirzapur North`).
- **Capacity & Coverage Telemetry**: Horizontal blue progress bars showing patient visits assigned vs completed, with diagonal hatch fill for remaining daily quota.
- **Emergency Dispatch Orders**: Queue of pending physical home visits for patients who have missed appointment windows by 6+ days.
- **Action Trigger**: `Dispatch Visit Order` button in solid `#111418` dark style.

---

### 4.7 Chained Audit Ledger & PII Vault (`AuditLedger.tsx`)
- **Immutable Log Table**:
  - Columns: `Timestamp`, `Event ID`, `Severity`, `Action Executed`, `Patient Token`, `Cryptographic Block Hash`.
  - Severity Badges: Soft pastel pills (`CRITICAL` in soft rose, `WARNING` in soft amber, `INFO` in soft blue).
  - Block Hash Column: Monospace truncated hash with copy button (`e8f3...91ab`).
- **Gated AES-256 Vault Inspector**:
  - Authorized clinician role simulator (`Doctor`, `District Magistrate`, `Audit Officer`).
  - Unmasking workflow: Shows locked state (`••••••••`) until authenticated role triggers authorized decryption, logging a new block in the tamper-evident ledger.

---

## 5. CSS & Utility Overhaul (`frontend/src/index.css`)

### Removal of Dark/Neon Tokens & Replacement with Clinical Tokens
```css
:root {
  color-scheme: light;
  
  /* Primary Inspo Colors */
  --color-primary: #2B66E4;          /* Royal Cobalt */
  --color-clinical-cyan: #4A91A7;    /* Slate Cyan */
  --color-warm-gold: #D8CA21;        /* Warm Ochre */
  --color-obsidian: #111418;         /* Deep Charcoal */
  
  /* Surfaces & Canvas */
  --bg-canvas: #F8F9FA;
  --bg-card: #FFFFFF;
  --bg-subtle: #F1F5F9;
  
  /* Borders */
  --border-subtle: #E5E7EB;
  --border-strong: #CBD5E1;
  
  /* Typography */
  --text-primary: #111418;
  --text-secondary: #4B5563;
  --text-muted: #9CA3AF;
  
  /* Diagonal Hatch Pattern Utility */
  --hatch-pattern: repeating-linear-gradient(
    45deg,
    rgba(226, 232, 240, 0.4),
    rgba(226, 232, 240, 0.4) 6px,
    transparent 6px,
    transparent 12px
  );
}
```

---

## 6. Implementation Checklist & Verification Strategy

| Step | Target File | Actions & Scope |
|---|---|---|
| **Phase 1: Design Tokens** | `frontend/src/index.css` | Replace dark/neon color variables with the `#2B66E4`, `#4A91A7`, `#D8CA21`, `#111418` light theme. Add dot-matrix grid and diagonal hatch utility classes. |
| **Phase 2: Shell & Navigation** | `frontend/src/components/DashboardLayout.tsx` | Replace dark sidebar with clean white sidebar. Replace all emojis (`⚕️`, `📊`, etc.) with Lucide line icons. Add top breadcrumbs, global search `⌘K`, "+ New Case" button, and doctor profile. |
| **Phase 3: Overview Command Center** | `frontend/src/components/OverviewPanel.tsx` | Overhaul 4 metric cards with 12×5 dot-matrix sparklines. Implement Aura/CerviSetu AI Engine card with striped glyphs and recommendation banner. Rebuild table and alerts with pastel styling. |
| **Phase 4: Clinical Intake** | `frontend/src/components/ClinicalIntake.tsx` | Replace neon cards with crisp white forms. Reorganize into 2-column workstation. Clean stepper, no emojis. |
| **Phase 5: Image Triage** | `frontend/src/components/ImageQualityTriage.tsx` | Clean numerical gauge for Laplacian variance, FFT ratio, and clear clinical advice card. |
| **Phase 6: Escalation Matrix** | `frontend/src/components/EscalationHeatmap.tsx` | Implement Shift/Timeline matrix with diagonal hatch pattern cells and pastel tier cards. |
| **Phase 7: ASHA & Field Coordination** | `frontend/src/components/AshaCoordination.tsx` | Rebuild worker capacity cards, progress bars with diagonal hatch fill, and visit dispatch queue. |
| **Phase 8: Chained Audit Ledger** | `frontend/src/components/AuditLedger.tsx` | Clean tabular ledger, monospace hashes, pastel badges, and gated vault unmasking inspector. |
| **Phase 9: Quality & Build Pass** | Frontend Build | Run `npm run build` to guarantee 0 TypeScript/CSS build errors. |

---

*Authored for the CerviSetu Team · Ready for implementation upon review.*
