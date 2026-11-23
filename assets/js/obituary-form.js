// The "post an obituary" / "edit my obituary" form, and the confirmation screen
// with the ready-to-send WhatsApp message.
//
// Not stored anywhere but the poster's own browser: the residence address and the
// condolence phone numbers. They are used only to build the WhatsApp message.

import { rpc, clientId, esc } from './rpc.js';
import { buildMessage, whatsappLink, todayIst, addDays, weekdayName, isFriday } from './obituary-message.js';

const TOKENS_KEY  = 'ib_obit_tokens';    // { [id]: editToken }   (this device only)
const PRIVATE_KEY = 'ib_obit_private';   // { [id]: {address, contacts} }   (this device only)

function readMap(key) { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; } }
function writeMap(key, map) { try { localStorage.setItem(key, JSON.stringify(map)); } catch { /* private mode */ } }
export function getEditToken(id) { return readMap(TOKENS_KEY)[id] || ''; }
function saveEditToken(id, token) { const m = readMap(TOKENS_KEY); m[id] = token; writeMap(TOKENS_KEY, m); }
function loadPrivate(id) { return readMap(PRIVATE_KEY)[id] || { address: '', contacts: [] }; }
function savePrivate(id, priv) { const m = readMap(PRIVATE_KEY); m[id] = priv; writeMap(PRIVATE_KEY, m); }
function forgetObituary(id) {
  const t = readMap(TOKENS_KEY); delete t[id]; writeMap(TOKENS_KEY, t);
  const p = readMap(PRIVATE_KEY); delete p[id]; writeMap(PRIVATE_KEY, p);
}

const INPUT  = 'w-full border border-archive-line bg-white px-3 py-2 text-sm text-archive-ink focus:border-archive-green focus:outline-none';
const LABEL  = 'grid gap-1.5 text-sm font-bold text-archive-muted';
const HINT   = 'text-xs font-normal text-archive-muted';
const CHIP   = 'border border-archive-line bg-white px-3 py-1.5 text-xs font-bold text-archive-muted hover:border-archive-green hover:text-archive-green';
const PRIMARY = 'bg-archive-green px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-archive-cream hover:bg-archive-gold hover:text-archive-ink disabled:opacity-50';
const SECONDARY = 'border border-archive-green px-5 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-archive-green hover:bg-archive-green hover:text-archive-cream';
const CARD   = 'grid gap-5 border border-archive-line bg-white p-5';
const LEGEND = 'text-xs font-black uppercase tracking-[0.16em] text-archive-gold';
const SUB    = 'text-sm font-bold text-archive-ink';

const TIMING_CHIPS = ['after Fajr Namaaz', 'after Zohar Namaaz', 'after Asr Namaaz', 'after Maghrib Namaaz', 'after Isha Namaaz'];
const BURIAL_CHIPS = ['at the same place', 'in the adjoining Qabristan'];
// Placeholders that show people how to fill the family lines.
const FAMILY_EXAMPLES = [['wife of', 'Late Abdul Qadir'], ['mother of', 'Saif Qadir (Bunty)'], ['sister of', 'Abdul Rashid']];

function relRowHtml(r = {}, i = 0) {
  const [phL, phN] = FAMILY_EXAMPLES[Math.min(i, FAMILY_EXAMPLES.length - 1)];
  // Older records stored a keyword and a "late" flag instead of free text.
  const label = r.label || (r.rel ? `${r.rel} of` : '');
  const name  = r.late && r.name && !/^late\s/i.test(r.name) ? `Late ${r.name}` : (r.name || '');
  return `<div data-rel-row class="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[150px_1fr_auto]">
    <input data-rel-label type="text" maxlength="40" class="${INPUT} col-span-2 sm:col-span-1" placeholder="e.g. ${esc(phL)}" aria-label="Relation (for example ${esc(phL)})" value="${esc(label)}"/>
    <input data-rel-name type="text" maxlength="80" class="${INPUT}" placeholder="e.g. ${esc(phN)}" aria-label="Name" value="${esc(name)}"/>
    <button type="button" data-remove-row class="text-xs font-bold text-archive-muted underline hover:text-archive-green" aria-label="Remove">Remove</button>
  </div>`;
}
function contactRowHtml(c = {}) {
  return `<div data-contact-row class="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
    <input type="text" maxlength="60" class="${INPUT}" placeholder="Name" aria-label="Contact name" value="${esc(c.name || '')}"/>
    <input type="tel" maxlength="20" class="${INPUT}" placeholder="Mobile number" aria-label="Contact mobile number" value="${esc(c.number || '')}"/>
    <button type="button" data-remove-row class="text-xs font-bold text-archive-muted underline hover:text-archive-green" aria-label="Remove">Remove</button>
  </div>`;
}

