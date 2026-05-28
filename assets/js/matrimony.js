import { createSupabaseClient, withTimeout } from './supabase-config.js';

(async function () {

// ── DOM refs ───────────────────────────────────────────────────────────────────
const stages = {};
document.querySelectorAll('[data-stage]').forEach(el => { stages[el.dataset.stage] = el; });

const authBar        = document.getElementById('auth-bar');
const authEmailDisp  = document.getElementById('auth-email-display');
const btnSignout     = document.getElementById('btn-signout');

// auth
const btnGoogleSignin = document.getElementById('btn-google-signin');
const authGoogleErr   = document.getElementById('auth-google-err');

// auth chip
const authChipWrap  = document.getElementById('auth-chip-wrap');
const authChipBtn   = document.getElementById('auth-chip-btn');
const authChipDrop  = document.getElementById('auth-chip-drop');
const authChipAv    = document.getElementById('auth-chip-av');
const authChipName  = document.getElementById('auth-chip-name');
const authChipEmail = document.getElementById('auth-chip-email');
const authSubsBadge = document.getElementById('auth-subs-badge');

// consent
const consentForm    = document.getElementById('consent-form');
const consentSignedAs= document.getElementById('consent-signed-as');
const consentErr     = document.getElementById('consent-err');

// gate
const gateFirstname  = document.getElementById('gate-firstname');
const gateCardCand   = document.getElementById('gate-card-cand');
const gateCardReq    = document.getElementById('gate-card-req');
const gateStatusCand = document.getElementById('gate-status-cand');
const gateStatusReq  = document.getElementById('gate-status-req');
const gateCtaCand    = document.getElementById('gate-cta-cand');
const gateCtaReq     = document.getElementById('gate-cta-req');
const gateUnlock     = document.getElementById('gate-unlock');
const gateUnlockH    = document.getElementById('gate-unlock-h');
const gateUnlockSub  = document.getElementById('gate-unlock-sub');
const gateUnlockIcon = document.getElementById('gate-unlock-icon');
const btnBrowse      = document.getElementById('btn-browse');

// forms
const candidateForm  = document.getElementById('candidate-form');
const candErr        = document.getElementById('cand-err');
const candOk         = document.getElementById('cand-ok');
const requirementForm= document.getElementById('requirement-form');
const reqErr         = document.getElementById('req-err');
const reqOk          = document.getElementById('req-ok');

// browse
const browseFilters  = document.getElementById('browse-filters');
const browseGrid     = document.getElementById('browse-grid');
const browseSummary  = document.getElementById('browse-summary');

// detail
const detailHeroBody = document.getElementById('detail-hero-body');
const detailMain     = document.getElementById('detail-main');
const detailSidebar  = document.getElementById('detail-sidebar');

// ── App state ──────────────────────────────────────────────────────────────────
let supabase, currentUser, memberRecord;
let subs = { candidates: [], requirement: null };
let browseData = [], browseFilter = 'all';

// ── Bootstrap ──────────────────────────────────────────────────────────────────
supabase = await createSupabaseClient();

// data-go routing (event delegation)
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-go]');
  if (!btn) return;
  if (authChipDrop) authChipDrop.style.display = 'none';
  const dest = btn.dataset.go;
  if (dest === 'landing')        { showStage('landing'); return; }
  if (dest === 'auth')           { showStage('auth'); return; }
  if (dest === 'gate')           { renderGate(); return; }
  if (dest === 'browse')         { openBrowse(); return; }
  if (dest === 'candidate')      { showStage('candidate'); return; }
  if (dest === 'requirement')    { showStage('requirement'); return; }
  if (dest === 'my-submissions') { renderMySubmissions(); return; }
});

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') return;
  if (session?.user) {
    currentUser = session.user;
    showAuthBar(session.user);
    afterSignIn();
  } else {
    currentUser = null;
    hideAuthBar();
    showStage('landing');
  }
});

const { data: { session } } = await supabase.auth.getSession();
if (session?.user) {
  currentUser = session.user;
  showAuthBar(session.user);
  afterSignIn();
} else {
  showStage('landing');
}

// ── Stage helper ───────────────────────────────────────────────────────────────
function showStage(name) {
  Object.values(stages).forEach(el => el.classList.remove('active'));
  if (stages[name]) stages[name].classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Auth bar / chip ────────────────────────────────────────────────────────────
function showAuthBar(user) {
  if (authBar) authBar.classList.add('visible');
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0];
  const initials = fullName.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (authChipAv)    authChipAv.textContent    = initials;
  if (authChipName)  authChipName.textContent  = fullName;
  if (authChipEmail) authChipEmail.textContent = user.email;
}
function hideAuthBar() {
  if (authBar) authBar.classList.remove('visible');
  if (authChipDrop) authChipDrop.style.display = 'none';
}
function updateSubsBadge() {
  if (!authSubsBadge) return;
  const total = subs.candidates.length + (subs.requirement ? 1 : 0);
  authSubsBadge.textContent  = total;
  authSubsBadge.style.display = total > 0 ? '' : 'none';
}

