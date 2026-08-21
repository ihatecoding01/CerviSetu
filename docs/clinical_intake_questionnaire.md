# AegisMed Clinical Intake & Patient Data Specification

This document provides a comprehensive, field-tested questionnaire and data dictionary designed for oncology screening and rural patient tracking. It outlines what data is collected, who fills each section, the clinical justification, and how each field maps into the AegisMed agentic pipeline.

---

## Part A: Patient & Frontline Worker Intake Form
*(Filled by the Patient, Caregiver, or ASHA / Village Health Worker at primary intake)*

### 1. Demographic & Privacy-Vault Information (Encrypted)
*These fields are isolated in the AES-256 vault and used exclusively for patient communication and Tier 1–4 emergency escalations.*

| # | Question / Field Label | Input Type | Description & Purpose |
|---|---|---|---|
| A1.1 | **Patient Full Name** | Text | Legal full name for hospital identification. |
| A1.2 | **Age & Date of Birth** | Number / Date | Essential for baseline cancer risk profiling. |
| A1.3 | **Biological Gender** | Single Choice (`Male`, `Female`, `Other`) | Gender-specific cancer screening (e.g. Breast, Cervical, Prostate). |
| A1.4 | **Primary Mobile Number** | Phone (+91...) | Destination for Tier 1 SMS/WhatsApp and Tier 2 IVR Voice reminders. |
| A1.5 | **WhatsApp Active on this Number?** | Boolean (`Yes` / `No`) | Determines if rich interactive WhatsApp messages can be sent. |
| A1.6 | **Preferred Language / Dialect** | Single Choice (`Hindi`, `Bengali`, `Bhojpuri`, `Tamil`, `Telugu`, `English`, etc.) | Ensures reminders and IVR audio calls are delivered in the patient's native dialect. |
| A1.7 | **Village / Ward / Gram Panchayat** | Text | Local community jurisdiction for ASHA health worker routing. |
| A1.8 | **Complete Home Address & Landmark** | Text | Exact address unmasked **only** if Tier 4 emergency authority intervention is triggered. |
| A1.9 | **Nearest Primary Health Centre (PHC) / Sub-Centre** | Text | Designated local pickup and clinic revisit location. |
| A1.10| **Assigned ASHA / Anganwadi Worker Name & Phone** | Text / Phone | Frontline contact who receives Tier 3 home visit task orders. |
| A1.11| **Emergency Contact / Guardian Name & Phone** | Text / Phone | Secondary contact reached during Tier 2 IVR or non-response. |

---

### 2. Patient-Reported Symptoms & Lifestyle History
*This data is de-identified and analyzed by the OCR Intake & Risk Scorer Agents.*

| # | Question / Field Label | Input Type | Clinical Justification |
|---|---|---|---|
| A2.1 | **Primary Area of Concern / Complaint** | Multi-Select: `Mouth / Tongue / Cheek`, `Breast Lump`, `Neck / Throat`, `Abdomen / Bowel`, `Cervix / Bleeding`, `Skin / Mole`, `Chest / Lungs`, `Other` | Directs model focus to specific cancer modalities. |
| A2.2 | **Duration of Complaint / Symptom** | Dropdown (`< 2 weeks`, `2 to 4 weeks`, `1 to 3 months`, `> 3 months`) | Chronic lesions (>3–4 weeks) carry significantly higher malignancy risk. |
| A2.3 | **Current Pain / Discomfort Severity** | Scale 1 to 10 | Patient quality-of-life and clinical urgency marker. |
| A2.4 | **Specific Warning Signs (Red Flags)** | Multi-Select Checkboxes: <br>• Non-healing mouth ulcer / white-red patch<br>• Painless lump or thickening<br>• Difficulty swallowing (dysphagia)<br>• Hoarseness of voice (>3 weeks)<br>• Unexplained weight loss (>5 kg in 1 month)<br>• Unusual bleeding (coughing blood, post-coital, rectal)<br>• Persistent cough or shortness of breath | Constitutional "B-symptoms" that increase the cancer severity score. |
| A2.5 | **Habits / Exposure History** | Checkboxes: <br>• Tobacco chewing (Khaini / Gutkha / Pan Masala) [Duration in years]<br>• Smoking (Bidi / Cigarette) [Packs/day & years]<br>• Alcohol consumption<br>• Biomass fuel / chulha smoke exposure<br>• None | Major carcinogenic risk factors (especially oral, lung, and esophageal cancers). |
| A2.6 | **Personal or Family History of Cancer** | Dropdown (`Yes (specify relation & type)`, `No`, `Unknown`) | Hereditary and familial predisposition risk. |

---

## Part B: Doctor / Oncologist Clinical Evaluation Form
*(Filled by the Medical Officer, Diagnostician, or Oncologist)*

