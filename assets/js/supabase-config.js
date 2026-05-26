export const SUPABASE_URL  = 'https://dcslkrgocuxcogvmvfkr.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjc2xrcmdvY3V4Y29ndm12ZmtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTc3ODMsImV4cCI6MjA5MzgzMzc4M30.3-6mRI-CAZzGyFPRWxlTm8g3MYM5CP4PG3HHssKwqzM';
export const ADMIN_EMAIL        = 'mdshiraz.ib@outlook.com';
export const ADMIN_REDIRECT_URL = 'https://iraqibiradari.com/admin/';

// Pinned version — immutable CDN cache, never auto-updates.
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';

// Module-level singleton — created once per page load.
let _client = null;

export async function createSupabaseClient() {
  if (_client) return _client;
  const { createClient } = await import(SDK_URL);
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _client;
}

/**
 * Wraps a Supabase query promise with a timeout.
 * If the project is paused/waking up, the fetch can hang indefinitely.
 * After `ms` milliseconds, rejects with a timeout error so callers can
 * show a retry prompt instead of being frozen forever.
 */
export function withTimeout(promise, ms = 12000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out — the database may be waking up. Please try again.')), ms)
    ),
  ]);
}
