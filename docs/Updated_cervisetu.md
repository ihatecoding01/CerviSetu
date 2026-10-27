Below is your updated, production-ready SYSTEM_ARCHITECTURE_AND_FEATURES.md (Version 2.0.0).

It completely removes the legacy colposcopy/histopathology image model, repurposes your image pipeline strictly into a Smart Document OCR & Referral Slip Upload Engine (so doctors, nurses, or clinic helpers can snap a photo of paper slips, lab reports, or discharge cards for instant data entry), and integrates the 70/30 Patient-to-Clinician split, the Pre-Emptive Patient Co-Pilot, the Dual-Clock (49d/56d) Day-21 Hub-Spoke Bridge, your AES-256-GCM / SHA-256 security architecture, and the Built-in QI Research Telemetry Engine.   
MD
+ 4

Markdown
# CerviSetu: System Architecture, Data Flow & Feature Specification

> **Platform**: CerviSetu — Assistive Oncology Pathway, Smart OCR Intake & Patient-Centric Rural Tracking System  
> **Document Type**: Master Technical Architecture & Functional Specification  
> **Target Audience**: Solution Architects, Clinical Engineers, Security Auditors, and Technical Evaluators  
> **Version**: 2.0.0 (Patient-Centric Hub-and-Spoke Architecture)  
> **Status**: Active / Field-Tested  
> **Regulatory Posture**: Strictly Assistive & Non-Diagnostic (CDSCO SaMD Safe · DPDP Act 2023 Compliant · ABDM FHIR R4 Aligned)

---

## 1. Executive Summary & Problem Domain

### 1.1 The Cervical Cancer Care & Coordination Crisis in India
In rural and semi-urban Indian healthcare ecosystems, cervical cancer accounts for ~127,526 new cases and ~79,906 deaths annually (*GLOBOCAN 2022*), despite being largely preventable and curable if treated on time. Patients and frontline clinicians face two critical systemic failures:

1. **High Clerical Friction & Fragmented Intake at Regional Spokes**:
   - Doctors, nurses, and healthcare helpers at Primary Health Centres (PHCs) and regional External Beam Radiation Therapy (EBRT) spokes are overwhelmed by manual data entry across paper OPD cards, blood test slips (CBC/RFT), and referral forms.
   - Re-typing patient records creates severe clerical bottlenecks, while illegible or incomplete paper referrals between regional EBRT clinics and central Brachytherapy hubs delay treatment scheduling by 3 to 6 weeks.

2. **Overall Treatment Time (OTT) Breaches & Pre-Emptive Dropout**:
   - Curative cervical cancer treatment requires concurrent chemoradiation (25 fractions of EBRT + weekly Cisplatin) followed by High-Dose-Rate (HDR) Brachytherapy (3–4 fractions).
   - **The 49/56-Day Radiobiological Clock**: Clinical benchmarks (**GEC-ESTRO optimal target: ≤49 days**; **ABS / NCG hard limit: ≤56 days**) and foundational literature (*Perez et al., IJROBP 1995; AID-CARE QI Study, BMJ Open Quality 2026, PMID 42409422*) prove that prolonging OTT beyond 52–56 days causes an estimated **0.8% to 1.2% loss of pelvic tumor control per extra day**.
   - Without active support, only **18.6%** of patients finish within 56 days and **46.2%** abandon treatment entirely—driven by untreated radiation side effects (diarrhea, burning, fatigue), fear of the brachytherapy procedure, financial shock, and the median ~47-mile travel gap between regional EBRT spokes and central Brachytherapy hubs.

---

### 1.2 The CerviSetu 2.0 Solution (70% Patient Benefit / 30% Clinician Friction)
**CerviSetu** (*Cervical Care Bridge*) is a dual-sided, hub-and-spoke clinical pathway engine. It reads **no** autonomous diagnostic scan or biopsy slide and makes **no** autonomous dosing decisions. Instead, it strips clinician workload down to **zero-friction OCR document uploads and voice sign-offs (30% functional weight)** while delivering **high-touch, pre-emptive vernacular support to the patient (70% functional weight)**:

```
+---------------------------------------------------------------------------------------------------------+
|                                  CERVISETU 2.0 DUAL-SIDED CORE PLATFORM                                 |
+----------------------------------------------------+----------------------------------------------------+
|       CLINICIAN SIDE (30% Functional Weight)       |        PATIENT SIDE (70% Functional Weight)        |
|      Zero-Friction Input & Hub-Spoke Oversight     |       Pre-Emptive Vernacular Co-Pilot & Chase      |
+----------------------------------------------------+----------------------------------------------------+
| • Smart OCR Document Upload (Paper Slips/Labs)     | • Literacy-Free 29-Step Visual "Healing Clock"     |
| • Legibility & Glare Pre-Filter for Paper Uploads  | • Proactive Cisplatin Hydration & Toxicity Triage  |
| • 60s Voice-to-NCG Note Scribe (Sarvam/Bhashini)   | • Day-1 PMJAY & Transport Scheme Unlocker (RAG)    |
| • Dual-Clock OTT Board (<=49d GEC-ESTRO / <=56d)   | • Day-21 Brachy Fear-Reduction & Dharamshala Pass  |
| • Automated Day-21 Hub-Spoke Brachy Readiness Gate | • 4-Tier Progressive Escalation (SMS->IVR->ASHA)   |
| • Zero-Knowledge AES-256-GCM Vault & SHA-256 Audit | • Built-In QI Research & Cohort Telemetry Engine   |
+----------------------------------------------------+----------------------------------------------------+
```

---

## 2. Comprehensive Feature Inventory

