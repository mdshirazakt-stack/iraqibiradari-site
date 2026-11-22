// Thumbs up/down + threaded comments for Achiever profiles and Culture stories.
// Backed by Supabase functions in supabase/comments_migration.sql, called with
// plain fetch (no SDK). If the database is unreachable or the SQL has not been
// run, the whole section hides itself and the page works as before.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const RPC     = `${SUPABASE_URL}/rest/v1/rpc`;
const HEADERS = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' };
const CID_KEY  = 'ib_client_id';
const NAME_KEY = 'ib_comment_name';
const MAX_BODY = 2000;
const FLAT_FROM_DEPTH = 3;   // replies nested deeper than this stop indenting further

let memClient = null;
function clientId() {
  try {
    let v = localStorage.getItem(CID_KEY);
    if (!v) {
      v = (crypto.randomUUID ? crypto.randomUUID() : `c${Date.now()}${Math.random().toString(16).slice(2)}`);
      localStorage.setItem(CID_KEY, v);
    }
    return v;
  } catch {
    return memClient || (memClient = `c${Date.now()}${Math.random().toString(16).slice(2)}`);
  }
}
function savedName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }
function saveName(n) { try { localStorage.setItem(NAME_KEY, n); } catch { /* private mode */ } }

async function rpc(fn, args) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await fetch(`${RPC}/${fn}`, { method: 'POST', headers: HEADERS, body: JSON.stringify(args), signal: ctl.signal });
    if (!res.ok) {
      let msg = 'Something went wrong. Please try again.';
      try { const j = await res.json(); if (j?.code === 'P0001' && j.message) msg = j.message; } catch { /* keep default */ }
      throw new Error(msg);
    }
    return res.status === 204 ? null : await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('The request timed out. Please try again.');
    throw err;
  } finally { clearTimeout(timer); }
}

