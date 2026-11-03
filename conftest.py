import os
import sys
from pathlib import Path

import tempfile

# Keep the suite offline and deterministic; LLM tests inject a fake client instead
os.environ.setdefault("CERVISETU_DISABLE_LLM", "1")
os.environ.setdefault("CERVISETU_DISABLE_SCHEDULER", "1")
# Never write test patients into the demo database, vault or audit ledger
os.environ.setdefault("CERVISETU_DATA_DIR", tempfile.mkdtemp(prefix="cervisetu-test-"))

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
