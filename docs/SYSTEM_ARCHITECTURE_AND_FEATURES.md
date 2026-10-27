# CerviSetu: System Architecture, Data Flow & Feature Specification

> **Platform**: CerviSetu Clinical AI & Rural Oncology Patient Tracking System  
> **Document Type**: Master Technical Architecture & Functional Specification  
> **Target Audience**: Solution Architects, Clinical Engineers, Security Auditors, and Technical Evaluators  
> **Version**: 1.0.0 (Production Architecture)  
> **Status**: Active / Field-Tested

---

## 1. Executive Summary & Problem Domain

### 1.1 The Rural Oncology Crisis in India
In rural and semi-urban Indian healthcare ecosystems, cervical and oral carcinomas account for a disproportionately high burden of preventable cancer mortality. Patients face two systemic failure points:

1. **Diagnostic Bottlenecks at Primary/Spoke Centers**:
   - Primary Health Centres (PHCs) and Community Health Centres (CHCs) lack on-site oncologists and histopathologists.
   - Prescriptions, cytological reports, and tissue biopsy slides sent for tele-consultation are frequently impaired by handwriting illegibility, motion blur, poor illumination, or non-medical artifact capture.
   - Misdiagnosis or non-standardized staging delays appropriate tertiary referrals by an average of 4 to 8 weeks.

2. **Lost-to-Follow-Up (LTFU) & Overall Treatment Time (OTT) Breaches**:
   - Cervical cancer curative radiation therapy mandates concurrent chemo-radiation (EBRT) followed by high-dose-rate (HDR) brachytherapy.
   - **The 49/56-Day Clinical Deadline**: Clinical guidelines (*GEC-ESTRO* optimal benchmark: **≤49 days**; *American Brachytherapy Society / National Cancer Grid*: absolute limit **≤56 days**) demonstrate that every 1% prolongation beyond 56 days causes an estimated **0.7% to 1.0% drop in local tumor control and overall survival**.
   - Rural patients drop out between EBRT completion at local regional spokes and brachytherapy at central tertiary hubs due to financial distress, travel logistics across district lines, and lack of family support.
   - When patients stop attending, primary health systems lack an automated, progressive mechanism to locate them before cancer reaches an untreatable stage.

---

### 1.2 The CerviSetu Solution
**CerviSetu** (*Cervical & Oncology Care Bridge*) is an agentic, zero-knowledge clinical diagnostic and rural patient tracking platform built to bridge primary health centers and tertiary oncology hubs:

```
+---------------------------------------------------------------------------------------------------------+
|                                         CERVISETU CORE PLATFORM                                         |
+----------------------------------------------------+----------------------------------------------------+
|               PILLAR 1: DIAGNOSTIC AI              |             PILLAR 2: RURAL SURVEILLANCE           |
|            Multi-Agent Clinical Synthesis          |         Progressive Escalation & OTT Engine        |
+----------------------------------------------------+----------------------------------------------------+
| • Zero-Knowledge AES-256-GCM PII Vault             | • Multi-Tier Overdue Non-Responder Matrix          |
| • Doctor Prescription OCR & Entity Extraction      | • Tier 1: Multilingual WhatsApp / SMS Audio-Visual |
| • Algorithmic Image Quality & Blur Pre-Filter      | • Tier 2: Automated Regional Vernacular IVR Calls  |
| • LangGraph Stateful Diagnostic Synthesis          | • Tier 3: Field ASHA Worker Home Visit Dispatch    |
| • NCG / TNM Staging & Workup Recommendations       | • Tier 4: District Health Authority Directives     |
| • Monospace Cryptographic SHA-256 Audit Trail      | • Dual-Clock (49d/56d) Hub-Spoke Brachy Bridge     |
+----------------------------------------------------+----------------------------------------------------+
```

---

## 2. Comprehensive Feature Inventory

CerviSetu is architected around 10 functional feature modules spanning frontend clinical operations, backend agentic execution, and cryptographic security:

### Feature 1: Multi-Agent Clinical Intake & Prescription OCR
- **Capability**: Ingests physical paper doctor slips, clinical notes, discharge summaries, and histopathology test reports via text input or file upload.
- **Underlying Engine**: [`src/tools/ocr_tools.py`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/src/tools/ocr_tools.py) & [`src/agents/ocr_intake_agent.py`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/src/agents/ocr_intake_agent.py).
- **Core Mechanics**:
  - Automatically identifies patient metadata, clinical complaints, duration, lesion morphology, lymph node involvement, and prescribed investigations.
  - Normalizes clinical entities into standardized oncology nomenclature (Oral Squamous Cell Carcinoma, Cervical VIA+, Infiltrating Ductal Carcinoma).
  - Flags high-risk "B-symptoms" (constitutional weight loss, dysphagia, post-coital bleeding, indurated ulcers).
- **Output**: Produces a standardized, de-identified `ClinicalIntake` object with severity scoring ($0.0$ to $1.0$).

---

### Feature 2: Zero-Knowledge AES-256-GCM PII Vault & De-Identification
- **Capability**: Cryptographically isolates all Patient Personally Identifiable Information (PII) before any data is processed by language models or diagnostic agents.
- **Underlying Engine**: [`src/core/security.py`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/src/core/security.py) (`TokenVault`).
- **Core Mechanics**:
  - Name, mobile number, village, guardian info, and residential address are extracted and encrypted using **AES-256-GCM** with a unique 96-bit cryptographic nonce per record.
  - Generates a non-reversible, deterministic token: `PT-RURAL-XXXX` or `PT-ANON-XXXX`.
  - The reasoning agents in the LangGraph workflow operate strictly on the anonymized token and clinical features.
  - **Statutory Decryption Gate**: PII can only be decrypted under two strictly audited conditions:
    1. Authorized Chief Medical Officer (CMO) statutory credential authentication.
    2. Automatic trigger of an emergency Tier 4 District Authority escalation.

