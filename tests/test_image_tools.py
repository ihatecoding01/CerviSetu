"""Tests for medical image quality evaluation and blur detection."""
import numpy as np
import cv2
from pathlib import Path
from src.tools.image_tools import (
    BlurDetectorTool,
    ExposureContrastTool,
    DomainRelevanceClassifierTool,
    ImageQualityEvaluator
)


def test_blur_detector_sharp_vs_blurry(tmp_path):
    # Create sharp image with edges
    sharp_img = np.zeros((300, 300), dtype=np.uint8)
    for i in range(20, 280, 20):
        cv2.line(sharp_img, (i, 0), (i, 300), 255, 2)
    
    # Create blurred version
    blurry_img = cv2.GaussianBlur(sharp_img, (31, 31), 10)

    sharp_var = BlurDetectorTool.compute_laplacian_variance(sharp_img)
    blurry_var = BlurDetectorTool.compute_laplacian_variance(blurry_img)

    assert sharp_var > 100.0
    assert blurry_var < 50.0
    assert sharp_var > blurry_var


def test_exposure_contrast_metrics():
    # Grayscale image with good dynamic range
    gray = np.linspace(0, 255, 300 * 300, dtype=np.uint8).reshape((300, 300))
    contrast = ExposureContrastTool.compute_rms_contrast(gray)
    underexp, overexp = ExposureContrastTool.compute_exposure_distribution(gray)

    assert contrast > 25.0
    assert underexp < 10.0
    assert overexp < 10.0


def test_image_quality_evaluator_file(tmp_path):
    # Save a sharp sample simulated radiograph
    img_bgr = np.zeros((300, 300, 3), dtype=np.uint8)
    # Add gradient and anatomical rib lines
    for r in range(300):
        img_bgr[r, :] = int(30 + (r * 0.4))
    for i in range(40, 260, 30):
        cv2.circle(img_bgr, (150, i), 60, (220, 220, 220), 4)
    
    img_path = tmp_path / "sharp_test.png"
    cv2.imwrite(str(img_path), img_bgr)

    res = ImageQualityEvaluator.evaluate_image(str(img_path), "PT-TEST-001")
    assert res.is_valid is True
    assert res.blur_score > 0
    assert len(res.rejection_reasons) == 0
