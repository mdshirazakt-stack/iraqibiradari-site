import { createSupabaseClient, withTimeout } from './supabase-config.js';

// Home page "What's new" band — the 5 most recently added/updated published
// items across every content type. people and stories have no updated_at
// column, so they sort by created_at; everything else by updated_at (which
// defaults to created_at on insert). The band stays hidden on error or when
// there is nothing to show.

const LIMIT = 5;

const SOURCES = [
  { table: 'people',        label: 'Achiever',     hasUpdated: false, href: r => `/people/detail/?id=${encodeURIComponent(r.id)}` },
  { table: 'stories',       label: 'Our Culture',  hasUpdated: false, href: r => `/culture/detail/?id=${encodeURIComponent(r.id)}` },
  { table: 'events',        label: 'Event',        hasUpdated: true,  href: r => `/events/detail/?id=${encodeURIComponent(r.id)}` },
  { table: 'announcements', label: 'Announcement', hasUpdated: true,  href: r => `/announcements/detail/?id=${encodeURIComponent(r.id)}` },
  { table: 'organizations', label: 'Organization', hasUpdated: true,  href: r => `/organizations/detail/?id=${encodeURIComponent(r.id)}` },
  { table: 'documents',     label: 'Document',     hasUpdated: true,  href: r => r.url || '/documents/', external: r => !!r.url },
  { table: 'videos',        label: 'Video',        hasUpdated: true,  href: r => r.url || '/videos/',    external: r => !!r.url },
];

function escapeHtml(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatDate(d) {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

(async function () {
  const section = document.getElementById('recent-updates');
  const list = document.getElementById('recent-updates-list');
  if (!section || !list) return;

  let supabase;
  try { supabase = await createSupabaseClient(); } catch { return; }

  const results = await Promise.allSettled(SOURCES.map(src => {
    const cols = src.hasUpdated ? 'id,title,url,created_at,updated_at' : 'id,title,created_at';
    const select = src.table === 'documents' || src.table === 'videos' ? cols : cols.replace(',url', '');
    return withTimeout(
      supabase.from(src.table).select(select).eq('published', true)
        .order(src.hasUpdated ? 'updated_at' : 'created_at', { ascending: false })
        .limit(LIMIT)
    ).then(({ data, error }) => {
      if (error) throw error;
      return (data || []).map(row => {
        const created = row.created_at ? new Date(row.created_at) : null;
        const updated = row.updated_at ? new Date(row.updated_at) : null;
        const when = updated && created && updated > created ? updated : (created || updated);
        // Saving a row re-stamps updated_at a moment after creation; only call
        // it "Updated" when the edit came well after the item was added.
        const isUpdate = !!(updated && created && updated - created > 24 * 60 * 60 * 1000);
        return { src, row, when, isUpdate };
      });
    });
  }));

  const items = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .filter(it => it.when && !isNaN(it.when) && String(it.row.title || '').trim())
    .sort((a, b) => b.when - a.when)
    .slice(0, LIMIT);

  if (!items.length) return;

  list.innerHTML = items.map(({ src, row, when, isUpdate }) => {
    const external = src.external?.(row);
    const attrs = external ? ' target="_blank" rel="noopener"' : '';
    return `
      <li>
        <a href="${escapeHtml(src.href(row))}"${attrs}
           class="group flex flex-col gap-1 border-b border-archive-line py-4 transition-colors hover:bg-archive-cream sm:flex-row sm:items-center sm:gap-5 sm:px-3">
          <span class="w-32 shrink-0 text-[11px] font-black uppercase tracking-[0.14em] text-archive-gold">${escapeHtml(src.label)}</span>
          <span class="flex-1 font-bold leading-snug text-archive-green group-hover:underline group-hover:underline-offset-4">${escapeHtml(row.title)}</span>
          <span class="shrink-0 text-xs text-archive-muted">${isUpdate ? 'Updated' : 'Added'} ${escapeHtml(formatDate(when))}</span>
        </a>
      </li>`;
  }).join('');
  section.hidden = false;

  // Rows are inserted after GoatCounter's own click binding runs, so count
  // clicks here (no-op if the counter script didn't load).
  list.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    const name = 'whats-new: ' + (link.querySelector('.font-bold')?.textContent || '').trim();
    window.goatcounter?.count?.({ path: name, title: name, event: true });
  });
})();
