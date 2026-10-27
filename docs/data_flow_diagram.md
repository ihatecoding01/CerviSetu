# CerviSetu: Core Hub-Spoke Data Flow Diagram

> For the comprehensive master specification covering all features, system architecture, Level 0/1 DFDs, and all 5 workflow sequence diagrams, refer to [SYSTEM_ARCHITECTURE_AND_FEATURES.md](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/docs/SYSTEM_ARCHITECTURE_AND_FEATURES.md).

```mermaid
flowchart TD
  %% External Entities
  PAT(["EXTERNAL ENTITY: Patient & Family<br/>(WhatsApp / IVR / Printed Pass)"])
  SPOKE_MD(["EXTERNAL ENTITY: Regional EBRT Spoke Staff<br/>(Therapist / Local Oncologist)"])
  HUB_MD(["EXTERNAL ENTITY: Central Brachytherapy Hub MD<br/>(Radiation Oncologist / Coordinator)"])
  ASHA(["EXTERNAL ENTITY: ASHA / Field Navigator"])

  %% Processes
  P1(("P1.0<br/>DPDP Consent &<br/>Indic Voice Gateway<br/>(Sarvam/Bhashini)"))
  P2(("P2.0<br/>Patient Co-Pilot:<br/>Toxicity, Finance &<br/>47-Mile Travel"))
  P3(("P3.0<br/>Dual-Clock (49d/56d)<br/>& Day-21 Hub-Spoke<br/>Bridge Engine"))
  P4(("P4.0<br/>AI-Assisted NCG<br/>Scribe & Hard<br/>Clinician Gate"))
  P5(("P5.0<br/>Real-Time QI &<br/>Guideline Telemetry<br/>Aggregator"))

  %% Data Stores
  D1[("D1: ABDM / FHIR R4 Store<br/>(CarePlan, Task, Appointment)")]
  D2[("D2: Scheme & Dharamshala<br/>Knowledge Base (Verified)")]
  D3[("D3: Append-Only Audit &<br/>DPDP Consent Ledger")]
  D4[("D4: De-Identified QI Cohort DB<br/>(OTT, Distance, Dropouts)")]

  %% Flows
  PAT -->|"1. Voice Consent, Symptom Check-in, Scheme Query"| P1
  SPOKE_MD -->|"2. ABHA Link, EBRT Frac 1..25, Cisplatin Log"| P3
  HUB_MD -->|"3. Spoken Clinical Assessment"| P1

  P1 -->|"Logged Consent"| D3
  P1 -->|"Patient Intent (Vernacular)"| P2
  P1 -->|"De-Identified ASR Transcript"| P4

  D2 -->|"PMJAY Rules & Bus/Stay Info"| P2
  P2 -->|"Visual Clock, Hydration Prep, Travel Pass, Brachy Audio"| PAT
  P2 -->|"Grade 2+ Toxicity Alert"| SPOKE_MD

  P3 -->|"Day-21 Pre-Brachy Readiness Checklist"| SPOKE_MD
  P3 -->|"Hub OT Slot Request & Traffic-Light Board (≤49d/≤56d)"| HUB_MD
  P3 -->|"Missed Fraction / Cisplatin Recall"| PAT
  P3 -->|"Escalation after N Non-Responses"| ASHA

  P4 -->|"Unsigned NCG Draft"| HUB_MD
  HUB_MD -->|"4. Edit & Digital Sign-Off (Purges Audio)"| P4
  P4 -->|"Signed FHIR Bundle"| D1
  P4 -->|"Sign-Off Timestamp"| D3

  P3 -->|"Pathway Dates & Delay Codes"| D1
  D1 -->|"De-Identified Episode Dates & Travel km"| P5
  P5 -->|"Pre/Post Cohort Stats (Chi-Sq, t-test, <=49d/<=56d %)"| D4
```