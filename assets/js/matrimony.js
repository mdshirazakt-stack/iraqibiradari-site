import { createSupabaseClient, withTimeout } from './supabase-config.js';

(async function () {

// ── DOM refs ───────────────────────────────────────────────────────────────────
const stages = {};
document.querySelectorAll('[data-stage]').forEach(el => { stages[el.dataset.stage] = el; });

const authBar        = document.getElementById('auth-bar');
const authEmailDisp  = document.getElementById('auth-email-display');
const btnSignout     = document.getElementById('btn-signout');

// auth
const emailStep      = document.getElementById('auth-email-step');
const otpStep        = document.getElementById('auth-otp-step');
const formEmail      = document.getElementById('form-email');
const formOtp        = document.getElementById('form-otp');
const inputEmail     = document.getElementById('input-email');
const inputOtp       = document.getElementById('input-otp');
const otpEmailLabel  = document.getElementById('otp-email-label');
const btnResend      = document.getElementById('btn-resend');
const errEmail       = document.getElementById('err-email');
const errOtp         = document.getElementById('err-otp');

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
let subs = { candidate: null, requirement: null };
let browseData = [], browseFilter = 'all';
let pendingEmail = '';

// ── Bootstrap ──────────────────────────────────────────────────────────────────
supabase = await createSupabaseClient();

// data-go routing (event delegation)
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-go]');
  if (!btn) return;
  const dest = btn.dataset.go;
  if (dest === 'landing') { showStage('landing'); return; }
  if (dest === 'auth')    { prepAuth(); showStage('auth'); return; }
  if (dest === 'gate')    { renderGate(); return; }
  if (dest === 'browse')  { openBrowse(); return; }
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

// ── Auth bar ───────────────────────────────────────────────────────────────────
function showAuthBar(user) {
  if (authBar)       authBar.classList.add('visible');
  if (authEmailDisp) authEmailDisp.textContent = user.email;
}
function hideAuthBar() {
  if (authBar)       authBar.classList.remove('visible');
  if (authEmailDisp) authEmailDisp.textContent = '';
}
btnSignout?.addEventListener('click', async () => { await supabase.auth.signOut(); });

// ── Auth — email OTP ───────────────────────────────────────────────────────────
function prepAuth() {
  emailStep?.classList.remove('hidden');
  otpStep?.classList.add('hidden');
  if (inputEmail) inputEmail.value = '';
  if (inputOtp)   inputOtp.value   = '';
  errEmail?.classList.add('hidden');
  errOtp?.classList.add('hidden');
}

formEmail?.addEventListener('submit', async e => {
  e.preventDefault();
  const email  = (inputEmail?.value || '').trim();
  const btn    = formEmail.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Sending…';
  errEmail?.classList.add('hidden');

  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });

  btn.disabled = false; btn.textContent = 'Send sign-in code →';
  if (error) { if (errEmail) { errEmail.textContent = error.message; errEmail.classList.remove('hidden'); } return; }

  pendingEmail = email;
  if (otpEmailLabel) otpEmailLabel.textContent = email;
  emailStep?.classList.add('hidden');
  otpStep?.classList.remove('hidden');
  inputOtp?.focus();
});

formOtp?.addEventListener('submit', async e => {
  e.preventDefault();
  const token  = (inputOtp?.value || '').trim();
  const btn    = formOtp.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Verifying…';
  errOtp?.classList.add('hidden');

  const { error } = await supabase.auth.verifyOtp({ email: pendingEmail, token, type: 'email' });

  btn.disabled = false; btn.textContent = 'Verify code →';
  if (error) { if (errOtp) { errOtp.textContent = error.message; errOtp.classList.remove('hidden'); } }
  // onAuthStateChange fires on success → calls afterSignIn
});

