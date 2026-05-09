import { createSupabaseClient } from './supabase-config.js';

(async function () {
  const ribbon = document.getElementById('event-ribbon');
  if (!ribbon) return;

  const event = await loadUpcomingEvent();
  if (!event || !event.title || !event.registrationUrl) return;

  const link = document.createElement('a');
  link.className = 'font-bold underline decoration-archive-goldSoft underline-offset-4';
  link.href = event.registrationUrl;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = `Upcoming Event: ${event.title} | Click to Register`;

  ribbon.replaceWith(link);

  async function loadUpcomingEvent() {
    try {
      const supabase = await createSupabaseClient();
      const { data, error } = await supabase
        .from('events')
        .select('title, registration_url, event_date, published')
        .eq('published', true)
        .not('registration_url', 'is', null)
        .order('event_date', { ascending: true, nullsFirst: false })
        .limit(1);
      if (error) throw error;
      const row = data && data[0];
      return row ? { title: row.title, registrationUrl: row.registration_url } : null;
    } catch (error) {
      return loadJsonFallback();
    }
  }

  async function loadJsonFallback() {
    try {
      const response = await fetch('/assets/data/content.json', { cache: 'no-store' });
      const data = await response.json();
      const events = Array.isArray(data.events) ? data.events : [];
      const event = events.find((item) => item && item.published !== false && item.title && item.registrationUrl);
      return event || null;
    } catch (error) {
      return null;
    }
  }
})();