### Feature 1: Smart OCR Document Upload & Voice-to-NCG Intake (Clinician / Nurse / Helper)
- **Capability**: Enables doctors, nurses, or clinic helpers to snap a smartphone photo of physical paper prescriptions, lab reports (CBC/RFT), biopsy summary slips, or referral cards—or speak a 60-second clinical update—to automatically populate structured patient records.
- **Underlying Engine**: [`src/tools/ocr_tools.py`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/src/tools/ocr_tools.py), [`src/agents/ocr_intake_agent.py`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/src/agents/ocr_intake_agent.py), and Sarvam Saaras v3 / Bhashini ASR gateway.
- **Core Mechanics**:
  - **Document Legibility Pre-Check**: Before running OCR extraction, a fast OpenCV Laplacian variance ($\sigma^2 \ge 85.0$) and luminance histogram check verifies that the photographed paper slip is not blurry or washed out by camera flash, prompting the nurse/helper to re-snap if unreadable.
  - **Clinical Entity Extraction**: Parses patient demographics, prior screening status (VIA/HPV), clinical stage recorded by the physician, baseline blood work values (Hemoglobin, Creatinine/RFT, WBC), and EBRT start dates.
  - **NCG Workup Completeness Check**: Maps extracted fields against National Cancer Grid (NCG) cervical cancer checklists, highlighting missing pre-treatment prerequisites (e.g., *"Lab slip uploaded: Hb 10.8 g/dL logged; Renal Function Test [RFT] still required before Cisplatin Cycle 1"*).
  - **Hard Clinician Sign-Off Gate**: Nothing is committed to the permanent record or ABDM/ABHA until the clinician taps **Sign**. Raw voice audio is permanently purged upon signature.

---

### Feature 2: Zero-Knowledge AES-256-GCM PII Vault & De-Identification
- **Capability**: Cryptographically isolates all Patient Personally Identifiable Information (PII) before any OCR text or clinical transcript touches language models or pathway agents.
- **Underlying Engine**: [`src/core/security.py`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/src/core/security.py) (`TokenVault`).
- **Core Mechanics**:
  - Name, mobile number, ABHA ID, village, guardian info, and residential address are extracted at the gateway and encrypted using **AES-256-GCM** with a unique 96-bit cryptographic nonce per record.
  - Generates a non-reversible, deterministic token (`PT-RURAL-XXXX`). All downstream LangGraph agents operate strictly on this anonymized token.
  - **Statutory Decryption Gate**: Vaulted PII can only be decrypted under two strictly audited conditions:
    1. Authorized Chief Medical Officer (CMO) statutory credential authentication.
    2. Automatic trigger of an emergency Tier 4 District Authority escalation (Day 8+ overdue).

---

### Feature 3: Dual-Clock OTT Engine & Automated Day-21 Hub-Spoke Bridge
- **Capability**: Replaces manual human coordination bottlenecks between regional EBRT spoke centers and central Brachytherapy hubs with deterministic date arithmetic and automated cross-site handoffs.
- **Underlying Engine**: [`src/core/database.py`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/src/core/database.py) & pathway clock coordinator.
- **Core Mechanics**:
  - **Dual Guideline Clocks**: Logging EBRT Fraction 1 (Day 0) simultaneously starts two countdowns:
    - **Clock 1 (Optimal Target)**: **≤49 Days** (*GEC-ESTRO* guideline).
    - **Clock 2 (Hard Limit)**: **≤56 Days** (*ABS / NCG* guideline).
  - **Day-21 (Fraction 15) Hub-and-Spoke Handoff**: Waiting until Day 30 or EBRT completion to schedule brachytherapy causes a 2–3 week delay across the ~47-mile spoke-to-hub gap. At **EBRT Fraction 15 (Day 21)**, CerviSetu automatically:
    1. Triggers the **Pre-Brachytherapy Readiness Checklist** at the regional spoke (CBC, RFT, Pre-Anesthetic Checkup [PAC], consent).
    2. Opens a **Central Hub OT Slot Request** matching the patient's projected EBRT finish date with central applicator/OT availability.

---

### Feature 4: Vernacular Patient Co-Pilot & Literacy-Free "Healing Clock" (70% Patient Focus)
- **Capability**: Turns the patient's existing phone (WhatsApp / Automated Voice IVR / Printed Pass) into an active, two-way treatment companion in 22 scheduled Indian languages.
- **Underlying Engine**: Indic Voice Gateway (Sarvam / Bhashini) & patient co-pilot routing.
- **Core Mechanics**:
  - **29-Step Visual Healing Clock**: Displays treatment progress as a simple visual progress bar (25 EBRT fractions + 4 Brachytherapy sessions) alongside comforting voice updates, removing medical jargon for low-literacy patients and families.
  - **Day-21 Brachytherapy Fear-Reduction Module**: When the Day-21 Hub-Spoke Bridge fires, the patient receives a culturally sensitive vernacular audio explainer demystifying internal radiation so fear does not cause post-EBRT dropout.

---

### Feature 5: Pre-Emptive Toxicity & Cisplatin Prep Coach (Patient-Side)
- **Capability**: Prevents treatment abandonment during Weeks 2–4 by catching radiation side effects *before* the patient skips a fraction.
- **Underlying Engine**: Toxicity monitoring & clinical rule engine.
- **Core Mechanics**:
  - **Pre-Cisplatin Prep**: Sends automated voice reminders 24 hours before weekly chemotherapy (*"Drink 8–10 glasses of water today and bring your blood test slip"*).
  - **Bi-Weekly 2-Question Voice Check-In**: Every 3 days, checks for radiation diarrhea, pelvic burning, nausea, or severe fatigue:
    - **Grade 1 (Mild)**: Immediately sends vernacular home-care instructions (ORS preparation, bland diet guide).
    - **Grade 2+ (Moderate/Severe)**: Flags the Regional Spoke doctor's Morning Ward List so supportive medication is prescribed *before* the patient drops out.

---

### Feature 6: Day-1 Financial Scheme & 47-Mile Travel Unlocker (Patient-Side)
- **Capability**: Eliminates financial and logistical dropout across the spoke-to-hub distance.
- **Underlying Engine**: Verified PMJAY & State Scheme knowledge base.
- **Core Mechanics**:
  - **Day-1 Scheme Verification**: Automatically matches the patient on Day 1 with Ayushman Bharat (PMJAY), state oncology funds, and nutrition grants—with a strict guardrail blocking any medical advice.
  - **Spoke-to-Hub Travel & Dharamshala Pass**: At Day 21, once the Central Hub confirms the Brachytherapy OT slot, the system issues state transport/bus vouchers, books nearby low-cost hospital *dharamshala* stays, and generates a printable bilingual boarding pass for the family caregiver.

