# CerviSetu — Handover

Last updated 2026-11-07. Read this first, then `README.md` and `docs/OCR_DOCUMENT_READING.md`.

## 1. What the product is
CerviSetu is a cervical cancer **referral pathway** for Mumbai.
- A woman with an abnormal screening (VIA, VILI, Pap or HPV) at a health post is referred to an assigned hospital.
- The system follows her for **14 days**:
  - Days 1 to 10: daily reminders.
  - Days 11 to 13: calls from the health post.
  - Day 14: an ASHA home visit that records her decision.
- Follow-up stops when the hospital confirms she has arrived.
- Doctors then record colposcopy, biopsy, histopathology, diagnosis and plan.
- Statuses: REFERRED → ARRIVED → COLPOSCOPY_DONE → BIOPSY_TAKEN → REPORT_READY → TREATMENT_PLANNED → COMPLETED, plus DECLINED (which goes to doctor review).

**It is not a diagnostic tool.** AI and OCR only propose; clinicians confirm.

## 2. Repositories, branches and state
- **Remote:** `https://github.com/ihatecoding01/health_hackathon.git`
- **Main working clone:** `/Users/jeetchavan/health_hackathon_main`
  - It is on branch `main` at commit `7bc312b`: the redesign merged plus the README rewrite, both pushed.
  - Branch `orion-redesign` is also pushed. It holds the redesign before the merge.
- **Uncommitted on `main` (the user asked not to commit yet):** the OCR / document-reading feature.
  - New files: `backend/tools/document_reading.py`, `frontend/src/components/clinical/DocumentReview.tsx`, `tests/test_document_reading.py`, `docs/OCR_DOCUMENT_READING.md`, `docs/demo_documents/` (10 fictional documents), this `HANDOVER.md`.
  - Edited files: `backend/tools/referral_pathway.py` (new upload kinds, sha256 duplicate check, `review_status` in `list_files`), `backend/dashboard/routers/referrals.py` (read, reading, confirm and reject routes), `backend/core/staff_session.py` (role rules), `frontend/src/api/referrals.ts`, `frontend/src/components/clinical/CaseRecord.tsx`, `README.md` (OCR section), rebuilt `backend/dashboard/static/`.
- **The other clone** `/Users/jeetchavan/health_hackathon` (branch `jeet`) is older. Don't work there.

## 3. Rules the owner has set
- Never commit or push unless asked. Never add AI attribution (no Co-Authored-By lines) to commits or PRs.
- Never print `.env` secrets. Never mention API key rotation or Sarvam keys. Don't look at "finaxis".
- Call a feature "built" only if it is production level. Demo, simulated or sandbox features don't count.
- No emoji in the UI. Don't break layout in any of the 7 languages.
- Clinical safety: invent no data, infer no diagnosis, and label sample data clearly.
- The owner wants concise, token-efficient work and doesn't want subagents unless asked.

## 4. Stack
- **Frontend:** React 19, TypeScript, Vite 8, Tailwind v4, Three.js (3D cervix on the landing page), Leaflet (maps).
- **Backend:** FastAPI on Python 3.14 with SQLite (Supabase optional) and LangGraph.
- **AI:** Sarvam (LLM, speech-to-text, text-to-speech, Vision OCR), with Groq as a fallback LLM.
- **Messaging:** Twilio when configured; otherwise simulated, and labelled as simulated.
- **Security:** AES-256-GCM vault and file encryption, HMAC-hashed identifiers, signed HttpOnly sessions, SHA-256 chained audit ledger.

## 5. Portals
The product has **four portals plus a public landing page and login**: **Doctor/Staff, ASHA, Patient and Admin**. All of them use the shared `components/app/AppShell.tsx` with Ask Genie.

| Portal | Main screens | Key files |
|---|---|---|
| Landing (public) | Hero with the 3D cervix model, 14-day journey, product tour, showcase studios, Book screening | `components/landing/*`, `components/showcase/*` |
| Login (gateway) | Staff sign-in, ABHA registration (sandbox), patient mobile OTP | `components/auth/*` |
| Doctor/Staff | Dashboard (urgent cases only), Referral cases (opens on "Needs attention", with All patients and other filters), Case record (overview, record, follow-up, consultation and voice, consent, reports rail, **Documents with OCR review**), Register patient, Follow-up tracker, ASHA network, Prevention, Audit | `components/clinical/Worklists.tsx`, `ClinicianEncounter.tsx`, `CaseRecord.tsx`, `DocumentReview.tsx`, `ReferralIntake.tsx`, `dashboard/DashboardLayout.tsx` |
| ASHA | My follow-ups (home visits due first), call and visit outcomes, Register patient (duplicate check, consent, screening-paper uploads only), Closed | `components/field/AshaHome.tsx`, `RegisterPatient.tsx` |
| Patient | Two-column layout. Left: next step, referral-centre card (Get directions, I have been to the hospital, Estimate cost with labelled SAMPLE figures), Take with you. Right: Find Your Centre map; the distance panel and travel-time range appear after she shares her location. Below: care journey, help, reminders, details | `components/patient/PatientPortal.tsx`, `FindCentre.tsx`, `lib/geo.ts` (`trafficRange`) |
| Admin | Overview (aggregates only), Hospitals, Health posts and routes, Staff, Activity log, Cost planning (blank prices stay missing) | `components/admin/*` |

