import { createSupabaseClient, withTimeout } from './supabase-config.js';

(async function () {
  const id        = new URLSearchParams(location.search).get('id');
  const main      = document.getElementById('announcement-main');
  const loadingEl = document.getElementById('announcement-loading');

  function showError(msg) {
    if (loadingEl) loadingEl.innerHTML = `<p class="text-archive-muted">${msg}</p>`;
  }

  if (!id) { showError('No announcement specified.'); return; }

  let supabase;
  try {
    supabase = await createSupabaseClient();
  } catch (err) {
    showError('Could not connect to database. Please try again.');
    return;
  }

  let ann, error;
  try {
    ({ data: ann, error } = await withTimeout(
      supabase.from('announcements').select('*').eq('id', id).eq('published', true).single()
    ));
  } catch (err) {
    showError(`${err.message} — <button type="button" onclick="location.reload()" style="font-weight:700;text-decoration:underline">Try again</button>`);
    return;
  }

  if (error || !ann) { showError('Announcement not found or has been unpublished.'); return; }

  // ── Update meta ───────────────────────────────────────────────────────
  document.title = `${ann.title} — Iraqi Biradari`;

  // ── Derived values ────────────────────────────────────────────────────
  const dateStr   = ann.created_at
    ? new Date(ann.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const backArrow = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;flex-shrink:0" aria-hidden="true"><path fill-rule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10z" clip-rule="evenodd"/></svg>`;

  // ── Build page ────────────────────────────────────────────────────────
  main.innerHTML = `

    <!-- Hero -->
    <section class="bg-archive-green py-10 md:py-14 text-archive-cream">
      <div class="mx-auto w-[min(1120px,calc(100%-36px))]">

        <a href="/announcements/" class="mb-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-archive-goldSoft transition-colors hover:text-white">
          ${backArrow} All announcements
        </a>

        <p class="text-xs font-black uppercase tracking-[0.18em] text-archive-goldSoft">
          Announcement${dateStr ? ` · ${dateStr}` : ''}
        </p>

        <h1 class="mt-3 max-w-4xl font-display text-4xl font-bold leading-tight text-white md:text-5xl">
          ${escapeHtml(ann.title)}
        </h1>

      </div>
    </section>

    <!-- Body content -->
    <section class="py-14">
      <div class="mx-auto w-[min(760px,calc(100%-36px))]">
        ${ann.body
          ? `<div class="prose-body">${ann.body}</div>`
          : `<p class="text-archive-muted italic">No content has been published for this announcement yet.</p>`
        }

        <div class="mt-12 border-t border-archive-line pt-8">
          <a href="/announcements/"
            class="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-archive-muted transition-colors hover:text-archive-green">
            ${backArrow} Back to announcements
          </a>
        </div>
      </div>
    </section>

  `;

  // ── Utilities ─────────────────────────────────────────────────────────
  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
})();
