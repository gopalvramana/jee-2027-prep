#!/usr/bin/env node
// scripts/send-digest.js
// Reads every user's progress from Firestore via Firebase Admin SDK.
// Builds a personalised HTML digest and sends it to each user's email.
// Run by GitHub Actions daily; can also be run locally with env vars set.
//
// Required env vars:
//   FIREBASE_SERVICE_ACCOUNT  — full JSON string of the service account key
//   GMAIL_USER                — Gmail address used to send (e.g. you@gmail.com)
//   GMAIL_APP_PASSWORD        — 16-char Gmail App Password

'use strict';

const admin      = require('firebase-admin');
const nodemailer = require('nodemailer');

// ── Validate env ──────────────────────────────────────────────────────────────
const missing = ['FIREBASE_SERVICE_ACCOUNT', 'GMAIL_USER', 'GMAIL_APP_PASSWORD']
  .filter(k => !process.env[k]);
if (missing.length) {
  console.error('Missing required env vars:', missing.join(', '));
  process.exit(1);
}

// ── Init Firebase Admin ───────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db       = admin.firestore();
const authAdmin = admin.auth();

// ── Subject metadata ──────────────────────────────────────────────────────────
const SUBJ_COLOR = { math: '#1d4ed8', physics: '#0f766e', chemistry: '#b45309' };
const SUBJ_ICON  = { math: '📐',      physics: '⚡',       chemistry: '🧪'      };
const SUBJ_NAME  = { math: 'Mathematics', physics: 'Physics', chemistry: 'Chemistry' };

