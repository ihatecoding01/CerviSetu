"""FastAPI Application Factory and Modular Router Assembler for CerviSetu."""
import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException
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
)
from backend.dashboard.routers.clinical import IntakeRequest, SimulationRequest
from backend.tools.escalation_scheduler import escalation_loop
from backend.dashboard.routers.logs import (
    UserActivityLogRequest,
    DoctorSignOffRequest,
    DoctorTriageRequest,
    NurseFractionLogRequest,
    NurseSlipUploadRequest,
    PatientSymptomCheckinRequest,
    AshaHomeVisitRequest,
)
from backend.dashboard.routers.patient import (
    AdvanceFraction15Request,
    HubConfirmSlotRequest,
)

@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Start the daily missed-visit escalation loop (off in the test suite)."""
    task = None
    if not os.getenv("CERVISETU_DISABLE_SCHEDULER"):
        task = asyncio.create_task(escalation_loop())
    yield
    if task:
        task.cancel()


# Initialize FastAPI Application
app = FastAPI(
    lifespan=lifespan,
    title="CerviSetu - Clinical Diagnostic & Rural Patient Tracking AI",
    description="Privacy-first LangGraph multi-agent clinical diagnostic and rural cancer tracking system",
    version="2.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure Cross-Origin Resource Sharing (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
