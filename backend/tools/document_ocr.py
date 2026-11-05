"""Real OCR for uploaded clinical documents: validation -> local quality gate -> OCR provider -> cache.

Flow used by /api/run-case:
    upload bytes -> validate_upload (magic bytes, size, pages) -> assess_image_quality (local OpenCV)
    -> OCR provider (Sarvam Vision, only when enabled + configured) -> text returned in memory
    -> the intake pipeline masks PII immediately and reuses the existing extraction call.

Privacy: the provider receives the *unmasked* document image (names, phone numbers, signatures can be
on it); it cannot be de-identified before OCR. Use synthetic documents for demos. The provider is sent a
generic filename, never the uploaded one. The cache stores masked text only, keyed by a SHA-256 of the
document bytes plus OCR settings; neither the hash nor raw text is returned or logged.
"""
import html
import io
import logging
import re
import time
from typing import Any, Callable, Dict, Optional

import cv2
import httpx
import numpy as np
from PIL import Image, UnidentifiedImageError

from backend import config
from backend.core import ai_usage
from backend.core.security import PIIShield
from backend.tools.image_tools import BlurDetectorTool, ExposureContrastTool

logger = logging.getLogger(__name__)

OCR_PROCESSING_VERSION = "ocr-v1"
MAX_IMAGE_PIXELS = 40_000_000
PDF_PAGE_PATTERN = re.compile(rb"/Type\s*/Page(?![a-zA-Z])")


class DocumentRejected(Exception):
    """The upload itself is invalid (type, size, pages, corrupt). Maps to HTTP 422."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class OCRError(Exception):
    def __init__(self, category: str):
        super().__init__(category)
        self.category = category


def detect_type(data: bytes) -> Optional[str]:
    """Identify the file from its content (magic bytes), not its name."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    return None


def validate_upload(data: bytes, max_bytes: int = None, max_pages: int = None) -> Dict[str, Any]:
    """Return {"mime", "pages", "image"} or raise DocumentRejected. Never trusts the filename."""
    max_bytes = max_bytes or config.OCR_MAX_BYTES
    max_pages = max_pages or config.OCR_MAX_PAGES
    if not data:
        raise DocumentRejected("EMPTY_FILE", "The uploaded file is empty.")
    if len(data) > max_bytes:
        raise DocumentRejected("FILE_TOO_LARGE", f"File exceeds the {max_bytes // (1024 * 1024)} MB limit.")
    mime = detect_type(data)
    if not mime:
        raise DocumentRejected("UNSUPPORTED_TYPE", "Only JPEG, PNG, WebP images or PDF documents are accepted.")

    if mime == "application/pdf":
        if b"%%EOF" not in data[-2048:]:
            raise DocumentRejected("CORRUPT_FILE", "The PDF appears truncated or corrupted.")
        pages = len(PDF_PAGE_PATTERN.findall(data))
        if pages == 0:
            raise DocumentRejected("CORRUPT_FILE", "No pages found in the PDF.")
        if pages > max_pages:
            raise DocumentRejected("TOO_MANY_PAGES", f"Document has {pages} pages; the limit is {max_pages}.")
        return {"mime": mime, "pages": pages, "image": None}

    try:
        with Image.open(io.BytesIO(data)) as probe:
            probe.verify()
        image = Image.open(io.BytesIO(data))
        image.load()
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError):
        raise DocumentRejected("CORRUPT_FILE", "The image could not be decoded; it may be corrupted.")
    if image.width * image.height > MAX_IMAGE_PIXELS:
        raise DocumentRejected("IMAGE_TOO_LARGE", "Image resolution is too large to process.")
    return {"mime": mime, "pages": 1, "image": image}


