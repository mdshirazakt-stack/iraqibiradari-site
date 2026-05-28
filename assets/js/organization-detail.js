import { createSupabaseClient, withTimeout } from './supabase-config.js';

(async function () {
  const main = document.getElementById('org-main');
  if (!main) return;

  const id = new URLSearchParams(location.search).get('id');
  if (!id) { renderError('No organization specified.'); return; }

  let supabase;
  try {
    supabase = await createSupabaseClient();
  } catch (err) {
    renderError('Could not connect to database. Please try again.');
    return;
  }

  // Core fetch — org + members + events + videos in parallel
  let orgRes, membersRes, eventsRes, videosRes;
  try {
    ([orgRes, membersRes, eventsRes, videosRes] = await withTimeout(Promise.all([
      supabase.from('organizations').select('*').eq('id', id).eq('published', true).single(),
      supabase.from('org_members').select('*').eq('org_id', id).order('sort_order').order('created_at'),
      supabase.from('events').select('id,title,category,event_date,event_type,description,registration_url,url').eq('org_id', id).eq('published', true).order('event_date', { ascending: false }),
      supabase.from('videos').select('id,title,category,video_date,url,description').eq('org_id', id).eq('published', true).order('video_date', { ascending: false }),
    ])));
  } catch (err) {
    renderError(`${err.message} — <a href="" onclick="location.reload();return false;" style="font-weight:700;text-decoration:underline">retry</a>`);
    return;
  }

  if (orgRes.error || !orgRes.data) { renderError('Organization not found.'); return; }

  const org     = orgRes.data;
  const members = membersRes.data || [];
  const events  = eventsRes.data  || [];
  const videos  = videosRes.data  || [];

  // Optional fetch — announcements + documents linked via org_id
  // Gracefully skipped if the column doesn't exist yet (run migration first)
  let announcements = [], documents = [];
  try {
    const [annRes, docRes] = await Promise.all([
      supabase.from('announcements').select('id,title,body').eq('org_id', id).eq('published', true).order('sort_order', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('documents').select('id,title,description,url,content_type').eq('org_id', id).eq('published', true).order('sort_order', { ascending: false }),
    ]);
    if (!annRes.error) announcements = annRes.data || [];
    if (!docRes.error) documents     = docRes.data  || [];
  } catch { /* column may not exist yet — tabs simply won't appear */ }

  // Page title
  document.title = `${org.title} — Iraqi Biradari`;
  const pageTitleEl = document.getElementById('page-title');
  if (pageTitleEl) pageTitleEl.textContent = `${org.title} — Iraqi Biradari`;

  const today = new Date().toISOString().slice(0, 10);

  // ── Decide which tabs are visible ──────────────────────────────────────
  const TABS = [
    { id: 'about',         label: 'About',                                         show: !!(org.body?.trim() || members.length) },
    { id: 'impact',        label: 'Impact',                                         show: !!(org.impact?.trim()) },
    { id: 'contribute',    label: 'Contribute',                                     show: !!(org.how_to_contribute?.trim()) },
    { id: 'apply',         label: 'Apply',                                          show: !!(org.how_to_apply?.trim()) },
    { id: 'events',        label: `Events${events.length ? ` (${events.length})` : ''}`,             show: events.length > 0 },
    { id: 'videos',        label: `Videos${videos.length ? ` (${videos.length})` : ''}`,             show: videos.length > 0 },
    { id: 'announcements', label: `Announcements${announcements.length ? ` (${announcements.length})` : ''}`, show: announcements.length > 0 },
    { id: 'documents',     label: `Documents${documents.length ? ` (${documents.length})` : ''}`,   show: documents.length > 0 },
  ];

  const visible = TABS.filter(t => t.show);
  // Always show at least "About" even if empty
  if (!visible.length) visible.push({ id: 'about', label: 'About', show: true });

  const hashTab  = location.hash.replace('#', '');
  const activeId = visible.find(t => t.id === hashTab)?.id || visible[0].id;

  // ── Render ──────────────────────────────────────────────────────────────
  main.innerHTML = `

    <!-- Hero -->
    <section class="bg-archive-green">
      ${org.cover_image_url
        ? `<div class="max-h-52 overflow-hidden">
             <img src="${escapeHtml(org.cover_image_url)}" alt="" class="w-full h-full object-cover opacity-25"/>
           </div>`
        : ''}
      <div class="mx-auto w-[min(1120px,calc(100%-36px))] py-10 md:py-12">
        <p class="text-xs font-black uppercase tracking-[0.18em] text-archive-goldSoft">
          <a href="/organizations/" class="hover:text-archive-cream transition-colors">Organizations</a>
        </p>
        <div class="mt-4 flex flex-wrap items-start gap-5">
          ${org.logo_url
            ? `<img src="${escapeHtml(org.logo_url)}" alt="${escapeHtml(org.title)} logo"
                 class="shrink-0 h-20 w-20 rounded-xl border-2 border-white/20 bg-white object-contain p-1.5"
                 onerror="this.style.display='none'"/>`
            : ''}
          <div class="flex-1 min-w-0">
            <h1 class="font-display text-3xl font-bold leading-tight text-white md:text-4xl">${escapeHtml(org.title)}</h1>
            ${org.tagline ? `<p class="mt-2 text-base font-bold text-archive-goldSoft">${escapeHtml(org.tagline)}</p>` : ''}
            ${org.founders || org.founded_date ? `
              <p class="mt-2 text-sm text-archive-paper/75">
                ${org.founders ? `Founded by <strong class="text-archive-paper">${escapeHtml(org.founders)}</strong>` : ''}
                ${org.founders && org.founded_date ? ' · ' : ''}
                ${org.founded_date ? escapeHtml(org.founded_date) : ''}
              </p>` : ''}
          </div>
        </div>
        ${contactBar(org)}
      </div>
    </section>

    <!-- Tab bar -->
    <div id="org-tab-bar" class="sticky top-[62px] z-20 border-b border-archive-line bg-white shadow-[0_1px_8px_rgba(32,28,23,.06)]">
      <div class="overflow-x-auto" style="-webkit-overflow-scrolling:touch;scrollbar-width:none">
        <div class="mx-auto flex w-max min-w-full px-4 md:px-0 md:w-[min(1120px,calc(100%-36px))]">
          ${visible.map(t => `
            <button data-tab="${escapeHtml(t.id)}" type="button"
              class="tab-btn shrink-0 whitespace-nowrap min-h-[46px] border-b-2 px-5 text-xs font-black uppercase tracking-[0.1em] transition-colors
                     ${t.id === activeId
                       ? 'border-archive-green text-archive-green'
                       : 'border-transparent text-archive-muted hover:text-archive-green hover:border-archive-line'}">
              ${escapeHtml(t.label)}
            </button>`).join('')}
        </div>
      </div>
    </div>

    <!-- Tab panels -->
    <div class="mx-auto w-[min(1120px,calc(100%-36px))] py-10 md:py-12">

      <!-- ABOUT -->
      <div id="tab-about" class="tab-panel${activeId === 'about' ? '' : ' hidden'}">
        <div class="grid gap-10 lg:grid-cols-[1fr_280px]">
          <div class="grid gap-8">
            ${org.body?.trim() ? `
              <section>
                <p class="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-archive-gold">About / Mission</p>
                <div class="org-body leading-relaxed">${org.body}</div>
              </section>` : ''}
            ${members.length ? `
              <section>
                <p class="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-archive-gold">Team</p>
                <div class="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  ${members.map(memberCard).join('')}
                </div>
              </section>` : ''}
            ${!org.body?.trim() && !members.length
              ? `<p class="italic text-sm text-archive-muted">No information available yet.</p>`
              : ''}
          </div>
          <aside class="grid gap-4 content-start">
            ${contactCard(org)}
          </aside>
        </div>
      </div>

      <!-- IMPACT -->
      <div id="tab-impact" class="tab-panel${activeId === 'impact' ? '' : ' hidden'}">
        <p class="mb-6 text-[11px] font-black uppercase tracking-[0.18em] text-archive-gold">Impact</p>
        <div class="max-w-3xl">
          <div class="org-body leading-relaxed">${org.impact || ''}</div>
        </div>
      </div>

      <!-- CONTRIBUTE -->
      <div id="tab-contribute" class="tab-panel${activeId === 'contribute' ? '' : ' hidden'}">
        <p class="mb-6 text-[11px] font-black uppercase tracking-[0.18em] text-archive-gold">How to Contribute / Get Involved</p>
        <div class="max-w-3xl">
          <div class="border-l-4 border-archive-gold bg-archive-paper px-6 py-5 rounded-r-lg">
            <div class="text-sm leading-7 text-archive-ink whitespace-pre-line">${escapeHtml(org.how_to_contribute || '')}</div>
          </div>
        </div>
      </div>

      <!-- APPLY -->
      <div id="tab-apply" class="tab-panel${activeId === 'apply' ? '' : ' hidden'}">
        <p class="mb-6 text-[11px] font-black uppercase tracking-[0.18em] text-archive-gold">Apply as a Beneficiary</p>
        <div class="max-w-3xl">
          <div class="border-l-4 border-archive-maroon bg-archive-paper px-6 py-5 rounded-r-lg">
            <div class="text-sm leading-7 text-archive-ink whitespace-pre-line">${escapeHtml(org.how_to_apply || '')}</div>
          </div>
        </div>
      </div>

      <!-- EVENTS -->
      <div id="tab-events" class="tab-panel${activeId === 'events' ? '' : ' hidden'}">
        <p class="mb-6 text-[11px] font-black uppercase tracking-[0.18em] text-archive-gold">Events (${events.length})</p>
        <div class="grid gap-3 md:grid-cols-2">
          ${events.map(ev => eventCard(ev, today)).join('')}
        </div>
      </div>

      <!-- VIDEOS -->
      <div id="tab-videos" class="tab-panel${activeId === 'videos' ? '' : ' hidden'}">
        <p class="mb-6 text-[11px] font-black uppercase tracking-[0.18em] text-archive-gold">Videos (${videos.length})</p>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          ${videos.map(videoCard).join('')}
        </div>
      </div>

      <!-- ANNOUNCEMENTS -->
      <div id="tab-announcements" class="tab-panel${activeId === 'announcements' ? '' : ' hidden'}">
        <p class="mb-6 text-[11px] font-black uppercase tracking-[0.18em] text-archive-gold">Announcements (${announcements.length})</p>
        <div class="grid gap-4">
          ${announcements.map(announcementCard).join('')}
        </div>
      </div>

      <!-- DOCUMENTS -->
      <div id="tab-documents" class="tab-panel${activeId === 'documents' ? '' : ' hidden'}">
        <p class="mb-6 text-[11px] font-black uppercase tracking-[0.18em] text-archive-gold">Documents (${documents.length})</p>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          ${documents.map(documentCard).join('')}
        </div>
      </div>

    </div>
  `;

  // Wire tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });

  function activateTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => {
      const on = b.dataset.tab === tabId;
      b.classList.toggle('border-archive-green', on);
      b.classList.toggle('text-archive-green',   on);
      b.classList.toggle('border-transparent',   !on);
      b.classList.toggle('text-archive-muted',   !on);
    });
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('hidden', p.id !== `tab-${tabId}`);
    });
    history.replaceState(null, '', `#${tabId}`);
    // Scroll tab button into view on mobile
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // ── Helper renderers ────────────────────────────────────────────────────

  function contactBar(o) {
    const items = [];
    const extIcon = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2H2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V6"/><path d="M7 1h2m0 0v2M9 1 5 5"/></svg>`;
    if (o.website_url)   items.push(`<a href="${escapeHtml(o.website_url)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 text-xs font-bold text-archive-paper hover:text-white underline underline-offset-4">${escapeHtml(o.website_url.replace(/^https?:\/\//,'').replace(/\/$/,''))} ${extIcon}</a>`);
    if (o.contact_email) items.push(`<a href="mailto:${escapeHtml(o.contact_email)}" class="text-xs font-bold text-archive-paper hover:text-white underline underline-offset-4">${escapeHtml(o.contact_email)}</a>`);
    if (o.contact_phone) items.push(`<a href="tel:${escapeHtml(o.contact_phone)}" class="text-xs font-bold text-archive-paper hover:text-white">${escapeHtml(o.contact_phone)}</a>`);
    return items.length ? `<div class="mt-5 flex flex-wrap gap-5">${items.join('')}</div>` : '';
  }

  function contactCard(o) {
    if (!o.contact_email && !o.contact_phone && !o.website_url && !o.address && !o.founded_date && !o.founders) return '';
    return `
      <div class="rounded-xl border border-archive-line bg-white p-5">
        <p class="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-archive-gold">Details</p>
        <dl class="grid gap-3 text-sm">
          ${o.founded_date  ? `<div><dt class="text-[10px] font-black uppercase tracking-[0.12em] text-archive-muted">Founded</dt><dd class="mt-0.5 font-bold text-archive-ink">${escapeHtml(o.founded_date)}</dd></div>` : ''}
          ${o.founders      ? `<div><dt class="text-[10px] font-black uppercase tracking-[0.12em] text-archive-muted">Founders</dt><dd class="mt-0.5 text-archive-ink">${escapeHtml(o.founders)}</dd></div>` : ''}
          ${o.website_url   ? `<div><dt class="text-[10px] font-black uppercase tracking-[0.12em] text-archive-muted">Website</dt><dd class="mt-0.5"><a href="${escapeHtml(o.website_url)}" target="_blank" rel="noopener" class="font-bold text-archive-green underline underline-offset-4 break-all">${escapeHtml(o.website_url.replace(/^https?:\/\//, ''))}</a></dd></div>` : ''}
          ${o.contact_email ? `<div><dt class="text-[10px] font-black uppercase tracking-[0.12em] text-archive-muted">Email</dt><dd class="mt-0.5"><a href="mailto:${escapeHtml(o.contact_email)}" class="font-bold text-archive-green underline underline-offset-4 break-all">${escapeHtml(o.contact_email)}</a></dd></div>` : ''}
          ${o.contact_phone ? `<div><dt class="text-[10px] font-black uppercase tracking-[0.12em] text-archive-muted">Phone / WhatsApp</dt><dd class="mt-0.5 font-bold text-archive-ink">${escapeHtml(o.contact_phone)}</dd></div>` : ''}
          ${o.address       ? `<div><dt class="text-[10px] font-black uppercase tracking-[0.12em] text-archive-muted">Address</dt><dd class="mt-0.5 text-archive-muted">${escapeHtml(o.address)}</dd></div>` : ''}
        </dl>
      </div>`;
  }

  function memberCard(m) {
    return `
      <div class="flex items-center gap-3 border border-archive-line bg-white p-4">
        ${m.photo_url
          ? `<img src="${escapeHtml(m.photo_url)}" alt="${escapeHtml(m.name)}"
               class="h-14 w-14 shrink-0 rounded object-cover border border-archive-line"
               onerror="this.style.display='none'"/>`
          : `<div class="h-14 w-14 shrink-0 flex items-center justify-center rounded bg-archive-paper border border-archive-line">
               <span class="font-black text-xl text-archive-gold">${escapeHtml((m.name[0] || '?').toUpperCase())}</span>
             </div>`}
        <div class="min-w-0">
          <p class="font-bold text-archive-ink truncate">${escapeHtml(m.name)}</p>
          ${m.role ? `<p class="text-xs text-archive-muted truncate">${escapeHtml(m.role)}</p>` : ''}
        </div>
      </div>`;
  }

  function eventCard(ev, today) {
    const dateStr    = ev.event_date || '';
    const isPast     = dateStr && dateStr < today;
    const detailHref = `/events/detail/?id=${encodeURIComponent(ev.id)}`;
    let dateBlock    = '';
    if (dateStr) {
      const d = new Date(dateStr + 'T00:00:00');
      if (!isNaN(d)) {
        dateBlock = `
          <div class="shrink-0 flex flex-col items-center justify-center bg-archive-green px-4 py-3 text-center min-w-[56px] group-hover:bg-archive-green/80 transition-colors">
            <span class="text-xl font-black text-white leading-none">${d.getDate()}</span>
            <span class="text-[10px] font-bold uppercase text-archive-goldSoft">${d.toLocaleString('en-GB',{month:'short'}).toUpperCase()}</span>
            <span class="text-[10px] text-archive-paper/70">${d.getFullYear()}</span>
          </div>`;
      }
    }
    const regLink = ev.registration_url || ev.url;
    return `
      <div class="relative flex overflow-hidden border border-archive-line bg-white group hover:shadow-md hover:border-archive-green/40 transition-all cursor-pointer">
        <!-- stretched link — covers the whole card -->
        <a href="${detailHref}" class="absolute inset-0 z-0" aria-label="${escapeHtml(ev.title)}"></a>
        ${dateBlock}
        <div class="flex flex-1 flex-col p-4 min-w-0">
          <div class="flex flex-wrap gap-1.5">
            ${isPast
              ? `<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase bg-archive-paper text-archive-muted border border-archive-line">Past</span>`
              : `<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase bg-green-100 text-green-800">Upcoming</span>`}
            ${ev.event_type === 'webinar' ? `<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase bg-archive-goldSoft text-archive-ink">Online</span>` : ''}
            ${ev.category ? `<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase border border-archive-line text-archive-muted">${escapeHtml(ev.category)}</span>` : ''}
          </div>
          <p class="mt-2 font-display text-base font-bold text-archive-green group-hover:text-archive-gold transition-colors leading-snug">${escapeHtml(ev.title)}</p>
          ${ev.description ? `<p class="mt-1 line-clamp-2 text-xs leading-5 text-archive-muted">${escapeHtml(ev.description)}</p>` : ''}
          <div class="mt-2 flex flex-wrap items-center gap-3">
            <span class="inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.08em] text-archive-green group-hover:text-archive-gold transition-colors">
              View details
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6h8M7 3l3 3-3 3"/></svg>
            </span>
            ${regLink && !isPast
              ? `<a href="${escapeHtml(regLink)}" target="_blank" rel="noopener"
                  class="relative z-10 inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.08em] text-archive-gold hover:underline">Register →</a>`
              : ''}
          </div>
        </div>
      </div>`;
  }

  function getYouTubeId(url) {
    if (!url) return null;
    try {
      const u = new URL(url);
      if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0] || null;
      if (u.hostname.includes('youtube.com')) {
        if (u.pathname.startsWith('/embed/')) return u.pathname.replace('/embed/', '').split('/')[0] || null;
        return u.searchParams.get('v') || null;
      }
    } catch (_) {}
    return null;
  }

  function videoCard(v) {
    const dateStr  = v.video_date || '';
    let dateLabel  = '';
    if (dateStr) {
      const d = new Date(dateStr + 'T00:00:00');
      if (!isNaN(d)) dateLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    const ytId     = getYouTubeId(v.url);
    const thumbUrl = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;
    const href     = escapeHtml(v.url || '#');

    const thumbnailHtml = thumbUrl
      ? `<a href="${href}" target="_blank" rel="noopener" class="block relative aspect-video overflow-hidden bg-archive-paper border-b border-archive-line group" tabindex="-1" aria-hidden="true">
           <img src="${escapeHtml(thumbUrl)}" alt=""
             class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
             onerror="this.parentElement.style.display='none'"/>
           <div class="absolute inset-0 flex items-center justify-center">
             <div class="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition-transform duration-200 group-hover:scale-110">
               <svg width="20" height="20" viewBox="0 0 20 20" fill="white" aria-hidden="true"><path d="M7 5l10 5-10 5V5z"/></svg>
             </div>
           </div>
         </a>`
      : `<a href="${href}" target="_blank" rel="noopener" class="flex h-24 items-center justify-center border-b border-archive-line bg-archive-paper" tabindex="-1" aria-hidden="true">
           <div class="flex h-12 w-12 items-center justify-center rounded-full bg-archive-green text-archive-cream">
             <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M7 5l10 5-10 5V5z"/></svg>
           </div>
         </a>`;

    return `
      <div class="flex flex-col border border-archive-line bg-white hover:shadow-soft transition-shadow overflow-hidden">
        ${thumbnailHtml}
        <div class="flex flex-1 flex-col p-4">
          ${v.category ? `<p class="mb-1 text-[10px] font-black uppercase tracking-[0.1em] text-archive-gold">${escapeHtml(v.category)}</p>` : ''}
          <a href="${href}" target="_blank" rel="noopener" class="font-bold text-archive-green line-clamp-2 leading-snug hover:text-archive-gold transition-colors">${escapeHtml(v.title)}</a>
          ${dateLabel ? `<p class="mt-auto pt-2 text-xs text-archive-muted">${dateLabel}</p>` : ''}
        </div>
      </div>`;
  }

  function announcementCard(a) {
    return `
      <div class="border border-archive-line bg-white p-6">
        <h3 class="font-display text-lg font-bold text-archive-green">${escapeHtml(a.title)}</h3>
        ${a.body ? `<div class="mt-3 text-sm leading-7 text-archive-ink org-body">${a.body}</div>` : ''}
      </div>`;
  }

  function documentCard(d) {
    return `
      <a href="${escapeHtml(d.url || '#')}" target="_blank" rel="noopener"
        class="flex flex-col border border-archive-line bg-white p-5 hover:shadow-soft transition-shadow">
        <div class="mb-3 flex h-10 w-10 items-center justify-center rounded bg-archive-paper border border-archive-line">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 1H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6"/><path d="M9 1l5 5M9 1v5h5"/></svg>
        </div>
        ${d.content_type ? `<p class="text-[10px] font-black uppercase tracking-[0.1em] text-archive-gold mb-1">${escapeHtml(d.content_type)}</p>` : ''}
        <p class="font-bold text-archive-green line-clamp-2 leading-snug">${escapeHtml(d.title)}</p>
        ${d.description ? `<p class="mt-1.5 line-clamp-2 text-xs leading-5 text-archive-muted">${escapeHtml(d.description)}</p>` : ''}
        <p class="mt-auto pt-3 text-[10px] font-black uppercase tracking-[0.1em] text-archive-muted">Open document →</p>
      </a>`;
  }

  function renderError(msg) {
    main.innerHTML = `
      <section class="bg-archive-green py-10 md:py-14">
        <div class="mx-auto w-[min(1120px,calc(100%-36px))]">
          <p class="text-xs font-black uppercase tracking-[0.18em] text-archive-goldSoft">
            <a href="/organizations/" class="hover:text-archive-cream transition-colors">Organizations</a>
          </p>
          <h1 class="mt-3 font-display text-3xl font-bold text-white">${msg}</h1>
        </div>
      </section>
      <div class="mx-auto w-[min(1120px,calc(100%-36px))] py-12">
        <a href="/organizations/" class="text-sm font-bold text-archive-green underline underline-offset-4">← Back to all organizations</a>
      </div>`;
  }

  function escapeHtml(v) {
    return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
})();