function formHtml(v, priv, mode) {
  const today = todayIst();
  const rels = (v.relations && v.relations.length) ? v.relations : [{}];
  const contacts = (priv.contacts && priv.contacts.length) ? priv.contacts : [{}];
  const leaves = v.leaves_from_kind || 'none';
  return `
  <form data-obit-form class="grid gap-6" novalidate>
    <fieldset class="${CARD}">
      <legend class="${LEGEND} px-1">About the person</legend>
      <div class="grid gap-4 sm:grid-cols-[140px_1fr]">
        <label class="${LABEL}">Title
          <input name="honorific" list="obit-titles" maxlength="20" class="${INPUT}" placeholder="Haji, Begum, Dr…" value="${esc(v.honorific || '')}"/>
          <datalist id="obit-titles"><option>Haji</option><option>Hafiz</option><option>Maulana</option><option>Dr.</option><option>Begum</option><option>Janab</option><option>Mohtarma</option></datalist>
        </label>
        <label class="${LABEL}">Full name *
          <input name="name" maxlength="80" class="${INPUT}" required value="${esc(v.name || '')}"/>
        </label>
      </div>
      <div class="flex flex-wrap items-center gap-5 text-sm font-bold text-archive-muted">
        <span>Gender *</span>
        <label class="flex items-center gap-2"><input type="radio" name="gender" value="male"${v.gender === 'male' ? ' checked' : ''}/> Male</label>
        <label class="flex items-center gap-2"><input type="radio" name="gender" value="female"${v.gender === 'female' ? ' checked' : ''}/> Female</label>
        <label class="flex items-center gap-2 font-bold">Age <input name="age" type="number" min="0" max="130" class="${INPUT} w-20" value="${esc(v.age ?? '')}"/></label>
      </div>
      <div class="grid gap-2">
        <p class="${SUB}">Family</p>
        <p class="${HINT}">Write it as you would say it. Example: <em>wife of</em> Late Abdul Qadir · <em>mother of</em> Saif Qadir (Bunty). Put “Late” before the name if the person has passed away.</p>
        <div data-rel-rows class="grid gap-2">${rels.map((r, i) => relRowHtml(r, i)).join('')}</div>
        <button type="button" data-add-rel class="${CHIP} justify-self-start">+ Add another</button>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="${LABEL}">City * <span class="${HINT}">(“Demise in …”)</span>
          <input name="city" maxlength="60" class="${INPUT}" required value="${esc(v.city || '')}"/>
        </label>
        <label class="${LABEL}">Area / locality
          <input name="residence_area" maxlength="60" class="${INPUT}" placeholder="e.g. Defence Colony" value="${esc(v.residence_area || '')}"/>
        </label>
        <label class="${LABEL}">Native place <span class="${HINT}">(optional)</span>
          <input name="native_place" maxlength="60" class="${INPUT}" placeholder="e.g. Lar, Rasra" value="${esc(v.native_place || '')}"/>
        </label>
        <label class="${LABEL}">Date of passing *
          <span class="flex items-center gap-3">
            <input name="passed_on" type="date" class="${INPUT}" min="${addDays(today, -30)}" max="${addDays(today, 1)}" required value="${esc(v.passed_on || today)}"/>
            <span data-weekday-passed class="shrink-0 text-xs font-bold text-archive-gold"></span>
          </span>
        </label>
      </div>
    </fieldset>

    <fieldset class="${CARD}">
      <legend class="${LEGEND} px-1">Janaza and burial</legend>

      <div class="grid gap-2">
        <p class="${SUB}">Janaza leaves from</p>
        <div class="flex flex-wrap items-center gap-5 text-sm font-bold text-archive-muted">
          <label class="flex items-center gap-2"><input type="radio" name="leaves_kind" value="none"${leaves === 'none' ? ' checked' : ''}/> Not mentioned</label>
          <label class="flex items-center gap-2"><input type="radio" name="leaves_kind" value="residence"${leaves === 'residence' ? ' checked' : ''}/> The residence</label>
          <label class="flex items-center gap-2"><input type="radio" name="leaves_kind" value="other"${leaves === 'other' ? ' checked' : ''}/> Somewhere else</label>
        </div>
        <div data-leaves-details class="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <input name="address" data-leaves-address maxlength="200" class="${INPUT}" placeholder="Residence address, e.g. 488-D Defence Colony" aria-label="Residence address" value="${esc(priv.address || '')}"/>
          <input name="leaves_other" data-leaves-other maxlength="120" class="${INPUT}" placeholder="Where, e.g. the hospital" aria-label="Where the janaza leaves from" value="${esc(v.leaves_from_other || '')}"/>
          <input name="leaves_time" maxlength="40" class="${INPUT}" placeholder="Time, e.g. 12:30 PM" aria-label="Time the janaza leaves" value="${esc(v.leaves_from_time || '')}"/>
        </div>
      </div>

      <label class="${LABEL}">Janaza Namaaz place
        <input name="janaza_place" maxlength="120" class="${INPUT}" placeholder="e.g. Sola Aana Masjid" value="${esc(v.janaza_place || '')}"/>
      </label>

      <div class="grid gap-3">
        <p class="${SUB}">Janaza Namaaz time</p>
        <div class="flex flex-wrap items-center gap-3">
          <input name="janaza_date" type="date" class="${INPUT} w-auto" aria-label="Janaza date" value="${esc(v.janaza_date || '')}"/>
          <span data-weekday-janaza class="text-xs font-bold text-archive-gold"></span>
          <button type="button" data-date-quick="0" class="${CHIP}">Today</button>
          <button type="button" data-date-quick="1" class="${CHIP}">Tomorrow</button>
        </div>
        <input name="janaza_timing" maxlength="120" class="${INPUT}" placeholder="e.g. after Zohar Namaaz (Jamaat time 1:30 PM)" aria-label="Janaza Namaaz timing" value="${esc(v.janaza_timing || '')}"/>
        <span data-timing-chips class="flex flex-wrap gap-2"></span>
      </div>

      <label class="${LABEL}">Burial (Tadfeen) location
        <input name="burial_text" maxlength="120" class="${INPUT}" placeholder="e.g. in the adjoining Qabristan" value="${esc(v.burial_text || '')}"/>
        <span class="flex flex-wrap gap-2 pt-1">${BURIAL_CHIPS.map(c => `<button type="button" data-burial-chip="${esc(c)}" class="${CHIP}">${c}</button>`).join('')}</span>
      </label>

      <label class="${LABEL}">Dua or message <span class="${HINT}">(optional)</span>
        <textarea name="message" rows="2" maxlength="500" class="${INPUT}">${esc(v.message || '')}</textarea>
      </label>
    </fieldset>

    <fieldset class="${CARD}">
      <legend class="${LEGEND} px-1">For condolence</legend>
      <div data-contact-rows class="grid gap-2">${contacts.map(contactRowHtml).join('')}</div>
      <button type="button" data-add-contact class="${CHIP} justify-self-start">+ Add another number</button>
    </fieldset>

    <fieldset class="${CARD}">
      <legend class="${LEGEND} px-1">Who is posting this</legend>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="${LABEL}">Your name *
          <input name="poster_name" maxlength="60" class="${INPUT}" required autocomplete="name" value="${esc(v.poster_name || '')}"/>
        </label>
        <label class="${LABEL}">Your relationship <span class="${HINT}">(e.g. son, neighbour)</span>
          <input name="poster_relation" maxlength="40" class="${INPUT}" value="${esc(v.poster_relation || '')}"/>
        </label>
        <label class="${LABEL}">Your mobile number *
          <input name="poster_mobile" type="tel" maxlength="20" class="${INPUT}" required autocomplete="tel" value="${esc(v.poster_mobile || '')}"/>
        </label>
      </div>
    </fieldset>

    <p class="text-xs leading-6 text-archive-muted">Please post only a genuine, confirmed death. False or misleading posts will be removed.</p>
    <p data-form-msg class="text-sm font-bold text-red-700" role="alert"></p>
    <div class="flex flex-wrap items-center gap-4">
      <button type="submit" class="${PRIMARY}">${mode === 'edit' ? 'Save changes' : 'Publish obituary'}</button>
      ${mode === 'edit' ? `<button type="button" data-delete class="text-sm font-bold text-red-700 underline">Delete this obituary</button>` : ''}
    </div>
  </form>`;
}

