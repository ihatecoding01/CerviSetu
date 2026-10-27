# CerviSetu: Hub-Spoke Radiation Oncology Architecture

> For the comprehensive master specification covering all features, system architecture, Level 0/1 DFDs, and all 5 workflow sequence diagrams, refer to [SYSTEM_ARCHITECTURE_AND_FEATURES.md](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/docs/SYSTEM_ARCHITECTURE_AND_FEATURES.md).

```mermaid
flowchart TB
  subgraph CLIN["CLINICIAN SIDE (30% Weight · Zero-Friction Input)"]
    direction TB
    c_spoke["Regional EBRT Spoke UI<br/>• 1-Tap ABHA Onboarding<br/>• Barcode Daily Fraction Log"]
    c_hub["Central Brachytherapy Hub UI<br/>• OTT Traffic-Light Board (≤49d / ≤56d)<br/>• Day-21 Readiness Sign-Off Gate<br/>• 60s Voice-to-NCG Note & OT Scheduler"]
  end

  subgraph PAT["PATIENT SIDE (70% Weight · High-Touch Vernacular Co-Pilot)"]
    direction TB
    p_clock["Visual & Voice 'Healing Clock'<br/>• Literacy-free 25 EBRT + 4 Brachy Bar"]
    p_tox["Proactive Toxicity & Prep Coach<br/>• Weekly Cisplatin Hydration Prep<br/>• Bi-weekly Symptom Triage"]
    p_log["Hub-Spoke Travel & Finance Unlocker<br/>• Day-1 PMJAY/Transport RAG Bot<br/>• Day-21 Brachy Explainer & Dharamshala Pass"]
  end

  subgraph AIGW["GUARDRAILED AI & INDIC VOICE LAYER"]
    direction LR
    asr["Sarvam Saaras v3 / Bhashini<br/>22-Lang ASR & TTS<br/>(Ephemeral Audio)"]
    llm["JSON-Schema LLM Scribe<br/>NCG Note Draft Only<br/>(Hard Human Sign-Off)"]
    rag["Scheme & Logistics RAG<br/>PMJAY + State Transport + Stays<br/>(Zero Medical Advice)"]
  end

  subgraph CORE["DETERMINISTIC DUAL-CLOCK & HUB-SPOKE ENGINE"]
    direction LR
    clock["Dual-Clock Timer<br/>• Optimal: ≤49d (GEC-ESTRO)<br/>• Limit: ≤56d (ABS/NCG)<br/>• Projected Finish Calculator"]
    bridge["Day-21 Hub-Spoke Bridge<br/>• Auto-fires at EBRT Frac 15<br/>• Pre-Brachy Checklist Gate<br/>• Cross-Site Slot Matcher"]
    triage["Escalation & Recall Router<br/>• Toxicity Rule Triage<br/>• WhatsApp/IVR -> ASHA Escalation"]
  end

  subgraph DATA["DATA, COMPLIANCE & BUILT-IN QI RESEARCH LAYER"]
    direction LR
    fhir[("ABDM / FHIR R4 Store<br/>Patient · CarePlan · Task<br/>Appointment · Observation")]
    audit[("DPDP & Audit Ledger<br/>Per-Category Consent<br/>Append-Only Action Log")]
    qi[("Live QI Research Engine<br/>Pre/Post Cohort Telemetry<br/>OTT vs Distance Regression")]
  end

  c_spoke & c_hub -->|"Offline-First Sync"| CORE
  c_hub -->|"Voice Dictation"| asr --> llm -->|"Unsigned Draft"| c_hub
  PAT <-->|"WhatsApp / IVR / Printed Card"| asr
  p_log <--> rag
  asr <--> triage
  CORE --> fhir & audit & qi
```