---

### Feature 3: Medical Image Quality & Anomaly Triage Pre-Filter
- **Capability**: Algorithmic gatekeeper that verifies medical scans and histopathology slide imagery before feeding them to downstream AI models, preventing false-negative diagnostic hallucinations.
- **Underlying Engine**: [`src/tools/image_tools.py`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/src/tools/image_tools.py) & [`src/agents/image_triage_agent.py`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/src/agents/image_triage_agent.py).
- **Three Core Analytical Gates**:
  1. **Laplacian Spatial Variance (Sharpness)**: Convolves image with a $3 \times 3$ Laplacian kernel to compute second-order derivatives. If variance $\sigma^2 < 85.0$, the scan is rejected for severe motion/defocus blur.
  2. **Fast Fourier Transform (FFT) Spectral Energy Ratio**: Transforms image into the 2D frequency domain, masking DC components to compute high-frequency tissue texture ratio. Attenuation below threshold flags artificial smoothing or compression artifacts.
  3. **RMS Dynamic Contrast & Exposure Histogram**: Analyzes luminance distribution. Images with $>75\%$ pixel intensity clumped near zero (underexposed) or near 255 (overexposed glare) are rejected.
- **Clinician Guidance**: Emits structured corrective advice for frontline workers (e.g., *"Hold phone elbow on table; angle LED light at 45 degrees to lesion"*).
- **Dynamic Routing**: If the image fails triage, LangGraph conditionally bypasses diagnostic reasoning directly to tracking and alerts the clinician.

---

### Feature 4: Multi-Agent Diagnostic Synthesis & Differential Workup
- **Capability**: Generates structured, evidence-based preliminary differential diagnoses, clinical staging, and workup recommendations for clinician review.
- **Underlying Engine**: [`src/agents/diagnostic_agent.py`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/src/agents/diagnostic_agent.py) within the LangGraph StateGraph ([`src/graph/workflow.py`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/src/graph/workflow.py)).
- **Core Mechanics**:
  - Maps presenting complaints, biopsy status, and duration against National Cancer Grid (NCG) and WHO clinical pathways.
  - Calculates estimated TNM Stage (Stage I Early to Stage IV Metastatic).
  - Renders confidence levels (`LOW`, `MODERATE`, `HIGH`) and flags critical emergencies (`ROUTINE`, `PRIORITY`, `CRITICAL_EMERGENCY`).
  - Strict human-in-the-loop: AI recommendations are marked as drafts requiring physician electronic sign-off.

---

### Feature 5: 4-Tier Progressive Rural Escalation Engine
- **Capability**: Algorithmic tracking engine that enforces patient follow-up between primary rural clinics and district cancer hospitals, automatically escalating non-responders as days overdue increase.
- **Underlying Engine**: [`src/tools/tracker_tools.py`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/src/tools/tracker_tools.py) & [`src/agents/tracker_agent.py`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/src/agents/tracker_agent.py).
- **Escalation Hierarchy**:

| Tier | Overdue Window | Primary Target | Dispatch Channel | Content & Operational Directive |
|---|---|---|---|---|
| **Tier 0** | Day 0 | Patient | Routine SMS | Automated appointment reminder & clinic directions. |
| **Tier 1** | Day 1–2 | Patient & Family | Multilingual WhatsApp / SMS | Culturally sensitive voice audio + visual graphic explaining the importance of biopsy review. |
| **Tier 2** | Day 3–5 | Patient & Guardian | Vernacular IVR Call | Automated phone call in patient's preferred dialect (Hindi, Bhojpuri, Bengali, etc.) requiring dial-pad confirmation (`Press 1 to confirm travel`). |
| **Tier 3** | Day 6–7 | ASHA Worker | Mobile Field Ticket | Dispatches local community health worker to patient's village with GPS coordinates for physical home visitation. |
| **Tier 4** | Day 8+ | District Medical Officer (CMO) | Statutory Emergency Dossier | Unmasks vaulted PII (name, village, landmark) and generates a formal statutory directive for emergency ambulance/mobile van dispatch. |

---

### Feature 6: ASHA Community Health Worker Coordination Network
- **Capability**: Real-time roster and task allocation for Accredited Social Health Activists (ASHAs) and Auxiliary Nurse Midwives (ANMs).
- **Underlying Engine**: [`frontend/src/components/AshaCoordination.tsx`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/frontend/src/components/AshaCoordination.tsx) and backend assignment engine.
- **Core Mechanics**:
  - Maps patients to their local gram panchayat and village block.
  - Displays monthly physical home visit completion quotas with diagonal hatch progress bars.
  - Generates actionable physical field tickets when Tier 3 escalation fires.

---

