import cv2
import numpy as np

img = cv2.imread(r'C:/Users/perci/.gemini/antigravity/brain/47e80d76-b5bc-486a-95e1-d38e50ec19dd/.user_uploaded/media_1793688100783_8f257c74.png', cv2.IMREAD_GRAYSCALE)
_, thresh = cv2.threshold(img, 128, 255, cv2.THRESH_BINARY_INV)
contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_TC89_KCOS)

# Normalize to a clean 500x500 or 100x100 viewBox
# First find overall bbox
all_pts = np.vstack(contours).reshape(-1, 2)
xmin, ymin = all_pts.min(axis=0)
xmax, ymax = all_pts.max(axis=0)
w = xmax - xmin
h = ymax - ymin

# Center inside a 100x100 box with 6% padding
padding = 6
target_size = 100 - 2 * padding
scale = target_size / max(w, h)
offset_x = padding + (target_size - w * scale) / 2
offset_y = padding + (target_size - h * scale) / 2

svg_paths = []
for c in contours:
    # Smooth approximation
    epsilon = 0.0012 * cv2.arcLength(c, True)
    approx = cv2.approxPolyDP(c, epsilon, True)
    pts = approx.reshape(-1, 2)
    # Scale and center
    pts_norm = (pts - [xmin, ymin]) * scale + [offset_x, offset_y]
    path_d = f"M {pts_norm[0][0]:.2f} {pts_norm[0][1]:.2f} " + " ".join([f"L {p[0]:.2f} {p[1]:.2f}" for p in pts_norm[1:]]) + " Z"
    svg_paths.append(path_d)

tsx_component = f'''import React from "react";

interface LogoProps extends React.SVGProps<SVGSVGElement> {{
  size?: number | string;
}}

/**
 * CerviSetu Sovereign Emblem — Protective Caring Hands / Bridge
 * Vectorized from official brand artwork.
 */
export const CerviSetuLogo: React.FC<LogoProps> = ({{ size = 24, className, ...props }}) => (
  <svg
    width={{size}}
    height={{size}}
    viewBox="0 0 100 100"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={{className}}
    {{...props}}
  >
''' + '\n'.join([f'    <path d="{p}" />' for p in svg_paths]) + '''
  </svg>
);
'''

with open('frontend/src/components/icons/CerviSetuLogo.tsx', 'w', encoding='utf-8') as f:
    f.write(tsx_component)

print('Generated CerviSetuLogo.tsx successfully!')