function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)      return 'just now';
  if (s < 3600)    return `${Math.floor(s / 60)} min ago`;
  if (s < 86400)   return `${Math.floor(s / 3600)} hr ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} day${Math.floor(s / 86400) === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const INPUT_CLS = 'w-full border border-archive-line bg-white px-3 py-2 text-sm text-archive-ink focus:border-archive-green focus:outline-none';
const PRIMARY   = 'bg-archive-green px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-archive-cream hover:bg-archive-gold hover:text-archive-ink disabled:opacity-50';
const LINK_BTN  = 'text-xs font-bold text-archive-muted underline-offset-2 hover:text-archive-green hover:underline';

export async function mountEngagement(root, kind, itemId) {
  if (!root) return;
  const cid = clientId();
  let data;
  try {
    data = await rpc('get_engagement', { p_kind: kind, p_id: itemId, p_client: cid });
  } catch { data = null; }
  if (!data) { root.hidden = true; return; }

  const state = { item: data.item || { up: 0, down: 0, mine: 0 }, comments: data.comments || [] };
  const ui = { replyTo: null, replyName: savedName(), replyText: '', replyMsg: '', reported: new Set(), busy: false };

  root.innerHTML = `
    <div class="mt-12 border-t border-archive-line pt-8" data-eng-root>
      <div data-eng-reactions></div>
      <h2 class="mt-8 font-display text-2xl font-bold text-archive-green" data-eng-heading></h2>
      <form data-eng-form="main" class="mt-4 grid gap-3 border border-archive-line bg-archive-cream p-4" novalidate>
        <p class="text-xs font-black uppercase tracking-[0.14em] text-archive-gold">Join the conversation</p>
        <label class="grid gap-1 text-xs font-bold text-archive-muted">Your name
          <input name="name" type="text" maxlength="60" autocomplete="name" placeholder="Your name" value="${esc(savedName())}" class="${INPUT_CLS} sm:max-w-xs"/>
        </label>
        <label class="grid gap-1 text-xs font-bold text-archive-muted">Comment
          <textarea name="body" rows="3" maxlength="${MAX_BODY}" placeholder="Share your thoughts or memories…" class="${INPUT_CLS}"></textarea>
        </label>
        <input name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" class="hidden"/>
        <div class="flex flex-wrap items-center gap-3">
          <button type="submit" class="${PRIMARY}">Post comment</button>
          <p class="text-xs text-archive-muted">Comments are public. Please be respectful — moderators may remove comments.</p>
        </div>
        <p data-eng-msg class="text-sm font-bold text-red-700" role="alert"></p>
      </form>
      <div class="mt-6 grid gap-4" data-eng-list></div>
    </div>`;

  const reactionsEl = root.querySelector('[data-eng-reactions]');
  const headingEl   = root.querySelector('[data-eng-heading]');
  const listEl      = root.querySelector('[data-eng-list]');
  const mainForm    = root.querySelector('[data-eng-form="main"]');
  const mainMsg     = root.querySelector('[data-eng-msg]');

  // ── tree helpers ───────────────────────────────────────────────────────
  function childrenOf(parentId) {
    return state.comments.filter(c => (c.parent_id || null) === parentId);
  }
  function hasVisibleDescendant(c) {
    return childrenOf(c.id).some(ch => ch.status === 'visible' || hasVisibleDescendant(ch));
  }
  const visibleCount = () => state.comments.filter(c => c.status === 'visible').length;

  // ── rendering ──────────────────────────────────────────────────────────
  function voteBtn(type, target, value, count, mine, label) {
    const on = mine === value;
    const cls = on
      ? 'border-archive-green bg-archive-green text-archive-cream'
      : 'border-archive-line bg-white text-archive-muted hover:border-archive-green hover:text-archive-green';
    return `<button type="button" data-action="vote" data-type="${type}" data-target="${esc(target)}" data-value="${value}"
      aria-pressed="${on}" aria-label="${label}"
      class="inline-flex min-h-8 items-center gap-1.5 border px-2.5 text-xs font-bold transition-colors ${cls}">${value === 1 ? '👍' : '👎'} <span>${count}</span></button>`;
  }

  function renderReactions() {
    const it = state.item;
    const target = `${kind}:${itemId}`;
    reactionsEl.innerHTML = `
      <div class="flex flex-wrap items-center gap-3 border border-archive-line bg-white px-4 py-3">
        <span class="text-sm font-bold text-archive-muted">Did you find this helpful?</span>
        ${voteBtn('item', target, 1, it.up || 0, it.mine, 'Thumbs up')}
        ${voteBtn('item', target, -1, it.down || 0, it.mine, 'Thumbs down')}
      </div>`;
  }

  function replyFormHtml(c) {
    return `
      <form data-eng-form="reply" data-parent="${esc(c.id)}" class="mt-3 grid gap-2 border border-archive-line bg-archive-cream p-3" novalidate>
        <input name="name" data-field="replyName" type="text" maxlength="60" autocomplete="name" placeholder="Your name" value="${esc(ui.replyName)}" class="${INPUT_CLS} sm:max-w-xs" aria-label="Your name"/>
        <textarea name="body" data-field="replyText" rows="2" maxlength="${MAX_BODY}" placeholder="Write a reply…" class="${INPUT_CLS}" aria-label="Your reply">${esc(ui.replyText)}</textarea>
        <input name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" class="hidden"/>
        <div class="flex flex-wrap items-center gap-3">
          <button type="submit" class="${PRIMARY}">Post reply</button>
          <button type="button" data-action="cancel-reply" class="${LINK_BTN}">Cancel</button>
        </div>
        ${ui.replyMsg ? `<p class="text-sm font-bold text-red-700" role="alert">${esc(ui.replyMsg)}</p>` : ''}
      </form>`;
  }

  function commentHtml(c, depth) {
    const kids = childrenOf(c.id)
      .filter(ch => ch.status === 'visible' || hasVisibleDescendant(ch))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const kidsHtml = kids.length
      ? `<div class="mt-3 grid gap-3 ${depth < FLAT_FROM_DEPTH ? 'border-l-2 border-archive-line pl-3 sm:pl-5' : ''}">${kids.map(k => commentHtml(k, depth + 1)).join('')}</div>`
      : '';

    if (c.status !== 'visible') {
      return `<article id="c-${esc(c.id)}"><p class="text-sm italic text-archive-muted">This comment was removed.</p>${kidsHtml}</article>`;
    }
    const reported = ui.reported.has(c.id);
    return `
      <article id="c-${esc(c.id)}">
        <div class="flex flex-wrap items-baseline gap-x-2">
          <strong class="text-sm text-archive-green">${esc(c.author_name)}</strong>
          <span class="text-xs text-archive-muted">${esc(ago(c.created_at))}</span>
        </div>
        <p class="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-archive-ink">${esc(c.body)}</p>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          ${voteBtn('comment', c.id, 1, c.up || 0, c.mine, 'Thumbs up')}
          ${voteBtn('comment', c.id, -1, c.down || 0, c.mine, 'Thumbs down')}
          <button type="button" data-action="reply" data-id="${esc(c.id)}" class="${LINK_BTN} ml-1">Reply</button>
          ${c.is_mine
            ? `<button type="button" data-action="delete" data-id="${esc(c.id)}" class="${LINK_BTN}">Delete</button>`
            : (reported
                ? `<span class="text-xs text-archive-muted">Reported — thank you</span>`
                : `<button type="button" data-action="report" data-id="${esc(c.id)}" class="${LINK_BTN}">Report</button>`)}
        </div>
        ${ui.replyTo === c.id ? replyFormHtml(c) : ''}
        ${kidsHtml}
      </article>`;
  }

  function renderList() {
    const n = visibleCount();
    headingEl.textContent = n ? `Discussion · ${n} comment${n === 1 ? '' : 's'}` : 'Discussion';
    const tops = childrenOf(null)
      .filter(c => c.status === 'visible' || hasVisibleDescendant(c))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    listEl.innerHTML = tops.length
      ? tops.map(c => `<div class="border-b border-archive-line pb-4 last:border-0">${commentHtml(c, 0)}</div>`).join('')
      : '<p class="text-sm italic text-archive-muted">No comments yet — be the first to share your thoughts.</p>';
  }

  renderReactions();
  renderList();

  // ── actions ────────────────────────────────────────────────────────────
  async function castVote(type, target, value) {
    if (ui.busy) return;
    const current = type === 'item'
      ? state.item.mine
      : (state.comments.find(c => c.id === target)?.mine || 0);
    const next = current === value ? 0 : value;
    ui.busy = true;
    try {
      const r = await rpc('cast_vote', { p_type: type, p_target: target, p_value: next, p_client: cid });
      if (type === 'item') Object.assign(state.item, r);
      else { const c = state.comments.find(x => x.id === target); if (c) Object.assign(c, r); }
    } catch (err) {
      mainMsg.textContent = err.message;
    } finally { ui.busy = false; }
    renderReactions();
    renderList();
  }

  async function submitComment(form, parentId) {
    if (ui.busy) return;
    const name = form.elements.name.value.trim();
    const body = form.elements.body.value.trim();
    const setMsg = (m) => { if (parentId) { ui.replyMsg = m; renderList(); } else { mainMsg.textContent = m; } };
    setMsg('');
    if (form.elements.website.value) return;       // honeypot: silently ignore bots
    if (!name) { setMsg('Please enter your name.'); return; }
    if (!body) { setMsg('Please write a comment first.'); return; }
    ui.busy = true;
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      const row = await rpc('add_comment', { p_kind: kind, p_id: itemId, p_parent: parentId || null, p_name: name, p_body: body, p_client: cid });
      state.comments.push(row);
      saveName(name);
      if (parentId) { ui.replyTo = null; ui.replyText = ''; ui.replyMsg = ''; ui.replyName = name; }
      else { form.elements.body.value = ''; mainMsg.textContent = ''; }
      renderList();
    } catch (err) {
      setMsg(err.message);
    } finally {
      ui.busy = false;
      if (btn && btn.isConnected) btn.disabled = false;
    }
  }

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'vote') {
      await castVote(btn.dataset.type, btn.dataset.target, Number(btn.dataset.value));
    } else if (action === 'reply') {
      ui.replyTo = ui.replyTo === btn.dataset.id ? null : btn.dataset.id;
      ui.replyText = ''; ui.replyMsg = ''; ui.replyName = ui.replyName || savedName();
      renderList();
      listEl.querySelector('[data-eng-form="reply"] textarea')?.focus();
    } else if (action === 'cancel-reply') {
      ui.replyTo = null; renderList();
    } else if (action === 'report') {
      ui.reported.add(btn.dataset.id);
      renderList();
      try { await rpc('report_comment', { p_id: btn.dataset.id, p_client: cid }); } catch { /* best effort */ }
    } else if (action === 'delete') {
      if (!confirm('Delete your comment?')) return;
      try {
        await rpc('delete_own_comment', { p_id: btn.dataset.id, p_client: cid });
        const c = state.comments.find(x => x.id === btn.dataset.id);
        if (c) { c.status = 'deleted'; c.body = null; c.author_name = null; }
        renderList();
      } catch (err) { mainMsg.textContent = err.message; }
    }
  });

  root.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-eng-form]');
    if (!form) return;
    e.preventDefault();
    submitComment(form, form.dataset.engForm === 'reply' ? form.dataset.parent : null);
  });

  root.addEventListener('input', (e) => {
    const f = e.target.dataset?.field;
    if (f === 'replyName') ui.replyName = e.target.value;
    if (f === 'replyText') ui.replyText = e.target.value;
  });
}
