import { createSupabaseClient, withTimeout } from './supabase-config.js';

(async function () {
  const listEl      = document.getElementById('people-list');
  const filtersEl   = document.getElementById('people-filters');
  if (!listEl) return;

  let supabase;
  try {
    supabase = await createSupabaseClient();
  } catch (err) {
    listEl.innerHTML = `<p class="py-8 text-sm text-archive-muted">Could not connect — ${escapeHtml(String(err))}</p>`;
    return;
  }

  let allPeople    = [];
  let activeFilter = 'all';

  let data, error;
  try {
    ({ data, error } = await withTimeout(
      supabase
        .from('people')
        .select('id, title, designation, category')
        .eq('published', true)
        .order('sort_order', { ascending: false })
        .order('created_at', { ascending: false })
    ));
  } catch (err) {
    listEl.innerHTML = `<p class="py-8 text-sm text-archive-muted">⏱ ${escapeHtml(err.message)} — <button type="button" onclick="location.reload()" class="font-bold text-archive-green underline underline-offset-2 hover:text-archive-gold">Try again</button></p>`;
    return;
  }

  if (error) {
    listEl.innerHTML = `<p class="py-8 text-sm text-archive-muted">${escapeHtml(error.message)}</p>`;
    return;
  }

  allPeople = data || [];

  // Build category filter chips
  const categories = ['all', ...new Set(allPeople.map(p => p.category).filter(Boolean))];
  if (filtersEl && categories.length > 1) {
    filtersEl.innerHTML = categories.map(cat => `
      <button data-cat="${escapeHtml(cat)}" type="button"
        class="${cat === activeFilter ? activeChipCls() : inactiveChipCls()}">
        ${cat === 'all' ? 'All' : escapeHtml(cat)}
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
      ? allPeople
      : allPeople.filter(p => p.category === activeFilter);

    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="border border-archive-line bg-white p-10 text-center">
          <p class="font-display text-2xl font-bold text-archive-green">No profiles found</p>
          <p class="mt-2 text-sm text-archive-muted">Try selecting a different category.</p>
        </div>`;
      return;
    }

    listEl.innerHTML = filtered.map(person => {
      const detailUrl = `/people/detail/?id=${encodeURIComponent(person.id)}`;
      return `
        <a href="${detailUrl}"
          class="flex items-center justify-between gap-4 border-b border-archive-line bg-white px-6 py-5 transition-colors hover:bg-archive-paper group">
          <div>
            ${person.category
              ? `<p class="mb-1 text-xs font-black uppercase tracking-[0.14em] text-archive-gold">${escapeHtml(person.category)}</p>`
              : ''}
            <h2 class="font-display text-2xl font-bold text-archive-green transition-colors group-hover:text-archive-gold">
              ${escapeHtml(person.title)}
            </h2>
            ${person.designation
              ? `<p class="mt-1 text-sm font-bold text-archive-muted">${escapeHtml(person.designation)}</p>`
              : ''}
          </div>
          <span class="shrink-0 text-sm font-black uppercase tracking-[0.1em] text-archive-gold opacity-0 transition-opacity group-hover:opacity-100">
            View profile →
          </span>
        </a>`;
    }).join('');
  }

  function activeChipCls()   { return 'min-h-8 px-4 text-xs font-black uppercase tracking-[0.1em] bg-archive-green text-archive-cream'; }
  function inactiveChipCls() { return 'min-h-8 px-4 text-xs font-black uppercase tracking-[0.1em] border border-archive-line text-archive-muted hover:text-archive-green hover:border-archive-green'; }

  function escapeHtml(v) {
    return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
})();
