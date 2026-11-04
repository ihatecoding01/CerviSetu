"""API domain routers for CerviSetu platform."""
from .facilities import router as facilities_router
from .patient import router as patient_router
from .clinical import router as clinical_router
from .logs import router as logs_router
from .prevention import router as prevention_router
from .showcase import router as showcase_router
from .abdm import router as abdm_router
from .portal import router as portal_router
from .staff import router as staff_router

__all__ = [
    "facilities_router",
    "patient_router",
    "clinical_router",
    "logs_router",
    "prevention_router",
    "showcase_router",
    "abdm_router",
    "portal_router",
    "staff_router",
]

