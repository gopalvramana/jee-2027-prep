// ── Nav mobile toggle ──────────────────────────────────────────────────────
function toggleNav() {
  document.querySelector('.nav-links').classList.toggle('open');
}
document.addEventListener('click', e => {
  if (!e.target.closest('.nav-inner')) {
    document.querySelector('.nav-links')?.classList.remove('open');
  }
});

// ── Unit accordion ─────────────────────────────────────────────────────────
document.addEventListener('click', e => {
  const hdr = e.target.closest('.unit-header');
  if (hdr) {
    const section = hdr.closest('.unit-section');
    const body    = section.querySelector('.unit-body');
    const toggle  = hdr.querySelector('.unit-toggle');
    body.classList.toggle('open');
    if (toggle) toggle.classList.toggle('open');
  }
});

// ── Session accordion ──────────────────────────────────────────────────────
document.addEventListener('click', e => {
  const head = e.target.closest('.session-head');
  if (head && !e.target.closest('.session-chk')) {
    const card   = head.closest('.session-card');
    const body   = card.querySelector('.session-body');
    const toggle = head.querySelector('.session-toggle');
    body.classList.toggle('open');
    if (toggle) toggle.classList.toggle('open');
  }
});

// ── Month-by-Month table toggle ─────────────────────────────────────────────
function toggleMonthTable(hdr) {
  const body  = hdr.nextElementSibling;
  const arrow = hdr.querySelector('.month-tbl-arrow');
  body.classList.toggle('open');
  arrow.classList.toggle('open');
}

function toggleCS(hdr) {
  const body = hdr.nextElementSibling;
  const tog  = hdr.querySelector('.unit-cs-toggle');
  body.classList.toggle('open');
  tog.classList.toggle('open');
}

// ── Open first unit by default ──────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const firstUnit = document.querySelector('.unit-body');
  const firstToggle = document.querySelector('.unit-toggle');
  if (firstUnit) firstUnit.classList.add('open');
  if (firstToggle) firstToggle.classList.add('open');
});

// ── Progress tracker (localStorage) ────────────────────────────────────────
const STORAGE_KEY   = 'jee2027_progress';
const MOCK_KEY      = 'jee2027_mocks';

function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    // Normalise legacy format: some entries stored as plain `true` instead of {done:true}
    const out = {};
    for (const [id, val] of Object.entries(raw)) {
      out[id] = (val === true || val === false)
        ? { done: !!val, score: '', notes: '' }
        : val;
    }
    return out;
  } catch { return {}; }
}
function saveProgress(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  autoSyncToGist();
}
function loadMocks() {
  try { return JSON.parse(localStorage.getItem(MOCK_KEY)) || []; }
  catch { return []; }
}
function saveMocks(list) {
  localStorage.setItem(MOCK_KEY, JSON.stringify(list));
  autoSyncToGist();
}

function initProgress() {
  const data = loadProgress();

  document.querySelectorAll('.prog-check').forEach(cb => {
    const id = cb.dataset.id;
    if (data[id]?.done) {
      cb.checked = true;
      cb.closest('tr')?.classList.add('done-row');
    }
    cb.addEventListener('change', () => {
      const row = cb.closest('tr');
      if (cb.checked) row?.classList.add('done-row');
      else row?.classList.remove('done-row');
      autoSave();
      updateBars();
    });
  });

  document.querySelectorAll('.prog-score').forEach(inp => {
    const id = inp.dataset.id;
    if (data[id]?.score) inp.value = data[id].score;
    inp.addEventListener('input', autoSave);
  });

  document.querySelectorAll('.prog-notes').forEach(inp => {
    const id = inp.dataset.id;
    if (data[id]?.notes) inp.value = data[id].notes;
    inp.addEventListener('input', autoSave);
  });

  updateBars();
  renderMockLog();
  renderChart();
  updateGistStatus();
}

function autoSave() {
  const data = loadProgress();
  document.querySelectorAll('.prog-check').forEach(cb => {
    const id = cb.dataset.id;
    if (!data[id]) data[id] = {};
    data[id].done = cb.checked;
  });
  document.querySelectorAll('.prog-score').forEach(inp => {
    const id = inp.dataset.id;
    if (!data[id]) data[id] = {};
    data[id].score = inp.value;
  });
  document.querySelectorAll('.prog-notes').forEach(inp => {
    const id = inp.dataset.id;
    if (!data[id]) data[id] = {};
    data[id].notes = inp.value;
  });
  saveProgress(data);
}

function updateBars() {
  document.querySelectorAll('[data-subject-bar]').forEach(bar => {
    const subj   = bar.dataset.subjectBar;
    const checks = document.querySelectorAll(`.prog-check[data-subject="${subj}"]`);
    const done   = [...checks].filter(c => c.checked).length;
    const pct    = checks.length ? Math.round(done / checks.length * 100) : 0;
    bar.style.width = pct + '%';
    const label = document.querySelector(`[data-subject-label="${subj}"]`);
    if (label) label.textContent = `${done} / ${checks.length} sessions (${pct}%)`;
  });

  const all   = document.querySelectorAll('.prog-check');
  const done  = [...all].filter(c => c.checked).length;
  const el    = document.getElementById('total-done');
  if (el) el.textContent = done;
  const pctEl = document.getElementById('total-pct');
  if (pctEl) pctEl.textContent = all.length ? Math.round(done / all.length * 100) + '%' : '0%';
  const totEl = document.getElementById('total-sessions');
  if (totEl) totEl.textContent = all.length;
}

