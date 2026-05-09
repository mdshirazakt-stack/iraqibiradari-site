import { ADMIN_EMAIL, ADMIN_REDIRECT_URL, createSupabaseClient } from './supabase-config.js';

(async function () {
  const supabase = await createSupabaseClient();
  const authPanel = document.querySelector('[data-auth-panel]');
  const adminPanel = document.querySelector('[data-admin-panel]');
  const loginForm = document.querySelector('[data-login-form]');
  const logoutButton = document.querySelector('[data-logout]');
  const status = document.querySelector('[data-status]');
  const form = document.querySelector('[data-admin-form]');
  const list = document.querySelector('[data-admin-list]');
  const typeSelect = document.querySelector('[name="type"]');
  const registrationRow = document.querySelector('[data-registration-row]');
  const seedButton = document.querySelector('[data-seed-json]');
  if (!authPanel || !adminPanel || !form || !list) return;

  let currentType = typeSelect.value;

  const { data: sessionData } = await supabase.auth.getSession();
  await reflectSession(sessionData.session);

  supabase.auth.onAuthStateChange((_event, session) => {
    reflectSession(session);
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = String(new FormData(loginForm).get('email') || '').trim();
    setStatus('Sending sign-in link...');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: ADMIN_REDIRECT_URL }
    });
    setStatus(error ? error.message : 'Check your email for the Supabase sign-in link.');
  });

  logoutButton.addEventListener('click', async () => {
    await supabase.auth.signOut();
    setStatus('Signed out.');
  });

  typeSelect.addEventListener('change', () => {
    currentType = typeSelect.value;
    registrationRow.hidden = currentType !== 'events';
    renderList();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = formPayload(new FormData(form), currentType);
    if (!payload.title) return;
    setStatus('Saving...');

    const { error } = await supabase.from(currentType).upsert(payload, { onConflict: 'id' });
    if (error) {
      setStatus(error.message);
      return;
    }

    form.reset();
    form.elements.published.checked = true;
    setStatus('Saved.');
    await renderList();
  });

  list.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = button.dataset.id;
    const table = button.dataset.table;
    const action = button.dataset.action;

    if (action === 'delete') {
      const { error } = await supabase.from(table).delete().eq('id', id);
      setStatus(error ? error.message : 'Deleted.');
    }

    if (action === 'toggle') {
      const published = button.dataset.published !== 'true';
      const { error } = await supabase.from(table).update({ published }).eq('id', id);
      setStatus(error ? error.message : 'Updated.');
    }

    await renderList();
  });

  seedButton.addEventListener('click', async () => {
    setStatus('Seeding curated JSON into Supabase...');
    try {
      const response = await fetch('/assets/data/content.json', { cache: 'no-store' });
      const json = await response.json();
      for (const table of ['announcements', 'documents', 'videos', 'events']) {
        const rows = (json[table] || []).map((item) => formPayloadFromJson(item, table));
        if (rows.length) {
          const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
          if (error) throw error;
        }
      }
      setStatus('Seeded curated archive data.');
      await renderList();
    } catch (error) {
      setStatus(error.message || 'Seed failed.');
    }
  });

  async function reflectSession(session) {
    const email = session && session.user && session.user.email;
    const allowed = email === ADMIN_EMAIL;
    authPanel.hidden = Boolean(allowed);
    adminPanel.hidden = !allowed;
    if (email && !allowed) setStatus(`Signed in as ${email}, but admin access is restricted to ${ADMIN_EMAIL}.`);
    if (allowed) {
      setStatus(`Signed in as ${email}.`);
      await renderList();
    }
  }

  async function renderList() {
    const { data, error } = await supabase
      .from(currentType)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      list.innerHTML = `<div class="border border-archive-line bg-white p-5 text-archive-muted">${escapeHtml(error.message)}</div>`;
      return;
    }

    list.innerHTML = (data || []).map((row) => {
      const date = row.date || row.event_date || row.video_date || '';
      return `
        <article class="border border-archive-line bg-white p-5">
          <p class="text-xs font-black uppercase tracking-[0.14em] text-archive-gold">${escapeHtml(row.category || row.content_type || date || 'Archive')}</p>
          <h2 class="mt-2 text-xl font-black text-archive-green">${escapeHtml(row.title)}</h2>
          <p class="mt-3 text-sm leading-6 text-archive-muted">${escapeHtml(row.description || row.body || '')}</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <button data-action="toggle" data-table="${currentType}" data-id="${escapeHtml(row.id)}" data-published="${row.published}" class="border border-archive-gold px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-archive-green" type="button">${row.published ? 'Unpublish' : 'Publish'}</button>
            <button data-action="delete" data-table="${currentType}" data-id="${escapeHtml(row.id)}" class="border border-archive-line px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-archive-muted" type="button">Delete</button>
          </div>
        </article>
      `;
    }).join('') || '<div class="border border-archive-line bg-white p-5 text-archive-muted">No entries yet.</div>';
  }

  function formPayload(data, table) {
    const base = {
      id: slugify(data.get('title')),
      title: String(data.get('title') || '').trim(),
      category: String(data.get('category') || '').trim() || null,
      description: String(data.get('description') || '').trim() || null,
      url: String(data.get('url') || '').trim() || null,
      published: data.get('published') === 'on'
    };

    if (table === 'announcements') {
      return {
        id: base.id,
        title: base.title,
        body: base.description,
        date: String(data.get('date') || '') || null,
        published: base.published
      };
    }

    if (table === 'events') {
      return {
        ...base,
        event_date: String(data.get('date') || '') || null,
        registration_url: String(data.get('registrationUrl') || '').trim() || null
      };
    }

    if (table === 'videos') {
      return {
        ...base,
        video_date: String(data.get('date') || '') || null
      };
    }

    return {
      ...base,
      content_type: String(data.get('itemType') || '').trim() || null
    };
  }

  function formPayloadFromJson(item, table) {
    const data = new Map([
      ['title', item.title],
      ['category', item.category],
      ['description', item.description || item.body],
      ['url', item.url],
      ['registrationUrl', item.registrationUrl],
      ['date', item.date],
      ['itemType', item.type],
      ['published', item.published === false ? '' : 'on']
    ]);
    const payload = formPayload({ get: (key) => data.get(key) }, table);
    payload.id = item.id || payload.id;
    return payload;
  }

  function setStatus(message) {
    status.textContent = message || '';
  }

  function slugify(value) {
    return String(value || 'item')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `item-${Date.now()}`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
