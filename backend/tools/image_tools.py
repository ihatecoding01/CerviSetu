"""Medical Image Quality Assessment, Blur Detection, and Anomaly Triage Tools."""
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import cv2
import numpy as np
from PIL import Image

from backend.config import IMAGE_QUALITY_THRESHOLDS
from backend.core.state import ImageQualityResult
from backend.core.security import global_audit


class BlurDetectorTool:
    """Calculates spatial and frequency-domain blur metrics."""

    @classmethod
    def compute_laplacian_variance(cls, gray_image: np.ndarray) -> float:
        """Calculate the variance of the Laplacian filter (sharpness measure)."""
        laplacian = cv2.Laplacian(gray_image, cv2.CV_64F)
        variance = float(laplacian.var())
        return round(variance, 2)

    @classmethod
    def compute_fft_high_frequency_ratio(cls, gray_image: np.ndarray) -> float:
        """
        Calculates the ratio of high-frequency magnitude in FFT spectrum.
        Blurry images have attenuated high frequencies.
        """
        h, w = gray_image.shape
        # Center crop to power of 2 for clean FFT
        cy, cx = h // 2, w // 2
        f = np.fft.fft2(gray_image)
        fshift = np.fft.fftshift(f)
        magnitude_spectrum = 20 * np.log(np.abs(fshift) + 1e-8)

        # High frequency mask: outer radius beyond 25% of dimensions
        radius = int(min(h, w) * 0.25)
        y, x = np.ogrid[:h, :w]
        dist_from_center = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
        
        high_freq_mask = dist_from_center > radius
        total_energy = np.sum(magnitude_spectrum)
        high_energy = np.sum(magnitude_spectrum[high_freq_mask])
        
        ratio = (high_energy / (total_energy + 1e-8)) * 100.0
        return round(float(ratio), 2)


class ExposureContrastTool:
    """Evaluates exposure levels, dynamic range, and RMS contrast."""

    @classmethod
    def compute_rms_contrast(cls, gray_image: np.ndarray) -> float:
        """Compute root-mean-square (RMS) contrast."""
        normalized = gray_image.astype(np.float32) / 255.0
        rms = np.std(normalized) * 100.0
        return round(float(rms), 2)

    @classmethod
    def compute_exposure_distribution(cls, gray_image: np.ndarray) -> Tuple[float, float]:
        """Compute percentage of underexposed (<15) and overexposed (>240) pixels."""
        total_pixels = float(gray_image.size)
        underexposed_pct = (np.count_nonzero(gray_image < 15) / total_pixels) * 100.0
        overexposed_pct = (np.count_nonzero(gray_image > 240) / total_pixels) * 100.0
        return round(underexposed_pct, 2), round(overexposed_pct, 2)


class DomainRelevanceClassifierTool:
    """Classifies if the image is a genuine medical diagnostic scan or an irrelevant photo."""

    @classmethod
    def classify_modality_and_relevance(
        cls,
        image_bgr: np.ndarray,
        gray_image: np.ndarray
    ) -> Tuple[bool, str, float]:
        """
        Determines if the image has characteristics of medical imaging:
        - Grayscale predominance with high dynamic range (X-Ray, CT, MRI, Mammography)
        - Specific color gamut (H&E stain purple/pink for histopathology, skin hues for dermoscopy)
        - Rejects generic non-medical images (e.g. landscapes, memes, solid colors)
        """
        h, w = gray_image.shape
        
        # Color channel variance (grayscale vs high-color saturation)
        b, g, r = cv2.split(image_bgr)
        diff_rg = np.mean(np.abs(r.astype(np.int32) - g.astype(np.int32)))
        diff_gb = np.mean(np.abs(g.astype(np.int32) - b.astype(np.int32)))
        color_variance = diff_rg + diff_gb

        # Check for near-monochrome (typical for X-ray / CT / MRI)
        if color_variance < 8.0:
            # Grayscale medical scan
            # Check edge distribution
            edges = cv2.Canny(gray_image, 50, 150)
            edge_density = (np.count_nonzero(edges) / float(gray_image.size)) * 100.0
            
            if edge_density < 0.2:
                return False, "SOLID_OR_EMPTY_IMAGE", 0.1
            
            return True, "RADIOLOGY_GRAYSCALE (X-Ray / CT / MRI)", 0.92

        # Check for Histopathology (H&E Staining: high pink/purple saturation)
        hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
        h_chan, s_chan, v_chan = cv2.split(hsv)
        
        # Purple/Magenta hue range in HSV: ~140 to ~175
        purple_mask = (h_chan >= 135) & (h_chan <= 175) & (s_chan > 40)
        purple_pct = (np.count_nonzero(purple_mask) / float(gray_image.size)) * 100.0
        
        if purple_pct > 15.0:
            return True, "HISTOPATHOLOGY (H&E Stain)", 0.95

        # Check for Dermoscopy / Oral Cavity Lesion (Skin tones + localized lesion)
        skin_mask = (h_chan >= 0) & (h_chan <= 25) & (s_chan > 30) & (v_chan > 50)
        skin_pct = (np.count_nonzero(skin_mask) / float(gray_image.size)) * 100.0
        
        if skin_pct > 20.0:
            return True, "DERMOSCOPY / ORAL_LESION", 0.88

        # If natural color image but does not match medical signatures
        # Check if it has extreme random multi-hue dispersion (like nature photography, cars, etc.)
        hue_hist = cv2.calcHist([h_chan], [0], None, [18], [0, 180])
        active_bins = np.count_nonzero(hue_hist > (gray_image.size * 0.03))
        
        if active_bins > 10:
            return False, "NON_MEDICAL_GENERAL_PHOTO", 0.20

        # Default fallback
        return True, "CLINICAL_PHOTOGRAPHY", 0.70