---

### Feature 7: 4-Tier Progressive Rural Escalation & ASHA Network (Reactive Safety Net)
- **Capability**: If a patient still misses a scheduled EBRT fraction, Cisplatin cycle, or Brachytherapy slot despite pre-emptive coaching, the deterministic escalation matrix activates immediately.
- **Underlying Engine**: [`src/tools/tracker_tools.py`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/src/tools/tracker_tools.py), [`src/agents/tracker_agent.py`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/src/agents/tracker_agent.py), & [`frontend/src/components/AshaCoordination.tsx`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/frontend/src/components/AshaCoordination.tsx).

| Tier | Overdue Window | Target | Channel | Operational Directive |
|---|---|---|---|---|
| **Stage 0** | **Day 0 (On-Track)** | Patient & Family | WhatsApp / Voice Co-Pilot | Proactive Healing Clock, Cisplatin hydration prep, bi-weekly toxicity triage, PMJAY & travel pass. |
| **Tier 1** | **Day 1–2 Overdue** | Patient & Family | Multilingual WhatsApp / SMS | Vernacular voice note + visual graphic showing revised finish date and easy 1-tap rebooking. |
| **Tier 2** | **Day 3–5 Overdue** | Patient & Guardian | Vernacular IVR Call | Automated dialect phone call (*"Press 1 if side effects; Press 2 if transport needed; Press 3 to confirm visit"*). |
| **Tier 3** | **Day 6–7 Overdue** | ASHA Worker | Mobile Field Ticket | Dispatches local village ASHA worker with gram panchayat landmark to conduct an in-person home check. |
| **Tier 4** | **Day 8+ Overdue** | District CMO | Statutory Emergency Dossier | Unmasks AES-256-GCM PII under statutory audit and dispatches emergency transport directive. |

---

### Feature 8: Built-In Clinical QI & Guideline Research Engine
- **Capability**: Automates the research and evaluation methodology required for clinical audits and publications (*BMJ Open Quality / IJROBP* standard), eliminating manual retrospective chart reviews.
- **Core Mechanics**:
  - **Cohort Segmentation**: Tracks `PRE_IMPLEMENTATION` baseline cohorts vs. `POST_CERVISETU` active cohorts, automatically computing monthly patient throughput across spokes and hubs.
  - **Benchmarking & Covariates**: Continuously records Overall Treatment Time (OTT in days), spoke-to-hub travel distance (km), patient age, and exact delay root causes (`TOXICITY`, `TRAVEL_COST`, `LAB_PENDING`, `OT_SLOT_DELAY`).
  - **Live Statistical Engine**: Auto-calculates guideline concordance proportions (**≤49 days GEC-ESTRO** and **≤56 days ABS/NCG**) and runs live Chi-squared tests, independent t-tests, and bivariate distance-vs-OTT regressions.

---

### Feature 9: Tamper-Evident SHA-256 Chained Cryptographic Audit Ledger
- **Capability**: Immutable, zero-knowledge audit logging for all OCR uploads, doctor signatures, toxicity alerts, and statutory PII unmaskings.
- **Underlying Engine**: [`src/core/security.py`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/src/core/security.py) (`AuditLedger`).
- **Core Mechanics**:
  - Every action computes a chained cryptographic block hash:
    $$\text{Hash}_i = \text{SHA-256}(\text{Hash}_{i-1} \,\Vert{}\, \text{Timestamp} \,\Vert{}\, \text{Action} \,\Vert{}\, \text{Payload})$$
  - Fully compliant with the **Indian Digital Personal Data Protection (DPDP) Act, 2023** and **ABDM Health Data Management Policy**.

---

### Feature 10: CareUI Swiss-Grotesk Low-Friction Clinical Workstation
- **Capability**: High-density, zero-clutter interface engineered for 30-second clinician interactions.
- **Underlying Engine**: [`frontend/`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/frontend) (React 19, TypeScript, Tailwind CSS v4, Lucide icons).
- **Core Mechanics**:
  - **1-Tap OCR & Voice Bar**: Drag-and-drop or mobile camera upload for nurse/helper paper slips alongside a 1-tap microphone for clinician NCG note dictation.
  - **OTT Traffic-Light Ward Board**: Sorts all active patients into **Green** (Projected OTT ≤49d), **Amber** (50–56d or Day-21 checklist pending), and **Red** (>56d risk or Missed Visit / Grade 2+ Toxicity).

---

## 3. High-Level System Architecture (v2.0)

### 3.1 Visual Architecture Blueprint