def assess_image_quality(image: Image.Image) -> Dict[str, Any]:
    """Local readability check reusing the existing blur/contrast/exposure tools.

    REJECT only clearly unreadable images (tiny, far below the sharpness threshold, almost black);
    borderline results are returned as WARN and still processed.
    """
    gray = cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2GRAY)
    h, w = gray.shape[:2]
    t = config.IMAGE_QUALITY_THRESHOLDS
    sharpness = BlurDetectorTool.compute_laplacian_variance(gray)
    contrast = ExposureContrastTool.compute_rms_contrast(gray)
    under, over = ExposureContrastTool.compute_exposure_distribution(gray)

    reasons, warnings = [], []
    if w < t["min_resolution_width"] or h < t["min_resolution_height"]:
        reasons.append(f"Resolution {w}x{h} is below the {t['min_resolution_width']}x{t['min_resolution_height']} minimum.")
    if sharpness < t["blur_laplacian_min"] * config.OCR_BLUR_REJECT_RATIO:
        reasons.append("Image is too blurred to read. Retake the photo holding the phone steady.")
    elif sharpness < t["blur_laplacian_min"]:
        warnings.append("Image is slightly blurred; some text may be misread.")
    if under > t["max_underexposed_pct"]:
        reasons.append("Image is too dark to read.")
    if over > t["max_overexposed_pct"]:
        warnings.append("Strong glare detected; some text may be missing.")
    if contrast < t["min_contrast_rms"]:
        warnings.append("Low contrast; check the OCR text carefully.")

    return {
        "status": "REJECT" if reasons else ("WARN" if warnings else "PASS"),
        "reasons": reasons,
        "warnings": warnings,
        "metrics": {"width": w, "height": h, "sharpness": round(sharpness, 1), "contrast_rms": round(contrast, 1)},
    }


def _html_to_text(content: str) -> str:
    text = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</tr>|</h[1-6]>|</li>", "\n", content)
    text = re.sub(r"(?i)</t[dh]>", " ", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    return re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n", text)).strip()


def _collect_blocks(page_items: list) -> list:
    """Text blocks in reading order, each with its page and normalised [x1, y1, x2, y2] position."""
    blocks = []
    for page in page_items:
        for b in sorted(page.get("blocks") or [], key=lambda b: b.get("reading_order") or 0):
            text = _html_to_text(b.get("text") or "")
            if text:
                bbox = b.get("bbox_norm")
                blocks.append({"id": b.get("block_id") or f"b{len(blocks) + 1}", "page": page.get("page_num") or 1, "text": text,
                               "bbox": bbox if isinstance(bbox, list) and len(bbox) == 4 else None})
    return blocks


class SarvamVisionOCRProvider:
    """Sarvam Document AI parse job (REST paths per sarvamai SDK 0.1.43): create -> poll status -> results."""

    name = "sarvam_vision"
    model = "sarvam-vision"
    TERMINAL_OK = ("completed", "partially_completed")
    TERMINAL_FAIL = ("failed", "rejected")

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None,
                 poll_interval: float = 2.0, sleep: Callable[[float], None] = time.sleep,
                 transport: Optional[httpx.BaseTransport] = None):
        self.api_key = api_key if api_key is not None else config.SARVAM_API_KEY
        self.base_url = base_url or config.SARVAM_BASE_URL
        self.poll_interval = poll_interval
        self.sleep = sleep
        self.transport = transport  # tests inject httpx.MockTransport; no live calls

    @property
    def configured(self) -> bool:
        return bool(self.api_key) and not config.LLM_DISABLED

    def extract(self, data: bytes, mime: str) -> Dict[str, Any]:
        headers = {"api-subscription-key": self.api_key}
        ext = {"image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf"}[mime]
        form = {"language": config.OCR_LANGUAGE} if config.OCR_LANGUAGE else {}
        started = time.monotonic()
        pages = None
        try:
            with httpx.Client(base_url=self.base_url, headers=headers, timeout=30.0, transport=self.transport) as client:
                created = client.post("/doc-ai/v1/job/parse", files={"file": (f"document.{ext}", data, mime)}, data=form)
                created.raise_for_status()
                job_id = created.json()["job_id"]

                deadline = time.monotonic() + config.OCR_TIMEOUT_SECONDS
                while True:
                    status = client.get(f"/doc-ai/v1/job/{job_id}/status")
                    status.raise_for_status()
                    body = status.json()
                    state = body.get("status")
                    pages = (body.get("usage") or {}).get("pages_processed")
                    if state in self.TERMINAL_OK:
                        break
                    if state in self.TERMINAL_FAIL:
                        raise OCRError("PROVIDER_JOB_FAILED")
                    if time.monotonic() > deadline:
                        raise OCRError("TIMEOUT")
                    self.sleep(self.poll_interval)

                results = client.get(f"/doc-ai/v1/job/{job_id}/results")
                results.raise_for_status()
                docs = results.json().get("documents") or []
            page_items = sorted((p for d in docs for p in (d.get("pages") or [])),
                                key=lambda p: p.get("page_num") or p.get("page_number") or 0)
            blocks = _collect_blocks(page_items)
            text = ("\n".join(b["text"] for b in blocks) if blocks else
                    "\n\n".join(_html_to_text(p.get("content") or "") for p in page_items)).strip()
            ai_usage.record_usage("document_ocr", "doc-ai/parse", self.model, True,
                                  duration_ms=int((time.monotonic() - started) * 1000), pages=pages)
            return {"text": text, "pages": pages, "partial": state == "partially_completed", "blocks": blocks}
        except OCRError as e:
            category = e.category
        except httpx.TimeoutException:
            category = "TIMEOUT"
        except httpx.HTTPStatusError as e:
            category = {402: "BILLING", 403: "AUTH", 401: "AUTH", 413: "FILE_TOO_LARGE", 422: "PROVIDER_REJECTED_FILE",
                        429: "RATE_LIMIT"}.get(e.response.status_code, f"HTTP_{e.response.status_code // 100}XX")
        except Exception:
            category = "INVALID_RESPONSE"
        ai_usage.record_usage("document_ocr", "doc-ai/parse", self.model, False,
                              duration_ms=int((time.monotonic() - started) * 1000), pages=pages, error_category=category)
        logger.warning("Document OCR failed (%s)", category)
        raise OCRError(category)