// Chip dropdown toggle
authChipBtn?.addEventListener('click', e => {
  e.stopPropagation();
  if (!authChipDrop) return;
  const open = authChipDrop.style.display !== 'none';
  authChipDrop.style.display = open ? 'none' : 'block';
});
document.addEventListener('click', e => {
  if (authChipWrap && !authChipWrap.contains(e.target)) {
    if (authChipDrop) authChipDrop.style.display = 'none';
  }
});

btnSignout?.addEventListener('click', async () => { await supabase.auth.signOut(); });

// ── Auth — Google OAuth ────────────────────────────────────────────────────────
btnGoogleSignin?.addEventListener('click', async () => {
  btnGoogleSignin.disabled    = true;
  btnGoogleSignin.textContent = 'Redirecting to Google…';
  if (authGoogleErr) authGoogleErr.classList.add('hidden');

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://iraqibiradari.com/matrimony/' },
  });

  // Only reached if OAuth fails to redirect (e.g. provider not enabled)
  btnGoogleSignin.disabled    = false;
  btnGoogleSignin.textContent = 'Sign in with Google';
  if (error && authGoogleErr) {
    authGoogleErr.textContent = error.message;
    authGoogleErr.classList.remove('hidden');
  }
});

// ── After sign-in routing ──────────────────────────────────────────────────────
async function afterSignIn() {
  const { data: member } = await supabase
    .from('matrimony_members')
    .select('*')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if (!member) {
    // First time — show consent
    if (consentSignedAs) consentSignedAs.textContent = currentUser.email;
    const nameEl = consentForm?.elements['full_name'];
    if (nameEl && currentUser.user_metadata?.full_name && !nameEl.value) {
      nameEl.value = currentUser.user_metadata.full_name;
    }
    showStage('consent');
    return;
  }

  memberRecord = member;
  await loadSubs();
  renderGate();
}

// ── Submissions check ──────────────────────────────────────────────────────────
// Gate-only: minimal columns that are guaranteed to exist.
async function loadSubs() {
  const [pRes, rRes] = await Promise.all([
    supabase.from('matrimony_profiles')
      .select('id,candidate_name,candidate_gender,marital_status,status,created_at')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: true }),
    supabase.from('matrimony_requirements')
      .select('id,seeker_name,seeking_for,status,created_at')
      .eq('user_id', currentUser.id)
      .maybeSingle(),
  ]);
  if (pRes.error) console.error('[loadSubs] profiles error:', pRes.error);
  if (rRes.error) console.error('[loadSubs] requirements error:', rRes.error);
  subs.candidates  = pRes.data  || [];
  subs.requirement = rRes.data  || null;
  updateSubsBadge();
}

// Detailed load for My Submissions — tries extended columns, falls back gracefully.
async function loadSubsDetailed() {
  // Try with extended columns first (requires matrimony_submissions_migration.sql)
  const [pRes, rRes] = await Promise.all([
    supabase.from('matrimony_profiles')
      .select('id,candidate_name,candidate_gender,marital_status,status,created_at,updated_at,closed_on,admin_feedback,meta')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: true }),
    supabase.from('matrimony_requirements')
      .select('id,seeker_name,seeking_for,status,created_at,updated_at,closed_on,admin_feedback,meta')
      .eq('user_id', currentUser.id)
      .maybeSingle(),
  ]);

  // If extended columns missing (400), fall back to minimal
  const pData = pRes.error ? subs.candidates : (pRes.data || []);
  const rData = rRes.error ? subs.requirement : (rRes.data || null);

  if (pRes.error) console.warn('[loadSubsDetailed] profiles extended columns missing — using cached minimal data');
  if (rRes.error) console.warn('[loadSubsDetailed] requirements extended columns missing — using cached minimal data');

  subs.candidates  = pData;
  subs.requirement = rData;
  updateSubsBadge();
}

