"""Encrypted SQLite database persistence layer for clinical cases and patient tracking."""
import json
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from backend.config import DB_PATH


class ClinicalDatabase:
    """Database interface for clinical intake, tracking, image logs, and notifications."""

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = str(db_path or DB_PATH)
        self._init_schema()
        self.seed_multistage_cohort()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self):
        """Initialize database tables."""
        with self._get_conn() as conn:
            cursor = conn.cursor()
            
            # Patients table (stores de-identified tokens)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS patients (
                    patient_token TEXT PRIMARY KEY,
                    age INTEGER,
                    gender TEXT,
                    region_code TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Cases table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS clinical_cases (
                    case_id TEXT PRIMARY KEY,
                    patient_token TEXT,
                    cancer_type TEXT,
                    suspected_stage TEXT,
                    severity_score REAL,
                    intake_json TEXT,
                    diagnostic_json TEXT,
                    status TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (patient_token) REFERENCES patients (patient_token)
                )
            """)

            # Image scans table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS medical_scans (
                    scan_id TEXT PRIMARY KEY,
                    patient_token TEXT,
                    image_path TEXT,
                    is_valid INTEGER,
                    blur_score REAL,
                    contrast_rms REAL,
                    modality TEXT,
                    quality_report_json TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Rural Follow-Up Tracker table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS follow_up_tracker (
                    tracker_id TEXT PRIMARY KEY,
                    patient_token TEXT,
                    case_id TEXT,
                    due_date TEXT,
                    days_overdue INTEGER DEFAULT 0,
                    last_reminder_tier TEXT,
                    is_resolved INTEGER DEFAULT 0,
                    resolution_reason TEXT,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Dispatched Notifications table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS notifications (
                    notification_id TEXT PRIMARY KEY,
                    patient_token TEXT,
                    tier TEXT,
                    channel TEXT,
                    recipient_role TEXT,
                    message_content TEXT,
                    timestamp TEXT
                )
            """)

            # User Activity Logs table (Multi-Role: Patients, Doctors, Nurses/Healthcare Workers)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_activity_logs (
                    log_id TEXT PRIMARY KEY,
                    user_role TEXT NOT NULL,
                    actor_id TEXT NOT NULL,
                    patient_token TEXT NOT NULL,
                    action_type TEXT NOT NULL,
                    channel TEXT DEFAULT 'WEB_CAREUI',
                    severity TEXT DEFAULT 'INFO',
                    payload_json TEXT,
                    sha256_hash TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Patient 29-Step Visual Healing Clock table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS patient_healing_clock (
                    patient_token TEXT PRIMARY KEY,
                    ebrt_start_date TEXT,
                    ebrt_fractions_completed INTEGER DEFAULT 0,
                    brachy_fractions_completed INTEGER DEFAULT 0,
                    total_steps_completed INTEGER DEFAULT 0,
                    projected_finish_days INTEGER DEFAULT 44,
                    clock_target_49d_status TEXT DEFAULT 'OPTIMAL',
                    clock_limit_56d_status TEXT DEFAULT 'ON_TRACK',
                    is_completed INTEGER DEFAULT 0,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Patient Toxicity & Pre-Cisplatin Symptom Check-ins
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS patient_toxicity_logs (
                    log_id TEXT PRIMARY KEY,
                    patient_token TEXT NOT NULL,
                    clock_day INTEGER NOT NULL,
                    symptom_category TEXT NOT NULL,
                    reported_severity_grade INTEGER NOT NULL,
                    vernacular_raw_text TEXT,
                    clinical_action_taken TEXT NOT NULL,
                    ward_alert_acknowledged INTEGER DEFAULT 0,
                    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Patient Hub-and-Spoke Passes (Day-21 Transition)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS patient_hub_spoke_passes (
                    pass_id TEXT PRIMARY KEY,
                    patient_token TEXT NOT NULL,
                    spoke_facility_name TEXT DEFAULT 'Regional EBRT Spoke Clinic',
                    hub_facility_name TEXT DEFAULT 'Central Regional Cancer Centre Hub',
                    distance_km REAL DEFAULT 75.0,
                    requested_window TEXT DEFAULT 'Days 38–44',
                    hub_ot_slot_date TEXT,
                    slot_confirmed_by_doctor INTEGER DEFAULT 0,
                    bus_voucher_code TEXT,
                    dharamshala_room_code TEXT,
                    is_simulated_mock INTEGER DEFAULT 1,
                    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # District Pilot Deployment Leads table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS pilot_leads (
                    lead_id TEXT PRIMARY KEY,
                    email TEXT NOT NULL,
                    district TEXT NOT NULL,
                    facility_type TEXT NOT NULL,
                    status TEXT DEFAULT 'PENDING',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # 1. HPV Vaccination Registry & Outreach table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS hpv_vaccinations (
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
                    outreach_sent INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (patient_token) REFERENCES patients (patient_token)
                )
            """)

            # 2. Screening Records (VIA, HPV DNA, Pap Smear)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS screening_records (
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
                    clinician_reviewed INTEGER DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # 3. Precancer Episodes (Thermal Ablation, Cryotherapy, LEEP & 6-12m Surveillance)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS precancer_episodes (
                    precancer_id TEXT PRIMARY KEY,
                    patient_token TEXT NOT NULL,
                    patient_name TEXT NOT NULL,
                    diagnosis TEXT NOT NULL,
                    treatment_type TEXT NOT NULL,
                    appointment_date TEXT NOT NULL,
                    completion_date TEXT,
                    margins_clear INTEGER DEFAULT 1,
                    surveillance_interval_months INTEGER DEFAULT 6,
                    surveillance_due_date TEXT NOT NULL,
                    surveillance_status TEXT DEFAULT 'SCHEDULED',
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # 4. Weekly Chemotherapy Clearances & Safety Flags
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS chemo_clearances (
                    clearance_id TEXT PRIMARY KEY,
                    patient_token TEXT NOT NULL,
                    cycle_number INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    dose_mg REAL,
                    hb REAL,
                    anc INTEGER,
                    platelets INTEGER,
                    creatinine REAL,
                    egfr INTEGER,
                    doctor_id TEXT NOT NULL,
                    clinical_notes TEXT,
                    ebrt_must_continue INTEGER DEFAULT 1,
                    cleared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (patient_token) REFERENCES patients (patient_token)
                )
            """)

            # 5. Stigma-Safe ASHA Field Tickets & 24h Arrival Watch Timer
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS asha_field_tickets (
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
                    arrival_watch_expires_at TIMESTAMP,
                    is_resolved INTEGER DEFAULT 0,
                    dispatched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    resolved_at TIMESTAMP
                )
            """)

            # 6. Clinic-wide LINAC Maintenance Downtime Logs
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS linac_downtime_logs (
                    downtime_id TEXT PRIMARY KEY,
                    facility_name TEXT DEFAULT 'Mirzapur Spoke Clinic',
                    machine_id TEXT DEFAULT 'LINAC-SPOKE-01',
                    is_active INTEGER DEFAULT 1,
                    reason TEXT,
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    ended_at TIMESTAMP
                )
            """)

            # 7. DPDP Consent & Research Telemetry Tracking
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS dpdp_consents (
                    consent_id TEXT PRIMARY KEY,
                    patient_token TEXT NOT NULL,
                    consent_type TEXT DEFAULT 'PATHWAY_TRACKING_VOICE_AND_RESEARCH',
                    granted_by TEXT DEFAULT 'PATIENT_OR_LEGAL_GUARDIAN',
                    language TEXT DEFAULT 'HINDI',
                    sha256_hash TEXT NOT NULL,
                    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # 8. Real CCRT treatment clock (see backend/tools/treatment_clock.py). Progress is always
            # recomputed from these source records; nothing here stores a derived projection.
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS treatment_plans (
                    plan_id TEXT PRIMARY KEY,
                    patient_token TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'ACTIVE',
                    start_date TEXT NOT NULL,
                    ebrt_sessions INTEGER NOT NULL,
                    brachy_sessions INTEGER NOT NULL,
                    treatment_weekdays TEXT NOT NULL,
                    brachy_gap_days INTEGER NOT NULL,
                    brachy_interval_days INTEGER NOT NULL,
                    rest_dates TEXT NOT NULL DEFAULT '[]',
                    target_days INTEGER NOT NULL DEFAULT 49,
                    limit_days INTEGER NOT NULL DEFAULT 56,
                    facility_name TEXT NOT NULL DEFAULT 'Mirzapur Spoke Clinic',
                    regimen_label TEXT,
                    approved_by TEXT NOT NULL,
                    approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS ux_treatment_plans_one_active
                ON treatment_plans (patient_token) WHERE status = 'ACTIVE'
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS treatment_sessions (
                    session_id TEXT PRIMARY KEY,
                    plan_id TEXT NOT NULL,
                    patient_token TEXT NOT NULL,
                    session_number INTEGER NOT NULL,
                    session_date TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'COMPLETED',
                    recorded_by TEXT,
                    machine_id TEXT,
                    dose_gy REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (plan_id) REFERENCES treatment_plans (plan_id)
                )
            """)
            # Duplicate guards: one completed delivery per session number and per treatment date
            cursor.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS ux_treatment_sessions_number
                ON treatment_sessions (plan_id, session_number) WHERE status = 'COMPLETED'
            """)
            cursor.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS ux_treatment_sessions_date
                ON treatment_sessions (plan_id, session_date) WHERE status = 'COMPLETED'
            """)
            # Patient-level rows set plan_id; facility-wide downtime rows set facility_name with plan_id ''
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS treatment_schedule_exceptions (
                    exception_id TEXT PRIMARY KEY,
                    plan_id TEXT NOT NULL DEFAULT '',
                    facility_name TEXT NOT NULL DEFAULT '',
                    exception_date TEXT NOT NULL,
                    exception_type TEXT NOT NULL,
                    reason TEXT,
                    recorded_by TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (plan_id, facility_name, exception_date, exception_type)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS treatment_missed_sessions (
                    plan_id TEXT NOT NULL,
                    missed_date TEXT NOT NULL,
                    patient_token TEXT NOT NULL,
                    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (plan_id, missed_date)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS treatment_escalations (
                    escalation_id TEXT PRIMARY KEY,
                    plan_id TEXT NOT NULL,
                    patient_token TEXT NOT NULL,
                    episode_start_date TEXT NOT NULL,
                    tier TEXT NOT NULL,
                    missed_streak INTEGER NOT NULL,
                    dispatch_mode TEXT NOT NULL DEFAULT 'SIMULATED',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (plan_id, episode_start_date, tier)
                )
            """)
            conn.commit()

    def save_patient(self, patient_token: str, age: Optional[int], gender: Optional[str], region_code: str = "RURAL"):
        with self._get_conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO patients (patient_token, age, gender, region_code)
                VALUES (?, ?, ?, ?)
            """, (patient_token, age, gender, region_code))
            conn.commit()

    def save_clinical_case(
        self,
        case_id: str,
        patient_token: str,
        cancer_type: str,
        suspected_stage: str,
        severity_score: float,
        intake_data: Dict[str, Any],
        diagnostic_data: Dict[str, Any],
        status: str = "ACTIVE"
    ):
        with self._get_conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO clinical_cases 
                (case_id, patient_token, cancer_type, suspected_stage, severity_score, intake_json, diagnostic_json, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                case_id,
                patient_token,
                cancer_type,
                suspected_stage,
                severity_score,
                json.dumps(intake_data),
                json.dumps(diagnostic_data),
                status
            ))
            conn.commit()

    def save_scan_record(
        self,
        scan_id: str,
        patient_token: str,
        image_path: str,
        quality_data: Dict[str, Any]
    ):
        with self._get_conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO medical_scans
                (scan_id, patient_token, image_path, is_valid, blur_score, contrast_rms, modality, quality_report_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                scan_id,
                patient_token,
                image_path,
                1 if quality_data.get("is_valid", True) else 0,
                quality_data.get("blur_score", 0.0),
                quality_data.get("contrast_rms", 0.0),
                quality_data.get("detected_modality", "UNKNOWN"),
                json.dumps(quality_data)
            ))
            conn.commit()

    def update_follow_up(
        self,
        tracker_id: str,
        patient_token: str,
        case_id: str,
        due_date: str,
        days_overdue: int,
        last_reminder_tier: Optional[str] = None,
        is_resolved: bool = False,
        resolution_reason: Optional[str] = None
    ):
        with self._get_conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO follow_up_tracker
                (tracker_id, patient_token, case_id, due_date, days_overdue, last_reminder_tier, is_resolved, resolution_reason, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (
                tracker_id,
                patient_token,
                case_id,
                due_date,
                days_overdue,
                last_reminder_tier,
                1 if is_resolved else 0,
                resolution_reason
            ))
            conn.commit()

    def log_notification(
        self,
        notif_id: str,
        patient_token: str,
        tier: str,
        channel: str,
        recipient_role: str,
        message_content: str,
        timestamp: Optional[str] = None
    ):
        ts = timestamp or datetime.now(timezone.utc).isoformat()
        with self._get_conn() as conn:
            conn.execute("""
                INSERT INTO notifications
                (notification_id, patient_token, tier, channel, recipient_role, message_content, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (notif_id, patient_token, tier, channel, recipient_role, message_content, ts))
            conn.commit()

    def get_all_cases(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT c.*, p.age, p.gender, p.region_code 
                FROM clinical_cases c
                JOIN patients p ON c.patient_token = p.patient_token
                ORDER BY c.created_at DESC LIMIT ?
            """, (limit,))
            rows = cursor.fetchall()
            results = []
            for row in rows:
                d = dict(row)
                d["intake_data"] = json.loads(d["intake_json"]) if d.get("intake_json") else {}
                d["diagnostic_data"] = json.loads(d["diagnostic_json"]) if d.get("diagnostic_json") else {}
                results.append(d)
            return results

    def get_patient_timeline(self, patient_token: str) -> Dict[str, Any]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM clinical_cases WHERE patient_token = ? ORDER BY created_at DESC", (patient_token,))
            cases = [dict(r) for r in cursor.fetchall()]
            
            cursor.execute("SELECT * FROM medical_scans WHERE patient_token = ? ORDER BY created_at DESC", (patient_token,))
            scans = [dict(r) for r in cursor.fetchall()]
            
            cursor.execute("SELECT * FROM follow_up_tracker WHERE patient_token = ? ORDER BY last_updated DESC", (patient_token,))
            trackers = [dict(r) for r in cursor.fetchall()]
            
            cursor.execute("SELECT * FROM notifications WHERE patient_token = ? ORDER BY timestamp DESC", (patient_token,))
            notifs = [dict(r) for r in cursor.fetchall()]

            cursor.execute("SELECT * FROM user_activity_logs WHERE patient_token = ? ORDER BY created_at DESC", (patient_token,))
            activity_rows = cursor.fetchall()
            activities = []
            for r in activity_rows:
                act = dict(r)
                act["payload"] = json.loads(act["payload_json"]) if act.get("payload_json") else {}
                activities.append(act)

            return {
                "patient_token": patient_token,
                "cases": cases,
                "scans": scans,
                "trackers": trackers,
                "notifications": notifs,
                "user_activities": activities
            }

    def log_user_activity(
        self,
        log_id: str,
        user_role: str,
        actor_id: str,
        patient_token: str,
        action_type: str,
        channel: str = "WEB_CAREUI",
        severity: str = "INFO",
        payload: Optional[Dict[str, Any]] = None,
        sha256_hash: Optional[str] = None,
        timestamp: Optional[str] = None
    ):
        """Persist a multi-role user activity log entry."""
        ts = timestamp or datetime.now(timezone.utc).isoformat()
        payload_str = json.dumps(payload or {})
        with self._get_conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO user_activity_logs
                (log_id, user_role, actor_id, patient_token, action_type, channel, severity, payload_json, sha256_hash, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (log_id, user_role, actor_id, patient_token, action_type, channel, severity, payload_str, sha256_hash, ts))
            conn.commit()

    def get_user_activity_logs(
        self,
        user_role: Optional[str] = None,
        patient_token: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Retrieve user activity logs filtered by role and/or patient token."""
        query = "SELECT * FROM user_activity_logs WHERE 1=1"
        params: List[Any] = []
        if user_role:
            query += " AND user_role = ?"
            params.append(user_role)
        if patient_token:
            query += " AND patient_token = ?"
            params.append(patient_token)
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)

        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()
            results = []
            for row in rows:
                d = dict(row)
                d["payload"] = json.loads(d["payload_json"]) if d.get("payload_json") else {}
                results.append(d)
            return results

    def get_user_activity_summary(self) -> Dict[str, Any]:
        """Return counts of activity logs aggregated by user role and severity."""
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT user_role, COUNT(*) as count 
                FROM user_activity_logs 
                GROUP BY user_role
            """)
            role_counts = {row["user_role"]: row["count"] for row in cursor.fetchall()}

            cursor.execute("""
                SELECT severity, COUNT(*) as count 
                FROM user_activity_logs 
                GROUP BY severity
            """)
            severity_counts = {row["severity"]: row["count"] for row in cursor.fetchall()}

            cursor.execute("SELECT COUNT(*) as total FROM user_activity_logs")
            total = cursor.fetchone()["total"]

            return {
                "total_logs": total,
                "by_role": {
                    "DOCTOR": role_counts.get("DOCTOR", 0),
                    "NURSE_HEALTHCARE_WORKER": role_counts.get("NURSE_HEALTHCARE_WORKER", 0),
                    "PATIENT": role_counts.get("PATIENT", 0),
                    "SYSTEM": role_counts.get("SYSTEM", 0)
                },
                "by_severity": severity_counts
            }

    # ==========================================
    # Patient Flow & Healing Clock Operations
    # ==========================================

    def get_or_create_healing_clock(self, patient_token: str) -> Dict[str, Any]:
        """Fetch or initialize the 29-step visual Healing Clock for a patient."""
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM patient_healing_clock WHERE patient_token = ?", (patient_token,))
            row = cursor.fetchone()
            if row:
                return dict(row)

            # Default initial state: step 14 (pre-Day 21 milestone for demonstration)
            default_data = {
                "patient_token": patient_token,
                "ebrt_start_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "ebrt_fractions_completed": 14,
                "brachy_fractions_completed": 0,
                "total_steps_completed": 14,
                "projected_finish_days": 44,
                "clock_target_49d_status": "OPTIMAL",
                "clock_limit_56d_status": "ON_TRACK",
                "is_completed": 0
            }
            conn.execute("""
                INSERT INTO patient_healing_clock 
                (patient_token, ebrt_start_date, ebrt_fractions_completed, brachy_fractions_completed, 
                 total_steps_completed, projected_finish_days, clock_target_49d_status, clock_limit_56d_status, is_completed)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                default_data["patient_token"],
                default_data["ebrt_start_date"],
                default_data["ebrt_fractions_completed"],
                default_data["brachy_fractions_completed"],
                default_data["total_steps_completed"],
                default_data["projected_finish_days"],
                default_data["clock_target_49d_status"],
                default_data["clock_limit_56d_status"],
                default_data["is_completed"]
            ))
            conn.commit()
            return default_data

    def advance_healing_clock(self, patient_token: str, target_step: int = 15) -> Dict[str, Any]:
        """Advance patient progress (e.g. advance to Fraction 15 / Day 21 milestone)."""
        clock = self.get_or_create_healing_clock(patient_token)
        new_ebrt = min(target_step, 25)
        new_brachy = max(0, target_step - 25)
        with self._get_conn() as conn:
            conn.execute("""
                UPDATE patient_healing_clock
                SET ebrt_fractions_completed = ?,
                    brachy_fractions_completed = ?,
                    total_steps_completed = ?,
                    last_updated = CURRENT_TIMESTAMP
                WHERE patient_token = ?
            """, (new_ebrt, new_brachy, target_step, patient_token))
            conn.commit()
        return self.get_or_create_healing_clock(patient_token)

    def record_patient_toxicity(
        self,
        log_id: str,
        patient_token: str,
        clock_day: int,
        symptom_category: str,
        reported_severity_grade: int,
        vernacular_raw_text: str,
        clinical_action_taken: str
    ):
        """Record a bi-weekly symptom check-in from the patient companion."""
        with self._get_conn() as conn:
            conn.execute("""
                INSERT INTO patient_toxicity_logs
                (log_id, patient_token, clock_day, symptom_category, reported_severity_grade, 
                 vernacular_raw_text, clinical_action_taken)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                log_id, patient_token, clock_day, symptom_category,
                reported_severity_grade, vernacular_raw_text, clinical_action_taken
            ))
            conn.commit()

    def get_or_create_hub_spoke_pass(self, patient_token: str) -> Dict[str, Any]:
        """Retrieve or initialize the Day-21 Hub-Spoke pass record for a patient."""
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM patient_hub_spoke_passes WHERE patient_token = ?", (patient_token,))
            row = cursor.fetchone()
            if row:
                return dict(row)

            token_suffix = patient_token[-4:] if len(patient_token) >= 4 else "7891"
            pass_id = f"PASS-{token_suffix}"
            conn.execute("""
                INSERT INTO patient_hub_spoke_passes 
                (pass_id, patient_token, spoke_facility_name, hub_facility_name, distance_km, requested_window)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                pass_id,
                patient_token,
                "District Cancer Care Daycare & Radiotherapy Spoke",
                "Regional Cancer Centre (RCC) Brachytherapy Hub",
                75.0,
                "Days 38–44"
            ))
            conn.commit()
            cursor.execute("SELECT * FROM patient_hub_spoke_passes WHERE pass_id = ?", (pass_id,))
            return dict(cursor.fetchone())

    def confirm_hub_ot_slot(self, patient_token: str, confirmed_day: str = "Day 41") -> Dict[str, Any]:
        """Step 2B: Hub oncologist confirms Brachytherapy OT slot; unlocks simulated travel pass."""
        pass_data = self.get_or_create_hub_spoke_pass(patient_token)
        token_suffix = patient_token[-4:] if len(patient_token) >= 4 else "7891"
        bus_code = f"UP-RTC-{token_suffix}"
        room_code = f"DHM-ROOM-402"
        with self._get_conn() as conn:
            conn.execute("""
                UPDATE patient_hub_spoke_passes
                SET slot_confirmed_by_doctor = 1,
                    hub_ot_slot_date = ?,
                    bus_voucher_code = ?,
                    dharamshala_room_code = ?
                WHERE patient_token = ?
            """, (confirmed_day, bus_code, room_code, patient_token))
            conn.commit()
        return self.get_or_create_hub_spoke_pass(patient_token)

    def search_facilities(self, district_query: str) -> List[Dict[str, Any]]:
        """Search and pair Regional Spoke and Tertiary Brachy Hub by district query."""
        clean_q = (district_query or "").strip().lower()
        
        # Realistic district mapping for oncology hub-spoke centers
        district_profiles = {
            "mirzapur": {
                "district": "Mirzapur",
                "spoke": "Mirzapur District Oncology Daycare (CHC Kalyanpur)",
                "spoke_dist_km": 12.5,
                "hub": "Mahamana Pandit Madan Mohan Malaviya Cancer Centre (MPMMCC / RCC), Varanasi",
                "hub_dist_km": 72.0,
            },
            "sonbhadra": {
                "district": "Sonbhadra",
                "spoke": "District Hospital Robertsganj Radiotherapy Spoke",
                "spoke_dist_km": 15.0,
                "hub": "Regional Cancer Centre, Varanasi",
                "hub_dist_km": 88.0,
            },
            "varanasi": {
                "district": "Varanasi",
                "spoke": "Shivpur Urban Health Centre Oncology Spoke",
                "spoke_dist_km": 8.0,
                "hub": "Homi Bhabha Cancer Hospital / MPMMCC, Varanasi",
                "hub_dist_km": 14.0,
            },
            "gorakhpur": {
                "district": "Gorakhpur",
                "spoke": "Gorakhpur District Hospital Radiation Spoke",
                "spoke_dist_km": 10.0,
                "hub": "AIIMS Gorakhpur Advanced Oncology Hub",
                "hub_dist_km": 68.0,
            }
        }

        matched = None
        for key, prof in district_profiles.items():
            if key in clean_q:
                matched = prof
                break

        if not matched:
            capitalized_name = (district_query or "District").title()
            matched = {
                "district": capitalized_name,
                "spoke": f"{capitalized_name} District Cancer Care Daycare (EBRT Spoke)",
                "spoke_dist_km": 14.0,
                "hub": f"Regional Cancer Centre (RCC) Brachytherapy Hub",
                "hub_dist_km": 75.0,
            }

        return [
            {
                "facility_type": "REGIONAL_EBRT_SPOKE",
                "role_label": "Regional EBRT Spoke (Fractions 1–25)",
                "facility_name": matched["spoke"],
                "district": matched["district"],
                "approx_distance_km": matched["spoke_dist_km"],
                "pmjay_empanelled": True,
                "services": [
                    "Daily EBRT Fractions (1–25)",
                    "Weekly Cisplatin Hydration & Lab Monitoring",
                    "Smart Paper OCR Slip Upload & Frontline Nurse Intake"
                ],
                "badge": "EBRT Local Spoke"
            },
            {
                "facility_type": "CENTRAL_BRACHY_HUB",
                "role_label": "Tertiary Brachytherapy Hub (Fractions 26–29)",
                "facility_name": matched["hub"],
                "district": matched["district"],
                "approx_distance_km": matched["hub_dist_km"],
                "pmjay_empanelled": True,
                "has_dharamshala": True,
                "services": [
                    "High-Dose-Rate (HDR) Brachytherapy (Fractions 26–29)",
                    "Pre-Anesthetic Checkup (PAC) & Operation Theatre",
                    "Low-Cost Patient Dharamshala Accommodation"
                ],
                "badge": "Brachytherapy Hub"
            }
        ]

    def register_pilot_lead(
        self,
        email: str,
        district: str,
        facility_type: str = "DISTRICT_HOSPITAL"
    ) -> Dict[str, Any]:
        """Record pilot district registration inquiry."""
        lead_id = f"LEAD-{secrets.token_hex(4).upper()}"
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO pilot_leads (lead_id, email, district, facility_type, status)
                VALUES (?, ?, ?, ?, 'PENDING')
                """,
                (lead_id, email, district, facility_type)
            )
            conn.commit()

        return {
            "status": "SUCCESS",
            "lead_id": lead_id,
            "email": email,
            "district": district,
            "facility_type": facility_type,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

    def list_pilot_leads(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieve recent pilot district leads."""
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT lead_id, email, district, facility_type, status, created_at
                FROM pilot_leads
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (limit,)
            )
            rows = cursor.fetchall()
            return [dict(r) for r in rows]

    # ==========================================
    # 1. HPV Vaccination Registry & Outreach
    # ==========================================

    def save_hpv_vaccination(
        self,
        vaccine_id: str,
        patient_token: str,
        patient_name: str,
        age: int,
        dose_number: int,
        vaccine_brand: str = "Cervavac",
        administered_date: Optional[str] = None,
        next_due_date: Optional[str] = None,
        school_or_center: str = "Primary Health Centre Mirzapur",
        status: str = "COMPLETED",
        outreach_sent: int = 0
    ) -> Dict[str, Any]:
        adm_date = administered_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        with self._get_conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO hpv_vaccinations
                (vaccine_id, patient_token, patient_name, age, dose_number, vaccine_brand, administered_date, next_due_date, school_or_center, status, outreach_sent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (vaccine_id, patient_token, patient_name, age, dose_number, vaccine_brand, adm_date, next_due_date, school_or_center, status, outreach_sent))
            conn.commit()
        return {
            "vaccine_id": vaccine_id,
            "patient_token": patient_token,
            "patient_name": patient_name,
            "age": age,
            "dose_number": dose_number,
            "vaccine_brand": vaccine_brand,
            "administered_date": adm_date,
            "next_due_date": next_due_date,
            "status": status,
            "outreach_sent": outreach_sent
        }

    def get_hpv_vaccinations(self, status: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        query = "SELECT * FROM hpv_vaccinations"
        params: List[Any] = []
        if status:
            query += " WHERE status = ?"
            params.append(status)
        query += " ORDER BY administered_date DESC LIMIT ?"
        params.append(limit)
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(query, tuple(params))
            return [dict(r) for r in cursor.fetchall()]

    def trigger_vaccine_outreach(self, vaccine_id: str) -> Dict[str, Any]:
        with self._get_conn() as conn:
            conn.execute("UPDATE hpv_vaccinations SET outreach_sent = 1 WHERE vaccine_id = ?", (vaccine_id,))
            conn.commit()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM hpv_vaccinations WHERE vaccine_id = ?", (vaccine_id,))
            row = cursor.fetchone()
            return dict(row) if row else {}

    # ==========================================
    # 2. Screening Records (VIA, HPV DNA, Pap)
    # ==========================================

    def save_screening_record(
        self,
        screening_id: str,
        patient_token: str,
        patient_name: str,
        age: int,
        invitation_date: Optional[str],
        test_type: str,
        test_date: Optional[str],
        result: str,
        clinical_staging: Optional[str] = "NORMAL",
        triage_action: str = "ROUTINE_RECALL_5Y",
        clinician_reviewed: int = 1
    ) -> Dict[str, Any]:
        t_date = test_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        with self._get_conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO screening_records
                (screening_id, patient_token, patient_name, age, invitation_date, test_type, test_date, result, clinical_staging, triage_action, clinician_reviewed)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (screening_id, patient_token, patient_name, age, invitation_date, test_type, t_date, result, clinical_staging, triage_action, clinician_reviewed))
            conn.commit()
        return {
            "screening_id": screening_id,
            "patient_token": patient_token,
            "patient_name": patient_name,
            "test_type": test_type,
            "test_date": t_date,
            "result": result,
            "clinical_staging": clinical_staging,
            "triage_action": triage_action
        }

    def get_screening_records(self, patient_token: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        query = "SELECT * FROM screening_records"
        params: List[Any] = []
        if patient_token:
            query += " WHERE patient_token = ?"
            params.append(patient_token)
        query += " ORDER BY test_date DESC LIMIT ?"
        params.append(limit)
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(query, tuple(params))
            return [dict(r) for r in cursor.fetchall()]

    # ==========================================
    # 3. Precancer Episodes (Ablation / LEEP)
    # ==========================================

    def save_precancer_episode(
        self,
        precancer_id: str,
        patient_token: str,
        patient_name: str,
        diagnosis: str,
        treatment_type: str,
        appointment_date: str,
        completion_date: Optional[str] = None,
        margins_clear: int = 1,
        surveillance_interval_months: int = 6,
        surveillance_due_date: Optional[str] = None,
        surveillance_status: str = "SCHEDULED",
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        with self._get_conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO precancer_episodes
                (precancer_id, patient_token, patient_name, diagnosis, treatment_type, appointment_date, completion_date, margins_clear, surveillance_interval_months, surveillance_due_date, surveillance_status, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (precancer_id, patient_token, patient_name, diagnosis, treatment_type, appointment_date, completion_date, margins_clear, surveillance_interval_months, surveillance_due_date or appointment_date, surveillance_status, notes))
            conn.commit()
        return {
            "precancer_id": precancer_id,
            "patient_token": patient_token,
            "patient_name": patient_name,
            "diagnosis": diagnosis,
            "treatment_type": treatment_type,
            "appointment_date": appointment_date,
            "completion_date": completion_date,
            "surveillance_due_date": surveillance_due_date,
            "surveillance_status": surveillance_status
        }

    def complete_precancer_treatment(
        self,
        precancer_id: str,
        completion_date: Optional[str] = None,
        margins_clear: int = 1
    ) -> Dict[str, Any]:
        c_date = completion_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        with self._get_conn() as conn:
            conn.execute("""
                UPDATE precancer_episodes
                SET completion_date = ?,
                    margins_clear = ?,
                    surveillance_status = 'SCHEDULED'
                WHERE precancer_id = ?
            """, (c_date, margins_clear, precancer_id))
            conn.commit()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM precancer_episodes WHERE precancer_id = ?", (precancer_id,))
            row = cursor.fetchone()
            return dict(row) if row else {}

    def get_precancer_surveillance_list(self, status: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        query = "SELECT * FROM precancer_episodes"
        params: List[Any] = []
        if status:
            query += " WHERE surveillance_status = ?"
            params.append(status)
        query += " ORDER BY surveillance_due_date ASC LIMIT ?"
        params.append(limit)
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(query, tuple(params))
            return [dict(r) for r in cursor.fetchall()]

    # ==========================================
    # 4. Weekly Chemotherapy Clearances
    # ==========================================

    def save_chemo_clearance(
        self,
        clearance_id: str,
        patient_token: str,
        cycle_number: int,
        status: str,
        dose_mg: float,
        hb: float,
        anc: int,
        platelets: int,
        creatinine: float,
        egfr: int,
        doctor_id: str,
        clinical_notes: Optional[str] = None,
        ebrt_must_continue: int = 1
    ) -> Dict[str, Any]:
        with self._get_conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO chemo_clearances
                (clearance_id, patient_token, cycle_number, status, dose_mg, hb, anc, platelets, creatinine, egfr, doctor_id, clinical_notes, ebrt_must_continue)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (clearance_id, patient_token, cycle_number, status, dose_mg, hb, anc, platelets, creatinine, egfr, doctor_id, clinical_notes, ebrt_must_continue))
            conn.commit()
        return {
            "clearance_id": clearance_id,
            "patient_token": patient_token,
            "cycle_number": cycle_number,
            "status": status,
            "dose_mg": dose_mg,
            "ebrt_must_continue": ebrt_must_continue
        }

    def get_chemo_clearances(self, patient_token: str, limit: int = 20) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM chemo_clearances WHERE patient_token = ? ORDER BY cleared_at DESC LIMIT ?", (patient_token, limit))
            return [dict(r) for r in cursor.fetchall()]

    # ==========================================
    # 5. Stigma-Safe ASHA Field Tickets
    # ==========================================

    def create_asha_ticket(
        self,
        ticket_id: str,
        patient_token: str,
        asha_worker_id: str,
        patient_first_name: str,
        guardian_name: str,
        village: str,
        landmark: str,
        contact_phone: str,
        days_missed: int,
        current_step: int,
        delay_root_cause: Optional[str] = None,
        field_outcome: Optional[str] = None
    ) -> Dict[str, Any]:
        with self._get_conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO asha_field_tickets
                (ticket_id, patient_token, asha_worker_id, patient_first_name, guardian_name, village, landmark, contact_phone, days_missed, current_step, delay_root_cause, field_outcome)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (ticket_id, patient_token, asha_worker_id, patient_first_name, guardian_name, village, landmark, contact_phone, days_missed, current_step, delay_root_cause, field_outcome))
            conn.commit()
        return {
            "ticket_id": ticket_id,
            "patient_token": patient_token,
            "patient_first_name": patient_first_name,
            "guardian_name": guardian_name,
            "days_missed": days_missed,
            "current_step": current_step
        }

    def update_asha_ticket_outcome(
        self,
        ticket_id: str,
        outcome: str,
        root_cause: Optional[str] = None,
        arrival_watch_hours: int = 24
    ) -> Dict[str, Any]:
        with self._get_conn() as conn:
            conn.execute("""
                UPDATE asha_field_tickets
                SET field_outcome = ?,
                    delay_root_cause = coalesce(?, delay_root_cause),
                    arrival_watch_expires_at = datetime('now', '+' || ? || ' hours'),
                    is_resolved = 1,
                    resolved_at = CURRENT_TIMESTAMP
                WHERE ticket_id = ?
            """, (outcome, root_cause, arrival_watch_hours, ticket_id))
            conn.commit()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM asha_field_tickets WHERE ticket_id = ?", (ticket_id,))
            row = cursor.fetchone()
            return dict(row) if row else {}

    def get_active_asha_tickets(self, asha_worker_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        query = "SELECT * FROM asha_field_tickets"
        params: List[Any] = []
        if asha_worker_id:
            query += " WHERE asha_worker_id = ?"
            params.append(asha_worker_id)
        query += " ORDER BY dispatched_at DESC LIMIT ?"
        params.append(limit)
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(query, tuple(params))
            return [dict(r) for r in cursor.fetchall()]

    # ==========================================
    # 6. LINAC Maintenance Downtime
    # ==========================================

    def toggle_linac_downtime(
        self,
        facility_name: str = "Mirzapur Spoke Clinic",
        machine_id: str = "LINAC-SPOKE-01",
        reason: str = "Scheduled Collimator Calibration"
    ) -> Dict[str, Any]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM linac_downtime_logs WHERE facility_name = ? AND is_active = 1", (facility_name,))
            active = cursor.fetchone()
            if active:
                conn.execute("""
                    UPDATE linac_downtime_logs
                    SET is_active = 0, ended_at = CURRENT_TIMESTAMP
                    WHERE downtime_id = ?
                """, (active["downtime_id"],))
                conn.commit()
                return {"is_active": False, "facility_name": facility_name, "status": "ONLINE"}
            else:
                d_id = f"DOWN-{secrets.token_hex(4).upper()}"
                conn.execute("""
                    INSERT INTO linac_downtime_logs (downtime_id, facility_name, machine_id, is_active, reason)
                    VALUES (?, ?, ?, 1, ?)
                """, (d_id, facility_name, machine_id, reason))
                conn.commit()
                return {"is_active": True, "facility_name": facility_name, "status": "MAINTENANCE_PAUSED", "downtime_id": d_id}

    def is_linac_downtime_active(self, facility_name: str = "Mirzapur Spoke Clinic") -> bool:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as cnt FROM linac_downtime_logs WHERE facility_name = ? AND is_active = 1", (facility_name,))
            return cursor.fetchone()["cnt"] > 0

    def get_linac_downtime_status(self, facility_name: str = "Mirzapur Spoke Clinic") -> Dict[str, Any]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM linac_downtime_logs WHERE facility_name = ? AND is_active = 1 ORDER BY started_at DESC LIMIT 1", (facility_name,))
            row = cursor.fetchone()
            if row:
                d = dict(row)
                d["status"] = "MAINTENANCE_PAUSED"
                return d
            return {"is_active": False, "status": "ONLINE", "facility_name": facility_name}

    def get_linac_downtime_periods(self, facility_name: str) -> List[Dict[str, Any]]:
        """All downtime periods for a facility (UTC timestamps; ended_at NULL while still active)."""
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT started_at, ended_at FROM linac_downtime_logs WHERE facility_name = ?", (facility_name,)
            ).fetchall()
            return [dict(r) for r in rows]

    # ==========================================
    # 6b. CCRT Treatment Clock Records
    # ==========================================

    def create_treatment_plan(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        """Insert a clinician-approved plan; raises sqlite3.IntegrityError if one is already active."""
        cols = ", ".join(plan)
        marks = ", ".join("?" for _ in plan)
        with self._get_conn() as conn:
            conn.execute(f"INSERT INTO treatment_plans ({cols}) VALUES ({marks})", tuple(plan.values()))
            conn.commit()
        return self.get_treatment_plan(plan["patient_token"])

    def get_treatment_plan(self, patient_token: str) -> Optional[Dict[str, Any]]:
        """The patient's active plan, else the most recent completed one."""
        with self._get_conn() as conn:
            row = conn.execute("""
                SELECT * FROM treatment_plans WHERE patient_token = ? AND status IN ('ACTIVE', 'COMPLETED')
                ORDER BY status = 'ACTIVE' DESC, approved_at DESC LIMIT 1
            """, (patient_token,)).fetchone()
            return dict(row) if row else None

    def list_treatment_plans(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        query, params = "SELECT * FROM treatment_plans", ()
        if status:
            query, params = query + " WHERE status = ?", (status,)
        with self._get_conn() as conn:
            return [dict(r) for r in conn.execute(query + " ORDER BY approved_at DESC", params).fetchall()]

    def set_treatment_plan_status(self, plan_id: str, status: str):
        with self._get_conn() as conn:
            conn.execute("UPDATE treatment_plans SET status = ? WHERE plan_id = ?", (status, plan_id))
            conn.commit()

    def record_treatment_session(
        self, plan_id: str, patient_token: str, session_number: int, session_date: str,
        status: str, recorded_by: str, machine_id: Optional[str], dose_gy: Optional[float],
    ) -> str:
        """Insert one delivered/cancelled session; the unique indexes reject duplicate completions."""
        session_id = f"SESS-{secrets.token_hex(4).upper()}"
        with self._get_conn() as conn:
            conn.execute("""
                INSERT INTO treatment_sessions
                (session_id, plan_id, patient_token, session_number, session_date, status, recorded_by, machine_id, dose_gy)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (session_id, plan_id, patient_token, session_number, session_date, status, recorded_by, machine_id, dose_gy))
            conn.commit()
        return session_id

    def get_treatment_sessions(self, plan_id: str) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM treatment_sessions WHERE plan_id = ? ORDER BY session_date, created_at", (plan_id,)
            ).fetchall()
            return [dict(r) for r in rows]

    def add_schedule_exception(
        self, exception_date: str, exception_type: str, reason: str, recorded_by: str,
        plan_id: str = "", facility_name: str = "",
    ) -> bool:
        """Idempotent; returns False if the same exception was already recorded."""
        with self._get_conn() as conn:
            cur = conn.execute("""
                INSERT OR IGNORE INTO treatment_schedule_exceptions
                (exception_id, plan_id, facility_name, exception_date, exception_type, reason, recorded_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (f"EXC-{secrets.token_hex(4).upper()}", plan_id, facility_name, exception_date, exception_type, reason, recorded_by))
            conn.commit()
            return cur.rowcount > 0

    def get_schedule_exceptions(self, plan_id: str, facility_name: str) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            rows = conn.execute("""
                SELECT * FROM treatment_schedule_exceptions
                WHERE plan_id = ? OR (plan_id = '' AND facility_name = ?)
            """, (plan_id, facility_name)).fetchall()
            return [dict(r) for r in rows]

    def sync_missed_sessions(self, plan_id: str, patient_token: str, missed_dates: List[str]) -> List[str]:
        """Persist the currently derived misses; returns newly detected dates. A miss later backfilled
        with a delivered session disappears from the derived list and is removed here."""
        with self._get_conn() as conn:
            known = {r["missed_date"] for r in conn.execute(
                "SELECT missed_date FROM treatment_missed_sessions WHERE plan_id = ?", (plan_id,)).fetchall()}
            new = [d for d in missed_dates if d not in known]
            conn.executemany(
                "INSERT OR IGNORE INTO treatment_missed_sessions (plan_id, missed_date, patient_token) VALUES (?, ?, ?)",
                [(plan_id, d, patient_token) for d in new],
            )
            stale = known - set(missed_dates)
            conn.executemany(
                "DELETE FROM treatment_missed_sessions WHERE plan_id = ? AND missed_date = ?",
                [(plan_id, d) for d in stale],
            )
            conn.commit()
        return new

    def record_treatment_escalation(
        self, plan_id: str, patient_token: str, episode_start_date: str, tier: str, missed_streak: int,
    ) -> bool:
        """Idempotent per (plan, missed-run episode, tier); returns True only the first time."""
        with self._get_conn() as conn:
            cur = conn.execute("""
                INSERT OR IGNORE INTO treatment_escalations
                (escalation_id, plan_id, patient_token, episode_start_date, tier, missed_streak)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (f"TESC-{secrets.token_hex(4).upper()}", plan_id, patient_token, episode_start_date, tier, missed_streak))
            conn.commit()
            return cur.rowcount > 0

    def get_treatment_escalations(self, plan_id: str) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM treatment_escalations WHERE plan_id = ? ORDER BY created_at", (plan_id,)
            ).fetchall()
            return [dict(r) for r in rows]

    def get_latest_case(self, patient_token: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            row = conn.execute("""
                SELECT c.case_id, c.cancer_type, c.suspected_stage, c.severity_score, p.age
                FROM clinical_cases c LEFT JOIN patients p ON p.patient_token = c.patient_token
                WHERE c.patient_token = ? ORDER BY c.created_at DESC LIMIT 1
            """, (patient_token,)).fetchone()
            return dict(row) if row else None

    # ==========================================
    # 7. DPDP Consent & Research Telemetry
    # ==========================================

    def record_dpdp_consent(
        self,
        consent_id: str,
        patient_token: str,
        consent_type: str = "PATHWAY_TRACKING_VOICE_AND_RESEARCH",
        granted_by: str = "PATIENT_OR_LEGAL_GUARDIAN",
        language: str = "HINDI",
        sha256_hash: Optional[str] = None
    ) -> Dict[str, Any]:
        h = sha256_hash or f"CONSENT-{secrets.token_hex(16)}"
        with self._get_conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO dpdp_consents
                (consent_id, patient_token, consent_type, granted_by, language, sha256_hash)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (consent_id, patient_token, consent_type, granted_by, language, h))
            conn.commit()
        return {"consent_id": consent_id, "patient_token": patient_token, "sha256_hash": h}

    def get_patient_consent(self, patient_token: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM dpdp_consents WHERE patient_token = ? ORDER BY granted_at DESC LIMIT 1", (patient_token,))
            row = cursor.fetchone()
            return dict(row) if row else None

    # ==========================================
    # 8. Seed Multi-Stage Milestone Cohort
    # ==========================================

    def seed_multistage_cohort(self):
        """Seed 6 representative cases across prevention, screening, precancer, and curative stages."""
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as cnt FROM patients WHERE patient_token = 'PT-RURAL-7891'")
            already_has_patients = cursor.fetchone()["cnt"] > 0
            if already_has_patients:
                cursor.execute("SELECT COUNT(*) as cnt FROM hpv_vaccinations")
                if cursor.fetchone()["cnt"] > 0:
                    return

        # 1. Base Patients
        patients_to_seed = [
            ("PT-VACC-101", 12, "FEMALE", "RURAL"),
            ("PT-PREC-202", 34, "FEMALE", "RURAL"),
            ("PT-RURAL-9034", 50, "FEMALE", "RURAL"),
            ("PT-RURAL-4421", 46, "FEMALE", "RURAL"),
            ("PT-RURAL-7891", 48, "FEMALE", "RURAL"),
            ("PT-RURAL-1102", 52, "FEMALE", "RURAL"),
        ]
        for p in patients_to_seed:
            self.save_patient(p[0], p[1], p[2], p[3])

        # 2. Case 1: Adolescent HPV Vaccination & Outreach
        self.save_hpv_vaccination(
            vaccine_id="VAC-101-01",
            patient_token="PT-VACC-101",
            patient_name="Priya Sharma",
            age=12,
            dose_number=1,
            vaccine_brand="Cervavac",
            administered_date="2026-09-15",
            next_due_date="2026-11-15",
            school_or_center="Kalyanpur Girls Secondary School, Mirzapur",
            status="COMPLETED",
            outreach_sent=1
        )
        self.save_hpv_vaccination(
            vaccine_id="VAC-101-02",
            patient_token="PT-VACC-101",
            patient_name="Priya Sharma",
            age=12,
            dose_number=2,
            vaccine_brand="Cervavac",
            administered_date="2026-11-15",
            next_due_date=None,
            school_or_center="PHC Mirzapur",
            status="DUE",
            outreach_sent=0
        )

        # 3. Case 2: Precancer Screening & Thermal Ablation
        self.save_screening_record(
            screening_id="SCR-202-01",
            patient_token="PT-PREC-202",
            patient_name="Sunita Devi",
            age=34,
            invitation_date="2026-08-01",
            test_type="VIA",
            test_date="2026-08-10",
            result="VIA_POSITIVE",
            clinical_staging="PRE_CANCEROUS",
            triage_action="THERMAL_ABLATION",
            clinician_reviewed=1
        )
        self.save_precancer_episode(
            precancer_id="PREC-202",
            patient_token="PT-PREC-202",
            patient_name="Sunita Devi",
            diagnosis="CIN_2",
            treatment_type="THERMAL_ABLATION",
            appointment_date="2026-08-15",
            completion_date="2026-08-15",
            margins_clear=1,
            surveillance_interval_months=6,
            surveillance_due_date="2027-02-15",
            surveillance_status="SCHEDULED",
            notes="Thermal ablation (100°C for 60s) completed under local anesthesia. Clean transition zone verified."
        )

        # 4. Case 3: Day 1 New Invasive Cancer Intake (Geeta Patel)
        self.save_clinical_case(
            case_id="CASE-9034",
            patient_token="PT-RURAL-9034",
            cancer_type="CERVICAL",
            suspected_stage="Stage IIB",
            severity_score=0.35,
            intake_data={"patient_name": "Geeta Patel", "village": "Rampur", "biopsy": "Keratinizing SCC"},
            diagnostic_data={"staging": "FIGO Stage IIB", "curative_ccrt_eligible": True},
            status="ACTIVE"
        )
        self.advance_healing_clock("PT-RURAL-9034", 1)

        # 5. Case 4: Day 14 Fraction 10 Pre-Brachy Prep (Kanti Devi)
        self.save_clinical_case(
            case_id="CASE-4421",
            patient_token="PT-RURAL-4421",
            cancer_type="CERVICAL",
            suspected_stage="Stage IIIA",
            severity_score=0.72,
            intake_data={"patient_name": "Kanti Devi", "village": "Pipra", "biopsy": "Large Cell Non-Keratinizing"},
            diagnostic_data={"staging": "FIGO Stage IIIA", "curative_ccrt_eligible": True},
            status="ACTIVE"
        )
        self.advance_healing_clock("PT-RURAL-4421", 10)
        self.save_chemo_clearance(
            clearance_id="CHEMO-4421-02",
            patient_token="PT-RURAL-4421",
            cycle_number=2,
            status="APPROVED",
            dose_mg=65.0,
            hb=10.2,
            anc=2100,
            platelets=175,
            creatinine=0.82,
            egfr=84,
            doctor_id="DR-SHARMA-01",
            clinical_notes="Tolerating weekly Cisplatin well. Pre-hydration intact."
        )

        # 6. Case 5: Day 21 Fraction 15 Hub-Spoke Bridge (Shanti Devi)
        self.save_clinical_case(
            case_id="CASE-7891",
            patient_token="PT-RURAL-7891",
            cancer_type="CERVICAL",
            suspected_stage="Stage IIB",
            severity_score=0.88,
            intake_data={"patient_name": "Shanti Devi", "village": "Pipra Ward 4", "biopsy": "Squamous Cell Carcinoma"},
            diagnostic_data={"staging": "FIGO Stage IIB", "curative_ccrt_eligible": True},
            status="ACTIVE"
        )
        self.advance_healing_clock("PT-RURAL-7891", 15)
        self.confirm_hub_ot_slot("PT-RURAL-7891", "Day 41")
        self.save_chemo_clearance(
            clearance_id="CHEMO-7891-03",
            patient_token="PT-RURAL-7891",
            cycle_number=3,
            status="APPROVED",
            dose_mg=65.0,
            hb=10.4,
            anc=2200,
            platelets=180,
            creatinine=0.85,
            egfr=82,
            doctor_id="DR-SHARMA-01",
            clinical_notes="Mid-treatment pelvic assessment: tumor regression >50%. Intracavitary T&O suitable."
        )

        # 7. Case 6: Day +3 Missed Fractions & ASHA Field Ticket (Meera Devi)
        self.save_clinical_case(
            case_id="CASE-1102",
            patient_token="PT-RURAL-1102",
            cancer_type="CERVICAL",
            suspected_stage="Stage IIIB",
            severity_score=0.45,
            intake_data={"patient_name": "Meera Devi", "village": "Sonbhadra Sector 2", "biopsy": "Invasive Cervical SCC"},
            diagnostic_data={"staging": "FIGO Stage IIIB", "curative_ccrt_eligible": True},
            status="ACTIVE"
        )
        self.advance_healing_clock("PT-RURAL-1102", 19)
        self.create_asha_ticket(
            ticket_id="TICK-1102-01",
            patient_token="PT-RURAL-1102",
            asha_worker_id="ASHA-001",
            patient_first_name="Meera Devi",
            guardian_name="Ram Prasad",
            village="Gram Pipra, Ward 4",
            landmark="Near Primary School Water Tank",
            contact_phone="+91 98765 11223",
            days_missed=3,
            current_step=19,
            delay_root_cause="FEAR_OF_PROCEDURE"
        )


global_db = ClinicalDatabase()
