/**
 * AegisMed - Clinical AI Dashboard Frontend Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initIntakeForm();
  initSlider();
  initVaultAndAudit();
  initSampleButtons();
});

// Tab Navigation
function initTabs() {
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const pageTitle = document.getElementById('page-title');
  const pageDesc = document.getElementById('page-desc');

  const titles = {
    'intake-tab': { title: 'Clinical Diagnostic Intake & Multi-Agent Engine', desc: 'LangGraph-powered clinical workflow with automated rural escalation' },
    'image-tab': { title: 'Medical Image Quality & Anomaly Triage', desc: 'Laplacian blur variance, FFT spectrum analysis & medical domain validation' },
    'tracker-tab': { title: 'Rural Patient Tracking & Escalation Engine', desc: 'Progressive Tier 1 (SMS) to Tier 4 (Emergency District Authority) monitoring' },
    'privacy-tab': { title: 'Security Vault & Tamper-Evident Audit Ledger', desc: 'AES-256 GCM tokenization vault & SHA-256 chained compliance log' }
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      navItems.forEach(n => n.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      document.getElementById(tabId).classList.add('active');

      if (titles[tabId]) {
        pageTitle.textContent = titles[tabId].title;
        pageDesc.textContent = titles[tabId].desc;
      }

      if (tabId === 'privacy-tab') {
        loadAuditLogs();
      }
    });
  });
}

// Sample Case Buttons
function initSampleButtons() {
  const btnLoad = document.getElementById('btn-load-sample');
  const btnBlurry = document.getElementById('btn-load-blurry-sample');

  if (btnLoad) {
    btnLoad.addEventListener('click', () => {
      document.getElementById('patient_name').value = 'Kalyani Devi';
      document.getElementById('patient_phone').value = '+91 94152 88910';
      document.getElementById('patient_village').value = 'Bhadras, Block 2';
      document.getElementById('patient_district').value = 'Varanasi, UP';
      document.getElementById('raw_text').value = '48yo female with 4x3cm palpable firm breast lump in upper outer quadrant. Skin tethering and nipple retraction noted. Axillary lymph nodes palpable. Mammography advised BIRADS 5. Suspected Stage III Infiltrating Ductal Carcinoma. Urgent core needle biopsy advised. Follow-up in 5 days.';
      document.getElementById('days_overdue').value = 0;
    });
  }

  if (btnBlurry) {
    btnBlurry.addEventListener('click', () => {
      document.querySelector('[data-tab="image-tab"]').click();
      runPresetImage('blurry_lesion');
    });
  }
}

// Case Intake Form & Graph Execution
function initIntakeForm() {
  const form = document.getElementById('intake-form');
  const btnSubmit = document.getElementById('btn-submit-case');
  const spinner = document.getElementById('intake-spinner');
  const statusBadge = document.getElementById('graph-status-badge');
  const resultsDisplay = document.getElementById('results-display');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // UI Loading State
    btnSubmit.disabled = true;
    spinner.classList.remove('hidden');
    statusBadge.textContent = 'Executing Graph...';
    statusBadge.className = 'badge badge-warning';

    // Reset Stepper
    document.querySelectorAll('.step-node').forEach(n => n.classList.remove('active'));
    document.getElementById('step-intake').classList.add('active');

    const formData = new FormData();
    formData.append('patient_name', document.getElementById('patient_name').value);
    formData.append('phone', document.getElementById('patient_phone').value);
    formData.append('village', document.getElementById('patient_village').value);
    formData.append('district', document.getElementById('patient_district').value);
    formData.append('raw_text', document.getElementById('raw_text').value);
    formData.append('days_overdue', document.getElementById('days_overdue').value);

    const fileInput = document.getElementById('image_file');
    if (fileInput.files[0]) {
      formData.append('image_file', fileInput.files[0]);
    }

    try {
      // Step 2 highlight
      setTimeout(() => document.getElementById('step-triage').classList.add('active'), 300);
      setTimeout(() => document.getElementById('step-diagnostic').classList.add('active'), 600);
      setTimeout(() => document.getElementById('step-tracker').classList.add('active'), 900);

      const res = await fetch('/api/run-case', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      statusBadge.textContent = 'Completed';
      statusBadge.className = 'badge badge-success';
      renderResults(data);

      // Auto update simulator patient token
      document.getElementById('sim-patient-token').value = data.patient_token || 'PT-ANON';
    } catch (err) {
      statusBadge.textContent = 'Error';
      statusBadge.className = 'badge badge-danger';
      resultsDisplay.innerHTML = `<div class="card glass-card text-danger">Execution error: ${err.message}</div>`;
    } finally {
      btnSubmit.disabled = false;
      spinner.classList.add('hidden');
    }
  });
}

function renderResults(state) {
  const resultsDisplay = document.getElementById('results-display');
  const intake = state.clinical_intake || {};
  const diag = state.diagnostic_synthesis || {};
  const imgQ = state.image_quality || {};
  const token = state.patient_token || 'UNKNOWN';

  let html = `
    <div class="diag-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span class="badge badge-info">De-Identified Token: ${token}</span>
        <span class="badge badge-${diag.urgency === 'CRITICAL_EMERGENCY' ? 'danger' : 'warning'}">${diag.urgency || 'ROUTINE'}</span>
      </div>
      <div class="diag-title">${diag.primary_impression || 'Clinical State Synthesized'}</div>
      <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:8px;">${diag.treatment_pathway_notes || ''}</p>
      
      <div style="margin-top:10px;">
        <label style="font-size:0.75rem; color:var(--text-muted);">Differential Diagnoses:</label>
        <div class="pill-list">
          ${(diag.differential_diagnosis || []).map(d => `<span class="pill">${d}</span>`).join('')}
        </div>
      </div>

      <div style="margin-top:10px;">
        <label style="font-size:0.75rem; color:var(--text-muted);">Recommended Investigations:</label>
        <div class="pill-list">
          ${(diag.recommended_workup || []).map(w => `<span class="pill" style="border-color:rgba(59,130,246,0.3); color:#93c5fd;">${w}</span>`).join('')}
        </div>
      </div>
    </div>
  `;

  if (imgQ.blur_score !== undefined) {
    html += `
      <div class="diag-card" style="border-left: 3px solid ${imgQ.is_valid ? 'var(--success)' : 'var(--danger)'};">
        <div style="display:flex; justify-content:space-between;">
          <span style="font-weight:600; font-size:0.85rem;">Image Triage Assessment:</span>
          <span class="badge badge-${imgQ.is_valid ? 'success' : 'danger'}">${imgQ.is_valid ? 'PASSED' : 'REJECTED / BLURRY'}</span>
        </div>
        <p style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">
          Sharpness Index: ${imgQ.blur_score} | Contrast RMS: ${imgQ.contrast_rms} | Modality: ${imgQ.detected_modality}
        </p>
      </div>
    `;
  }

  // Audit trail snippet
  html += `
    <div style="margin-top:12px; font-size:0.75rem; color:var(--text-muted);">
      <strong>Agent Audit Summary:</strong>
      <ul style="padding-left:16px; margin-top:4px;">
        ${(state.audit_trail || []).slice(-4).map(a => `<li>${a}</li>`).join('')}
      </ul>
    </div>
  `;

  resultsDisplay.innerHTML = html;
}

// Preset Image Inspector Tests
async function runPresetImage(presetType) {
  const previewBox = document.getElementById('image-preview-container');
  const blurVal = document.getElementById('metric-blur');
  const contrastVal = document.getElementById('metric-contrast');
  const modalityVal = document.getElementById('metric-modality');
  const resVal = document.getElementById('metric-res');
  const badge = document.getElementById('triage-badge');
  const adviceList = document.getElementById('triage-advice-list');

  // Create simulated SVG canvas based on preset
  let canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 300;
  let ctx = canvas.getContext('2d');

  if (presetType === 'clear_xray') {
    // Sharp simulated grayscale scan
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, 300, 300);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    // Rib cage arches
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(150, 40 + (i * 35), 60 + (i * 8), 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    }
    blurVal.textContent = '248.5';
    contrastVal.textContent = '38.4';
    modalityVal.textContent = 'X-Ray / Chest Film';
    resVal.textContent = '300x300';
    badge.textContent = 'QUALITY PASSED';
    badge.className = 'badge badge-success';
    adviceList.innerHTML = `
      <li style="color:var(--success)">High spatial sharpness and clear bone-tissue contrast.</li>
      <li>Resolution and dynamic exposure suitable for diagnostic inference.</li>
    `;
  } else if (presetType === 'blurry_lesion') {
    // Severe motion blur
    ctx.fillStyle = '#2d1b1f';
    ctx.fillRect(0, 0, 300, 300);
    // Diffuse blurry blob
    let grad = ctx.createRadialGradient(150, 150, 10, 150, 150, 90);
    grad.addColorStop(0, 'rgba(180, 80, 80, 0.4)');
    grad.addColorStop(1, 'rgba(45, 27, 31, 0.1)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(150, 150, 90, 0, Math.PI * 2);
    ctx.fill();

    blurVal.textContent = '31.2';
    contrastVal.textContent = '14.1';
    modalityVal.textContent = 'Oral Lesion (Blurry)';
    resVal.textContent = '300x300';
    badge.textContent = 'REJECTED: BLURRY';
    badge.className = 'badge badge-danger';
    adviceList.innerHTML = `
      <li style="color:var(--danger)"><strong>Severe Motion Blur:</strong> Laplacian sharpness index (31.2) is far below minimum threshold (85.0).</li>
      <li>Hold camera steady or rest elbow on a table; use tap-to-focus on lesion margin.</li>
      <li>Diagnostic AI node halted to prevent false negative/positive misdiagnosis.</li>
    `;
  } else if (presetType === 'underexposed') {
    ctx.fillStyle = '#040508';
    ctx.fillRect(0, 0, 300, 300);
    ctx.fillStyle = '#0f141e';
    ctx.fillRect(50, 50, 200, 200);

    blurVal.textContent = '12.4';
    contrastVal.textContent = '6.2';
    modalityVal.textContent = 'Dark / Underexposed';
    resVal.textContent = '300x300';
    badge.textContent = 'REJECTED: UNDEREXPOSED';
    badge.className = 'badge badge-danger';
    adviceList.innerHTML = `
      <li style="color:var(--danger)"><strong>Severe Underexposure:</strong> Over 78% of pixel intensities near 0.</li>
      <li>Ensure examination light or torch is directed at the anatomical target.</li>
    `;
  } else {
    // Non medical
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, 0, 300, 150);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(0, 150, 300, 150);

    blurVal.textContent = '110.0';
    contrastVal.textContent = '42.0';
    modalityVal.textContent = 'NON_MEDICAL_PHOTO';
    resVal.textContent = '300x300';
    badge.textContent = 'REJECTED: NON-MEDICAL';
    badge.className = 'badge badge-danger';
    adviceList.innerHTML = `
      <li style="color:var(--danger)"><strong>Domain Mismatch:</strong> Non-clinical landscape/generic photo detected.</li>
      <li>Please upload genuine radiological scans, histopathology, or clinical photography.</li>
    `;
  }

  previewBox.innerHTML = '';
  previewBox.appendChild(canvas);
}

// Timeline Slider & Escalation Simulation
function initSlider() {
  const slider = document.getElementById('overdue-slider');
  const counter = document.getElementById('days-counter');
  const btnRun = document.getElementById('btn-run-simulation');

  slider.addEventListener('input', () => {
    counter.textContent = `${slider.value} Days`;
  });

  btnRun.addEventListener('click', async () => {
    const patientToken = document.getElementById('sim-patient-token').value || 'PT-ANON-A83F1';
    const stage = document.getElementById('sim-cancer-stage').value;
    const days = parseInt(slider.value, 10);

    try {
      const res = await fetch('/api/simulate-escalation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_token: patientToken,
          days_overdue: days,
          cancer_type: 'ORAL',
          stage: stage,
          biopsy_status: 'POSITIVE'
        })
      });
      const data = await res.json();
      renderEscalationTimeline(data);
    } catch (err) {
      alert(`Simulation error: ${err.message}`);
    }
  });
}

function renderEscalationTimeline(data) {
  const container = document.getElementById('escalation-timeline-display');
  const days = data.days_overdue;
  const notifs = data.dispatched_notifications || [];
  const dossier = data.authority_dossier;

  if (notifs.length === 0) {
    container.innerHTML = `
      <div class="timeline-card" style="border-left-color:var(--success);">
        <div class="timeline-card-header">
          <h4>Day ${days}: Within Acceptable Follow-Up Window</h4>
          <span class="badge badge-success">On Schedule</span>
        </div>
        <p>No overdue flags. Routine automated clinic reminder scheduled for Day 7.</p>
      </div>
    `;
    return;
  }

  let html = '';
  notifs.forEach(n => {
    const isTier4 = n.tier.includes('AUTHORITY');
    html += `
      <div class="timeline-card ${isTier4 ? 'tier-4' : ''}">
        <div class="timeline-card-header">
          <h4>${n.tier} &bull; ${n.channel}</h4>
          <span class="badge badge-${isTier4 ? 'danger' : 'warning'}">${n.status}</span>
        </div>
        <p style="color:var(--text-muted); font-size:0.75rem;">Recipient: ${n.recipient_role}</p>
        <p style="margin-top:6px; font-family:var(--font-mono); font-size:0.8rem; background:rgba(0,0,0,0.3); padding:8px; border-radius:4px;">
          ${n.message_content}
        </p>
      </div>
    `;
  });

  if (dossier) {
    html += `
      <div class="timeline-card tier-4" style="border:1px solid var(--danger);">
        <div class="timeline-card-header">
          <h4>EMERGENCY DISTRICT HEALTH AUTHORITY DOSSIER (${dossier.dossier_id})</h4>
          <span class="badge badge-danger">ADDRESS UNMASKED</span>
        </div>
        <div style="font-size:0.8rem; margin-top:8px; line-height:1.6;">
          <p><strong>Patient Name:</strong> ${dossier.full_name}</p>
          <p><strong>Unmasked Address:</strong> ${dossier.village_address}</p>
          <p><strong>Clinical Condition:</strong> ${dossier.clinical_diagnosis} (Severity: ${dossier.severity_score})</p>
          <p><strong>Statutory Directive:</strong> ${dossier.dispatch_directive}</p>
          <p style="color:var(--text-muted); font-size:0.75rem; margin-top:4px;">Authorized By: ${dossier.authorized_by}</p>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

// Vault Inspection & Audit Ledger
function initVaultAndAudit() {
  const btnInspect = document.getElementById('btn-inspect-vault');
  const btnRefresh = document.getElementById('btn-refresh-audit');

  if (btnInspect) {
    btnInspect.addEventListener('click', async () => {
      const token = document.getElementById('vault-token-input').value.trim();
      if (!token) return alert('Please enter a patient token.');

      try {
        const res = await fetch(`/api/vault/inspect/${token}`);
        const data = await res.json();
        document.getElementById('vault-display-container').innerHTML = `
          <div style="color:#34d399; margin-bottom:8px;">[VAULT UNMASKED VIA AUTHORIZED CMO ACCESS]</div>
          <pre>${JSON.stringify(data.vault_data, null, 2)}</pre>
        `;
        loadAuditLogs();
      } catch (err) {
        document.getElementById('vault-display-container').innerHTML = `<span class="text-danger">Vault Access Error: ${err.message}</span>`;
      }
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', loadAuditLogs);
  }
}

async function loadAuditLogs() {
  const container = document.getElementById('audit-ledger-container');
  try {
    const res = await fetch('/api/audit-logs?limit=25');
    const data = await res.json();
    const logs = data.audit_logs || [];

    if (logs.length === 0) {
      container.innerHTML = '<p class="text-muted" style="padding:12px;">No audit events recorded yet.</p>';
      return;
    }

    let html = '';
    logs.reverse().forEach(log => {
      html += `
        <div class="audit-item">
          <div class="audit-header">
            <span>${log.timestamp}</span>
            <span class="badge badge-${log.severity === 'CRITICAL' ? 'danger' : log.severity === 'WARNING' ? 'warning' : 'info'}">${log.severity}</span>
          </div>
          <div><span class="audit-action">${log.action}</span> by <strong>${log.actor}</strong> (Token: ${log.patient_token})</div>
          <div class="audit-hash">Hash: ${log.current_hash ? log.current_hash.slice(0, 32) + '...' : 'N/A'}</div>
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p class="text-danger">Error loading audit logs: ${err.message}</p>`;
  }
}
