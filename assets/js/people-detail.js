import { createSupabaseClient, withTimeout } from './supabase-config.js';

(async function () {
  const id        = new URLSearchParams(location.search).get('id');
  const main      = document.getElementById('person-main');
  const loadingEl = document.getElementById('person-loading');

  function showError(msg) {
    if (loadingEl) loadingEl.innerHTML = `<p class="text-archive-muted">${msg}</p>`;
  }

  if (!id) { showError('No profile specified.'); return; }

  let supabase;
  try {
    supabase = await createSupabaseClient();
  } catch (err) {
    showError('Could not connect to database. Please try again.');
    return;
  }

  let person, error;
  try {
    ({ data: person, error } = await withTimeout(
      supabase.from('people').select('*').eq('id', id).eq('published', true).single()
    ));
  } catch (err) {
    showError(`${err.message} — <button type="button" onclick="location.reload()" style="font-weight:700;text-decoration:underline">Try again</button>`);
    return;
  }

  if (error || !person) { showError('Profile not found or has been removed.'); return; }

  document.title = `${person.title} — Iraqi Biradari`;

  const backArrow = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;flex-shrink:0" aria-hidden="true"><path fill-rule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10z" clip-rule="evenodd"/></svg>`;

  main.innerHTML = `

    <!-- Hero -->
    <section class="bg-archive-green py-10 md:py-14 text-archive-cream">
      <div class="mx-auto w-[min(1120px,calc(100%-36px))]">

        <a href="/people/" class="mb-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-archive-goldSoft transition-colors hover:text-white">
          ${backArrow} All achievers
        </a>

        <div class="flex flex-col gap-6 md:flex-row md:items-start">

          ${person.photo_url ? `
          <div class="shrink-0">
            <img src="${escapeHtml(person.photo_url)}" alt="${escapeHtml(person.title)}"
              class="h-36 w-36 rounded object-cover border-2 border-archive-goldSoft md:h-44 md:w-44"
              onerror="this.style.display='none'"/>
          </div>` : ''}

          <div>
            ${person.category
              ? `<p class="mb-2 text-xs font-black uppercase tracking-[0.18em] text-archive-goldSoft">${escapeHtml(person.category)}</p>`
              : ''}
            <h1 class="font-display text-4xl font-bold leading-tight text-white md:text-5xl">
              ${escapeHtml(person.title)}
            </h1>
            ${person.designation
              ? `<p class="mt-3 text-base font-bold text-archive-paper">${escapeHtml(person.designation)}</p>`
              : ''}
          </div>
        </div>

      </div>
    </section>

    <!-- Body -->
    <section class="py-14">
      <div class="mx-auto w-[min(760px,calc(100%-36px))]">
        ${person.body
          ? `<div class="prose-body">${person.body}</div>`
          : `<p class="text-archive-muted italic">No profile details have been published yet.</p>`
        }
        <div class="mt-12 border-t border-archive-line pt-8">
          <a href="/people/"
            class="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-archive-muted transition-colors hover:text-archive-green">
            ${backArrow} Back to achievers
          </a>
        </div>
      </div>
    </section>

  `;

  function escapeHtml(v) {
    return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
})();
