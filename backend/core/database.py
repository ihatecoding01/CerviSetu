"""Encrypted SQLite database persistence layer for clinical cases and patient tracking."""
import json
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from backend.config import DB_PATH


# region_code marking generated demo patients; kept out of every real clinical queue
SYNTHETIC_REGION = "SYNTHETIC_ABDM"

class ClinicalDatabase:
    """Database interface for clinical intake, referrals, image logs and audit support."""

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = str(db_path or DB_PATH)
        self._init_schema()

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
                    school_or_center TEXT DEFAULT '',
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
            # Patient-level rows set plan_id; facility-wide downtime rows set facility_name with plan_id ''

            # 9. External AI result cache and usage log (see backend/core/ai_usage.py).
            # Cache keys are hashes; values are validated, de-identified results only.
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ai_cache (
                    cache_key TEXT PRIMARY KEY,
                    feature TEXT NOT NULL,
                    value_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TEXT NOT NULL
                )
            """)
            # No request/response content is ever stored here: metadata and provider usage counters only
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ai_usage_log (
                    usage_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    feature TEXT NOT NULL,
                    api TEXT NOT NULL,
                    model TEXT,
                    requested_at TEXT NOT NULL,
                    success INTEGER NOT NULL,
                    cache_hit INTEGER NOT NULL DEFAULT 0,
                    duration_ms INTEGER,
                    input_tokens INTEGER,
                    output_tokens INTEGER,
                    audio_seconds REAL,
                    characters INTEGER,
                    pages INTEGER,
                    error_category TEXT
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



    def get_all_cases(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT c.*, p.age, p.gender, p.region_code 
                FROM clinical_cases c
                JOIN patients p ON c.patient_token = p.patient_token
                WHERE COALESCE(p.region_code, '') != ?
                ORDER BY c.created_at DESC LIMIT ?
            """, (SYNTHETIC_REGION, limit))
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
    # Patient Flow Operations
    # ==========================================







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
        school_or_center: str = "",
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
    # ==========================================



    # ==========================================
    # ==========================================













    def is_synthetic_patient(self, patient_token: str) -> bool:
        with self._get_conn() as conn:
            row = conn.execute("SELECT region_code FROM patients WHERE patient_token = ?", (patient_token,)).fetchone()
        return bool(row) and row["region_code"] == SYNTHETIC_REGION









    def get_latest_case_record(self, patient_token: str) -> Optional[Dict[str, Any]]:
        """Latest case with its stored intake and diagnostic JSON decoded."""
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM clinical_cases WHERE patient_token = ? ORDER BY created_at DESC LIMIT 1", (patient_token,)
            ).fetchone()
        if not row:
            return None
        d = dict(row)
        d["intake_data"] = json.loads(d["intake_json"]) if d.get("intake_json") else {}
        d["diagnostic_data"] = json.loads(d["diagnostic_json"]) if d.get("diagnostic_json") else {}
        return d

    def update_case_diagnostic(self, case_id: str, diagnostic_data: Dict[str, Any]):
        with self._get_conn() as conn:
            conn.execute("UPDATE clinical_cases SET diagnostic_json = ? WHERE case_id = ?",
                         (json.dumps(diagnostic_data, ensure_ascii=False), case_id))
            conn.commit()

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



global_db = ClinicalDatabase()
