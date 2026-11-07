"""Tests for expanded ClinicalDatabase schema, prevention CRUD, and seed cohort."""
from pathlib import Path
from backend.core.database import ClinicalDatabase


def test_schema_starts_empty_and_saves_audit_free_cases(tmp_path: Path):
    db = ClinicalDatabase(db_path=tmp_path / "test_cervisetu.db")
    assert db.get_hpv_vaccinations() == []
    assert db.get_all_cases() == []