### Feature 7: Dual-Clock Overall Treatment Time (OTT) Engine & Hub-Spoke Bridge
- **Capability**: Enforces curative cervical radiation completion within evidence-based biological limits across spoke EBRT clinics and hub brachytherapy centers.
- **Underlying Engine**: [`docs/archtecture.md`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/docs/archtecture.md) & [`src/core/database.py`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/src/core/database.py).
- **Core Mechanics**:
  - **Dual Countdown**: Starts from EBRT Fraction 1. Sets Target 1 at **Day 49** (GEC-ESTRO optimal) and Target 2 at **Day 56** (ABS/NCG limit).
  - **Day-21 (Fraction 15) Automatic Handoff Gate**: At EBRT Fraction 15 (Day 21), the system automatically initiates the pre-brachy checklist (CBC, RFT, Pre-Anesthetic Checkup) and requests operating theatre (OT) slot reservation at the central hub.
  - Prevents the classic 3-week scheduling bottleneck between regional radiation and central brachytherapy.

---

### Feature 8: Tamper-Evident SHA-256 Chained Cryptographic Audit Ledger
- **Capability**: Zero-knowledge, immutable audit logging for all clinical interactions, de-identification actions, model outputs, and statutory unmaskings.
- **Underlying Engine**: [`src/core/security.py`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/src/core/security.py) (`AuditLedger`).
- **Core Mechanics**:
  - Every event is encapsulated in an audit block containing `timestamp`, `event_id`, `actor`, `patient_token`, `action`, `severity`, and `metadata`.
  - Calculates a cryptographic block hash:
    $$\text{Hash}_i = \text{SHA-256}(\text{Hash}_{i-1} \,\|\, \text{Timestamp} \,\|\, \text{Action} \,\|\, \text{Payload})$$
  - Any unauthorized alteration of past records immediately breaks cryptographic block verification.
  - Compliant with the Indian **Digital Personal Data Protection (DPDP) Act, 2023** and **ABDM Health Data Management Policy**.

---

### Feature 9: Vernacular Multilingual Co-Pilot & Literacy-Free Healing Clock
- **Capability**: Communicates treatment milestones and symptom monitoring to rural patients regardless of literacy or language barriers.
- **Core Mechanics**:
  - Speech synthesis and recognition integration with Indic voice models (Sarvam Saaras v3 / Bhashini) covering 22 scheduled languages.
  - Visual **"Healing Clock"**: Displays treatment progress as a 29-step visual timeline (25 EBRT fractions + 4 brachytherapy insertions) instead of complex medical text.
  - Proactive weekly Cisplatin hydration coaching and home-care toxicity protocols (oral rehydration salt preparation, radiation diarrhea management).

---

### Feature 10: CareUI Swiss-Grotesk High-Density Clinical Workstation
- **Capability**: State-of-the-art web interface engineered for clinical precision, cognitive clarity, and zero cognitive fatigue.
- **Underlying Engine**: [`frontend/`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/frontend) (React 19, TypeScript, Tailwind CSS, Lucide icons).
- **Aesthetic Principles**:
  - **Zero Emojis & Zero Neon Slop**: Monochromatic SVG line icons with strict clinical light palette (`#2B66E4` Royal Cobalt, `#4A91A7` Slate Cyan, `#D8CA21` Warm Gold, `#111418` Obsidian Charcoal).
  - **Data-Dense Telemetry**: 12×5 dot-matrix sparklines, striped operational glyphs, diagonal hatch patterns (`.bg-hatch`), and soft pastel alert cards (`#FFF1F0`, `#FEF9C3`, `#F0FDF4`).
  - Ergonomic keyboard shortcuts (`⌘K` case search) and 2-column clinical workstation layouts.

---

## 3. High-Level System Architecture

The following diagram illustrates the complete end-to-end layered architecture of CerviSetu, detailing client surfaces, security boundaries, orchestration engines, and persistence layers:

```mermaid
flowchart TB
    %% -------------------------------------------------------------
    %% CLIENT LAYER
    %% -------------------------------------------------------------
    subgraph CLIENT["1. PRESENTATION & CLINICAL CLIENT LAYER"]
        direction TB
        c_workstation["CareUI Clinical Workstation<br/>(React 19 · Vite · TypeScript)<br/>• Intake Dashboard · Image Inspector · Escalation Matrix"]
        c_mobile["Frontline Mobile Field Interface<br/>(PWA · Offline First)<br/>• ASHA Worker Roster · Physical Dispatch Tickets"]
        c_patient["Vernacular Patient Channel<br/>• WhatsApp Interactive · Regional IVR · Visual Healing Clock"]
    end

    %% -------------------------------------------------------------
    %% GATEWAY & SECURITY PERIMETER
    %% -------------------------------------------------------------
    subgraph GATEWAY["2. API GATEWAY & SECURITY PERIMETER"]
        direction TB
        api_router["FastAPI Asynchronous Gateway<br/>(CORS · Rate Limiting · File Upload Handlers)"]
        vault_gate["Zero-Knowledge Cryptographic Boundary<br/>• AES-256-GCM Vault Engine<br/>• Deterministic Tokenizer (PT-RURAL-XXXX)"]
        auth_guard["Role-Based Access Control (RBAC)<br/>• CMO Statutory Gate · Session Tokens"]
    end

    %% -------------------------------------------------------------
    %% AGENTIC MULTI-AGENT LAYER
    %% -------------------------------------------------------------
    subgraph ORCHESTRATION["3. LANGGRAPH AGENTIC ORCHESTRATION ENGINE"]
        direction TB
        lg_graph["StateGraph Workflow Controller<br/>(MemorySaver Checkpointing · Thread Isolation)"]
        
        subgraph AGENTS["Cooperating Specialized Clinical Agents"]
            direction LR
            a_ocr["OCR & Intake Agent<br/>(Clinical Entity Parser)"]
            a_triage["Image Quality Triage Agent<br/>(Laplacian · FFT · Contrast)"]
            a_diag["Diagnostic Synthesis Agent<br/>(TNM Staging · Workup)"]
            a_track["Rural Tracker Agent<br/>(4-Tier Escalation Matrix)"]
        end
    end

    %% -------------------------------------------------------------
    %% DETERMINISTIC CLINICAL ENGINES
    %% -------------------------------------------------------------
    subgraph ENGINES["4. DETERMINISTIC CLINICAL & LOGISTICS ENGINES"]
        direction LR
        ott_clock["Dual-Clock OTT Engine<br/>• Target 1: <=49d (GEC-ESTRO)<br/>• Target 2: <=56d (ABS/NCG)"]
        bridge_day21["Day-21 Hub-Spoke Bridge<br/>• Fraction 15 Checklist Gate<br/>• Central Brachy OT Allocator"]
        dispatch_engine["Multi-Channel Dispatcher<br/>• WhatsApp API · Twilio/Exotel IVR<br/>• District Health Authority Gateway"]
    end

    %% -------------------------------------------------------------
    %% DATA & COMPLIANCE LAYER
    %% -------------------------------------------------------------
    subgraph DATA_LAYER["5. STORAGE, FHIR & COMPLIANCE REPOSITORY"]
        direction LR
        db_sql[("SQLite / PostgreSQL<br/>• Cases · Episodes<br/>• Fractions · ASHA Teams")]
        vault_store[("AES-256-GCM Encrypted Vault<br/>• PII Binaries · Nonces<br/>• Contact & Landmark Maps")]
        audit_chain[("Append-Only Audit Ledger<br/>• SHA-256 Hash Chain<br/>• DPDP Compliance Log")]
        abdm_fhir[("ABDM FHIR R4 Repository<br/>• CarePlan · Task<br/>• Observation · Appointment")]
    end

    %% Inter-layer connections
    c_workstation & c_mobile -->|"HTTPS / REST API"| api_router
    c_patient <-->|"WhatsApp / Voice Telephony"| dispatch_engine
    
    api_router --> vault_gate
    vault_gate -->|"Encrypted PII"| vault_store
    vault_gate -->|"De-Identified Clinical State"| lg_graph
    
    lg_graph --> a_ocr
    a_ocr --> a_triage
    a_triage -->|"Sharp Medical Scan"| a_diag
    a_triage -.->|"Blurry / Non-Medical"| a_track
    a_diag --> a_track
    
    a_track --> dispatch_engine
    a_track --> ott_clock & bridge_day21
    
    ott_clock & bridge_day21 --> db_sql & abdm_fhir
    a_ocr & a_triage & a_diag & a_track & auth_guard -->|"Chained Events"| audit_chain
```

---

## 4. Data Flow Diagrams (DFDs)

### 4.1 Level 0: System Context Data Flow Diagram
The Level 0 context diagram models CerviSetu as a single high-level system interacting with external human and institutional entities:

```mermaid
flowchart TD
    %% Entities
    PAT(["External: Patient & Family<br/>(Rural Community)"])
    DOC(["External: Primary / Spoke Clinician<br/>(Medical Officer / Nurse)"])
    HUB(["External: Central Hub Oncologist<br/>(Brachytherapy Lead)"])
    ASHA(["External: ASHA / Village Health Worker<br/>(Field Sector Lead)"])
    DMO(["External: District Medical Officer (CMO)<br/>(Health Authority)"])
    ABDM(["External: ABDM / Ayushman Bharat<br/>(National Health Registry)"])

    %% Core System
    SYSTEM[["CERVISETU CORE SYSTEM<br/>(LangGraph AI · AES-256 Vault · Escalation Matrix)"]]

    %% Flows
    DOC -->|"1. Raw Doctor Notes, Scans, Days Overdue"| SYSTEM
    PAT -->|"2. Dial-pad Input, Voice Confirmation, Symptom Replies"| SYSTEM
    HUB -->|"3. OT Date Confirmation, Signed NCG Form"| SYSTEM
    
    SYSTEM -->|"4. De-Identified Diagnostic Dossier & Triage Metrics"| DOC
    SYSTEM -->|"5. Multilingual Voice Audio, SMS & Visual Healing Clock"| PAT
    SYSTEM -->|"6. Tier 3 Home Visit Orders with Village GPS Coordinates"| ASHA
    SYSTEM -->|"7. Tier 4 Statutory Emergency Directives & Unmasked Address"| DMO
    SYSTEM -->|"8. Day-21 Referral Packet & Slot Request"| HUB
    SYSTEM -->|"9. ABDM FHIR R4 Bundle (CarePlan & Encounters)"| ABDM
    
    DMO -->|"10. Statutory Emergency Override Credentials"| SYSTEM
```

---

### 4.2 Level 1: Core Process Data Flow Diagram
The Level 1 diagram unpacks the internal operational processes and persistent data stores of CerviSetu:

```mermaid
flowchart TB
    %% External Entities
    E_CLIN(["Clinician / Field Nurse"])
    E_PAT(["Patient / Caregiver"])
    E_ASHA(["ASHA Worker"])
    E_AUTH(["District Authority / CMO"])

    %% Processes
    P1(("P1.0<br/>Ingestion &<br/>PII De-Identification"))
    P2(("P2.0<br/>Medical Image<br/>Quality Triage"))
    P3(("P3.0<br/>LangGraph Multi-Agent<br/>Diagnostic Synthesis"))
    P4(("P4.0<br/>Rural Overdue Tracking<br/>& Escalation Matrix"))
    P5(("P5.0<br/>Dual-Clock OTT &<br/>Day-21 Hub Bridge"))
    P6(("P6.0<br/>Statutory Vault Unmasking<br/>& Audit Chaining"))

    %% Data Stores
    D1[("D1: AES-256 Vault<br/>(Encrypted PII)")]
    D2[("D2: Patient & Case DB<br/>(Clinical Entities)")]
    D3[("D3: Treatment Episodes<br/>(49d/56d Clocks)")]
    D4[("D4: Chained Audit Ledger<br/>(SHA-256 Hash Log)")]
    D5[("D5: ABDM / FHIR Store<br/>(CarePlans & Tasks)")]

    %% Process Flows
    E_CLIN -->|"Doctor notes, patient PII, biopsy scans"| P1
    P1 -->|"Store Encrypted PII (Nonce + Ciphertext)"| D1
    P1 -->|"Log De-identification Event"| D4
    P1 -->|"De-Identified Token & Image Path"| P2
    
    P2 -->|"Extract Edge Variance & FFT Ratio"| P2
    P2 -->|"Log Quality Assessment Result"| D4
    P2 -->|"Valid Medical Scan + Token"| P3
    P2 -.->|"Rejected Scan (Bypass)"| P4
    
    P3 -->|"Synthesize TNM Stage, Differentials & Urgency"| D2
    P3 -->|"Clinical Impression Dossier"| E_CLIN
    P3 -->|"Log AI Diagnostic Event"| D4
    P3 -->|"Diagnosis & Severity Score"| P4
    
    P4 -->|"Evaluate Days Overdue & Cancer Risk"| P4
    P4 -->|"Tier 1 SMS / Tier 2 Vernacular IVR"| E_PAT
    P4 -->|"Tier 3 Field Ticket"| E_ASHA
    P4 -->|"Trigger Emergency Directive"| P6
    P4 -->|"Update Follow-up Status"| D2
    P4 -->|"Trigger OTT Clock Tracking"| P5
    
    P5 -->|"Track Fraction Count & Day 21 Gate"| D3
    P5 -->|"Commit FHIR CarePlan / Task"| D5
    
    E_AUTH -->|"Statutory Token Request"| P6
    P6 -->|"Decrypt PII via AES-256-GCM"| D1
    P6 -->|"Tier 4 Unmasked Address Dossier"| E_AUTH
    P6 -->|"Record Tamper-Evident Unmasking Event"| D4
```

---

## 5. Detailed Sequence Diagrams

### 5.1 Sequence 1: Patient Intake, De-Identification & Diagnostic Synthesis
This sequence illustrates the interaction from initial clinician case submission through OCR parsing, PII encryption, LangGraph agent execution, and audit log generation:

```mermaid
sequenceDiagram
    autonumber
    actor Clinician as Doctor / Field Staff
    participant API as FastAPI Gateway (/api/run-case)
    participant Vault as TokenVault (AES-256-GCM)
    participant Graph as LangGraph Orchestrator
    participant OCR as OCR Intake Agent
    participant Diag as Diagnostic Synthesis Agent
    participant Ledger as SHA-256 Audit Ledger
    participant Store as Case Database (SQLite)

    Clinician->>API: POST /api/run-case (Name, Phone, Village, Notes, Biopsy Scan)
    activate API
    API->>Vault: store_pii(token_id, {name, phone, village, address})
    activate Vault
    Vault->>Vault: Generate 96-bit Nonce + AES-GCM Encrypt
    Vault-->>API: De-Identified Token (PT-RURAL-7891)
    deactivate Vault

    API->>Ledger: record_event(PT-RURAL-7891, "PII_DEIDENTIFIED", severity="INFO")
    Ledger->>Ledger: Compute SHA-256(PrevHash + EventData)

    API->>Graph: invoke(ClinicalAgentState with PT-RURAL-7891)
    activate Graph
    Graph->>OCR: parse_clinical_notes(anonymized_text)
    activate OCR
    OCR->>OCR: Extract cancer type, stage, symptoms & investigations
    OCR-->>Graph: ClinicalIntake (Oral Carcinoma, Stage III, Severity: 0.85)
    deactivate OCR

    Graph->>Diag: synthesize_diagnosis(ClinicalIntake)
    activate Diag
    Diag->>Diag: Query NCG guidelines, verify staging & differentials
    Diag-->>Graph: DiagnosticSynthesis (Primary, Differentials, Urgency: HIGH)
    deactivate Diag

    Graph->>Store: save_case(PT-RURAL-7891, ClinicalIntake, DiagnosticSynthesis)
    Graph->>Ledger: record_event(PT-RURAL-7891, "DIAGNOSTIC_COMPLETED", severity="INFO")
    Graph-->>API: Final State Payload
    deactivate Graph

    API-->>Clinician: 200 OK (De-identified token, diagnostic impressions, workup plan)
    deactivate API
```

---

### 5.2 Sequence 2: Medical Image Quality & Anomaly Triage Pre-Filter
This sequence details how images are evaluated for blur, exposure, and medical suitability before diagnostic inference:

```mermaid
sequenceDiagram
    autonumber
    actor Clinician as Clinician / Scanner
    participant UI as Image Triage Canvas
    participant Agent as ImageTriageAgent
    participant Tools as OpenCV/NumPy Image Tools
    participant Router as LangGraph Conditional Edge
    participant Ledger as SHA-256 Audit Ledger

    Clinician->>UI: Uploads histopathology slide or dermoscopy photo
    UI->>Agent: assess_image_suitability(image_path)
    activate Agent
    
    Agent->>Tools: calculate_laplacian_variance(image)
    Tools-->>Agent: Variance = 31.2 (Threshold: >= 85.0 -> FAIL BLUR)
    
    Agent->>Tools: calculate_fft_high_frequency_ratio(image)
    Tools-->>Agent: FFT Ratio = 0.008 (Tissue texture attenuated)
    
    Agent->>Tools: evaluate_contrast_and_exposure(image)
    Tools-->>Agent: RMS Contrast = 14.1 (Underexposed)
    
    Agent->>Tools: classify_medical_domain(image)
    Tools-->>Agent: Domain = Oral Mucosa (Medical Verified)

    Agent->>Agent: Compile ImageQualityResult(is_valid=False, blur_status="BLURRY")
    Agent->>Ledger: record_event(Token, "IMAGE_TRIAGE_REJECTED", reason="Laplacian 31.2 < 85.0")
    Agent-->>Router: ImageQualityResult
    deactivate Agent

    activate Router
    Router->>Router: should_diagnose(state) -> Check is_valid
    alt Image is Sharp & Valid
        Router-->>Clinician: Route to DiagnosticSynthesisAgent
    else Image is Blurry / Artifact
        Router-->>Clinician: Bypass AI Diagnosis; Emit Corrective Guidance Card
        Note over Clinician: UI displays: "Severe Motion Blur. Retake scan with stabilized camera."
    end
    deactivate Router
```

---

### 5.3 Sequence 3: Progressive Rural Escalation Matrix & Tier 4 Authority Unmasking
This sequence demonstrates the day-by-day escalation lifecycle for a non-responding oncology patient:

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

    Note over Tracker: Day 1–2 Overdue: Patient misses biopsy review appointment
    Tracker->>Dispatcher: dispatch_tier_1_sms(Token, cancer="ORAL", stage="Stage III")
    Dispatcher->>Patient: WhatsApp Vernacular Audio + Visual Graphic Reminder
    Tracker->>Ledger: record_event(Token, "DISPATCH_TIER_1_SMS")

    Note over Tracker: Day 3–5 Overdue: Zero clinic check-in recorded
    Tracker->>Dispatcher: dispatch_tier_2_ivr(Token, dialect="Bhojpuri")
    Dispatcher->>Patient: Automated Dial-in Voice Call (Press 1 to confirm transport)
    Tracker->>Ledger: record_event(Token, "DISPATCH_TIER_2_IVR")

    Note over Tracker: Day 6–7 Overdue: High-risk patient still non-responsive
    Tracker->>Dispatcher: dispatch_tier_3_asha(Token, region="Kalyanpur Block")
    Dispatcher->>ASHA: Mobile Field Ticket with Patient Token & Sector Landmark
    ASHA->>Patient: Conducts in-person physical home visit
    Tracker->>Ledger: record_event(Token, "DISPATCH_TIER_3_ASHA")

    Note over Tracker: Day 8+ Overdue: Critical Stage III/IV Patient in Danger
    Tracker->>Tracker: evaluate_and_escalate(days=8, stage="Stage III")
    Tracker->>Vault: retrieve_pii(Token) [System Authority Override]
    activate Vault
    Vault->>Vault: AES-256-GCM Decrypt using Master Key & Nonce
    Vault-->>Tracker: Unmasked PII {Full Name: "Shanti Devi", Address: "Ward 4, Pipra Village"}
    deactivate Vault

    Tracker->>Dispatcher: generate_authority_dossier(Unmasked PII, Clinical Stage)
    Dispatcher->>CMO: EMERGENCY STATUTORY DOSSIER (Unmasked address for urgent vehicle dispatch)
    Tracker->>Ledger: record_event(Token, "TIER_4_STATUTORY_UNMASKED", severity="CRITICAL")
    Note over Ledger: Cryptographic Block committed with statutory audit stamp
```

---

### 5.4 Sequence 4: Dual-Clock OTT Monitoring & Day-21 Hub-Spoke Brachy Bridge
This sequence maps the hub-spoke coordination required to complete radiation and brachytherapy within 49 to 56 days:

```mermaid
sequenceDiagram
    autonumber
    actor Spoke as Regional EBRT Spoke Clinician
    actor Patient as Patient (Vernacular App/IVR)
    participant Clock as Dual-Clock OTT Engine
    participant Bridge as Day-21 Hub-Spoke Bridge
    actor Hub as Central Brachy Hub Oncologist
    participant FHIR as ABDM FHIR R4 Store

    Spoke->>Clock: Log EBRT Fraction 1 (e.g. August 1, 2026)
    activate Clock
    Clock->>Clock: Start Clock 1: Target <=49d (Sept 19)
    Clock->>Clock: Start Clock 2: Target <=56d (Sept 26)
    Clock->>Patient: Send Literacy-Free Visual Healing Clock (Step 1 of 29)
    Clock->>FHIR: Create FHIR CarePlan (Episode Start)
    deactivate Clock

    loop Fractions 2 to 14 (Days 2 to 20)
        Spoke->>Clock: Daily Barcode Fraction Check-in
        Clock->>Patient: Proactive Cisplatin Hydration & Toxicity Voice Check-in
    end

    Note over Spoke,Hub: Day 21: Fraction 15 Milestone Reached!
    Spoke->>Clock: Log EBRT Fraction 15 (Day 21)
    Clock->>Bridge: trigger_day21_handoff(EpisodeID)
    activate Bridge
    Bridge->>Spoke: Issue Pre-Brachy Readiness Checklist (CBC, RFT, PAC clearance)
    Bridge->>Hub: Open Hub Referral Ticket & Request OT Slot Window (Days 38-44)
    deactivate Bridge

    Spoke->>Bridge: Clinician signs off pre-brachy bloods & PAC clearance
    Hub->>Bridge: Confirm Central OT Brachytherapy Slot (Day 41)
    Bridge->>Patient: Vernacular "What is Brachytherapy?" audio + Bus pass & Dharamshala voucher
    Bridge->>FHIR: Update FHIR Task: Brachy Scheduled

    Note over Patient,Hub: Days 41 to 46: Central Hub Brachytherapy Delivery
    Patient->>Hub: Arrives at Central Hub on schedule
    Hub->>Clock: Log Final Brachy Fraction Delivered (Day 46)
    activate Clock
    Clock->>Clock: Calculate Final OTT = 46 Days (PASS <=49d Benchmark!)
    Clock->>FHIR: Commit Complete Treatment Bundle & Outcome Metrics
    deactivate Clock
