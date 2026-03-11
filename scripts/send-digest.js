#!/usr/bin/env node
// scripts/send-digest.js
// Reads progress from GitHub Gist → builds HTML email → sends via Gmail SMTP.
// Run by GitHub Actions daily; can also be run locally with env vars set.
//
// Required env vars:
//   GIST_TOKEN          — GitHub personal access token (gist scope)
//   GIST_ID             — ID of the jee2027-progress.json Gist
//   GMAIL_USER          — Your Gmail address (e.g. you@gmail.com)
//   GMAIL_APP_PASSWORD  — 16-char Gmail App Password (not your login password)
//   DIGEST_TO_EMAIL     — Comma-separated recipients e.g. "a@x.com,b@y.com"
//
// Optional:
//   TZ                  — Timezone for date display (default: Asia/Kolkata)

'use strict';

const nodemailer = require('nodemailer');

const GIST_TOKEN   = process.env.GIST_TOKEN;
const GIST_ID      = process.env.GIST_ID;
const GMAIL_USER   = process.env.GMAIL_USER;
const GMAIL_PASS   = process.env.GMAIL_APP_PASSWORD;
// Support comma-separated list: "a@x.com, b@school.edu"
const TO_ADDRESSES = (process.env.DIGEST_TO_EMAIL || '')
  .split(',').map(e => e.trim()).filter(Boolean);
const GIST_FILENAME = 'jee2027-progress.json';

// ── Validate env ──────────────────────────────────────────────────────────────
const missing = ['GIST_TOKEN','GIST_ID','GMAIL_USER','GMAIL_APP_PASSWORD','DIGEST_TO_EMAIL']
  .filter(k => !process.env[k]);
if (missing.length) {
  console.error('Missing required env vars:', missing.join(', '));
  process.exit(1);
}

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

// Returns -1 | 0 | 1 — compares two {y,m,w} slots
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

// ── Fetch Gist ────────────────────────────────────────────────────────────────
async function fetchGist() {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    headers: {
      'Authorization': `token ${GIST_TOKEN}`,
      'User-Agent':    'jee-digest-bot',
    },
  });
  if (!res.ok) throw new Error(`Gist fetch failed — HTTP ${res.status}`);
  const gist    = await res.json();
  const content = gist.files[GIST_FILENAME]?.content;
  if (!content) throw new Error(`${GIST_FILENAME} not found in Gist`);
  return JSON.parse(content);
}