btnResend?.addEventListener('click', async () => {
  if (!pendingEmail) return;
  btnResend.textContent = 'Sending…';
  await supabase.auth.signInWithOtp({ email: pendingEmail });
  btnResend.textContent = 'Code resent ✓';
  setTimeout(() => { if (btnResend) btnResend.textContent = 'Resend code'; }, 3000);
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
async function loadSubs() {
  const [pRes, rRes] = await Promise.all([
    supabase.from('matrimony_profiles').select('id,candidate_name').eq('user_id', currentUser.id).maybeSingle(),
    supabase.from('matrimony_requirements').select('id,seeker_name').eq('user_id', currentUser.id).maybeSingle(),
  ]);
  subs.candidate   = pRes.data  || null;
  subs.requirement = rRes.data  || null;
}

// ── Gate render ────────────────────────────────────────────────────────────────
async function renderGate() {
  await loadSubs();

  const first = memberRecord?.full_name?.split(' ')[0] || '';
  if (gateFirstname) gateFirstname.textContent = first ? `, ${first}` : '';

  const candDone = Boolean(subs.candidate);
  const reqDone  = Boolean(subs.requirement);
  const both     = candDone && reqDone;

  // Card states
  gateCardCand?.classList.toggle('done', candDone);
  gateCardReq?.classList.toggle('done', reqDone);

  const doneClass   = 'text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full';
  const pendingClass= 'text-xs font-bold text-archive-muted border border-archive-line px-2 py-0.5 rounded-full';

  if (gateStatusCand) { gateStatusCand.textContent = candDone ? '✓ Submitted' : 'Pending'; gateStatusCand.className = candDone ? doneClass : pendingClass; }
  if (gateStatusReq)  { gateStatusReq.textContent  = reqDone  ? '✓ Submitted' : 'Pending'; gateStatusReq.className  = reqDone  ? doneClass : pendingClass; }
  if (gateCtaCand) gateCtaCand.textContent = candDone ? 'Edit submission →' : 'Begin →';
  if (gateCtaReq)  gateCtaReq.textContent  = reqDone  ? 'Edit submission →' : 'Begin →';

  // Unlock bar
  gateUnlock?.classList.toggle('ready', both);
  if (gateUnlockIcon) gateUnlockIcon.innerHTML = both
    ? `<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="#1f3a2a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l5 5L21 7"/></svg>`
    : `<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="#6b5a3f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="12" width="14" height="10" rx="2"/><path d="M9 12V9a4 4 0 1 1 8 0v3"/></svg>`;
  if (gateUnlockH)   gateUnlockH.textContent   = both ? 'Listings unlocked'  : 'Listings are locked';
  if (gateUnlockSub) gateUnlockSub.textContent  = both
    ? 'You can now browse matches, filter by marital status, and request introductions.'
    : 'Complete both submissions above to unlock the matrimony directory.';
  if (btnBrowse) {
    btnBrowse.disabled   = !both;
    btnBrowse.textContent= both ? 'Browse matches →' : 'Locked';
    btnBrowse.style.opacity = both ? '1' : '0.4';
    btnBrowse.style.cursor  = both ? 'pointer' : 'not-allowed';
    btnBrowse.onclick = both ? () => openBrowse() : null;
  }

  // Wire gate card clicks
  if (gateCardCand) gateCardCand.onclick = () => showStage('candidate');
  if (gateCardReq)  gateCardReq.onclick  = () => showStage('requirement');

  showStage('gate');
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

  const { error } = await supabase.from('matrimony_profiles').upsert(payload, { onConflict: 'user_id' });

  btn.disabled = false; btn.textContent = 'Submit candidate details →';
  if (error) { if (candErr) { candErr.textContent = error.message; candErr.classList.remove('hidden'); } return; }

  if (candOk) { candOk.textContent = 'Candidate profile submitted — returning to dashboard…'; candOk.classList.remove('hidden'); }
  subs.candidate = { id: 'new', candidate_name: payload.candidate_name };
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

  const { error } = await supabase.from('matrimony_requirements').upsert(payload, { onConflict: 'user_id' });

  btn.disabled = false; btn.textContent = 'Submit match requirement →';
  if (error) { if (reqErr) { reqErr.textContent = error.message; reqErr.classList.remove('hidden'); } return; }

  if (reqOk) { reqOk.textContent = 'Match requirement submitted — returning to dashboard…'; reqOk.classList.remove('hidden'); }
  subs.requirement = { id: 'new', seeker_name: payload.seeker_name };
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
        .eq('published', true)
        .order('created_at', { ascending: false })
    );

    if (error) {
      if (browseGrid) browseGrid.innerHTML = `<div class="bg-archive-paper p-12 text-center text-sm text-red-700" style="grid-column:1/-1">${esc(error.message)}</div>`;
      return;
    }

    browseData = (data || []).map(p => ({
      ...p,
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
    .eq('published', true)
    .single();

  if (error || !c) {
    if (detailHeroBody) detailHeroBody.innerHTML = `<p class="text-archive-paper">Profile not found.</p>`;
    return;
  }

  const age      = c.dob ? Math.floor((Date.now() - new Date(c.dob).getTime()) / (365.25 * 86400000)) : null;
  const initials = c.initials || (c.candidate_gender === 'Male' ? 'M' : 'F');
  const badgeCls = `mbadge mbadge-${c.marital_status || 'fresh'}`;
  const badgeTxt = cap(c.marital_status || 'fresh');
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

  const mailto = `mailto:mdshiraz.ib@outlook.com?subject=${encodeURIComponent(`Matrimony introduction request – ${initials}`)}`;

  if (detailSidebar) detailSidebar.innerHTML = `
    <div class="border border-archive-line bg-white p-5 shadow-soft flex flex-col gap-4">
      <p class="text-xs font-black uppercase tracking-[.14em] text-archive-gold">Candidate contact</p>
      ${c.contact_person_name ? `<div class="text-sm"><span class="block text-xs text-archive-muted mb-0.5">Contact person</span><strong>${esc(c.contact_person_name)}</strong></div>` : ''}
      ${c.relationship_to_candidate ? `<div class="text-sm"><span class="block text-xs text-archive-muted mb-0.5">Relationship</span>${esc(c.relationship_to_candidate)}</div>` : ''}
      ${c.phone_whatsapp ? `<div class="text-sm"><span class="block text-xs text-archive-muted mb-0.5">Mobile</span><span style="font-family:monospace">${maskPhone(c.phone_whatsapp)}</span> <span class="text-xs text-archive-muted">· Full number after admin introduction</span></div>` : ''}
      ${c.akt_profile_url ? `<div class="text-sm"><span class="block text-xs text-archive-muted mb-0.5">AKT profile</span><a href="${esc(c.akt_profile_url)}" target="_blank" class="text-archive-gold underline underline-offset-2 text-xs break-all">${esc(c.akt_profile_url)}</a></div>` : ''}
      <hr class="border-archive-line"/>
      <p class="text-xs text-archive-muted leading-5">To request an introduction, contact the Iraqi Biradari coordination team. Full contact details are shared only after a formal admin-mediated introduction.</p>
      <a href="${mailto}" class="m-btn m-btn-primary" style="justify-content:center;text-decoration:none">Request introduction →</a>
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

})();
