// A single obituary page. Shows only public details; phone numbers and street
// addresses never reach this page (they are not stored on the website at all).

import { rpc, clientId, esc } from './rpc.js';
import { buildMessage, whatsappLink, todayIst, diffDays, longDate, relationPhrase } from './obituary-message.js';
import { mountEngagement } from './engage.js';
import { getEditToken } from './obituary-form.js';

const main = document.getElementById('obit-main');
const id = new URLSearchParams(location.search).get('id');

function show(msg) { main.innerHTML = `<div class="mx-auto w-[min(760px,calc(100%-36px))] py-16 text-archive-muted">${msg}</div>`; }
function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  const d = Math.floor(s / 86400);
  return d < 30 ? `${d} day${d === 1 ? '' : 's'} ago` : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

(async function () {
  if (!id) { show('No obituary specified. <a class="font-bold text-archive-green underline" href="/obituaries/">See all obituaries</a>'); return; }
  let o;
  try { o = await rpc('get_obituary', { p_id: id }); } catch (err) { show(`${esc(err.message)}`); return; }
  if (!o) { show('This obituary was not found or has been removed. <a class="font-bold text-archive-green underline" href="/obituaries/">See all obituaries</a>'); return; }

  const name = [o.honorific, o.name].filter(Boolean).join(' ');
  document.title = `${name} — Obituaries — Iraqi Biradari`;
  const today = todayIst();

  const rels = (o.relations || []).map(relationPhrase);
  const dPassed = diffDays(o.passed_on, today);
  const passedWord = dPassed === 0 ? 'Today' : dPassed === -1 ? 'Yesterday' : '';
  const leaves = o.leaves_from_kind === 'residence' ? 'the residence'
               : o.leaves_from_kind === 'other' ? (o.leaves_from_other || '') : '';

  const row = (label, value) => value
    ? `<div class="grid gap-1 sm:grid-cols-[170px_1fr] sm:gap-4"><dt class="text-xs font-black uppercase tracking-[0.14em] text-archive-gold sm:pt-0.5">${label}</dt><dd dir="auto" class="text-base leading-7 text-archive-ink">${value}</dd></div>`
    : '';

  const janazaWhen = o.janaza_date
    ? `${longDate(o.janaza_date)}${diffDays(o.janaza_date, today) === 0 ? ' (today)' : diffDays(o.janaza_date, today) === 1 ? ' (tomorrow)' : ''}`
    : '';
  const janazaWhere = [o.janaza_timing, o.janaza_place ? `at ${o.janaza_place}` : ''].filter(Boolean).join(' ');

  const back = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;flex-shrink:0" aria-hidden="true"><path fill-rule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10z" clip-rule="evenodd"/></svg>`;
  const canEdit = !!getEditToken(o.id);

  main.innerHTML = `
    <section class="bg-archive-green py-10 md:py-14 text-archive-cream">
      <div class="mx-auto w-[min(1120px,calc(100%-36px))]">
        <a href="/obituaries/" class="mb-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-archive-goldSoft transition-colors hover:text-white">${back} All obituaries</a>
        <p class="text-left font-display text-2xl text-archive-goldSoft" dir="rtl" lang="ar">إِنَّا لِلَّٰهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ</p>
        <h1 dir="auto" class="mt-3 max-w-4xl font-display text-4xl font-bold leading-tight text-white md:text-5xl">${esc(name)}</h1>
        ${rels.length ? `<p dir="auto" class="mt-3 max-w-3xl text-lg text-archive-paper">${esc(rels.join(' · '))}</p>` : ''}
        <p class="mt-3 text-sm font-bold text-archive-goldSoft">${esc([o.city, o.age ? `Age ${o.age}` : ''].filter(Boolean).join(' · '))}</p>
      </div>
    </section>

    <section class="py-12">
      <div class="mx-auto w-[min(760px,calc(100%-36px))]">
        <dl class="grid gap-5 border border-archive-line bg-white p-6">
          ${row('Passed away', esc(`${passedWord ? `${passedWord}, ` : ''}${longDate(o.passed_on)}`) + (o.city ? ` · ${esc(o.city)}` : ''))}
          ${row('Residence', esc(o.residence_area || ''))}
          ${row('Native place', esc(o.native_place || ''))}
          ${row('Janaza Namaaz', [esc(janazaWhen), esc(janazaWhere)].filter(Boolean).join('<br/>'))}
          ${row('Leaves from', leaves ? esc(`${leaves}${o.leaves_from_time ? ` at ${o.leaves_from_time}` : ''}`) : '')}
          ${row('Burial (Tadfeen)', esc(o.burial_text || ''))}
        </dl>

        ${o.message ? `<p dir="auto" class="mt-6 border-l-4 border-archive-gold pl-5 font-display text-xl italic leading-8 text-archive-muted">${esc(o.message)}</p>` : ''}

        <p class="mt-6 text-sm text-archive-muted">Posted by <strong class="text-archive-ink">${esc(o.posted_by)}</strong>${o.posted_relation ? ` (${esc(o.posted_relation)})` : ''} · ${esc(ago(o.created_at))}</p>

        <div class="mt-6 flex flex-wrap items-center gap-3">
          <a data-share target="_blank" rel="noopener" class="inline-flex items-center border border-archive-green bg-archive-green px-5 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-archive-cream hover:bg-archive-gold hover:text-archive-ink">Share on WhatsApp</a>
          <button type="button" data-copy-link class="border border-archive-green px-5 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-archive-green hover:bg-archive-green hover:text-archive-cream">Copy link</button>
          ${canEdit ? `<a href="${'/obituaries/edit/?id=' + encodeURIComponent(o.id) + '&k=' + encodeURIComponent(getEditToken(o.id))}" class="text-xs font-black uppercase tracking-[0.12em] text-archive-green underline">Edit this obituary</a>` : ''}
          <span data-note class="text-sm font-bold text-archive-green" role="status"></span>
        </div>

        <div data-engage></div>

        <div class="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-archive-line pt-8">
          <a href="/obituaries/" class="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-archive-muted hover:text-archive-green">${back} Back to Obituaries</a>
          <button type="button" data-report class="text-xs font-bold text-archive-muted underline hover:text-archive-green">Report incorrect information</button>
        </div>
      </div>
    </section>`;

  // Share: the public details only (no phone numbers or street address) plus the link.
  const url = location.href;
  main.querySelector('[data-share]').href = whatsappLink(buildMessage('en', o, {}, url));

  const note = main.querySelector('[data-note]');
  main.querySelector('[data-copy-link]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); note.textContent = '✓ Link copied'; } catch { note.textContent = url; }
    setTimeout(() => { note.textContent = ''; }, 3000);
  });
  main.querySelector('[data-report]').addEventListener('click', async (e) => {
    try { await rpc('report_obituary', { p_id: o.id, p_client: clientId() }); } catch { /* best effort */ }
    e.currentTarget.textContent = 'Reported — thank you';
    e.currentTarget.disabled = true;
  });

  mountEngagement(main.querySelector('[data-engage]'), 'obituary', o.id, { mode: 'condolence' });
})();