function collect(root) {
  const f = root.querySelector('[data-obit-form]');
  const val = (n) => (f.elements[n]?.value ?? '').trim();
  const relations = [...root.querySelectorAll('[data-rel-row]')].map(r => ({
    label: r.querySelector('[data-rel-label]').value.trim(),
    name: r.querySelector('[data-rel-name]').value.trim(),
  })).filter(r => r.label || r.name);
  const contacts = [...root.querySelectorAll('[data-contact-row]')].map(r => {
    const [n, num] = r.querySelectorAll('input');
    return { name: n.value.trim(), number: num.value.trim() };
  }).filter(c => c.name || c.number);
  const kind = f.elements.leaves_kind.value;
  const pub = {
    honorific: val('honorific'), name: val('name'), gender: f.elements.gender.value || '',
    relations, city: val('city'), residence_area: val('residence_area'), native_place: val('native_place'),
    age: val('age'), passed_on: val('passed_on'), janaza_date: val('janaza_date'),
    janaza_place: val('janaza_place'), janaza_timing: val('janaza_timing'),
    leaves_from_kind: kind === 'none' ? '' : kind,
    leaves_from_other: kind === 'other' ? val('leaves_other') : '',
    leaves_from_time: kind === 'none' ? '' : val('leaves_time'),
    burial_text: val('burial_text'), message: val('message'),
    // Only the NAMES are sent to the website's database (so they can be searched); numbers stay on this device.
    condolence_names: contacts.map(c => c.name).filter(Boolean),
    poster_name: val('poster_name'), poster_relation: val('poster_relation'), poster_mobile: val('poster_mobile'),
  };
  return { pub, priv: { address: kind === 'residence' ? val('address') : '', contacts } };
}

