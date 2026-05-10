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
  const seedButton = document.querySelector('[data-seed-json]');
  const formTitle = document.querySelector('[data-form-title]');
  const editingNote = document.querySelector('[data-editing-note]');
  const saveButton = document.querySelector('[data-save-button]');
  const cancelEditButton = document.querySelector('[data-cancel-edit]');
  const matrimonyList = document.querySelector('[data-matrimony-list]');
  const matrimonyTypeButtons = Array.from(document.querySelectorAll('[data-matrimony-type]'));
  const fieldRows = {
    category: document.querySelector('[data-field="category"]'),
    itemType: document.querySelector('[data-field="itemType"]'),
    url: document.querySelector('[data-field="url"]'),
    registrationUrl: document.querySelector('[data-field="registrationUrl"]'),
    date: document.querySelector('[data-field="date"]'),
    sortOrder: document.querySelector('[data-field="sortOrder"]')
  };
  if (!authPanel || !adminPanel || !form || !list) return;

  let currentType = typeSelect.value;
  let currentMatrimonyType = 'matrimony_profiles';
  let editingEntry = null;
  let draggedEntryId = null;
  updateFieldVisibility();

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
    resetFormState(typeSelect.value);
    renderList();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = formPayload(new FormData(form), currentType);
    if (editingEntry && editingEntry.table === currentType) payload.id = editingEntry.id;
    if (!payload.title) return;
    const savedType = currentType;
    setStatus('Saving...');

    const { error } = await supabase.from(currentType).upsert(payload, { onConflict: 'id' });
    if (error) {
      setStatus(error.message);
      return;
    }

    resetFormState(savedType);
    setStatus('Saved.');
    await renderList();
  });

  cancelEditButton.addEventListener('click', () => {
    resetFormState(currentType);
    setStatus('Edit cancelled.');
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

    if (action === 'edit') {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      if (error) {
        setStatus(error.message);
        return;
      }
      loadEntryForEdit(table, data);
      return;
    }

    await renderList();
  });

  list.addEventListener('dragstart', (event) => {
    const handle = event.target.closest('[data-drag-handle]');
    if (!handle) return;
    draggedEntryId = handle.dataset.id;
    const card = handle.closest('[data-entry-card]');
    if (card) card.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedEntryId);
  });

  list.addEventListener('dragover', (event) => {
    if (!draggedEntryId) return;
    const targetCard = event.target.closest('[data-entry-card]');
    const draggedCard = list.querySelector(`[data-entry-id="${cssEscape(draggedEntryId)}"]`);
    if (!targetCard || !draggedCard || targetCard === draggedCard) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    clearDropTargets();
    targetCard.classList.add('is-drop-target');
    const targetRect = targetCard.getBoundingClientRect();
    const shouldPlaceAfter = event.clientY > targetRect.top + targetRect.height / 2;
    list.insertBefore(draggedCard, shouldPlaceAfter ? targetCard.nextSibling : targetCard);
  });

  list.addEventListener('drop', async (event) => {
    if (!draggedEntryId) return;
    event.preventDefault();
    clearDropTargets();
    await persistDraggedOrder();
  });

  list.addEventListener('dragend', () => {
    const draggedCard = list.querySelector('.is-dragging');
    if (draggedCard) draggedCard.classList.remove('is-dragging');
    clearDropTargets();
    draggedEntryId = null;
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

  matrimonyTypeButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      currentMatrimonyType = button.dataset.matrimonyType;
      updateMatrimonyTypeButtons();
      await renderMatrimonyList();
    });
  });

  if (matrimonyList) {
    matrimonyList.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-matrimony-action]');
      if (!button) return;
      const card = button.closest('[data-matrimony-card]');
      const id = card && card.dataset.matrimonyId;
      if (!id) return;
      const action = button.dataset.matrimonyAction;

      if (action === 'status') {
        const statusValue = button.dataset.statusValue;
        const { error } = await supabase
          .from(currentMatrimonyType)
          .update({ status: statusValue, updated_at: new Date().toISOString() })
          .eq('id', id);
        setStatus(error ? error.message : `Matrimony status updated to ${statusValue}.`);
      }

      if (action === 'notes') {
        const notes = card.querySelector('[data-admin-notes]').value;
        const { error } = await supabase
          .from(currentMatrimonyType)
          .update({ admin_notes: notes, updated_at: new Date().toISOString() })
          .eq('id', id);
        setStatus(error ? error.message : 'Matrimony notes saved.');
      }

      await renderMatrimonyList();
    });
  }

  async function reflectSession(session) {
    const email = session && session.user && session.user.email;
    const allowed = email === ADMIN_EMAIL;
    authPanel.hidden = Boolean(allowed);
    adminPanel.hidden = !allowed;
    if (email && !allowed) setStatus(`Signed in as ${email}, but admin access is restricted to ${ADMIN_EMAIL}.`);
    if (allowed) {
      setStatus(`Signed in as ${email}.`);
      await renderList();
      await renderMatrimonyList();
    }
  }

  async function renderList() {
    const { data, error } = await supabase
      .from(currentType)
      .select('*')
      .order('sort_order', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      list.innerHTML = `<div class="border border-archive-line bg-white p-5 text-archive-muted">${escapeHtml(error.message)}</div>`;
      return;
    }

    list.innerHTML = (data || []).map((row) => {
      const date = row.date || row.event_date || row.video_date || '';
      const sortOrder = Number(row.sort_order || 0);
      return `
        <article data-entry-card data-entry-id="${escapeHtml(row.id)}" class="border border-archive-line bg-white p-5">
          <div class="mb-4 flex items-start justify-between gap-4">
            <button data-drag-handle data-id="${escapeHtml(row.id)}" draggable="true" class="inline-flex cursor-grab items-center gap-3 border border-archive-line bg-archive-cream px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-archive-muted active:cursor-grabbing" type="button" aria-label="Drag ${escapeHtml(row.title)} to reorder">
              <span class="text-lg leading-none text-archive-gold" aria-hidden="true">⋮⋮</span>
              Drag
            </button>
            <p class="text-right text-xs font-black uppercase tracking-[0.12em] text-archive-muted">Display order: ${sortOrder}</p>
          </div>
          <p class="text-xs font-black uppercase tracking-[0.14em] text-archive-gold">${escapeHtml(row.category || row.content_type || date || 'Archive')}</p>
          <h2 class="mt-2 text-xl font-black text-archive-green">${escapeHtml(row.title)}</h2>
          <p class="mt-3 text-sm leading-6 text-archive-muted">${escapeHtml(row.description || row.body || '')}</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <button data-action="edit" data-table="${currentType}" data-id="${escapeHtml(row.id)}" class="border border-archive-gold bg-archive-gold px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-archive-ink" type="button">Edit</button>
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
      published: data.get('published') === 'on',
      sort_order: Number(data.get('sortOrder') || 0)
    };

    if (table === 'announcements') {
      return {
        id: base.id,
        title: base.title,
        body: base.description,
        date: null,
        published: base.published,
        sort_order: base.sort_order
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
      ['sortOrder', item.sortOrder || item.sort_order || 0],
      ['published', item.published === false ? '' : 'on']
    ]);
    const payload = formPayload({ get: (key) => data.get(key) }, table);
    payload.id = item.id || payload.id;
    return payload;
  }

  function setStatus(message) {
    status.textContent = message || '';
  }

  function updateFieldVisibility() {
    currentType = typeSelect.value;
    const visibleByType = {
      documents: ['category', 'itemType', 'url', 'sortOrder'],
      videos: ['category', 'url', 'sortOrder'],
      events: ['category', 'registrationUrl', 'date', 'sortOrder'],
      announcements: ['sortOrder']
    };
    const visible = new Set(visibleByType[currentType] || []);
    for (const [name, row] of Object.entries(fieldRows)) {
      if (!row) continue;
      const isVisible = visible.has(name);
      row.hidden = !isVisible;
      row.querySelectorAll('input, textarea, select').forEach((control) => {
        control.disabled = !isVisible;
      });
    }
  }

  function loadEntryForEdit(table, row) {
    editingEntry = { table, id: row.id };
    currentType = table;
    typeSelect.value = table;
    typeSelect.disabled = true;
    form.elements.title.value = row.title || '';
    form.elements.category.value = row.category || '';
    form.elements.itemType.value = row.content_type || '';
    form.elements.url.value = row.url || '';
    form.elements.registrationUrl.value = row.registration_url || '';
    form.elements.date.value = row.event_date || row.video_date || row.date || '';
    form.elements.sortOrder.value = Number(row.sort_order || 0);
    form.elements.description.value = row.description || row.body || '';
    form.elements.published.checked = row.published !== false;
    updateFieldVisibility();
    formTitle.textContent = `Edit ${contentTypeLabel(table)}`;
    editingNote.hidden = false;
    saveButton.textContent = 'Update Supabase';
    cancelEditButton.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setStatus(`Editing "${row.title || 'entry'}".`);
  }

  function resetFormState(type = typeSelect.value) {
    editingEntry = null;
    form.reset();
    typeSelect.value = type;
    typeSelect.disabled = false;
    currentType = typeSelect.value;
    form.elements.published.checked = true;
    form.elements.sortOrder.value = '0';
    formTitle.textContent = 'New entry';
    editingNote.hidden = true;
    saveButton.textContent = 'Save to Supabase';
    cancelEditButton.hidden = true;
    updateFieldVisibility();
  }

  function contentTypeLabel(table) {
    return {
      documents: 'document',
      videos: 'video',
      events: 'event',
      announcements: 'announcement'
    }[table] || 'entry';
  }

  async function renderMatrimonyList() {
    if (!matrimonyList) return;
    const { data, error } = await supabase
      .from(currentMatrimonyType)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      matrimonyList.innerHTML = `<div class="border border-archive-line bg-archive-cream p-5 text-archive-muted">${escapeHtml(error.message)}</div>`;
      return;
    }

    updateMatrimonyTypeButtons();
    matrimonyList.innerHTML = (data || []).map((row) => matrimonyCard(row)).join('') ||
      '<div class="border border-archive-line bg-archive-cream p-5 text-archive-muted">No matrimony submissions yet.</div>';
  }

  function matrimonyCard(row) {
    const isProfile = currentMatrimonyType === 'matrimony_profiles';
    const title = isProfile ? row.candidate_name : row.seeker_name;
    const subtitle = isProfile
      ? [row.candidate_gender, row.age ? `${row.age} years` : '', row.city].filter(Boolean).join(' · ')
      : [row.seeking_for, row.preferred_gender ? `Seeking ${row.preferred_gender}` : '', row.preferred_age_range].filter(Boolean).join(' · ');
    const details = isProfile
      ? [
          ['Education', row.education],
          ['Profession', row.profession],
          ['Marital status', row.marital_status],
          ['Photograph', row.photo_url],
          ['Family background', row.family_background],
          ['Expectations', row.expectations]
        ]
      : [
          ['Preferred location', row.preferred_location],
          ['Requirement details', row.expectations]
        ];
    const createdAt = row.created_at ? new Date(row.created_at).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) : '';

    return `
      <article data-matrimony-card data-matrimony-id="${escapeHtml(row.id)}" class="border border-archive-line bg-archive-cream p-5">
        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.14em] text-archive-gold">${isProfile ? 'Candidate Profile' : 'Seeker Requirement'} · ${escapeHtml(row.status || 'new')}</p>
            <h3 class="mt-2 text-2xl font-black text-archive-green">${escapeHtml(title)}</h3>
            <p class="mt-1 text-sm font-bold text-archive-muted">${escapeHtml(subtitle || 'No summary provided')}</p>
            <p class="mt-2 text-xs font-bold text-archive-muted">${escapeHtml(createdAt)}</p>
          </div>
          <div class="border border-archive-line bg-white px-4 py-3 text-sm leading-6 text-archive-muted">
            <p><strong class="text-archive-ink">Contact:</strong> ${escapeHtml(row.contact_person_name)}</p>
            <p><strong class="text-archive-ink">Phone:</strong> ${escapeHtml(row.phone_whatsapp)}</p>
            ${row.email ? `<p><strong class="text-archive-ink">Email:</strong> ${escapeHtml(row.email)}</p>` : ''}
            ${row.relationship_to_candidate ? `<p><strong class="text-archive-ink">Relation:</strong> ${escapeHtml(row.relationship_to_candidate)}</p>` : ''}
          </div>
        </div>
        <dl class="mt-5 grid gap-3 md:grid-cols-2">
          ${details.map(([label, value]) => value ? `
            <div class="border border-archive-line bg-white p-4">
              <dt class="text-xs font-black uppercase tracking-[0.12em] text-archive-gold">${escapeHtml(label)}</dt>
              <dd class="mt-2 text-sm leading-6 text-archive-muted">${label === 'Photograph' ? photoLink(value) : escapeHtml(value)}</dd>
            </div>
          ` : '').join('')}
          ${row.browser_hint ? `
            <div class="border border-archive-line bg-white p-4">
              <dt class="text-xs font-black uppercase tracking-[0.12em] text-archive-gold">Device hint</dt>
              <dd class="mt-2 text-sm leading-6 text-archive-muted">${escapeHtml(row.browser_hint)}</dd>
            </div>
          ` : ''}
        </dl>
        <label class="mt-5 grid gap-2 text-sm font-bold text-archive-muted">Private admin notes
          <textarea data-admin-notes rows="3" class="border border-archive-line bg-white p-3 text-archive-ink">${escapeHtml(row.admin_notes || '')}</textarea>
        </label>
        <div class="mt-4 flex flex-wrap gap-2">
          <button data-matrimony-action="notes" class="border border-archive-gold bg-archive-gold px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-archive-ink" type="button">Save notes</button>
          ${['new', 'reviewing', 'approved', 'matched', 'rejected', 'archived'].map((statusValue) => `
            <button data-matrimony-action="status" data-status-value="${statusValue}" class="border ${row.status === statusValue ? 'border-archive-gold bg-white text-archive-green' : 'border-archive-line text-archive-muted'} px-3 py-2 text-xs font-black uppercase tracking-[0.12em]" type="button">${statusValue}</button>
          `).join('')}
        </div>
      </article>
    `;
  }

  function updateMatrimonyTypeButtons() {
    matrimonyTypeButtons.forEach((button) => {
      const isActive = button.dataset.matrimonyType === currentMatrimonyType;
      button.className = isActive
        ? 'bg-archive-gold px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-archive-ink'
        : 'border border-archive-gold px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-archive-green';
    });
  }

  function photoLink(value) {
    const url = safeExternalUrl(value);
    if (!url) return escapeHtml(value);
    return `<a class="font-bold text-archive-green underline decoration-archive-gold underline-offset-4" href="${escapeHtml(url)}" target="_blank" rel="noopener">Open photograph</a>`;
  }

  function safeExternalUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_error) {
      return '';
    }
  }

  async function persistDraggedOrder() {
    const cards = Array.from(list.querySelectorAll('[data-entry-card]'));
    if (!cards.length) return;
    setStatus('Saving display order...');
    const total = cards.length;
    for (const [index, card] of cards.entries()) {
      const id = card.dataset.entryId;
      const sortOrder = (total - index) * 10;
      const { error } = await supabase.from(currentType).update({ sort_order: sortOrder }).eq('id', id);
      if (error) {
        setStatus(error.message);
        await renderList();
        return;
      }
    }
    setStatus('Display order saved.');
    await renderList();
  }

  function clearDropTargets() {
    list.querySelectorAll('.is-drop-target').forEach((card) => card.classList.remove('is-drop-target'));
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value).replace(/"/g, '\\"');
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
