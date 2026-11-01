"""API domain routers for CerviSetu platform."""
from .facilities import router as facilities_router
from .patient import router as patient_router
from .clinical import router as clinical_router
from .logs import router as logs_router

__all__ = [
    "facilities_router",
    "patient_router",
    "clinical_router",
    "logs_router",
]