function clientCheck(pub) {
  if (!pub.name) return 'Please enter the name.';
  if (!pub.gender) return 'Please choose male or female.';
  if (pub.relations.some(r => !r.label || !r.name)) return 'Please fill both parts of each family line (for example “wife of” and the name), or clear the line.';
  if (!pub.city) return 'Please enter the city.';
  if (!pub.passed_on) return 'Please enter the date of passing.';
  if (!pub.poster_name) return 'Please enter your name.';
  if (pub.poster_mobile.replace(/[^0-9]/g, '').length < 8) return 'Please enter your mobile number.';
  return '';
}

function wireForm(root) {
  const f = root.querySelector('[data-obit-form]');

  const refreshDates = () => {
    const p = f.elements.passed_on.value, j = f.elements.janaza_date.value;
    root.querySelector('[data-weekday-passed]').textContent = p ? weekdayName(p) : '';
    root.querySelector('[data-weekday-janaza]').textContent = j ? weekdayName(j) : '';
    // "after Jumma Namaaz" only makes sense on a Friday.
    const chips = [...TIMING_CHIPS];
    if (isFriday(j)) chips.unshift('after Jumma Namaaz');
    root.querySelector('[data-timing-chips]').innerHTML =
      chips.map(c => `<button type="button" data-timing-chip="${esc(c)}" class="${CHIP}">${c.replace('after ', 'After ')}</button>`).join('');
  };
  const refreshLeaves = () => {
    const k = f.elements.leaves_kind.value;
    root.querySelector('[data-leaves-details]').style.display = k === 'none' ? 'none' : '';
    root.querySelector('[data-leaves-address]').style.display = k === 'residence' ? '' : 'none';
    root.querySelector('[data-leaves-other]').style.display = k === 'other' ? '' : 'none';
  };
  refreshDates(); refreshLeaves();

  f.addEventListener('input', (e) => { if (e.target.type === 'date') refreshDates(); });
  f.addEventListener('change', (e) => { if (e.target.name === 'leaves_kind') refreshLeaves(); });

  root.addEventListener('click', (e) => {
    const t = e.target;
    if (t.matches('[data-add-rel]')) {
      const n = root.querySelectorAll('[data-rel-row]').length;
      if (n < 8) root.querySelector('[data-rel-rows]').insertAdjacentHTML('beforeend', relRowHtml({}, n));
    } else if (t.matches('[data-add-contact]')) {
      if (root.querySelectorAll('[data-contact-row]').length < 5) root.querySelector('[data-contact-rows]').insertAdjacentHTML('beforeend', contactRowHtml());
    } else if (t.matches('[data-remove-row]')) {
      const row = t.closest('[data-rel-row],[data-contact-row]');
      const sel = row.matches('[data-rel-row]') ? '[data-rel-row]' : '[data-contact-row]';
      if (root.querySelectorAll(sel).length > 1) row.remove();
      else row.querySelectorAll('input').forEach(i => { i.value = ''; });
    } else if (t.matches('[data-date-quick]')) {
      f.elements.janaza_date.value = addDays(todayIst(), Number(t.dataset.dateQuick));
      refreshDates();
    } else if (t.matches('[data-timing-chip]')) {
      f.elements.janaza_timing.value = t.dataset.timingChip;
    } else if (t.matches('[data-burial-chip]')) {
      f.elements.burial_text.value = t.dataset.burialChip;
    }
  });
}

