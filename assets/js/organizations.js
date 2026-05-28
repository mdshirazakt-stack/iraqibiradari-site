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
        .select('id, title, tagline, body, logo_url, cover_image_url, website_url, address, founded_date, founders')
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

  const extIcon = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2H2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V6"/><path d="M7 1h2m0 0v2M9 1 5 5"/></svg>`;

  listEl.innerHTML = orgs.map(org => {
    const preview = stripHtml(org.body || '').slice(0, 140).trim();
    const logoHtml = org.logo_url
      ? `<img src="${escapeHtml(org.logo_url)}" alt="${escapeHtml(org.title)} logo"
           class="h-14 w-14 shrink-0 rounded-lg border border-archive-line object-contain bg-white p-1"
           onerror="this.style.display='none'"/>`
      : `<div class="h-14 w-14 shrink-0 rounded-lg border border-archive-line bg-archive-paper flex items-center justify-center">
           <span class="text-xl font-black text-archive-gold">${escapeHtml((org.title[0] || 'O').toUpperCase())}</span>
         </div>`;

    const metaItems = [];
    if (org.founders)     metaItems.push(`<span class="inline-flex items-center gap-1 text-xs text-archive-muted"><svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="4" cy="3.5" r="2"/><path d="M1 9.5c0-1.7 1.3-3 3-3s3 1.3 3 3"/><circle cx="8.5" cy="4" r="1.5"/><path d="M8.5 7.5c1.3.2 2.5 1.1 2.5 2.5"/></svg>${escapeHtml(org.founders)}</span>`);
    if (org.founded_date) metaItems.push(`<span class="inline-flex items-center gap-1 text-xs text-archive-muted"><svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><rect x="1" y="2" width="9" height="8" rx="1"/><path d="M1 5h9M3.5 1v2M7.5 1v2"/></svg>Est. ${escapeHtml(org.founded_date)}</span>`);

    return `
      <div class="flex flex-col overflow-hidden border border-archive-line bg-white transition-shadow hover:shadow-soft">

        ${org.cover_image_url
          ? `<a href="/organizations/detail/?id=${encodeURIComponent(org.id)}" class="block aspect-video overflow-hidden bg-archive-paper" tabindex="-1" aria-hidden="true">
               <img src="${escapeHtml(org.cover_image_url)}" alt=""
                 class="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
                 onerror="this.parentElement.style.display='none'"/>
             </a>`
          : ''}

        <a href="/organizations/detail/?id=${encodeURIComponent(org.id)}"
          class="block flex-1 p-6 hover:bg-archive-paper/30 transition-colors">
          <div class="flex items-start gap-4">
            ${logoHtml}
            <div class="min-w-0 flex-1">
              <h2 class="font-display text-xl font-bold leading-snug text-archive-green">${escapeHtml(org.title)}</h2>
              ${org.tagline ? `<p class="mt-1 text-sm font-bold text-archive-muted">${escapeHtml(org.tagline)}</p>` : ''}
            </div>
          </div>
          ${metaItems.length ? `<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1">${metaItems.join('')}</div>` : ''}
          ${preview ? `<p class="mt-4 line-clamp-3 text-sm leading-6 text-archive-muted">${escapeHtml(preview)}</p>` : ''}
        </a>

        <!-- Card footer -->
        <div class="flex items-center justify-between border-t border-archive-line px-6 py-3">
          <a href="/organizations/detail/?id=${encodeURIComponent(org.id)}"
            class="inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.1em] text-archive-gold hover:text-archive-green transition-colors">
            View Profile
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6h8M7 3l3 3-3 3"/></svg>
          </a>
          ${org.website_url
            ? `<a href="${escapeHtml(org.website_url)}" target="_blank" rel="noopener"
                class="inline-flex items-center gap-1.5 border border-archive-line px-3 py-1.5 text-xs font-bold text-archive-muted hover:text-archive-green hover:border-archive-green transition-colors">
                Visit Website ${extIcon}
               </a>`
            : ''}
        </div>

      </div>`;
  }).join('');
})();