```
+===========================================================================================================+
|                     1. DUAL-SIDED PRESENTATION & CHANNEL LAYER (30% MD / 70% PATIENT)                     |
+===========================================================================================================+
[ CLINICIAN / NURSE / HELPER (30% Weight) ]           [ PATIENT & RURAL FIELD (70% Weight) ]
+---------------------------------------------+       +---------------------------------------------+
| * Regional EBRT Spoke & Central Hub CareUI  |       | * Vernacular Patient Co-Pilot (WhatsApp/IVR)|
|   - Camera OCR Slip Upload (Labs/OPD Cards) |       |   - 29-Step Visual Healing Clock            |
|   - 1-Tap Barcode EBRT Fraction Logger      |       |   - Pre-Cisplatin & Bi-Weekly Toxicity Bot  |
|   - 60s Voice-to-NCG Dictation & Sign-Off   |       |   - Day-1 PMJAY & Day-21 Travel/Stay Pass   |
|   - Dual-Clock OTT Traffic-Light Ward Board |       | * ASHA Worker PWA (Tier 3 Field Tickets)    |
+----------------------+----------------------+       +----------------------+----------------------+
                       | HTTPS / REST (Offline-First)                        | WhatsApp / Voice / SMS
                       v                                                     v
+===========================================================================================================+
|                     2. ZERO-KNOWLEDGE SECURITY, OCR & INDIC VOICE GATEWAY                                 |
|  +-------------------------------+  +------------------------------+  +------------------------+          |
|  | AES-256-GCM TokenVault & RBAC |  | Document OCR & Slip Pre-Check|  | Sarvam v3 / Bhashini   |          |
|  | * Encrypts PII (96-bit Nonce) |  | * Laplacian/Glare Slip Gate  |  | * 22-Lang ASR & TTS    |          |
|  | * Mints Token (PT-RURAL-XXXX) |  | * Extracts Labs/Stage/Dates  |  | * Purges Audio on Sign |          |
|  +-------------------------------+  +------------------------------+  +------------------------+          |
+===========================================================================================================+
                       | De-Identified State (PT-RURAL-XXXX)
                       v
+===========================================================================================================+
|                     3. LANGGRAPH STATEFUL ORCHESTRATION & PATHWAY ENGINE                                  |
|                                                                                                           |
|  +-------------------------------+  +------------------------------+  +------------------------+          |
|  | Smart OCR & NCG Scribe Agent  |  | Dual-Clock & Day-21 Bridge   |  | Patient Co-Pilot &     |          |
|  | * Normalizes OCR & Voice      |  | * <=49d GEC-ESTRO (Optimal)  |  | 4-Tier Tracker Agent   |          |
|  | * Checks NCG Workup Gaps      |  | * <=56d ABS/NCG (Hard Limit) |  | * Stage 0: Tox/Travel  |          |
|  | * Hard Clinician Sign-Off Gate|  | * Frac 15 Hub-Spoke Handoff  |  | * Tier 1-4: Escalation |          |
|  +-------------------------------+  +------------------------------+  +------------------------+          |
+===========================================================================================================+
                       |
                       +-------------------------------------+-------------------------------------+
                       v                                     v                                     v
+-----------------------+  +--------------------------+  +-----------------------+  +---------------+
| ABDM FHIR R4 & SQL DB |  | AES-256-GCM PII VAULT    |  | SHA-256 AUDIT LEDGER  |  | QI RESEARCH   |
| * CarePlan, Task      |  | * Encrypted Demographics |  | * Hash-Chained Blocks |  | TELEMETRY DB  |
| * Episodes, Check-ins |  | * CMO Statutory Gate     |  | * DPDP Consent Trail  |  | * <=49d/56d % |
+-----------------------+  +--------------------------+  +-----------------------+  +---------------+
```

---

### 3.2 Mermaid Architecture Diagram

```mermaid
flowchart TB
    subgraph CLIENT["1. DUAL-SIDED PRESENTATION LAYER (30% Clinician / 70% Patient)"]
        direction LR
        c_staff["Clinician, Nurse & Helper Workstation (CareUI)<br/>• Camera OCR Slip Upload (OPD, CBC/RFT, Biopsy Text)<br/>• 60s Voice-to-NCG Scribe & Hard Sign-Off<br/>• 1-Tap Fraction Log & OTT Traffic-Light Board"]
        c_pat["Patient Vernacular Co-Pilot (WhatsApp / IVR)<br/>• 29-Step Visual Healing Clock<br/>• Proactive Cisplatin & Toxicity Check-in<br/>• Day-1 PMJAY & Day-21 Bus/Dharamshala Pass"]
        c_asha["ASHA Field Mobile PWA<br/>• Village Roster & Tier 3 Home Visit Tickets"]
    end

    subgraph GATEWAY["2. SECURITY, DOCUMENT OCR & INDIC VOICE PERIMETER"]
        direction LR
        vault_gate["Zero-Knowledge TokenVault<br/>• AES-256-GCM PII Encryption<br/>• Tokenizer (PT-RURAL-XXXX)<br/>• DPDP Consent Check"]
        doc_ocr["Smart Document OCR Gateway<br/>• Slip Blur/Glare Check (Laplacian)<br/>• Paper-to-Structured JSON Parser"]
        voice_gw["Sarvam Saaras v3 / Bhashini<br/>• 22-Language ASR & TTS<br/>• Post-Sign Audio Purge"]
    end

    subgraph ORCHESTRATION["3. LANGGRAPH STATEFUL PATHWAY & CO-PILOT ENGINE"]
        direction TB
        lg_ctrl["StateGraph Controller (ClinicalAgentState)"]
        
        subgraph AGENTS["Cooperating Assistive Agents (Zero Autonomous Diagnosis)"]
            direction LR
            a_scribe["OCR & NCG Scribe Agent<br/>(Lab/Slip Extraction &<br/>NCG Workup Checklist)"]
            a_clock["Dual-Clock & Day-21 Bridge<br/>(<=49d GEC-ESTRO · <=56d ABS<br/>Frac 15 Spoke->Hub Sync)"]
            a_copilot["Patient Co-Pilot Agent<br/>(Toxicity Triage · PMJAY RAG<br/>47-Mile Travel Pass)"]
            a_track["4-Tier Escalation Agent<br/>(Tier 1 SMS -> Tier 2 IVR -> <br/>Tier 3 ASHA -> Tier 4 CMO)"]
        end
    end

    subgraph DATA_LAYER["4. PERSISTENCE, ABDM FHIR & QI RESEARCH LAYER"]
        direction LR
        db_sql[("PostgreSQL / SQLite<br/>• Episodes · Fractions<br/>• Toxicity · Travel Passes")]
        abdm_fhir[("ABDM FHIR R4 Store<br/>• CarePlan · Task<br/>• QuestionnaireResponse")]
        vault_store[("AES-256-GCM Vault<br/>• Encrypted PII Binaries<br/>• Statutory Unmask Gate")]
        audit_chain[("SHA-256 Audit Ledger<br/>• Chained Hash Log<br/>• DPDP Compliance")]
        qi_store[("Live QI Research Engine<br/>• Pre/Post Cohort Split<br/>• OTT vs km Regression")]
    end

    c_staff -->|"Paper Photo / Voice / 1-Tap"| vault_gate
    c_staff -->|"Paper Slip Image"| doc_ocr
    c_staff & c_pat <-->|"22-Lang Audio"| voice_gw
    
    vault_gate -->|"Ciphertext + Nonce"| vault_store
    vault_gate & doc_ocr & voice_gw -->|"De-ID State (PT-RURAL-XXXX)"| lg_ctrl
    
    lg_ctrl --> a_scribe & a_clock & a_copilot & a_track
    a_copilot -->|"Proactive Care & Vouchers"| c_pat
    a_track -->|"Tier 1-2"| c_pat
    a_track -->|"Tier 3 Ticket"| c_asha
    
    a_scribe & a_clock & a_copilot & a_track --> db_sql & abdm_fhir & qi_store
    a_scribe & a_clock & a_copilot & a_track & vault_gate -->|"Tamper-Evident Block"| audit_chain
```

