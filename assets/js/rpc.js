// Tiny shared helpers for pages that call Supabase functions with plain fetch
// (comments, obituaries). No SDK needed.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const RPC     = `${SUPABASE_URL}/rest/v1/rpc`;
const HEADERS = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' };
const CID_KEY = 'ib_client_id';

let memClient = null;

/** A random id kept in this browser; stands in for a login (limits votes, rate-limits posting). */
export function clientId() {
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

/** Calls a Supabase function. Errors raised by the database come back as readable messages. */
export async function rpc(fn, args) {
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

export function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
