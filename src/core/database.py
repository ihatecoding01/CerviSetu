"""Encrypted SQLite database persistence layer for clinical cases and patient tracking."""
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from src.config import DB_PATH


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

            return {
                "patient_token": patient_token,
                "cases": cases,
                "scans": scans,
                "trackers": trackers,
                "notifications": notifs
            }


global_db = ClinicalDatabase()
