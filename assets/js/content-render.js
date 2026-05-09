import { createSupabaseClient } from './supabase-config.js';

(async function () {
  const page = document.body.dataset.page;
  const list = document.querySelector('[data-content-list]');
  if (!page || !list) return;

  const empty = list.dataset.empty || 'No published items yet.';
  const labelMap = {
    documents: 'Open document',
    videos: 'Watch video',
    events: 'Register',
    announcements: 'Read'
  };

  const items = await loadItems(page);
  if (!items.length) {
    list.innerHTML = `<div class="border border-archive-line bg-white p-6 text-archive-muted">${escapeHtml(empty)}</div>`;
    return;
  }

  list.innerHTML = items.map((item) => {
    if (page === 'announcements') return renderAnnouncement(item);
    const meta = [item.category, item.type, item.date].filter(Boolean).join(' · ');
    const url = item.registrationUrl || item.url;
    const action = url
      ? `<a class="mt-5 inline-flex font-black text-archive-maroon underline underline-offset-4" href="${escapeHtml(url)}" target="_blank" rel="noopener">${labelMap[page] || 'Open'}</a>`
      : '';
    return `
      <article class="border border-archive-line bg-white p-6">
        <p class="text-xs font-black uppercase tracking-[0.14em] text-archive-gold">${escapeHtml(meta || 'Archive')}</p>
        <h2 class="mt-3 text-2xl font-black text-archive-green">${escapeHtml(item.title || 'Untitled')}</h2>
        <p class="mt-4 text-archive-muted">${escapeHtml(item.description || item.body || '')}</p>
        ${action}
      </article>
    `;
  }).join('');

  function renderAnnouncement(item) {
    const text = item.body || item.description || '';
    const preview = text.length > 220 ? `${text.slice(0, 220).trim()}...` : text;
    return `
      <article class="border border-archive-line bg-white p-6">
        <p class="text-xs font-black uppercase tracking-[0.14em] text-archive-gold">${escapeHtml(item.date || item.category || 'Announcement')}</p>
        <h2 class="mt-3 font-display text-3xl font-bold leading-tight text-archive-green">${escapeHtml(item.title || 'Untitled')}</h2>
        <p class="mt-4 leading-7 text-archive-muted">${escapeHtml(preview)}</p>
        <details class="mt-5 border-t border-archive-line pt-4">
          <summary class="cursor-pointer text-sm font-black uppercase tracking-[0.12em] text-archive-maroon">Read full announcement</summary>
          <p class="mt-4 whitespace-pre-line leading-8 text-archive-muted">${escapeHtml(text)}</p>
        </details>
      </article>
    `;
  }

  async function loadItems(type) {
    try {
      const supabase = await createSupabaseClient();
      const orderColumn = type === 'events' ? 'event_date' : type === 'videos' ? 'video_date' : 'created_at';
      let query = supabase
        .from(type)
        .select('*')
        .eq('published', true)
        .order(orderColumn, { ascending: type === 'events', nullsFirst: false })
        .order('sort_order', { ascending: false });
      if (type === 'events') query = query.gte('event_date', new Date().toISOString().slice(0, 10));
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((row) => normalizeRow(type, row));
    } catch (error) {
      return loadJsonFallback(type);
    }
  }

  async function loadJsonFallback(type) {
    try {
      const response = await fetch('/assets/data/content.json', { cache: 'no-store' });
      const data = await response.json();
      const today = new Date().toISOString().slice(0, 10);
      return (data[type] || [])
        .filter((item) => item.published !== false)
        .filter((item) => type !== 'events' || !item.date || item.date >= today);
    } catch (error) {
      return [];
    }
  }

  function normalizeRow(type, row) {
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      description: row.description,
      body: row.body,
      type: row.content_type,
      url: row.url,
      registrationUrl: row.registration_url,
      date: row.event_date || row.video_date || row.date,
      published: row.published
    };
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
