"""District escalation must not expose personal details until a clinician approves."""
from fastapi.testclient import TestClient

from backend.core.security import global_vault
from backend.dashboard.app import app
from backend.tools import authority_cases as ac
from backend.tools.tracker_tools import EmergencyAuthorityEscalationTool as E

client = TestClient(app)


def _case(token):
    global_vault.store_pii(token, {"full_name": "Asha <Test>", "phone": "9000000001", "village": "Vindhya"})
    return ac.raise_case(token, "Cervical IIB", 5, "No response")


def test_dossier_locked_until_approved_then_audited():
    case = _case("PT-AUTH-1")
    url = f"/api/authority/cases/{case['case_id']}"
    assert client.get(f"{url}/dossier").status_code == 403
    assert client.post(f"{url}/mark-sent").status_code == 409
    assert client.post(f"{url}/approve").json()["status"] == ac.APPROVED
    page = client.get(f"{url}/dossier").text
    assert "Asha &lt;Test&gt;" in page and "9000000001" in page
    assert client.post(f"{url}/mark-sent").json()["status"] == ac.SENT
    assert client.post(f"{url}/decline").status_code == 409


def test_open_case_is_not_duplicated():
    first = _case("PT-AUTH-2")
    assert ac.raise_case("PT-AUTH-2", "x", 6, "y")["case_id"] == first["case_id"]


def test_alert_and_audit_do_not_carry_identity():
    global_vault.store_pii("PT-AUTH-3", {"full_name": "Secret Name", "full_address": "Secret Street"})
    notif, _ = E.generate_authority_escalation_dossier("PT-AUTH-3", "CERVICAL", "IIB", 9.0, 5)
    assert "Secret" not in notif.message_content
    from backend.core.security import global_audit
    assert "Secret" not in str(global_audit.get_events(limit=5))