// ── Mock test log ───────────────────────────────────────────────────────────
function renderMockLog() {
  const tbody = document.getElementById('mock-tbody');
  if (!tbody) return;
  const mocks = loadMocks();
  tbody.innerHTML = '';
  if (!mocks.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--ink3);padding:1.5rem">No mock tests logged yet. Add your first below.</td></tr>';
    return;
  }
  mocks.forEach((m, i) => {
    const total = (Number(m.math)||0) + (Number(m.phys)||0) + (Number(m.chem)||0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.date || '—'}</td>
      <td>${m.attempt || '—'}</td>
      <td class="math-col">${m.math ?? '—'}</td>
      <td class="phys-col">${m.phys ?? '—'}</td>
      <td class="chem-col">${m.chem ?? '—'}</td>
      <td><strong>${total || '—'}</strong> / 300</td>
      <td style="font-size:.78rem;max-width:160px">${m.notes || ''}</td>
      <td><button class="del-mock-btn" data-idx="${i}" title="Delete">✕</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.del-mock-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const list = loadMocks();
      list.splice(Number(btn.dataset.idx), 1);
      saveMocks(list);
      renderMockLog();
      renderChart();
    });
  });
}

window.addMockEntry = function() {
  const date    = document.getElementById('mock-date')?.value;
  const attempt = document.getElementById('mock-attempt')?.value;
  const math    = document.getElementById('mock-math')?.value;
  const phys    = document.getElementById('mock-phys')?.value;
  const chem    = document.getElementById('mock-chem')?.value;
  const notes   = document.getElementById('mock-notes')?.value;
  if (!date) { showToast('Enter a date first.'); return; }
  const list = loadMocks();
  list.push({ date, attempt, math, phys, chem, notes });
  list.sort((a, b) => a.date.localeCompare(b.date));
  saveMocks(list);
  // Clear form
  ['mock-date','mock-math','mock-phys','mock-chem','mock-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderMockLog();
  renderChart();
  showToast('✓ Mock test logged!');
};

// ── Score chart (Chart.js) ──────────────────────────────────────────────────
let chartInstance = null;

function renderChart() {
  const canvas = document.getElementById('score-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  const mocks = loadMocks();
  if (!mocks.length) return;

  const labels  = mocks.map(m => m.date);
  const mathD   = mocks.map(m => Number(m.math) || null);
  const physD   = mocks.map(m => Number(m.phys) || null);
  const chemD   = mocks.map(m => Number(m.chem) || null);
  const totalD  = mocks.map(m => (Number(m.math)||0)+(Number(m.phys)||0)+(Number(m.chem)||0) || null);

  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Total /300', data: totalD, borderColor: '#6d28d9', backgroundColor: 'rgba(109,40,217,.08)', tension: .3, pointRadius: 4 },
        { label: 'Math /100',  data: mathD,  borderColor: '#1d4ed8', backgroundColor: 'rgba(29,78,216,.06)',  tension: .3, pointRadius: 4, borderDash: [4,2] },
        { label: 'Physics /100', data: physD, borderColor: '#0f766e', backgroundColor: 'rgba(15,118,110,.06)', tension: .3, pointRadius: 4, borderDash: [4,2] },
        { label: 'Chemistry /100', data: chemD, borderColor: '#b45309', backgroundColor: 'rgba(180,83,9,.06)', tension: .3, pointRadius: 4, borderDash: [4,2] },
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: {
        y: { min: 0, max: 300, grid: { color: 'rgba(0,0,0,.06)' } },
        x: { grid: { color: 'rgba(0,0,0,.04)' } }
      }
    }
  });
}

