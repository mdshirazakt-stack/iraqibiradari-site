import { createSupabaseClient } from './supabase-config.js';

(async function () {
  const supabase = await createSupabaseClient();
  const listEl   = document.getElementById('announcements-list');
  if (!listEl) return;

  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, body, created_at')
    .eq('published', true)
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    listEl.innerHTML = `<p class="py-8 text-sm text-archive-muted">${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!data || !data.length) {
    listEl.innerHTML = `
      <div class="border border-archive-line bg-white p-10 text-center">
        <p class="font-display text-2xl font-bold text-archive-green">No announcements yet</p>
        <p class="mt-2 text-sm text-archive-muted">Check back soon for community updates.</p>
      </div>`;
    return;
  }

  listEl.innerHTML = data.map(item => {
    const preview = stripHtml(item.body || '').slice(0, 220);
    const dateStr = item.created_at
      ? new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    return `
      <a href="/announcements/detail/?id=${encodeURIComponent(item.id)}"
        class="block border border-archive-line bg-white p-6 transition-shadow hover:shadow-soft group">
        ${dateStr ? `<p class="text-xs font-black uppercase tracking-[0.14em] text-archive-gold">${dateStr}</p>` : ''}
        <h2 class="mt-2 font-display text-2xl font-bold leading-snug text-archive-green transition-colors group-hover:text-archive-gold">
          ${escapeHtml(item.title)}
        </h2>
        ${preview
          ? `<p class="mt-3 line-clamp-3 text-sm leading-7 text-archive-muted">${escapeHtml(preview)}</p>`
          : ''}
        <p class="mt-4 text-xs font-black uppercase tracking-[0.12em] text-archive-gold group-hover:underline group-hover:underline-offset-4">
          Read more →
        </p>
      </a>`;
  }).join('');

  // ── Utilities ─────────────────────────────────────────────────────────
  function stripHtml(html) {
    return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
})();