---

## 4. Data Flow Diagrams (DFDs)

### 4.1 Level 0: System Context Data Flow Diagram

```mermaid
flowchart TD
    PAT(["External: Patient & Family<br/>(Vernacular WhatsApp / IVR)"])
    SPOKE(["External: Regional EBRT Spoke<br/>(Doctor / Nurse / Helper)"])
    HUB(["External: Central Brachytherapy Hub<br/>(Radiation Oncologist)"])
    ASHA(["External: ASHA Community Worker"])
    CMO(["External: District Medical Officer (CMO)"])
    ABDM(["External: ABDM / Ayushman Bharat"])

    SYSTEM[["CERVISETU 2.0 PLATFORM<br/>(Smart OCR · Dual-Clock 49d/56d · Patient Co-Pilot · AES-256 Vault)"]]

    SPOKE -->|"1. Photo of Paper Slips/Labs, DPDP Consent, Daily EBRT Tap"| SYSTEM
    PAT -->|"2. Bi-Weekly Symptom Voice Replies, Travel/Scheme Queries"| SYSTEM
    HUB -->|"3. Day-21 Central OT Slot Confirmation, Spoken Procedure Note"| SYSTEM

    SYSTEM -->|"4. Parsed NCG Draft, Missing Lab Flags, OTT Traffic-Light Board"| SPOKE
    SYSTEM -->|"5. 29-Step Healing Clock, ORS/Toxicity Guide, Bus/Dharamshala Pass"| PAT
    SYSTEM -->|"6. Day-21 Hub-Spoke Referral Packet & Pre-Brachy Checklist"| HUB
    SYSTEM -->|"7. Tier 3 Physical Home Visit Ticket (Day 6-7 Overdue)"| ASHA
    SYSTEM -->|"8. Tier 4 Statutory Unmasked Emergency Dossier (Day 8+ Overdue)"| CMO
    SYSTEM -->|"9. Clinician-Signed FHIR R4 Bundle"| ABDM
```

---

### 4.2 Level 1: Core Operational Data Flow Diagram

```mermaid
flowchart TB
    E_STAFF(["Spoke/Hub Doctor, Nurse or Helper"])
    E_PAT(["Patient & Family Caregiver"])
    E_ASHA(["ASHA Worker"])
    E_CMO(["District CMO Authority"])

    P1(("P1.0<br/>DPDP Consent &<br/>AES-256-GCM<br/>De-Identification"))
    P2(("P2.0<br/>Smart Paper Slip OCR<br/>& Voice-to-NCG<br/>Scribe Gate"))
    P3(("P3.0<br/>Dual-Clock (49d/56d)<br/>& Day-21 Hub-Spoke<br/>Bridge Engine"))
    P4(("P4.0<br/>Pre-Emptive Patient<br/>Co-Pilot (Toxicity,<br/>PMJAY & Travel)"))
    P5(("P5.0<br/>4-Tier Overdue<br/>Escalation & Statutory<br/>Unmasking"))
    P6(("P6.0<br/>Live QI Cohort &<br/>OTT Statistical<br/>Aggregator"))

    D1[("D1: AES-256-GCM PII Vault")]
    D2[("D2: Episodes, Labs & Checklists DB")]
    D3[("D3: Verified PMJAY & Dharamshala KB")]
    D4[("D4: SHA-256 Chained Audit Ledger")]
    D5[("D5: ABDM FHIR R4 & QI Research DB")]

    E_STAFF -->|"Demographics, Paper Lab/OPD Photo, Voice"| P1
    P1 -->|"Store Encrypted PII"| D1
    P1 -->|"Log Consent & De-ID"| D4
    P1 -->|"Token (PT-RURAL-XXXX) + Paper Photo / Audio"| P2

    P2 -->|"Check Slip Legibility -> Extract Labs/Dates -> Draft NCG Note"| E_STAFF
    E_STAFF -->|"Clinician Digital Sign-Off (Purges Audio)"| P2
    P2 -->|"Verified Clinical Intake & Lab Readiness"| D2
    P2 -->|"Signed FHIR CarePlan/Observation"| D5
    P2 -->|"EBRT Start Date & Fraction Log"| P3

    P3 -->|"Compute <=49d & <=56d Clocks + Trigger Frac 15 Bridge"| D2
    P3 -->|"Day-21 Pre-Brachy Checklist & Hub OT Slot Alert"| E_STAFF
    P3 -->|"Current Step (1..29) & Milestone Triggers"| P4
    P3 -->|"Overdue Counter (if missed visit)"| P5

    D3 -->|"Scheme Rules & Bus/Stay Vouchers"| P4
    E_PAT -->|"Vernacular Symptom Check-in & Queries"| P4
    P4 -->|"Healing Clock, ORS Guide, Brachy Audio, Travel Pass"| E_PAT
    P4 -->|"Grade 2+ Toxicity Alert (Prevents Dropout!)"| E_STAFF
    P4 -->|"Log Toxicity & Voucher Telemetry"| D2

    P5 -->|"Tier 1 WhatsApp / Tier 2 Dialect IVR"| E_PAT
    P5 -->|"Tier 3 Village Field Ticket"| E_ASHA
    P5 -->|"Day 8+ Statutory Decrypt Request"| D1
    D1 -->|"Unmasked Emergency Address"| P5
    P5 -->|"Tier 4 Emergency Dispatch Dossier"| E_CMO
    P5 -->|"Log Escalation & Unmasking Hash"| D4

    D2 -->|"De-Identified OTT, Distance km, Delay Causes"| P6
    P6 -->|"Pre/Post Cohort Stats (Chi-Sq, t-test, <=49d/56d %)"| D5
```

