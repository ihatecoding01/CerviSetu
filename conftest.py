import os
import sys
from pathlib import Path

import tempfile

# Keep the suite offline and deterministic; LLM tests inject a fake client instead.
# Forced (not setdefault) and the key blanked so no shell or .env setting can make tests spend credits.
os.environ["CERVISETU_DISABLE_LLM"] = "1"
os.environ["SARVAM_API_KEY"] = ""
os.environ["CERVISETU_OCR_ENABLED"] = "0"
os.environ.setdefault("CERVISETU_DISABLE_SCHEDULER", "1")
# Never write test patients into the demo database, vault or audit ledger
os.environ.setdefault("CERVISETU_DATA_DIR", tempfile.mkdtemp(prefix="cervisetu-test-"))

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _fresh_ai_cache():
    """Each test starts with an empty AI result cache and usage log."""
    from backend.core.database import global_db
    with global_db._get_conn() as conn:
        conn.execute("DELETE FROM ai_cache")
        conn.execute("DELETE FROM ai_usage_log")
        conn.commit()
    yield
