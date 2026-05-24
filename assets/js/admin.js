import { ADMIN_EMAIL, ADMIN_REDIRECT_URL, createSupabaseClient } from './supabase-config.js';

(async function () {
  const supabase = await createSupabaseClient();

  // ── Element refs ─────────────────────────────────────────────────────
  const authPanel          = document.querySelector('[data-auth-panel]');
  const adminPanel         = document.querySelector('[data-admin-panel]');
  const contentSection     = document.querySelector('[data-content-section]');
  const matrimonySection   = document.querySelector('[data-matrimony-section]');
  const submissionsSection = document.querySelector('[data-submissions-section]');

  const loginForm      = document.querySelector('[data-login-form]');
  const signinButton   = document.querySelector('[data-signin-button]');
  const logoutButton   = document.querySelector('[data-logout]');

  const statusWrap    = document.querySelector('[data-status-wrap]');
  const statusEl      = document.querySelector('[data-status]');
  const statusDismiss = document.querySelector('[data-status-dismiss]');

  // Drawer
  const drawer        = document.querySelector('[data-drawer]');
  const drawerPanel   = document.querySelector('[data-drawer-panel]');
  const drawerBackdrop= document.querySelector('[data-drawer-backdrop]');
  const drawerClose   = document.querySelector('[data-drawer-close]');

  const form             = document.querySelector('[data-admin-form]');
  const list             = document.querySelector('[data-admin-list]');
  const formTitle        = document.querySelector('[data-form-title]');
  const formTitleLabel   = document.querySelector('[data-form-title-label]');
  const editingNote      = document.querySelector('[data-editing-note]');
  const saveButton       = document.querySelector('[data-save-button]');
  const cancelEditButton = document.querySelector('[data-cancel-edit]');
  const seedButton       = document.querySelector('[data-seed-json]');

  const sectionTabs          = Array.from(document.querySelectorAll('[data-section-tab]'));
  const matrimonyList        = document.querySelector('[data-matrimony-list]');
  const submissionsList      = document.querySelector('[data-submissions-list]');
  const matrimonyTypeButtons = Array.from(document.querySelectorAll('[data-matrimony-type]'));

  const filterBar       = document.querySelector('[data-filter-bar]');
  const searchInput     = document.querySelector('[data-search]');
  const newEntryButton  = document.querySelector('[data-new-entry]');
  const sectionHeading  = document.querySelector('[data-section-heading]');
  const sectionStats    = document.querySelector('[data-section-stats]');

  const fieldRows = {
    eventType:       document.querySelector('[data-field="eventType"]'),
    date:            document.querySelector('[data-field="date"]'),
    location:        document.querySelector('[data-field="location"]'),
    videoUrl:        document.querySelector('[data-field="videoUrl"]'),
    registrationUrl: document.querySelector('[data-field="registrationUrl"]'),
    category:        document.querySelector('[data-field="category"]'),
    itemType:        document.querySelector('[data-field="itemType"]'),
    url:             document.querySelector('[data-field="url"]'),
    shortSummary:    document.querySelector('[data-field="shortSummary"]'),
    body:            document.querySelector('[data-field="body"]'),
    descriptionText: document.querySelector('[data-field="descriptionText"]'),
    ribbon:          document.querySelector('[data-field="ribbon"]'),
    designation:     document.querySelector('[data-field="designation"]'),
    photoUrl:        document.querySelector('[data-field="photoUrl"]'),
    author:          document.querySelector('[data-field="author"]'),
    coverImageUrl:   document.querySelector('[data-field="coverImageUrl"]'),
    cultureCategory: document.querySelector('[data-field="cultureCategory"]'),
    sortOrder:       document.querySelector('[data-field="sortOrder"]'),
  };

  if (!authPanel || !adminPanel || !form || !list) return;

  // ── Quill rich-text editor ───────────────────────────────────────────
  let quill = null;
  const quillContainer = document.querySelector('#quill-editor');
  if (window.Quill && quillContainer) {
    quill = new Quill(quillContainer, {
      theme: 'snow',
      placeholder: 'Write event details, agenda, or announcement content…',
      modules: {
        toolbar: [
          [{ header: [2, 3, false] }],
          ['bold', 'italic', 'underline'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link', 'image'],
          ['clean'],
        ],
      },
    });
    quill.getModule('toolbar').addHandler('image', () => {
      const url = prompt('Enter image URL:');
      if (url) {
        const range = quill.getSelection(true);
        quill.insertEmbed(range.index, 'image', url, 'user');
      }
    });
  }

  // ── State ────────────────────────────────────────────────────────────
  let currentType          = 'events';
  let currentMatrimonyType = 'matrimony_profiles';
  let editingEntry         = null;
  let draggedEntryId       = null;
  let currentFilter        = 'all';
  let allEntries           = [];  // cache for client-side filter + search

  updateSectionTabs('events');
  updateFieldVisibility();
  updateNewEntryButton('events');

  // ── Session ──────────────────────────────────────────────────────────
  const { data: sessionData } = await supabase.auth.getSession();
  await reflectSession(sessionData.session);

  supabase.auth.onAuthStateChange((_event, session) => {
    reflectSession(session);
  });

  // ── Auth events ──────────────────────────────────────────────────────
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = String(new FormData(loginForm).get('email') || '').trim();
    signinButton.disabled = true;
    signinButton.textContent = 'Sending…';
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: ADMIN_REDIRECT_URL },
    });
    signinButton.disabled = false;
    signinButton.textContent = 'Send sign-in link';
    setStatus(error ? error.message : 'Check your email for the sign-in link.');
  });

  logoutButton.addEventListener('click', async () => {
    await supabase.auth.signOut();
    setStatus('Signed out.');
  });

  statusDismiss?.addEventListener('click', () => setStatus(''));

  // ── Drawer ───────────────────────────────────────────────────────────
  function openDrawer() {
    if (!drawer) return;
    drawer.removeAttribute('aria-hidden');
    drawer.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.setAttribute('aria-hidden', 'true');
    drawer.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  drawerClose?.addEventListener('click', () => {
    closeDrawer();
    resetFormState(currentType);
    setStatus('Edit cancelled.');
  });

  drawerBackdrop?.addEventListener('click', () => {
    closeDrawer();
    resetFormState(currentType);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer?.classList.contains('is-open')) {
      closeDrawer();
      resetFormState(currentType);
    }
  });

  // ── New entry button ─────────────────────────────────────────────────
  newEntryButton?.addEventListener('click', () => {
    resetFormState(currentType);
    openDrawer();
    // Focus the title input once the drawer slides open
    setTimeout(() => form?.elements?.title?.focus(), 280);
  });

  // ── Section tabs ─────────────────────────────────────────────────────
  sectionTabs.forEach(tab => {
    tab.addEventListener('click', () => switchSection(tab.dataset.sectionTab));
  });

  // ── Search ───────────────────────────────────────────────────────────
  let searchDebounce = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => renderFilteredList(), 220);
  });

  // ── Form submit ──────────────────────────────────────────────────────
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (quill) {
      const html = quill.root.innerHTML;
      const bodyInput = form.querySelector('[name="body"]');
      if (bodyInput) bodyInput.value = (html === '<p><br></p>' ? '' : html);
    }

    const payload = formPayload(new FormData(form), currentType);
    if (editingEntry && editingEntry.table === currentType) payload.id = editingEntry.id;
    if (!payload.title) return;

    const savedType = currentType;
    saveButton.disabled = true;
    saveButton.textContent = 'Saving…';
    setStatus('Saving…');

    const { error } = await supabase.from(currentType).upsert(payload, { onConflict: 'id' });
    saveButton.disabled = false;
    saveButton.textContent = 'Save';

    if (error) { setStatus(error.message); return; }

    closeDrawer();
    resetFormState(savedType);
    setStatus('Saved successfully.');
    await renderList();
  });

  cancelEditButton.addEventListener('click', () => {
    closeDrawer();
    resetFormState(currentType);
    setStatus('Edit cancelled.');
  });

  // ── List actions ─────────────────────────────────────────────────────
  list.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const { id, table, action } = button.dataset;

    if (action === 'delete') {
      if (!confirm('Delete this entry? This cannot be undone.')) return;
      const { error } = await supabase.from(table).delete().eq('id', id);
      setStatus(error ? error.message : 'Entry deleted.');
      await renderList();
      return;
    }

    if (action === 'toggle') {
      const published = button.dataset.published !== 'true';
      const { error } = await supabase.from(table).update({ published }).eq('id', id);
      setStatus(error ? error.message : published ? 'Published.' : 'Unpublished.');
      await renderList();
      return;
    }

    if (action === 'edit') {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      if (error) { setStatus(error.message); return; }
      loadEntryForEdit(table, data);
    }
  });

  // ── Drag-to-reorder ──────────────────────────────────────────────────
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
    const targetCard  = event.target.closest('[data-entry-card]');
    const draggedCard = list.querySelector(`[data-entry-id="${cssEscape(draggedEntryId)}"]`);
    if (!targetCard || !draggedCard || targetCard === draggedCard) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    clearDropTargets();
    targetCard.classList.add('is-drop-target');
    const shouldPlaceAfter = event.clientY > targetCard.getBoundingClientRect().top + targetCard.getBoundingClientRect().height / 2;
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

  // ── Seed tool ────────────────────────────────────────────────────────
  seedButton?.addEventListener('click', async () => {
    if (!confirm('This seeds starter data into Supabase. Only do this once after a fresh schema setup. Continue?')) return;
    setStatus('Seeding data…');
    try {
      const response = await fetch('/assets/data/content.json', { cache: 'no-store' });
      const json = await response.json();
      for (const table of ['announcements', 'documents', 'videos', 'events']) {
        const rows = (json[table] || []).map(item => formPayloadFromJson(item, table));
        if (rows.length) {
          const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
          if (error) throw error;
        }
      }
      setStatus('Starter data seeded successfully.');
      await renderList();
    } catch (err) {
      setStatus(err.message || 'Seed failed.');
    }
  });

  // ── Matrimony ────────────────────────────────────────────────────────
  matrimonyTypeButtons.forEach(button => {
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
      const id   = card && card.dataset.matrimonyId;
      if (!id) return;

      if (button.dataset.matrimonyAction === 'status') {
        const { error } = await supabase
          .from(currentMatrimonyType)
          .update({ status: button.dataset.statusValue, updated_at: new Date().toISOString() })
          .eq('id', id);
        setStatus(error ? error.message : `Status updated to "${button.dataset.statusValue}".`);
      }
      if (button.dataset.matrimonyAction === 'notes') {
        const notes = card.querySelector('[data-admin-notes]').value;
        const { error } = await supabase
          .from(currentMatrimonyType)
          .update({ admin_notes: notes, updated_at: new Date().toISOString() })
          .eq('id', id);
        setStatus(error ? error.message : 'Notes saved.');
      }
      await renderMatrimonyList();
    });
  }

  // ── Story submissions ─────────────────────────────────────────────────
  if (submissionsList) {
    submissionsList.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-submission-action]');
      if (!button) return;
      const card = button.closest('[data-submission-card]');
      const id   = card && card.dataset.submissionId;
      if (!id) return;

      if (button.dataset.submissionAction === 'status') {
        const { error } = await supabase
          .from('story_submissions')
          .update({ status: button.dataset.statusValue, updated_at: new Date().toISOString() })
          .eq('id', id);
        setStatus(error ? error.message : `Status updated to "${button.dataset.statusValue}".`);
      }
      if (button.dataset.submissionAction === 'notes') {
        const notes = card.querySelector('[data-submission-notes]').value;
        const { error } = await supabase
          .from('story_submissions')
          .update({ admin_notes: notes, updated_at: new Date().toISOString() })
          .eq('id', id);
        setStatus(error ? error.message : 'Notes saved.');
      }
      await renderSubmissions();
    });
  }

  // ── Core functions ───────────────────────────────────────────────────

  function updateSectionTabs(activeSection) {
    sectionTabs.forEach(tab => {
      const active = tab.dataset.sectionTab === activeSection;
      tab.className = active
        ? 'min-h-9 px-4 text-xs font-black uppercase tracking-[0.1em] bg-archive-green text-archive-cream'
        : 'min-h-9 px-4 text-xs font-black uppercase tracking-[0.1em] border border-archive-line text-archive-muted hover:text-archive-green hover:border-archive-green';
    });
  }

  function updateNewEntryButton(type) {
    if (!newEntryButton) return;
    const labels = {
      events: '+ New event',
      announcements: '+ New announcement',
      documents: '+ New document',
      videos: '+ New video',
      people: '+ New person',
      stories: '+ New story',
    };
    newEntryButton.textContent = labels[type] || '+ New entry';
  }

  function switchSection(section) {
    const isMatrimony    = section === 'matrimony';
    const showSubmissions = section === 'stories';

    closeDrawer();
    updateSectionTabs(section);
    currentFilter = 'all';
    if (searchInput) searchInput.value = '';

    if (contentSection)     contentSection.style.display     = isMatrimony ? 'none' : 'grid';
    if (matrimonySection)   matrimonySection.style.display   = isMatrimony ? 'block' : 'none';
    if (submissionsSection) submissionsSection.style.display = showSubmissions ? 'block' : 'none';

    if (!isMatrimony) {
      currentType = section;
      resetFormState(section);
      updateNewEntryButton(section);
      if (sectionHeading) {
        const labels = {
          events:'Events', announcements:'Announcements', documents:'Documents',
          videos:'Videos', people:'People', stories:'Culture',
        };
        sectionHeading.textContent = labels[section] || section;
      }
      renderList();
      if (showSubmissions) renderSubmissions();
    } else {
      if (contentSection) contentSection.style.display = 'none';
      renderMatrimonyList();
    }
  }

  async function reflectSession(session) {
    const email   = session?.user?.email;
    const allowed = email === ADMIN_EMAIL;
    authPanel.hidden  = Boolean(allowed);
    adminPanel.hidden = !allowed;
    if (email && !allowed) {
      setStatus(`Signed in as ${email}, but access is restricted to ${ADMIN_EMAIL}.`);
    }
    if (allowed) {
      setStatus(`Signed in as ${email}.`);
      switchSection('events');
    }
  }

  async function renderList() {
    const { data, error } = await supabase
      .from(currentType)
      .select('*')
      .order('sort_order', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      list.innerHTML = `<div class="col-span-2 border border-archive-line bg-white p-5 text-archive-muted">${escapeHtml(error.message)}</div>`;
      return;
    }

    allEntries = data || [];
    renderFilterChips();
    renderFilteredList();
  }

  function renderFilteredList() {
    const query  = (searchInput?.value || '').trim().toLowerCase();
    const today  = new Date().toISOString().slice(0, 10);

    // Apply filter chip
    let filtered = allEntries.filter(row => {
      if (currentFilter === 'all') return true;
      if (currentFilter === 'published') return row.published === true;
      if (currentFilter === 'drafts')    return row.published !== true;
      // Events-specific
      if (currentFilter === 'live')     return row.published === true;
      if (currentFilter === 'upcoming') return (row.event_date || '') >= today;
      if (currentFilter === 'past')     return row.event_date && row.event_date < today;
      return true;
    });

    // Apply search
    if (query) {
      filtered = filtered.filter(row => {
        const searchable = [row.title, row.description, row.excerpt, row.body,
          row.category, row.location, row.author, row.designation].join(' ').toLowerCase();
        return searchable.includes(query);
      });
    }

    // Update stats
    updateSectionStats(allEntries, today);

    if (!filtered.length) {
      list.innerHTML = `<div class="col-span-2 border border-archive-line bg-white p-8 text-center text-archive-muted">
        No ${contentTypeLabel(currentType)}s${query ? ` matching "${escapeHtml(query)}"` : ''}.
        ${!query && currentFilter === 'all' ? `<button data-new-entry type="button" class="ml-1 font-bold text-archive-green underline underline-offset-2">Create one</button>` : ''}
      </div>`;
      return;
    }

    // For events: group into Upcoming and Past with dividers
    if (currentType === 'events' && currentFilter === 'all' && !query) {
      const upcoming = filtered.filter(r => !r.event_date || r.event_date >= today);
      const past     = filtered.filter(r => r.event_date && r.event_date < today);
      past.sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''));

      let html = '';
      if (upcoming.length) {
        html += groupDivider('Upcoming', upcoming.length);
        html += upcoming.map(entryCard).join('');
      }
      if (past.length) {
        html += groupDivider('Past', past.length);
        html += past.map(entryCard).join('');
      }
      list.innerHTML = html;
    } else {
      list.innerHTML = filtered.map(entryCard).join('');
    }

    // Re-attach new-entry button inside list if rendered
    list.querySelector('[data-new-entry]')?.addEventListener('click', () => {
      resetFormState(currentType);
      openDrawer();
    });
  }

  function groupDivider(label, count) {
    return `
      <div class="col-span-2 flex items-center gap-3 pt-2 pb-1">
        <span class="text-xs font-black uppercase tracking-[0.16em] text-archive-muted">${escapeHtml(label)}</span>
        <span class="text-xs font-bold text-archive-muted/60">(${count})</span>
        <div class="flex-1 border-t border-archive-line"></div>
      </div>`;
  }

  function updateSectionStats(entries, today) {
    if (!sectionStats) return;
    if (currentType === 'events') {
      const live     = entries.filter(r => r.published).length;
      const upcoming = entries.filter(r => !r.event_date || r.event_date >= today).length;
      const drafts   = entries.filter(r => !r.published).length;
      const past     = entries.filter(r => r.event_date && r.event_date < today).length;
      sectionStats.textContent = `${live} published · ${upcoming} upcoming · ${drafts} draft · ${past} past`;
    } else {
      const pub    = entries.filter(r => r.published).length;
      const drafts = entries.filter(r => !r.published).length;
      sectionStats.textContent = `${pub} published · ${drafts} draft`;
    }
  }

  function renderFilterChips() {
    if (!filterBar) return;
    const today = new Date().toISOString().slice(0, 10);

    let chips;
    if (currentType === 'events') {
      chips = [
        { key: 'all',      label: 'All',      count: allEntries.length },
        { key: 'live',     label: 'Published', count: allEntries.filter(r => r.published).length },
        { key: 'upcoming', label: 'Upcoming',  count: allEntries.filter(r => !r.event_date || r.event_date >= today).length },
        { key: 'drafts',   label: 'Drafts',    count: allEntries.filter(r => !r.published).length },
        { key: 'past',     label: 'Past',      count: allEntries.filter(r => r.event_date && r.event_date < today).length },
      ];
    } else {
      chips = [
        { key: 'all',       label: 'All',       count: allEntries.length },
        { key: 'published', label: 'Published',  count: allEntries.filter(r => r.published).length },
        { key: 'drafts',    label: 'Drafts',     count: allEntries.filter(r => !r.published).length },
      ];
    }

    filterBar.innerHTML = chips.map(c => {
      const active = c.key === currentFilter;
      return `
        <button data-filter="${escapeHtml(c.key)}" type="button"
          class="${active
            ? 'min-h-8 px-4 text-xs font-black uppercase tracking-[0.1em] bg-archive-green text-archive-cream'
            : 'min-h-8 px-4 text-xs font-black uppercase tracking-[0.1em] border border-archive-line text-archive-muted hover:text-archive-green hover:border-archive-green'}">
          ${escapeHtml(c.label)}
          <span class="${active ? 'ml-1.5 text-archive-goldSoft' : 'ml-1.5 text-archive-muted/60'}">${c.count}</span>
        </button>`;
    }).join('');

    filterBar.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-filter]');
      if (!btn) return;
      currentFilter = btn.dataset.filter;
      renderFilterChips();
      renderFilteredList();
    });
  }

  function entryCard(row) {
    const table    = currentType;
    const dateStr  = row.event_date || row.video_date || row.date || '';
    const sortOrder = Number(row.sort_order || 0);

    // Parse date for stamp block
    let stampHtml = '';
    if (dateStr) {
      const d = new Date(dateStr + 'T00:00:00');
      if (!isNaN(d)) {
        const day   = d.getDate();
        const month = d.toLocaleString('en-GB', { month: 'short' }).toUpperCase();
        const year  = d.getFullYear();
        stampHtml = `
          <div class="flex flex-col items-center justify-center bg-archive-green text-center px-4 py-5 shrink-0 min-w-[64px]">
            <span class="text-2xl font-black text-white leading-none">${day}</span>
            <span class="mt-1 text-xs font-bold uppercase tracking-wide text-archive-goldSoft">${month}</span>
            <span class="text-xs text-archive-paper/70">${year}</span>
          </div>`;
      }
    }

    // Status pills
    const pills = [];
    if (row.published) {
      pills.push(`<span class="inline-block px-2 py-0.5 text-[10px] font-black uppercase tracking-wide bg-green-100 text-green-800">Live</span>`);
    } else {
      pills.push(`<span class="inline-block px-2 py-0.5 text-[10px] font-black uppercase tracking-wide bg-archive-paper text-archive-muted border border-archive-line">Draft</span>`);
    }
    if (row.event_type) {
      pills.push(`<span class="inline-block px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${row.event_type === 'webinar' ? 'bg-archive-goldSoft text-archive-ink' : 'bg-archive-green/10 text-archive-green'}">${escapeHtml(row.event_type)}</span>`);
    }
    if (row.ribbon) {
      pills.push(`<span class="inline-block px-2 py-0.5 text-[10px] font-black uppercase tracking-wide bg-archive-maroon text-white">Ribbon</span>`);
    }
    if (row.category && currentType !== 'events') {
      pills.push(`<span class="inline-block px-2 py-0.5 text-[10px] font-black uppercase tracking-wide border border-archive-line text-archive-muted">${escapeHtml(row.category)}</span>`);
    }

    const preview   = stripHtml(row.description || row.excerpt || row.body || '').slice(0, 120);
    const subLabel  = row.designation
      ? escapeHtml(row.designation)
      : row.author
        ? `By ${escapeHtml(row.author)}`
        : row.location
          ? escapeHtml(row.location)
          : '';

    // SVG icons
    const iconEdit = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 1.5l3 3L4 13H1v-3L9.5 1.5z"/></svg>`;
    const iconEyeOn  = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><ellipse cx="7" cy="7" rx="5.5" ry="3.5"/><circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none"/></svg>`;
    const iconEyeOff = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M1 1l12 12M5.4 5.5A3.5 3.5 0 0 0 6.9 10.5M8.6 8.5A3.5 3.5 0 0 0 7.1 3.5"/><path d="M2.2 6.2C1.5 6.7 1 7 1 7s1.6 3.5 6 3.5a7 7 0 0 0 1.8-.3M11.8 7.8C12.5 7.3 13 7 13 7c-.4-.9-1.3-2.2-2.8-3"/></svg>`;
    const iconTrash  = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3.5h10M5 3.5V2h4v1.5M5.5 6v4.5M8.5 6v4.5M3.5 3.5l.7 8h5.6l.7-8"/></svg>`;
    const iconDrag   = `<svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true"><circle cx="4" cy="3" r="1.2"/><circle cx="8" cy="3" r="1.2"/><circle cx="4" cy="7" r="1.2"/><circle cx="8" cy="7" r="1.2"/><circle cx="4" cy="11" r="1.2"/><circle cx="8" cy="11" r="1.2"/></svg>`;

    return `
      <article data-entry-card data-entry-id="${escapeHtml(row.id)}"
        class="flex border border-archive-line bg-white overflow-hidden transition-shadow hover:shadow-soft">
        ${stampHtml}
        <div class="flex flex-1 flex-col p-4 min-w-0">
          <!-- Pills + actions row -->
          <div class="flex items-start justify-between gap-2">
            <div class="flex flex-wrap gap-1.5 items-center min-w-0">
              ${pills.join('')}
            </div>
            <div class="flex items-center gap-0 shrink-0 -mr-1">
              <button data-drag-handle data-id="${escapeHtml(row.id)}" draggable="true"
                class="p-2 text-archive-muted/50 hover:text-archive-muted cursor-grab active:cursor-grabbing"
                type="button" aria-label="Drag to reorder">${iconDrag}</button>
              <button data-action="edit" data-table="${table}" data-id="${escapeHtml(row.id)}"
                class="p-2 text-archive-muted hover:text-archive-green" type="button" aria-label="Edit">${iconEdit}</button>
              <button data-action="toggle" data-table="${table}" data-id="${escapeHtml(row.id)}" data-published="${row.published}"
                class="p-2 ${row.published ? 'text-green-600 hover:text-archive-muted' : 'text-archive-muted hover:text-green-600'}"
                type="button" aria-label="${row.published ? 'Unpublish' : 'Publish'}">${row.published ? iconEyeOn : iconEyeOff}</button>
              <button data-action="delete" data-table="${table}" data-id="${escapeHtml(row.id)}"
                class="p-2 text-archive-muted/50 hover:text-red-500" type="button" aria-label="Delete">${iconTrash}</button>
            </div>
          </div>

          <!-- Title + subtitle -->
          <h2 class="mt-2 font-display text-lg font-bold leading-snug text-archive-green">${escapeHtml(row.title)}</h2>
          ${subLabel ? `<p class="mt-0.5 text-xs font-bold text-archive-muted">${subLabel}</p>` : ''}
          ${preview ? `<p class="mt-1.5 line-clamp-2 text-xs leading-5 text-archive-muted">${escapeHtml(preview)}</p>` : ''}

          <!-- Footer: order number -->
          <div class="mt-auto pt-3 flex items-center justify-between">
            <span class="text-xs text-archive-muted/50">Order ${sortOrder}</span>
          </div>
        </div>
      </article>`;
  }

  function formPayload(data, table) {
    const base = {
      id:          slugify(data.get('title')),
      title:       String(data.get('title') || '').trim(),
      category:    String(data.get('category') || '').trim() || null,
      description: String(data.get('description') || '').trim() || null,
      url:         String(data.get('url') || '').trim() || null,
      published:   data.get('published') === 'on',
      sort_order:  Number(data.get('sortOrder') || 0),
    };

    if (table === 'announcements') {
      return {
        id: base.id, title: base.title,
        body: String(data.get('body') || '').trim() || null,
        date: null,
        published: base.published, sort_order: base.sort_order,
      };
    }

    if (table === 'events') {
      return {
        ...base,
        description:      String(data.get('shortSummary') || '').trim() || null,
        body:             String(data.get('body') || '').trim() || null,
        ribbon:           data.get('ribbon') === 'on',
        event_type:       String(data.get('eventType') || 'live'),
        event_date:       String(data.get('date') || '') || null,
        location:         String(data.get('location') || '').trim() || null,
        video_url:        String(data.get('videoUrl') || '').trim() || null,
        registration_url: String(data.get('registrationUrl') || '').trim() || null,
      };
    }

    if (table === 'videos') {
      return { ...base, video_date: String(data.get('date') || '') || null };
    }

    if (table === 'people') {
      return {
        id: base.id, title: base.title,
        designation: String(data.get('designation') || '').trim() || null,
        photo_url:   String(data.get('photoUrl') || '').trim() || null,
        category:    base.category,
        body:        String(data.get('body') || '').trim() || null,
        published:   base.published,
        sort_order:  base.sort_order,
      };
    }

    if (table === 'stories') {
      return {
        id: base.id, title: base.title,
        author:           String(data.get('author') || '').trim() || null,
        category:         String(data.get('cultureCategory') || '').trim() || null,
        cover_image_url:  String(data.get('coverImageUrl') || '').trim() || null,
        excerpt:          String(data.get('shortSummary') || '').trim() || null,
        body:             String(data.get('body') || '').trim() || null,
        published:        base.published,
        sort_order:       base.sort_order,
      };
    }

    // documents
    return { ...base, content_type: String(data.get('itemType') || '').trim() || null };
  }

  function formPayloadFromJson(item, table) {
    const data = new Map([
      ['title',           item.title],
      ['category',        item.category],
      ['description',     item.description || item.body],
      ['url',             item.url],
      ['registrationUrl', item.registrationUrl],
      ['date',            item.date],
      ['itemType',        item.type],
      ['sortOrder',       item.sortOrder || item.sort_order || 0],
      ['published',       item.published === false ? '' : 'on'],
      ['eventType',       item.event_type || 'live'],
      ['location',        item.location || ''],
      ['videoUrl',        item.video_url || ''],
      ['shortSummary',    item.description || ''],
      ['body',            item.body || ''],
      ['ribbon',          item.ribbon ? 'on' : ''],
    ]);
    const payload = formPayload({ get: key => data.get(key) }, table);
    payload.id = item.id || payload.id;
    return payload;
  }

  function setStatus(message) {
    if (!statusWrap || !statusEl) return;
    statusEl.textContent     = message || '';
    statusWrap.style.display = message ? 'flex' : 'none';
  }

  function updateFieldVisibility() {
    const visibleByType = {
      events:        ['eventType', 'date', 'location', 'videoUrl', 'registrationUrl', 'category', 'shortSummary', 'body', 'ribbon', 'sortOrder'],
      announcements: ['body', 'sortOrder'],
      documents:     ['category', 'itemType', 'url', 'descriptionText', 'sortOrder'],
      videos:        ['category', 'url', 'date', 'descriptionText', 'sortOrder'],
      people:        ['designation', 'photoUrl', 'category', 'body', 'sortOrder'],
      stories:       ['author', 'cultureCategory', 'coverImageUrl', 'shortSummary', 'body', 'sortOrder'],
    };
    const visible = new Set(visibleByType[currentType] || []);
    for (const [name, row] of Object.entries(fieldRows)) {
      if (!row) continue;
      const show = visible.has(name);
      row.style.display = show ? '' : 'none';
      row.querySelectorAll('input:not([type="hidden"]), textarea, select').forEach(ctrl => {
        ctrl.disabled = !show;
      });
    }
  }

  function updateTitleLabel(type) {
    if (!formTitleLabel) return;
    const labels = { people: 'Name', stories: 'Story title', announcements: 'Title', events: 'Title', documents: 'Title', videos: 'Title' };
    formTitleLabel.textContent = labels[type] || 'Title';
  }

  function loadEntryForEdit(table, row) {
    editingEntry = { table, id: row.id };
    currentType  = table;

    updateSectionTabs(table);
    contentSection.style.display     = 'grid';
    matrimonySection.style.display   = 'none';
    submissionsSection.style.display = table === 'stories' ? 'block' : 'none';

    form.elements.title.value           = row.title       || '';
    form.elements.category.value        = row.category    || '';
    form.elements.sortOrder.value       = Number(row.sort_order || 0);
    form.elements.published.checked     = row.published   !== false;

    if (form.elements.itemType)        form.elements.itemType.value        = row.content_type         || '';
    if (form.elements.url)             form.elements.url.value             = row.url                  || '';
    if (form.elements.registrationUrl) form.elements.registrationUrl.value = row.registration_url     || '';
    if (form.elements.date)            form.elements.date.value            = row.event_date || row.video_date || row.date || '';
    if (form.elements.location)        form.elements.location.value        = row.location             || '';
    if (form.elements.videoUrl)        form.elements.videoUrl.value        = row.video_url            || '';
    if (form.elements.shortSummary)    form.elements.shortSummary.value    = row.description || row.excerpt || '';
    if (form.elements.ribbon)          form.elements.ribbon.checked        = Boolean(row.ribbon);
    if (form.elements.description)     form.elements.description.value     = row.description || row.body || '';
    if (form.elements.designation)     form.elements.designation.value     = row.designation          || '';
    if (form.elements.photoUrl)        form.elements.photoUrl.value        = row.photo_url            || '';
    if (form.elements.author)          form.elements.author.value          = row.author               || '';
    if (form.elements.coverImageUrl)   form.elements.coverImageUrl.value   = row.cover_image_url      || '';
    if (form.elements.cultureCategory) form.elements.cultureCategory.value = row.category             || '';

    if (quill) quill.root.innerHTML = row.body || '';

    if (row.event_type) {
      form.querySelectorAll('[name="eventType"]').forEach(r => {
        r.checked = r.value === row.event_type;
      });
    }

    updateFieldVisibility();
    updateTitleLabel(table);

    formTitle.textContent        = `Edit ${contentTypeLabel(table)}`;
    editingNote.style.display    = 'block';
    saveButton.textContent       = 'Update';
    saveButton.disabled          = false;

    openDrawer();
    setStatus(`Editing "${row.title || 'entry'}".`);
  }

  function resetFormState(type = currentType) {
    editingEntry = null;
    form.reset();
    currentType = type;
    form.elements.published.checked  = true;
    form.elements.sortOrder.value    = '0';
    formTitle.textContent            = `New ${contentTypeLabel(type)}`;
    editingNote.style.display        = 'none';
    saveButton.textContent           = 'Save';
    saveButton.disabled              = false;
    // Cancel is always visible in the drawer — it closes without saving
    if (quill) quill.root.innerHTML  = '';
    updateFieldVisibility();
    updateTitleLabel(type);
  }

  function contentTypeLabel(table) {
    return {
      events: 'event', announcements: 'announcement', documents: 'document',
      videos: 'video', people: 'person', stories: 'story',
    }[table] || 'entry';
  }

  // ── Matrimony ────────────────────────────────────────────────────────

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
    matrimonyList.innerHTML = (data || []).map(row => matrimonyCard(row)).join('')
      || '<div class="border border-archive-line bg-archive-cream p-5 text-archive-muted">No matrimony submissions yet.</div>';
  }

  function matrimonyCard(row) {
    const isProfile = currentMatrimonyType === 'matrimony_profiles';
    const title     = isProfile ? row.candidate_name : row.seeker_name;
    const subtitle  = isProfile
      ? [row.candidate_gender, row.age ? `${row.age} years` : '', row.city].filter(Boolean).join(' · ')
      : [row.seeking_for, row.preferred_gender ? `Seeking ${row.preferred_gender}` : '', row.preferred_age_range].filter(Boolean).join(' · ');
    const details = isProfile
      ? [
          ['Education', row.education], ['Profession', row.profession],
          ['Marital status', row.marital_status], ['Photograph', row.photo_url],
          ['Family background', row.family_background], ['Expectations', row.expectations],
        ]
      : [['Preferred location', row.preferred_location], ['Requirement details', row.expectations]];
    const createdAt = row.created_at
      ? new Date(row.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
      : '';

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
            </div>` : '').join('')}
          ${row.browser_hint ? `
            <div class="border border-archive-line bg-white p-4">
              <dt class="text-xs font-black uppercase tracking-[0.12em] text-archive-gold">Device hint</dt>
              <dd class="mt-2 text-sm leading-6 text-archive-muted">${escapeHtml(row.browser_hint)}</dd>
            </div>` : ''}
        </dl>
        <label class="mt-5 grid gap-2 text-sm font-bold text-archive-muted">
          Private admin notes
          <textarea data-admin-notes rows="3" class="border border-archive-line bg-white p-3 text-archive-ink">${escapeHtml(row.admin_notes || '')}</textarea>
        </label>
        <div class="mt-4 flex flex-wrap gap-2">
          <button data-matrimony-action="notes" class="border border-archive-gold bg-archive-gold px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-archive-ink" type="button">Save notes</button>
          ${['new', 'reviewing', 'approved', 'matched', 'rejected', 'archived'].map(s => `
            <button data-matrimony-action="status" data-status-value="${s}"
              class="border ${row.status === s ? 'border-archive-gold bg-white text-archive-green' : 'border-archive-line text-archive-muted'}
              px-3 py-2 text-xs font-black uppercase tracking-[0.12em]" type="button">${s}</button>
          `).join('')}
        </div>
      </article>`;
  }

  function updateMatrimonyTypeButtons() {
    matrimonyTypeButtons.forEach(button => {
      const active = button.dataset.matrimonyType === currentMatrimonyType;
      button.className = active
        ? 'bg-archive-gold px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-archive-ink'
        : 'border border-archive-gold px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-archive-green';
    });
  }

  // ── Story submissions ─────────────────────────────────────────────────

  async function renderSubmissions() {
    if (!submissionsList) return;
    const { data, error } = await supabase
      .from('story_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      submissionsList.innerHTML = `<div class="border border-archive-line bg-archive-cream p-5 text-archive-muted">${escapeHtml(error.message)}</div>`;
      return;
    }

    submissionsList.innerHTML = (data || []).map(row => submissionCard(row)).join('')
      || '<div class="border border-archive-line bg-archive-cream p-5 text-archive-muted">No community story submissions yet.</div>';
  }

  function submissionCard(row) {
    const createdAt = row.created_at
      ? new Date(row.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
      : '';
    const STATUSES = ['pending', 'approved', 'rejected', 'archived'];
    return `
      <article data-submission-card data-submission-id="${escapeHtml(row.id)}" class="border border-archive-line bg-archive-cream p-5">
        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.14em] text-archive-gold">
              Story Submission · ${escapeHtml(row.status || 'pending')}${row.category ? ` · ${escapeHtml(row.category)}` : ''}
            </p>
            <h3 class="mt-2 text-2xl font-black text-archive-green">${escapeHtml(row.title)}</h3>
            <p class="mt-1 text-sm font-bold text-archive-muted">By ${escapeHtml(row.author_name)}</p>
            <p class="mt-2 text-xs font-bold text-archive-muted">${escapeHtml(createdAt)}</p>
          </div>
          ${row.email ? `
          <div class="border border-archive-line bg-white px-4 py-3 text-sm leading-6 text-archive-muted">
            <p><strong class="text-archive-ink">Email:</strong> ${escapeHtml(row.email)}</p>
          </div>` : ''}
        </div>
        <div class="mt-4 border border-archive-line bg-white p-4">
          <p class="mb-3 text-xs font-black uppercase tracking-[0.12em] text-archive-gold">Story content</p>
          <div class="prose-submission text-sm">${row.content || '<em class="text-archive-muted">No content provided.</em>'}</div>
        </div>
        <label class="mt-5 grid gap-2 text-sm font-bold text-archive-muted">
          Admin notes
          <textarea data-submission-notes rows="2" class="border border-archive-line bg-white p-3 text-archive-ink">${escapeHtml(row.admin_notes || '')}</textarea>
        </label>
        <div class="mt-4 flex flex-wrap gap-2">
          <button data-submission-action="notes" class="border border-archive-gold bg-archive-gold px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-archive-ink" type="button">Save notes</button>
          ${STATUSES.map(s => `
            <button data-submission-action="status" data-status-value="${s}"
              class="border ${row.status === s ? 'border-archive-gold bg-white text-archive-green font-black' : 'border-archive-line text-archive-muted'}
              px-3 py-2 text-xs font-black uppercase tracking-[0.12em]" type="button">${s}</button>
          `).join('')}
        </div>
      </article>`;
  }

  // ── Drag helpers ─────────────────────────────────────────────────────

  async function persistDraggedOrder() {
    const cards = Array.from(list.querySelectorAll('[data-entry-card]'));
    if (!cards.length) return;
    setStatus('Saving order…');
    const total = cards.length;
    for (const [index, card] of cards.entries()) {
      const sortOrder = (total - index) * 10;
      const { error } = await supabase.from(currentType).update({ sort_order: sortOrder }).eq('id', card.dataset.entryId);
      if (error) { setStatus(error.message); await renderList(); return; }
    }
    setStatus('Display order saved.');
    await renderList();
  }

  function clearDropTargets() {
    list.querySelectorAll('.is-drop-target').forEach(card => card.classList.remove('is-drop-target'));
  }

  // ── Utilities ────────────────────────────────────────────────────────

  function stripHtml(html) {
    return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
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
    } catch { return ''; }
  }

  function cssEscape(value) {
    return window.CSS?.escape ? window.CSS.escape(value) : String(value).replace(/"/g, '\\"');
  }

  function slugify(value) {
    return String(value || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `item-${Date.now()}`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
})();