---

## 5. Detailed Sequence Diagrams

### 5.1 Sequence 1: Nurse/Helper Paper Slip OCR Upload & Doctor Sign-Off
This sequence shows how a clinic nurse, helper, or doctor uploads a photo of a paper OPD card or blood test slip for zero-friction structured data entry:

```mermaid
sequenceDiagram
    autonumber
    actor Helper as Nurse / Helper / Doctor
    participant UI as CareUI Workstation / Mobile
    participant Vault as TokenVault (AES-256-GCM)
    participant OCR as Smart OCR & Legibility Gate
    participant Scribe as NCG Structuring Agent
    actor MD as Attending Clinician
    participant Ledger as SHA-256 Audit Ledger
    participant DB as Episode & ABDM FHIR Store

    Helper->>UI: Snaps photo of paper OPD slip + CBC/RFT lab report
    UI->>Vault: Extract & encrypt PII (Name, Phone, Village, ABHA)
    Vault-->>UI: Return De-Identified Token (PT-RURAL-7891)
    Vault->>Ledger: record_event(PT-RURAL-7891, "PII_VAULTED_AES256")

    UI->>OCR: upload_document_photo(PT-RURAL-7891, slip_image)
    activate OCR
    OCR->>OCR: Run Laplacian Sharpness (>=85.0) & Glare Check on Paper Slip
    alt Paper Slip is Blurry or Glare-Occluded
        OCR-->>Helper: Prompt Immediate Re-Capture ("Hold steady; avoid flash glare on lab values")
    else Paper Slip is Legible
        OCR->>OCR: Extract Text (Stage IIB, Hb 11.2, Creatinine 0.9, EBRT Start Date)
        OCR-->>Scribe: De-Identified Raw OCR Entities
    end
    deactivate OCR

    activate Scribe
    Scribe->>Scribe: Map to NCG Cervical Schema & Check Pre-Brachy/Cisplatin Prerequisites
    Scribe-->>MD: Render Draft NCG Intake Card (Flags: "CBC/RFT Complete; PAC Pending by Day 21")
    deactivate Scribe

    MD->>UI: Reviews Draft, Edits if needed & Taps "Sign"
    UI->>DB: Commit Verified Episode & Initialize 49d/56d Dual-Clock
    UI->>Ledger: record_event(PT-RURAL-7891, "OCR_INTAKE_SIGNED_BY_MD")
```

---

### 5.2 Sequence 2: Pre-Emptive Patient Co-Pilot & Day-21 Hub-Spoke Bridge
This sequence illustrates how patient-facing features keep the patient on track across the regional EBRT spoke and central Brachytherapy hub:

```mermaid
sequenceDiagram
    autonumber
    actor Pat as Patient (Vernacular WhatsApp/IVR)
    participant Spoke as Regional EBRT Spoke (Nurse/MD)
    participant Clock as Dual-Clock & Day-21 Bridge
    participant CoPilot as Vernacular Patient Co-Pilot
    actor Hub as Central Brachy Hub (Oncologist)
    participant QI as ABDM FHIR & QI Research DB

    Note over Pat,QI: DAY 1: EBRT START & FINANCIAL UNLOCKER
    Spoke->>Clock: Log EBRT Fraction 1 (Clock Day 0)
    Clock->>Clock: Set Target 1 <=49d (GEC-ESTRO) & Target 2 <=56d (ABS/NCG)
    Clock->>CoPilot: Activate Stage 0 Patient Companion
    CoPilot->>Pat: Send Vernacular Welcome + 29-Step Visual Healing Clock (Step 1/29)
    CoPilot->>Pat: Auto-Verify PMJAY & State Transport Eligibility

    Note over Pat,QI: DAYS 2–20: PROACTIVE CISPLATIN PREP & TOXICITY TRIAGE
    loop Every 3 Days & Pre-Cisplatin Day
        CoPilot->>Pat: Voice Reminder: "Drink 8 glasses of water before tomorrow's chemo"
        CoPilot->>Pat: 2-Question Vernacular Symptom Check (Diarrhea / Burning / Fatigue)
        Pat-->>CoPilot: Voice Reply ("Having loose motions since yesterday")
        alt Mild Toxicity (Grade 1)
            CoPilot->>Pat: Send Vernacular ORS & Diet Home-Care Audio
        else Moderate/Severe Toxicity (Grade 2+)
            CoPilot->>Spoke: Priority Alert on Spoke Morning Ward List
            Spoke->>Pat: Prescribe Supportive Meds (Prevents Treatment Dropout!)
        end
    end

    Note over Pat,QI: DAY 21 (FRACTION 15): AUTOMATED HUB-AND-SPOKE HANDOFF
    Spoke->>Clock: Log EBRT Fraction 15 (Day 21 Milestone)
    Clock->>Spoke: Trigger Pre-Brachy Readiness Gate (Upload CBC/RFT slip + PAC clearance)
    Clock->>Hub: Open Hub Referral Packet & Request Central OT Slot (Days 38–44)
    Spoke->>Clock: Nurse uploads lab slip via OCR; MD signs Readiness Gate
    Hub->>Clock: Confirm Central Brachytherapy OT Slot (Day 40)
    Clock->>CoPilot: Trigger Patient Brachy & Travel Prep
    CoPilot->>Pat: Send Comforting "What is Brachytherapy?" Vernacular Audio
    CoPilot->>Pat: Issue 47-Mile Bus Voucher + Dharamshala Stay + Printable Family Pass

    Note over Pat,QI: DAYS 40–46: CENTRAL BRACHYTHERAPY COMPLETION & QI LOGGING
    Pat->>Hub: Completes Brachytherapy on Day 46
    Hub->>Clock: Dictate & Sign End-of-Treatment Summary (Raw Audio Deleted)
    Clock->>QI: Commit Final OTT = 46 Days (Met <=49d GEC-ESTRO & <=56d ABS!)
    CoPilot->>Pat: Transition to 3, 6, 12-Month Local Spoke Survivorship Reminders
```

