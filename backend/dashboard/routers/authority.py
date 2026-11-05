"""Review queue for district authority escalation."""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse

from backend.tools import authority_cases as ac

router = APIRouter(prefix="/api/authority", tags=["District Authority Escalation"])


def _actor(request: Request) -> str:
    staff = getattr(request.state, "staff", None)
    return staff["staff_id"] if staff else "UNAUTHENTICATED_TEST"


def _guard(fn, *args):
    try:
        return fn(*args)
    except ac.CaseError as e:
        raise HTTPException(status_code=e.status, detail=e.message)


@router.get("/cases")
async def cases():
    return {"cases": ac.list_cases()}


@router.post("/cases/{case_id}/approve")
async def approve(case_id: str, request: Request):
    return _guard(ac.approve, case_id, _actor(request))


@router.post("/cases/{case_id}/decline")
async def decline(case_id: str, request: Request):
    return _guard(ac.decline, case_id, _actor(request))


@router.post("/cases/{case_id}/mark-sent")
async def mark_sent(case_id: str, request: Request):
    return _guard(ac.mark_sent, case_id, _actor(request))


@router.get("/cases/{case_id}/dossier", response_class=HTMLResponse)
async def dossier(case_id: str, request: Request):
    return HTMLResponse(_guard(ac.dossier_html, case_id, _actor(request)), headers={"Cache-Control": "no-store"})
