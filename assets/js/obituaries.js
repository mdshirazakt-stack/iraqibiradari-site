// Obituaries landing page: newest first, search by name, filter by year.

import { rpc, esc } from './rpc.js';
import { todayIst, diffDays, shortDate, dayMonth } from './obituary-message.js';

// Paste the link of the WhatsApp Channel for obituaries here (leave empty to hide the button).
const CHANNEL_URL = '';

const PAGE = 24;
const listEl   = document.getElementById('obit-list');
const searchEl = document.getElementById('obit-search');
const yearEl   = document.getElementById('obit-year');
const moreEl   = document.getElementById('obit-more');
const countEl  = document.getElementById('obit-count');
const channelEl = document.getElementById('obit-channel');

if (channelEl && CHANNEL_URL) { channelEl.href = CHANNEL_URL; channelEl.style.display = ''; }

let rows = [];
let total = 0;
let q = '';
let year = null;
let yearsLoaded = false;

function whenLabel(passedOn) {
  const d = diffDays(passedOn, todayIst());
  if (d === 0) return 'Today';
  if (d === -1) return 'Yesterday';
  return shortDate(passedOn);
}

function relationLine(o) {
  return (o.relations || []).slice(0, 2)
    .map(r => `${r.rel} of ${r.late ? 'Late ' : ''}${r.name}`).join(' · ');
}

function janazaLine(o) {
  const bits = [];
  if (o.janaza_date) bits.push(dayMonth(o.janaza_date));
  if (o.janaza_timing) bits.push(o.janaza_timing);
  if (o.janaza_place) bits.push(o.janaza_place);
  return bits.join(' · ');
}

function card(o) {
  const rel = relationLine(o);
  const jz  = janazaLine(o);
  const meta = [o.city, o.age ? `Age ${o.age}` : ''].filter(Boolean).join(' · ');
  return `
    <a href="/obituaries/detail/?id=${encodeURIComponent(o.id)}"
       class="group flex flex-col border border-archive-line bg-white p-5 transition-shadow hover:shadow-soft">
      <p class="text-xs font-black uppercase tracking-[0.14em] text-archive-gold">${esc(whenLabel(o.passed_on))}</p>
      <h2 dir="auto" class="mt-2 font-display text-2xl font-bold leading-snug text-archive-green transition-colors group-hover:text-archive-gold">
        ${esc([o.honorific, o.name].filter(Boolean).join(' '))}
      </h2>
      ${rel ? `<p dir="auto" class="mt-1 text-sm text-archive-muted">${esc(rel)}</p>` : ''}
      ${meta ? `<p class="mt-2 text-sm font-bold text-archive-muted">${esc(meta)}</p>` : ''}
      ${jz ? `<p dir="auto" class="mt-3 border-t border-archive-line pt-3 text-sm text-archive-ink"><span class="font-black text-archive-green">Janaza:</span> ${esc(jz)}</p>` : ''}
    </a>`;
}

function render() {
  if (!rows.length) {
    listEl.innerHTML = `<div class="border border-archive-line bg-white p-10 text-center">
      <p class="font-display text-2xl font-bold text-archive-green">${q || year ? 'No obituaries match your search.' : 'No obituaries have been posted yet.'}</p>
      <p class="mt-2 text-sm text-archive-muted"><a class="font-bold text-archive-green underline" href="/obituaries/submit/">Post an obituary</a></p></div>`;
  } else {
    listEl.innerHTML = `<div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">${rows.map(card).join('')}</div>`;
  }
  countEl.textContent = total ? `${total} obituar${total === 1 ? 'y' : 'ies'}` : '';
  moreEl.hidden = rows.length >= total;
}

async function load(reset) {
  if (reset) { rows = []; }
  try {
    const r = await rpc('list_obituaries', { p_search: q || null, p_year: year, p_limit: PAGE, p_offset: rows.length });
    total = r.total;
    rows = rows.concat(r.rows);
    if (!yearsLoaded && r.years?.length) {
      yearEl.innerHTML = '<option value="">All years</option>' + r.years.map(y => `<option value="${y}">${y}</option>`).join('');
      yearEl.hidden = r.years.length < 2;
      yearsLoaded = true;
    }
    render();
  } catch (err) {
    listEl.innerHTML = `<p class="py-8 text-sm text-archive-muted">${esc(err.message)} — <button type="button" onclick="location.reload()" class="font-bold text-archive-green underline">Try again</button></p>`;
  }
}

let timer;
searchEl.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => { q = searchEl.value.trim(); load(true); }, 300);
});
yearEl.addEventListener('change', () => { year = yearEl.value ? Number(yearEl.value) : null; load(true); });
moreEl.addEventListener('click', () => load(false));

load(true);