// ── Gate render ────────────────────────────────────────────────────────────────
async function renderGate() {
  await loadSubs();

  const first = memberRecord?.full_name?.split(' ')[0] || '';
  if (gateFirstname) gateFirstname.textContent = first ? `, ${first}` : '';

  const candCount = subs.candidates.length;
  const candDone  = candCount > 0;
  const reqDone   = Boolean(subs.requirement);
  const both      = candDone && reqDone;

  const doneClass    = 'text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full';
  const pendingClass = 'text-xs font-bold text-archive-muted border border-archive-line px-2 py-0.5 rounded-full';

  // ── Candidate card ──
  gateCardCand?.classList.toggle('done', candDone);

  if (gateStatusCand) {
    gateStatusCand.textContent = candDone ? `✓ ${candCount} submitted` : 'Pending';
    gateStatusCand.className   = candDone ? doneClass : pendingClass;
  }

  // Name pills
  const pillsEl = document.getElementById('gate-cand-pills');
  if (pillsEl) {
    if (candDone) {
      const shown = subs.candidates.slice(0, 3);
      const extra = subs.candidates.length - 3;
      pillsEl.innerHTML =
        shown.map(c => `<span style="font-size:12px;font-weight:700;padding:3px 10px;background:rgba(31,58,42,.1);border:1px solid rgba(31,58,42,.2);border-radius:999px;color:#1f3a2a;white-space:nowrap">${esc(c.candidate_name || '—')}</span>`).join('') +
        (extra > 0 ? `<span style="font-size:12px;color:#746b5f;padding:3px 6px">+${extra} more</span>` : '');
      pillsEl.style.display = 'flex';
    } else {
      pillsEl.style.display = 'none';
    }
  }

  // Actions inside card
  const actionsEl = document.getElementById('gate-cand-actions');
  if (actionsEl) {
    if (candDone) {
      actionsEl.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px;padding-top:12px;border-top:1px solid #e6d9b0;margin-top:4px">
          <button data-go="candidate"
            style="padding:9px 16px;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;background:transparent;border:1.5px solid #1f3a2a;border-radius:3px;cursor:pointer;color:#1f3a2a;text-align:left">
            Manage submissions →
          </button>
          <button data-go="candidate"
            style="padding:8px 14px;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;background:transparent;border:1px dashed #b08840;border-radius:3px;cursor:pointer;color:#b08840;text-align:left">
            ＋ Add another candidate
          </button>
        </div>`;
      if (gateCardCand) { gateCardCand.onclick = null; gateCardCand.style.cursor = 'default'; }
    } else {
      actionsEl.innerHTML = `<span class="text-xs font-black uppercase tracking-[.1em] text-archive-gold" style="margin-top:8px;display:block">Begin →</span>`;
      if (gateCardCand) { gateCardCand.onclick = () => showStage('candidate'); gateCardCand.style.cursor = 'pointer'; }
    }
  }

  // ── Requirement card ──
  gateCardReq?.classList.toggle('done', reqDone);
  if (gateStatusReq)  { gateStatusReq.textContent = reqDone ? '✓ Submitted' : 'Pending'; gateStatusReq.className = reqDone ? doneClass : pendingClass; }
  if (gateCtaReq)     gateCtaReq.textContent = reqDone ? 'Edit submission →' : 'Begin →';
  if (gateCardReq)    gateCardReq.onclick = () => showStage('requirement');

  // ── Unlock bar ──
  gateUnlock?.classList.toggle('ready', both);
  if (gateUnlockIcon) gateUnlockIcon.innerHTML = both
    ? `<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="#1f3a2a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l5 5L21 7"/></svg>`
    : `<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="#6b5a3f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="12" width="14" height="10" rx="2"/><path d="M9 12V9a4 4 0 1 1 8 0v3"/></svg>`;
  if (gateUnlockH)   gateUnlockH.textContent   = both ? 'Listings unlocked' : 'Listings are locked';
  if (gateUnlockSub) gateUnlockSub.textContent  = both
    ? 'You can now browse matches, filter by marital status, and request introductions.'
    : 'Complete both submissions above to unlock the matrimony directory.';
  if (btnBrowse) {
    btnBrowse.disabled    = !both;
    btnBrowse.textContent = both ? 'Browse matches →' : 'Locked';
    btnBrowse.style.opacity = both ? '1' : '0.4';
    btnBrowse.style.cursor  = both ? 'pointer' : 'not-allowed';
    btnBrowse.onclick = both ? () => openBrowse() : null;
  }

  showStage('gate');
}

// ── My submissions ─────────────────────────────────────────────────────────────
const STATUS_META = {
  new:       { label: 'Under review',      cls: 'sbadge--new',       kind: 'open'   },
  review:    { label: 'Under review',      cls: 'sbadge--review',    kind: 'open'   },
  approved:  { label: 'Approved & listed', cls: 'sbadge--approved',  kind: 'open'   },
  changes:   { label: 'Needs changes',     cls: 'sbadge--changes',   kind: 'open'   },
  engaged:   { label: 'Engaged',           cls: 'sbadge--engaged',   kind: 'closed' },
  married:   { label: 'Married',           cls: 'sbadge--married',   kind: 'closed' },
  closed:    { label: 'Closed',            cls: 'sbadge--closed',    kind: 'closed' },
  withdrawn: { label: 'Withdrawn',         cls: 'sbadge--withdrawn', kind: 'closed' },
  archived:  { label: 'Archived',          cls: 'sbadge--archived',  kind: 'closed' },
};

let mySubsTab = 'candidates';
let pendingClose = null; // { kind, id }
let pendingCloseReason = null;

async function renderMySubmissions() {
  await loadSubsDetailed();
  showStage('my-submissions');

  const candCt = document.getElementById('mysubs-cand-ct');
  const reqCt  = document.getElementById('mysubs-req-ct');
  if (candCt) candCt.textContent = subs.candidates.length;
  if (reqCt)  reqCt.textContent  = subs.requirement ? 1 : 0;

  // Tab wiring
  document.querySelectorAll('.mysubs-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      mySubsTab = tab.dataset.subtab;
      document.querySelectorAll('.mysubs-tab').forEach(t => t.classList.toggle('mysubs-tab--on', t.dataset.subtab === mySubsTab));
      renderMySubsList();
    });
  });

  renderMySubsList();
}

