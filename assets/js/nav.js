import { createSupabaseClient } from './supabase-config.js';

const P = window.location.pathname.replace(/\/$/, '') || '/';

const GROUPS = [
  { label: 'About', href: '/about/' },
  {
    label: 'Community',
    pages: ['/announcements', '/events', '/people'],
    children: [
      { label: 'Announcements', href: '/announcements/' },
      { label: 'Events', href: '/events/' },
      { label: 'Achievers', href: '/people/' },
    ],
  },
  {
    label: 'Heritage',
    pages: ['/documents', '/culture'],
    children: [
      { label: 'Documents', href: '/documents/' },
      { label: 'Our Culture', href: '/culture/' },
      { label: 'Shajra', href: 'https://apnonkitalash.com/', external: true },
    ],
  },
  { label: 'Organizations', href: '/organizations/' },
  { label: 'Matrimony', href: '/matrimony/' },
  { label: 'Support Us', href: '/contact/' },
];

function isActive(href) {
  if (!href || href.startsWith('http')) return false;
  const h = href.replace(/\/$/, '');
  return h === '' ? P === '/' : P === h || P.startsWith(h + '/');
}

function groupActive(item) {
  if (item.href) return isActive(item.href);
  return (item.pages || []).some(p => P === p || P.startsWith(p + '/'));
}

const CHEVRON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;flex-shrink:0;transition:transform .2s" aria-hidden="true"><path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z" clip-rule="evenodd"/></svg>`;
const HAMBURGER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

function desktopItem(item) {
  const on = groupActive(item);
  const base = 'text-xs font-black uppercase tracking-[0.12em] transition-colors';
  const color = on ? 'text-archive-green' : 'text-archive-muted hover:text-archive-green';

  if (item.children) {
    const links = item.children.map(c => {
      const ca = isActive(c.href);
      const ext = c.external ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${c.href}"${ext} role="menuitem" class="block px-4 py-3 text-xs font-black uppercase tracking-[0.1em] transition-colors hover:bg-archive-cream hover:text-archive-green${ca ? ' bg-archive-cream text-archive-green' : ' text-archive-muted'}">${c.label}</a>`;
    }).join('');
    return `<div class="relative" data-desktop-group>
      <button type="button" data-group-btn class="flex items-center gap-1 rounded px-3 py-2 ${base} ${color}" aria-haspopup="true" aria-expanded="false">${item.label}${CHEVRON}</button>
      <div data-dropdown role="menu" style="display:none;position:absolute;right:0;top:100%;z-index:50;margin-top:4px;min-width:200px;background:#fff;border:1px solid #ded2bc;padding:4px 0;box-shadow:0 18px 45px rgba(32,28,23,.12)">${links}</div>
    </div>`;
  }

  const ext = item.external ? ' target="_blank" rel="noopener"' : '';
  const labelHtml = item.badge
    ? `<span style="position:relative;display:inline-block"><span style="position:absolute;top:-9px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:1px 5px;border-radius:999px;font-size:8px;font-weight:900;letter-spacing:.06em;background:#b99045;color:#fff;line-height:1.7;pointer-events:none">${item.badge}</span>${item.label}</span>`
    : item.label;
  return `<a href="${item.href}"${ext} class="rounded px-3 pt-4 pb-2 ${base} ${color}">${labelHtml}</a>`;
}