### 1. Physical & Anatomical Examination
| # | Question / Field Label | Input Type | Description & Purpose |
|---|---|---|---|
| B1.1 | **Exact Anatomical Subsite** | Text (e.g. *Left lateral tongue border*, *Right upper outer quadrant of breast*, *Cervical os*) | Pinpoints tumor origin for surgical/radiological workup. |
| B1.2 | **Lesion Dimensions & Morphology** | Text / Numbers (e.g. *3.5 x 2.0 cm*, *Ulceroproliferative*, *Indurated edges*, *Fungating*, *Firm fixed lump*) | Essential for clinical Tumor (T) staging. |
| B1.3 | **Lymph Node Status** | Single Choice: `Palpable & Mobile`, `Palpable & Matted/Fixed`, `Non-palpable / Normal` | Essential for clinical Node (N) staging. |
| B1.4 | **Systemic / Metastatic Signs** | Checkboxes: `Hepatomegaly`, `Bone tenderness`, `Cachexia`, `None` | Essential for clinical Metastasis (M) staging. |

---

### 2. Clinical Staging & Diagnostic Impression
| # | Question / Field Label | Input Type | Description & Purpose |
|---|---|---|---|
| B2.1 | **Provisional Diagnosis / Cancer Type** | Dropdown: `Oral Cavity`, `Breast`, `Cervical`, `Lung`, `Colorectal`, `Gastric`, `Other Suspected Carcinoma` | Primary disease classification. |
| B2.2 | **Estimated Clinical TNM Stage** | Dropdown: `Stage I (Early)`, `Stage II (Localized)`, `Stage III (Locally Advanced)`, `Stage IV (Metastatic / High Risk)` | Critical parameter that triggers Tier 4 authority dispatch thresholds. |
| B2.3 | **Biopsy / Pathology Status** | Single Choice: `Sample Sent / Pending`, `Positive for Malignancy`, `Suspicious / Dysplastic`, `Benign`, `Not Performed` | Validates histological confirmation vs preliminary suspicion. |
| B2.4 | **Histopathology / FNAC Findings (If Available)** | Text (e.g. *Moderately differentiated squamous cell carcinoma with keratin pearls*) | Pathologist confirmation for treatment pathway. |

---

### 3. Diagnostic Workup Ordered & Revisit Scheduling
| # | Question / Field Label | Input Type | Description & Purpose |
|---|---|---|---|
| B3.1 | **Investigations Prescribed** | Multi-Select: `Punch Biopsy`, `FNAC`, `Contrast CT`, `MRI`, `Mammography (BI-RADS)`, `Chest X-Ray`, `CBC/LFT/KFT`, `PET-CT` | Diagnostic steps the patient must complete before the next visit. |
| B3.2 | **Scheduled Follow-Up Due Date** | Date Picker (e.g. *7 days / 14 days post-biopsy*) | **Baseline anchor date** from which overdue days ($t_{overdue}$) are counted. |
| B3.3 | **Clinical Urgency Classification** | Dropdown: `Routine (14 days)`, `Priority (7 days)`, `Critical Emergency (48-72 hours)` | Adjusts escalation speed and reminder intervals. |
| B3.4 | **Doctor's Notes & Advice to Patient** | Text | Plain-language guidance summarized into the patient's SMS/IVR reminder. |

---

## Part C: Medical Image Metadata (For Image Triage Agent)
*(Captured via mobile camera, digital dermatoscope, X-ray digitizer, or microscope)*

| # | Parameter | Expected Values | Purpose |
|---|---|---|---|
| C1 | **Image Modality** | `Gross Clinical Photograph`, `Radiology Film (X-Ray/CT/MRI)`, `Histopathology Slide (H&E)`, `Dermoscopy` | Verifies domain relevance before AI diagnostic processing. |
| C2 | **Anatomical Tag** | e.g. `Oral Cavity`, `Chest PA`, `Left Breast` | Cross-checks with clinical complaint. |
| C3 | **Capture Guidelines Enforced** | `In-Focus`, `Adequate Lighting`, `No Flash Glare`, `Resolution >= 256x256` | Evaluated algorithmically by Laplacian variance and FFT high-frequency ratio. |

---

## Part D: Pipeline Data Mapping & Privacy Classification

```
+------------------------------------+-------------------------+---------------------------------+
| Form Field                         | Privacy Shield Tier     | Consuming Pipeline Agent        |
+------------------------------------+-------------------------+---------------------------------+
| Patient Name, Phone, Address, GPS  | AES-256 Vault Only      | Tracker Agent (Tier 1-4 Alerts) |
| Village, Assigned ASHA Worker      | Vault / Redacted Tag    | Community Worker Dispatch Tool  |
| Age, Gender, Tobacco/Alcohol Habits| De-Identified Payload   | OCR Intake & Diagnostic Agent   |
| Primary Site, Symptoms, Duration   | De-Identified Payload   | Diagnostic Synthesis Agent      |
| Clinical Stage (I-IV), Biopsy Stat | De-Identified Payload   | Risk Scorer & Escalation Router |
| Scheduled Date, Days Overdue       | Tracker Database State  | Patient Tracking State Machine  |
| Uploaded Medical Scan / Photo      | Sanitized Image Buffer  | Image Quality & Triage Agent    |
+------------------------------------+-------------------------+---------------------------------+
```