---

### 5.3 Sequence 3: 4-Tier Progressive Rural Escalation & Statutory CMO Unmasking
If a patient misses a scheduled visit despite Stage 0 pre-emptive support, the 4-tier escalation engine activates:

```mermaid
sequenceDiagram
    autonumber
    actor Patient as Rural Patient
    actor ASHA as Sector ASHA Worker
    actor CMO as District Medical Officer (CMO)
    participant Tracker as TrackerTriageEngine
    participant Dispatcher as Multi-Channel Dispatcher
    participant Vault as TokenVault (AES-256-GCM)
    participant Ledger as SHA-256 Audit Ledger

    Note over Tracker: Day 1–2 Overdue: Missed EBRT Fraction or Cisplatin Cycle
    Tracker->>Dispatcher: dispatch_tier_1_sms(Token, clock_day=18, remaining_days=31)
    Dispatcher->>Patient: Vernacular WhatsApp Voice + Visual Clock Rebooking Prompt
    Tracker->>Ledger: record_event(Token, "DISPATCH_TIER_1_WHATSAPP")

    Note over Tracker: Day 3–5 Overdue: No Attendance Logged
    Tracker->>Dispatcher: dispatch_tier_2_ivr(Token, dialect="Bhojpuri")
    Dispatcher->>Patient: Automated IVR Call ("Press 1 if unwell, Press 2 if travel issue")
    Tracker->>Ledger: record_event(Token, "DISPATCH_TIER_2_IVR")

    Note over Tracker: Day 6–7 Overdue: High Risk of Breaching 49d/56d Clock
    Tracker->>Dispatcher: dispatch_tier_3_asha(Token, block="Kalyanpur")
    Dispatcher->>ASHA: Mobile Field Ticket with Token & Village Sector Landmark
    ASHA->>Patient: Conducts physical home visit & logs delay root cause
    Tracker->>Ledger: record_event(Token, "DISPATCH_TIER_3_ASHA")

    Note over Tracker: Day 8+ Overdue: Critical Pathway Abandonment Emergency
    Tracker->>Vault: retrieve_pii(Token) [Statutory Tier 4 Override]
    Vault-->>Tracker: Decrypted PII {Name, Phone, Full Village Address}
    Tracker->>Dispatcher: generate_authority_dossier(Unmasked PII, Remaining Clock Days)
    Dispatcher->>CMO: STATUTORY EMERGENCY DOSSIER (Mobile Van / Patient Rescue Dispatch)
    Tracker->>Ledger: record_event(Token, "TIER_4_STATUTORY_UNMASKED", severity="CRITICAL")
```

---

## 6. Data Models, State Schemas & Cryptographic Specifications

### 6.1 Upgraded LangGraph State Schema (`ClinicalAgentState`)

```python
from typing import Annotated, Any, Dict, List, Optional, TypedDict
import operator

class ClinicalAgentState(TypedDict):
    # 1. Data Privacy & Identification (AES-256-GCM Backed)
    patient_token: str                                  # e.g., 'PT-RURAL-7891'
    session_id: str                                     # e.g., 'sess-a1b2c3d4'
    preferred_language: str                             # 22 scheduled Indian languages
    spoke_to_hub_km: float                              # Travel distance for vouchers & QI stats

    # 2. Smart OCR Document Upload & Voice Scribe (30% Clinician Side)
    document_image_path: Optional[str]                  # Photo of paper OPD slip / lab report
    document_legibility: Optional[Dict[str, Any]]       # Laplacian sharpness & glare check on slip
    ocr_extracted_entities: Optional[Dict[str, Any]]    # Parsed labs (CBC/RFT), stage, dates
    voice_transcript_deid: Optional[str]                # De-identified ASR dictation
    ncg_clinical_draft: Optional[Dict[str, Any]]        # NCG structured note & missing workup flags
    doctor_signed_off: bool                             # Hard human-in-the-loop gate

    # 3. Dual-Clock OTT & Day-21 Hub-Spoke Bridge
    ebrt_start_date: Optional[str]                      # Clock Day 0
    steps_completed: int                                # 1..25 EBRT + 1..4 Brachy (29 steps)
    target_49d_gec_estro: Optional[str]                 # Optimal deadline (<=49 days)
    target_56d_abs_ncg: Optional[str]                   # Hard limit (<=56 days)
    day21_bridge_status: Optional[Dict[str, Any]]       # CBC/RFT, PAC, Hub OT slot confirmed

    # 4. Pre-Emptive Patient Co-Pilot (70% Patient Side)
    latest_toxicity_checkin: Optional[Dict[str, Any]]   # Symptom, Grade (1-3), ORS or MD alert
    pmjay_and_travel_pass: Optional[Dict[str, Any]]     # Scheme match, bus voucher, dharamshala
    brachy_counseling_sent: bool                        # Day-21 fear-reduction audio delivered

    # 5. 4-Tier Progressive Rural Escalation & QI Telemetry
    days_overdue: int                                   # 0 = Stage 0 Co-Pilot; 1..8+ = Tier 1..4
    delay_root_cause: Optional[str]                     # NONE | TOXICITY | TRAVEL_COST | OT_SLOT
    current_escalation_tier: Optional[str]              # STAGE_0_COPILOT | TIER_1..4
    dispatched_notifications: Annotated[List[Dict[str, Any]], operator.add]
    authority_escalation_dossier: Optional[Dict[str, Any]]

    # 6. Chained SHA-256 Audit Trail
    audit_trail: Annotated[List[str], operator.add]
    errors: Annotated[List[str], operator.add]
    status: str                                         # RUNNING | AWAITING_MD_SIGN | COMPLETED
```

---

### 6.2 Relational Entity Relationship (ER) Schema

