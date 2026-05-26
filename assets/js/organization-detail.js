import { createSupabaseClient } from './supabase-config.js';

(async function () {
  const supabase = await createSupabaseClient();
  const main     = document.getElementById('org-main');
  if (!main) return;

  const id = new URLSearchParams(location.search).get('id');
  if (!id) { renderError('No organization specified.'); return; }

  // Fetch org, members, linked events, and linked videos in parallel
  const [orgRes, membersRes, eventsRes, videosRes] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', id).eq('published', true).single(),
    supabase.from('org_members').select('*').eq('org_id', id).order('sort_order').order('created_at'),
    supabase.from('events').select('id, title, category, event_date, event_type, description, registration_url, url').eq('org_id', id).eq('published', true).order('event_date', { ascending: false }),
    supabase.from('videos').select('id, title, category, video_date, url, description').eq('org_id', id).eq('published', true).order('video_date', { ascending: false }),
  ]);

  if (orgRes.error || !orgRes.data) { renderError('Organization not found.'); return; }

  const org     = orgRes.data;
  const members = membersRes.data || [];
  const events  = eventsRes.data  || [];
  const videos  = videosRes.data  || [];

  // Update page title
  document.title         = `${org.title} — Iraqi Biradari`;
  document.getElementById('page-title').textContent = `${org.title} — Iraqi Biradari`;

  const today = new Date().toISOString().slice(0, 10);

  main.innerHTML = `

    <!-- Hero -->
    <section class="bg-archive-green">
      ${org.cover_image_url
        ? `<div class="h-48 overflow-hidden md:h-64">
             <img src="${escapeHtml(org.cover_image_url)}" alt="" class="h-full w-full object-cover opacity-30"/>
           </div>`
        : ''}
      <div class="mx-auto w-[min(1120px,calc(100%-36px))] py-10 md:py-14">
        <p class="text-xs font-black uppercase tracking-[0.18em] text-archive-goldSoft">
          <a href="/organizations/" class="hover:text-archive-cream transition-colors">Organizations</a>
        </p>
        <div class="mt-4 flex items-start gap-5">
          ${org.logo_url
            ? `<img src="${escapeHtml(org.logo_url)}" alt="${escapeHtml(org.title)} logo"
                 class="shrink-0 h-20 w-20 rounded-xl border-2 border-archive-goldSoft bg-white object-contain p-1.5"
                 onerror="this.style.display='none'"/>`
            : ''}
          <div>
            <h1 class="font-display text-3xl font-bold leading-tight text-white md:text-4xl">${escapeHtml(org.title)}</h1>
            ${org.tagline ? `<p class="mt-2 text-base font-bold text-archive-goldSoft">${escapeHtml(org.tagline)}</p>` : ''}
          </div>
        </div>
        ${contactBar(org)}
      </div>
    </section>

    <!-- Two-column body -->
    <div class="mx-auto w-[min(1120px,calc(100%-36px))] grid gap-8 py-12 lg:grid-cols-[1fr_300px]">

      <!-- LEFT: main content -->
      <div class="grid gap-8">

        ${org.body && org.body.trim()
          ? `<!-- Mission / About -->
             <section>
               <p class="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-archive-gold">About / Mission</p>
               <div class="org-body leading-relaxed">${org.body}</div>
             </section>`
          : ''}

        ${members.length
          ? `<!-- Team Members -->
             <section>
               <p class="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-archive-gold">Team</p>
               <div class="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                 ${members.map(m => `
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
                   </div>`).join('')}
               </div>
             </section>`
          : ''}

        ${org.how_to_contribute && org.how_to_contribute.trim()
          ? `<!-- How to contribute -->
             <section>
               <p class="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-archive-gold">How to Contribute / Get Involved</p>
               <div class="border-l-4 border-archive-gold bg-archive-paper px-6 py-5">
                 <div class="text-sm leading-7 text-archive-ink whitespace-pre-line">${escapeHtml(org.how_to_contribute)}</div>
               </div>
             </section>`
          : ''}

        ${org.how_to_apply && org.how_to_apply.trim()
          ? `<!-- How to apply as beneficiary -->
             <section>
               <p class="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-archive-gold">Apply as a Beneficiary</p>
               <div class="border-l-4 border-archive-maroon bg-archive-paper px-6 py-5">
                 <div class="text-sm leading-7 text-archive-ink whitespace-pre-line">${escapeHtml(org.how_to_apply)}</div>
               </div>
             </section>`
          : ''}

        ${events.length
          ? `<!-- Linked events -->
             <section>
               <p class="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-archive-gold">Events</p>
               <div class="grid gap-3">
                 ${events.map(ev => eventCard(ev, today)).join('')}
               </div>
             </section>`
          : ''}

        ${videos.length
          ? `<!-- Linked videos -->
             <section>
               <p class="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-archive-gold">Videos</p>
               <div class="grid gap-3 sm:grid-cols-2">
                 ${videos.map(videoCard).join('')}
               </div>
             </section>`
          : ''}

      </div>

      <!-- RIGHT: contact sidebar -->
      <aside class="grid gap-4 content-start">
        ${contactCard(org)}
      </aside>

    </div>
  `;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function contactBar(o) {
    const links = [];
    if (o.website_url) links.push(`<a href="${escapeHtml(o.website_url)}" target="_blank" rel="noopener" class="text-xs font-bold text-archive-paper hover:text-archive-cream underline underline-offset-4">${escapeHtml(o.website_url.replace(/^https?:\/\//, ''))}</a>`);
    if (o.contact_email) links.push(`<a href="mailto:${escapeHtml(o.contact_email)}" class="text-xs font-bold text-archive-paper hover:text-archive-cream underline underline-offset-4">${escapeHtml(o.contact_email)}</a>`);
    if (!links.length) return '';
    return `<div class="mt-4 flex flex-wrap gap-4">${links.join('')}</div>`;
  }

  function contactCard(o) {
    const hasContact = o.contact_email || o.contact_phone || o.website_url || o.address;
    if (!hasContact) return '';
    return `
      <div class="rounded-xl border border-archive-line bg-white p-5">
        <p class="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-archive-gold">Contact</p>
        <dl class="grid gap-3 text-sm">
          ${o.contact_email  ? `<div><dt class="text-[10px] font-black uppercase tracking-[0.12em] text-archive-muted">Email</dt><dd class="mt-0.5"><a href="mailto:${escapeHtml(o.contact_email)}" class="font-bold text-archive-green underline underline-offset-4 break-all">${escapeHtml(o.contact_email)}</a></dd></div>` : ''}
          ${o.contact_phone  ? `<div><dt class="text-[10px] font-black uppercase tracking-[0.12em] text-archive-muted">Phone / WhatsApp</dt><dd class="mt-0.5 font-bold text-archive-ink">${escapeHtml(o.contact_phone)}</dd></div>` : ''}
          ${o.website_url    ? `<div><dt class="text-[10px] font-black uppercase tracking-[0.12em] text-archive-muted">Website</dt><dd class="mt-0.5"><a href="${escapeHtml(o.website_url)}" target="_blank" rel="noopener" class="font-bold text-archive-green underline underline-offset-4 break-all">${escapeHtml(o.website_url.replace(/^https?:\/\//, ''))}</a></dd></div>` : ''}
          ${o.address        ? `<div><dt class="text-[10px] font-black uppercase tracking-[0.12em] text-archive-muted">Address</dt><dd class="mt-0.5 text-archive-muted">${escapeHtml(o.address)}</dd></div>` : ''}
        </dl>
      </div>`;
  }

  function eventCard(ev, today) {
    const dateStr = ev.event_date || '';
    const isPast  = dateStr && dateStr < today;
    let dateHtml = '';
    if (dateStr) {
      const d = new Date(dateStr + 'T00:00:00');
      if (!isNaN(d)) {
        dateHtml = `<div class="shrink-0 flex flex-col items-center justify-center bg-archive-green px-4 py-3 text-center min-w-[56px]">
          <span class="text-xl font-black text-white leading-none">${d.getDate()}</span>
          <span class="text-[10px] font-bold uppercase text-archive-goldSoft">${d.toLocaleString('en-GB',{month:'short'}).toUpperCase()}</span>
          <span class="text-[10px] text-archive-paper/70">${d.getFullYear()}</span>
        </div>`;
      }
    }
    const regLink = ev.registration_url || ev.url;
    return `
      <div class="flex overflow-hidden border border-archive-line bg-white${isPast ? ' opacity-70' : ''}">
        ${dateHtml}
        <div class="flex flex-1 flex-col p-4 min-w-0">
          <div class="flex flex-wrap gap-1.5">
            ${isPast ? `<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase bg-archive-paper text-archive-muted">Past</span>` : `<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase bg-green-100 text-green-800">Upcoming</span>`}
            ${ev.event_type === 'webinar' ? `<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase bg-archive-goldSoft text-archive-ink">Online</span>` : ''}
            ${ev.category ? `<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase border border-archive-line text-archive-muted">${escapeHtml(ev.category)}</span>` : ''}
          </div>
          <h3 class="mt-2 font-display text-base font-bold text-archive-green">${escapeHtml(ev.title)}</h3>
          ${ev.description ? `<p class="mt-1 line-clamp-2 text-xs leading-5 text-archive-muted">${escapeHtml(ev.description)}</p>` : ''}
          ${regLink && !isPast ? `<a href="${escapeHtml(regLink)}" target="_blank" rel="noopener" class="mt-2 inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.08em] text-archive-gold hover:underline">Register →</a>` : ''}
        </div>
      </div>`;
  }

  function videoCard(v) {
    const dateStr = v.video_date || '';
    let dateLabel = '';
    if (dateStr) {
      const d = new Date(dateStr + 'T00:00:00');
      if (!isNaN(d)) dateLabel = d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
    }
    return `
      <a href="${escapeHtml(v.url || '#')}" target="_blank" rel="noopener"
        class="flex flex-col border border-archive-line bg-white p-4 hover:shadow-soft transition-shadow">
        <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-archive-green text-archive-cream">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M6 4l7 4-7 4V4z"/></svg>
        </div>
        <p class="font-bold text-archive-green line-clamp-2 leading-snug">${escapeHtml(v.title)}</p>
        ${v.category ? `<p class="mt-1 text-[10px] font-black uppercase tracking-[0.1em] text-archive-gold">${escapeHtml(v.category)}</p>` : ''}
        ${dateLabel  ? `<p class="mt-auto pt-2 text-xs text-archive-muted">${dateLabel}</p>` : ''}
      </a>`;
  }

  function renderError(msg) {
    main.innerHTML = `
      <section class="bg-archive-green py-10 md:py-14">
        <div class="mx-auto w-[min(1120px,calc(100%-36px))]">
          <p class="text-xs font-black uppercase tracking-[0.18em] text-archive-goldSoft">
            <a href="/organizations/" class="hover:text-archive-cream transition-colors">Organizations</a>
          </p>
          <h1 class="mt-3 font-display text-3xl font-bold text-white">${escapeHtml(msg)}</h1>
        </div>
      </section>
      <div class="mx-auto w-[min(1120px,calc(100%-36px))] py-12">
        <a href="/organizations/" class="text-sm font-bold text-archive-green underline underline-offset-4">← Back to all organizations</a>
      </div>`;
  }

  function escapeHtml(v) { return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
})();
