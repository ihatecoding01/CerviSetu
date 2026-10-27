# CerviSetu Frontend

> **CerviSetu** — Real-time rural cancer patient tracking, escalation heatmaps, and ASHA worker coordination dashboard platform, built with CareUI.

Built for the **OHC Network Hackathon** · [CareUI](https://github.com/ohcnetwork/careui) design system · [OHC Skills](https://github.com/ohcnetwork/skills) integrated

---

## Features

- 📊 **Overview Dashboard** — Live patient case stats: total, critical, overdue, tier-4 alerts
- 🔥 **Escalation Heatmap & Simulator** — Visual tier distribution (Tier 1 SMS → Tier 4 Authority) + interactive simulation engine
- 🔬 **Image Quality Triage** — Real-time Laplacian blur variance, FFT spectrum check & clinician corrective guidance
- 👩‍⚕️ **ASHA Worker Coordination** — Field worker assignment dashboard, critical patient dispatch alerts, capacity visualization
- 📋 **Clinical Intake** — Submit patient cases to the LangGraph multi-agent diagnostic backend (OCR → Image Triage → AI Diagnosis → Rural Tracker)
- 🔐 **Audit Ledger** — Filterable immutable audit chain + AES-256 PII vault inspector with authorized-role access gating

## Tech Stack

- **React 19 + TypeScript** — Modern type-safe UI
- **CareUI Design System** — Official OHC healthcare UI library (`@base-ui/react`, CVA, Lucide)
- **Tailwind CSS v4** — High-performance utility styles via `@tailwindcss/vite`
- **Vite 8** — Next-gen frontend tooling
- **FastAPI Backend** — LangGraph multi-agent AI pipeline

## Component Architecture

Components follow the official [CareUI Registry](https://careui.ohc.network/#get-started):

```
frontend/
├── components.json            # CareUI / shadcn registry config
├── src/
│   ├── api/
│   │   └── client.ts          # Typed API client for FastAPI backend
│   ├── components/
│   │   ├── careui/            # Official CareUI components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── input.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── table.tsx
│   │   │   ├── alert.tsx
│   │   │   ├── slider.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── progress.tsx
│   │   │   └── skeleton.tsx
│   │   ├── DashboardLayout.tsx     # CareUI sidebar + main shell
│   │   ├── OverviewPanel.tsx       # CareUI case table + metrics
│   │   ├── ClinicalIntake.tsx      # CareUI patient intake form
│   │   ├── ImageQualityTriage.tsx  # CareUI image sharpness inspector
│   │   ├── EscalationHeatmap.tsx   # CareUI escalation matrix + simulator
│   │   ├── AshaCoordination.tsx    # CareUI field worker coordination
│   │   └── AuditLedger.tsx         # CareUI audit logs + vault inspector
│   ├── hooks/
│   │   └── use-auto-space.ts  # CareUI auto-punctuation hook
│   ├── lib/
│   │   └── utils.ts           # Class merge utility (clsx + twMerge)
│   ├── App.tsx                # Application shell
│   └── index.css              # CareUI design tokens & Tailwind imports
└── vite.config.ts             # Tailwind v4 plugin + @ path alias
```

## Getting Started

### Prerequisites

- Node.js 18+
- Running CerviSetu backend (FastAPI): `python main.py` from project root

### Development

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

App will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

## Escalation Tiers

| Tier | Trigger | Action |
|------|---------|--------|
| **Tier 1** | Day 1–2 overdue | Automated SMS reminder |
| **Tier 2** | Day 3–5 overdue | Automated IVR phone call |
| **Tier 3** | Day 6–7 overdue | ASHA worker physical dispatch |
| **Tier 4** | Day 8+ overdue | Emergency authority escalation + PII unmask |

## License

MIT · OHC Network Hackathon 2026