def get_provider():
    """The configured OCR provider, or None when OCR is disabled / not configured."""
    if config.OCR_ENABLED and config.OCR_PROVIDER == "sarvam_vision":
        return SarvamVisionOCRProvider()
    return None


def process_document(data: bytes, provider: Any = "default") -> Dict[str, Any]:
    """Validate, quality-check and OCR one uploaded document. Raises DocumentRejected for invalid files.

    The returned "text" is raw OCR output for in-memory use by intake only; callers must mask it before
    storing or sending it anywhere. Other statuses never carry text and never pretend success.
    """
    checked = validate_upload(data)
    result: Dict[str, Any] = {"file_type": checked["mime"], "pages": checked["pages"], "text": "",
                              "cache_hit": False, "quality": None}

    if checked["image"] is not None:
        result["quality"] = assess_image_quality(checked["image"])
        if result["quality"]["status"] == "REJECT":
            return {**result, "status": "QUALITY_REJECTED"}
    else:
        result["quality"] = {"status": "NOT_CHECKED", "reasons": [],
                             "warnings": ["PDF pages are not quality-checked locally; review the OCR text."]}

    provider = get_provider() if provider == "default" else provider
    if provider is None or not getattr(provider, "configured", False):
        return {**result, "status": "OCR_DISABLED"}

    mime, payload = checked["mime"], data
    if mime == "image/webp":  # Sarvam parse accepts JPEG/PNG/PDF; convert locally
        buf = io.BytesIO()
        checked["image"].convert("RGB").save(buf, format="PNG")
        mime, payload = "image/png", buf.getvalue()

    key = ai_usage.cache_key("document_ocr", provider=provider.name, model=provider.model,
                             version=OCR_PROCESSING_VERSION, language=config.OCR_LANGUAGE,
                             max_pages=config.OCR_MAX_PAGES, document_sha256=_sha256(data))
    cached = ai_usage.cache_get(key)
    if cached is not None:
        ai_usage.record_usage("document_ocr", "doc-ai/parse", provider.model, True, cache_hit=True)
        return {**result, "status": "COMPLETED", "text": cached["masked_text"], "cache_hit": True,
                "provider": provider.name, "blocks": cached.get("masked_blocks") or []}

    try:
        ocr = provider.extract(payload, mime)
    except OCRError as e:
        return {**result, "status": "OCR_FAILED", "error": e.category, "provider": provider.name}
    if not ocr["text"].strip():
        return {**result, "status": "OCR_EMPTY", "provider": provider.name}

    masked, _ = PIIShield.mask_text(ocr["text"])
    blocks = ocr.get("blocks") or []
    masked_blocks = [{**b, "text": PIIShield.mask_text(b["text"])[0]} for b in blocks]
    ai_usage.cache_put(key, "document_ocr", {"masked_text": masked, "masked_blocks": masked_blocks})
    return {**result, "status": "COMPLETED", "text": ocr["text"], "provider": provider.name,
            "partial": ocr.get("partial", False), "blocks": blocks}


def _sha256(data: bytes) -> str:
    import hashlib
    return hashlib.sha256(data).hexdigest()
