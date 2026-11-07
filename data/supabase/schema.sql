-- =====================================================================================
-- CerviSetu Sovereign Clinical Database Schema for Supabase (PostgreSQL)
-- Compliance: DPDP Act 2023 (Digital Personal Data Protection) & ISO/IEC 27001
-- =====================================================================================

-- 1. Enable Required PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================================
-- TABLE: patients
-- Stores tokenized patient records (De-identified PT-ANON-XXXX tokens)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.patients (
    patient_token TEXT PRIMARY KEY,
    age INTEGER,
    gender TEXT DEFAULT 'Female',
    region_code TEXT DEFAULT 'RURAL',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- TABLE: clinical_cases
-- Structured oncology diagnostic records and LangGraph intake state
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.clinical_cases (
    case_id TEXT PRIMARY KEY,
    patient_token TEXT REFERENCES public.patients (patient_token) ON DELETE CASCADE,
    cancer_type TEXT DEFAULT 'CERVICAL',
    suspected_stage TEXT,
    severity_score NUMERIC(4, 2),
    intake_json JSONB,
    diagnostic_json JSONB,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- TABLE: medical_scans
-- Ingested prescription and histopathology scans with Laplacian blur telemetry
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.medical_scans (
    scan_id TEXT PRIMARY KEY,
    patient_token TEXT REFERENCES public.patients (patient_token) ON DELETE CASCADE,
    image_path TEXT,
    is_valid BOOLEAN DEFAULT TRUE,
    blur_score NUMERIC(6, 2),
    contrast_rms NUMERIC(6, 2),
    modality TEXT,
    quality_report_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- TABLE: follow_up_tracker
-- Rural patient tracking against the 56-day curative completion window
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.follow_up_tracker (
    tracker_id TEXT PRIMARY KEY,
    patient_token TEXT REFERENCES public.patients (patient_token) ON DELETE CASCADE,
    case_id TEXT,
    due_date TEXT,
    days_overdue INTEGER DEFAULT 0,
    last_reminder_tier TEXT,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolution_reason TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- TABLE: notifications
-- Multi-tier escalation notifications (SMS, Voice IVR, ASHA, District Authority)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    notification_id TEXT PRIMARY KEY,
    patient_token TEXT REFERENCES public.patients (patient_token) ON DELETE CASCADE,
    tier TEXT NOT NULL,
    channel TEXT NOT NULL,
    recipient_role TEXT NOT NULL,
    message_content TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- TABLE: user_activity_logs
-- Multi-role audit trail with SHA-256 cryptographic chaining
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    log_id TEXT PRIMARY KEY,
    user_role TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    patient_token TEXT NOT NULL,
    action_type TEXT NOT NULL,
    channel TEXT DEFAULT 'WEB_CAREUI',
    severity TEXT DEFAULT 'INFO',
    payload_json JSONB,
    sha256_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- TABLE: patient_healing_clock
-- 29-step radiotherapy trajectory (25 Spoke EBRT + 4 Hub HDR Brachytherapy)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.patient_healing_clock (
    patient_token TEXT PRIMARY KEY REFERENCES public.patients (patient_token) ON DELETE CASCADE,
    ebrt_start_date TEXT,
    ebrt_fractions_completed INTEGER DEFAULT 0,
    brachy_fractions_completed INTEGER DEFAULT 0,
    total_steps_completed INTEGER DEFAULT 0,
    projected_finish_days INTEGER DEFAULT 44,
    clock_target_49d_status TEXT DEFAULT 'OPTIMAL',
    clock_limit_56d_status TEXT DEFAULT 'ON_TRACK',
    is_completed BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- TABLE: patient_toxicity_logs
-- Pre-Cisplatin chemotherapy clearance check-ins & symptom grading
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.patient_toxicity_logs (
    log_id TEXT PRIMARY KEY,
    patient_token TEXT REFERENCES public.patients (patient_token) ON DELETE CASCADE,
    clock_day INTEGER NOT NULL,
    symptom_category TEXT NOT NULL,
    reported_severity_grade INTEGER NOT NULL,
    vernacular_raw_text TEXT,
    clinical_action_taken TEXT NOT NULL,
    ward_alert_acknowledged BOOLEAN DEFAULT FALSE,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- TABLE: patient_hub_spoke_passes
-- Day-21 transition pass from Spoke EBRT to Regional Cancer Centre HDR Brachytherapy
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.patient_hub_spoke_passes (
    pass_id TEXT PRIMARY KEY,
    patient_token TEXT REFERENCES public.patients (patient_token) ON DELETE CASCADE,
    spoke_facility_name TEXT DEFAULT 'Regional EBRT Spoke Clinic',
    hub_facility_name TEXT DEFAULT 'Central Regional Cancer Centre Hub',
    distance_km NUMERIC(5, 1) DEFAULT 75.0,
    requested_window TEXT DEFAULT 'Days 38–44',
    hub_ot_slot_date TEXT,
    slot_confirmed_by_doctor BOOLEAN DEFAULT FALSE,
    bus_voucher_code TEXT,
    dharamshala_room_code TEXT,
    is_simulated_mock BOOLEAN DEFAULT TRUE,
    issued_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- TABLE: pilot_leads
-- Frontline hospital registration for CerviSetu deployment
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.pilot_leads (
    lead_id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    district TEXT NOT NULL,
    facility_type TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- TABLE: hpv_vaccinations
-- Adolescent HPV vaccination registry (Cervavac 9-14 age cohort)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.hpv_vaccinations (
    vaccine_id TEXT PRIMARY KEY,
    patient_token TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    age INTEGER NOT NULL,
    dose_number INTEGER NOT NULL,
    vaccine_brand TEXT DEFAULT 'Cervavac',
    administered_date TEXT NOT NULL,
    next_due_date TEXT,
    school_or_center TEXT DEFAULT 'Primary Health Centre Mirzapur',
    status TEXT DEFAULT 'COMPLETED',
    outreach_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- TABLE: screening_records
-- Frontline visual screening (VIA / VILI / HPV DNA)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.screening_records (
    screening_id TEXT PRIMARY KEY,
    patient_token TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    age INTEGER NOT NULL,
    invitation_date TEXT,
    test_type TEXT NOT NULL,
    test_date TEXT NOT NULL,
    result TEXT NOT NULL,
    clinical_staging TEXT,
    triage_action TEXT NOT NULL,
    clinician_reviewed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- TABLE: precancer_episodes
-- Thermal ablation, cryotherapy, LEEP and 6-12 month surveillance tracking
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.precancer_episodes (
    precancer_id TEXT PRIMARY KEY,
    patient_token TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    diagnosis TEXT NOT NULL,
    treatment_type TEXT NOT NULL,
    appointment_date TEXT NOT NULL,
    completion_date TEXT,
    margins_clear BOOLEAN DEFAULT TRUE,
    surveillance_interval_months INTEGER DEFAULT 6,
    surveillance_due_date TEXT NOT NULL,
    surveillance_status TEXT DEFAULT 'SCHEDULED',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- TABLE: chemo_clearances
-- Weekly Cisplatin clearances & renal / hematological safety gates
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.chemo_clearances (
    clearance_id TEXT PRIMARY KEY,
    patient_token TEXT NOT NULL,
    cycle_number INTEGER NOT NULL,
    status TEXT NOT NULL,
    dose_mg NUMERIC(6, 2),
    hb NUMERIC(4, 1),
    anc INTEGER,
    platelets INTEGER,
    creatinine NUMERIC(4, 2),
    egfr INTEGER,
    doctor_id TEXT NOT NULL,
    clinical_notes TEXT,
    ebrt_must_continue BOOLEAN DEFAULT TRUE,
    cleared_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- TABLE: asha_field_tickets
-- Stigma-safe village outreach tickets with 24-hour arrival watch timers
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.asha_field_tickets (
    ticket_id TEXT PRIMARY KEY,
    patient_token TEXT NOT NULL,
    asha_worker_id TEXT NOT NULL,
    patient_first_name TEXT NOT NULL,
    guardian_name TEXT NOT NULL,
    village TEXT NOT NULL,
    landmark TEXT,
    contact_phone TEXT,
    days_missed INTEGER NOT NULL,
    current_step INTEGER NOT NULL,
    stigma_safe_header TEXT DEFAULT 'मातृ एवं महिला स्वास्थ्य सेवा / Women Health Follow-Up',
    delay_root_cause TEXT,
    field_outcome TEXT,
    arrival_watch_expires_at TIMESTAMPTZ,
    is_resolved BOOLEAN DEFAULT FALSE,
    dispatched_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- =====================================================================================
-- TABLE: linac_downtime_logs
-- Spoke radiotherapy LINAC machine maintenance & reschedule logs
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.linac_downtime_logs (
    downtime_id TEXT PRIMARY KEY,
    facility_name TEXT DEFAULT 'Mirzapur Spoke Clinic',
    machine_id TEXT DEFAULT 'LINAC-SPOKE-01',
    is_active BOOLEAN DEFAULT TRUE,
    reason TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- =====================================================================================
-- TABLE: dpdp_consents
-- Digital Personal Data Protection (DPDP) Act 2023 patient consent telemetry
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.dpdp_consents (
    consent_id TEXT PRIMARY KEY,
    patient_token TEXT NOT NULL,
    consent_type TEXT DEFAULT 'PATHWAY_TRACKING_VOICE_AND_RESEARCH',
    granted_by TEXT DEFAULT 'PATIENT_OR_LEGAL_GUARDIAN',
    language TEXT DEFAULT 'HINDI',
    sha256_hash TEXT NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- PERFORMANCE INDEXES
-- =====================================================================================
CREATE INDEX IF NOT EXISTS idx_patients_created ON public.patients (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_token ON public.clinical_cases (patient_token);
CREATE INDEX IF NOT EXISTS idx_tracker_days_overdue ON public.follow_up_tracker (days_overdue DESC);
CREATE INDEX IF NOT EXISTS idx_clock_token ON public.patient_healing_clock (patient_token);
CREATE INDEX IF NOT EXISTS idx_precancer_due ON public.precancer_episodes (surveillance_due_date, surveillance_status);
CREATE INDEX IF NOT EXISTS idx_asha_unresolved ON public.asha_field_tickets (is_resolved, dispatched_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.user_activity_logs (created_at DESC);

-- =====================================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================================
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_healing_clock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dpdp_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asha_field_tickets ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated services & anon showcase
CREATE POLICY "Allow public read access for demo showcase" ON public.patients FOR SELECT USING (true);
CREATE POLICY "Allow service role full access to patients" ON public.patients FOR ALL USING (true);

CREATE POLICY "Allow public read access for demo cases" ON public.clinical_cases FOR SELECT USING (true);
CREATE POLICY "Allow service role full access to cases" ON public.clinical_cases FOR ALL USING (true);

CREATE POLICY "Allow public read access for clock tracking" ON public.patient_healing_clock FOR SELECT USING (true);
CREATE POLICY "Allow service role full access to clocks" ON public.patient_healing_clock FOR ALL USING (true);

CREATE POLICY "Allow public read access to audit logs" ON public.user_activity_logs FOR SELECT USING (true);
CREATE POLICY "Allow service role full access to audit logs" ON public.user_activity_logs FOR ALL USING (true);

-- =====================================================================================
-- SEED INITIAL CLINICAL COHORT
-- =====================================================================================
INSERT INTO public.patients (patient_token, age, gender, region_code) VALUES
    ('PT-ANON-7B93', 46, 'Female', 'Varanasi-Rural'),
    ('PT-ANON-4E19', 52, 'Female', 'Sevapuri-Rural'),
    ('PT-ANON-8C52', 39, 'Female', 'Mirzapur-Rural'),
    ('PT-ANON-2D91', 48, 'Female', 'Chandauli-Rural')
ON CONFLICT (patient_token) DO NOTHING;

INSERT INTO public.patient_healing_clock (patient_token, ebrt_start_date, ebrt_fractions_completed, brachy_fractions_completed, total_steps_completed, projected_finish_days, clock_target_49d_status, clock_limit_56d_status) VALUES
    ('PT-ANON-7B93', '2026-10-12', 16, 0, 16, 44, 'OPTIMAL', 'ON_TRACK'),
    ('PT-ANON-4E19', '2026-10-01', 23, 1, 24, 49, 'WARNING', 'ON_TRACK'),
    ('PT-ANON-8C52', '2026-10-25', 5, 0, 5, 42, 'OPTIMAL', 'ON_TRACK'),
    ('PT-ANON-2D91', '2026-09-18', 25, 4, 29, 48, 'COMPLETED', 'SUCCESS')
ON CONFLICT (patient_token) DO NOTHING;

-- =====================================================================================
-- TABLE: referrals & referral tracking (Dual-Track Secondary Care)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.referrals (
    referral_id TEXT PRIMARY KEY,
    patient_token TEXT NOT NULL,
    age INTEGER,
    area TEXT NOT NULL,
    health_post TEXT NOT NULL,
    hospital TEXT,
    screening_finding TEXT NOT NULL,
    colposcopy TEXT NOT NULL DEFAULT '',
    histopathology TEXT NOT NULL DEFAULT '',
    red_flags TEXT NOT NULL DEFAULT '',
    urgent INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    referred_on TEXT,
    arrived_on TEXT,
    consent TEXT,
    consent_note TEXT,
    next_follow_up TEXT,
    fictional INTEGER NOT NULL DEFAULT 0,
    form_json JSONB DEFAULT '{}'::jsonb,
    assigned_asha TEXT,
    message_consent TEXT,
    family_consent INTEGER NOT NULL DEFAULT 0,
    stopped_at TEXT,
    doctor_review TEXT,
    doctor_review_note TEXT,
    colposcopy_json JSONB DEFAULT '{}'::jsonb,
    biopsy TEXT NOT NULL DEFAULT '',
    mri TEXT NOT NULL DEFAULT '',
    final_diagnosis TEXT NOT NULL DEFAULT '',
    treatment_plan TEXT NOT NULL DEFAULT '',
    remarks TEXT NOT NULL DEFAULT '',
    visit_outcome TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.referral_events (
    event_id TEXT PRIMARY KEY,
    referral_id TEXT NOT NULL,
    event_date TEXT NOT NULL,
    follow_up_day INTEGER,
    kind TEXT NOT NULL,
    channel TEXT,
    detail TEXT,
    status TEXT,
    actor TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.health_posts (
    name TEXT PRIMARY KEY,
    area TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.referral_routes (
    health_post TEXT PRIMARY KEY,
    hospital TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_hospitals (
    hospital_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    hospital_type TEXT NOT NULL,
    area TEXT NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    services TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    location_source TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security policies for newly added tables
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hpv_vaccinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screening_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_hospitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to referrals" ON public.referrals FOR ALL USING (true);
CREATE POLICY "Allow public read access to referrals" ON public.referrals FOR SELECT USING (true);
CREATE POLICY "Allow service role full access to hpv_vaccinations" ON public.hpv_vaccinations FOR ALL USING (true);
CREATE POLICY "Allow public read access to hpv_vaccinations" ON public.hpv_vaccinations FOR SELECT USING (true);
CREATE POLICY "Allow service role full access to screening_records" ON public.screening_records FOR ALL USING (true);
CREATE POLICY "Allow public read access to screening_records" ON public.screening_records FOR SELECT USING (true);
CREATE POLICY "Allow service role full access to admin_hospitals" ON public.admin_hospitals FOR ALL USING (true);
CREATE POLICY "Allow public read access to admin_hospitals" ON public.admin_hospitals FOR SELECT USING (true);