function renderMySubsList() {
  const listEl = document.getElementById('mysubs-list');
  if (!listEl) return;

  let items = [];
  if (mySubsTab === 'candidates') {
    items = subs.candidates.map(c => ({
      id: c.id, kind: 'candidate',
      title: c.candidate_name,
      subtitle: [c.candidate_gender, cap(normMs(c.marital_status))].filter(Boolean).join(' · '),
      status: c.status || 'new',
      submittedOn: c.created_at, updatedOn: c.updated_at,
      closedOn: c.closed_on, adminFeedback: c.admin_feedback, meta: c.meta,
    }));
  } else if (subs.requirement) {
    const r = subs.requirement;
    items = [{
      id: r.id, kind: 'requirement',
      title: r.seeker_name,
      subtitle: r.seeking_for ? `Seeking for ${r.seeking_for}` : 'Match requirement',
      status: r.status || 'new',
      submittedOn: r.created_at, updatedOn: r.updated_at,
      closedOn: r.closed_on, adminFeedback: r.admin_feedback, meta: r.meta,
    }];
  }

  if (!items.length) {
    listEl.innerHTML = `<div style="padding:32px 0;color:#746b5f;font-size:15px">No ${mySubsTab} submitted yet.</div>`;
    return;
  }

  const open   = items.filter(i => (STATUS_META[i.status]||{}).kind !== 'closed');
  const closed = items.filter(i => (STATUS_META[i.status]||{}).kind === 'closed');

  let html = '';
  if (open.length)   html += `<div class="text-xs font-black uppercase tracking-[.12em] text-archive-muted mb-3 mt-1">Active · ${open.length}</div>` + open.map(subRowHtml).join('');
  if (closed.length) html += `<div class="text-xs font-black uppercase tracking-[.12em] text-archive-muted mb-3 mt-6">Closed · ${closed.length}</div>` + closed.map(subRowHtml).join('');

  listEl.innerHTML = html;

  // Wire action buttons
  listEl.querySelectorAll('[data-act]').forEach(btn => {
    const { act, id, kind } = btn.dataset;
    if (act === 'edit')   btn.addEventListener('click', () => showStage(kind === 'candidate' ? 'candidate' : 'requirement'));
    if (act === 'close')  btn.addEventListener('click', () => openCloseModal(kind, id));
    if (act === 'reopen') btn.addEventListener('click', () => doReopen(kind, id));
  });
}

function subRowHtml(item) {
  const st       = STATUS_META[item.status] || STATUS_META.new;
  const isClosed = st.kind === 'closed';
  const isChanges= item.status === 'changes';
  const dateStr  = item.submittedOn ? new Date(item.submittedOn).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '';

  return `
  <div class="sub-row${isClosed ? ' sub-row--closed' : ''}">
    <div class="sub-row__top">
      <span class="sbadge ${st.cls}">${st.label}</span>
      <span class="sub-row__dates">Submitted ${esc(dateStr)}</span>
    </div>
    <div class="sub-row__name">${esc(item.title)}</div>
    <div class="sub-row__sub">${esc(item.subtitle)}</div>
    ${item.adminFeedback ? `<div class="sub-row__fb"><strong>Admin feedback:</strong> ${esc(item.adminFeedback)}</div>` : ''}
    ${item.meta && !item.adminFeedback ? `<div style="font-size:13px;color:#746b5f;margin-top:2px">${esc(item.meta)}</div>` : ''}
    <div class="sub-row__acts">
      ${!isClosed ? `
        <button class="abt abt-${isChanges?'changes':'ghost'}" data-act="edit" data-id="${esc(item.id)}" data-kind="${esc(item.kind)}">${isChanges?'Edit &amp; resubmit':'Edit'}</button>
        <button class="abt abt-warn" data-act="close" data-id="${esc(item.id)}" data-kind="${esc(item.kind)}">Close listing… ▾</button>
      ` : `
        <button class="abt abt-ghost" data-act="reopen" data-id="${esc(item.id)}" data-kind="${esc(item.kind)}">Re-open</button>
      `}
    </div>
  </div>`;
}