**Code note:** the backend role list still contains extra staff roles from earlier work: `NURSE` (an intake-focused view) and `HOSPITAL` (an arrival-confirmation desk). They aren't separate portals in the product. Treat them as part of Doctor/Staff, or remove or merge them; that is an open decision (section 11).

## 6. Backend map
- `backend/tools/referral_pathway.py`: the core of the app.
  - Referrals, the 14-day `run_cycle`, `record_clinical` (a final diagnosis requires histopathology), `register_by_asha` and `find_duplicates`.
  - Encrypted files: `add_file`, `list_files`, `read_file`.
  - Seed data and routes (health post → hospital).
- `backend/tools/document_reading.py`: OCR extraction, confirmation and rejection.
- `backend/tools/document_ocr.py`: Sarvam Vision, upload validation, image quality check.
- `backend/core/staff_session.py`: `ROLE_RULES`. **The first matching rule wins**, so put specific rules above general ones.
- **Routers** (`backend/dashboard/routers/`):
  - `referrals.py`: board, create, register, duplicates, status, clinical, arrival, contact, visit and files (including OCR).
  - Others: `portal.py` (patient), `admin.py`, `genie.py`, `i18n.py` (runtime translation, cached in `$CERVISETU_DATA_DIR/i18n_cache`), `staff.py`, `prevention.py`, `abdm.py`, `documents.py` (the older generic reader; not used by the UI), `messages.py`, `logs.py`, `showcase.py`.
- **Role field limits:** ASHA workers never see findings; admins never see patients; patients see only their own record.

## 7. Translation (7 languages: en, hi, bho, bn, mr, ta, te)
- Static dictionaries live in `frontend/src/i18n/site/<lang>.json`.
- To add strings:
  1. Run `node scripts/extract-strings.mjs`.
  2. Add `scripts/tr/<lang>.NN.txt` files. The next number is **.44**.
  3. Run `node scripts/build-translations.mjs`.
- Runtime fallback for dynamic text: `i18n/pageTranslator.ts` calls `/api/i18n/translate`.
- The OCR review screen's new strings have not been added to the dictionaries yet. They fall back to runtime translation.

## 8. Running locally
```bash
cd /Users/jeetchavan/health_hackathon_main
uv sync && (cd frontend && npm install && npm run build)
uv run python main.py --serve --port 8000          # full app on :8000
```
Development setup used in this session:
- API on port 8002: `CERVISETU_DATA_DIR=/tmp/cs/main .venv/bin/uvicorn backend.dashboard.app:app --port 8002`
- Vite on port 5201, proxied to 8002. The config is in the session scratchpad; a normal `npm run dev` with its proxy pointed at 8002 works too.
- Don't touch ports 8001, 5173 or 5200 (other projects).

**Staff demo login:** `POST /api/staff/demo-login {"role": "DOCTOR" | "ASHA" | "ADMIN"}`, or the sign-in screen (credentials are pre-filled).

**Demo patient:** `/patient/PT-CASE-NISHI`.

**OCR** needs these in `.env`: `SARVAM_API_KEY`, `CERVISETU_OCR_ENABLED=1`, `CERVISETU_OCR_PROVIDER=sarvam_vision`.

## 9. Checks
```bash
D=$(mktemp -d); CERVISETU_DATA_DIR=$D .venv/bin/python -m pytest -q   # 255 pass; 1 old failure also on main: test_session_cookie_is_httponly_and_samesite
cd frontend && npx tsc --noEmit -p tsconfig.app.json && npx oxlint src && npx vite build
```
Browser checks used Playwright with `channel: 'chrome'`. The scripts were in the session scratchpad (`pw/*.mjs`) and are not part of the repo.

## 10. OCR feature summary (uncommitted)
- **Flow:** upload → type and size check → sha256 duplicate check → encrypted storage → quality check → Sarvam OCR → LLM extraction with quotes (exact-wording rules when no LLM) → quotes checked against the OCR text → doctor review → confirmation of ticked fields → record.
- **What confirmation can change:** only colposcopy impression, histopathology and next follow-up go to record fields. Other confirmed fields go to remarks. Status, final diagnosis and treatment are never changed.
- **Roles:**
  - Doctor/Staff: read, confirm, reject (the leftover nurse role can read but not confirm).
  - ASHA: upload screening papers only.
  - Admin and patients: blocked.
- **Known gaps:**
  - The quality check falsely warns about glare on clean white scans.
  - The ASHA screen doesn't show the "awaiting review" label yet; the API already returns `review_status`.
  - There are no admin aggregate OCR counts.
  - Before real clinical use the feature needs accuracy validation, a data-processing agreement with Sarvam, and clinical sign-off.

## 11. Open items and next steps
1. The owner reviews the OCR feature, then decides whether to commit it to `main` (no AI attribution).
2. Fold the leftover NURSE and HOSPITAL code roles into Doctor/Staff, or remove them, so the code matches the four-portal product.
3. Add the OCR screen's strings to the translation dictionaries (.44 files).
4. Finish the full responsive audit across all 13 viewports and every language. So far 5 sizes have been checked, in English. Also known: the language picker is cut off ("Englis") on phones.
5. Production gaps:
   - Real staff identity, replacing the demo roster and shared PIN.
   - A real ABHA integration (currently a sandbox).
   - A messaging provider and approved message templates.
   - Real hospital prices, replacing the sample cost estimate.
   - Live traffic data, if needed (travel times are currently estimated ranges).