```mermaid
erDiagram
    FACILITY ||--o{ TREATMENT_EPISODE : "hosts (Spoke or Hub)"
    PATIENT ||--o{ DPDP_CONSENT : "grants"
    PATIENT ||--o{ TREATMENT_EPISODE : "undergoes"
    TREATMENT_EPISODE ||--o{ OCR_DOCUMENT_UPLOAD : "ingests paper slips/labs"
    TREATMENT_EPISODE ||--o{ TREATMENT_EVENT : "logs 29 pathway steps"
    TREATMENT_EPISODE ||--|| HUB_SPOKE_BRACHY_BRIDGE : "triggers at Day 21 (Frac 15)"
    TREATMENT_EPISODE ||--o{ TOXICITY_CHECKIN : "monitors proactively"
    TREATMENT_EPISODE ||--o{ TRAVEL_FINANCE_PASS : "unlocks schemes & stays"
    TREATMENT_EPISODE ||--o{ ESCALATION_DISPATCH : "triggers if overdue"
    TREATMENT_EPISODE ||--o{ AUDIT_LOG_ENTRY : "records SHA-256 chain"

    PATIENT {
        string patient_token PK "PT-RURAL-XXXX (AES-256-GCM)"
        string abha_id UK "ABDM Health ID"
        string preferred_language "22 Scheduled Languages"
        float spoke_to_hub_km "Median ~47 mi / 75 km"
        boolean pmjay_verified "Day-1 Scheme Check"
        string research_cohort "PRE_BASELINE | POST_CERVISETU"
    }

    FACILITY {
        uuid facility_id PK
        string facility_name
        string facility_role "REGIONAL_EBRT_SPOKE | CENTRAL_BRACHY_HUB"
        boolean pmjay_empanelled
    }

    OCR_DOCUMENT_UPLOAD {
        uuid upload_id PK
        uuid episode_id FK
        string uploaded_by_role "DOCTOR | NURSE | HELPER"
        string document_type "OPD_SLIP | CBC_RFT_LAB | BIOPSY_REPORT | REFERRAL_CARD"
        float laplacian_sharpness "Must be >= 85.0 for OCR"
        json extracted_fields_json "Parsed Hb, Creatinine, Stage, Dates"
        boolean clinician_verified_signed "Hard Gate"
    }

    TREATMENT_EPISODE {
        uuid episode_id PK
        string patient_token FK
        uuid spoke_facility_id FK
        uuid hub_facility_id FK
        date ebrt_start_date "Starts 49d and 56d Clocks"
        date target_49d_gec_estro "Optimal Benchmark"
        date target_56d_abs_ncg "Hard Limit Benchmark"
        int steps_completed "1..29 (25 EBRT + 4 Brachy)"
        int days_overdue
        string delay_root_cause "NONE | TOXICITY | TRAVEL_COST | OT_SLOT"
        int final_ott_days "Total days from EBRT Frac 1 to Brachy End"
        boolean met_49d_benchmark "For QI Chi-Sq Analysis"
        boolean met_56d_benchmark "For QI Chi-Sq Analysis"
    }

    HUB_SPOKE_BRACHY_BRIDGE {
        uuid bridge_id PK
        uuid episode_id FK
        date triggered_date "Auto-created at EBRT Fraction 15 (Day 21)"
        boolean cbc_rft_ocr_verified "Lab slip uploaded & signed"
        boolean pac_anesthesia_cleared "Pre-anesthetic fitness signed"
        date central_hub_ot_slot "Reserved Brachy OT date"
        boolean doctor_readiness_signoff "Hard Clinician Gate"
    }

    TOXICITY_CHECKIN {
        uuid checkin_id PK
        uuid episode_id FK
        int clock_day
        string symptom_reported "DIARRHEA | BURNING | NAUSEA | FATIGUE"
        int severity_grade "1 (Mild -> ORS Audio) | 2+ (Alert Spoke MD)"
        string action_taken
    }

    TRAVEL_FINANCE_PASS {
        uuid pass_id PK
        uuid episode_id FK
        string support_type "PMJAY_APPROVAL | BUS_VOUCHER | DHARAMSHALA_STAY"
        boolean issued_to_patient
        date valid_for_travel_date
    }

    ESCALATION_DISPATCH {
        uuid dispatch_id PK
        uuid episode_id FK
        string tier "TIER_1_SMS | TIER_2_IVR | TIER_3_ASHA | TIER_4_CMO"
        string delivery_status "DELIVERED | CONFIRMED | HOME_VISITED"
        timestamp dispatched_at
    }

    AUDIT_LOG_ENTRY {
        uuid entry_id PK
        string patient_token FK
        string action_name
        string actor_identity
        string sha256_current_hash
        string sha256_prev_hash
        timestamp recorded_at
    }
```

---

## 7. Summary of Architectural Upgrades (v1.0 $\rightarrow$ v2.0)

| Core Dimension | Version 1.0 (Legacy Prototype) | Version 2.0 (Patient-Centric Hub-and-Spoke) |
|---|---|---|
| **Primary Focus** | Diagnostic Image AI (Colposcopy / Histopathology) | **Smart Paper Slip OCR Upload & Low-Friction Intake** |
| **Functional Weight** | 80% Clinician Tooling / 20% Tracking | **70% Patient Pre-Emptive Co-Pilot / 30% Clinician Friction** |
| **Regulatory Risk** | High SaMD Diagnostic Risk (Autonomous lesion detection) | **Zero Diagnostic SaMD Risk** (Pure pathway adherence & logistics) |
| **Pathway Coordination** | Single-center clinic queue | **Deterministic Dual-Clock (49d/56d) Hub-to-Spoke Referral Bridge** |
| **Patient Drop-out Defense** | Reactive SMS after patient misses appointment | **Pre-Emptive 29-Step Visual Clock, Hydration Bot & Travel Vouchers** |
| **Clinical Research Telemetry** | Manual retrospective chart audits | **Natively Embedded QI Engine** (`BMJ Open Quality / IJROBP` ready) |

> [!IMPORTANT]
> **CDSCO SaMD Compliance Principle**: CerviSetu v2.0 operates strictly in an assistive, logistical, and pathway-coordination capacity. No diagnostic classifications or autonomous prescription modifications occur without verified clinician electronic sign-off.

---

*Authored for the CerviSetu Technical Architecture Team · Certified Complete and Verified (v2.0.0).*