// ── Close modal ────────────────────────────────────────────────────────────────
function openCloseModal(kind, id) {
  pendingClose = { kind, id };
  pendingCloseReason = null;

  const backdrop = document.getElementById('cl-backdrop');
  const reasons  = document.getElementById('cl-reasons');
  const confirmSec = document.getElementById('cl-confirm-section');
  const nextBtn  = document.getElementById('cl-next');
  const noteEl   = document.getElementById('cl-note');

  document.getElementById('cl-h').textContent    = 'Close this listing';
  document.getElementById('cl-body').textContent = 'Choose how you want to close this submission.';
  if (reasons)     reasons.style.display     = '';
  if (confirmSec)  confirmSec.style.display  = 'none';
  if (noteEl)      noteEl.value = '';
  if (nextBtn) { nextBtn.textContent = 'Select a reason'; nextBtn.disabled = true; }

  // Reason buttons
  document.querySelectorAll('.cl-reason').forEach(btn => {
    btn.classList.remove('cl-reason--on');
    btn.onclick = () => {
      document.querySelectorAll('.cl-reason').forEach(b => b.classList.remove('cl-reason--on'));
      btn.classList.add('cl-reason--on');
      pendingCloseReason = btn.dataset.reason;
      if (nextBtn) { nextBtn.textContent = 'Continue →'; nextBtn.disabled = false; }
    };
  });

  // Next / confirm
  if (nextBtn) {
    nextBtn.onclick = async () => {
      if (!pendingCloseReason) return;
      if (reasons && reasons.style.display !== 'none') {
        // Step 1 → Step 2: show confirm section
        const COPY = {
          engaged:   { h: 'MashaAllah — Mark as engaged?',   body: 'This marks the listing as engaged and removes it from the active directory.' },
          married:   { h: 'Alhamdulillah — Mark as married?', body: 'Alhamdulillah. This closes the listing as a successful match.' },
          closed:    { h: 'Close this listing?',              body: 'This closes the listing without specifying an outcome.' },
          withdrawn: { h: 'Withdraw this listing?',           body: 'This takes the listing down immediately. You can re-submit at any time.' },
        };
        const c = COPY[pendingCloseReason] || COPY.closed;
        document.getElementById('cl-confirm-h').textContent    = c.h;
        document.getElementById('cl-confirm-body').textContent = c.body;
        if (reasons)    reasons.style.display    = 'none';
        if (confirmSec) confirmSec.style.display = '';
        nextBtn.textContent = 'Confirm';
        const isPositive = pendingCloseReason === 'engaged' || pendingCloseReason === 'married';
        nextBtn.style.background   = isPositive ? '#1f3a2a' : '#743a32';
        nextBtn.style.borderColor  = isPositive ? '#1f3a2a' : '#743a32';
        return;
      }
      // Step 2 → submit
      await doClose(pendingClose.kind, pendingClose.id, pendingCloseReason, noteEl?.value || '');
    };
  }

  document.getElementById('cl-cancel').onclick = () => { backdrop.style.display = 'none'; };
  backdrop.onclick = e => { if (e.target === backdrop) backdrop.style.display = 'none'; };
  backdrop.style.display = 'flex';
}

async function doClose(kind, id, statusId, note) {
  const table   = kind === 'candidate' ? 'matrimony_profiles' : 'matrimony_requirements';
  const today   = new Date().toISOString().slice(0, 10);
  const ST_META = STATUS_META[statusId] || {};
  const metaStr = note || `Marked ${(ST_META.label || statusId).toLowerCase()} on ${new Date().toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'})}.`;

  const { error } = await supabase.from(table).update({
    status: statusId, closed_on: today, meta: metaStr,
  }).eq('id', id).eq('user_id', currentUser.id);

  document.getElementById('cl-backdrop').style.display = 'none';

  if (error) { alert('Could not update: ' + error.message); return; }

  // Update local cache
  if (kind === 'candidate') {
    const c = subs.candidates.find(x => x.id === id);
    if (c) { c.status = statusId; c.closed_on = today; c.meta = metaStr; }
  } else if (subs.requirement?.id === id) {
    subs.requirement.status    = statusId;
    subs.requirement.closed_on = today;
    subs.requirement.meta      = metaStr;
  }
  updateSubsBadge();
  renderMySubsList();
}

async function doReopen(kind, id) {
  const table = kind === 'candidate' ? 'matrimony_profiles' : 'matrimony_requirements';
  const { error } = await supabase.from(table).update({
    status: 'review', closed_on: null, meta: 'Re-opened and submitted for review.',
  }).eq('id', id).eq('user_id', currentUser.id);

  if (error) { alert('Could not reopen: ' + error.message); return; }

  if (kind === 'candidate') {
    const c = subs.candidates.find(x => x.id === id);
    if (c) { c.status = 'review'; c.closed_on = null; c.meta = 'Re-opened and submitted for review.'; }
  } else if (subs.requirement?.id === id) {
    subs.requirement.status    = 'review';
    subs.requirement.closed_on = null;
    subs.requirement.meta      = 'Re-opened and submitted for review.';
  }
  updateSubsBadge();
  renderMySubsList();
}

