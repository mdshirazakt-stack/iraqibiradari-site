import { createSupabaseClient, withTimeout } from './supabase-config.js';

(async function () {
  const id         = new URLSearchParams(location.search).get('id');
  const main       = document.getElementById('event-main');
  const loadingEl  = document.getElementById('event-loading');

  function showError(msg) {
    if (loadingEl) loadingEl.innerHTML = `<p class="text-archive-muted">${msg}</p>`;
  }

  if (!id) { showError('No event specified.'); return; }

  let supabase;
  try {
    supabase = await createSupabaseClient();
  } catch (err) {
    showError('Could not connect to database. Please try again.');
    return;
  }

  let ev, error;
  try {
    ({ data: ev, error } = await withTimeout(
      supabase.from('events').select('*').eq('id', id).eq('published', true).single()
    ));
  } catch (err) {
    showError(`${err.message} — <button type="button" onclick="location.reload()" style="font-weight:700;text-decoration:underline">Try again</button>`);
    return;
  }

  if (error || !ev) { showError('Event not found or has been unpublished.'); return; }

  // ── Update meta ───────────────────────────────────────────────────────
  document.title = `${ev.title} — Iraqi Biradari`;

  // ── Derived values ────────────────────────────────────────────────────
  const isWebinar  = ev.event_type === 'webinar';
  const typeLabel  = isWebinar ? 'Online / Webinar' : 'In-person';
  const typeCls    = isWebinar ? 'bg-archive-goldSoft text-archive-ink' : 'bg-archive-green text-archive-cream';
  const dateStr    = ev.event_date ? formatDate(ev.event_date) : null;
  const backArrow  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;flex-shrink:0" aria-hidden="true"><path fill-rule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10z" clip-rule="evenodd"/></svg>`;

  // ── Build page ────────────────────────────────────────────────────────
  main.innerHTML = `

    <!-- Hero -->
    <section class="bg-archive-green py-10 md:py-14 text-archive-cream">
      <div class="mx-auto w-[min(1120px,calc(100%-36px))]">

        <a href="/events/" class="mb-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-archive-goldSoft transition-colors hover:text-white">
          ${backArrow} All events
        </a>

        <div class="mb-4 flex flex-wrap items-center gap-3">
          <span class="inline-block px-3 py-1 text-xs font-black uppercase tracking-wide ${typeCls}">${typeLabel}</span>
          ${ev.category ? `<span class="text-xs font-black uppercase tracking-[0.14em] text-archive-goldSoft">${escapeHtml(ev.category)}</span>` : ''}
        </div>

        <h1 class="max-w-4xl font-display text-4xl font-bold leading-tight text-white md:text-5xl">
          ${escapeHtml(ev.title)}
        </h1>

        ${dateStr || ev.location ? `
        <div class="mt-4 flex flex-wrap gap-6 text-sm text-archive-paper">
          ${dateStr    ? `<span><strong class="text-archive-goldSoft">Date:</strong> ${dateStr}</span>` : ''}
          ${ev.location ? `<span><strong class="text-archive-goldSoft">Location:</strong> ${escapeHtml(ev.location)}</span>` : ''}
        </div>` : ''}

        ${ev.registration_url || ev.video_url ? `
        <div class="mt-6 flex flex-wrap gap-3">
          ${ev.registration_url ? `
          <a href="${escapeHtml(ev.registration_url)}" target="_blank" rel="noopener"
            class="inline-block bg-archive-gold px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-archive-ink transition-opacity hover:opacity-90">
            Register now
          </a>` : ''}
          ${ev.video_url ? `
          <a href="${escapeHtml(ev.video_url)}" target="_blank" rel="noopener"
            class="inline-block border border-archive-goldSoft px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-archive-cream transition-opacity hover:opacity-90">
            Watch recording
          </a>` : ''}
        </div>` : ''}

      </div>
    </section>

    <!-- Body content -->
    <section class="py-14">
      <div class="mx-auto w-[min(760px,calc(100%-36px))]">
        ${ev.body
          ? `<div class="prose-body">${ev.body}</div>`
          : `<p class="text-archive-muted italic">No additional details have been published for this event yet.</p>`
        }

        <div class="mt-12 border-t border-archive-line pt-8">
          <a href="/events/"
            class="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-archive-muted transition-colors hover:text-archive-green">
            ${backArrow} Back to all events
          </a>
        </div>
      </div>
    </section>

  `;

  // ── Utilities ─────────────────────────────────────────────────────────
  function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return `${d} ${months[m - 1]} ${y}`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
})();