function mobileItem(item) {
  const on = groupActive(item);
  const color = on ? 'text-archive-green' : 'text-archive-muted';

  if (item.children) {
    const links = item.children.map(c => {
      const ca = isActive(c.href);
      const ext = c.external ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${c.href}"${ext} class="flex items-center py-3.5 pl-5 text-sm font-bold transition-colors hover:text-archive-green${ca ? ' text-archive-green' : ' text-archive-muted'}">${c.label}</a>`;
    }).join('');
    return `<div data-mobile-group style="border-bottom:1px solid #ded2bc">
      <button type="button" data-mobile-group-btn class="flex w-full items-center justify-between py-4 text-left text-xs font-black uppercase tracking-[0.12em] transition-colors hover:text-archive-green ${color}">${item.label}<span data-chevron style="display:inline-flex;transform:${on ? 'rotate(180deg)' : 'rotate(0deg)'};transition:transform .2s">${CHEVRON}</span></button>
      <div data-mobile-group-content style="display:${on ? 'block' : 'none'};margin-top:-4px;padding-bottom:4px">${links}</div>
    </div>`;
  }

  const ext = item.external ? ' target="_blank" rel="noopener"' : '';
  const labelHtml = item.badge
    ? `<span style="position:relative;display:inline-block"><span style="position:absolute;top:-9px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:1px 5px;border-radius:999px;font-size:8px;font-weight:900;letter-spacing:.06em;background:#b99045;color:#fff;line-height:1.7;pointer-events:none">${item.badge}</span>${item.label}</span>`
    : item.label;
  return `<a href="${item.href}"${ext} style="display:block;border-bottom:1px solid #ded2bc;padding:20px 0 16px" class="text-xs font-black uppercase tracking-[0.12em] transition-colors hover:text-archive-green ${color}">${labelHtml}</a>`;
}

function inject() {
  const desktop = GROUPS.map(desktopItem).join('');
  const mobile = GROUPS.map(mobileItem).join('');

  document.body.insertAdjacentHTML('afterbegin', `
    <style>.brand-mark{mix-blend-mode:multiply;filter:drop-shadow(0 2px 5px rgba(32,28,23,.12));}</style>

    <div class="bg-archive-maroon text-archive-cream">
      <div class="mx-auto flex min-h-11 w-[min(1120px,calc(100%-36px))] flex-col justify-center gap-1 py-2 text-sm md:flex-row md:items-center md:justify-between md:gap-6">
        <p id="event-ribbon" class="font-bold">Upcoming Events: No upcoming events. Keep a watch.</p>
        <a class="shrink-0 font-bold" href="tel:+918789034923">+91 87890 34923</a>
      </div>
    </div>

    <header class="sticky top-0 z-30 border-b border-archive-line bg-archive-cream/95 shadow-soft backdrop-blur">
      <div class="mx-auto flex w-[min(1120px,calc(100%-36px))] items-center justify-between py-3 lg:py-4">
        <a href="/" class="flex items-center gap-3" aria-label="Iraqi Biradari home">
          <img class="brand-mark h-11 w-11 rounded object-cover" src="/Iraquibiradari-final-logo-2.png" alt="Iraqi Biradari logo"/>
          <span class="flex flex-col">
            <span class="font-display text-3xl font-bold leading-none text-archive-green lg:text-4xl">Iraqi Biradari</span>
            <span class="mt-0.5 hidden text-xs font-black uppercase tracking-[0.18em] text-archive-muted sm:block">Heritage Platform</span>
          </span>
        </a>
        <nav class="hidden items-center gap-0.5 lg:flex" aria-label="Main navigation">${desktop}</nav>
        <button id="nav-open" type="button" class="flex h-11 w-11 items-center justify-center rounded text-archive-green lg:hidden" aria-label="Open navigation menu" aria-expanded="false">${HAMBURGER}</button>
      </div>
    </header>

    <div id="nav-overlay" style="display:none;position:fixed;inset:0;z-index:40;background:rgba(32,28,23,.5);opacity:0;transition:opacity .3s" aria-hidden="true"></div>

    <aside id="nav-drawer" style="position:fixed;inset-block:0;left:0;z-index:50;display:flex;width:min(340px,85vw);flex-direction:column;background:#fbf7ed;box-shadow:0 25px 50px -12px rgba(0,0,0,.25);transform:translateX(-100%);transition:transform .3s ease-in-out" aria-label="Site navigation" aria-hidden="true">
      <div class="flex shrink-0 items-center justify-between border-b border-archive-line px-5 py-4">
        <a href="/" class="font-display text-2xl font-bold text-archive-green">Iraqi Biradari</a>
        <button id="nav-close" type="button" class="flex h-10 w-10 items-center justify-center rounded text-archive-muted hover:text-archive-green" aria-label="Close navigation menu">${CLOSE_ICON}</button>
      </div>
      <nav class="flex-1 overflow-y-auto px-5 py-4" aria-label="Navigation menu">${mobile}</nav>
      <div class="shrink-0 border-t border-archive-line px-5 py-4">
        <a href="/admin/" class="text-xs font-black uppercase tracking-[0.12em] text-archive-muted hover:text-archive-green">Admin Panel</a>
      </div>
    </aside>
  `);

  wire();
  loadRibbon();
}