class ImageQualityEvaluator:
    """Orchestrates comprehensive medical image quality and anomaly triage."""

    @classmethod
    def evaluate_image(
        cls,
        image_path: str,
        patient_token: str = "SYSTEM_TEST"
    ) -> ImageQualityResult:
        """Analyze medical image quality, blur, artifacts, contrast, and validity."""
        rejection_reasons = []
        corrective_advice = []
        
        path = Path(image_path)
        if not path.exists():
            return ImageQualityResult(
                is_valid=False,
                rejection_reasons=[f"File not found: {image_path}"],
                corrective_advice=["Please re-upload a valid image file."]
            )

        try:
            image_bgr = cv2.imread(str(path))
            if image_bgr is None:
                return ImageQualityResult(
                    is_valid=False,
                    rejection_reasons=["Unable to decode image file. File may be corrupted."],
                    corrective_advice=["Please upload a valid JPEG, PNG, or DICOM format."]
                )
        except Exception as e:
            return ImageQualityResult(
                is_valid=False,
                rejection_reasons=[f"Image decode error: {str(e)}"],
                corrective_advice=["Please verify the image format and retry."]
            )

        h, w = image_bgr.shape[:2]
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        resolution_str = f"{w}x{h}"
        aspect_ratio = round(float(w) / float(h), 2)

        # 1. Resolution Check
        min_w = IMAGE_QUALITY_THRESHOLDS["min_resolution_width"]
        min_h = IMAGE_QUALITY_THRESHOLDS["min_resolution_height"]
        if w < min_w or h < min_h:
            rejection_reasons.append(f"Low resolution ({resolution_str}). Minimum required is {min_w}x{min_h}.")
            corrective_advice.append("Capture the image in higher resolution for diagnostic accuracy.")

        # 2. Blur & Sharpness Check
        lap_variance = BlurDetectorTool.compute_laplacian_variance(gray)
        fft_high_ratio = BlurDetectorTool.compute_fft_high_frequency_ratio(gray)
        
        blur_thresh = IMAGE_QUALITY_THRESHOLDS["blur_laplacian_min"]
        blur_status = "PASS"
        if lap_variance < blur_thresh:
            blur_status = "BLURRY"
            rejection_reasons.append(f"Image is out of focus or motion-blurred (Sharpness: {lap_variance:.1f}, Min required: {blur_thresh:.1f}).")
            corrective_advice.append("Hold the camera steady or use a tripod; ensure the lesion/film is properly focused.")
        elif lap_variance < (blur_thresh * 1.3):
            blur_status = "MARGINAL"

        # 3. Exposure & Contrast Check
        rms_contrast = ExposureContrastTool.compute_rms_contrast(gray)
        underexposed_pct, overexposed_pct = ExposureContrastTool.compute_exposure_distribution(gray)
        
        contrast_status = "PASS"
        min_contrast = IMAGE_QUALITY_THRESHOLDS["min_contrast_rms"]
        max_underexp = IMAGE_QUALITY_THRESHOLDS["max_underexposed_pct"]
        max_overexp = IMAGE_QUALITY_THRESHOLDS["max_overexposed_pct"]

        if rms_contrast < min_contrast:
            contrast_status = "LOW_CONTRAST"
            rejection_reasons.append(f"Low dynamic contrast (RMS: {rms_contrast:.1f}, Min required: {min_contrast:.1f}).")
            corrective_advice.append("Improve lighting and ensure proper contrast between the tissue and background.")
        
        if underexposed_pct > max_underexp:
            contrast_status = "UNDEREXPOSED"
            rejection_reasons.append(f"Image is too dark ({underexposed_pct:.1f}% underexposed pixels).")
            corrective_advice.append("Increase illumination or adjust sensor exposure.")

        if overexposed_pct > max_overexp:
            contrast_status = "OVEREXPOSED"
            rejection_reasons.append(f"Severe glare or overexposure detected ({overexposed_pct:.1f}% washed out pixels).")
            corrective_advice.append("Reduce direct glare, flash reflection, or backlight.")

        # 4. Domain & Modality Validation
        is_medical, modality_name, confidence = DomainRelevanceClassifierTool.classify_modality_and_relevance(
            image_bgr, gray
        )
        if not is_medical:
            rejection_reasons.append(f"Non-medical or irrelevant image uploaded (Detected: {modality_name}).")
            corrective_advice.append("Ensure you upload a clinical photograph, X-ray film, dermoscopy scan, or histopathology slide.")

        is_valid = len(rejection_reasons) == 0

        # Record audit event
        global_audit.record_event(
            action="IMAGE_QUALITY_EVALUATED",
            actor="IMAGE_TRIAGE_AGENT",
            patient_token=patient_token,
            details={
                "is_valid": is_valid,
                "blur_score": lap_variance,
                "contrast_rms": rms_contrast,
                "modality": modality_name,
                "rejection_reasons": rejection_reasons
            },
            severity="WARNING" if not is_valid else "INFO"
        )

        return ImageQualityResult(
            is_valid=is_valid,
            blur_score=lap_variance,
            blur_status=blur_status,
            fft_high_freq_ratio=fft_high_ratio,
            contrast_rms=rms_contrast,
            contrast_status=contrast_status,
            is_medical_domain=is_medical,
            detected_modality=modality_name,
            aspect_ratio=aspect_ratio,
            resolution=resolution_str,
            rejection_reasons=rejection_reasons,
            corrective_advice=corrective_advice
        )
