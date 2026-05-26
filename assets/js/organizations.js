import { createSupabaseClient, withTimeout } from './supabase-config.js';

(async function () {
  const listEl = document.getElementById('orgs-list');
  if (!listEl) return;

  function stripHtml(html) { return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
  function escapeHtml(v)   { return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

  let supabase;
  try {
    supabase = await createSupabaseClient();
  } catch (err) {
    listEl.innerHTML = `<p class="col-span-full py-8 text-sm text-archive-muted">Could not connect: ${escapeHtml(String(err))}</p>`;
    return;
  }

  let data, error;
  try {
    ({ data, error } = await withTimeout(
      supabase
        .from('organizations')
        .select('id, title, tagline, body, logo_url, cover_image_url')
        .eq('published', true)
        .order('sort_order', { ascending: false })
        .order('created_at', { ascending: false })
    ));
  } catch (err) {
    listEl.innerHTML = `<p class="col-span-full py-8 text-sm text-archive-muted">⏱ ${escapeHtml(err.message)} — <button type="button" onclick="location.reload()" class="font-bold text-archive-green underline underline-offset-2 hover:text-archive-gold">Try again</button></p>`;
    return;
  }

  if (error) {
    listEl.innerHTML = `<p class="col-span-full py-8 text-sm text-archive-muted">Error: ${escapeHtml(error.message)}</p>`;
    return;
  }

  const orgs = data || [];

  if (!orgs.length) {
    listEl.innerHTML = `
      <div class="col-span-full border border-archive-line bg-archive-paper p-8 text-center">
        <p class="font-display text-2xl font-bold text-archive-green">Organization listings are being set up.</p>
        <p class="mt-2 text-sm text-archive-muted">The first organizations will appear here once added by the admin.</p>
      </div>`;
    return;
  }

  listEl.innerHTML = orgs.map(org => {
    const preview = stripHtml(org.body || '').slice(0, 140).trim();
    const tagline = org.tagline || '';
    const logoHtml = org.logo_url
      ? `<img src="${escapeHtml(org.logo_url)}" alt="${escapeHtml(org.title)} logo"
           class="h-16 w-16 shrink-0 rounded-lg border border-archive-line object-contain bg-white p-1"
           onerror="this.style.display='none'"/>`
      : `<div class="h-16 w-16 shrink-0 rounded-lg border border-archive-line bg-archive-paper flex items-center justify-center">
           <span class="text-2xl font-black text-archive-gold">${escapeHtml((org.title[0] || 'O').toUpperCase())}</span>
         </div>`;

    return `
      <a href="/organizations/detail/?id=${encodeURIComponent(org.id)}"
        class="group flex flex-col overflow-hidden border border-archive-line bg-white transition-shadow hover:shadow-soft">
        ${org.cover_image_url
          ? `<div class="aspect-video overflow-hidden bg-archive-paper">
               <img src="${escapeHtml(org.cover_image_url)}" alt=""
                 class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                 onerror="this.parentElement.style.display='none'"/>
             </div>`
          : ''}
        <div class="flex flex-1 flex-col p-6">
          <div class="flex items-start gap-4">
            ${logoHtml}
            <div class="min-w-0 flex-1">
              <h2 class="font-display text-xl font-bold leading-snug text-archive-green group-hover:text-archive-gold transition-colors">${escapeHtml(org.title)}</h2>
              ${tagline ? `<p class="mt-1 text-sm font-bold text-archive-muted">${escapeHtml(tagline)}</p>` : ''}
            </div>
          </div>
          ${preview ? `<p class="mt-4 line-clamp-3 text-sm leading-6 text-archive-muted">${escapeHtml(preview)}</p>` : ''}
          <p class="mt-4 flex items-center gap-1 text-xs font-black uppercase tracking-[0.1em] text-archive-gold">
            View Organization
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6h8M7 3l3 3-3 3"/></svg>
          </p>
        </div>
      </a>`;
  }).join('');
})();