function wire() {
  const openBtn = document.getElementById('nav-open');
  const closeBtn = document.getElementById('nav-close');
  const overlay = document.getElementById('nav-overlay');
  const drawer = document.getElementById('nav-drawer');

  const show = () => {
    drawer.style.transform = 'translateX(0)';
    overlay.style.display = 'block';
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });
    drawer.setAttribute('aria-hidden', 'false');
    openBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };

  const hide = () => {
    drawer.style.transform = 'translateX(-100%)';
    overlay.style.opacity = '0';
    setTimeout(() => { if (overlay.style.opacity === '0') overlay.style.display = 'none'; }, 300);
    drawer.setAttribute('aria-hidden', 'true');
    openBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  openBtn?.addEventListener('click', show);
  closeBtn?.addEventListener('click', hide);
  overlay?.addEventListener('click', hide);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { hide(); closeDropdowns(); } });

  document.querySelectorAll('[data-mobile-group-btn]').forEach(btn => {
    btn.addEventListener('click', () => {
      const g = btn.closest('[data-mobile-group]');
      const content = g.querySelector('[data-mobile-group-content]');
      const chevron = g.querySelector('[data-chevron]');
      const opening = content.style.display === 'none' || !content.style.display;
      content.style.display = opening ? 'block' : 'none';
      chevron.style.transform = opening ? 'rotate(180deg)' : 'rotate(0deg)';
    });
  });

  document.querySelectorAll('[data-desktop-group]').forEach(g => {
    const btn = g.querySelector('[data-group-btn]');
    const dd = g.querySelector('[data-dropdown]');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const wasOpen = dd.style.display !== 'none';
      closeDropdowns();
      if (!wasOpen) {
        dd.style.display = 'block';
        btn.setAttribute('aria-expanded', 'true');
        const svg = btn.querySelector('svg');
        if (svg) svg.style.transform = 'rotate(180deg)';
      }
    });
  });

  document.addEventListener('click', closeDropdowns);
}

function closeDropdowns() {
  document.querySelectorAll('[data-desktop-group]').forEach(g => {
    const dd = g.querySelector('[data-dropdown]');
    if (dd) dd.style.display = 'none';
    const btn = g.querySelector('[data-group-btn]');
    btn?.setAttribute('aria-expanded', 'false');
    const svg = btn?.querySelector('svg');
    if (svg) svg.style.transform = 'rotate(0deg)';
  });
}

async function loadRibbon() {
  const el = document.getElementById('event-ribbon');
  if (!el) return;
  try {
    const supabase = await createSupabaseClient();
    const { data } = await supabase
      .from('events')
      .select('id, title, registration_url, video_url, event_date')
      .eq('published', true)
      .eq('ribbon', true)
      .order('event_date', { ascending: true, nullsFirst: false })
      .limit(1);
    const ev = data?.[0];
    if (!ev) return;
    const a = document.createElement('a');
    a.className = 'font-bold underline decoration-archive-goldSoft underline-offset-4';
    if (ev.registration_url) {
      a.href = ev.registration_url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = `Upcoming: ${ev.title} — Register`;
    } else if (ev.video_url) {
      a.href = ev.video_url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = `Watch: ${ev.title}`;
    } else {
      a.href = `/events/detail/?id=${encodeURIComponent(ev.id)}`;
      a.textContent = ev.title;
    }
    el.replaceWith(a);
  } catch { /* show default text */ }
}

inject();