```

---

### 5.5 Sequence 5: Chief Medical Officer (CMO) Role-Gated Vault Inspection
This sequence details how authorized hospital leadership inspects patient identity while maintaining an unbroken cryptographic audit trail:

```mermaid
sequenceDiagram
    autonumber
    actor CMO as Chief Medical Officer / Auditor
    participant UI as Security & Audit Dashboard
    participant API as FastAPI /api/vault/inspect
    participant Vault as TokenVault (AES-256-GCM)
    participant Ledger as AuditLedger (SHA-256)

    CMO->>UI: Enters Patient Token (PT-RURAL-7891) + Submits Unmask Request
    UI->>API: POST /api/vault/inspect?patient_token=PT-RURAL-7891
    activate API
    API->>API: Verify caller credentials (Role == "CHIEF_MEDICAL_OFFICER")
    
    alt Unauthorized Role
        API-->>UI: 403 Forbidden (Statutory Access Denied)
        API->>Ledger: record_event(Token, "UNAUTHORIZED_VAULT_ACCESS_ATTEMPT", severity="WARNING")
    else Authorized Role
        API->>Vault: retrieve_pii("PT-RURAL-7891")
        activate Vault
        Vault->>Vault: Verify 96-bit Nonce & Decrypt Ciphertext
        Vault-->>API: Decrypted PII Payload (Name, Mobile, Full Address)
        deactivate Vault

        API->>Ledger: record_event("PT-RURAL-7891", "STATUTORY_PII_UNMASKED", actor="Dr. Morgan (CMO)", severity="CRITICAL")
        activate Ledger
        Ledger->>Ledger: Append to Block Chain & Compute SHA-256 Hash
        Ledger-->>API: Audit Block Confirmed (Hash: e8f3...91ab)
        deactivate Ledger

        API-->>UI: 200 OK (Decrypted PII + Audit Transaction Hash)
    end
    deactivate API
    UI-->>CMO: Renders Statutory Decryption Certificate & Patient Details
```

---

## 6. Data Models, State Schemas & Cryptographic Specifications

### 6.1 LangGraph State Schema (`ClinicalAgentState`)
Defined in [`src/core/state.py`](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/src/core/state.py), this unified state dictionary transitions across nodes:

```python
class ClinicalAgentState(TypedDict):
    # Data Privacy & Identification
    patient_token: str                                  # e.g., 'PT-RURAL-7891'
    session_id: str                                     # e.g., 'sess-a1b2c3d4'
    
    # Input Payloads
    raw_text: Optional[str]                             # De-identified clinical transcription
    document_path: Optional[str]                        # Uploaded PDF/report path
    image_path: Optional[str]                           # Uploaded medical slide image path
    
    # Pillar 1 Diagnostic Outputs
    clinical_intake: Optional[Dict[str, Any]]           # Parsed complaints, stage, severity
    intake_status: str                                  # PENDING | COMPLETED | FAILED
    
    # Pillar 3 Image Quality Outputs
    image_quality: Optional[Dict[str, Any]]             # Laplacian variance, FFT ratio, contrast
    image_triage_passed: bool                           # True if image meets sharpness threshold
    
    # Diagnostic Processing
    diagnostic_synthesis: Optional[Dict[str, Any]]      # TNM staging, workup recommendations
    
    # Pillar 2 Surveillance & Escalation Outputs
    days_overdue: int                                   # Days elapsed since missed visit
    cancer_severity_score: float                        # Calculated clinical risk (0.0 to 1.0)
    current_escalation_tier: Optional[str]              # TIER_1_SMS to TIER_4_AUTHORITY
    dispatched_notifications: Annotated[List[Dict[str, Any]], operator.add]
    authority_escalation_dossier: Optional[Dict[str, Any]] # Emergency unmasked address dossier
    
    # Audit Trail & Error Trapping
    audit_trail: Annotated[List[str], operator.add]     # Chained audit event IDs
    errors: Annotated[List[str], operator.add]          # Operational exception records
    next_node: Optional[str]                            # Routing pointer
    status: str                                         # RUNNING | COMPLETED | FAILED
