// Obituaries landing page: a searchable table, newest first.
// One search box matches name, family, city, area, native place, janaza/burial
// places, condolence contacts and the date (as a date, a month name or a year).

import { rpc, esc } from './rpc.js';
import { dayMonth, shortDate, relationPhrase, parseYmd } from './obituary-message.js';

// Paste the link of the WhatsApp Channel for obituaries here (leave empty to hide the button).
const CHANNEL_URL = '';

const PAGE = 30;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const listEl    = document.getElementById('obit-list');
const searchEl  = document.getElementById('obit-search');
const yearEl    = document.getElementById('obit-year');
const monthEl   = document.getElementById('obit-month');
const moreEl    = document.getElementById('obit-more');
const countEl   = document.getElementById('obit-count');
const channelEl = document.getElementById('obit-channel');

if (channelEl && CHANNEL_URL) { channelEl.href = CHANNEL_URL; channelEl.style.display = ''; }
monthEl.innerHTML = '<option value="">All months</option>' + MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');

let rows = [];
let total = 0;
let q = '';
let year = null;
let month = null;
let yearsLoaded = false;

const cell = 'px-4 py-3 align-top';

function dateCell(o) {
  const d = parseYmd(o.passed_on);
  return `<span class="font-bold text-archive-ink">${esc(dayMonth(o.passed_on))}</span><br/><span class="text-archive-muted">${d.getUTCFullYear()}</span>`;
}

function row(o) {
  const href = `/obituaries/detail/?id=${encodeURIComponent(o.id)}`;
  const name = [o.honorific, o.name].filter(Boolean).join(' ');
  const family = (o.relations || []).map(relationPhrase).map(esc).join('<br/>');
  const place = [o.city, o.residence_area].filter(Boolean).map(esc).join(' · ')
    + (o.native_place ? `<br/><span class="text-archive-muted">Native: ${esc(o.native_place)}</span>` : '');
  const janaza = [
    o.janaza_date ? `<span class="font-bold text-archive-ink">${esc(dayMonth(o.janaza_date))}</span>` : '',
    o.janaza_timing ? esc(o.janaza_timing) : '',
    o.janaza_place ? esc(o.janaza_place) : '',
  ].filter(Boolean).join('<br/>');
  return `
    <tr data-href="${href}" class="cursor-pointer text-archive-ink transition-colors hover:bg-archive-cream">
      <td class="${cell} whitespace-nowrap">${dateCell(o)}</td>
      <td class="${cell}">
        <a href="${href}" dir="auto" class="font-display text-lg font-bold text-archive-green hover:text-archive-gold">${esc(name)}</a>
        ${o.age ? `<br/><span class="text-xs text-archive-muted">Age ${o.age}</span>` : ''}
      </td>
      <td dir="auto" class="${cell}">${family || '<span class="text-archive-muted">—</span>'}</td>
      <td dir="auto" class="${cell}">${place}</td>
      <td dir="auto" class="${cell}">${janaza || '<span class="text-archive-muted">—</span>'}</td>
      <td dir="auto" class="${cell}">${esc(o.burial_text || '') || '<span class="text-archive-muted">—</span>'}</td>
      <td dir="auto" class="${cell}">${esc((o.condolence_names || []).join(', ')) || '<span class="text-archive-muted">—</span>'}</td>
    </tr>`;
}

function render() {
  if (!rows.length) {
    listEl.innerHTML = `<div class="border border-archive-line bg-white p-10 text-center">
      <p class="font-display text-2xl font-bold text-archive-green">${q || year || month ? 'No obituaries match your search.' : 'No obituaries have been posted yet.'}</p>
      <p class="mt-2 text-sm text-archive-muted"><a class="font-bold text-archive-green underline" href="/obituaries/submit/">Post an obituary</a></p></div>`;
  } else {
    listEl.innerHTML = `
      <div class="overflow-x-auto border border-archive-line bg-white">
        <table class="w-full min-w-[1160px] border-collapse text-left text-sm">
          <thead class="bg-archive-paper text-xs font-black uppercase tracking-[0.12em] text-archive-muted">
            <tr>
              <th class="min-w-[90px] px-4 py-3">Passed away</th><th class="min-w-[190px] px-4 py-3">Name</th><th class="min-w-[200px] px-4 py-3">Family</th>
              <th class="min-w-[170px] px-4 py-3">City / place</th><th class="min-w-[190px] px-4 py-3">Janaza</th>
              <th class="min-w-[150px] px-4 py-3">Tadfeen</th><th class="min-w-[170px] px-4 py-3">For condolence</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-archive-line">${rows.map(row).join('')}</tbody>
        </table>
      </div>`;
  }
  const filtered = q || year || month;
  countEl.textContent = total ? `${total} ${filtered ? (total === 1 ? 'result' : 'results') : (total === 1 ? 'obituary' : 'obituaries')}` : '';
  moreEl.hidden = rows.length >= total;
}

async function load(reset) {
  if (reset) rows = [];
  try {
    const r = await rpc('list_obituaries', { p_search: q || null, p_year: year, p_month: month, p_limit: PAGE, p_offset: rows.length });
    total = r.total;
    rows = rows.concat(r.rows);
    if (!yearsLoaded && r.years?.length) {
      yearEl.innerHTML = '<option value="">All years</option>' + r.years.map(y => `<option value="${y}">${y}</option>`).join('');
      yearsLoaded = true;
    }
    render();
  } catch (err) {
    listEl.innerHTML = `<p class="py-8 text-sm text-archive-muted">${esc(err.message)} — <button type="button" onclick="location.reload()" class="font-bold text-archive-green underline">Try again</button></p>`;
  }
}

// Whole row is clickable (the name is a real link for keyboard and screen-reader users).
listEl.addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  const tr = e.target.closest('tr[data-href]');
  if (tr) location.href = tr.dataset.href;
});

let timer;
searchEl.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => { q = searchEl.value.trim(); load(true); }, 300);
});
yearEl.addEventListener('change', () => { year = yearEl.value ? Number(yearEl.value) : null; load(true); });
monthEl.addEventListener('change', () => { month = monthEl.value ? Number(monthEl.value) : null; load(true); });
moreEl.addEventListener('click', () => load(false));

load(true);
