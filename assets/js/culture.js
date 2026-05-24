import { createSupabaseClient } from './supabase-config.js';

(async function () {
  const supabase  = await createSupabaseClient();
  const listEl    = document.getElementById('culture-list');
  const filtersEl = document.getElementById('culture-filters');
  if (!listEl) return;

  const CATEGORIES = [
    'all',
    'Food & Cuisine',
    'Marriages & Celebrations',
    'Rituals & Customs',
    'History & Heritage',
    'Community Life',
    'General',
  ];

  let allStories   = [];
  let activeFilter = 'all';

  const { data, error } = await supabase
    .from('stories')
    .select('id, title, author, category, cover_image_url, excerpt, body, created_at')
    .eq('published', true)
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    listEl.innerHTML = `<p class="py-8 text-sm text-archive-muted">${escapeHtml(error.message)}</p>`;
    return;
  }

  allStories = data || [];

  // Build category filter chips
  if (filtersEl) {
    // Only show categories that have at least one story (plus All)
    const usedCats = new Set(allStories.map(s => s.category).filter(Boolean));
    const chips    = CATEGORIES.filter(c => c === 'all' || usedCats.has(c));

    filtersEl.innerHTML = chips.map(cat => `
      <button data-cat="${escapeHtml(cat)}" type="button"
        class="${cat === 'all' ? activeChipCls() : inactiveChipCls()}">
        ${cat === 'all' ? 'All stories' : escapeHtml(cat)}
      </button>`).join('');

    filtersEl.addEventListener('click', e => {
      const btn = e.target.closest('button[data-cat]');
      if (!btn) return;
      activeFilter = btn.dataset.cat;
      filtersEl.querySelectorAll('button[data-cat]').forEach(b => {
        b.className = b.dataset.cat === activeFilter ? activeChipCls() : inactiveChipCls();
      });
      render();
    });
  }

  render();

  function render() {
    const filtered = activeFilter === 'all'
      ? allStories
      : allStories.filter(s => s.category === activeFilter);

    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="border border-archive-line bg-white p-10 text-center">
          <p class="font-display text-2xl font-bold text-archive-green">No stories yet</p>
          <p class="mt-2 text-sm text-archive-muted">
            Be the first —
            <a href="/culture/submit/" class="font-bold text-archive-green underline underline-offset-2 hover:text-archive-gold">share your story</a>.
          </p>
        </div>`;
      return;
    }

    listEl.innerHTML = `
      <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        ${filtered.map(storyCard).join('')}
      </div>`;
  }

  function storyCard(story) {
    const detailUrl = `/culture/detail/?id=${encodeURIComponent(story.id)}`;
    const excerpt   = story.excerpt || stripHtml(story.body || '').slice(0, 160);
    const dateStr   = story.created_at
      ? new Date(story.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    return `
      <a href="${detailUrl}"
        class="flex flex-col border border-archive-line bg-white transition-shadow hover:shadow-soft group">
        ${story.cover_image_url ? `
        <div class="aspect-video overflow-hidden">
          <img src="${escapeHtml(story.cover_image_url)}" alt="${escapeHtml(story.title)}"
            class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy" onerror="this.closest('.aspect-video').remove()"/>
        </div>` : ''}
        <div class="flex flex-1 flex-col p-5">
          ${story.category
            ? `<p class="mb-2 text-xs font-black uppercase tracking-[0.14em] text-archive-gold">${escapeHtml(story.category)}</p>`
            : ''}
          <h2 class="font-display text-xl font-bold leading-snug text-archive-green transition-colors group-hover:text-archive-gold">
            ${escapeHtml(story.title)}
          </h2>
          ${excerpt
            ? `<p class="mt-2 flex-1 line-clamp-3 text-sm leading-6 text-archive-muted">${escapeHtml(excerpt)}</p>`
            : ''}
          <div class="mt-4 flex flex-wrap items-center justify-between gap-2">
            ${story.author ? `<p class="text-xs font-bold text-archive-muted">By ${escapeHtml(story.author)}</p>` : ''}
            ${dateStr ? `<p class="text-xs text-archive-muted">${dateStr}</p>` : ''}
          </div>
        </div>
      </a>`;
  }

  function activeChipCls()   { return 'min-h-8 px-4 text-xs font-black uppercase tracking-[0.1em] bg-archive-green text-archive-cream'; }
  function inactiveChipCls() { return 'min-h-8 px-4 text-xs font-black uppercase tracking-[0.1em] border border-archive-line text-archive-muted hover:text-archive-green hover:border-archive-green'; }

  function stripHtml(html) {
    return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function escapeHtml(v) {
    return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
})();
