# Document Reading (OCR) — Decision Support Only

Document reading helps doctors copy findings from screening and hospital documents into the referral record. **It is not a diagnostic tool and has not been validated for clinical use.** Nothing it reads reaches the record until a doctor confirms it.

## Who can use it
| Portal | What they can do |
|---|---|
| Doctor/Staff (doctor) | Upload, read, review, edit, confirm or reject; view the original file |
| Doctor/Staff (nurse) | Upload and read; cannot confirm findings |
| ASHA | Upload screening reports and referral slips only, with consent. Sees upload status ("awaiting review"), never extracted findings or clinical reports |
| Patient | No access to documents or extracted findings |
| Admin | No access to patient documents or findings |

Enforced on the server (`backend/core/staff_session.py` role rules and `_own` referral checks), covered by `tests/test_document_reading.py`.

## Supported document types
Pap / cytology, HPV DNA, VIA record, screening report, referral slip, colposcopy report and image, cervical biopsy, histopathology, laboratory report, consultation note, MRI report, other medical records. PNG, JPEG or PDF (multi-page), up to 10 MB.

## How it works
Upload → file type and size check → duplicate check (same file is kept once) → AES-256-GCM encrypted storage → image quality check (blurred scans rejected) → OCR (Sarvam Vision) → structured extraction → validation → doctor review → explicit confirmation → clinical record.

- **Extraction**: the language model is told to report only what is written and to quote the supporting text. Each quote is checked against the OCR text; a value whose quote cannot be found is marked *Needs review*. Without a language model, exact-wording rules are used instead.
- **Fields**: patient ID, report date, facilities, screening method, Pap/HPV/VIA results, referral recommendation, transformation zone, colposcopic impression, lesion description, biopsy recommendation, specimen type and date, histopathology result, CIN grade and invasive malignancy *as reported*, histological subtype, report status, documented recommendation, further investigation, follow-up date and documented care plan.
- **Confidence**: the OCR provider gives no reliable scores, so none are invented. A field is *High confidence* only when its quote is found, the wording is clear and it does not conflict with the record; otherwise *Needs review* with the reason. Rejected images are *Unreadable*.
- **Safety checks**: a patient ID that does not match the referral warns and marks every field for review. Values that differ from the record are shown side by side. The AI summary restates the document only and always carries "This is an extracted summary and has not been confirmed by CerviSetu."
- **Untrusted input**: document text is treated as data and never as instructions.

## What confirmation changes
Only the ticked fields, with the doctor's edits. Colposcopic impression, histopathology result and follow-up date go to their record fields through the same checks as manual entry; other fields are appended to remarks with the document name. Referral status, final diagnosis and treatment plan are **never** changed by document reading, and follow-up never closes because a document was uploaded. Read, confirm and reject are written to the referral history and audit ledger. Manual entry is unchanged.

## What it cannot do
It does not diagnose, grade lesions from images, infer cancer from screening results or urgency, or recommend treatment.

## Running locally
Set in `.env`: `SARVAM_API_KEY`, `CERVISETU_OCR_ENABLED=1`, `CERVISETU_OCR_PROVIDER=sarvam_vision`. Without them, uploads still work and the reader says it is switched off. Fictional test documents are in `docs/demo_documents/` (every one is marked FICTIONAL TEST DOCUMENT).

## Before real clinical use
Accuracy validation on real (consented, de-identified) reports, a data processing agreement with the OCR provider (document images are sent to it), clinical governance sign-off, tuning of the image-quality check for scanned paper (it currently warns about glare on clean white documents), and staff training.