// ── Consent form ───────────────────────────────────────────────────────────────
consentForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = consentForm.querySelector('button[type="submit"]');
  const data = new FormData(consentForm);
  btn.disabled = true; btn.textContent = 'Saving…';
  if (consentErr) consentErr.classList.add('hidden');

  const payload = {
    user_id:          currentUser.id,
    full_name:        str(data, 'full_name'),
    mobile:           str(data, 'mobile'),
    native_location:  str(data, 'native_location'),
    current_location: str(data, 'current_location'),
    akt_profile_url:  str(data, 'akt_profile_url'),
  };

  const { error } = await supabase.from('matrimony_members').upsert(payload, { onConflict: 'user_id' });

  btn.disabled = false; btn.textContent = 'Continue to next step →';
  if (error) { if (consentErr) { consentErr.textContent = error.message; consentErr.classList.remove('hidden'); } return; }

  const { data: member } = await supabase.from('matrimony_members').select('*').eq('user_id', currentUser.id).maybeSingle();
  memberRecord = member;
  await loadSubs();
  renderGate();
});

// ── Candidate form ─────────────────────────────────────────────────────────────
candidateForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn  = candidateForm.querySelector('button[type="submit"]');
  const data = new FormData(candidateForm);
  btn.disabled = true; btn.textContent = 'Submitting…';
  candErr?.classList.add('hidden'); candOk?.classList.add('hidden');

  const payload = {
    user_id:                   currentUser.id,
    candidate_name:            str(data, 'candidate_name'),
    dob:                       str(data, 'dob') || null,
    candidate_gender:          str(data, 'candidate_gender'),
    marital_status:            str(data, 'marital_status') || null,
    native_location:           str(data, 'native_location') || null,
    birth_location:            str(data, 'birth_location') || null,
    current_location:          str(data, 'current_location') || null,
    education:                 str(data, 'education') || null,
    profession:                str(data, 'profession') || null,
    family_background:         str(data, 'family_background') || null,
    expectations:              str(data, 'expectations') || null,
    contact_person_name:       str(data, 'contact_person_name'),
    relationship_to_candidate: str(data, 'relationship_to_candidate') || null,
    phone_whatsapp:            str(data, 'phone_whatsapp'),
    akt_profile_url:           str(data, 'akt_profile_url') || null,
    photo_url:                 str(data, 'photo_url') || null,
    consent_confirmed:         true,
    status:                    'new',
    published:                 false,
  };

  const { data: inserted, error } = await supabase.from('matrimony_profiles').insert(payload).select('id,candidate_name,candidate_gender,marital_status').single();

  btn.disabled = false; btn.textContent = 'Submit candidate details →';
  if (error) { if (candErr) { candErr.textContent = error.message; candErr.classList.remove('hidden'); } return; }

  if (candOk) { candOk.textContent = 'Candidate profile submitted — returning to dashboard…'; candOk.classList.remove('hidden'); }
  subs.candidates.push(inserted || { id: 'new', candidate_name: payload.candidate_name });
  setTimeout(() => renderGate(), 1200);
});

// ── Requirement form ───────────────────────────────────────────────────────────
requirementForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn  = requirementForm.querySelector('button[type="submit"]');
  const data = new FormData(requirementForm);
  btn.disabled = true; btn.textContent = 'Submitting…';
  reqErr?.classList.add('hidden'); reqOk?.classList.add('hidden');

  const payload = {
    user_id:                  currentUser.id,
    seeker_name:              str(data, 'seeker_name'),
    seeking_for:              str(data, 'seeking_for') || null,
    preferred_gender:         str(data, 'preferred_gender') || null,
    preferred_marital_status: str(data, 'preferred_marital_status') || 'any',
    preferred_age_range:      str(data, 'preferred_age_range') || null,
    preferred_location:       str(data, 'preferred_location') || null,
    preferred_education:      str(data, 'preferred_education') || null,
    preferred_occupation:     str(data, 'preferred_occupation') || null,
    notes:                    str(data, 'notes') || null,
    consent_confirmed:        true,
    status:                   'new',
  };

  // Always check DB for an existing row — don't rely on in-memory state
  const { data: existing } = await supabase
    .from('matrimony_requirements')
    .select('id')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  let saveError;
  if (existing?.id) {
    const { error } = await supabase
      .from('matrimony_requirements')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .eq('user_id', currentUser.id);
    saveError = error;
    if (!error) subs.requirement = { ...(subs.requirement || {}), id: existing.id, seeker_name: payload.seeker_name };
  } else {
    const { data: inserted, error } = await supabase
      .from('matrimony_requirements')
      .insert(payload)
      .select('id,seeker_name,seeking_for,status')
      .single();
    saveError = error;
    if (!error && inserted) subs.requirement = inserted;
  }

  btn.disabled = false; btn.textContent = 'Submit match requirement →';
  if (saveError) {
    console.error('[req submit]', saveError);
    if (reqErr) { reqErr.textContent = saveError.message; reqErr.classList.remove('hidden'); }
    return;
  }

  if (reqOk) { reqOk.textContent = 'Match requirement submitted — returning to dashboard…'; reqOk.classList.remove('hidden'); }
  if (!subs.requirement) subs.requirement = { id: 'new', seeker_name: payload.seeker_name };
  setTimeout(() => renderGate(), 1200);
});

