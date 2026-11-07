# CerviSetu clinical workflow

Abnormal screening, fixed-route hospital referral, 14-day follow-up, confirmed arrival, doctor's record. CerviSetu is a data-collection and tracking aid, not a diagnostic tool. Histopathology confirms tissue diagnosis. It has not been assessed for regulatory compliance and is not production ready.

## Roles (enforced on the server)

| Role | Sees | Does |
|---|---|---|
| Patient | Her own referral, without findings | Replies, stops reminders |
| Nurse | Her health post | Full intake, reminders |
| ASHA | Only referrals assigned to her at her post | Contact attempts, visits, consent |
| Hospital desk | Referrals routed to its hospital | Confirms arrival |
| Doctor | All referrals | Colposcopy, biopsy, reports, MRI, diagnosis, plan, reviews |
| Administrator | Counts only, no patient records | Hospitals, health posts, routes, staff, own audit |

## Follow-up rules

- New referrals use the current route. A route change never rewrites existing referrals.
- Days 1 to 10: daily reminders. Days 11 to 13: intensive contact. Day 14: ASHA visit assigned once.
- Reminders need message consent. STOP ends them at once. Family reminders need separate consent.
- A reply does not close follow-up. Only confirmed arrival does.
- Refusal, or no recorded visit after day 14, goes to doctor review.
- The daily cycle is idempotent. Messages stay simulated and marked so unless a live provider is configured.

## Teaching cases

`backend/tools/teaching_cases.py` holds the doctors' five fictional cases from the PHC datasheet workbook, with VIA images in `backend/seed_assets/via/`. `tests/test_case_scenarios.py` walks each through the pathway.

| Case | Screen | Result in the pathway | Histopathology | Plan |
|---|---|---|---|---|
| Sarita Jaiswal, 32 | NILM, no lesion | Routine, no referral | Not indicated | Routine rescreening |
| Bindu Gupta, 29 | LSIL | Referred | CIN 1 | Risk-based follow-up, yearly Pap |
| Nishi Paul, 36 | HSIL, HPV positive | Referred | CIN 2 | LEEP/LEETZ, reassess at 1 year |
| Radha Singh, 41 | HSIL, HPV positive | Urgent | CIN 3 / CIS | LEEP/LEETZ, reassess at 1 year |
| Rita Naidu, 52 | Friable growth | Urgent | Invasive SCC | MRI, treatment by staging |

## For doctor review

Where the sheet was conditional or unclear, the record keeps it blank or as written:
- Bindu's mosaicism "may be present", Nishi's SCJ "visible" and Radha's SCJ and atypical vessels are left blank, because they do not map to one option.
- Rita's Pap "may show invasive carcinoma" and HPV "positive or unavailable" are left blank.
- Radha's histopathology option is stored as CIS. The final diagnosis keeps the sheet's "CIN 3 (HSIL) / carcinoma in situ".
- "LEETZ" is kept as written. Please confirm whether LLETZ is meant.
- Rita's "direct referral to cancer centre" follows the saved route and is marked urgent. Please confirm.
- Sarita's sheet colposcopy details are not loaded, because she is routine with no referral.
- The sheet has no fields for smoking or menopause age, so those are not captured.
- The metaplasia case and colposcopy images are not in the source files.

## Before production

Real OTP and identity provider, real messaging with inbound STOP, object storage with managed keys for files (now AES-GCM blobs in SQLite), a production database, removal of test sign-in and pre-filled PINs, security and clinical governance review, and doctors' confirmation of the follow-up policy.

## Location and maps

Placement is the project team's inference: the doctors' sheet and workflow notes in this repository do not specify location features.

| Portal | Included | Use | Data | Privacy | Phase |
|---|---|---|---|---|---|
| Patient | Yes | Assigned centre, other listed centres, distance, directions | Her referral's hospital, directory, optional device location | Location stays in the browser | Now |
| Admin | Yes, coordinates | Enter, source and check centre locations | Directory only | No patient data | Now |
| Admin | Heat map | Aggregated referral density and follow-up gaps | Aggregates by area | Minimum cell sizes needed | Later |
| ASHA | Directions link | Route to an assigned home visit | Patient address, with consent | No tracking, no default precise location | Later: needs an approved consent rule |
| Nurse | Route preview | Confirm the saved route's centre at intake | Directory and saved route | No patient location; must not override the route | Later |
| Hospital | No map | Staff know their own centre | None | Geolocation must never mark arrival | Not planned |

Location never changes urgency, the referral destination or the 14-day follow-up.