```

---

### 6.2 Relational Entity Relationship (ER) Schema
The persistent relational data layer manages treatment episodes, facilities, and escalation workflows:

```mermaid
erDiagram
    FACILITY ||--o{ TREATMENT_EPISODE : "hosts (Spoke or Hub)"
    PATIENT ||--o{ DPDP_CONSENT : "grants"
    PATIENT ||--o{ TREATMENT_EPISODE : "undergoes"
    TREATMENT_EPISODE ||--o{ TREATMENT_EVENT : "logs fraction/cycle"
    TREATMENT_EPISODE ||--|| HUB_SPOKE_BRACHY_BRIDGE : "triggers at Day 21"
    TREATMENT_EPISODE ||--o{ ESCALATION_DISPATCH : "triggers when overdue"
    TREATMENT_EPISODE ||--o{ AUDIT_LOG_ENTRY : "records immutable trail"

    PATIENT {
        string patient_token PK "Anonymized Token (e.g. PT-RURAL-7891)"
        string abha_id UK "ABDM Ayushman Bharat Health ID"
        string preferred_language "Hindi, Bhojpuri, Bengali, etc."
        float spoke_to_hub_km "Travel distance to central hospital"
        boolean pmjay_verified "Ayushman Bharat coverage active"
    }

    FACILITY {
        uuid facility_id PK
        string facility_name "Regional Spoke or Central Hub"
        string facility_role "REGIONAL_EBRT_SPOKE | CENTRAL_BRACHY_HUB"
        boolean pmjay_empanelled
    }

    TREATMENT_EPISODE {
        uuid episode_id PK
        string patient_token FK
        uuid spoke_facility_id FK
        uuid hub_facility_id FK
        date ebrt_start_date "Starts 49d and 56d countdown"
        date target_49d_gec_estro "Optimal deadline"
        date target_56d_abs_ncg "Absolute biological limit"
        int current_fractions_completed "1 to 25"
        int days_overdue "Count of days past scheduled window"
        string current_stage "EBRT | BRIDGE_DAY21 | BRACHY | COMPLETED"
        int final_ott_days "Total days from Frac 1 to Brachy end"
    }

    HUB_SPOKE_BRACHY_BRIDGE {
        uuid bridge_id PK
        uuid episode_id FK
        date triggered_date "Auto-created at Fraction 15 (Day 21)"
        boolean cbc_rft_cleared "Laboratory workup signed off"
        boolean pac_anesthesia_cleared "Pre-anesthetic evaluation signed"
        date central_hub_ot_slot "Reserved brachy operating theatre date"
        boolean doctor_readiness_signoff "Hard clinician sign-off gate"
    }

    ESCALATION_DISPATCH {
        uuid dispatch_id PK
        uuid episode_id FK
        string tier "TIER_1_SMS | TIER_2_IVR | TIER_3_ASHA | TIER_4_AUTHORITY"
        string channel "WHATSAPP | TELEPHONY_IVR | ASHA_APP | AUTHORITY_PORTAL"
        string recipient_role "PATIENT | GUARDIAN | ASHA_LEAD | CMO"
        timestamp dispatched_at
        string delivery_status "DELIVERED | CONFIRMED | UNRESOLVED"
    }

    AUDIT_LOG_ENTRY {
        uuid entry_id PK
        string patient_token FK
        string action_name
        string actor_identity
        string severity "INFO | WARNING | CRITICAL"
        string sha256_current_hash "SHA-256 block hash"
        string sha256_prev_hash "Hash chaining parent pointer"
        timestamp recorded_at
    }
```

---

### 6.3 Cryptographic Storage Layout
Sensitive records are encrypted using **AES-256-GCM** (Galois/Counter Mode). Each encrypted blob is packed as follows:

```
+---------------------------------------------------------------------------------------+
|                                ENCRYPTED PII RECORD LAYOUT                            |
+------------------------------------+--------------------------------------------------+
|          NONCE (12 Bytes)          |           CIPHERTEXT & GCM TAG (Variable)        |
+------------------------------------+--------------------------------------------------+
| Cryptographically secure random    | Authenticated ciphertext payload containing JSON |
| 96-bit initialization vector       | string of {name, phone, village, landmark}.      |
| generated per record via           | Authenticated against patient_token as Additional|
| secrets.token_bytes(12)            | Authenticated Data (AAD).                        |
+------------------------------------+--------------------------------------------------+
```

---

## 7. Technology Stack & Deployment Architecture

| Layer | Technologies Selected | Clinical & Operational Rationale |
|---|---|---|
| **Frontend Framework** | React 19, TypeScript, Vite | High render performance, strict type safety, zero build overhead. |
| **Styling & Design System** | Tailwind CSS v4, CareUI, Lucide | Swiss-Grotesk light clinical design, anti-AI slop, high data density. |
| **API Backend** | FastAPI, Python 3.12+, Uvicorn | High-throughput asynchronous endpoints, auto-generated OpenAPI docs. |
| **Agentic Framework** | LangGraph, LangChain Core | Stateful cyclic graph execution, memory checkpointing, conditional routing. |
| **Computer Vision** | OpenCV (cv2), NumPy, SciPy | Sub-millisecond Laplacian variance calculation, 2D FFT spectral analysis. |
| **Cryptography** | `cryptography.fernet`, `AESGCM`, SHA-256 | Military-grade zero-knowledge encryption, authenticated encryption with AAD. |
| **Standards Compliance** | ABDM FHIR R4, DPDP Act 2023 | Interoperable Ayushman Bharat integration, statutory compliance. |

---

*Authored for the CerviSetu Technical Architecture Team · Certified Complete and Verified.*