// ── Browse ─────────────────────────────────────────────────────────────────────
async function openBrowse() {
  showStage('browse');

  if (!browseData.length) {
    if (browseGrid) browseGrid.innerHTML = `<div class="bg-archive-paper p-12 text-center text-sm text-archive-muted" style="grid-column:1/-1">Loading listings…</div>`;

    const { data, error } = await withTimeout(
      supabase.from('matrimony_profiles')
        .select('id,initials,candidate_gender,marital_status,education,profession,native_location,current_location,dob,contact_person_name,relationship_to_candidate')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
    );

    if (error) {
      if (browseGrid) browseGrid.innerHTML = `<div class="bg-archive-paper p-12 text-center text-sm text-red-700" style="grid-column:1/-1">${esc(error.message)}</div>`;
      return;
    }

    browseData = (data || []).map(p => ({
      ...p,
      marital_status: normMs(p.marital_status),
      age: p.dob ? Math.floor((Date.now() - new Date(p.dob).getTime()) / (365.25 * 86400000)) : null,
    }));
  }

  updateCounts();
  renderBrowseGrid();
}

function updateCounts() {
  const cnt = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  cnt('cnt-all', browseData.length);
  ['fresh','divorced','widowed','separated'].forEach(s => {
    cnt(`cnt-${s}`, browseData.filter(c => c.marital_status === s).length);
  });
}

function renderBrowseGrid() {
  const list = browseFilter === 'all' ? browseData : browseData.filter(c => c.marital_status === browseFilter);

  if (browseSummary) {
    const label = browseFilter === 'all' ? 'in the community directory' : `· <em style="text-transform:capitalize">${browseFilter}</em>`;
    browseSummary.innerHTML = `<strong>${list.length}</strong> candidates ${label} <span class="text-archive-muted text-xs">· Updated by community admins</span>`;
  }

  if (!list.length) {
    if (browseGrid) browseGrid.innerHTML = `<div class="bg-archive-paper p-12 text-center text-sm text-archive-muted" style="grid-column:1/-1">No listings in this category yet.</div>`;
    return;
  }

  if (browseGrid) browseGrid.innerHTML = list.map(c => {
    const initials  = c.initials || (c.candidate_gender === 'Male' ? 'M' : 'F');
    const badgeCls  = `mbadge mbadge-${c.marital_status || 'fresh'}`;
    const badgeTxt  = cap(c.marital_status || 'fresh');
    const edu       = (c.education || '').split(',')[0].split('(')[0].trim();
    const ageStr    = c.age ? `, ${c.age}` : '';
    return `
    <button class="cand-card" onclick="window.__openDetail('${esc(c.id)}')">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <div class="m-avatar">${esc(initials)}</div>
        <span class="${badgeCls}">${badgeTxt}</span>
      </div>
      <div class="mt-2 font-display text-lg font-bold text-archive-green">${esc(initials)} · ${esc(c.candidate_gender || '')}${ageStr}</div>
      ${edu        ? `<div class="text-sm text-archive-ink">${esc(edu)}</div>` : ''}
      ${c.profession ? `<div class="text-xs text-archive-muted">${esc(c.profession)}</div>` : ''}
      ${c.current_location ? `<div class="text-xs text-archive-muted">${esc(c.current_location)}</div>` : ''}
      ${c.native_location  ? `<div class="text-xs text-archive-muted">Native: ${esc(c.native_location)}</div>` : ''}
      <div class="mt-auto pt-3 text-xs font-black uppercase tracking-[.08em] text-archive-gold">View full profile →</div>
    </button>`;
  }).join('');
}

// Filter pills
browseFilters?.addEventListener('click', e => {
  const pill = e.target.closest('[data-filter]');
  if (!pill) return;
  browseFilter = pill.dataset.filter;
  document.querySelectorAll('#browse-filters .m-pill').forEach(p => p.classList.toggle('on', p.dataset.filter === browseFilter));
  renderBrowseGrid();
});

window.__openDetail = (id) => loadDetail(id);

