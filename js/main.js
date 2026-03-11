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
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function saveProgress(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function loadMocks() {
  try { return JSON.parse(localStorage.getItem(MOCK_KEY)) || []; }
  catch { return []; }
}
function saveMocks(list) {
  localStorage.setItem(MOCK_KEY, JSON.stringify(list));
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
  return { version: 2, exported: new Date().toISOString(), sessions: loadProgress(), mocks: loadMocks() };
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
