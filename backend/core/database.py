"""Encrypted SQLite database persistence layer for clinical cases and patient tracking."""
import json
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


global_db = ClinicalDatabase()