// ── Date helpers ──────────────────────────────────────────────────────────────
function today() {
  const d = new Date();
  return {
    y:       d.getFullYear(),
    m:       d.getMonth() + 1,
    w:       Math.min(4, Math.ceil(d.getDate() / 7)),
    dayName: d.toLocaleDateString('en-IN', { weekday: 'long' }),
    dateStr: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

function monthName(y, m) {
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long' });
}

function cmpSlot(a, b) {
  if (a.y !== b.y) return a.y < b.y ? -1 : 1;
  if (a.m !== b.m) return a.m < b.m ? -1 : 1;
  if (a.w !== b.w) return a.w < b.w ? -1 : 1;
  return 0;
}

function phaseLabel(y, m) {
  if (y === 2026 && m >= 3 && m <= 6)  return 'Phase 1 — Foundation Sprint';
  if (y === 2026 && m >= 7 && m <= 10) return 'Phase 2 — JEE Layer';
  if ((y === 2026 && m >= 11) || (y === 2027 && m <= 1)) return 'Phase 3 — Attempt 1 Drill';
  if (y === 2027 && m >= 2 && m <= 4)  return 'Phase 4 — Attempt 2 Boost';
  return 'JEE Prep';
}

// ── Fetch all Firestore users ─────────────────────────────────────────────────
async function fetchAllUserProgress() {
  // collectionGroup finds all 'data' subcollections across all users.
  // We filter to docs that have 'updatedAt' — only progress docs have this field.
  const snap    = await db.collectionGroup('data').where('updatedAt', '!=', null).get();
  const results = [];

  for (const doc of snap.docs) {
    // path is: users/{uid}/data/progress  → parent.parent.id = uid
    const uid = doc.ref.parent.parent && doc.ref.parent.parent.id;
    if (uid) results.push({ uid, data: doc.data() });
  }

  // Fallback: if collectionGroup returns nothing, iterate users directly
  if (results.length === 0) {
    console.log('  collectionGroup returned 0 — trying direct users scan…');
    const usersSnap = await db.collection('users').get();
    for (const userDoc of usersSnap.docs) {
      const progSnap = await db
        .collection('users').doc(userDoc.id)
        .collection('data').doc('progress').get();
      if (progSnap.exists) {
        results.push({ uid: userDoc.id, data: progSnap.data() });
      }
    }
  }

  return results;
}

// ── Get user email from Firebase Auth ─────────────────────────────────────────
async function getUserEmail(uid) {
  try {
    const user = await authAdmin.getUser(uid);
    return { email: user.email, name: user.displayName || user.email.split('@')[0] };
  } catch {
    return null;
  }
}

// ── Build personalised email ──────────────────────────────────────────────────
function buildEmail(name, payload) {
  const { sessions = {}, schedule = [], startDate } = payload;
  const t = today();

  let start = null;
  if (startDate) {
    const [sy, sm, sd] = startDate.split('-').map(Number);
    start = { y: sy, m: sm, w: Math.min(4, Math.ceil(sd / 7)) };
  }

  const thisWeek = schedule.filter(s => s.y === t.y && s.m === t.m && s.w === t.w);
  const weekDone = thisWeek.filter(s => sessions[s.id]).length;
  const weekPct  = thisWeek.length ? Math.round(weekDone / thisWeek.length * 100) : 0;

  const overdue = schedule.filter(s => {
    if (cmpSlot({ y: s.y, m: s.m, w: s.w }, { y: t.y, m: t.m, w: t.w }) >= 0) return false;
    if (start && cmpSlot({ y: s.y, m: s.m, w: s.w }, start) < 0) return false;
    return !sessions[s.id];
  });

  const counts = {};
  for (const s of schedule) {
    if (!counts[s.subj]) counts[s.subj] = { done: 0, total: 0 };
    counts[s.subj].total++;
    if (sessions[s.id]) counts[s.subj].done++;
  }
  const grandDone  = Object.values(counts).reduce((a, c) => a + c.done,  0);
  const grandTotal = Object.values(counts).reduce((a, c) => a + c.total, 0);
  const grandPct   = grandTotal ? Math.round(grandDone / grandTotal * 100) : 0;

  const phase   = phaseLabel(t.y, t.m);
  const mnLabel = monthName(t.y, t.m);
  const subject = `📚 JEE Digest · ${mnLabel} Week ${t.w} — ${weekDone}/${thisWeek.length} done this week`;

  const html = /* html */`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${subject}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body  { background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
    .wrap { max-width: 600px; margin: 24px auto; padding: 0 12px 32px; }
    .card { background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.09); }
    .hero { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 30px 32px 24px; }
    .hero-greeting { font-size: 13px; color: #93c5fd; margin-bottom: 4px; }
    .hero-day   { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: #94a3b8; }
    .hero-date  { font-size: 24px; font-weight: 700; color: #fff; margin: 4px 0 6px; }
    .hero-phase { font-size: 14px; color: #93c5fd; }
    .hero-week  { font-size: 12px; color: #475569; margin-top: 3px; }
    .strip { background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-around; padding: 16px 0; }
    .stat       { text-align: center; }
    .stat-num   { font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1; }
    .stat-lbl   { font-size: 10px; text-transform: uppercase; letter-spacing: .07em; color: #94a3b8; margin-top: 3px; }
    .stat-num.alert { color: #dc2626; }
    .section        { padding: 20px 28px; border-bottom: 1px solid #f1f5f9; }
    .section.danger { background: #fff5f5; }
    .sec-title { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #94a3b8; margin-bottom: 14px; }
    .sec-title.red  { color: #dc2626; }
    .row       { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid #f8fafc; }
    .row:last-child { border-bottom: none; }
    .row-icon  { width: 22px; text-align: center; font-size: 15px; flex-shrink: 0; }
    .row-name  { font-size: 14px; color: #1e293b; flex: 1; }
    .row-name.done { color: #9ca3af; text-decoration: line-through; }
    .badge     { font-size: 10px; padding: 2px 8px; border-radius: 20px; font-weight: 600; white-space: nowrap; }
    .prog-row   { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .prog-label { font-size: 13px; color: #374151; width: 110px; flex-shrink: 0; }
    .prog-track { flex: 1; background: #f1f5f9; border-radius: 99px; height: 8px; }
    .prog-fill  { height: 8px; border-radius: 99px; }
    .prog-count { font-size: 12px; color: #6b7280; width: 50px; text-align: right; flex-shrink: 0; }
    .ov-row  { display: flex; align-items: center; gap: 10px; padding: 5px 0; }
    .ov-name { font-size: 13px; color: #dc2626; flex: 1; }
    .ov-when { font-size: 11px; color: #ef4444; flex-shrink: 0; }
    .all-done { text-align: center; padding: 14px 0 4px; font-size: 15px; color: #16a34a; font-weight: 600; }
    .footer { text-align: center; padding: 18px; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="card">

    <div class="hero">
      <div class="hero-greeting">Hey ${name} 👋</div>
      <div class="hero-day">${t.dayName}</div>
      <div class="hero-date">${t.dateStr}</div>
      <div class="hero-phase">📖 ${phase}</div>
      <div class="hero-week">${mnLabel} · Week ${t.w} of 4</div>
    </div>

    <div class="strip">
      <div class="stat">
        <div class="stat-num">${weekDone}/${thisWeek.length}</div>
        <div class="stat-lbl">This week</div>
      </div>
      <div class="stat">
        <div class="stat-num">${weekPct}%</div>
        <div class="stat-lbl">Week done</div>
      </div>
      <div class="stat">
        <div class="stat-num">${grandDone}/${grandTotal}</div>
        <div class="stat-lbl">All time</div>
      </div>
      <div class="stat">
        <div class="stat-num">${grandPct}%</div>
        <div class="stat-lbl">Overall</div>
      </div>
      ${overdue.length ? `
      <div class="stat">
        <div class="stat-num alert">${overdue.length}</div>
        <div class="stat-lbl">Overdue</div>
      </div>` : ''}
    </div>

    <div class="section">
      <div class="sec-title">This week · ${mnLabel} Week ${t.w}</div>
      ${thisWeek.length === 0
        ? '<p style="color:#9ca3af;font-size:13px">No sessions scheduled this week.</p>'
        : thisWeek.map(s => {
            const done  = !!sessions[s.id];
            const color = SUBJ_COLOR[s.subj] || '#6b7280';
            const icon  = SUBJ_ICON[s.subj]  || '📚';
            const name2 = SUBJ_NAME[s.subj]  || s.subj;
            return `
      <div class="row">
        <div class="row-icon">${done ? '✅' : '○'}</div>
        <div class="row-name ${done ? 'done' : ''}">${icon} ${s.name}</div>
        <span class="badge" style="background:${color}18;color:${color}">${name2}</span>
      </div>`;
          }).join('')}
      ${thisWeek.length > 0 && weekDone === thisWeek.length
        ? '<div class="all-done">🎉 All sessions done this week — great work!</div>' : ''}
    </div>

    ${overdue.length ? `
    <div class="section danger">
      <div class="sec-title red">⚠ Overdue — ${overdue.length} session${overdue.length !== 1 ? 's' : ''} pending</div>
      ${overdue.slice(0, 8).map(s => {
        const mLabel = monthName(s.y, s.m).slice(0, 3);
        const icon   = SUBJ_ICON[s.subj] || '';
        return `
      <div class="ov-row">
        <span style="color:#ef4444;font-size:14px">○</span>
        <span class="ov-name">${icon} ${s.name}</span>
        <span class="ov-when">${mLabel} W${s.w}</span>
      </div>`;
      }).join('')}
      ${overdue.length > 8
        ? `<p style="font-size:12px;color:#ef4444;margin-top:10px">+ ${overdue.length - 8} more overdue</p>`
        : ''}
    </div>` : ''}

    <div class="section">
      <div class="sec-title">Subject Progress</div>
      ${Object.entries(counts).map(([subj, c]) => {
        const pct   = c.total ? Math.round(c.done / c.total * 100) : 0;
        const color = SUBJ_COLOR[subj] || '#6b7280';
        const icon  = SUBJ_ICON[subj]  || '📚';
        const nm    = SUBJ_NAME[subj]  || subj;
        return `
      <div class="prog-row">
        <div class="prog-label">${icon} ${nm}</div>
        <div class="prog-track">
          <div class="prog-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <div class="prog-count">${c.done}/${c.total}</div>
      </div>`;
      }).join('')}
    </div>

  </div>
  <div class="footer">JEE Main 2027 · DASA Pathway · Daily digest · Auto-generated</div>
</div>
</body>
</html>`;

  return { subject, html };
}

// ── Gmail transporter ─────────────────────────────────────────────────────────
function makeTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[${new Date().toISOString()}] Starting digest run…`);

  const allProgress = await fetchAllUserProgress();
  console.log(`  Found ${allProgress.length} user(s) in Firestore`);

  if (allProgress.length === 0) {
    console.log('  No users found — nothing to send.');
    return;
  }

  const transporter = makeTransporter();
  let sent = 0, skipped = 0;

  for (const { uid, data } of allProgress) {
    const userInfo = await getUserEmail(uid);
    if (!userInfo || !userInfo.email) {
      console.log(`  [skip] uid=${uid} — no email found`);
      skipped++;
      continue;
    }

    const { email, name } = userInfo;
    const { subject, html } = buildEmail(name, data);

    // Primary email + any extra notify emails stored in Firestore
    const extraEmails = Array.isArray(data.notifyEmails) ? data.notifyEmails : [];
    const allRecipients = [email, ...extraEmails].filter(Boolean);

    try {
      await transporter.sendMail({
        from:    `JEE 2027 Digest <${process.env.GMAIL_USER}>`,
        to:      allRecipients,
        subject,
        html,
      });
      console.log(`  [sent] ${allRecipients.join(', ')} — ${subject}`);
      sent++;
    } catch (err) {
      console.error(`  [error] ${email} — ${err.message}`);
    }
  }

  console.log(`\n  ✓ Done — ${sent} sent, ${skipped} skipped`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
