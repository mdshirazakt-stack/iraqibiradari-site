export const SUPABASE_URL = 'https://dcslkrgocuxcogvmvfkr.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjc2xrcmdvY3V4Y29ndm12ZmtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTc3ODMsImV4cCI6MjA5MzgzMzc4M30.3-6mRI-CAZzGyFPRWxlTm8g3MYM5CP4PG3HHssKwqzM';
export const ADMIN_EMAIL = 'mdshiraz.ib@outlook.com';
export const ADMIN_REDIRECT_URL = 'https://iraqibiradari.com/admin/';

export async function createSupabaseClient() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
