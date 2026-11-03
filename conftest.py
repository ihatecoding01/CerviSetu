import os
import sys
from pathlib import Path

# Keep the suite offline and deterministic; LLM tests inject a fake client instead
os.environ.setdefault("CERVISETU_DISABLE_LLM", "1")

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
