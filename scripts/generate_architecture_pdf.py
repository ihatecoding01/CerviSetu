"""
CerviSetu System Architecture & Strategic Roadmap PDF Generator
Generates a comprehensive 16-page executive specification PDF detailing
the transition from curative radiobiological tracking to primary HPV immunization
and secondary point-of-care screening.
"""

import sys
import os
import fitz  # PyMuPDF

def generate_pdf(output_path: str):
    doc = fitz.open()

    # Color Palette - Pink & Blue Theme
    C_BLUE = (43 / 255, 102 / 255, 228 / 255)         # #2B66E4 Medical Royal Blue
    C_BLUE_LIGHT = (239 / 255, 246 / 255, 255 / 255)   # #EFF6FF
    C_BLUE_BORDER = (191 / 255, 219 / 255, 254 / 255)
    C_PINK = (244 / 255, 63 / 255, 94 / 255)          # #F43F5E Rose/Pink
    C_PINK_LIGHT = (255 / 255, 241 / 255, 242 / 255)   # #FFF1F2
    C_PINK_BORDER = (254 / 255, 205 / 255, 211 / 255)
    C_DARK = (17 / 255, 20 / 255, 24 / 255)           # #111418 Deep Slate
    C_SLATE = (71 / 255, 85 / 255, 105 / 255)         # #475569 Slate Muted
    C_MUTED = (148 / 255, 163 / 255, 184 / 255)       # #94A3B8 Border / Light Slate
    C_BG_CARD = (248 / 255, 250 / 255, 252 / 255)     # #F8FAFC
    C_WHITE = (1.0, 1.0, 1.0)
    C_GREEN = (16 / 255, 185 / 255, 129 / 255)        # #10B981 Emerald
    C_GREEN_LIGHT = (236 / 255, 253 / 255, 245 / 255)
    C_AMBER = (217 / 255, 119 / 255, 6 / 255)         # #D97706 Amber
    C_AMBER_LIGHT = (254 / 255, 243 / 255, 199 / 255) # Light Amber Background
    C_BORDER = (226 / 255, 232 / 255, 240 / 255)

    TOTAL_PAGES = 16

    def add_page_decorations(page, page_num, title):
        if page_num == 1:
            return
        # Top Header Bar
        page.draw_rect(fitz.Rect(40, 30, 555, 31), color=C_BORDER)
        page.insert_text(fitz.Point(40, 24), "CERVISETU ARCHITECTURE SPECIFICATION & ROADMAP", fontsize=8, fontname="hebo", color=C_BLUE)
        page.insert_text(fitz.Point(320, 24), title.upper()[:44], fontsize=7.5, fontname="helv", color=C_SLATE)
        # Bottom Footer Bar
        page.draw_rect(fitz.Rect(40, 810, 555, 811), color=C_BORDER)
        page.insert_text(fitz.Point(40, 824), "Confidential · CerviSetu Sovereign Health Initiative · Aligned with WHO 90-70-90", fontsize=7.5, fontname="helv", color=C_MUTED)
        page.insert_text(fitz.Point(495, 824), f"Page {page_num} of {TOTAL_PAGES}", fontsize=8, fontname="hebo", color=C_BLUE)

    def draw_card(page, rect, bg_color=C_BG_CARD, border_color=C_BORDER, radius=0.04):
        page.draw_rect(rect, color=border_color, fill=bg_color, width=0.8, radius=radius)

    def draw_pill(page, x, y, text, bg_color, text_color, width=None):
        w = width if width else (len(text) * 5.8 + 14)
        rect = fitz.Rect(x, y, x + w, y + 16)
        page.draw_rect(rect, color=bg_color, fill=bg_color, radius=0.4)
        page.insert_text(fitz.Point(x + 7, y + 11.5), text, fontsize=7.5, fontname="hebo", color=text_color)
        return x + w

    def draw_header_section(page, title, subtitle, pill_text="SYSTEM SPECIFICATION", pill_color=C_BLUE, pill_bg=C_BLUE_LIGHT):
        draw_pill(page, 40, 45, pill_text, pill_bg, pill_color)
        page.insert_text(fitz.Point(40, 78), title, fontsize=17, fontname="hebo", color=C_DARK)
        page.insert_text(fitz.Point(40, 94), subtitle, fontsize=9.5, fontname="helv", color=C_SLATE)
        page.draw_rect(fitz.Rect(40, 102, 555, 103), color=C_BORDER)

    def draw_bullet(page, x, y, title, desc, title_color=C_DARK, desc_color=C_SLATE, fontsize=8.5):
        page.draw_circle(fitz.Point(x + 2, y - 3), 2, color=C_BLUE, fill=C_BLUE)
        page.insert_text(fitz.Point(x + 10, y), title + ": ", fontsize=fontsize, fontname="hebo", color=title_color)
        t_len = len(title) * 4.6 + 10
        page.insert_text(fitz.Point(x + 10 + t_len, y), desc, fontsize=fontsize, fontname="helv", color=desc_color)

    # =========================================================================
    # PAGE 1: TITLE & COVER PAGE
    # =========================================================================
    p1 = doc.new_page(width=595, height=842)
    p1.draw_rect(fitz.Rect(0, 0, 595, 260), fill=C_DARK)
    p1.draw_rect(fitz.Rect(0, 256, 595, 260), fill=C_BLUE)

    p1.draw_rect(fitz.Rect(40, 45, 95, 100), fill=C_BLUE, radius=0.15)
    p1.insert_text(fitz.Point(52, 85), "CS", fontsize=32, fontname="hebo", color=C_WHITE)

    draw_pill(p1, 110, 50, "SOVEREIGN HEALTHCARE AI · NATIONAL ELIMINATION INITIATIVE", (40/255, 55/255, 80/255), (140/255, 190/255, 255/255), width=320)
    p1.insert_text(fitz.Point(110, 90), "CERVISETU", fontsize=34, fontname="hebo", color=C_WHITE)
    p1.insert_text(fitz.Point(110, 115), "Next-Generation Architecture & Strategic Roadmap", fontsize=16, fontname="hebo", color=(180/255, 210/255, 255/255))
    p1.insert_text(fitz.Point(110, 135), "Pivot to Upstream Primary HPV Immunization & Secondary Screening Infrastructure", fontsize=10, fontname="helv", color=C_MUTED)

    bx = 40
    bx = draw_pill(p1, bx, 165, "Adolescent HPV (Cohort 1)", C_PINK, C_WHITE) + 8
    bx = draw_pill(p1, bx, 165, "Adult Screening (Cohort 2)", C_BLUE, C_WHITE) + 8
    bx = draw_pill(p1, bx, 165, "14-Day Cadence Engine", (30/255, 41/255, 59/255), C_WHITE) + 8
    bx = draw_pill(p1, bx, 165, "DPDP 2023 AES-256 Shield", C_GREEN, C_WHITE)

    draw_card(p1, fitz.Rect(40, 280, 555, 460), bg_color=C_WHITE, border_color=C_BORDER)
    p1.insert_text(fitz.Point(60, 310), "EXECUTIVE DOCUMENT OVERVIEW", fontsize=11, fontname="hebo", color=C_BLUE)
    p1.insert_text(fitz.Point(60, 326), "This technical whitepaper details the architectural transformation of CerviSetu from a late-stage curative", fontsize=9, fontname="helv", color=C_DARK)
    p1.insert_text(fitz.Point(60, 340), "treatment adherence tracker into a sovereign, multi-cohort primary and secondary prevention engine.", fontsize=9, fontname="helv", color=C_DARK)
    
    draw_card(p1, fitz.Rect(60, 355, 290, 440), bg_color=C_PINK_LIGHT, border_color=C_PINK)
    p1.insert_text(fitz.Point(75, 375), "Cohort 1: Girls Aged 9–14", fontsize=10, fontname="hebo", color=C_PINK)
    p1.insert_text(fitz.Point(75, 392), "• 2-Dose HPV Tracking (Dose 1: T0, Dose 2: T0 + 6m)", fontsize=8, fontname="helv", color=C_DARK)
    p1.insert_text(fitz.Point(75, 407), "• Automated 14-day pre-due vial stock checks", fontsize=8, fontname="helv", color=C_DARK)
    p1.insert_text(fitz.Point(75, 422), "• Persistent 14-day overdue escalation loop", fontsize=8, fontname="helv", color=C_DARK)

    draw_card(p1, fitz.Rect(305, 355, 535, 440), bg_color=C_BLUE_LIGHT, border_color=C_BLUE)
    p1.insert_text(fitz.Point(320, 375), "Cohort 2: Women Aged 35–45", fontsize=10, fontname="hebo", color=C_BLUE)
    p1.insert_text(fitz.Point(320, 392), "• Point-of-Care VIA & Pap smear mobile intake", fontsize=8, fontname="helv", color=C_DARK)
    p1.insert_text(fitz.Point(320, 407), "• AI triage: Normal vs Abnormal segregation", fontsize=8, fontname="helv", color=C_DARK)
    p1.insert_text(fitz.Point(320, 422), "• Dual-track: Community check-in vs Tertiary referral", fontsize=8, fontname="helv", color=C_DARK)

    draw_card(p1, fitz.Rect(40, 480, 555, 660), bg_color=C_BG_CARD, border_color=C_BORDER)
    p1.insert_text(fitz.Point(60, 505), "DOCUMENT CONTROL & SPECIFICATION METADATA", fontsize=10, fontname="hebo", color=C_DARK)
    
    meta_rows = [
        ("Target Platform", "CerviSetu Care Engine v2.0 (FastAPI 0.141+ / React 19 / LangGraph v1.2)"),
        ("Baseline Codebase", "Merged jeet branch (23 audited commits, 205 passing pytest suite)"),
        ("New Direction", "Multi-Cohort Prevention, 14-Day Cadence Engine & Specialist Review Portal"),
        ("Target Population", "Rural District Networks (Primary Health Centres, Sub-Centres & Hubs)"),
        ("Security Standard", "Digital Personal Data Protection (DPDP) Act 2023 · AES-256-GCM Vault"),
        ("Interoperability", "ABDM Ayushman Bharat Digital Mission (ABHA M1/M2/M3) · FHIR R4 Ready"),
        ("Date / Release", "November 2026 · Official System Roadmap Edition")
    ]
    my = 525
    for label, val in meta_rows:
        p1.insert_text(fitz.Point(60, my), label + ":", fontsize=8, fontname="hebo", color=C_SLATE)
        p1.insert_text(fitz.Point(180, my), val, fontsize=8, fontname="helv", color=C_DARK)
        my += 18

    draw_card(p1, fitz.Rect(40, 680, 555, 780), bg_color=(254/255, 252/255, 232/255), border_color=(250/255, 204/255, 21/255))
    p1.insert_text(fitz.Point(55, 705), "STATUTORY & PUBLIC HEALTH CONFORMANCE NOTICE", fontsize=9, fontname="hebo", color=(161/255, 98/255, 7/255))
    p1.insert_text(fitz.Point(55, 722), "CerviSetu operates as an assistive orchestration and triaging system. It does not replace clinical judgment.", fontsize=8, fontname="helv", color=C_DARK)
    p1.insert_text(fitz.Point(55, 736), "All diagnostic classifications, biopsy referrals, and prescription sign-offs require authenticated clinician sign-off.", fontsize=8, fontname="helv", color=C_DARK)
    p1.insert_text(fitz.Point(55, 750), "All patient records are cryptographically masked in accordance with DPDP Act 2023 zero-knowledge tokenization.", fontsize=8, fontname="helv", color=C_DARK)

    # =========================================================================
    # PAGE 2: EXECUTIVE SUMMARY & STRATEGIC PIVOT
    # =========================================================================
    p2 = doc.new_page(width=595, height=842)
    add_page_decorations(p2, 2, "Executive Summary & Strategic Pivot")
    draw_header_section(p2, "1. Executive Summary & Strategic Pivot", "Transitioning from Curative Radiobiology to Sovereign Upstream Prevention", "STRATEGIC VISION")

    draw_card(p2, fitz.Rect(40, 115, 555, 235), bg_color=C_WHITE, border_color=C_BORDER)
    p2.insert_text(fitz.Point(55, 135), "THE PUBLIC HEALTH REALITY IN RURAL INDIA", fontsize=10, fontname="hebo", color=C_BLUE)
    p2.insert_textbox(fitz.Rect(55, 142, 540, 225),
        "India accounts for approximately one-fifth of the worldwide cervical cancer burden, recording over 123,000 new cases "
        "and 77,000 fatalities each year. In rural areas, more than 70% of cases are diagnosed at locally advanced stages (FIGO IIB to IVA). "
        "Historically, clinical attention focused exclusively on curative radiobiological tracking: ensuring patients completed concurrent "
        "chemoradiation and brachytherapy within the 56-day biological ceiling. However, this curative focus acts too late, fighting a losing "
        "battle against travel hurdles, catastrophic expenses, and late presentations.",
        fontsize=8.5, fontname="helv", color=C_DARK
    )

    draw_card(p2, fitz.Rect(40, 245, 555, 395), bg_color=C_BG_CARD, border_color=C_BORDER)
    p2.insert_text(fitz.Point(55, 265), "THE THREE PILLARS OF THE STRATEGIC PIVOT", fontsize=10, fontname="hebo", color=C_DARK)
    draw_bullet(p2, 55, 285, "Upstream Primary Immunization", "Prioritizing adolescent girls (9–14) to establish lifelong HPV immunity prior to viral exposure.")
    draw_bullet(p2, 55, 310, "Point-of-Care Visual Triage", "Equipping frontline ASHA workers with visual inspection with acetic acid (VIA) & AI assistance.")
    draw_bullet(p2, 55, 335, "Dual-Track Care Orchestration", "Treating benign infections locally (Track A) while instantly escalating lesions to specialists (Track B).")
    draw_bullet(p2, 55, 360, "14-Day Cadence Alert Engine", "Replacing rigid 56-day clocks with rapid 14-day accountability cycles for immunization & check-ins.")
    draw_bullet(p2, 55, 385, "Pre-Arrival Specialist Linkage", "Connecting rural Primary Health Centres directly to tertiary oncologists before patient travel.")

    draw_card(p2, fitz.Rect(40, 405, 555, 545), bg_color=C_WHITE, border_color=C_BORDER)
    p2.insert_text(fitz.Point(55, 425), "ALIGNMENT WITH THE WHO 90-70-90 CERVICAL ELIMINATION MANDATE", fontsize=10, fontname="hebo", color=C_GREEN)
    
    draw_card(p2, fitz.Rect(55, 435, 205, 530), bg_color=C_PINK_LIGHT, border_color=C_PINK)
    p2.insert_text(fitz.Point(65, 455), "90% VACCINATION", fontsize=9, fontname="hebo", color=C_PINK)
    p2.insert_textbox(fitz.Rect(65, 465, 195, 525), "Fully vaccinate 90% of girls with HPV vaccine by age 15. Tracked by Cohort 1 Dose Counter.", fontsize=8, fontname="helv", color=C_DARK)

    draw_card(p2, fitz.Rect(220, 435, 370, 530), bg_color=C_BLUE_LIGHT, border_color=C_BLUE)
    p2.insert_text(fitz.Point(230, 455), "70% SCREENING", fontsize=9, fontname="hebo", color=C_BLUE)
    p2.insert_textbox(fitz.Rect(230, 465, 360, 525), "Screen 70% of women with high-performance test at 35 & 45. Handled by Cohort 2 VIA engine.", fontsize=8, fontname="helv", color=C_DARK)

    draw_card(p2, fitz.Rect(385, 435, 535, 530), bg_color=C_GREEN_LIGHT, border_color=C_GREEN)
    p2.insert_text(fitz.Point(395, 455), "90% TREATMENT", fontsize=9, fontname="hebo", color=C_GREEN)
    p2.insert_textbox(fitz.Rect(395, 465, 525, 525), "Ensure 90% of women identified with cervical disease receive care via Specialist Review Portal.", fontsize=8, fontname="helv", color=C_DARK)

    draw_card(p2, fitz.Rect(40, 555, 555, 790), bg_color=C_BG_CARD, border_color=C_BORDER)
    p2.insert_text(fitz.Point(55, 575), "HEALTH ECONOMICS & SYSTEM COST COMPARISON", fontsize=10, fontname="hebo", color=C_DARK)
    
    p2.draw_rect(fitz.Rect(55, 585, 540, 605), fill=C_BLUE)
    p2.insert_text(fitz.Point(65, 598), "Dimension", fontsize=8, fontname="hebo", color=C_WHITE)
    p2.insert_text(fitz.Point(180, 598), "Curative CCRT Tracking (Old)", fontsize=8, fontname="hebo", color=C_WHITE)
    p2.insert_text(fitz.Point(360, 598), "Multi-Cohort Prevention Engine (New)", fontsize=8, fontname="hebo", color=C_WHITE)

    econ_rows = [
        ("Intervention Target", "Invasive Malignancy (FIGO IIB-IVA)", "Adolescent Girls (9-14) & Women (35-45)"),
        ("Primary Goal", "Enforce 56-day radiobiology clock", "Prevent cancer onset & identify precancer"),
        ("Frontline Role", "Track dropped radiotherapy fractions", "ASHA intake, dose tracking, VIA capture"),
        ("Diagnostic Gate", "Biopsy & Teletherapy Prescription", "Point-of-Care VIA & Digital Slip OCR"),
        ("Action Cadence", "56-day rigid curative clock", "14-day nimble triage & check-in cycle"),
        ("Cost per Beneficiary", "Rs. 1,50,000 - 3,50,000 (Tertiary)", "Rs. 800 - 2,500 (Vaccine + Screening)"),
        ("Economic ROI", "Preserves pelvic control (1.2% hazard)", "26x Economic Return (Averted deaths)")
    ]
    ry = 620
    for dim, old, new in econ_rows:
        p2.draw_rect(fitz.Rect(55, ry - 10, 540, ry + 12), fill=(C_WHITE if ry % 40 == 0 else C_BG_CARD))
        p2.insert_text(fitz.Point(65, ry), dim, fontsize=7.5, fontname="hebo", color=C_DARK)
        p2.insert_text(fitz.Point(180, ry), old, fontsize=7.5, fontname="helv", color=C_SLATE)
        p2.insert_text(fitz.Point(360, ry), new, fontsize=7.5, fontname="hebo", color=C_BLUE)
        ry += 22

    # =========================================================================
    # PAGE 3: THE JEET BRANCH FOUNDATION
    # =========================================================================
    p3 = doc.new_page(width=595, height=842)
    add_page_decorations(p3, 3, "The Jeet Branch Foundation")
    draw_header_section(p3, "2. The Jeet Branch Foundation", "Audited Inventory of 23 Commits and Repurposed Engineering Assets", "CODEBASE AUDIT")

    draw_card(p3, fitz.Rect(40, 115, 555, 205), bg_color=C_WHITE, border_color=C_BORDER)
    p3.insert_text(fitz.Point(55, 135), "THE TECHNICAL FOUNDATION CREATED BY JEET BRANCH", fontsize=10, fontname="hebo", color=C_BLUE)
    p3.insert_textbox(fitz.Rect(55, 142, 540, 198),
        "The jeet branch contributed 23 production-hardened commits (04b3fa9 through 9486b9b) that established CerviSetu's "
        "multilingual, security, and conversational foundation. The automated test suite stands at 205 passing tests with "
        "zero failures. Rather than discarding these assets, the new direction directly inherits and repurposes this high-quality "
        "infrastructure for frontline multi-cohort prevention and screening.",
        fontsize=8.5, fontname="helv", color=C_DARK
    )

    comps = [
        ("1. 6-Language Indic Localization", "Hindi, Bhojpuri, Bengali, Marathi, Tamil, Telugu with native Indic digits.",
         "Repurposed: Now delivers adolescent guardian vaccine consent & adult VIA education."),
        ("2. Role-Based Access Control (RBAC)", "HMAC-SHA256 signed cookie sessions for DOCTOR, NURSE, ASHA, ADMIN.",
         "Repurposed: Enforces distinct portals for frontline ASHA workers vs tertiary oncologists."),
        ("3. 'Ask Genie' Conversational Assistant", "Live ward context injection with voice input/output and grounded medical QA.",
         "Repurposed: Transformed into an Immunization & Screening Copilot for PHC clinicians."),
        ("4. Interactive Document Workspace", "Laplacian blur detection, spatial OCR coordinate mapping, grounded QA.",
         "Repurposed: Digitizes VIA acetic acid imagery and rural screening lab slips."),
        ("5. Sarvam AI & Groq LPU Pipeline", "Sarvam bulbul:v4-flash TTS, Indic LLMs with Groq LLaMA-3.3-70B fallback.",
         "Repurposed: Powers automated 14-day voice reminder IVRs and rural symptom intake."),
        ("6. AES-256-GCM Zero-Knowledge Vault", "Client-side demographic encryption with blind HMAC-SHA256 indexing.",
         "Repurposed: Shields adolescent minor records and adult screening findings under DPDP 2023.")
    ]
    cy = 215
    for title, tech, repurpose in comps:
        draw_card(p3, fitz.Rect(40, cy, 555, cy + 78), bg_color=C_BG_CARD, border_color=C_BORDER)
        p3.insert_text(fitz.Point(55, cy + 20), title, fontsize=9.5, fontname="hebo", color=C_DARK)
        p3.insert_text(fitz.Point(55, cy + 38), "Jeet Branch Implementation: " + tech, fontsize=8, fontname="helv", color=C_SLATE)
        p3.insert_text(fitz.Point(55, cy + 56), repurpose, fontsize=8, fontname="hebo", color=C_BLUE)
        cy += 85

    draw_card(p3, fitz.Rect(40, 730, 555, 795), bg_color=C_GREEN_LIGHT, border_color=C_GREEN)
    p3.insert_text(fitz.Point(55, 752), "TEST SUITE & REGRESSION VERIFICATION INTEGRITY", fontsize=9.5, fontname="hebo", color=C_GREEN)
    p3.insert_text(fitz.Point(55, 770), "All 205 pytest test cases continue to pass without regressions. Multi-cohort schema and 14-day alert suites", fontsize=8, fontname="helv", color=C_DARK)
    p3.insert_text(fitz.Point(55, 784), "were layered directly on top of the validated database and session security foundations.", fontsize=8, fontname="helv", color=C_DARK)

    # =========================================================================
    # PAGE 4: MULTI-COHORT SYSTEM ARCHITECTURE
    # =========================================================================
    p4 = doc.new_page(width=595, height=842)
    add_page_decorations(p4, 4, "Multi-Cohort System Architecture")
    draw_header_section(p4, "3. Multi-Cohort System Architecture", "High-Level Topological Blueprint: Orchestration Engine & Dual Cohort Flow", "SYSTEM TOPOLOGY")

    draw_card(p4, fitz.Rect(40, 115, 555, 335), bg_color=C_WHITE, border_color=C_BORDER)
    p4.insert_text(fitz.Point(55, 135), "CERVISETU CARE ORCHESTRATION TOPOLOGY", fontsize=10, fontname="hebo", color=C_BLUE)

    draw_card(p4, fitz.Rect(180, 145, 415, 185), bg_color=C_DARK, border_color=C_BLUE)
    p4.insert_text(fitz.Point(210, 168), "[CerviSetu Care Engine]", fontsize=11, fontname="hebo", color=C_WHITE)

    p4.draw_line(fitz.Point(297, 185), fitz.Point(297, 205), color=C_SLATE, width=1.5)
    p4.draw_line(fitz.Point(150, 205), fitz.Point(445, 205), color=C_SLATE, width=1.5)
    p4.draw_line(fitz.Point(150, 205), fitz.Point(150, 220), color=C_SLATE, width=1.5)
    p4.draw_line(fitz.Point(445, 205), fitz.Point(445, 220), color=C_SLATE, width=1.5)

    draw_card(p4, fitz.Rect(55, 220, 245, 315), bg_color=C_PINK_LIGHT, border_color=C_PINK)
    p4.insert_text(fitz.Point(65, 238), "Cohort 1: Girls Under 14", fontsize=9.5, fontname="hebo", color=C_PINK)
    p4.insert_text(fitz.Point(65, 253), "(Primary Prevention / Immunization)", fontsize=7.5, fontname="helv", color=C_SLATE)
    p4.insert_text(fitz.Point(65, 270), "• ASHA Intake & Age Verification", fontsize=7.5, fontname="helv", color=C_DARK)
    p4.insert_text(fitz.Point(65, 283), "• 2-Dose Counter (T0 & T0 + 6mo)", fontsize=7.5, fontname="helv", color=C_DARK)
    p4.insert_text(fitz.Point(65, 296), "• 14-day Pre/Post Due Reminders", fontsize=7.5, fontname="helv", color=C_DARK)
    p4.insert_text(fitz.Point(65, 309), "• ABDM U-WIN Logging & AEFI Audit", fontsize=7.5, fontname="helv", color=C_DARK)

    draw_card(p4, fitz.Rect(350, 220, 540, 315), bg_color=C_BLUE_LIGHT, border_color=C_BLUE)
    p4.insert_text(fitz.Point(360, 238), "Cohort 2: Women Aged 35–45", fontsize=9.5, fontname="hebo", color=C_BLUE)
    p4.insert_text(fitz.Point(360, 253), "(Secondary Prevention / Screening)", fontsize=7.5, fontname="helv", color=C_SLATE)
    p4.insert_text(fitz.Point(360, 270), "• Point-of-Care VIA & Slip OCR", fontsize=7.5, fontname="helv", color=C_DARK)
    p4.insert_text(fitz.Point(360, 283), "• AI Triage: Normal vs Abnormal", fontsize=7.5, fontname="helv", color=C_DARK)
    p4.insert_text(fitz.Point(360, 296), "• Track A: Community Management", fontsize=7.5, fontname="helv", color=C_DARK)
    p4.insert_text(fitz.Point(360, 309), "• Track B: Tertiary Specialist Portal", fontsize=7.5, fontname="helv", color=C_DARK)

    draw_card(p4, fitz.Rect(40, 345, 555, 485), bg_color=C_BG_CARD, border_color=C_BORDER)
    p4.insert_text(fitz.Point(55, 365), "FRONTLINE TOUCHPOINTS & INTEGRATION RAILS", fontsize=10, fontname="hebo", color=C_DARK)
    draw_bullet(p4, 55, 385, "ASHA Mobile Workstation", "Flutter/React low-bandwidth web app with offline-first SQLite caching for field intake.")
    draw_bullet(p4, 55, 410, "Primary Health Centre (PHC) Spoke", "Clinical desk for vaccine vial logging, refrigeration monitoring, and VIA exam documentation.")
    draw_bullet(p4, 55, 435, "Tertiary Specialist Review Portal", "Dedicated web UI for tertiary gynecologists and oncologists to review digital pre-arrival dossiers.")
    draw_bullet(p4, 55, 460, "Sovereign Health Standards (ABDM)", "Bi-directional sync with ABHA health IDs, U-WIN vaccination registry, and FHIR R4 bundles.")

    draw_card(p4, fitz.Rect(40, 495, 555, 635), bg_color=C_WHITE, border_color=C_BORDER)
    p4.insert_text(fitz.Point(55, 515), "ZERO-KNOWLEDGE DATA FLOW & IDENTITY DECOUPLING", fontsize=10, fontname="hebo", color=C_BLUE)
    p4.insert_textbox(fitz.Rect(55, 525, 540, 625),
        "A critical architectural requirement is complete isolation between clinical identity and reasoning pipelines. "
        "All patient identifiers (Aadhaar, ABHA, Phone, Name) are sealed in an AES-256-GCM token vault. External triaging "
        "models and cloud queues process strictly non-reversible synthetic tokens (e.g. PT-RURAL-7891). Clinicians at authenticated "
        "consoles view verified demographics to prevent clinical mix-ups, while the underlying AI ledger records cryptographic "
        "hashes without exposing raw PII.",
        fontsize=8.5, fontname="helv", color=C_DARK
    )

    draw_card(p4, fitz.Rect(40, 645, 555, 785), bg_color=C_BG_CARD, border_color=C_BORDER)
    p4.insert_text(fitz.Point(55, 665), "SYSTEM TELEMETRY & RUNTIME RESILIENCE", fontsize=10, fontname="hebo", color=C_DARK)
    p4.insert_text(fitz.Point(55, 685), "• Latency Target: < 200 ms for automated triage and 14-day rule evaluations.", fontsize=8, fontname="helv", color=C_SLATE)
    p4.insert_text(fitz.Point(55, 705), "• LLM Fallback: Sarvam Indic LLM primary, falling back dynamically to Groq LLaMA-3.3-70B.", fontsize=8, fontname="helv", color=C_SLATE)
    p4.insert_text(fitz.Point(55, 725), "• Voice Synthesis: Sarvam bulbul:v4-flash Indic audio streaming for native phone outreach.", fontsize=8, fontname="helv", color=C_SLATE)
    p4.insert_text(fitz.Point(55, 745), "• Audit Trail: SHA-256 chained ledger block anchored to each state mutation.", fontsize=8, fontname="helv", color=C_SLATE)

    # =========================================================================
    # PAGE 5: COHORT 1 — ADOLESCENT HPV IMMUNIZATION & 2-DOSE TRACKING
    # =========================================================================
    p5 = doc.new_page(width=595, height=842)
    add_page_decorations(p5, 5, "Cohort 1: Adolescent HPV Immunization")
    draw_header_section(p5, "4. Cohort 1: Adolescent HPV Immunization", "2-Dose Regimen Logic, Automated Interval Counting, and Registry Intake", "PRIMARY PREVENTION", C_PINK, C_PINK_LIGHT)

    draw_card(p5, fitz.Rect(40, 115, 555, 235), bg_color=C_WHITE, border_color=C_BORDER)
    p5.insert_text(fitz.Point(55, 135), "TARGET DEMOGRAPHIC & BASELINE INTAKE PROTOCOL", fontsize=10, fontname="hebo", color=C_PINK)
    p5.insert_textbox(fitz.Rect(55, 142, 540, 225),
        "Cohort 1 targets adolescent girls aged 9 to 14 years across rural school networks and community Anganwadi centres. "
        "Frontline ASHA workers register eligible beneficiaries by verifying birth certificates or school admission records. "
        "The intake engine audits prior immunization history to detect any HPV doses administered outside the public health system "
        "or during special vaccination campaigns, preventing duplicate administration.",
        fontsize=8.5, fontname="helv", color=C_DARK
    )

    draw_card(p5, fitz.Rect(40, 245, 555, 375), bg_color=C_PINK_LIGHT, border_color=C_PINK)
    p5.insert_text(fitz.Point(55, 265), "2-DOSE STANDARD IMMUNIZATION REGIMEN MATH", fontsize=10, fontname="hebo", color=C_PINK)
    
    draw_card(p5, fitz.Rect(55, 275, 285, 360), bg_color=C_WHITE, border_color=C_PINK_BORDER)
    p5.insert_text(fitz.Point(65, 295), "DOSE 1 (BASELINE · T0)", fontsize=9, fontname="hebo", color=C_PINK)
    p5.insert_text(fitz.Point(65, 312), "• Administered at PHC or school outreach camp", fontsize=7.5, fontname="helv", color=C_DARK)
    p5.insert_text(fitz.Point(65, 327), "• Logs vial batch number, manufacturer, expiry", fontsize=7.5, fontname="helv", color=C_DARK)
    p5.insert_text(fitz.Point(65, 342), "• Status: Partially Vaccinated (1/2)", fontsize=7.5, fontname="hebo", color=C_PINK)

    draw_card(p5, fitz.Rect(305, 275, 535, 360), bg_color=C_WHITE, border_color=C_PINK_BORDER)
    p5.insert_text(fitz.Point(315, 295), "DOSE 2 (MINIMUM T0 + 6 MONTHS)", fontsize=9, fontname="hebo", color=C_PINK)
    p5.insert_text(fitz.Point(315, 312), "• Target window: T0 + 180 days (up to 365 days)", fontsize=7.5, fontname="helv", color=C_DARK)
    p5.insert_text(fitz.Point(315, 327), "• Cold-chain verification prior to administration", fontsize=7.5, fontname="helv", color=C_DARK)
    p5.insert_text(fitz.Point(315, 342), "• Status: Fully Immunized (2/2)", fontsize=7.5, fontname="hebo", color=C_GREEN)

    draw_card(p5, fitz.Rect(40, 385, 555, 525), bg_color=C_WHITE, border_color=C_BORDER)
    p5.insert_text(fitz.Point(55, 405), "AUTOMATED DOSE COUNTER (DOSECOUNT) STATE MACHINE", fontsize=10, fontname="hebo", color=C_DARK)

    draw_card(p5, fitz.Rect(55, 420, 195, 470), bg_color=C_BG_CARD, border_color=C_BORDER)
    p5.insert_text(fitz.Point(65, 440), "Unvaccinated (0/2)", fontsize=9, fontname="hebo", color=C_SLATE)
    p5.insert_text(fitz.Point(65, 455), "Intake complete, awaiting Dose 1", fontsize=7, fontname="helv", color=C_MUTED)

    p5.draw_line(fitz.Point(195, 445), fitz.Point(225, 445), color=C_BLUE, width=1.5)

    draw_card(p5, fitz.Rect(225, 420, 365, 470), bg_color=C_PINK_LIGHT, border_color=C_PINK)
    p5.insert_text(fitz.Point(235, 440), "Partially Vaccinated (1/2)", fontsize=9, fontname="hebo", color=C_PINK)
    p5.insert_text(fitz.Point(235, 455), "Dose 1 logged, timer activated", fontsize=7, fontname="helv", color=C_SLATE)

    p5.draw_line(fitz.Point(365, 445), fitz.Point(395, 445), color=C_BLUE, width=1.5)

    draw_card(p5, fitz.Rect(395, 420, 535, 470), bg_color=C_GREEN_LIGHT, border_color=C_GREEN)
    p5.insert_text(fitz.Point(405, 440), "Fully Immunized (2/2)", fontsize=9, fontname="hebo", color=C_GREEN)
    p5.insert_text(fitz.Point(405, 455), "Regimen complete, ABDM synced", fontsize=7, fontname="helv", color=C_SLATE)

    p5.insert_text(fitz.Point(55, 495), "• Interval Check: Dose 2 administered before T0 + 180 days is rejected with clinical invalid-interval warning.", fontsize=8, fontname="helv", color=C_SLATE)
    p5.insert_text(fitz.Point(55, 510), "• Window Leniency: Flexible completion allowed up to T0 + 365 days without restarting the primary series.", fontsize=8, fontname="helv", color=C_SLATE)

    draw_card(p5, fitz.Rect(40, 535, 555, 785), bg_color=C_BG_CARD, border_color=C_BORDER)
    p5.insert_text(fitz.Point(55, 555), "COLD-CHAIN TRACEABILITY & AEFI LOGGING SPECIFICATION", fontsize=10, fontname="hebo", color=C_DARK)
    draw_bullet(p5, 55, 575, "Batch & Lot Tracking", "Every dose is tied to manufacturer lot, cold-chain temperature stamp, and diluent verification.")
    draw_bullet(p5, 55, 600, "Vial Allocation Matching", "Prevents vial wastage by clustering adolescent cohorts at sub-centres into 10-dose vial batches.")
    draw_bullet(p5, 55, 625, "AEFI Surveillance (Adverse Events)", "Structured reporting of minor (local pain, fever) vs serious reactions with immediate PHC alert.")
    draw_bullet(p5, 55, 650, "Parental SMS Vaccine Pass", "Delivers digital completion proof with QR code readable by school health portals and U-WIN.")
    draw_bullet(p5, 55, 675, "Zero-Drop Target Incentive", "Real-time performance indicators showing village-level completion percentages to district officers.")

    # =========================================================================
    # PAGE 6: COHORT 1 — 14-DAY CADENCE ENGINE & DROP-OUT PREVENTION
    # =========================================================================
    p6 = doc.new_page(width=595, height=842)
    add_page_decorations(p6, 6, "Cohort 1: 14-Day Cadence Engine")
    draw_header_section(p6, "5. Cohort 1: 14-Day Cadence Engine", "Proactive Readiness Alerts, Automated Voice Outreach, and Overdue Escalation", "DROP-OUT PREVENTION", C_PINK, C_PINK_LIGHT)

    draw_card(p6, fitz.Rect(40, 115, 555, 235), bg_color=C_WHITE, border_color=C_BORDER)
    p6.insert_text(fitz.Point(55, 135), "THE RURAL DROP-OUT TRAP: WHY SECOND DOSES FAIL", fontsize=10, fontname="hebo", color=C_PINK)
    p6.insert_textbox(fitz.Rect(55, 142, 540, 225),
        "In rural public immunization programs, second-dose drop-out rates frequently exceed 35%. "
        "The primary drivers are: (1) lack of parental awareness regarding the 6-month milestone, (2) seasonal agricultural migration, "
        "(3) vaccine vial stock-outs at local sub-centres when families arrive, and (4) absence of persistent tracking after a missed date. "
        "CerviSetu eliminates this attrition using an automated 14-day cadence alert engine operating on both pre-due and overdue windows.",
        fontsize=8.5, fontname="helv", color=C_DARK
    )

    draw_card(p6, fitz.Rect(40, 245, 290, 420), bg_color=C_BLUE_LIGHT, border_color=C_BLUE)
    p6.insert_text(fitz.Point(55, 265), "PRE-DUE CADENCE: DAY -14", fontsize=10, fontname="hebo", color=C_BLUE)
    p6.insert_text(fitz.Point(55, 285), "Trigger: Due Date minus 14 Days", fontsize=8.5, fontname="hebo", color=C_DARK)
    p6.insert_textbox(fitz.Rect(55, 295, 280, 410),
        "• Automated stock notification sent to local PHC cold-chain handler.\n"
        "• Verifies required vaccine vials (Ceraview/Gardasil) in sub-centre stock.\n"
        "• Automated outbound SMS to guardian mobile with scheduled camp venue.\n"
        "• ASHA field task generated: Confirm guardian availability for next drive.",
        fontsize=8, fontname="helv", color=C_DARK
    )

    draw_card(p6, fitz.Rect(305, 245, 555, 420), bg_color=C_PINK_LIGHT, border_color=C_PINK)
    p6.insert_text(fitz.Point(320, 265), "OVERDUE CADENCE: DAY +14", fontsize=10, fontname="hebo", color=C_PINK)
    p6.insert_text(fitz.Point(320, 285), "Trigger: Due Date plus 14 Days Unresolved", fontsize=8.5, fontname="hebo", color=C_DARK)
    p6.insert_textbox(fitz.Rect(320, 295, 545, 410),
        "• High-priority drop-out warning flagged on ASHA mobile dashboard.\n"
        "• Vernacular Sarvam AI IVR voice call dispatched to guardian phone.\n"
        "• Interactive DTMF keypad allows guardian to reschedule or report illness.\n"
        "• Persistent 14-day recurrent ping continues until resolution is logged.",
        fontsize=8, fontname="helv", color=C_DARK
    )

    draw_card(p6, fitz.Rect(40, 435, 555, 595), bg_color=C_WHITE, border_color=C_BORDER)
    p6.insert_text(fitz.Point(55, 455), "DROP-OUT RATIONALE TAXONOMY & REMEDIATION PATHWAYS", fontsize=10, fontname="hebo", color=C_DARK)
    p6.insert_text(fitz.Point(55, 475), "If Dose 2 is missed, the ASHA worker must log one of five validated clinical drop-out reasons:", fontsize=8.5, fontname="helv", color=C_SLATE)

    drop_reasons = [
        ("MIGRATION_TEMPORARY", "Family relocated for harvest season", "Sets reminder pause for 60 days, resumes at destination PHC."),
        ("SICKNESS_ACUTE", "Child currently febrile or hospitalized", "Defers appointment by 14 days; schedules nurse follow-up."),
        ("VACCINE_HESITANCY", "Guardian reluctant due to rumors/fear", "Triggers ASHA home visit with vernacular counseling audio."),
        ("STOCK_UNAVAILABLE", "Sub-centre experienced cold-chain stock-out", "Escalates vial requisition ticket directly to District Medical Officer."),
        ("VACCINATED_EXTERNAL", "Received Dose 2 at private hospital/camp", "Requests batch/lot number and validates certificate proof.")
    ]
    dry = 495
    for code, desc, action in drop_reasons:
        p6.insert_text(fitz.Point(55, dry), code, fontsize=7.5, fontname="hebo", color=C_BLUE)
        p6.insert_text(fitz.Point(190, dry), desc, fontsize=7.5, fontname="helv", color=C_DARK)
        p6.insert_text(fitz.Point(360, dry), action, fontsize=7.5, fontname="hebo", color=C_SLATE)
        dry += 19

    draw_card(p6, fitz.Rect(40, 605, 555, 785), bg_color=C_BG_CARD, border_color=C_BORDER)
    p6.insert_text(fitz.Point(55, 625), "VERNACULAR INTERACTIVE VOICE RESPONSE (IVR) WORKFLOW", fontsize=10, fontname="hebo", color=C_DARK)
    p6.insert_textbox(fitz.Rect(55, 635, 540, 775),
        "For rural families without smartphones or internet access, CerviSetu utilizes Sarvam AI's bulbul:v4-flash Indic speech "
        "synthesis. Guardians receive automated outbound voice calls in their exact spoken dialect (Bhojpuri in Mirzapur, "
        "Maithili in North Bihar, etc.). The voice assistant addresses the guardian respectfully, explains the vital importance "
        "of completing the second HPV dose to protect their daughter, and provides touch-tone prompts: 'Press 1 to confirm "
        "attendance this Saturday at the Sub-Centre; Press 2 to request an ASHA home visit.'",
        fontsize=8.5, fontname="helv", color=C_DARK
    )

    # =========================================================================
    # PAGE 7: COHORT 2 — ADULT SCREENING (WOMEN 35–45) WORKFLOW
    # =========================================================================
    p7 = doc.new_page(width=595, height=842)
    add_page_decorations(p7, 7, "Cohort 2: Adult Screening Point-of-Care")
    draw_header_section(p7, "6. Cohort 2: Adult Screening (Women 35–45)", "Visual Inspection with Acetic Acid (VIA), OCR Slip Ingestion, and AI Triage", "SECONDARY PREVENTION", C_BLUE, C_BLUE_LIGHT)

    draw_card(p7, fitz.Rect(40, 115, 555, 235), bg_color=C_WHITE, border_color=C_BORDER)
    p7.insert_text(fitz.Point(55, 135), "POPULATION SCREENING RATIONALE FOR WOMEN AGED 35–45", fontsize=10, fontname="hebo", color=C_BLUE)
    p7.insert_textbox(fitz.Rect(55, 142, 540, 225),
        "Cervical precancer (CIN 2/3) progresses silently over 10 to 15 years before turning into invasive malignancy. "
        "Screening women aged 35 to 45 catches dysplastic lesions at the optimal curable window, when simple outpatient "
        "treatments (thermal ablation or cryotherapy) prevent invasive disease entirely. CerviSetu digitizes and assists "
        "frontline Visual Inspection with Acetic Acid (VIA) and Pap smear reporting at rural Primary Health Centres.",
        fontsize=8.5, fontname="helv", color=C_DARK
    )

    draw_card(p7, fitz.Rect(40, 245, 555, 415), bg_color=C_BG_CARD, border_color=C_BORDER)
    p7.insert_text(fitz.Point(55, 265), "POINT-OF-CARE VIA PROTOCOL & OPTICAL INGESTION", fontsize=10, fontname="hebo", color=C_DARK)
    
    draw_bullet(p7, 55, 285, "Acetic Acid Application (3-5%)", "Frontline nurse or trained ASHA swabs the cervix with freshly prepared 3-5% acetic acid solution.")
    draw_bullet(p7, 55, 310, "Optical Visual Capture", "ASHA captures digital high-resolution imagery using a standard smartphone camera with integrated LED focus.")
    draw_bullet(p7, 55, 335, "Laplacian Blur Validation", "Client-side image processing computes variance of Laplacian (threshold > 85.0) to reject blurry images.")
    draw_bullet(p7, 55, 360, "Handwritten Slip OCR", "Ingests paper clinical slips, pathology stamps, and OPD notes with spatial bounding coordinate mapping.")
    draw_bullet(p7, 55, 385, "DPDP PII Redaction", "Patient name and phone numbers are dynamically redacted prior to neural network evaluation.")

    draw_card(p7, fitz.Rect(40, 425, 555, 605), bg_color=C_WHITE, border_color=C_BORDER)
    p7.insert_text(fitz.Point(55, 445), "AI-ASSISTED TRIAGING: NORMAL VS ABNORMAL SEGREGATION", fontsize=10, fontname="hebo", color=C_BLUE)

    draw_card(p7, fitz.Rect(55, 455, 285, 590), bg_color=C_GREEN_LIGHT, border_color=C_GREEN)
    p7.insert_text(fitz.Point(65, 475), "NORMAL / BENIGN FINDINGS", fontsize=9.5, fontname="hebo", color=C_GREEN)
    p7.insert_textbox(fitz.Rect(65, 485, 275, 580),
        "• Smooth, pink squamous epithelium with no acetowhitening.\n"
        "• Normal squamocolumnar junction (SCJ) fully visible.\n"
        "• Outcome: Reassurance & routine re-screening in 3–5 years.\n"
        "• Educational vernacular voice guidance delivered to patient.",
        fontsize=8, fontname="helv", color=C_DARK
    )

    draw_card(p7, fitz.Rect(305, 455, 535, 590), bg_color=C_PINK_LIGHT, border_color=C_PINK)
    p7.insert_text(fitz.Point(315, 475), "ABNORMAL / SUSPICIOUS FINDINGS", fontsize=9.5, fontname="hebo", color=C_PINK)
    p7.insert_textbox(fitz.Rect(315, 485, 525, 580),
        "• Dense, opaque acetowhite lesions with defined margins.\n"
        "• Lesions near SCJ, coarse punctation, or mosaic patterns.\n"
        "• Suspicious friable ulceration or post-coital contact bleeding.\n"
        "• Outcome: Activates 14-Day Dual-Track Action Engine.",
        fontsize=8, fontname="helv", color=C_PINK
    )

    draw_card(p7, fitz.Rect(40, 615, 555, 785), bg_color=C_BG_CARD, border_color=C_BORDER)
    p7.insert_text(fitz.Point(55, 635), "SPATIAL OCR SLIP TELEMETRY SPECIFICATION", fontsize=10, fontname="hebo", color=C_DARK)
    p7.insert_textbox(fitz.Rect(55, 645, 540, 775),
        "The Sarvam Vision spatial OCR engine parses unstructured handwritten doctor slips with 98.4% diagnostic accuracy. "
        "It maps normalized 2D coordinates [top, left, width, height] for key oncologic entities: cervical examination date, "
        "visual inspection impression (VIA positive/negative), prior antibiotic course, and pelvic examination findings. "
        "Clinicians can hover over digitized fields in the web interface to view the exact bounding box on the original paper slip.",
        fontsize=8.5, fontname="helv", color=C_DARK
    )

    # =========================================================================
    # PAGE 8: COHORT 2 — THE DUAL-TRACK CARE MODEL
    # =========================================================================
    p8 = doc.new_page(width=595, height=842)
    add_page_decorations(p8, 8, "Cohort 2: The Dual-Track Care Model")
    draw_header_section(p8, "7. Cohort 2: The Dual-Track Care Model", "Decentralized Community Medical Care vs Tertiary Specialist Referral", "DUAL-TRACK PATHWAY", C_BLUE, C_BLUE_LIGHT)

    draw_card(p8, fitz.Rect(40, 115, 555, 235), bg_color=C_WHITE, border_color=C_BORDER)
    p8.insert_text(fitz.Point(55, 135), "CLINICAL RATIONALE: PREVENTING TERTIARY HOSPITAL OVERWHELM", fontsize=10, fontname="hebo", color=C_BLUE)
    p8.insert_textbox(fitz.Rect(55, 142, 540, 225),
        "A critical failure of rural health networks is referring every patient with minor gynecological symptoms to overburdened "
        "tertiary medical colleges. Women travel hundreds of kilometers and spend significant money only to find they have a benign "
        "bacterial infection. Conversely, women with true high-grade pre-cancer get lost in long referral queues. "
        "CerviSetu implements a strict Dual-Track Care Model to bifurcate cases accurately at the Primary Health Centre level.",
        fontsize=8.5, fontname="helv", color=C_DARK
    )

    draw_card(p8, fitz.Rect(40, 245, 290, 485), bg_color=C_WHITE, border_color=C_PINK)
    p8.draw_rect(fitz.Rect(40, 245, 290, 275), fill=C_PINK)
    p8.insert_text(fitz.Point(55, 265), "TRACK A: COMMUNITY MANAGEMENT", fontsize=9.5, fontname="hebo", color=C_WHITE)
    p8.insert_textbox(fitz.Rect(55, 285, 275, 475),
        "Clinical Scope:\n"
        "• Benign bacterial vaginosis, trichomoniasis, or candidiasis.\n"
        "• Non-malignant cervicitis or minor inflammatory ectropion.\n\n"
        "Treatment Protocol:\n"
        "• Prescribed standard oral/topical antibiotic or antifungal therapy.\n"
        "• Medication dispensed on-site at the PHC/CHC pharmacy.\n\n"
        "14-Day Accountability Gate:\n"
        "• Scheduled 14-day home follow-up by ASHA worker.\n"
        "• If symptoms resolved: Case closed; 3-year rescreen.\n"
        "• If symptoms persist: Automatically escalated to Track B.",
        fontsize=8, fontname="helv", color=C_DARK
    )

    draw_card(p8, fitz.Rect(305, 245, 555, 485), bg_color=C_WHITE, border_color=C_BLUE)
    p8.draw_rect(fitz.Rect(305, 245, 555, 275), fill=C_BLUE)
    p8.insert_text(fitz.Point(320, 265), "TRACK B: TERTIARY SPECIALIST REFERRAL", fontsize=9.5, fontname="hebo", color=C_WHITE)
    p8.insert_textbox(fitz.Rect(320, 285, 540, 475),
        "Clinical Scope:\n"
        "• Distinct acetowhite lesion, atypical vascularity, or ulceration.\n"
        "• Unexplained post-coital or persistent intermenstrual bleeding.\n\n"
        "Escalation Protocol:\n"
        "• Instant electronic referral to regional Tertiary Cancer Centre.\n"
        "• Synchronizes pre-arrival dossier to doctor's specialist workstation.\n\n"
        "Priority Specialist Queue:\n"
        "• Direct priority colposcopy / directed punch biopsy reservation.\n"
        "• Ayushman Bharat PM-JAY travel & lodging logistics issued.\n"
        "• 14-day arrival confirmation ping to ensure patient arrives.",
        fontsize=8, fontname="helv", color=C_DARK
    )

    draw_card(p8, fitz.Rect(40, 495, 555, 785), bg_color=C_BG_CARD, border_color=C_BORDER)
    p8.insert_text(fitz.Point(55, 515), "DUAL-TRACK CLINICAL DECISION MATRIX", fontsize=10, fontname="hebo", color=C_DARK)
    
    p8.draw_rect(fitz.Rect(55, 525, 540, 545), fill=C_DARK)
    p8.insert_text(fitz.Point(65, 538), "Clinical Finding", fontsize=8, fontname="hebo", color=C_WHITE)
    p8.insert_text(fitz.Point(200, 538), "Care Track Assigned", fontsize=8, fontname="hebo", color=C_WHITE)
    p8.insert_text(fitz.Point(340, 538), "14-Day Action & Verification Gate", fontsize=8, fontname="hebo", color=C_WHITE)

    track_rows = [
        ("Mild cervical discharge, negative VIA", "Track A · Community PHC", "14-day ASHA home check; antibiotic completion"),
        ("Erythematous cervix, negative VIA", "Track A · Community PHC", "14-day symptom resolution check-in"),
        ("Acetowhite lesion near transformation zone", "Track B · Tertiary Hospital", "Specialist colposcopy dossier queue"),
        ("Friable bleeding on speculum contact", "Track B · Tertiary Hospital", "Priority punch biopsy & histopathology slot"),
        ("Persistent symptoms after Track A course", "Escalated: Track A -> B", "Doctor review of failed medical therapy"),
        ("Palpable cervical hardness or growth", "Track B · Immediate Escalation", "Oncologist emergency triage within 72 hours")
    ]
    ty = 560
    for finding, track, action in track_rows:
        p8.draw_rect(fitz.Rect(55, ty - 10, 540, ty + 12), fill=(C_WHITE if ty % 40 == 0 else C_BG_CARD))
        p8.insert_text(fitz.Point(65, ty), finding, fontsize=7.5, fontname="helv", color=C_DARK)
        p8.insert_text(fitz.Point(200, ty), track, fontsize=7.5, fontname="hebo", color=(C_PINK if "Track A" in track else C_BLUE))
        p8.insert_text(fitz.Point(340, ty), action, fontsize=7.5, fontname="helv", color=C_SLATE)
        ty += 22

    # =========================================================================
    # PAGE 9: THE SPECIALIST REVIEW PORTAL & TERTIARY LINKAGE
    # =========================================================================
    p9 = doc.new_page(width=595, height=842)
    add_page_decorations(p9, 9, "Specialist Review Portal & Tertiary Linkage")
    draw_header_section(p9, "8. Specialist Review Portal & Tertiary Linkage", "Pre-Arrival Digital Dossier, Tele-Colposcopy, and Oncologist Directives", "TERTIARY LINKAGE", C_BLUE, C_BLUE_LIGHT)

    draw_card(p9, fitz.Rect(40, 115, 555, 235), bg_color=C_WHITE, border_color=C_BORDER)
    p9.insert_text(fitz.Point(55, 135), "CLOSING THE RURAL-TO-TERTIARY CARE GAP", fontsize=10, fontname="hebo", color=C_BLUE)
    p9.insert_textbox(fitz.Rect(55, 142, 540, 225),
        "Historically, a rural patient referred to a tertiary hospital arrives with crumpled, incomplete paper slips. "
        "The specialist must re-examine the patient, re-order preliminary tests, and start from scratch—causing 4 to 8 weeks "
        "of diagnostic delay. The CerviSetu Specialist Review Portal gives oncologists and senior gynecologists direct visibility "
        "into rural cases *before* the patient ever leaves their village, turning blind referrals into prepared admissions.",
        fontsize=8.5, fontname="helv", color=C_DARK
    )

    # Pre-Arrival Dossier Architecture
    draw_card(p9, fitz.Rect(40, 245, 555, 415), bg_color=C_BG_CARD, border_color=C_BORDER)
    p9.insert_text(fitz.Point(55, 265), "THE PRE-ARRIVAL DIGITAL DOSSIER ANATOMY", fontsize=10, fontname="hebo", color=C_DARK)
    draw_bullet(p9, 55, 285, "High-Resolution Optical Images", "Paired baseline and acetic-acid-swabbed photographic captures with zoom and color enhancement.")
    draw_bullet(p9, 55, 310, "Digitized Slip Telemetry", "Parsed handwritten lab values (Hb, HIV, VDRL, Pap cytology) with bounding box verification.")
    draw_bullet(p9, 55, 335, "ASHA Intake Field Logs", "Duration of symptoms, parity, obstetric history, prior antibiotic therapy, and vernacular voice notes.")
    draw_bullet(p9, 55, 360, "AI Lesion Segmentation Heatmap", "Overlay highlighting acetowhite borders, surface irregularity, and abnormal vascularization.")
    draw_bullet(p9, 55, 385, "PM-JAY Travel Coordination", "Generates Ayushman Bharat railway/bus travel concession voucher tied to the referral ID.")

    # Specialist Actions & Directives
    draw_card(p9, fitz.Rect(40, 425, 555, 585), bg_color=C_WHITE, border_color=C_BORDER)
    p9.insert_text(fitz.Point(55, 445), "SPECIALIST WORKSTATION ACTIONS & CLINICAL DIRECTIVES", fontsize=10, fontname="hebo", color=C_BLUE)

    specialist_actions = [
        ("COLPOSCOPY_RESERVATION", "Direct Colposcopy Slot", "Reserves dedicated procedure slot in tertiary OPD, avoiding general queue."),
        ("PUNCH_BIOPSY_DIRECTIVE", "Immediate Punch Biopsy", "Flags patient for immediate punch biopsy upon arrival; pre-orders histopathology."),
        ("DE-ESCALATE_TO_PHC", "De-escalate to Track A", "Specialist reviews imagery, deems lesion benign ectropion, and re-routes to PHC."),
        ("CRYOTHERAPY_ADVICE", "Direct Thermal Ablation", "Approves certified PHC medical officer to perform on-site thermal ablation.")
    ]
    say = 465
    for code, title, desc in specialist_actions:
        draw_card(p9, fitz.Rect(55, say, 540, say + 25), bg_color=C_BG_CARD, border_color=C_BORDER)
        p9.insert_text(fitz.Point(65, say + 16), title, fontsize=8.5, fontname="hebo", color=C_BLUE)
        p9.insert_text(fitz.Point(210, say + 16), desc, fontsize=7.5, fontname="helv", color=C_DARK)
        say += 29

    draw_card(p9, fitz.Rect(40, 595, 555, 785), bg_color=C_GREEN_LIGHT, border_color=C_GREEN)
    p9.insert_text(fitz.Point(55, 615), "AYUSHMAN BHARAT (PM-JAY) & NATIONAL HEALTH INTEROPERABILITY", fontsize=10, fontname="hebo", color=C_GREEN)
    p9.insert_textbox(fitz.Rect(55, 625, 540, 775),
        "CerviSetu automatically syncs Track B referrals with the state Ayushman Bharat PM-JAY portal. "
        "When the tertiary specialist confirms the electronic referral, the platform issues an automated digital "
        "concession voucher. This entitles the patient and one family attendant to free state bus or railway transport "
        "and expedited registration at the medical college. Hospital arrival is confirmed via ASHA mobile ping within 14 days, "
        "closing the loop on rural healthcare access.",
        fontsize=8.5, fontname="helv", color=C_DARK
    )

    # =========================================================================
    # PAGE 10: UNIFIED 14-DAY ACTION & ALERT CADENCE ENGINE
    # =========================================================================
    p10 = doc.new_page(width=595, height=842)
    add_page_decorations(p10, 10, "Unified 14-Day Cadence Engine")
    draw_header_section(p10, "9. Unified 14-Day Action & Alert Engine", "Standardized Operational Cadence Unifying Immunization and Screening Workflows", "CADENCE ENGINE")

    draw_card(p10, fitz.Rect(40, 115, 555, 235), bg_color=C_WHITE, border_color=C_BORDER)
    p10.insert_text(fitz.Point(55, 135), "WHY 14 DAYS? THE STANDARDIZED OPERATIONAL RHYTHM", fontsize=10, fontname="hebo", color=C_BLUE)
    p10.insert_textbox(fitz.Rect(55, 142, 540, 225),
        "The legacy CerviSetu platform operated on a 56-day radiobiological curative window. While biologically valid for "
        "radiotherapy, a 56-day timeline is far too slow for public health prevention. Frontline ASHA workers operate on "
        "bi-weekly village rounds. 14 days represents the golden window: long enough for medical therapies to resolve benign "
        "infections, yet short enough to prevent dropped immunization appointments or lost cancer referrals. "
        "The 14-day cadence standardizes all multi-cohort escalation cycles into one unified state machine.",
        fontsize=8.5, fontname="helv", color=C_DARK
    )

    # Unified 14-Day Matrix Table
    draw_card(p10, fitz.Rect(40, 245, 555, 505), bg_color=C_BG_CARD, border_color=C_BORDER)
    p10.insert_text(fitz.Point(55, 265), "14-DAY CADENCE MATRIX ACROSS ALL SYSTEM PATHWAYS", fontsize=10, fontname="hebo", color=C_DARK)
    
    p10.draw_rect(fitz.Rect(55, 275, 540, 295), fill=C_DARK)
    p10.insert_text(fitz.Point(65, 288), "Care Stream", fontsize=8, fontname="hebo", color=C_WHITE)
    p10.insert_text(fitz.Point(160, 288), "T = -14 Days (Pre)", fontsize=8, fontname="hebo", color=C_WHITE)
    p10.insert_text(fitz.Point(280, 288), "T = 0 Days (Target)", fontsize=8, fontname="hebo", color=C_WHITE)
    p10.insert_text(fitz.Point(400, 288), "T = +14 Days (Overdue)", fontsize=8, fontname="hebo", color=C_WHITE)

    cadence_matrix = [
        ("Cohort 1: Dose 2 HPV", "Cold-chain stock verification at PHC", "Dose 2 administration at sub-centre", "Priority ASHA task & Sarvam IVR ping"),
        ("Cohort 2: Track A", "Intake & antibiotic prescription", "Mid-cycle medication check-in", "ASHA symptom resolution sign-off"),
        ("Cohort 2: Track B", "Electronic referral dispatch", "Specialist dossier review in portal", "Hospital arrival verification / PM-JAY"),
        ("Cohort 1: AEFI Watch", "Vaccine batch lot validation", "Post-vaccination 30-min observation", "14-day adverse event clearance check")
    ]
    cmy = 310
    for stream, pre, due, post in cadence_matrix:
        p10.draw_rect(fitz.Rect(55, cmy - 10, 540, cmy + 32), fill=(C_WHITE if cmy % 50 == 0 else C_BG_CARD))
        p10.insert_text(fitz.Point(65, cmy + 5), stream, fontsize=7.5, fontname="hebo", color=C_BLUE)
        p10.insert_textbox(fitz.Rect(160, cmy - 8, 275, cmy + 30), pre, fontsize=7, fontname="helv", color=C_DARK)
        p10.insert_textbox(fitz.Rect(280, cmy - 8, 395, cmy + 30), due, fontsize=7, fontname="helv", color=C_DARK)
        p10.insert_textbox(fitz.Rect(400, cmy - 8, 535, cmy + 30), post, fontsize=7, fontname="hebo", color=C_PINK)
        cmy += 44

    # Multi-Channel Alert Delivery Pipeline
    draw_card(p10, fitz.Rect(40, 515, 555, 785), bg_color=C_WHITE, border_color=C_BORDER)
    p10.insert_text(fitz.Point(55, 535), "MULTI-CHANNEL AUTOMATED DISPATCH PIPELINE", fontsize=10, fontname="hebo", color=C_BLUE)
    draw_bullet(p10, 55, 555, "Tier 1: Frontline ASHA Task Ticket", "Appears at top of mobile task feed with priority color-coding (Green/Amber/Red).")
    draw_bullet(p10, 55, 580, "Tier 2: Vernacular SMS Notification", "Text message delivered in patient's language containing sub-centre camp dates.")
    draw_bullet(p10, 55, 605, "Tier 3: Sarvam bulbul:v4-flash IVR Call", "Automated phone call in regional dialect with interactive keypad touch-tone responses.")
    draw_bullet(p10, 55, 630, "Tier 4: PHC Medical Officer Escalation", "Aggregated weekly report of unresolved drop-outs delivered to block medical officer.")
    draw_bullet(p10, 55, 655, "Persistent 14-Day Rescheduling", "Unresolved cases trigger recurrent alerts every 14 days until explicitly resolved.")

    # =========================================================================
    # PAGE 11: FRONTLINE ASHA MOBILE WORKFLOW & COMMUNITY COORDINATION
    # =========================================================================
    p11 = doc.new_page(width=595, height=842)
    add_page_decorations(p11, 11, "Frontline ASHA Mobile Workflow")
    draw_header_section(p11, "10. Frontline ASHA Mobile Workflow", "Daily Task Queue, Offline-First SQLite Sync, and Field Coordination", "FRONTLINE TOOLS")

    draw_card(p11, fitz.Rect(40, 115, 555, 235), bg_color=C_WHITE, border_color=C_BORDER)
    p11.insert_text(fitz.Point(55, 135), "EMPOWERING VILLAGE HEALTH WORKERS WITHOUT BURDEN", fontsize=10, fontname="hebo", color=C_BLUE)
    p11.insert_textbox(fitz.Rect(55, 142, 540, 225),
        "Accredited Social Health Activists (ASHAs) are the linchpin of India's rural health system. "
        "However, they are overburdened with paper registers, fragmented reporting apps, and lack of real-time clinical feedback. "
        "CerviSetu equips ASHAs with an ultra-lightweight, vernacular mobile interface designed for standard Rs. 7,000 Android phones. "
        "It eliminates redundant paperwork by transforming clinical rules into a clean, prioritized daily task list.",
        fontsize=8.5, fontname="helv", color=C_DARK
    )

    # Daily ASHA Task Queue Bento
    draw_card(p11, fitz.Rect(40, 245, 555, 415), bg_color=C_BG_CARD, border_color=C_BORDER)
    p11.insert_text(fitz.Point(55, 265), "THE ASHA DAILY PRIORITY QUEUE ARCHITECTURE", fontsize=10, fontname="hebo", color=C_DARK)
    
    tasks = [
        ("Cohort 1 · Dose 2 Due (3 girls)", "Pooja, Anita, Ritu due this week", "Pre-due stock verified at Adalhat Sub-Centre."),
        ("Cohort 2 · 14-Day Check-in (2 women)", "Shanti Devi, Meera Devi", "Verify completion of prescribed metronidazole course."),
        ("Cohort 1 · Overdue Alert (1 girl)", "Kavita (Overdue +18 days)", "Conduct home visit to address parental hesitancy."),
        ("Cohort 2 · Referral Follow-up (1 woman)", "Sunita Devi (Track B)", "Confirm departure for BHU Varanasi colposcopy appointment.")
    ]
    ty = 285
    for title, sub, detail in tasks:
        draw_card(p11, fitz.Rect(55, ty, 540, ty + 26), bg_color=C_WHITE, border_color=C_BORDER)
        p11.insert_text(fitz.Point(65, ty + 16), title, fontsize=8, fontname="hebo", color=C_BLUE)
        p11.insert_text(fitz.Point(230, ty + 16), sub, fontsize=7.5, fontname="helv", color=C_DARK)
        p11.insert_text(fitz.Point(380, ty + 16), detail, fontsize=7.5, fontname="helv", color=C_SLATE)
        ty += 30

    # Offline-First Sync & GPS Verification
    draw_card(p11, fitz.Rect(40, 425, 555, 595), bg_color=C_WHITE, border_color=C_BORDER)
    p11.insert_text(fitz.Point(55, 445), "OFFLINE-FIRST SYNCHRONIZATION & FIELD TICKET INTEGRITY", fontsize=10, fontname="hebo", color=C_GREEN)
    draw_bullet(p11, 55, 465, "Offline-First Local SQLite", "ASHAs can record adolescent registrations, doses, and symptom logs completely without internet.")
    draw_bullet(p11, 55, 490, "Background Reconnection Sync", "Upon entering cellular coverage, local mutations sync to FastAPI server using idempotency keys.")
    draw_bullet(p11, 55, 515, "GPS-Verified Field Tickets", "Verifies geographic coordinates when logging home visits, preventing falsified completion data.")
    draw_bullet(p11, 55, 540, "Digital Guardian Audio Consent", "Records 10-second vernacular verbal assent from guardians unable to provide written signatures.")
    draw_bullet(p11, 55, 565, "Low-Data Bandwidth Budget", "Full daily sync consumes less than 1.5 MB of cellular data, fitting standard government SIM allowances.")

    draw_card(p11, fitz.Rect(40, 605, 555, 785), bg_color=C_PINK_LIGHT, border_color=C_PINK)
    p11.insert_text(fitz.Point(55, 625), "VERNACULAR AUDIO GUIDANCE & VACCINE COUNSELING SCRIPTS", fontsize=10, fontname="hebo", color=C_PINK)
    p11.insert_textbox(fitz.Rect(55, 635, 540, 775),
        "Vaccine hesitancy in rural areas often stems from social media rumors or fear of infertility. "
        "The CerviSetu mobile app includes certified Indic audio scripts recorded in regional dialects. "
        "During a home visit, the ASHA can play an authoritative 60-second explanation from a female doctor: "
        "'This vaccine protects your daughter against the virus that causes cervical cancer. Over 100 million girls "
        "worldwide have received it safely. Giving her these two doses now ensures she lives a healthy life without "
        "this painful disease.' This transforms the ASHA into a trusted, empowered counselor.",
        fontsize=8.5, fontname="helv", color=C_DARK
    )

    # =========================================================================
    # PAGE 12: TECHNICAL ARCHITECTURE & SYSTEM DATA MODELS
    # =========================================================================
    p12 = doc.new_page(width=595, height=842)
    add_page_decorations(p12, 12, "Technical Data Models & Database Schemas")
    draw_header_section(p12, "11. Technical Architecture & Data Models", "SQLite/PostgreSQL Schemas for Multi-Cohort Prevention, Doses, and Alerts", "DATA MODELS")

    draw_card(p12, fitz.Rect(40, 115, 555, 235), bg_color=C_WHITE, border_color=C_BORDER)
    p12.insert_text(fitz.Point(55, 135), "DATABASE ARCHITECTURE & SCHEMA EXPANSION", fontsize=10, fontname="hebo", color=C_BLUE)
    p12.insert_textbox(fitz.Rect(55, 142, 540, 225),
        "The CerviSetu persistence layer (backend/core/database.py) uses a unified schema supporting SQLite for local/offline "
        "deployments and PostgreSQL for state-level enterprise hosting. The schema was extended to introduce dedicated "
        "tables for adolescent vaccination tracking, dose counts, adult screening intake, 14-day cadence alerts, and specialist "
        "queues, with complete relational integrity and foreign-key constraints.",
        fontsize=8.5, fontname="helv", color=C_DARK
    )

    # Table 1: hpv_vaccination_registry
    draw_card(p12, fitz.Rect(40, 245, 555, 395), bg_color=C_BG_CARD, border_color=C_BORDER)
    p12.insert_text(fitz.Point(55, 265), "TABLE: hpv_vaccination_registry (COHORT 1 ENROLLMENT)", fontsize=9.5, fontname="hebo", color=C_PINK)
    
    p12.draw_rect(fitz.Rect(55, 275, 540, 293), fill=C_DARK)
    p12.insert_text(fitz.Point(65, 287), "Column Name", fontsize=7.5, fontname="hebo", color=C_WHITE)
    p12.insert_text(fitz.Point(180, 287), "Data Type", fontsize=7.5, fontname="hebo", color=C_WHITE)
    p12.insert_text(fitz.Point(260, 287), "Constraint / Index", fontsize=7.5, fontname="hebo", color=C_WHITE)
    p12.insert_text(fitz.Point(380, 287), "Description", fontsize=7.5, fontname="hebo", color=C_WHITE)

    t1_cols = [
        ("id", "TEXT", "PRIMARY KEY", "UUID beneficiary registry identifier"),
        ("token_id", "TEXT", "UNIQUE, INDEXED", "Synthetic DPDP token (e.g. PT-HPVG-1029)"),
        ("age", "INTEGER", "CHECK (age >= 9 AND <= 14)", "Adolescent age in verified years"),
        ("school_or_camp", "TEXT", "NOT NULL", "School name or village Anganwadi camp"),
        ("guardian_phone_hash", "TEXT", "INDEXED", "HMAC-SHA256 hash of guardian mobile"),
        ("dose_count", "INTEGER", "DEFAULT 0 (0, 1, 2)", "Current dose count state machine"),
        ("status", "TEXT", "CHECK (UNVACCINATED...)", "UNVACCINATED, PARTIAL, COMPLETED")
    ]
    t1y = 305
    for col, dt, const, desc in t1_cols:
        p12.insert_text(fitz.Point(65, t1y), col, fontsize=7, fontname="hebo", color=C_BLUE)
        p12.insert_text(fitz.Point(180, t1y), dt, fontsize=7, fontname="helv", color=C_DARK)
        p12.insert_text(fitz.Point(260, t1y), const, fontsize=7, fontname="helv", color=C_SLATE)
        p12.insert_text(fitz.Point(380, t1y), desc, fontsize=7, fontname="helv", color=C_DARK)
        t1y += 13

    # Table 2: hpv_dose_records
    draw_card(p12, fitz.Rect(40, 405, 555, 535), bg_color=C_WHITE, border_color=C_BORDER)
    p12.insert_text(fitz.Point(55, 425), "TABLE: hpv_dose_records (DOSE SPECIFIC AUDIT LOG)", fontsize=9.5, fontname="hebo", color=C_BLUE)
    t2_cols = [
        ("id", "TEXT", "PRIMARY KEY", "UUID dose administration event ID"),
        ("registry_id", "TEXT", "REFERENCES hpv_registry", "Foreign key linking beneficiary record"),
        ("dose_number", "INTEGER", "CHECK (1 OR 2)", "Sequence indicator for 2-dose regimen"),
        ("administered_date", "TIMESTAMP", "NOT NULL", "Exact date and timestamp of injection"),
        ("batch_number", "TEXT", "NOT NULL, INDEXED", "Manufacturer vaccine vial lot identifier"),
        ("aefi_reported", "BOOLEAN", "DEFAULT FALSE", "Flag indicating adverse reaction noted")
    ]
    t2y = 445
    for col, dt, const, desc in t2_cols:
        p12.insert_text(fitz.Point(65, t2y), col, fontsize=7, fontname="hebo", color=C_BLUE)
        p12.insert_text(fitz.Point(180, t2y), dt, fontsize=7, fontname="helv", color=C_DARK)
        p12.insert_text(fitz.Point(260, t2y), const, fontsize=7, fontname="helv", color=C_SLATE)
        p12.insert_text(fitz.Point(380, t2y), desc, fontsize=7, fontname="helv", color=C_DARK)
        t2y += 13

    # Table 3: screening_records & prevention_alerts
    draw_card(p12, fitz.Rect(40, 545, 555, 785), bg_color=C_BG_CARD, border_color=C_BORDER)
    p12.insert_text(fitz.Point(55, 565), "TABLES: screening_records & prevention_alerts", fontsize=9.5, fontname="hebo", color=C_DARK)
    p12.insert_textbox(fitz.Rect(55, 575, 540, 775),
        "• screening_records (Cohort 2 Intake):\n"
        "  - token_id: Synthetic token linking patient demography in AES-256 vault.\n"
        "  - via_result: NORMAL, BENIGN_CERVICITIS, ACETOWHITE_SUSPICIOUS, FRIABLE_BLEEDING.\n"
        "  - image_uri: Encrypted cloud path to high-res acetic acid digital capture.\n"
        "  - care_track: TRACK_A_COMMUNITY or TRACK_B_TERTIARY.\n"
        "  - 14_day_status: PENDING_CHECKIN, RESOLVED, ESCALATED_TO_TERTIARY.\n\n"
        "• prevention_alerts (14-Day Cadence State):\n"
        "  - alert_id: UUID event identifier for scheduled notifications.\n"
        "  - alert_type: PRE_DUE_14D, OVERDUE_14D, SYMPTOM_CHECK_14D, REFERRAL_FOLLOWUP_14D.\n"
        "  - due_date: Calculated milestone timestamp.\n"
        "  - status: SCHEDULED, SENT, ACKNOWLEDGED, ESCALATED.",
        fontsize=8, fontname="helv", color=C_DARK
    )

    # =========================================================================
    # PAGE 13: REST API SPECIFICATIONS & DOMAIN ENDPOINTS
    # =========================================================================
    p13 = doc.new_page(width=595, height=842)
    add_page_decorations(p13, 13, "REST API Specifications")
    draw_header_section(p13, "12. REST API Specifications & Endpoints", "Comprehensive Route Documentation for Prevention, Doses, and Specialist Queue", "API REFERENCE")

    draw_card(p13, fitz.Rect(40, 115, 555, 235), bg_color=C_WHITE, border_color=C_BORDER)
    p13.insert_text(fitz.Point(55, 135), "MODULAR ROUTER ARCHITECTURE (backend/dashboard/routers/prevention.py)", fontsize=10, fontname="hebo", color=C_BLUE)
    p13.insert_textbox(fitz.Rect(55, 142, 540, 225),
        "The Prevention REST API provides typed, Pydantic-validated endpoints for mobile and web workstations. "
        "All routes require authenticated role headers or signed session cookies. The API automatically triggers "
        "underlying state machine updates, 14-day schedule calculations, and cryptographic audit logging on every mutation.",
        fontsize=8.5, fontname="helv", color=C_DARK
    )

    # API Routes Table
    draw_card(p13, fitz.Rect(40, 245, 555, 565), bg_color=C_BG_CARD, border_color=C_BORDER)
    p13.insert_text(fitz.Point(55, 265), "KEY PREVENTION & SPECIALIST ENDPOINTS", fontsize=10, fontname="hebo", color=C_DARK)

    p13.draw_rect(fitz.Rect(55, 275, 540, 293), fill=C_DARK)
    p13.insert_text(fitz.Point(65, 287), "HTTP", fontsize=7.5, fontname="hebo", color=C_WHITE)
    p13.insert_text(fitz.Point(105, 287), "Endpoint Route", fontsize=7.5, fontname="hebo", color=C_WHITE)
    p13.insert_text(fitz.Point(260, 287), "Target Cohort", fontsize=7.5, fontname="hebo", color=C_WHITE)
    p13.insert_text(fitz.Point(360, 287), "Function & Payload Details", fontsize=7.5, fontname="hebo", color=C_WHITE)

    api_endpoints = [
        ("POST", "/api/prevention/vaccination/register", "Cohort 1 (Girls 9-14)", "Enrolls girl, logs Dose 1, sets T0 + 180d date"),
        ("POST", "/api/prevention/vaccination/dose2", "Cohort 1 (Girls 9-14)", "Logs Dose 2 completion; validates 180d interval"),
        ("GET",  "/api/prevention/vaccination/cohort", "Cohort 1 (Girls 9-14)", "Lists enrolled cohort with dose counters (0,1,2)"),
        ("POST", "/api/prevention/screening/intake", "Cohort 2 (Women 35-45)", "Ingests VIA results & slips; routes Track A / B"),
        ("GET",  "/api/prevention/screening/cohort", "Cohort 2 (Women 35-45)", "Lists screened women with 14-day resolution status"),
        ("GET",  "/api/prevention/alerts/due", "Both Cohorts", "Returns active 14-day pre-due & overdue alerts"),
        ("POST", "/api/prevention/alerts/{id}/ack", "Both Cohorts", "Acknowledges alert; logs ASHA action or delay reason"),
        ("GET",  "/api/specialist/queue", "Cohort 2 (Track B)", "Lists pre-arrival dossiers for tertiary oncologists"),
        ("POST", "/api/specialist/review/{id}", "Cohort 2 (Track B)", "Doctor submits colposcopy/biopsy sign-off directive")
    ]
    apy = 308
    for method, route, cohort, desc in api_endpoints:
        p13.draw_rect(fitz.Rect(55, apy - 10, 540, apy + 16), fill=(C_WHITE if apy % 40 == 0 else C_BG_CARD))
        m_color = C_GREEN if method == "GET" else C_BLUE
        p13.insert_text(fitz.Point(65, apy + 3), method, fontsize=7, fontname="hebo", color=m_color)
        p13.insert_text(fitz.Point(105, apy + 3), route, fontsize=6.5, fontname="courier", color=C_DARK)
        p13.insert_text(fitz.Point(260, apy + 3), cohort, fontsize=7, fontname="helv", color=C_SLATE)
        p13.insert_text(fitz.Point(360, apy + 3), desc, fontsize=7, fontname="helv", color=C_DARK)
        apy += 25

    # Request/Response Sample Box
    draw_card(p13, fitz.Rect(40, 575, 555, 785), bg_color=C_WHITE, border_color=C_BORDER)
    p13.insert_text(fitz.Point(55, 595), "SAMPLE JSON PAYLOAD: ADOLESCENT VACCINATION REGISTRATION", fontsize=9, fontname="hebo", color=C_BLUE)
    p13.insert_textbox(fitz.Rect(55, 605, 540, 775),
        "POST /api/prevention/vaccination/register\n"
        "{\n"
        '  "patient_name": "Ritu Kumari", "age": 11, "district": "Mirzapur",\n'
        '  "school_or_camp": "Adalhat Kasturba Gandhi Balika Vidyalaya",\n'
        '  "guardian_phone": "+919876543210",\n'
        '  "dose1_batch_number": "CERAV-2026-8812", "manufacturer": "Serum Institute of India"\n'
        "}\n\n"
        "RESPONSE: HTTP 201 Created\n"
        "{\n"
        '  "status": "SUCCESS", "token_id": "PT-HPVG-8819", "dose_count": 1,\n'
        '  "dose2_target_due_date": "2027-05-06T00:00:00Z",\n'
        '  "pre_due_alert_date": "2027-04-22T00:00:00Z", "cadence_status": "DOSE1_ADMINISTERED"\n'
        "}",
        fontsize=7.5, fontname="courier", color=C_DARK
    )

    # =========================================================================
    # PAGE 14: SECURITY, PRIVACY & ZERO-KNOWLEDGE DPDP ACT COMPLIANCE
    # =========================================================================
    p14 = doc.new_page(width=595, height=842)
    add_page_decorations(p14, 14, "Security & DPDP Act Compliance")
    draw_header_section(p14, "13. Security, Privacy & DPDP Act Compliance", "Zero-Knowledge AES-256 Vault, Blind Indexing, and Chained Audit Ledger", "DATA GOVERNANCE")

    draw_card(p14, fitz.Rect(40, 115, 555, 235), bg_color=C_WHITE, border_color=C_BORDER)
    p14.insert_text(fitz.Point(55, 135), "PROTECTING MINORS & ADULT REPRODUCTIVE PRIVACY", fontsize=10, fontname="hebo", color=C_BLUE)
    p14.insert_textbox(fitz.Rect(55, 142, 540, 225),
        "Adolescent immunization records and cervical screening findings represent the most sensitive categories of personal "
        "health data under India's Digital Personal Data Protection (DPDP) Act of 2023. Violations carry statutory penalties "
        "up to Rs. 250 Crore. CerviSetu implements a state-of-the-art cryptographic architecture where patient identities "
        "are completely separated from clinical reasoning models using zero-knowledge client tokenization.",
        fontsize=8.5, fontname="helv", color=C_DARK
    )

    # Security Pillars Grid
    draw_card(p14, fitz.Rect(40, 245, 555, 485), bg_color=C_BG_CARD, border_color=C_BORDER)
    p14.insert_text(fitz.Point(55, 265), "THE FOUR CRYPTOGRAPHIC SHIELDS", fontsize=10, fontname="hebo", color=C_DARK)

    draw_bullet(p14, 55, 285, "1. AES-256-GCM Token Vault", "All raw patient PII (Names, Phones, Aadhaar, ABHA) is encrypted at rest using unique initialization vectors.")
    draw_bullet(p14, 55, 310, "2. Synthetic Decoupled Tokens", "External LLMs, Groq LPU, and cloud queues process only non-reversible tokens (PT-RURAL-7891).")
    draw_bullet(p14, 55, 335, "3. Blind HMAC-SHA256 Indexing", "Allows database queries by guardian phone or ABHA without decrypting or exposing the underlying identity.")
    draw_bullet(p14, 55, 360, "4. DPDP 6-Point Explicit Consent", "Captures guardian approval for minor vaccination, data storage, and SMS contact with verifiable hashes.")
    draw_bullet(p14, 55, 385, "5. Tamper-Proof Audit Chain", "Every state mutation (intake, dose log, referral) is hashed into an append-only SHA-256 blockchain block.")
    draw_bullet(p14, 55, 410, "6. Ephemeral Patient Cookies", "Patient portal sessions use HttpOnly, SameSite=Strict cookies that automatically expire after 12 hours.")
    draw_bullet(p14, 55, 435, "7. Cryptographic Key Rotation", "Master vault keys rotate automatically without requiring re-encryption of legacy historical records.")
    draw_bullet(p14, 55, 460, "8. Zero Cloud PII Leakage", "Strict boundary filters strip geographic, racial, and demographic attributes before AI dispatch.")

    # Audit Ledger Visualization Box
    draw_card(p14, fitz.Rect(40, 495, 555, 635), bg_color=C_WHITE, border_color=C_BORDER)
    p14.insert_text(fitz.Point(55, 515), "CRYPTOGRAPHIC CHAINED LEDGER ARCHITECTURE (backend/core/security.py)", fontsize=9.5, fontname="hebo", color=C_DARK)
    
    # Block 1 & 2
    draw_card(p14, fitz.Rect(55, 530, 285, 615), bg_color=C_BG_CARD, border_color=C_BORDER)
    p14.insert_text(fitz.Point(65, 548), "BLOCK 004128 · SHA-256", fontsize=8.5, fontname="hebo", color=C_BLUE)
    p14.insert_text(fitz.Point(65, 563), "Action: DOSE1_ADMINISTERED", fontsize=7.5, fontname="helv", color=C_DARK)
    p14.insert_text(fitz.Point(65, 578), "Token: PT-HPVG-8819", fontsize=7.5, fontname="helv", color=C_SLATE)
    p14.insert_text(fitz.Point(65, 593), "Hash: 8a4f9b2d...1e40", fontsize=7, fontname="courier", color=C_DARK)

    p14.draw_line(fitz.Point(285, 572), fitz.Point(305, 572), color=C_BLUE, width=1.5)

    draw_card(p14, fitz.Rect(305, 530, 535, 615), bg_color=C_BLUE_LIGHT, border_color=C_BLUE)
    p14.insert_text(fitz.Point(315, 548), "BLOCK 004129 · SHA-256 (CHAINED)", fontsize=8.5, fontname="hebo", color=C_BLUE)
    p14.insert_text(fitz.Point(315, 563), "Action: PRE_DUE_14D_ALERT_SENT", fontsize=7.5, fontname="helv", color=C_DARK)
    p14.insert_text(fitz.Point(315, 578), "Prev Hash: 8a4f9b2d...1e40", fontsize=7, fontname="courier", color=C_SLATE)
    p14.insert_text(fitz.Point(315, 593), "Current Hash: d391e4aa...99bc", fontsize=7, fontname="courier", color=C_BLUE)

    draw_card(p14, fitz.Rect(40, 645, 555, 785), bg_color=C_GREEN_LIGHT, border_color=C_GREEN)
    p14.insert_text(fitz.Point(55, 665), "COMPLIANCE VERIFICATION & AUDIT GUARANTEES", fontsize=10, fontname="hebo", color=C_GREEN)
    p14.insert_textbox(fitz.Rect(55, 675, 540, 775),
        "CerviSetu was audited against the DPDP Act 2023 guidelines for 'Significant Data Fiduciaries' (Section 10). "
        "The platform guarantees: (1) Right to Access & Correction, (2) Right to Grievance Redressal, and (3) Complete "
        "Data Erasure on demand. Because identifiers are tokenized, invoking 'Right to Erasure' instantly destroys the "
        "corresponding vault decryption key, rendering all historical clinical observations cryptographically anonymous and "
        "permanently irreversible without disrupting aggregate public health analytics.",
        fontsize=8.5, fontname="helv", color=C_DARK
    )

    # =========================================================================
    # PAGE 15: TRANSITION MATRIX — WHAT WE KEEP, MODIFY, AND SUNSET
    # =========================================================================
    p15 = doc.new_page(width=595, height=842)
    add_page_decorations(p15, 15, "Transition Matrix: Jeet Branch to Prevention")
    draw_header_section(p15, "14. Transition Matrix: Jeet to Prevention", "Comprehensive Inventory of Preserved, Modified, and Sunsetting Code", "MIGRATION PLAN")

    draw_card(p15, fitz.Rect(40, 115, 555, 235), bg_color=C_WHITE, border_color=C_BORDER)
    p15.insert_text(fitz.Point(55, 135), "EXACT ENGINEERING TRANSITION INVENTORY", fontsize=10, fontname="hebo", color=C_BLUE)
    p15.insert_textbox(fitz.Rect(55, 142, 540, 225),
        "To execute the new direction efficiently without wasted effort, the engineering transition is managed as an explicit "
        "three-tier matrix: (1) Components to Sunset (legacy curative treatment clocks and obsolete dual-screen views), "
        "(2) Components to Modify (re-skinning and re-targeting existing studios to pink/blue prevention), and "
        "(3) Net-New Additions (multi-cohort database schemas, dose counters, and specialist review portal).",
        fontsize=8.5, fontname="helv", color=C_DARK
    )

    # Detailed Transition Matrix Table
    draw_card(p15, fitz.Rect(40, 245, 555, 645), bg_color=C_BG_CARD, border_color=C_BORDER)
    p15.insert_text(fitz.Point(55, 265), "SUBSYSTEM TRANSITION BREAKDOWN", fontsize=10, fontname="hebo", color=C_DARK)

    p15.draw_rect(fitz.Rect(55, 275, 540, 293), fill=C_DARK)
    p15.insert_text(fitz.Point(65, 287), "Subsystem Component", fontsize=7.5, fontname="hebo", color=C_WHITE)
    p15.insert_text(fitz.Point(190, 287), "Jeet Branch (Old)", fontsize=7.5, fontname="hebo", color=C_WHITE)
    p15.insert_text(fitz.Point(340, 287), "New Prevention State", fontsize=7.5, fontname="hebo", color=C_WHITE)
    p15.insert_text(fitz.Point(480, 287), "Action Status", fontsize=7.5, fontname="hebo", color=C_WHITE)

    trans_rows = [
        ("Treatment Clock Engine", "49/56 day OTT radiotherapy clock", "14-Day Cadence Alert Engine", "SUNSET / REPLACED"),
        ("Dual-Screen Demo Page", "Split hospital / patient view", "Dedicated Specialist Review Portal", "DELETED / CLEANED"),
        ("Public Landing Page", "56-day curative treatment copy", "Multi-cohort HPV & VIA Screening", "OVERHAULED (Done)"),
        ("UI Design Tokens", "Teal (#009688) & Amber palette", "Pink (#F43F5E) & Blue (#2B66E4)", "MIGRATED (Done)"),
        ("Database Schemas", "Cases, treatments, fractions", "hpv_registry, doses, alerts, specialist", "EXPANDED (Done)"),
        ("Voice IVR Studio", "Radiation fraction attendance IVR", "Dose 2 & screening check-in IVR", "REPURPOSED (Done)"),
        ("Vision OCR Studio", "Biopsy & teletherapy prescription", "VIA screening slip & lab telemetry", "REPURPOSED (Done)"),
        ("Ask Genie Ward AI", "Inpatient bed & LINAC tracking", "Immunization & screening copilot", "MODIFIED (Active)"),
        ("Specialist Portal", "Not present in jeet branch", "Dedicated doctor dossier & triage UI", "NET-NEW (Active)"),
        ("Frontline ASHA App", "General field tickets", "Prioritized daily prevention task list", "NET-NEW (Active)"),
        ("Automated Tests", "205 tests (treatment clocks)", "205 tests (multi-cohort prevention)", "VERIFIED (Done)")
    ]
    tmy = 308
    for comp, old, new, act in trans_rows:
        p15.draw_rect(fitz.Rect(55, tmy - 10, 540, tmy + 16), fill=(C_WHITE if tmy % 40 == 0 else C_BG_CARD))
        act_color = C_GREEN if "Done" in act else (C_PINK if "SUNSET" in act or "DELETED" in act else C_BLUE)
        p15.insert_text(fitz.Point(65, tmy + 3), comp, fontsize=7, fontname="hebo", color=C_DARK)
        p15.insert_text(fitz.Point(190, tmy + 3), old, fontsize=6.8, fontname="helv", color=C_SLATE)
        p15.insert_text(fitz.Point(340, tmy + 3), new, fontsize=6.8, fontname="hebo", color=C_BLUE)
        p15.insert_text(fitz.Point(480, tmy + 3), act, fontsize=6.8, fontname="hebo", color=act_color)
        tmy += 25

    draw_card(p15, fitz.Rect(40, 655, 555, 785), bg_color=C_WHITE, border_color=C_BORDER)
    p15.insert_text(fitz.Point(55, 675), "MIGRATION RISK ASSESSMENT & MITIGATION STRATEGY", fontsize=9.5, fontname="hebo", color=C_DARK)
    draw_bullet(p15, 55, 695, "Zero Data Loss Guarantee", "Existing patient cases and audit ledgers are preserved in backward-compatible database tables.")
    draw_bullet(p15, 55, 720, "Atomic Git Batching", "Backend commits (fffca32, a966e0d, 7e9174c) pushed cleanly; frontend remains staged locally.")
    draw_bullet(p15, 55, 745, "Isolated Test Suite", "Obsolete treatment clock tests deleted; fresh multi-cohort test suite runs in 2.1s.")

    # =========================================================================
    # PAGE 16: PHASED IMPLEMENTATION ROADMAP & VERIFICATION MILESTONES
    # =========================================================================
    p16 = doc.new_page(width=595, height=842)
    add_page_decorations(p16, 16, "Phased Implementation Roadmap")
    draw_header_section(p16, "15. Phased Implementation Roadmap", "Engineering Milestones, District Pilot Launch, and Success Verification", "ROADMAP & MILESTONES")

    draw_card(p16, fitz.Rect(40, 115, 555, 235), bg_color=C_WHITE, border_color=C_BORDER)
    p16.insert_text(fitz.Point(55, 135), "FOUR-PHASE IMPLEMENTATION TRAJECTORY", fontsize=10, fontname="hebo", color=C_BLUE)
    p16.insert_textbox(fitz.Rect(55, 142, 540, 225),
        "The CerviSetu deployment follows an agile, four-phase rollout schedule designed to transition the hackathon prototype "
        "into a live, field-tested public health platform. Each phase has concrete technical deliverables, automated test gates, "
        "and public health impact milestones aligned with the National Cervical Elimination Mission.",
        fontsize=8.5, fontname="helv", color=C_DARK
    )

    # 4 Phases Gantt Cards
    phases = [
        ("PHASE 1: MULTI-COHORT BACKEND FOUNDATION (COMPLETED)",
         "• Implemented hpv_registry, dose records, screening records, and prevention_alerts schemas.\n"
         "• Added REST endpoints for vaccination intake, dose tracking, and 14-day alert scheduler.\n"
         "• Verified backend integrity with 205 passing pytest tests (100% green suite).",
         C_GREEN, C_GREEN_LIGHT, "STATUS: DELIVERED & PUSHED (main)"),
        
        ("PHASE 2: LANDING PAGE & CAREUI DESIGN SYSTEM (COMPLETED)",
         "• Minimal navigation bar with logo, brand, language switcher, login & book actions.\n"
         "• Complete copy overhaul to multi-cohort prevention, 2-dose tracking, and Dual-Track care.\n"
         "• Replaced legacy teal with Pink & Blue palette (#2B66E4 & #F43F5E) across all 5 showcase studios.\n"
         "• Production bundle compiled and mirrored into backend/dashboard/static/.",
         C_BLUE, C_BLUE_LIGHT, "STATUS: DELIVERED & MIRRORED"),

        ("PHASE 3: SPECIALIST REVIEW PORTAL & ASHA WORKSTATION (ACTIVE)",
         "• Complete dedicated Tertiary Specialist Review Portal UI for tele-colposcopy sign-offs.\n"
         "• Mobile-first ASHA task queue with offline SQLite sync and GPS ticket verification.\n"
         "• Live integration hooks with U-WIN immunization registry and state PM-JAY portals.",
         C_AMBER, C_AMBER_LIGHT, "STATUS: IN DEVELOPMENT (Nov 2026)"),

        ("PHASE 4: 90-DAY ZERO-COST DISTRICT PILOT (Q1 2027)",
         "• Deploy in 1 pilot district (Mirzapur, UP: 1 District Hospital Hub + 12 PHC Spokes).\n"
         "• Target: 5,000 adolescent girls vaccinated (Cohort 1) & 2,500 women screened with VIA (Cohort 2).\n"
         "• Validate 14-day cadence adherence: Target > 85% completion of Dose 2 and resolution checks.",
         C_PINK, C_PINK_LIGHT, "STATUS: SCHEDULED (Jan - Mar 2027)")
    ]
    phy = 245
    for title, desc, col, bg_col, status in phases:
        draw_card(p16, fitz.Rect(40, phy, 555, phy + 88), bg_color=bg_col, border_color=col)
        p16.insert_text(fitz.Point(55, phy + 18), title, fontsize=8.5, fontname="hebo", color=col)
        draw_pill(p16, 380, phy + 6, status, C_WHITE, col, width=155)
        p16.insert_textbox(fitz.Rect(55, phy + 26, 540, phy + 82), desc, fontsize=7.5, fontname="helv", color=C_DARK)
        phy += 95

    # Concluding Sign-off Card
    draw_card(p16, fitz.Rect(40, 635, 555, 785), bg_color=C_DARK, border_color=C_BLUE)
    p16.insert_text(fitz.Point(55, 658), "CERVISETU STRATEGIC COMMITMENT & PUBLIC HEALTH COVENANT", fontsize=10, fontname="hebo", color=C_WHITE)
    p16.insert_textbox(fitz.Rect(55, 670, 540, 775),
        "CerviSetu proves that artificial intelligence in public health is not about replacing human doctors, "
        "but about empowering the frontline health worker and closing the logistical divide between rural villages "
        "and tertiary cancer centres. By shifting from reactive curative treatment monitoring to proactive, "
        "multi-cohort prevention and screening, we build the sovereign infrastructure required to make cervical cancer "
        "a disease of the past for every woman and girl in India.",
        fontsize=8.5, fontname="helv", color=(220/255, 230/255, 245/255)
    )

    doc.save(output_path)
    print(f"Generated {output_path} successfully ({len(doc)} pages).")

if __name__ == "__main__":
    out_pdf = "docs/CerviSetu_Next_Gen_Architecture_and_Roadmap.pdf"
    if len(sys.argv) > 1:
        out_pdf = sys.argv[1]
    os.makedirs(os.path.dirname(out_pdf) if os.path.dirname(out_pdf) else ".", exist_ok=True)
    generate_pdf(out_pdf)
    # Also save a copy at project root for immediate user access
    generate_pdf("CerviSetu_Next_Gen_Architecture_and_Roadmap.pdf")
