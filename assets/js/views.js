// Page-view counters (Supabase table `page_views`, see
// supabase/page_views_migration.sql). Uses plain fetch against the REST API so
// no SDK has to load on every page. Every function fails quietly: if the
// database is slow or the table is missing, pages simply show no counts.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const REST    = `${SUPABASE_URL}/rest/v1`;
const HEADERS = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
const BOT_UA  = /bot|crawl|spider|slurp|headless|lighthouse|preview/i;

/** "Most read / viewed" strip only appears once at least this many items have views. */
export const MIN_ITEMS_FOR_STRIP = 3;

export const EYE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;display:inline-block;vertical-align:-2px;margin-right:4px" aria-hidden="true"><path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/><path fill-rule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" clip-rule="evenodd"/></svg>';

export function fmt(n) { return Number(n).toLocaleString('en-IN'); }

function escapeHtml(v) {
  return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function isBot() { return !!navigator.webdriver || BOT_UA.test(navigator.userAgent || ''); }
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
    if (!isBot() && !wasSeen(kind, id)) {
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

/** Small "👁 1,240 views" label (empty string when there are no views yet). */
export function countLabel(n, unit) {
  return n > 0 ? `${EYE}${fmt(n)} ${unit}` : '';
}

/**
 * HTML for the "Most viewed / Most read" strip, or '' if too few items have views.
 * items: published items, in display order. opts: { title, unit, urlFor(item), subFor(item) }
 */
export function mostViewedStrip(items, counts, opts) {
  const ranked = items
    .map((item, i) => ({ item, i, n: counts.get(item.id) || 0 }))
    .filter(r => r.n > 0);
  if (ranked.length < MIN_ITEMS_FOR_STRIP) return '';
  ranked.sort((a, b) => b.n - a.n || a.i - b.i);
  const cards = ranked.slice(0, 3).map((r, idx) => {
    const sub = opts.subFor ? opts.subFor(r.item) : '';
    return `
      <a href="${escapeHtml(opts.urlFor(r.item))}"
        class="group flex items-start gap-3 border border-archive-line bg-white p-4 transition-shadow hover:shadow-soft">
        <span class="font-display text-4xl font-bold leading-none text-archive-gold">${idx + 1}</span>
        <span class="min-w-0">
          <span class="block font-display text-lg font-bold leading-snug text-archive-green transition-colors group-hover:text-archive-gold">${escapeHtml(r.item.title)}</span>
          <span class="mt-1 block text-xs font-bold text-archive-muted">${sub ? `${escapeHtml(sub)} · ` : ''}${countLabel(r.n, opts.unit)}</span>
        </span>
      </a>`;
  }).join('');
  return `
    <section class="mb-8 border border-archive-gold bg-[#fbf3dc] p-5" aria-label="${escapeHtml(opts.title)}">
      <p class="text-xs font-black uppercase tracking-[0.18em] text-archive-gold">${escapeHtml(opts.title)}</p>
      <div class="mt-3 grid gap-3 md:grid-cols-3">${cards}</div>
    </section>`;
}
