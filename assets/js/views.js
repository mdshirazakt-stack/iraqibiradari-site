// Page-view counters (Supabase table `page_views`, see
// supabase/page_views_migration.sql). Uses plain fetch against the REST API so
// no SDK has to load on every page. Every function fails quietly: if the
// database is slow or the table is missing, pages simply show no counts.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const REST    = `${SUPABASE_URL}/rest/v1`;
const HEADERS = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
const BOT_UA  = /bot|crawl|spider|slurp|headless|lighthouse|preview/i;

/** An item must have at least this many views before it can wear the "Most read" ribbon. */
export const MIN_VIEWS_FOR_MOST_READ = 20;
/** At most this many items per page get the ribbon. */
export const MOST_READ_LIMIT = 3;

export function fmt(n) { return Number(n).toLocaleString('en-IN'); }

const EYE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;display:inline-block;vertical-align:-2px;margin-right:4px" aria-hidden="true"><path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/><path fill-rule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" clip-rule="evenodd"/></svg>';

/** "👁 1,240 views" (unit is the singular word: 'view' or 'read'). Empty when there are no views. */
export function countLabel(n, unit) {
  return n > 0 ? `${EYE}${fmt(n)} ${unit}${n === 1 ? '' : 's'}` : '';
}

function escapeHtml(v) {
  return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function isBot() { return !!navigator.webdriver || BOT_UA.test(navigator.userAgent || ''); }

// ── Opt out of being counted (for the site owner) ───────────────────────
// Visit any page with ?notrack on the end (once per device/browser) to stop
// counting that browser; ?track turns counting back on. The same switch also
// pauses Umami and GoatCounter using their own documented flags.
const OPT_OUT_KEY = 'ib_notrack';
function optedOut() { try { return localStorage.getItem(OPT_OUT_KEY) === '1'; } catch { return false; } }

function showToast(text) {
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.textContent = text;
  el.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:9999;max-width:min(92vw,460px);background:#17130f;color:#fbf7ed;padding:12px 16px;border-radius:8px;font:600 14px/1.5 Lato,Arial,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35)';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 7000);
}

function applyOptOutLink() {
  try {
    const url = new URL(location.href);
    const off = url.searchParams.has('notrack');
    const on  = url.searchParams.has('track');
    if (!off && !on) return;
    if (off) {
      localStorage.setItem(OPT_OUT_KEY, '1');
      localStorage.setItem('umami.disabled', '1');
      localStorage.setItem('skipgc', 't');
    } else {
      localStorage.removeItem(OPT_OUT_KEY);
      localStorage.removeItem('umami.disabled');
      localStorage.removeItem('skipgc');
    }
    url.searchParams.delete('notrack');
    url.searchParams.delete('track');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    showToast(off
      ? 'Done — your visits on this device are no longer counted. To undo, open this site with ?track at the end of the address.'
      : 'Done — your visits on this device are counted again.');
  } catch { /* storage blocked: nothing to do */ }
}
applyOptOutLink();
function seenKey(kind, id) { return `ib_viewed:${kind}:${id}`; }
function wasSeen(kind, id) { try { return sessionStorage.getItem(seenKey(kind, id)) === '1'; } catch { return false; } }
function markSeen(kind, id) { try { sessionStorage.setItem(seenKey(kind, id), '1'); } catch { /* private mode */ } }

async function fetchJson(url, options) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(url, { ...options, signal: ctl.signal });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally { clearTimeout(timer); }
}

/** Current count for one page (0 if it has no row yet), or null on failure. */
export async function getCount(kind, id) {
  try {
    const rows = await fetchJson(
      `${REST}/page_views?kind=eq.${encodeURIComponent(kind)}&item_id=eq.${encodeURIComponent(id)}&select=views`,
      { headers: HEADERS });
    return rows?.[0]?.views ?? 0;
  } catch { return null; }
}

/** Map of item_id → views for one kind. Empty map on failure. */
export async function getAllCounts(kind) {
  try {
    const rows = await fetchJson(
      `${REST}/page_views?kind=eq.${encodeURIComponent(kind)}&select=item_id,views`,
      { headers: HEADERS });
    return new Map((rows || []).map(r => [r.item_id, Number(r.views) || 0]));
  } catch { return new Map(); }
}

/**
 * Counts one view (once per browser session per page; not for obvious bots)
 * and returns the current total, or null if unavailable.
 */
export async function recordView(kind, id) {
  try {
    if (!isBot() && !optedOut() && !wasSeen(kind, id)) {
      markSeen(kind, id);
      const n = await fetchJson(`${REST}/rpc/record_view`, {
        method: 'POST',
        headers: { ...HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_kind: kind, p_id: id }),
      });
      if (typeof n === 'number') return n;
    }
  } catch { /* fall through to a plain read */ }
  return getCount(kind, id);
}

/** Counts a site visit (once per session, from whichever page the visitor lands on) and fills any [data-site-visits]. */
export async function trackSiteVisit() {
  const n = await recordView('site', 'home');
  if (n == null) return;
  document.querySelectorAll('[data-site-visits]').forEach(el => {
    const slot = el.querySelector('[data-count]');
    if (slot) slot.textContent = fmt(n);
    el.hidden = false;
  });
}

/** Shows "👁 N views" (or reads) quietly at the bottom of the dark footer. */
export function showFooterViews(n, unit = 'view') {
  if (!(n > 0)) return;
  const footer = document.querySelector('footer');
  if (!footer) return;
  let el = footer.querySelector('[data-page-views]');
  if (!el) {
    el = document.createElement('div');
    el.setAttribute('data-page-views', '');
    el.className = 'mx-auto mt-5 w-[min(1120px,calc(100%-36px))] border-t border-white/10 pt-3 text-xs text-[#8f8577]';
    footer.appendChild(el);
  }
  el.innerHTML = countLabel(n, unit);
}

// Detail pages (an Achiever, a story, an obituary…) count themselves, by item.
const DETAIL_PATH = /^\/(people|culture|obituaries|events|announcements|organizations)\/detail\//;

/** Counts a view of an ordinary page (About, People, Stories, Obituaries…) and shows its total in the footer. */
export function trackPageView() {
  const raw = location.pathname;
  if (raw === '/' || raw.startsWith('/admin') || DETAIL_PATH.test(raw)) return null;
  const path = raw.endsWith('/') ? raw : `${raw}/`;
  return recordView('page', path).then(n => { showFooterViews(n, 'view'); return n; });
}

/** Ids of the items that should wear the "Most read" ribbon (top few, each with enough views). */
export function mostReadIds(items, counts) {
  return new Set(
    items
      .map((item, i) => ({ id: item.id, i, n: counts.get(item.id) || 0 }))
      .filter(r => r.n >= MIN_VIEWS_FOR_MOST_READ)
      .sort((a, b) => b.n - a.n || a.i - b.i)
      .slice(0, MOST_READ_LIMIT)
      .map(r => r.id)
  );
}

/** Extra border classes for a tile that has the ribbon. */
export const MOST_READ_BORDER = 'border-archive-gold ring-1 ring-archive-gold';

/** Diagonal corner ribbon. The tile must be `relative overflow-hidden`. */
export function mostReadRibbon(compact = false) {
  const size = compact
    ? 'top-[18px] right-[-34px] w-[120px] py-[3px] text-[9px] tracking-[0.12em]'
    : 'top-[22px] right-[-40px] w-[150px] py-[5px] text-[10px] tracking-[0.16em]';
  return `<span class="pointer-events-none absolute z-10 rotate-45 bg-[#8a6b27] text-center font-black uppercase text-white shadow ${size}">Most read</span>`;
}
