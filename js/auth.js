// ── Auth Guard + Firestore Sync ────────────────────────────────────────────
// Loaded on every page AFTER firebase-init.js.
// • Redirects unauthenticated users to login.html
// • Renders the user chip in the nav
// • Pulls the user's data from Firestore into localStorage on login
// • Clears localStorage on logout so the next user starts fresh

// ── Helpers ─────────────────────────────────────────────────────────────────
function _currentPage() {
  return window.location.pathname.split('/').pop() || 'index.html';
}
function _inSubjectsFolder() {
  return window.location.pathname.includes('/subjects/');
}
function _rootPath() {
  return _inSubjectsFolder() ? '../' : '';
}
function _isPublicPage() {
  return _currentPage() === 'login.html';
}

// Firestore document ref for a user's progress
function _fsDoc(uid) {
  return window._db.collection('users').doc(uid).collection('data').doc('progress');
}

// ── Firestore read → localStorage ───────────────────────────────────────────
async function _syncFromFirestore(uid) {
  try {
    const snap = await _fsDoc(uid).get();
    if (snap.exists) {
      const d = snap.data();

      // MERGE sessions: combine Firestore + local, keeping any session marked done in either.
      // This prevents data loss if a pushToFirestore failed on a previous visit.
      if (d.sessions !== undefined) {
        const local  = JSON.parse(localStorage.getItem('jee2027_progress') || '{}');
        const merged = { ...d.sessions };
        for (const [id, localVal] of Object.entries(local)) {
          const localDone = localVal === true || localVal?.done;
          const mergedDone = merged[id] === true || merged[id]?.done;
          if (localDone && !mergedDone) {
            merged[id] = { done: true, score: localVal?.score || '', notes: localVal?.notes || '' };
          }
        }
        localStorage.setItem('jee2027_progress', JSON.stringify(merged));
      }

      if (d.mocks        !== undefined) localStorage.setItem('jee2027_mocks',          JSON.stringify(d.mocks));
      if (d.schedule     !== undefined && d.schedule !== null)
                                         localStorage.setItem('jee2027_schedule',       JSON.stringify(d.schedule));
      if (d.startDate    !== undefined) localStorage.setItem('jee2027_start_date',     d.startDate);
      if (d.notifyEmails !== undefined) localStorage.setItem('jee2027_notify_emails',  JSON.stringify(d.notifyEmails));
    }
  } catch (e) {
    console.warn('[Auth] Firestore pull failed (offline?):', e.message);
  }
}

// ── localStorage → Firestore (called by main.js on every save) ──────────────
window.pushToFirestore = async function() {
  const user = window._auth.currentUser;
  if (!user) return;
  try {
    const sessions     = JSON.parse(localStorage.getItem('jee2027_progress')      || '{}');
    const mocks        = JSON.parse(localStorage.getItem('jee2027_mocks')         || '[]');
    const rawSched     = localStorage.getItem('jee2027_schedule');
    const schedule     = rawSched ? JSON.parse(rawSched) : null;
    const startDate    = localStorage.getItem('jee2027_start_date') || null;
    const rawNotify    = localStorage.getItem('jee2027_notify_emails');
    const notifyEmails = rawNotify ? JSON.parse(rawNotify) : null;

    const payload = {
      sessions,
      mocks,
      startDate,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (schedule     !== null) payload.schedule     = schedule;
    if (notifyEmails !== null) payload.notifyEmails = notifyEmails;

    await _fsDoc(user.uid).set(payload, { merge: true });
  } catch (e) {
    console.warn('[Auth] Firestore push failed:', e.message);
    // Retry once after 3 seconds on failure
    setTimeout(() => window.pushToFirestore(), 3000);
  }
};

// ── Nav user chip ────────────────────────────────────────────────────────────
function _renderUserChip(user) {
  const navLinks = document.querySelector('.nav-links');
  if (!navLinks) return;
  navLinks.querySelector('.nav-user-chip')?.remove();

  const name     = user.displayName || user.email.split('@')[0];
  const initials = name.charAt(0).toUpperCase();
  const email    = user.email || '';

  const chip = document.createElement('div');
  chip.className = 'nav-user-chip';
  chip.innerHTML = `
    <span class="nav-user-avatar" title="${email}">${initials}</span>
    <span class="nav-user-name">${name}</span>
    <button class="nav-logout-btn" onclick="window.jeeSignOut()" title="Sign out">↩ Sign out</button>
  `;
  navLinks.appendChild(chip);
}

// ── Sign out ─────────────────────────────────────────────────────────────────
window.jeeSignOut = async function() {
  // Clear local data so the next user starts fresh
  ['jee2027_progress','jee2027_mocks','jee2027_schedule',
   'jee2027_start_date','jee2027_gist_token','jee2027_gist_id']
    .forEach(k => localStorage.removeItem(k));
  await window._auth.signOut();
  window.location.href = _rootPath() + 'login.html';
};

// ── Main auth observer ───────────────────────────────────────────────────────
// Hide the page body until we know auth state — prevents flash of content
if (!_isPublicPage()) {
  document.documentElement.style.visibility = 'hidden';
}

window._auth.onAuthStateChanged(async function(user) {
  if (!user) {
    if (!_isPublicPage()) {
      // Not logged in on a protected page → go to login
      const next = encodeURIComponent(window.location.href);
      window.location.replace(_rootPath() + 'login.html?next=' + next);
    } else {
      document.documentElement.style.visibility = '';
    }
    return;
  }

  // Logged in on the login page → bounce to dashboard
  if (_isPublicPage()) {
    window.location.replace(_rootPath() + 'index.html');
    return;
  }

  // Ensure parent user document exists (needed for server-side digest query)
  try {
    const userDocRef = window._db.collection('users').doc(user.uid);
    await userDocRef.set({
      email:     user.email,
      name:      user.displayName || user.email.split('@')[0],
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch(e) { console.warn('[Auth] user doc write failed:', e.message); }

  // Pull cloud data into localStorage first, then reveal page
  await _syncFromFirestore(user.uid);

  document.documentElement.style.visibility = '';

  // Render user chip
  _renderUserChip(user);

  // Notify settings page that auth is ready
  window.dispatchEvent(new Event('authReady'));

  // Re-trigger any page-level renderers that ran before data arrived
  if (typeof renderTodayCard === 'function'  && document.getElementById('today-card'))  renderTodayCard();
  if (typeof renderSchedulePage === 'function')                                           renderSchedulePage();
  if (typeof initProgress === 'function' &&
      (document.querySelector('.prog-check') || document.getElementById('mock-tbody'))) initProgress();
  if (typeof updateStartDateUI === 'function') updateStartDateUI();

  // Push to Firestore on login — syncs schedule + any local-only progress
  // Delayed to let main.js finish seeding localStorage first
  setTimeout(() => window.pushToFirestore(), 1500);
});