// ── Build email content ───────────────────────────────────────────────────────
function buildEmail(payload) {
  const { sessions = {}, schedule = [], startDate } = payload;
  const t = today();

  // Parse start boundary (sessions before this slot are ignored for overdue)
  let start = null;
  if (startDate) {
    const [sy, sm, sd] = startDate.split('-').map(Number);
    start = { y: sy, m: sm, w: Math.min(4, Math.ceil(sd / 7)) };
  }

  // This week's sessions
  const thisWeek = schedule.filter(s => s.y === t.y && s.m === t.m && s.w === t.w);
  const weekDone = thisWeek.filter(s => sessions[s.id]).length;
  const weekPct  = thisWeek.length ? Math.round(weekDone / thisWeek.length * 100) : 0;

  // Overdue: past slots after start, not done
  const overdue = schedule.filter(s => {
    if (cmpSlot({ y: s.y, m: s.m, w: s.w }, { y: t.y, m: t.m, w: t.w }) >= 0) return false;
    if (start && cmpSlot({ y: s.y, m: s.m, w: s.w }, start) < 0) return false;
    return !sessions[s.id];
  });

  // Per-subject totals
  const counts = {};
  for (const s of schedule) {
    if (!counts[s.subj]) counts[s.subj] = { done: 0, total: 0 };
    counts[s.subj].total++;
    if (sessions[s.id]) counts[s.subj].done++;
  }
  const grandDone  = Object.values(counts).reduce((a, c) => a + c.done,  0);
  const grandTotal = Object.values(counts).reduce((a, c) => a + c.total, 0);
  const grandPct   = grandTotal ? Math.round(grandDone / grandTotal * 100) : 0;

  const phase    = phaseLabel(t.y, t.m);
  const mnLabel  = monthName(t.y, t.m);
  const subject  = `JEE 2027 · ${mnLabel} Week ${t.w} — ${weekDone}/${thisWeek.length} done this week`;

  // ── HTML ────────────────────────────────────────────────────────────────────
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

    /* Hero */
    .hero { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 30px 32px 24px; }
    .hero-day   { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: #94a3b8; }
    .hero-date  { font-size: 24px; font-weight: 700; color: #fff; margin: 4px 0 6px; }
    .hero-phase { font-size: 14px; color: #93c5fd; }
    .hero-week  { font-size: 12px; color: #475569; margin-top: 3px; }

    /* Summary strip */
    .strip { background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-around; padding: 16px 0; }
    .stat       { text-align: center; }
    .stat-num   { font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1; }
    .stat-lbl   { font-size: 10px; text-transform: uppercase; letter-spacing: .07em; color: #94a3b8; margin-top: 3px; }
    .stat-num.alert { color: #dc2626; }

    /* Sections */
    .section        { padding: 20px 28px; border-bottom: 1px solid #f1f5f9; }
    .section.danger { background: #fff5f5; }
    .sec-title { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #94a3b8; margin-bottom: 14px; }
    .sec-title.red  { color: #dc2626; }

    /* Session rows */
    .row       { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid #f8fafc; }
    .row:last-child { border-bottom: none; }
    .row-icon  { width: 22px; text-align: center; font-size: 15px; flex-shrink: 0; }
    .row-name  { font-size: 14px; color: #1e293b; flex: 1; }
    .row-name.done { color: #9ca3af; text-decoration: line-through; }
    .badge     { font-size: 10px; padding: 2px 8px; border-radius: 20px; font-weight: 600; white-space: nowrap; }

    /* Progress bars */
    .prog-row   { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .prog-label { font-size: 13px; color: #374151; width: 110px; flex-shrink: 0; }
    .prog-track { flex: 1; background: #f1f5f9; border-radius: 99px; height: 8px; }
    .prog-fill  { height: 8px; border-radius: 99px; transition: width .3s; }
    .prog-count { font-size: 12px; color: #6b7280; width: 50px; text-align: right; flex-shrink: 0; }

    /* Overdue rows */
    .ov-row  { display: flex; align-items: center; gap: 10px; padding: 5px 0; }
    .ov-name { font-size: 13px; color: #dc2626; flex: 1; }
    .ov-when { font-size: 11px; color: #ef4444; flex-shrink: 0; }

    /* All-done */
    .all-done { text-align: center; padding: 14px 0 4px; font-size: 15px; color: #16a34a; font-weight: 600; }

    /* Footer */
    .footer { text-align: center; padding: 18px; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="card">

    <!-- ── Hero ── -->
    <div class="hero">
      <div class="hero-day">${t.dayName}</div>
      <div class="hero-date">${t.dateStr}</div>
      <div class="hero-phase">📖 ${phase}</div>
      <div class="hero-week">${mnLabel} · Week ${t.w} of 4</div>
    </div>

    <!-- ── Summary strip ── -->
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

    <!-- ── This week's sessions ── -->
    <div class="section">
      <div class="sec-title">This week · ${mnLabel} Week ${t.w}</div>
      ${thisWeek.length === 0
        ? '<p style="color:#9ca3af;font-size:13px">No sessions scheduled this week.</p>'
        : thisWeek.map(s => {
            const done  = !!sessions[s.id];
            const color = SUBJ_COLOR[s.subj] || '#6b7280';
            const icon  = SUBJ_ICON[s.subj]  || '📚';
            const name  = SUBJ_NAME[s.subj]  || s.subj;
            return `
      <div class="row">
        <div class="row-icon">${done ? '✅' : '○'}</div>
        <div class="row-name ${done ? 'done' : ''}">${icon} ${s.name}</div>
        <span class="badge" style="background:${color}18;color:${color}">${name}</span>
      </div>`;
          }).join('')}
      ${thisWeek.length > 0 && weekDone === thisWeek.length
        ? '<div class="all-done">🎉 All sessions done this week — great work!</div>'
        : ''}
    </div>

    <!-- ── Overdue ── -->
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

    <!-- ── Subject progress ── -->
    <div class="section">
      <div class="sec-title">Subject Progress</div>
      ${Object.entries(counts).map(([subj, c]) => {
        const pct   = c.total ? Math.round(c.done / c.total * 100) : 0;
        const color = SUBJ_COLOR[subj] || '#6b7280';
        const icon  = SUBJ_ICON[subj]  || '📚';
        const name  = SUBJ_NAME[subj]  || subj;
        return `
      <div class="prog-row">
        <div class="prog-label">${icon} ${name}</div>
        <div class="prog-track">
          <div class="prog-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <div class="prog-count">${c.done}/${c.total}</div>
      </div>`;
      }).join('')}
    </div>

  </div><!-- /card -->
  <div class="footer">JEE Main 2027 · DASA Pathway · Daily digest · Auto-generated</div>
</div>
</body>
</html>`;

  return { subject, html };
}

// ── Send via Gmail SMTP ───────────────────────────────────────────────────────
async function sendEmail(subject, html) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  });
  await transporter.sendMail({
    from:    `JEE 2027 Digest <${GMAIL_USER}>`,
    to:      TO_ADDRESSES,   // array — nodemailer sends to all recipients
    subject,
    html,
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[${new Date().toISOString()}] Fetching Gist…`);
  const payload = await fetchGist();
  console.log(`  Sessions tracked : ${Object.keys(payload.sessions || {}).length}`);
  console.log(`  Schedule entries : ${(payload.schedule || []).length}`);

  const { subject, html } = buildEmail(payload);
  console.log(`  Subject          : ${subject}`);
  console.log(`  Recipients       : ${TO_ADDRESSES.join(', ')}`);

  await sendEmail(subject, html);
  console.log(`  ✓ Sent to ${TO_ADDRESSES.length} recipient(s)`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
