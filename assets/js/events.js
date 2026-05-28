import { createSupabaseClient, withTimeout } from './supabase-config.js';

(async function () {
  const container  = document.getElementById('events-container');
  if (!container) return;

  let supabase;
  try {
    supabase = await createSupabaseClient();
  } catch (err) {
    container.innerHTML = `<p class="py-8 text-sm text-archive-muted">Could not connect — ${escapeHtml(String(err))}</p>`;
    return;
  }

  // ── State ────────────────────────────────────────────────────────────
  let allEvents  = [];
  let period     = 'upcoming'; // 'upcoming' | 'past'
  let typeFilter = 'all';      // 'all' | 'live' | 'webinar'

  const today = new Date().toISOString().slice(0, 10);

  // ── Button wiring ─────────────────────────────────────────────────────
  const periodBtns = Array.from(document.querySelectorAll('[data-period]'));
  const filterBtns = Array.from(document.querySelectorAll('[data-filter]'));

  periodBtns.forEach(btn => btn.addEventListener('click', () => {
    period = btn.dataset.period;
    updatePeriodButtons();
    render();
  }));

  filterBtns.forEach(btn => btn.addEventListener('click', () => {
    typeFilter = btn.dataset.filter;
    updateFilterButtons();
    render();
  }));

  updatePeriodButtons();
  updateFilterButtons();

  // ── Load data ─────────────────────────────────────────────────────────
  let data, error;
  try {
    ({ data, error } = await withTimeout(
      supabase
        .from('events')
        .select('id, title, description, event_type, event_date, location, registration_url, video_url, category')
        .eq('published', true)
        .is('org_id', null)          // org-linked events belong on the org page, not here
        .order('event_date', { ascending: true, nullsFirst: false })
        .order('sort_order', { ascending: false })
    ));
  } catch (err) {
    container.innerHTML = `<p class="py-8 text-sm text-archive-muted">⏱ ${escapeHtml(err.message)} — <button type="button" onclick="location.reload()" class="font-bold text-archive-green underline underline-offset-2 hover:text-archive-gold">Try again</button></p>`;
    return;
  }

  if (error) {
    container.innerHTML = `<p class="py-8 text-sm text-archive-muted">${escapeHtml(error.message)}</p>`;
    return;
  }

  allEvents = data || [];
  render();

  // ── Render ────────────────────────────────────────────────────────────
  function render() {
    const filtered = allEvents.filter(ev => {
      const evDate  = ev.event_date || '';
      const inPeriod = period === 'upcoming'
        ? (!evDate || evDate >= today)
        : (evDate && evDate < today);
      const inType = typeFilter === 'all' || ev.event_type === typeFilter;
      return inPeriod && inType;
    });

    // Past events: most recent first
    if (period === 'past') {
      filtered.sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''));
    }

    const typeLabel = typeFilter === 'live' ? 'in-person ' : typeFilter === 'webinar' ? 'online ' : '';
    const altPeriod = period === 'upcoming' ? 'past' : 'upcoming';

    if (!filtered.length) {
      container.innerHTML = `
        <div class="border border-archive-line bg-white p-10 text-center">
          <p class="font-display text-2xl font-bold text-archive-green">No ${period} ${typeLabel}events</p>
          <p class="mt-2 text-sm text-archive-muted">
            Check back soon, or
            <button type="button" class="font-bold text-archive-green underline underline-offset-2 hover:text-archive-gold" data-switch-period="${altPeriod}">
              browse ${altPeriod} events
            </button>.
          </p>
        </div>`;
      container.querySelector('[data-switch-period]')?.addEventListener('click', e => {
        period = e.currentTarget.dataset.switchPeriod;
        updatePeriodButtons();
        render();
      });
      return;
    }

    container.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b-2 border-archive-gold">
              <th class="pb-3 pr-6 text-left text-xs font-black uppercase tracking-[0.12em] text-archive-gold whitespace-nowrap">Date</th>
              <th class="pb-3 pr-4 text-left text-xs font-black uppercase tracking-[0.12em] text-archive-gold">Event</th>
              <th class="hidden md:table-cell pb-3 pr-6 text-left text-xs font-black uppercase tracking-[0.12em] text-archive-gold">Location</th>
              <th class="hidden sm:table-cell pb-3 pr-6 text-left text-xs font-black uppercase tracking-[0.12em] text-archive-gold whitespace-nowrap">Type</th>
              <th class="pb-3 text-left text-xs font-black uppercase tracking-[0.12em] text-archive-gold whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(renderRow).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function renderRow(ev) {
    const dateStr      = ev.event_date ? formatDate(ev.event_date) : '—';
    const isWebinar    = ev.event_type === 'webinar';
    const typeLabel    = isWebinar ? 'Online' : 'In-person';
    const typeCls      = isWebinar ? 'bg-archive-goldSoft text-archive-ink' : 'bg-archive-green text-archive-cream';
    const typeBadge    = `<span class="inline-block px-2 py-0.5 text-xs font-black uppercase tracking-wide ${typeCls}">${typeLabel}</span>`;
    const locationText = ev.location || (isWebinar ? 'Online' : '—');
    const detailUrl    = `/events/detail/?id=${encodeURIComponent(ev.id)}`;

    // Primary CTA
    let cta = '';
    if (period === 'upcoming' && ev.registration_url) {
      cta = `<a href="${escapeHtml(ev.registration_url)}" target="_blank" rel="noopener"
        class="inline-block bg-archive-gold px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-archive-ink whitespace-nowrap">Register</a>`;
    } else if (ev.video_url) {
      cta = `<a href="${escapeHtml(ev.video_url)}" target="_blank" rel="noopener"
        class="inline-block border border-archive-green px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-archive-green whitespace-nowrap">Watch</a>`;
    }

    return `
      <tr class="border-b border-archive-line transition-colors hover:bg-archive-paper">
        <td class="py-4 pr-6 align-top">
          <span class="whitespace-nowrap text-sm font-bold text-archive-muted">${dateStr}</span>
        </td>
        <td class="py-4 pr-4 align-top">
          <a href="${detailUrl}"
            class="block font-black leading-snug text-archive-green transition-colors hover:text-archive-gold"
            style="font-size:1rem">
            ${escapeHtml(ev.title)}
          </a>
          ${ev.description
            ? `<p class="mt-1 line-clamp-2 text-sm leading-6 text-archive-muted">${escapeHtml(ev.description)}</p>`
            : ''}
          <!-- Sub-row shown only below md (location) and below sm (type badge) -->
          <div class="mt-1.5 flex flex-wrap items-center gap-2" style="display:none" data-mobile-meta>
            <span class="text-xs text-archive-muted">${escapeHtml(locationText)}</span>
            <span data-type-inline>${typeBadge}</span>
          </div>
        </td>
        <td class="hidden md:table-cell py-4 pr-6 align-top text-sm text-archive-muted">${escapeHtml(locationText)}</td>
        <td class="hidden sm:table-cell py-4 pr-6 align-top">${typeBadge}</td>
        <td class="py-4 align-top">
          <div class="flex flex-col items-start gap-2">
            ${cta}
            <a href="${detailUrl}"
              class="text-xs font-bold text-archive-muted underline underline-offset-2 transition-colors hover:text-archive-green whitespace-nowrap">
              Details
            </a>
          </div>
        </td>
      </tr>`;
  }

  // ── Button styling ────────────────────────────────────────────────────
  function updatePeriodButtons() {
    periodBtns.forEach(btn => {
      const active = btn.dataset.period === period;
      btn.className = active
        ? 'min-h-9 px-5 text-xs font-black uppercase tracking-[0.1em] bg-archive-green text-archive-cream'
        : 'min-h-9 px-5 text-xs font-black uppercase tracking-[0.1em] border border-archive-line text-archive-muted hover:text-archive-green hover:border-archive-green';
    });
  }

  function updateFilterButtons() {
    filterBtns.forEach(btn => {
      const active = btn.dataset.filter === typeFilter;
      btn.className = active
        ? 'min-h-8 px-4 text-xs font-black uppercase tracking-[0.1em] bg-archive-gold text-archive-ink'
        : 'min-h-8 px-4 text-xs font-black uppercase tracking-[0.1em] border border-archive-line text-archive-muted hover:text-archive-green hover:border-archive-green';
    });
  }

  // After render, wire up mobile meta visibility via ResizeObserver or just CSS classes
  // We use a MutationObserver approach: show/hide the mobile meta divs based on viewport
  function applyMobileMetaVisibility() {
    const isMobile  = window.innerWidth < 640;  // below sm
    const isBelowMd = window.innerWidth < 768;  // below md
    document.querySelectorAll('[data-mobile-meta]').forEach(el => {
      el.style.display = isBelowMd ? 'flex' : 'none';
    });
    document.querySelectorAll('[data-type-inline]').forEach(el => {
      el.style.display = isMobile ? 'inline' : 'none';
    });
  }

  // Re-apply on resize and after render
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyMobileMetaVisibility, 60);
  });

  // Observe container mutations (re-apply after render)
  const observer = new MutationObserver(applyMobileMetaVisibility);
  observer.observe(container, { childList: true, subtree: false });
  applyMobileMetaVisibility();

  // ── Utilities ─────────────────────────────────────────────────────────
  function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d} ${months[m - 1]} ${y}`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
})();