// ── Confirmation: the live link + the WhatsApp message ───────────────────
function successHtml(id, token, isEdit) {
  const base = location.origin;
  const page = `${base}/obituaries/detail/?id=${encodeURIComponent(id)}`;
  const edit = `${base}/obituaries/edit/?id=${encodeURIComponent(id)}&k=${encodeURIComponent(token)}`;
  return `
  <div class="grid gap-6">
    <div class="border-l-4 border-archive-green bg-white p-5">
      <p class="font-display text-2xl font-bold text-archive-green">${isEdit ? 'Changes saved.' : 'The obituary is now live.'}</p>
      <p class="mt-2 text-sm leading-6 text-archive-muted"><a class="font-bold text-archive-green underline" href="${esc(page)}">View the obituary page →</a></p>
    </div>

    <section class="${CARD}" data-wa-panel>
      <p class="${LEGEND}">Send it to the community on WhatsApp</p>
      <div class="flex flex-wrap items-center gap-3 text-sm font-bold text-archive-muted">
        <span>Message style</span>
        <button type="button" data-style="ru" class="${CHIP}">Roman Urdu</button>
        <button type="button" data-style="en" class="${CHIP}">English</button>
      </div>
      <textarea data-wa-text rows="14" class="${INPUT} font-mono leading-6" aria-label="WhatsApp message"></textarea>
      <p class="text-xs leading-5 text-archive-muted">You can edit the message above before sending. Delete the last line if you do not want to include the link.</p>
      <div class="flex flex-wrap gap-3">
        <button type="button" data-copy-msg class="${PRIMARY}">Copy message</button>
        <a data-send-wa target="_blank" rel="noopener" class="${SECONDARY} inline-flex items-center">Send on WhatsApp</a>
      </div>
      <p data-copy-note class="text-sm font-bold text-archive-green" role="status"></p>
    </section>

    ${isEdit ? '' : `
    <section class="${CARD}">
      <p class="${LEGEND}">Your private edit link</p>
      <p class="text-sm leading-6 text-archive-muted">Use this link to correct the details (for example if the janaza time changes) or to delete the obituary. <strong>Keep it private</strong> — anyone with the link can edit. It is also remembered on this device.</p>
      <input readonly value="${esc(edit)}" class="${INPUT} text-xs" aria-label="Edit link" onfocus="this.select()"/>
      <div><button type="button" data-copy-edit="${esc(edit)}" class="${SECONDARY}">Copy edit link</button></div>
    </section>`}
  </div>`;
}

