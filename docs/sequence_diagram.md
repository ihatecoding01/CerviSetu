# CerviSetu: Hub-Spoke Care Pathway Sequence Diagram

> For the comprehensive master specification covering all features, system architecture, Level 0/1 DFDs, and all 5 workflow sequence diagrams, refer to [SYSTEM_ARCHITECTURE_AND_FEATURES.md](file:///c:/Users/perci/Documents/projects_2026/health_hackathon/docs/SYSTEM_ARCHITECTURE_AND_FEATURES.md).

```mermaid
sequenceDiagram
    autonumber
    actor Pat as Patient (Vernacular WhatsApp/IVR)
    participant Spoke as Regional EBRT Spoke (Doctor/RT)
    participant Engine as CerviSetu Dual-Clock & AI Engine
    participant Hub as Central Brachytherapy Hub (Doctor)
    participant Store as ABDM FHIR & QI Research Store

    rect rgb(230, 245, 255)
    Note over Pat,Store: PHASE 1: DAY 1 ONBOARDING & DUAL-CLOCK LAUNCH
    Spoke->>Pat: Capture DPDP Consent (Pathway, Voice, QI)
    Pat-->>Engine: Voice/Tap Consent Verified
    Spoke->>Engine: Log EBRT Fraction 1 + Link ABHA ID
    Engine->>Store: Initialize Episode (Target <=49d GEC-ESTRO & <=56d ABS)
    Engine->>Pat: Send Vernacular Welcome + Visual "Healing Clock" (1/29 Steps)
    Engine->>Pat: Auto-Run Finance Bot -> Issue PMJAY & State Transport Info
    end

    rect rgb(235, 250, 235)
    Note over Pat,Store: PHASE 2: DAYS 2–20 LOCAL EBRT & PROACTIVE TOXICITY TRIAGE
    loop Every Cisplatin Week & Every 3 Days
        Engine->>Pat: Voice Reminder: Pre-Cisplatin Hydration & Blood Test
        Engine->>Pat: 2-Question Vernacular Symptom Check-in
        Pat-->>Engine: Voice Reply (e.g., Radiation Diarrhea / Burning)
        alt Mild Symptom (Grade 1)
            Engine->>Pat: Automated ORS/Diet Home-Care Audio
        else Moderate/Severe Symptom (Grade 2+)
            Engine->>Spoke: Urgent Triage Alert on Morning Ward List
            Spoke->>Pat: Early Supportive Medication (Prevents Dropout!)
        end
    end
    end

    rect rgb(255, 245, 230)
    Note over Pat,Store: PHASE 3: DAY 21 (FRACTION 15) AUTOMATED HUB-AND-SPOKE HANDOFF
    Spoke->>Engine: Log EBRT Fraction 15 (Day 21 reached)
    Engine->>Spoke: Trigger Pre-Brachy Readiness Checklist (CBC, RFT, PAC)
    Engine->>Hub: Open Hub-and-Spoke Referral Packet + Request OT Slot Window
    Spoke->>Engine: Clinician Signs Off Readiness Checklist
    Hub->>Engine: Confirm Central Brachytherapy OT Dates
    Engine->>Pat: Send Culturally Sensitive "What is Brachytherapy?" Audio
    Engine->>Pat: Issue 47-Mile Travel Voucher + Dharamshala Stay + Printed Pass
    end

    rect rgb(245, 235, 255)
    Note over Pat,Store: PHASE 4: DAYS 31–49 CENTRAL BRACHYTHERAPY & VOICE-TO-FHIR SIGN-OFF
    Pat->>Hub: Arrives on Time for High-Dose Brachytherapy
    Hub->>Engine: Clinician Dictates Procedure & Summary (Sarvam/Bhashini ASR)
    Engine->>Hub: LLM Returns Structured NCG Draft (Unsigned)
    Hub->>Engine: Doctor Reviews, Edits & Taps "Sign"
    Engine->>Engine: Permanently Delete Raw Voice Audio
    Engine->>Store: Commit Signed FHIR Bundle to ABHA / ABDM
    Engine->>Store: Log Final OTT (e.g., 46 Days -> Met <=49d & <=56d Benchmarks!)
    Engine->>Pat: Activate 3, 6, 12-Month Local Spoke Survivorship Reminders
    end
```