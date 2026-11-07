"""FastAPI Application Factory and Modular Router Assembler for CerviSetu."""
import asyncio
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.dashboard.routers import (
    facilities_router,
    patient_router,
    clinical_router,
    logs_router,
    prevention_router,
    showcase_router,
    abdm_router,
    portal_router,
    staff_router,
)
from backend.dashboard.routers.encounter_voice import router as encounter_voice_router
from backend.dashboard.routers.documents import router as documents_router
from backend.dashboard.routers.messages import router as messages_router
from backend.dashboard.routers.genie import router as genie_router
from backend.dashboard.routers.admin import router as admin_router
from backend.dashboard.routers.referrals import router as referrals_router
from backend.core import staff_session

@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Start the daily referral follow-up (off in the test suite)."""
    task = None
    if not os.getenv("CERVISETU_DISABLE_SCHEDULER") and "pytest" not in sys.modules:
        from backend.tools.referral_pathway import follow_up_loop, seed
        seed()
        task = asyncio.create_task(follow_up_loop())
    yield
    if task:
        task.cancel()


# Initialize FastAPI Application
app = FastAPI(
    lifespan=lifespan,
    title="CerviSetu - Cervical Referral Pathway",
    description="Cervical screening referral, follow-up and clinical record API.",
    version="2.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

@app.middleware("http")
async def staff_role_guard(request: Request, call_next):
    """Staff-only API routes need a signed staff session whose role is allowed (see staff_session.ROLE_RULES).

    Registered before CORS so CORS stays the outer layer and 401/403 replies still carry CORS headers.
    """
    path = request.url.path
    if request.method != "OPTIONS" and path.startswith("/api/") and staff_session.auth_enforced():
        roles = staff_session.required_roles(request.method, path)
        if roles:
            staff = staff_session.verify_session(request.cookies.get(staff_session.COOKIE_NAME))
            if not staff:
                return JSONResponse({"detail": {"code": "STAFF_SIGN_IN_REQUIRED",
                                                "message": "Please sign in as staff."}}, status_code=401)
            if staff["role"] not in roles:
                return JSONResponse({"detail": {"code": "ROLE_NOT_ALLOWED",
                                                "message": f"{staff['role_label']} accounts cannot do this."}},
                                    status_code=403)
            request.state.staff = staff
            response = await call_next(request)
            renewed = staff_session.renewed_cookie(request.cookies.get(staff_session.COOKIE_NAME))
            if renewed:
                staff_session.write_cookie(response, request, renewed)
            return response
    return await call_next(request)


# Configure Cross-Origin Resource Sharing (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://cervi-setu.pages.dev",
    ],
    allow_origin_regex=r"https://.*\.pages\.dev|https://.*\.trycloudflare\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Domain APIRouters
app.include_router(facilities_router)
app.include_router(patient_router)
app.include_router(clinical_router)
app.include_router(logs_router)
app.include_router(prevention_router)
app.include_router(showcase_router)
app.include_router(abdm_router)
app.include_router(portal_router)
app.include_router(staff_router)
app.include_router(encounter_voice_router)
app.include_router(documents_router)
app.include_router(messages_router)
app.include_router(genie_router)
app.include_router(admin_router)
app.include_router(referrals_router)

# Static & Frontend Assets Directory
STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

# Mount /static if index.html exists
if (STATIC_DIR / "index.html").exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    @app.get("/")
    async def serve_index():
        return FileResponse(str(STATIC_DIR / "index.html"))

    # HTML5 SPA Fallback: Any client subpath (e.g., /staff, /patient) serves index.html
    @app.get("/{full_path:path}")
    async def serve_spa_fallback(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        static_file = STATIC_DIR / full_path
        if static_file.exists() and static_file.is_file():
            return FileResponse(str(static_file))
        return FileResponse(str(STATIC_DIR / "index.html"))
