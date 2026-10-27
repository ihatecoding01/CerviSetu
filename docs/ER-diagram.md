erDiagram
    FACILITY ||--o{ TREATMENT_EPISODE : "hosts (Spoke or Hub)"
    PATIENT ||--o{ DPDP_CONSENT : "grants"
    PATIENT ||--o{ TREATMENT_EPISODE : "undergoes"
    TREATMENT_EPISODE ||--o{ TREATMENT_EVENT : "logs fractions/cycles"
    TREATMENT_EPISODE ||--|| HUB_SPOKE_BRACHY_BRIDGE : "triggers at Day 21"
    TREATMENT_EPISODE ||--o{ TOXICITY_CHECKIN : "monitors patient side"
    TREATMENT_EPISODE ||--o{ TRAVEL_FINANCE_SUPPORT : "unlocks logistics"
    TREATMENT_EPISODE ||--o{ CLINICAL_NOTE : "documents via ASR"
    TREATMENT_EPISODE ||--o{ AUDIT_LOG : "records immutable trail"

    PATIENT {
        uuid patient_id PK
        string abha_id UK "ABDM Health ID"
        string preferred_language "22 Scheduled Languages"
        float spoke_to_hub_distance_km "For QI regression"
        boolean pmjay_verified
        string research_cohort "PRE_BASELINE or POST_CERVISETU"
    }

    FACILITY {
        uuid facility_id PK
        string facility_name
        string facility_role "REGIONAL_EBRT_SPOKE or CENTRAL_BRACHY_HUB"
        boolean pmjay_empanelled
    }

    DPDP_CONSENT {
        uuid consent_id PK
        uuid patient_id FK
        string data_category "PATHWAY_CLOCK | VOICE_ASR | QI_RESEARCH"
        boolean is_active
        timestamp signed_at
    }

    TREATMENT_EPISODE {
        uuid episode_id PK
        uuid patient_id FK
        uuid spoke_facility_id FK
        uuid hub_facility_id FK
        date ebrt_start_date "Starts 49d and 56d Clocks"
        date target_49d_gec_estro
        date target_56d_abs_ncg
        date projected_finish_date
        int final_ott_days "Null until completion"
        boolean met_49d_benchmark
        boolean met_56d_benchmark
        string current_stage "EBRT | BRIDGE_DAY21 | BRACHY | SURVIVORSHIP | LTFU"
    }

    TREATMENT_EVENT {
        uuid event_id PK
        uuid episode_id FK
        string event_type "EBRT_FRACTION | CISPLATIN_CYCLE | BRACHY_INSERTION"
        int sequence_number "e.g., EBRT 1..25, Brachy 1..4"
        date scheduled_date
        date actual_date
        string delay_root_cause "NONE | TOXICITY | TRAVEL_COST | OT_SLOT"
    }

    HUB_SPOKE_BRACHY_BRIDGE {
        uuid bridge_id PK
        uuid episode_id FK
        date triggered_date "Auto-created at EBRT Fraction 15"
        boolean bloods_cbc_rft_done
        boolean pac_anesthesia_cleared
        boolean brachy_explainer_sent_to_patient
        date central_hub_ot_slot
        boolean doctor_readiness_signoff "Hard Gate