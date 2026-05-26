import { createSupabaseClient, withTimeout } from './supabase-config.js';

(async function () {
  const id        = new URLSearchParams(location.search).get('id');
  const main      = document.getElementById('story-main');
  const loadingEl = document.getElementById('story-loading');

  function showError(msg) {
    if (loadingEl) loadingEl.innerHTML = `<p class="text-archive-muted">${msg}</p>`;
  }

  if (!id) { showError('No story specified.'); return; }

  let supabase;
  try {
    supabase = await createSupabaseClient();
  } catch (err) {
    showError('Could not connect to database. Please try again.');
    return;
  }

  let story, error;
  try {
    ({ data: story, error } = await withTimeout(
      supabase.from('stories').select('*').eq('id', id).eq('published', true).single()
    ));
  } catch (err) {
    showError(`${err.message} — <button type="button" onclick="location.reload()" style="font-weight:700;text-decoration:underline">Try again</button>`);
    return;
  }

  if (error || !story) { showError('Story not found or has been removed.'); return; }

  document.title = `${story.title} — Iraqi Biradari`;

  const dateStr   = story.created_at
    ? new Date(story.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const backArrow = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;flex-shrink:0" aria-hidden="true"><path fill-rule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10z" clip-rule="evenodd"/></svg>`;

  main.innerHTML = `

    ${story.cover_image_url ? `
    <div style="max-height:420px;overflow:hidden">
      <img src="${escapeHtml(story.cover_image_url)}" alt="${escapeHtml(story.title)}"
        class="w-full object-cover" style="max-height:420px"
        onerror="this.parentElement.remove()"/>
    </div>` : ''}

    <!-- Hero -->
    <section class="bg-archive-green py-10 md:py-14 text-archive-cream">
      <div class="mx-auto w-[min(1120px,calc(100%-36px))]">

        <a href="/culture/" class="mb-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-archive-goldSoft transition-colors hover:text-white">
          ${backArrow} Our Culture
        </a>

        ${story.category
          ? `<p class="mb-3 text-xs font-black uppercase tracking-[0.18em] text-archive-goldSoft">${escapeHtml(story.category)}</p>`
          : ''}

        <h1 class="max-w-4xl font-display text-4xl font-bold leading-tight text-white md:text-5xl">
          ${escapeHtml(story.title)}
        </h1>

        <div class="mt-4 flex flex-wrap items-center gap-5 text-sm text-archive-paper">
          ${story.author ? `<span>By <strong class="text-archive-goldSoft">${escapeHtml(story.author)}</strong></span>` : ''}
          ${dateStr ? `<span>${dateStr}</span>` : ''}
        </div>

      </div>
    </section>

    <!-- Body -->
    <section class="py-14">
      <div class="mx-auto w-[min(760px,calc(100%-36px))]">

        ${story.excerpt ? `
        <p class="mb-8 border-l-4 border-archive-gold pl-5 font-display text-xl leading-8 text-archive-muted italic">
          ${escapeHtml(story.excerpt)}
        </p>` : ''}

        ${story.body
          ? `<div class="prose-body">${story.body}</div>`
          : `<p class="text-archive-muted italic">No content available for this story.</p>`
        }

        <div class="mt-12 border-t border-archive-line pt-8 flex flex-wrap items-center justify-between gap-4">
          <a href="/culture/"
            class="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-archive-muted transition-colors hover:text-archive-green">
            ${backArrow} Back to Our Culture
          </a>
          <a href="/culture/submit/"
            class="inline-block border border-archive-gold px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-archive-green transition-colors hover:bg-archive-gold hover:text-archive-ink">
            Share your own story →
          </a>
        </div>

      </div>
    </section>

  `;

  function escapeHtml(v) {
    return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
})();