// ── Detail ─────────────────────────────────────────────────────────────────────
async function loadDetail(profileId) {
  showStage('detail');
  if (detailHeroBody) detailHeroBody.innerHTML = `<p class="text-sm text-archive-paper/60">Loading…</p>`;
  if (detailMain)    detailMain.innerHTML    = '';
  if (detailSidebar) detailSidebar.innerHTML = '';

  const { data: c, error } = await supabase
    .from('matrimony_profiles')
    .select('*')
    .eq('id', profileId)
    .eq('status', 'approved')
    .single();

  if (error || !c) {
    if (detailHeroBody) detailHeroBody.innerHTML = `<p class="text-archive-paper">Profile not found.</p>`;
    return;
  }

  const age      = c.dob ? Math.floor((Date.now() - new Date(c.dob).getTime()) / (365.25 * 86400000)) : null;
  const initials = c.initials || (c.candidate_gender === 'Male' ? 'M' : 'F');
  const ms       = normMs(c.marital_status);
  const badgeCls = `mbadge mbadge-${ms}`;
  const badgeTxt = cap(ms);
  const dobLabel = c.dob ? new Date(c.dob + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' }) : '';

  if (detailHeroBody) detailHeroBody.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:24px;flex-wrap:wrap">
      <div class="m-avatar m-avatar--lg">${esc(initials)}</div>
      <div>
        <h1 class="font-display text-3xl font-bold text-white">${esc(initials)} — ${esc(c.candidate_gender || '')}${age ? `, ${age}` : ''}</h1>
        ${c.profession ? `<p class="mt-1 text-archive-paper/80">${esc(c.profession)}</p>` : ''}
        <div class="mt-3 flex items-center gap-3 flex-wrap">
          <span class="${badgeCls}">${badgeTxt}</span>
          ${c.current_location ? `<span class="text-sm text-archive-paper/60">${esc(c.current_location)}</span>` : ''}
        </div>
      </div>
    </div>`;

  // Build main sections
  function detailSec(title, rows) {
    const filtered = rows.filter(([, v]) => v);
    if (!filtered.length) return '';
    return `
      <div style="border-top:1px solid #e6d9b0;padding-top:20px;margin-top:8px">
        <h3 class="text-xs font-black uppercase tracking-[.14em] text-archive-gold mb-3">${title}</h3>
        <dl>${filtered.map(([k, v]) => `<div class="detail-row"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      </div>`;
  }

  if (detailMain) detailMain.innerHTML = `
    <div>
      ${detailSec('Personal', [
        ['Date of birth', dobLabel],
        ['Age', age ? `${age} years` : ''],
        ['Gender', c.candidate_gender],
        ['Marital status', badgeTxt],
      ])}
      ${detailSec('Locations', [
        ['Native place', c.native_location],
        ['Birth place', c.birth_location],
        ['Current place', c.current_location || c.city],
      ])}
      ${detailSec('Education & occupation', [
        ['Education', c.education],
        ['Occupation', c.profession],
      ])}
      ${c.family_background ? `<div style="border-top:1px solid #e6d9b0;padding-top:20px;margin-top:8px"><h3 class="text-xs font-black uppercase tracking-[.14em] text-archive-gold mb-3">Family background</h3><p class="text-sm leading-7 text-archive-muted">${esc(c.family_background)}</p></div>` : ''}
      ${c.expectations ? `<div style="border-top:1px solid #e6d9b0;padding-top:20px;margin-top:8px"><h3 class="text-xs font-black uppercase tracking-[.14em] text-archive-gold mb-3">Expectations</h3><p class="text-sm leading-7 text-archive-muted">${esc(c.expectations)}</p></div>` : ''}
    </div>`;

  const waNum  = (c.phone_whatsapp || '').replace(/\D/g, '');
  const waHref = waNum ? `https://wa.me/${waNum}` : null;

  if (detailSidebar) detailSidebar.innerHTML = `
    <div class="border border-archive-line bg-white p-5 shadow-soft flex flex-col gap-4">
      <p class="text-xs font-black uppercase tracking-[.14em] text-archive-gold">Candidate contact</p>
      ${c.contact_person_name ? `<div class="text-sm"><span class="block text-xs text-archive-muted mb-0.5">Contact person</span><strong>${esc(c.contact_person_name)}</strong></div>` : ''}
      ${c.relationship_to_candidate ? `<div class="text-sm"><span class="block text-xs text-archive-muted mb-0.5">Relationship</span>${esc(c.relationship_to_candidate)}</div>` : ''}
      ${c.phone_whatsapp ? `<div class="text-sm"><span class="block text-xs text-archive-muted mb-0.5">Mobile / WhatsApp</span><span style="font-family:monospace">${maskPhone(c.phone_whatsapp)}</span></div>` : ''}
      ${c.akt_profile_url ? `<div class="text-sm"><span class="block text-xs text-archive-muted mb-0.5">AKT profile</span><a href="${esc(c.akt_profile_url)}" target="_blank" class="text-archive-gold underline underline-offset-2 text-xs break-all">${esc(c.akt_profile_url)}</a></div>` : ''}
      ${waHref ? `<a href="${waHref}" target="_blank" rel="noopener" class="m-btn m-btn-primary" style="justify-content:center;text-decoration:none">Contact on WhatsApp →</a>` : ''}
    </div>`;
}

// ── Utilities ──────────────────────────────────────────────────────────────────
function str(fd, k) { return String(fd.get(k) || '').trim(); }
function esc(v)  { return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function cap(s)  { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function maskPhone(p) {
  const s = String(p);
  return s.length <= 5 ? s : s.slice(0, 3) + '•'.repeat(Math.max(s.length - 6, 2)) + s.slice(-3);
}
// Normalise legacy marital_status values → canonical set used by CSS + filters
function normMs(v) {
  const s = (v || '').toLowerCase().trim();
  if (!s || s === 'never married' || s === 'unmarried' || s === 'single') return 'fresh';
  if (s === 'divorced') return 'divorced';
  if (s === 'widowed')  return 'widowed';
  if (s === 'separated') return 'separated';
  return s || 'fresh';
}

})();