// ── Export / Import progress ────────────────────────────────────────────────
window.exportProgress = function() {
  const payload = {
    version: 2,
    exported: new Date().toISOString(),
    sessions: loadProgress(),
    mocks: loadMocks()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `jee2027-progress-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  showToast('✓ Progress exported!');
};

window.importProgress = function(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.sessions) saveProgress(data.sessions);
      if (data.mocks)    saveMocks(data.mocks);
      showToast('✓ Progress imported! Reloading…');
      setTimeout(() => location.reload(), 1200);
    } catch {
      showToast('⚠ Invalid file. Import failed.');
    }
  };
  reader.readAsText(file);
};

// ── Toast notification ──────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── GitHub Gist Sync ────────────────────────────────────────────────────────
const GIST_TOKEN_KEY = 'jee2027_gist_token';
const GIST_ID_KEY    = 'jee2027_gist_id';
const GIST_FILENAME  = 'jee2027-progress.json';

function buildGistPayload() {
  return {
    version: 3,
    exported:  new Date().toISOString(),
    sessions:  loadProgress(),
    mocks:     loadMocks(),
    schedule:  loadSchedule(),
    startDate: localStorage.getItem(START_DATE_KEY) || null
  };
}

async function findGistByFilename(token) {
  try {
    const res  = await fetch('https://api.github.com/gists?per_page=100', {
      headers: { 'Authorization': `token ${token}` }
    });
    if (!res.ok) return null;
    const list = await res.json();
    return list.find(g => g.files[GIST_FILENAME])?.id || null;
  } catch { return null; }
}

window.syncToGist = async function() {
  const token = localStorage.getItem(GIST_TOKEN_KEY);
  if (!token) { showToast('⚠ Save a GitHub token first.'); return; }
  const gistId = localStorage.getItem(GIST_ID_KEY);
  const body = {
    description: 'JEE 2027 Prep — Progress Backup',
    public: false,
    files: { [GIST_FILENAME]: { content: JSON.stringify(buildGistPayload(), null, 2) } }
  };
  try {
    showToast('Syncing…');
    const url    = gistId ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists';
    const method = gistId ? 'PATCH' : 'POST';
    const res    = await fetch(url, {
      method,
      headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const data = await res.json();
    if (!gistId) {
      localStorage.setItem(GIST_ID_KEY, data.id);
      updateGistStatus();
    }
    showToast('✓ Synced to GitHub Gist!');
  } catch (err) { showToast('⚠ Sync failed: ' + err.message); }
};

window.loadFromGist = async function() {
  const token = localStorage.getItem(GIST_TOKEN_KEY);
  if (!token) { showToast('⚠ Save a GitHub token first.'); return; }
  let gistId = localStorage.getItem(GIST_ID_KEY);
  try {
    showToast('Loading from GitHub…');
    if (!gistId) {
      gistId = await findGistByFilename(token);
      if (!gistId) { showToast('⚠ No JEE progress Gist found.'); return; }
      localStorage.setItem(GIST_ID_KEY, gistId);
    }
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { 'Authorization': `token ${token}` }
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const data    = await res.json();
    const content = data.files[GIST_FILENAME]?.content;
    if (!content) throw new Error('Progress file not found in Gist.');
    const payload = JSON.parse(content);
    if (payload.sessions) saveProgress(payload.sessions);
    if (payload.mocks)    saveMocks(payload.mocks);
    showToast('✓ Loaded from GitHub! Reloading…');
    setTimeout(() => location.reload(), 1200);
  } catch (err) { showToast('⚠ Load failed: ' + err.message); }
};

window.saveGistToken = function() {
  const val = document.getElementById('gist-token-input')?.value.trim();
  if (!val) { showToast('⚠ Token cannot be empty.'); return; }
  localStorage.setItem(GIST_TOKEN_KEY, val);
  showToast('✓ Token saved.');
  updateGistStatus();
};

window.clearGistLink = function() {
  if (!confirm('Unlink this device from its Gist? The Gist itself is not deleted.')) return;
  localStorage.removeItem(GIST_ID_KEY);
  localStorage.removeItem(GIST_TOKEN_KEY);
  const inp = document.getElementById('gist-token-input');
  if (inp) inp.value = '';
  updateGistStatus();
  showToast('Gist unlinked.');
};

function updateGistStatus() {
  const token   = localStorage.getItem(GIST_TOKEN_KEY);
  const gistId  = localStorage.getItem(GIST_ID_KEY);
  const statusEl = document.getElementById('gist-status');
  const idEl     = document.getElementById('gist-id-display');
  const idRow    = document.getElementById('gist-id-row');
  if (!statusEl) return;
  if (token && gistId) {
    statusEl.textContent = '✓ Linked — syncs to your private Gist';
    statusEl.className   = 'gist-status linked';
  } else if (token) {
    statusEl.textContent = '✓ Token saved — click Sync ↑ to create a new Gist';
    statusEl.className   = 'gist-status token-only';
  } else {
    statusEl.textContent = 'Not configured';
    statusEl.className   = 'gist-status';
  }
  if (idEl)  idEl.textContent = gistId ? gistId : '—';
  if (idRow) idRow.style.display = gistId ? '' : 'none';
}

// ── Auto-sync to Gist on every progress change ───────────────────────────────
// Debounced: waits 3 s after the last change before hitting the API.
// Silent no-op if Gist isn't configured (token or id missing).
let _autoSyncTimer = null;
function autoSyncToGist() {
  const token  = localStorage.getItem(GIST_TOKEN_KEY);
  const gistId = localStorage.getItem(GIST_ID_KEY);
  if (!token || !gistId) return;   // Gist not fully linked — skip

  clearTimeout(_autoSyncTimer);
  _autoSyncTimer = setTimeout(async () => {
    const body = {
      description: 'JEE 2027 Prep — Progress Backup',
      public: false,
      files: { [GIST_FILENAME]: { content: JSON.stringify(buildGistPayload(), null, 2) } }
    };
    try {
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) showToast('☁ Auto-saved to Gist');
      // silent fail on error — don't interrupt the user's workflow
    } catch { /* network error — ignore */ }
  }, 3000);
}

// ── Expose for inline handlers
window.saveAllProgress = function() {
  autoSave();
  showToast('✓ Progress saved!');
};
window.resetProgress = function() {
  if (!confirm('Reset ALL progress and mock test data? This cannot be undone.')) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(MOCK_KEY);
  location.reload();
};

if (document.querySelector('.prog-check') || document.getElementById('mock-tbody')) {
  initProgress();
}

// ── Schedule Start Date ──────────────────────────────────────────────────────
const START_DATE_KEY = 'jee2027_start_date';

function parseDateLocal(raw) {
  // Parse YYYY-MM-DD as local midnight (avoids UTC offset shifting the date)
  const [y, m, d] = raw.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function loadStartDate() {
  // Returns {y, m, w} of the week the user started, or null
  const raw = localStorage.getItem(START_DATE_KEY);
  if (!raw) return null;
  const d = parseDateLocal(raw);
  if (isNaN(d)) return null;
  return { y: d.getFullYear(), m: d.getMonth() + 1, w: Math.min(4, Math.ceil(d.getDate() / 7)) };
}

window.saveStartDate = function() {
  const val = document.getElementById('start-date-input')?.value;
  if (!val) { showToast('⚠ Pick a date first.'); return; }
  localStorage.setItem(START_DATE_KEY, val);
  updateStartDateUI();
  showToast('✓ Start date saved.');
};

function updateStartDateUI() {
  const inp  = document.getElementById('start-date-input');
  const hint = document.getElementById('start-date-hint');
  if (!inp || !hint) return;
  const raw = localStorage.getItem(START_DATE_KEY);
  if (raw) {
    inp.value = raw;
    const d = parseDateLocal(raw);
    hint.textContent = '✓ Schedule starts ' + d.toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'}) + ' — sessions before this date won\'t show as overdue.';
    hint.className = 'start-date-hint set';
  } else {
    const today = new Date();
    inp.value = today.toISOString().slice(0, 10);
    hint.textContent = 'Not set — click Save to use today as your start date.';
    hint.className = 'start-date-hint';
  }
}

window.addEventListener('DOMContentLoaded', updateStartDateUI);

// ── Schedule Management ───────────────────────────────────────────────────────
const SCHEDULE_KEY = 'jee2027_schedule';

function weeklyTargetsToFlat() {
  const flat = [];
  for (const slot of WEEKLY_TARGETS) {
    for (const [id, name, subj] of slot.sessions) {
      flat.push({ id, name, subj, y: slot.y, m: slot.m, w: slot.w, custom: false });
    }
  }
  return flat;
}

function loadSchedule() {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return weeklyTargetsToFlat();
}

function saveSchedule(sessions) {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(sessions));
}


window.resetScheduleToDefault = function() {
  if (!confirm('Reset to the default schedule? All your customisations — renamed topics, moved sessions, custom additions — will be permanently lost.')) return;
  localStorage.removeItem(SCHEDULE_KEY);
  showToast('✓ Schedule reset to defaults.');
  if (typeof renderSchedulePage === 'function') renderSchedulePage();
  if (document.getElementById('today-card')) renderTodayCard();
};

// ── Today's Progress Card ────────────────────────────────────────────────────
// Start: May 15 2026. Summer vacation (May 15–Aug 15) = 2 subjects/day intensive.
// Math priority: Coord Geo (Jun) → Calculus (Jul) → Integration (Aug) = 60-76% of Math paper
// Low-yield Math (Quadratics, Sequences, P&C) pushed to Phase 2 Oct — only 10-14% combined
// Phase 1 (Summer) = May–Aug 2026  |  Phase 2 = Sep–Oct 2026
// Phase 3 = Nov 2026–Jan 2027      |  Phase 4 = Feb–Apr 2027
const WEEKLY_TARGETS = [
  // ── ☀ SUMMER · May 2026 · M1 Trigonometry (starts May 15 = Week 3) ───────
  {y:2026,m:5,w:3,sessions:[
    ['m-t1','Trig Ratios, ASTC & Standard Values','math'],
    ['m-t2','Trig Identities — Pythagorean, Reciprocal','math'],
    ['p-s0a','Units & Dimensions — Intro','phys'],
    ['p-s0b','Dimensional Analysis & Error','phys'],
  ]},
  {y:2026,m:5,w:4,sessions:[
    ['m-t3','Compound & Multiple Angle Formulas','math'],
    ['m-t4','Inverse Trig, Properties of Triangles & Equations','math'],
    ['p-s1','1D Kinematics — Equations of Motion','phys'],
    ['c-s1','Mole Concept & Avogadro','chem'],
    ['c-s2','Stoichiometry & Limiting Reagent','chem'],
  ]},
  // ── ☀ SUMMER · June 2026 · M3 Coordinate Geometry ★ 16–20% of Math ──────
  {y:2026,m:6,w:1,sessions:[
    ['m-m3-1','Straight Lines — Slope, Distance, Section Formula','math'],
    ['m-m3-2','Straight Lines — Angle, Perpendicular, Locus','math'],
    ['p-s2','2D Motion & Projectile','phys'],
    ['c-s3','Concentration Terms & Titration','chem'],
  ]},
  {y:2026,m:6,w:2,sessions:[
    ['m-m3-3','Circles — Standard & General Form, Tangents','math'],
    ['m-m3-4','Circles — Chord of Contact, Family of Circles','math'],
    ['p-s3','Relative Motion & River Problems','phys'],
    ['c-s4','Bohr Model & Atomic Spectra','chem'],
  ]},
  {y:2026,m:6,w:3,sessions:[
    ['m-m3-5','Parabola — Focus, Directrix, Tangents & Normals','math'],
    ['m-m3-6','Ellipse — Standard form, Properties, Tangents','math'],
    ['p-s4','Newton\'s Laws & FBD','phys'],
    ['c-s5','Quantum Numbers & Orbitals','chem'],
  ]},
  {y:2026,m:6,w:4,sessions:[
    ['m-m3-7','Hyperbola & Rectangular Hyperbola','math'],
    ['m-m3-8','Coord Geo — JEE PYQ Drill (all conics)','math'],
    ['p-s5','Friction & Inclines','phys'],
    ['c-s6','Electron Config & Periodic Trends','chem'],
  ]},
  // ── ☀ SUMMER · July 2026 · M5+M6 Calculus ★ 20–25% of Math ────────────
  {y:2026,m:7,w:1,sessions:[
    ['m-m5-1','Limits — LHL/RHL, Standard Limits, L\'Hôpital','math'],
    ['m-m5-2','Continuity, Differentiability & First Principles','math'],
    ['p-s6','Pulley Systems & Connected Bodies','phys'],
    ['c-s7','Ionic & Covalent Bonding','chem'],
  ]},
  {y:2026,m:7,w:2,sessions:[
    ['m-m5-3','Differentiation — Product, Quotient & Chain Rule','math'],
    ['m-m5-4','Implicit, Parametric & Logarithmic Differentiation','math'],
    ['p-s7','Work-Energy Theorem','phys'],
    ['c-s8','VSEPR & Hybridisation','chem'],
  ]},
  {y:2026,m:7,w:3,sessions:[
    ['m-m6-1','AOD — Tangents, Normals & Angle of Intersection','math'],
    ['m-m6-2','AOD — Maxima, Minima & Second Derivative Test','math'],
    ['p-s8','Conservation of Energy & Collisions','phys'],
    ['c-s9','Polarity, IMF & Hydrogen Bonding','chem'],
  ]},
  {y:2026,m:7,w:4,sessions:[
    ['m-m6-3','AOD — Increasing/Decreasing, Rate of Change','math'],
    ['m-m6-4','AOD — Approximations + JEE PYQ Drill','math'],
    ['p-s9','Ohm\'s Law & Resistance Circuits','phys'],
    ['c-s10','Enthalpy & First Law of Thermodynamics','chem'],
  ]},
  // ── ☀ SUMMER · Aug Wk 1–2 · M7 Integration ★ 12–16% of Math ───────────
  {y:2026,m:8,w:1,sessions:[
    ['m-m7-1','Integration — Indefinite & Standard Forms','math'],
    ['m-m7-2','Integration — Substitution & Trigonometric','math'],
    ['p-s10','Kirchhoff\'s Laws & Complex Circuits','phys'],
    ['c-s11','Hess\'s Law & Bond Energies','chem'],
  ]},
  {y:2026,m:8,w:2,sessions:[
    ['m-m7-3','Integration — By Parts & ILATE Rule','math'],
    ['m-m7-4','Integration — Partial Fractions & Special Integrals','math'],
    ['p-s11','Cells, Internal Resistance & Wheatstone','phys'],
    ['c-s12','Gibbs Energy & Spontaneity','chem'],
  ]},
  // ── Transition: Aug 15 — pace shifts, Integration continues ──────────────
  {y:2026,m:8,w:3,sessions:[
    ['m-m7-5','Definite Integration & Properties','math'],
    ['m-m7-6','Area Under Curves','math'],
    ['p-p5-1','Torque & Angular Acceleration','phys'],
    ['c-c5-1','Kp, Kc & Reaction Quotient','chem'],
  ]},
  {y:2026,m:8,w:4,sessions:[
    ['m-m7-7','Differential Equations — Variable Separable & Linear','math'],
    ['p-p5-2','Moment of Inertia','phys'],
    ['p-p5-3','Angular Momentum & Conservation','phys'],
    ['c-c5-2','Le Chatelier\'s Principle & ICE Tables','chem'],
  ]},
  // ── Phase 2 · Sep 2026 · M8 Vectors & 3D ★ 12–16% of Math ─────────────
  {y:2026,m:9,w:1,sessions:[
    ['m-m8-1','Vectors — Addition, Dot Product & Applications','math'],
    ['m-m8-2','Vectors — Cross Product, Scalar Triple Product','math'],
    ['p-p5-4','Rolling Without Slipping','phys'],
    ['c-c5-3','Equilibrium Problems & Ksp','chem'],
  ]},
  {y:2026,m:9,w:2,sessions:[
    ['m-m8-3','3D Geometry — Lines & Planes','math'],
    ['m-m8-4','3D Geometry — Distance, Angle & Skew Lines','math'],
    ['p-p6-1','Biot-Savart & Ampere\'s Law','phys'],
    ['c-c6-1','pH & Strong/Weak Acids & Bases','chem'],
  ]},
  {y:2026,m:9,w:3,sessions:[
    ['m-m8-5','Matrices — Operations & Types','math'],
    ['m-m8-6','Determinants, Inverse & Cramer\'s Rule','math'],
    ['p-p6-2','Force on Current Conductor & Magnetic Loops','phys'],
    ['c-c6-2','Buffer Solutions & Henderson Equation','chem'],
  ]},
  {y:2026,m:9,w:4,sessions:[
    ['m-m8-7','Vectors & 3D — JEE PYQ Drill','math'],
    ['p-p6-3','Charged Particles in Magnetic Field','phys'],
    ['c-c6-3','Ksp, Common Ion Effect & Indicators','chem'],
  ]},
  // ── Phase 2 · Oct 2026 · Lower-yield Math + Physics & Chem finish ────────
  {y:2026,m:10,w:1,sessions:[
    ['m-m2-1','Quadratics — Roots, Nature & Discriminant','math'],
    ['m-m2-2','Functions — Domain, Range & Transformations','math'],
    ['p-p7-1','Faraday\'s & Lenz\'s Law','phys'],
    ['c-c7-1','Galvanic Cells & EMF','chem'],
  ]},
  {y:2026,m:10,w:2,sessions:[
    ['m-m4-1','Sequences — AP, GP & Special Series','math'],
    ['m-m4-2','Permutations, Combinations & Binomial Theorem','math'],
    ['p-p7-2','Self & Mutual Inductance','phys'],
    ['p-p7-3','AC Circuits & Resonance','phys'],
    ['c-c7-2','Nernst Equation & Electrolysis','chem'],
  ]},
  {y:2026,m:10,w:3,sessions:[
    ['m-m8-8','Probability — Classical & Conditional','math'],
    ['p-p8-1','Reflection — Plane & Curved Mirrors','phys'],
    ['p-p8-2','Refraction, TIR & Lenses','phys'],
    ['c-c7-3','Conductance & Faraday\'s Laws','chem'],
  ]},
  {y:2026,m:10,w:4,sessions:[
    ['m-pyq1','Math JEE PYQ Sprint — Calculus + Coord Geo','math'],
    ['p-p8-3','Prism, Dispersion & Optical Instruments','phys'],
    ['c-c8-1','GOC — Electronic Effects & Reaction Intermediates','chem'],
    ['c-c8-2','GOC — SN1/SN2, Elimination & Addition','chem'],
  ]},
  // ── Phase 3 · November 2026 ───────────────────────────────────────────────
  {y:2026,m:11,w:1,sessions:[
    ['p3-w1a','Ray Optics — Prism, Dispersion & Instruments','p3'],
    ['p3-w1b','Thermodynamics (Physics) — PV Diagrams','p3'],
  ]},
  {y:2026,m:11,w:2,sessions:[
    ['p3-w2a','Carbonyl Chemistry — Aldehydes & Ketones','p3'],
    ['p3-w2b','GOC Reactions — SN1/SN2, Elimination','p3'],
  ]},
  {y:2026,m:11,w:3,sessions:[
    ['p3-w3','Formula Drill — All Subjects','p3'],
    ['p3-w4','JEE PYQ Sprint — Math + Physics','p3'],
  ]},
  {y:2026,m:11,w:4,sessions:[
    ['p3-mock1','Mock Test 1','p3'],
    ['p3-gap1','Gap Analysis — Mock 1','p3'],
  ]},
  // ── Phase 3 · December 2026 ───────────────────────────────────────────────
  {y:2026,m:12,w:1,sessions:[['p3-w5','Targeted Drills on Weak Topics','p3']]},
  {y:2026,m:12,w:2,sessions:[
    ['p3-mock2','Mock Test 2','p3'],
    ['p3-gap2','Gap Analysis — Mock 2','p3'],
  ]},
  {y:2026,m:12,w:3,sessions:[['p3-w6','Speed Practice Blitz','p3']]},
  {y:2026,m:12,w:4,sessions:[['p3-mock3','Mock Test 3 — Pre-Exam Simulation','p3']]},
  // ── Phase 3 · January 2027 ────────────────────────────────────────────────
  {y:2027,m:1,w:1,sessions:[['p3-gap3','Gap Analysis — Mock 3','p3']]},
  {y:2027,m:1,w:2,sessions:[['p3-w7','Final Formula Drill & Confidence Check','p3']]},
  {y:2027,m:1,w:3,sessions:[['p3-attempt1','⭐ Attempt 1 — JEE Main Jan 2027','p3']]},
  // ── Phase 4 · February 2027 ───────────────────────────────────────────────
  {y:2027,m:2,w:1,sessions:[['p4-w1','Error Review — Attempt 1 Paper','p4']]},
  {y:2027,m:2,w:2,sessions:[['p4-w2','Math Weak-Topic Drills','p4']]},
  {y:2027,m:2,w:3,sessions:[['p4-w3','Physics Weak-Topic Drills','p4']]},
  {y:2027,m:2,w:4,sessions:[['p4-w4','Chemistry + Inorganic Drills','p4']]},
  // ── Phase 4 · March 2027 ──────────────────────────────────────────────────
  {y:2027,m:3,w:2,sessions:[
    ['p4-mock4','Mock Test 4 — Verify Improvement','p4'],
    ['p4-w5','Speed Practice Blitz','p4'],
  ]},
  {y:2027,m:3,w:4,sessions:[['p4-mock5','Final Mock Test 5','p4']]},
  // ── Phase 4 · April 2027 ──────────────────────────────────────────────────
  {y:2027,m:4,w:2,sessions:[['p4-attempt2','⭐⭐ Attempt 2 — JEE Main Apr 2027','p4']]},
];

// Seed default schedule into localStorage AFTER WEEKLY_TARGETS is initialised
// (must be here — seeding above caused TDZ ReferenceError on WEEKLY_TARGETS)
if (!localStorage.getItem(SCHEDULE_KEY)) {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(weeklyTargetsToFlat()));
}

const TC_ICON  = {math:'📐', phys:'⚡', chem:'🧪', p3:'🎯', p4:'🚀'};
const TC_COLOR = {math:'#1d4ed8', phys:'#0f766e', chem:'#b45309', p3:'#4f46e5', p4:'#059669'};
const TC_MONTH = ['','January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
const TC_DAY   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function tcPhaseLabel(yr, mo) {
  if (yr === 2026 && mo <= 6)  return '📖 Phase 1 — Foundation Sprint';
  if (yr === 2026 && mo <= 10) return '⚡ Phase 2 — JEE Layer';
  if ((yr === 2026 && mo >= 11) || (yr === 2027 && mo === 1)) return '🎯 Phase 3 — Attempt 1 Drill';
  if (yr === 2027 && mo <= 4)  return '🚀 Phase 4 — Attempt 2 Boost';
  return 'JEE 2027 Prep';
}

function tcEsc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Map session ID → subject page anchor ─────────────────────────────────────
function sessionLink(id) {
  // Math units
  if (id.startsWith('m-t'))   return 'subjects/math.html#unit-m1';
  if (id.startsWith('m-m2'))  return 'subjects/math.html#unit-m2';
  if (id.startsWith('m-m3'))  return 'subjects/math.html#unit-m3';
  if (id.startsWith('m-m4'))  return 'subjects/math.html#unit-m4';
  if (id.startsWith('m-m5'))  return 'subjects/math.html#unit-m5';
  if (id.startsWith('m-m6'))  return 'subjects/math.html#unit-m6';
  if (id.startsWith('m-m7'))  return 'subjects/math.html#unit-m7';
  if (id.startsWith('m-m8'))  return 'subjects/math.html#unit-m8';
  // Physics — p-s sessions span multiple units by number
  if (id === 'p-s0a' || id === 'p-s0b')             return 'subjects/physics.html#unit-p0';
  if (['p-s1','p-s2','p-s3'].includes(id))           return 'subjects/physics.html#unit-p1';
  if (['p-s4','p-s5','p-s6'].includes(id))           return 'subjects/physics.html#unit-p2';
  if (['p-s7','p-s8'].includes(id))                  return 'subjects/physics.html#unit-p3';
  if (['p-s9','p-s10','p-s11'].includes(id))         return 'subjects/physics.html#unit-p4';
  if (id.startsWith('p-p5'))  return 'subjects/physics.html#unit-p5';
  if (id.startsWith('p-p6'))  return 'subjects/physics.html#unit-p6';
  if (id.startsWith('p-p7'))  return 'subjects/physics.html#unit-p7';
  if (id.startsWith('p-p8'))  return 'subjects/physics.html#unit-p8';
  // Chemistry — c-s sessions span multiple units by number
  if (['c-s1','c-s2','c-s3'].includes(id))           return 'subjects/chemistry.html#unit-c1';
  if (['c-s4','c-s5','c-s6'].includes(id))           return 'subjects/chemistry.html#unit-c2';
  if (['c-s7','c-s8','c-s9'].includes(id))           return 'subjects/chemistry.html#unit-c3';
  if (['c-s10','c-s11','c-s12'].includes(id))        return 'subjects/chemistry.html#unit-c4';
  if (id.startsWith('c-c5'))  return 'subjects/chemistry.html#unit-c5';
  if (id.startsWith('c-c6'))  return 'subjects/chemistry.html#unit-c6';
  if (id.startsWith('c-c7'))  return 'subjects/chemistry.html#unit-c7';
  if (id.startsWith('c-c8'))  return 'subjects/chemistry.html#unit-c8';
  return null;
}

function renderTodayCard() {
  const el = document.getElementById('today-card');
  if (!el) return;

  const now  = new Date();
  const yr   = now.getFullYear();
  const mo   = now.getMonth() + 1;
  const day  = now.getDate();
  const dow  = now.getDay();
  const wk   = Math.min(4, Math.ceil(day / 7));
  const prog = loadProgress();

  const thisWeekSess = [];
  const overdueSess  = [];

  const start    = loadStartDate(); // {y,m,w} or null
  const schedule = loadSchedule();  // flat [{id,name,subj,y,m,w,custom}]

  for (const sess of schedule) {
    // Skip sessions before the user's chosen start date
    if (start) {
      const beforeStart = sess.y < start.y
        || (sess.y === start.y && sess.m < start.m)
        || (sess.y === start.y && sess.m === start.m && sess.w < start.w);
      if (beforeStart) continue;
    }
    const isPast = sess.y < yr
      || (sess.y === yr && sess.m < mo)
      || (sess.y === yr && sess.m === mo && sess.w < wk);
    const isCurr = sess.y === yr && sess.m === mo && sess.w === wk;
    if (isCurr)                          thisWeekSess.push([sess.id, sess.name, sess.subj]);
    else if (isPast && !prog[sess.id])   overdueSess.push([sess.id, sess.name, sess.subj]);
  }

  const doneCount  = thisWeekSess.filter(s => prog[s[0]]).length;
  const totalCount = thisWeekSess.length;
  const overdueN   = overdueSess.length;
  const allDone    = overdueN === 0 && totalCount > 0 && doneCount === totalCount;

  const dateStr  = `${TC_DAY[dow]}, ${day} ${TC_MONTH[mo]} ${yr}`;
  const phaseStr = tcPhaseLabel(yr, mo);

  let h = `
    <div class="tc-header">
      <div class="tc-date">${dateStr}</div>
      <div class="tc-right">
        <div class="tc-phase">${phaseStr}</div>
        <div class="tc-week-label">Week ${wk} of 4 &middot; ${TC_MONTH[mo]}</div>
      </div>
    </div>`;

  // ── overdue section ──
  if (overdueN > 0) {
    h += `<div class="tc-section tc-overdue-section">
      <div class="tc-section-title overdue-title">⚠ Overdue — tap to mark done</div>`;
    for (const [id, name, subj] of overdueSess) {
      const link = sessionLink(id);
      const nameHtml = link
        ? `<a href="${link}" class="tc-name tc-name-overdue tc-name-link" onclick="event.stopPropagation()">${tcEsc(name)}</a>`
        : `<span class="tc-name tc-name-overdue">${tcEsc(name)}</span>`;
      h += `<div class="tc-row tc-overdue-row" onclick="tcToggle('${id}')" title="Tap to mark done">
        <span class="tc-status">❌</span>
        <span class="tc-subj">${TC_ICON[subj] || ''}</span>
        ${nameHtml}
      </div>`;
    }
    h += `</div>`;
  }

  // ── this week section ──
  if (totalCount > 0) {
    h += `<div class="tc-section">
      <div class="tc-section-title">This week &middot; Week ${wk}</div>`;
    for (const [id, name, subj] of thisWeekSess) {
      const done = !!prog[id];
      const link = sessionLink(id);
      const color = done ? '' : (TC_COLOR[subj] || 'inherit');
      const nameHtml = link
        ? `<a href="${link}" class="tc-name tc-name-link${done ? ' tc-done-name' : ''}" style="color:${color}" onclick="event.stopPropagation()">${tcEsc(name)}</a>`
        : `<span class="tc-name" style="color:${color}">${tcEsc(name)}</span>`;
      h += `<div class="tc-row${done ? ' tc-done-row' : ''}" onclick="tcToggle('${id}')" title="${done ? 'Tap to unmark' : 'Tap to mark done'}">
        <span class="tc-status">${done ? '✅' : '<span class="tc-todo-dot">○</span>'}</span>
        <span class="tc-subj">${TC_ICON[subj] || ''}</span>
        ${nameHtml}
      </div>`;
    }
    h += `</div>`;
  } else {
    h += `<div class="tc-section"><p class="tc-empty">No sessions scheduled for this week.</p></div>`;
  }

  // ── all-done banner ──
  if (allDone) {
    h += `<div class="tc-all-done">🎉 All sessions up to date! You're right on track.</div>`;
  }

  // ── footer ──
  h += `<div class="tc-footer">
    <span class="tc-summary">${doneCount}/${totalCount} done this week</span>
    ${overdueN > 0 ? `<span class="tc-overdue-badge">${overdueN} overdue</span>` : ''}
    <a href="progress.html" class="tc-link">View Full Progress →</a>
  </div>`;

  el.innerHTML = h;
}

window.tcToggle = function(id) {
  const prog = loadProgress();
  if (prog[id]) { delete prog[id]; } else { prog[id] = true; }
  saveProgress(prog);
  renderTodayCard();
};

if (document.getElementById('today-card')) renderTodayCard();