function wireSuccess(root, id, pub, priv) {
  const url = `${location.origin}/obituaries/detail/?id=${encodeURIComponent(id)}`;
  const ta = root.querySelector('[data-wa-text]');
  const send = root.querySelector('[data-send-wa]');
  const note = root.querySelector('[data-copy-note]');
  const chips = [...root.querySelectorAll('[data-style]')];
  let style = 'ru';   // Roman Urdu is the default message style

  const build = () => {
    ta.value = buildMessage(style, pub, priv, url);
    send.href = whatsappLink(ta.value);
    chips.forEach(c => { c.style.cssText = c.dataset.style === style ? 'background:#173f31;color:#fbf7ed;border-color:#173f31' : ''; });
  };
  build();
  chips.forEach(c => c.addEventListener('click', () => { style = c.dataset.style; build(); }));
  ta.addEventListener('input', () => { send.href = whatsappLink(ta.value); });

  const copy = async (text, el, msg) => {
    try { await navigator.clipboard.writeText(text); }
    catch { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    el.textContent = msg; setTimeout(() => { el.textContent = ''; }, 3000);
  };
  root.querySelector('[data-copy-msg]').addEventListener('click', () => copy(ta.value, note, '✓ Message copied — paste it into WhatsApp.'));
  root.querySelector('[data-copy-edit]')?.addEventListener('click', (e) =>
    copy(e.currentTarget.dataset.copyEdit, note, '✓ Edit link copied. Keep it private.'));
}

/**
 * Mounts the form.
 * mode 'create': blank form.   mode 'edit': loads the obituary using {id, token}.
 */
export async function mountObituaryForm(root, { mode = 'create', id = '', token = '' } = {}) {
  let initial = {};
  let priv = { address: '', contacts: [] };

  if (mode === 'edit') {
    try { initial = await rpc('get_obituary_for_edit', { p_id: id, p_token: token }); } catch { initial = null; }
    if (!initial) {
      root.innerHTML = `<div class="${CARD}"><p class="font-display text-2xl font-bold text-archive-green">This edit link is not valid.</p>
        <p class="text-sm text-archive-muted">The obituary may have been removed, or the link is incomplete. Use the full link you were given when you posted it.</p></div>`;
      return;
    }
    priv = loadPrivate(id);
    // Names come from the server; numbers (if this device has them) from local storage.
    const names = initial.condolence_names || [];
    if (names.length) {
      const numbers = new Map((priv.contacts || []).map(c => [String(c.name || '').toLowerCase(), c.number]));
      priv = { ...priv, contacts: names.map(n => ({ name: n, number: numbers.get(n.toLowerCase()) || '' })) };
    }
  }

  root.innerHTML = formHtml(initial, priv, mode);
  wireForm(root);

  const f = root.querySelector('[data-obit-form]');
  const msg = root.querySelector('[data-form-msg]');
  const submitBtn = f.querySelector('button[type="submit"]');

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    const { pub, priv: p } = collect(root);
    const problem = clientCheck(pub);
    if (problem) { msg.textContent = problem; msg.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    submitBtn.disabled = true;
    const label = submitBtn.textContent;
    submitBtn.textContent = mode === 'edit' ? 'Saving…' : 'Publishing…';
    try {
      let useId = id, useToken = token;
      if (mode === 'edit') {
        await rpc('update_obituary', { p_id: id, p_token: token, p_data: pub });
      } else {
        const r = await rpc('create_obituary', { p_data: pub, p_client: clientId() });
        useId = r.id; useToken = r.edit_token;
        saveEditToken(useId, useToken);
      }
      savePrivate(useId, p);
      root.innerHTML = successHtml(useId, useToken, mode === 'edit');
      wireSuccess(root, useId, pub, p);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      msg.textContent = err.message;
      msg.scrollIntoView({ block: 'center', behavior: 'smooth' });
      submitBtn.disabled = false;
      submitBtn.textContent = label;
    }
  });

  root.querySelector('[data-delete]')?.addEventListener('click', async () => {
    if (!confirm('Delete this obituary permanently? This cannot be undone.')) return;
    try {
      await rpc('delete_obituary', { p_id: id, p_token: token });
      forgetObituary(id);
      root.innerHTML = `<div class="${CARD}"><p class="font-display text-2xl font-bold text-archive-green">The obituary has been deleted.</p>
        <p class="text-sm"><a class="font-bold text-archive-green underline" href="/obituaries/">Back to Obituaries</a></p></div>`;
    } catch (err) { msg.textContent = err.message; }
  });
}
