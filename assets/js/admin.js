import { ADMIN_EMAIL, ADMIN_REDIRECT_URL, createSupabaseClient, withTimeout } from './supabase-config.js';

(async function () {
  const supabase = await createSupabaseClient();

  // ── Element refs ─────────────────────────────────────────────────────
  const authPanel          = document.querySelector('[data-auth-panel]');
  const adminPanel         = document.querySelector('[data-admin-panel]');
  const contentSection     = document.querySelector('[data-content-section]');
  const editorView         = document.querySelector('[data-editor-view]');
  const matrimonySection   = document.querySelector('[data-matrimony-section]');
  const submissionsSection = document.querySelector('[data-submissions-section]');

  const loginForm    = document.querySelector('[data-login-form]');
  const signinButton = document.querySelector('[data-signin-button]');
  const logoutButton = document.querySelector('[data-logout]');

  const statusWrap    = document.querySelector('[data-status-wrap]');
  const statusEl      = document.querySelector('[data-status]');
  const statusDismiss = document.querySelector('[data-status-dismiss]');

  const form             = document.querySelector('[data-admin-form]');
  const list             = document.querySelector('[data-admin-list]');
  const formTitle        = document.querySelector('[data-form-title]');
  const contextLabel     = document.querySelector('[data-context-label]');
  const editorBreadcrumb = document.querySelector('[data-editor-breadcrumb]');
  const editingNote      = document.querySelector('[data-editing-note]');
  const saveButton       = document.querySelector('[data-save-button]');
  const saveStatus       = document.querySelector('[data-save-status]');
  const previewLink      = document.querySelector('[data-preview-link]');
  const cancelEditButton = document.querySelector('[data-cancel-edit]');
  const backToListButton = document.querySelector('[data-back-to-list]');
  const seedButton       = document.querySelector('[data-seed-json]');

  const sectionTabs          = Array.from(document.querySelectorAll('[data-section-tab]'));
  const matrimonyList        = document.querySelector('[data-matrimony-list]');
  const submissionsList      = document.querySelector('[data-submissions-list]');
  const matrimonyTypeButtons = Array.from(document.querySelectorAll('[data-matrimony-type]'));

  const filterBar      = document.querySelector('[data-filter-bar]');
  const searchInput    = document.querySelector('[data-search]');
  const newEntryButton = document.querySelector('[data-new-entry]');
  const sectionHeading = document.querySelector('[data-section-heading]');
  const sectionStats   = document.querySelector('[data-section-stats]');
  const publishHelp    = document.querySelector('[data-publish-help]');

  const coverPreviewEl    = document.querySelector('[data-cover-preview]');
  const logoPreviewEl     = document.querySelector('[data-logo-preview]');
  const orgMembersSection = document.querySelector('[data-org-members-section]');
  const membersList       = document.querySelector('[data-members-list]');
  const addMemberButton   = document.querySelector('[data-add-member]');

  const adminUsersSection  = document.querySelector('[data-admin-users-section]');
  const adminLogSection    = document.querySelector('[data-admin-log-section]');
  const adminUsersList     = document.querySelector('[data-admin-users-list]');
  const adminLogList       = document.querySelector('[data-admin-log-list]');
  const addAdminForm       = document.querySelector('[data-add-admin-form]');
  const addAdminStatus     = document.querySelector('[data-add-admin-status]');

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
    dateVideo:       document.querySelector('[data-field="dateVideo"]'),
    // Organizations
    orgTagline:      document.querySelector('[data-field="orgTagline"]'),
    orgContribute:   document.querySelector('[data-field="orgContribute"]'),
    orgApply:        document.querySelector('[data-field="orgApply"]'),
    orgImpact:       document.querySelector('[data-field="orgImpact"]'),
    orgLogoUrl:      document.querySelector('[data-field="orgLogoUrl"]'),
    orgContact:      document.querySelector('[data-field="orgContact"]'),
    orgMeta:         document.querySelector('[data-field="orgMeta"]'),
    orgId:           document.querySelector('[data-field="orgId"]'),
  };

  // Cache of published orgs for the orgId dropdown
  let orgsList = [];

  if (!authPanel || !adminPanel || !form || !list) return;

  // ── Quill rich-text editor ───────────────────────────────────────────
  let quill = null;
  const quillContainer = document.querySelector('#quill-editor');
  if (window.Quill && quillContainer) {
    quill = new Quill(quillContainer, {
      theme: 'snow',
      placeholder: 'Tell the story. Type / for headings, quotes, images…',
      modules: {
        toolbar: [
          [{ header: [2, 3, false] }],
          ['bold', 'italic', 'underline'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['blockquote', 'link', 'image'],
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
  let allEntries           = [];
  let currentAdminRole     = null;   // 'superadmin' | 'org_admin' | 'matrimony_admin' | 'content_admin'
  let currentAdminUser     = null;   // { email, name, role, assigned_org_ids, ... }

  updateSectionTabs('events');
  updateFieldVisibility();
  updateTypePills('live');
  updateNewEntryButton('events');

  // ── Session ──────────────────────────────────────────────────────────
  const { data: sessionData } = await supabase.auth.getSession();
  await reflectSession(sessionData.session);
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') return; // silent refresh — never disrupt an open editor
    reflectSession(session);
  });

  // ── Auth ─────────────────────────────────────────────────────────────
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
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

  // ── Editor view open / close ─────────────────────────────────────────
  function showEditor() {
    contentSection.style.display        = 'none';
    editorView.style.display            = 'block';
    submissionsSection.style.display    = 'none';
    if (orgMembersSection)  orgMembersSection.style.display  = 'none';
    if (adminUsersSection)  adminUsersSection.hidden          = true;
    if (adminLogSection)    adminLogSection.hidden            = true;
  }

  function showList() {
    contentSection.style.display     = 'grid';
    editorView.style.display         = 'none';
    if (currentType === 'stories') submissionsSection.style.display = 'block';
    if (orgMembersSection) orgMembersSection.style.display = 'none';
    // Reset editor transient elements
    if (saveStatus)  saveStatus.style.display  = '';
    if (previewLink) previewLink.style.display = '';
  }

  backToListButton?.addEventListener('click', () => {
    showList();
    resetFormState(currentType);
  });

  cancelEditButton?.addEventListener('click', () => {
    showList();
    resetFormState(currentType);
    setStatus('Edit cancelled.');
  });

  // ── Org members ─────────────────────────────────────────────────────
  addMemberButton?.addEventListener('click', async () => {
    if (!editingEntry || editingEntry.table !== 'organizations') return;
    const nameEl  = document.getElementById('member-name');
    const roleEl  = document.getElementById('member-role');
    const photoEl = document.getElementById('member-photo');
    const name = nameEl?.value.trim();
    if (!name) { nameEl?.focus(); return; }
    const { error } = await supabase.from('org_members').insert({
      org_id: editingEntry.id, name,
      role:      roleEl?.value.trim()  || null,
      photo_url: photoEl?.value.trim() || null,
    });
    if (error) { setStatus(error.message); return; }
    if (nameEl)  nameEl.value  = '';
    if (roleEl)  roleEl.value  = '';
    if (photoEl) photoEl.value = '';
    await renderOrgMembers(editingEntry.id);
  });

  membersList?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-remove-member]');
    if (!btn) return;
    const { error } = await supabase.from('org_members').delete().eq('id', btn.dataset.removeMember);
    if (error) { setStatus(error.message); return; }
    if (editingEntry) await renderOrgMembers(editingEntry.id);
  });

  async function renderOrgMembers(orgId) {
    if (!membersList) return;
    const { data, error } = await supabase.from('org_members').select('*')
      .eq('org_id', orgId).order('sort_order').order('created_at');
    if (error) { membersList.innerHTML = `<p class="text-xs text-archive-muted">${escapeHtml(error.message)}</p>`; return; }
    if (!data?.length) {
      membersList.innerHTML = `<p class="text-xs text-archive-muted italic col-span-full">No team members yet — add the first one below.</p>`;
      return;
    }
    membersList.innerHTML = data.map(m => `
      <div class="flex items-center gap-3 rounded-lg border border-archive-line bg-archive-paper p-3">
        ${m.photo_url ? `<img src="${escapeHtml(m.photo_url)}" class="h-10 w-10 shrink-0 rounded object-cover border border-archive-line" onerror="this.style.display='none'"/>` : `<div class="h-10 w-10 shrink-0 rounded bg-archive-line flex items-center justify-center text-archive-muted text-xs font-black">${escapeHtml(m.name[0] || '?')}</div>`}
        <div class="min-w-0 flex-1">
          <p class="text-sm font-bold text-archive-ink truncate">${escapeHtml(m.name)}</p>
          ${m.role ? `<p class="text-xs text-archive-muted truncate">${escapeHtml(m.role)}</p>` : ''}
        </div>
        <button data-remove-member="${escapeHtml(m.id)}" type="button"
          class="shrink-0 p-1.5 text-archive-muted/40 hover:text-red-500" aria-label="Remove member">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 1l10 10M11 1L1 11"/></svg>
        </button>
      </div>`).join('');
  }

  // ── Org dropdown population ──────────────────────────────────────────
  async function loadOrgsDropdown() {
    const sel = form.querySelector('[name="orgId"]');
    if (!sel) return;
    if (orgsList.length === 0) {
      const { data } = await supabase.from('organizations').select('id, title').eq('published', true)
        .order('sort_order', { ascending: false }).order('title');
      orgsList = data || [];
    }
    const current = sel.value;
    sel.innerHTML = `<option value="">— Generic (no organization) —</option>` +
      orgsList.map(o => `<option value="${escapeHtml(o.id)}"${o.id === current ? ' selected' : ''}>${escapeHtml(o.title)}</option>`).join('');
  }

  // ── New entry button ─────────────────────────────────────────────────
  newEntryButton?.addEventListener('click', () => {
    resetFormState(currentType);
    showEditor();
    setTimeout(() => form?.elements?.title?.focus(), 50);
  });

  // ── Section tabs ─────────────────────────────────────────────────────
  sectionTabs.forEach(tab => {
    tab.addEventListener('click', () => switchSection(tab.dataset.sectionTab));
  });

  // ── Search ───────────────────────────────────────────────────────────
  let searchDebounce = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(renderFilteredList, 220);
  });

  // ── Cover + logo previews ─────────────────────────────────────────────
  form.querySelector('[name="coverImageUrl"]')?.addEventListener('input', updateCoverPreview);
  form.querySelector('[name="orgLogoUrl"]')?.addEventListener('input', updateLogoPreview);

  function updateCoverPreview() {
    if (!coverPreviewEl) return;
    const url = form.querySelector('[name="coverImageUrl"]')?.value?.trim();
    if (url) {
      coverPreviewEl.innerHTML = `<img src="${escapeHtml(url)}" class="h-full w-full object-cover"
        onerror="this.parentElement.innerHTML='<p class=\\'text-xs text-archive-muted p-4 text-center\\'>Image failed to load</p>'"/>`;
    } else {
      coverPreviewEl.innerHTML = `<p class="px-4 text-center text-xs text-archive-muted/60">Landscape 1200×630 — drop or paste URL</p>`;
    }
  }

  function updateLogoPreview() {
    if (!logoPreviewEl) return;
    const url = form.querySelector('[name="orgLogoUrl"]')?.value?.trim();
    if (url) {
      logoPreviewEl.innerHTML = `<img src="${escapeHtml(url)}" class="h-full w-full object-contain p-1"
        onerror="this.parentElement.innerHTML='<p class=\\'text-[10px] text-archive-muted text-center px-1\\'>Failed</p>'"/>`;
    } else {
      logoPreviewEl.innerHTML = `<p class="text-center text-[10px] text-archive-muted/50 px-1">No logo</p>`;
    }
  }

  // ── Published toggle → update save button label ───────────────────────
  form.querySelector('[name="published"]')?.addEventListener('change', updateSaveButtonLabel);

  function updateSaveButtonLabel() {
    if (!saveButton) return;
    const pub = form.elements.published?.checked;
    saveButton.textContent = pub ? 'Publish' : 'Save draft';
  }

  // ── Event type pill toggle ────────────────────────────────────────────
  form.addEventListener('click', (e) => {
    const pill = e.target.closest('[data-type-pill]');
    if (!pill) return;
    updateTypePills(pill.dataset.typePill);
  });

  function updateTypePills(type) {
    form.querySelectorAll('[data-type-pill]').forEach(btn => {
      const on = btn.dataset.typePill === type;
      btn.className = on
        ? 'px-4 py-2 text-xs font-black uppercase tracking-[0.08em] bg-archive-green text-archive-cream'
        : 'px-4 py-2 text-xs font-black uppercase tracking-[0.08em] bg-white text-archive-muted hover:text-archive-green';
    });
    // Show/hide location vs videoUrl sub-fields
    if (fieldRows.location) fieldRows.location.style.display = type === 'webinar' ? 'none' : '';
    if (fieldRows.videoUrl) fieldRows.videoUrl.style.display = type === 'live'    ? 'none' : '';
    // Sync hidden input
    const hiddenInput = form.querySelector('input[name="eventType"][type="hidden"]');
    if (hiddenInput) hiddenInput.value = type;
  }

  // ── Block accidental form-submit on Enter in single-line inputs ──────
  // Without this, pressing Enter in the title, location, URL, sort-order,
  // or any other text/url/email/tel input instantly saves & closes the editor.
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const t = e.target;
    if (t.tagName !== 'INPUT') return;                    // textareas: Enter is fine
    if (t.type === 'submit' || t.type === 'checkbox' || t.type === 'radio') return;
    e.preventDefault();                                   // swallow Enter everywhere else
  });

  // ── Form submit ──────────────────────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (quill) {
      const html = quill.root.innerHTML;
      const bodyInput = form.querySelector('[name="body"]');
      if (bodyInput) bodyInput.value = html === '<p><br></p>' ? '' : html;
    }

    const payload = formPayload(new FormData(form), currentType);
    if (!payload.title) return;

    const savedType = currentType;
    saveButton.disabled = true;
    saveButton.textContent = 'Saving…';
    setStatus('Saving…');

    let saveError = null;
    try {
      if (editingEntry && editingEntry.table === currentType) {
        // UPDATE existing — strip id from payload (primary key must not change)
        const { id: _id, ...updatePayload } = payload;
        const { error } = await withTimeout(
          supabase.from(currentType).update(updatePayload).eq('id', editingEntry.id),
          20000  // 20s — larger doc saves can be slow on free tier
        );
        saveError = error;
      } else {
        // INSERT new entry
        const { error } = await withTimeout(
          supabase.from(currentType).insert(payload),
          20000
        );
        saveError = error;
      }
    } catch (err) {
      saveError = err;
    }

    saveButton.disabled = false;

    if (saveError) {
      const isTimeout = saveError.message?.includes('timed out');
      const msg = isTimeout
        ? 'Database was waking up — your content is safe, click Publish again.'
        : (saveError.message || String(saveError));
      setStatus(`Save failed: ${msg}`);
      if (editingNote) {
        editingNote.textContent = `Save failed: ${msg}`;
        editingNote.style.cssText = 'display:block;color:#743a32;font-weight:700;font-size:0.85rem';
      }
      updateSaveButtonLabel();
      return;
    }

    // Clear any inline error + flash save status before returning to list
    if (editingNote) editingNote.style.cssText = '';
    if (saveStatus) saveStatus.style.display = 'inline-flex';

    logAdminActivity(
      editingEntry ? 'update' : 'create',
      savedType,
      editingEntry?.id || payload.id || null,
      payload.title || null
    );

    showList();
    resetFormState(savedType);
    setStatus('Saved successfully.');
    await renderList();
  });

  // ── List actions ─────────────────────────────────────────────────────
  list.addEventListener('click', async (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    const { id, table, action } = button.dataset;

    if (action === 'delete') {
      if (!confirm('Delete this entry? This cannot be undone.')) return;
      const delCard = list.querySelector(`[data-entry-id="${CSS.escape(id)}"]`);
      const delTitle = delCard?.querySelector('h2')?.textContent || null;
      try {
        const { error } = await withTimeout(supabase.from(table).delete().eq('id', id));
        if (!error) logAdminActivity('delete', table, id, delTitle);
        setStatus(error ? error.message : 'Entry deleted.');
      } catch (err) { setStatus(err.message); return; }
      await renderList();
      return;
    }

    if (action === 'toggle') {
      const published = button.dataset.published !== 'true';
      const togCard   = list.querySelector(`[data-entry-id="${CSS.escape(id)}"]`);
      const togTitle  = togCard?.querySelector('h2')?.textContent || null;
      try {
        const { error } = await withTimeout(supabase.from(table).update({ published }).eq('id', id));
        if (!error) logAdminActivity(published ? 'publish' : 'unpublish', table, id, togTitle);
        setStatus(error ? error.message : published ? 'Published.' : 'Unpublished.');
      } catch (err) { setStatus(err.message); return; }
      await renderList();
      return;
    }

    if (action === 'edit') {
      let data, error;
      try {
        ({ data, error } = await withTimeout(supabase.from(table).select('*').eq('id', id).single()));
      } catch (err) { setStatus(err.message); return; }
      if (error) { setStatus(error.message); return; }
      await loadEntryForEdit(table, data);
    }
  });

  // ── Drag-to-reorder ──────────────────────────────────────────────────
  list.addEventListener('dragstart', (e) => {
    const handle = e.target.closest('[data-drag-handle]');
    if (!handle) return;
    draggedEntryId = handle.dataset.id;
    handle.closest('[data-entry-card]')?.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedEntryId);
  });

  list.addEventListener('dragover', (e) => {
    if (!draggedEntryId) return;
    const targetCard  = e.target.closest('[data-entry-card]');
    const draggedCard = list.querySelector(`[data-entry-id="${cssEscape(draggedEntryId)}"]`);
    if (!targetCard || !draggedCard || targetCard === draggedCard) return;
    e.preventDefault();
    clearDropTargets();
    targetCard.classList.add('is-drop-target');
    const after = e.clientY > targetCard.getBoundingClientRect().top + targetCard.getBoundingClientRect().height / 2;
    list.insertBefore(draggedCard, after ? targetCard.nextSibling : targetCard);
  });

  list.addEventListener('drop', async (e) => {
    if (!draggedEntryId) return;
    e.preventDefault();
    clearDropTargets();
    await persistDraggedOrder();
  });

  list.addEventListener('dragend', () => {
    list.querySelector('.is-dragging')?.classList.remove('is-dragging');
    clearDropTargets();
    draggedEntryId = null;
  });

  // ── Seed tool ────────────────────────────────────────────────────────
  seedButton?.addEventListener('click', async () => {
    if (!confirm('This seeds starter data into Supabase. Only do this once after a fresh schema setup. Continue?')) return;
    setStatus('Seeding data…');
    try {
      const res  = await fetch('/assets/data/content.json', { cache: 'no-store' });
      const json = await res.json();
      for (const table of ['announcements', 'documents', 'videos', 'events']) {
        const rows = (json[table] || []).map(item => formPayloadFromJson(item, table));
        if (rows.length) {
          const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
          if (error) throw error;
        }
      }
      setStatus('Starter data seeded successfully.');
      await renderList();
    } catch (err) { setStatus(err.message || 'Seed failed.'); }
  });

  // ── Matrimony ────────────────────────────────────────────────────────
  matrimonyTypeButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      currentMatrimonyType = btn.dataset.matrimonyType;
      updateMatrimonyTypeButtons();
      await renderMatrimonyList();
    });
  });

  // Chevron collapse/expand
  matrimonyList?.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-card-toggle]');
    if (!toggle) return;
    const card = toggle.closest('[data-matrimony-card]');
    if (!card) return;
    const body    = card.querySelector('[data-card-body]');
    const chevron = card.querySelector('[data-chevron]');
    if (!body) return;
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    if (chevron) chevron.style.transform = open ? '' : 'rotate(180deg)';
  });

  matrimonyList?.addEventListener('click', async (e) => {
    if (e.target.closest('[data-card-toggle]')) return; // handled above
    const btn  = e.target.closest('button[data-matrimony-action]');
    if (!btn) return;
    const card = btn.closest('[data-matrimony-card]');
    const id   = card?.dataset.matrimonyId;
    if (!id) return;

    if (btn.dataset.matrimonyAction === 'status') {
      const newStatus = btn.dataset.statusValue;
      const published = (currentMatrimonyType === 'matrimony_profiles') ? (newStatus === 'approved') : undefined;
      const patch = { status: newStatus, updated_at: new Date().toISOString() };
      if (published !== undefined) patch.published = published;
      const { error } = await supabase.from(currentMatrimonyType).update(patch).eq('id', id);
      if (!error) logAdminActivity(
        ['approved','matched'].includes(newStatus) ? 'approve' : ['rejected','archived'].includes(newStatus) ? 'reject' : 'status_change',
        'matrimony', id, newStatus
      );
      setStatus(error ? error.message : `Status updated to "${newStatus}".${published ? ' — now visible in browse.' : ''}`);
    }
    if (btn.dataset.matrimonyAction === 'notes') {
      const notes = card.querySelector('[data-admin-notes]').value;
      const { error } = await supabase.from(currentMatrimonyType)
        .update({ admin_notes: notes, updated_at: new Date().toISOString() }).eq('id', id);
      if (!error) logAdminActivity('notes_save', 'matrimony', id);
      setStatus(error ? error.message : 'Notes saved.');
    }
    if (btn.dataset.matrimonyAction === 'akt-verify') {
      const { error } = await supabase.from('matrimony_profiles')
        .update({ akt_verified: true, updated_at: new Date().toISOString() }).eq('id', id);
      if (!error) logAdminActivity('akt_verify', 'matrimony', id);
      setStatus(error ? error.message : 'AKT profile marked as verified ✓');
    }

    if (btn.dataset.matrimonyAction === 'revoke') {
      const reason = prompt(
        'Enter the reason for returning this profile.\nThis message will be shown to the member when they next log in:\n\n(Leave blank to use a default message)'
      );
      if (reason === null) return; // cancelled
      const note = reason.trim() ||
        'Your profile has been returned because the information provided appears to be incomplete or inaccurate. Please review and resubmit with correct details.';
      if (!confirm(`Revoke this profile and ask the member to resubmit?\n\nMessage to member:\n"${note}"`)) return;
      const { error } = await supabase.from('matrimony_profiles')
        .update({ status: 'revoked', published: false, admin_notes: note, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (!error) logAdminActivity('revoke', 'matrimony', id, null, { reason: note });
      setStatus(error ? error.message : '✓ Profile revoked — member will see a correction notice on next login.');
    }
    await renderMatrimonyList();
  });

  // ── Story submissions ─────────────────────────────────────────────────
  submissionsList?.addEventListener('click', async (e) => {
    const btn  = e.target.closest('button[data-submission-action]');
    if (!btn) return;
    const card = btn.closest('[data-submission-card]');
    const id   = card?.dataset.submissionId;
    if (!id) return;

    if (btn.dataset.submissionAction === 'status') {
      const { error } = await supabase.from('story_submissions')
        .update({ status: btn.dataset.statusValue, updated_at: new Date().toISOString() }).eq('id', id);
      setStatus(error ? error.message : `Status updated to "${btn.dataset.statusValue}".`);
    }
    if (btn.dataset.submissionAction === 'notes') {
      const notes = card.querySelector('[data-submission-notes]').value;
      const { error } = await supabase.from('story_submissions')
        .update({ admin_notes: notes, updated_at: new Date().toISOString() }).eq('id', id);
      setStatus(error ? error.message : 'Notes saved.');
    }
    await renderSubmissions();
  });

  // ── Core functions ───────────────────────────────────────────────────

  function updateSectionTabs(active) {
    sectionTabs.forEach(tab => {
      const on = tab.dataset.sectionTab === active;
      tab.className = on
        ? 'inline-flex items-center gap-2 min-h-9 rounded-lg px-4 text-xs font-black uppercase tracking-[0.1em] bg-archive-green text-archive-cream'
        : 'inline-flex items-center gap-2 min-h-9 rounded-lg px-4 text-xs font-black uppercase tracking-[0.1em] text-archive-muted hover:bg-archive-paper hover:text-archive-green';
      // Update count badge style for active/inactive
      const badge = tab.querySelector('[data-tab-count]');
      if (badge) {
        badge.className = on
          ? 'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-archive-goldSoft px-1.5 text-[11px] text-archive-ink'
          : 'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-archive-paper px-1.5 text-[11px] text-archive-muted';
      }
    });
  }

  function updateNewEntryButton(type) {
    if (!newEntryButton) return;
    const iPlus = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 1v10M1 6h10"/></svg>`;
    const singulars = { events:'event', announcements:'announcement', documents:'document', videos:'video', people:'person', stories:'story', organizations:'organization' };
    newEntryButton.innerHTML = `${iPlus} New ${singulars[type] || 'entry'}`;
  }

  function switchSection(section) {
    const isMatrimony     = section === 'matrimony';
    const isAdminUsers    = section === 'admin-users';
    const isAdminLog      = section === 'admin-log';
    const isSpecial       = isMatrimony || isAdminUsers || isAdminLog;
    const showSubmissions = section === 'stories';

    showList(); // always return to list when switching tabs
    updateSectionTabs(section);
    currentFilter = 'all';
    if (searchInput) searchInput.value = '';

    contentSection.style.display      = isSpecial ? 'none' : 'grid';
    matrimonySection.style.display    = isMatrimony ? 'block' : 'none';
    if (adminUsersSection) adminUsersSection.hidden = !isAdminUsers;
    if (adminLogSection)   adminLogSection.hidden   = !isAdminLog;
    submissionsSection.style.display  = showSubmissions ? 'block' : 'none';

    if (!isSpecial) {
      currentType = section;
      resetFormState(section);
      updateNewEntryButton(section);
      const labels = { events:'Events', announcements:'Announcements', documents:'Documents', videos:'Videos', people:'People', stories:'Culture', organizations:'Organizations' };
      if (sectionHeading)   sectionHeading.textContent   = labels[section] || section;
      if (editorBreadcrumb) editorBreadcrumb.textContent = labels[section] || section;
      renderList();
      if (showSubmissions) renderSubmissions();
      if (['events', 'videos', 'announcements', 'documents'].includes(section)) loadOrgsDropdown();
    } else if (isMatrimony) {
      renderMatrimonyList();
    } else if (isAdminUsers) {
      renderAdminUsers();
    } else if (isAdminLog) {
      renderAdminLog();
    }
  }

  async function reflectSession(session) {
    const email      = session?.user?.email;
    const wasAllowed = !adminPanel.hidden;

    if (!email) {
      authPanel.hidden  = false;
      adminPanel.hidden = true;
      return;
    }

    // ── Superadmin — always full access ──
    if (email === ADMIN_EMAIL) {
      currentAdminRole = 'superadmin';
      currentAdminUser = { email, name: 'Super Admin', role: 'superadmin', is_active: true, assigned_org_ids: [] };
      authPanel.hidden  = true;
      adminPanel.hidden = false;
      if (!wasAllowed) {
        applyRoleVisibility();
        setStatus(`Signed in as ${email}.`);
        logAdminActivity('login');
        switchSection('events');
        loadTabCounts();
      }
      return;
    }

    // ── Other emails — check admin_users table ──
    let adminUser = null;
    try {
      const { data } = await supabase.from('admin_users')
        .select('*').eq('email', email).eq('is_active', true).maybeSingle();
      adminUser = data;
    } catch (_) { /* ignore network errors — deny access */ }

    if (!adminUser) {
      authPanel.hidden  = false;
      adminPanel.hidden = true;
      setStatus(`Access denied. ${email} is not registered as a platform admin. Contact the superadmin.`);
      await supabase.auth.signOut();
      return;
    }

    currentAdminRole = adminUser.role;
    currentAdminUser = adminUser;
    authPanel.hidden  = true;
    adminPanel.hidden = false;

    if (!wasAllowed) {
      applyRoleVisibility();
      setStatus(`Signed in as ${adminUser.name} (${adminUser.role.replace(/_/g, ' ')}).`);
      logAdminActivity('login');
      switchSection(getFirstAllowedSection());
      loadTabCounts();
    }
  }

  // ── Role visibility ──────────────────────────────────────────────────
  function applyRoleVisibility() {
    const r            = currentAdminRole;
    const isSuperAdmin = r === 'superadmin';

    const tabRules = {
      'events':        isSuperAdmin || r === 'org_admin',
      'announcements': isSuperAdmin,
      'documents':     isSuperAdmin,
      'videos':        isSuperAdmin,
      'people':        isSuperAdmin || r === 'content_admin',
      'stories':       isSuperAdmin || r === 'content_admin',
      'organizations': isSuperAdmin || r === 'org_admin',
      'matrimony':     isSuperAdmin || r === 'matrimony_admin',
      'admin-users':   isSuperAdmin,
      'admin-log':     isSuperAdmin,
    };

    sectionTabs.forEach(tab => {
      const show = tabRules[tab.dataset.sectionTab] !== false;
      tab.style.display = show ? '' : 'none';
    });

    // Update session chip
    const sessionEmailEl = document.querySelector('[data-session-email]');
    if (sessionEmailEl) {
      let label = isSuperAdmin
        ? currentAdminUser.email
        : `${currentAdminUser.name} · ${r.replace(/_/g, ' ')}`;
      // Org admins: fetch and show their org name inline (best-effort, fire-and-forget)
      if (r === 'org_admin' && currentAdminUser.assigned_org_ids?.length) {
        supabase.from('organizations').select('title')
          .in('id', currentAdminUser.assigned_org_ids).limit(1)
          .then(({ data: od }) => {
            if (od?.[0]?.title) sessionEmailEl.textContent = `${currentAdminUser.name} · ${od[0].title}`;
          });
      }
      sessionEmailEl.textContent = label;
    }
  }

  function getFirstAllowedSection() {
    switch (currentAdminRole) {
      case 'org_admin':       return 'organizations';
      case 'matrimony_admin': return 'matrimony';
      case 'content_admin':   return 'stories';
      default:                return 'events';
    }
  }

  // ── Admin activity logging ───────────────────────────────────────────
  async function logAdminActivity(action, section = null, targetId = null, targetTitle = null, meta = null) {
    if (!currentAdminUser) return;
    try {
      await supabase.from('admin_activity_log').insert({
        admin_email:  currentAdminUser.email,
        admin_name:   currentAdminUser.name || currentAdminUser.email,
        admin_role:   currentAdminRole,
        action,
        section,
        target_id:    targetId   ? String(targetId)   : null,
        target_title: targetTitle ? String(targetTitle) : null,
        meta,
      });
    } catch (_) { /* never block UX */ }
  }

  // ── Org select for invite form — loads independently ────────────────
  async function populateOrgSelect() {
    const orgSelect = document.querySelector('[data-admin-org-select]');
    if (!orgSelect) return;
    try {
      const { data, error } = await withTimeout(
        supabase.from('organizations').select('id, title').order('title')
      );
      if (error || !data?.length) {
        orgSelect.innerHTML = `<option value="">— no organisations found —</option>`;
        return;
      }
      orgSelect.innerHTML =
        `<option value="">— select organisation —</option>` +
        data.map(o => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.title)}</option>`).join('');
    } catch (err) {
      orgSelect.innerHTML = `<option value="">— failed to load, try again —</option>`;
    }
  }

  // ── Admin Users management ───────────────────────────────────────────
  async function renderAdminUsers() {
    if (!adminUsersList) return;
    adminUsersList.innerHTML = `<p class="text-sm text-archive-muted">Loading…</p>`;

    // Always populate the org select independently — don't tie it to the admins query
    populateOrgSelect();

    // Load admins + org names (for display in rows) separately
    let admins, orgs;
    try {
      ([{ data: admins }, { data: orgs }] = await withTimeout(Promise.all([
        supabase.from('admin_users').select('*').order('created_at', { ascending: false }),
        supabase.from('organizations').select('id, title').order('title'),
      ])));
    } catch (err) {
      adminUsersList.innerHTML = `<p class="text-sm text-archive-muted">⏱ ${escapeHtml(err.message)}</p>`;
      return;
    }

    // Build org lookup map for display in existing admin rows
    const orgMap = Object.fromEntries((orgs || []).map(o => [o.id, o.title]));

    if (!admins?.length) {
      adminUsersList.innerHTML = `<p class="text-sm text-archive-muted italic">No additional admins yet. Invite one below.</p>`;
      return;
    }

    const roleLabel = r => ({ org_admin:'Organisation Admin', matrimony_admin:'Matrimony Admin', content_admin:'Content Admin' }[r] || r);
    const roleColor = r => ({ org_admin:'bg-blue-50 text-blue-700', matrimony_admin:'bg-purple-50 text-purple-700', content_admin:'bg-amber-50 text-amber-700' }[r] || 'bg-archive-paper text-archive-muted');

    adminUsersList.innerHTML = `
      <div class="overflow-hidden border border-archive-line">
        <div class="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center border-b border-archive-line bg-archive-paper/50 px-5 py-3 text-[10px] font-black uppercase tracking-[.12em] text-archive-gold">
          <span>Admin · Organisation</span><span>Role</span><span>Status</span><span>Action</span>
        </div>
        ${admins.map(u => {
          const assignedOrgs = (u.assigned_org_ids || []).map(id => orgMap[id]).filter(Boolean);
          return `
          <div class="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center border-b border-archive-line/60 last:border-b-0 px-5 py-4 hover:bg-archive-cream/40">
            <div class="min-w-0">
              <p class="text-sm font-bold text-archive-ink truncate">${escapeHtml(u.name)}</p>
              <p class="text-xs text-archive-muted truncate">${escapeHtml(u.email)}</p>
              ${assignedOrgs.length ? `<p class="mt-1 text-xs font-bold text-blue-700 truncate">🏛 ${assignedOrgs.map(escapeHtml).join(', ')}</p>` : ''}
              ${u.notes ? `<p class="mt-0.5 text-xs text-archive-muted/70 italic truncate">${escapeHtml(u.notes)}</p>` : ''}
            </div>
            <span class="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[.08em] ${roleColor(u.role)}">${roleLabel(u.role)}</span>
            <span class="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[.08em] ${u.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}">${u.is_active ? 'Active' : 'Inactive'}</span>
            <button data-admin-toggle="${escapeHtml(u.id)}" data-active="${u.is_active}"
              class="text-xs font-bold ${u.is_active ? 'text-red-500 hover:text-red-700' : 'text-archive-green hover:text-archive-green/70'}">
              ${u.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>`;
        }).join('')}
      </div>`;

    adminUsersList.querySelectorAll('[data-admin-toggle]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id     = btn.dataset.adminToggle;
        const active = btn.dataset.active === 'true';
        const { error: e } = await supabase.from('admin_users')
          .update({ is_active: !active, updated_at: new Date().toISOString() }).eq('id', id);
        if (e) { setStatus(e.message); return; }
        logAdminActivity(active ? 'deactivate_admin' : 'reactivate_admin', 'admin_users', id);
        renderAdminUsers();
      });
    });
  }

  // Show/hide org assignment row based on selected role
  document.querySelector('[data-admin-role-select]')?.addEventListener('change', function () {
    const orgRow = document.querySelector('[data-org-assign-row]');
    const orgSel = document.querySelector('[data-admin-org-select]');
    if (!orgRow) return;
    const isOrg = this.value === 'org_admin';
    orgRow.style.display = isOrg ? '' : 'none';
    if (orgSel) orgSel.required = isOrg;
  });
  // Init: hide org row (org_admin is first option, so show it on load)
  (() => {
    const roleEl = document.querySelector('[data-admin-role-select]');
    const orgRow = document.querySelector('[data-org-assign-row]');
    if (orgRow && roleEl) orgRow.style.display = roleEl.value === 'org_admin' ? '' : 'none';
  })();

  addAdminForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd    = new FormData(addAdminForm);
    const name  = String(fd.get('adminName')  || '').trim();
    const email = String(fd.get('adminEmail') || '').trim().toLowerCase();
    const role  = String(fd.get('adminRole')  || 'content_admin');
    const notes = String(fd.get('adminNotes') || '').trim() || null;
    const orgId = String(fd.get('adminOrgId') || '').trim();
    if (!name || !email) return;
    if (role === 'org_admin' && !orgId) {
      setStatus('Please select an organisation for this admin.');
      return;
    }

    const btn = addAdminForm.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }

    const assigned_org_ids = (role === 'org_admin' && orgId) ? [orgId] : [];

    const { error } = await supabase.from('admin_users').insert({
      email, name, role, notes,
      assigned_org_ids,
      invited_by: currentAdminUser?.email || ADMIN_EMAIL,
    });

    if (btn) { btn.disabled = false; btn.textContent = 'Add Admin →'; }

    if (error) {
      if (addAdminStatus) { addAdminStatus.textContent = `Error: ${error.message}`; addAdminStatus.classList.remove('hidden'); addAdminStatus.style.color = '#743a32'; }
      return;
    }

    logAdminActivity('add_admin', 'admin_users', null, `${name} <${email}> as ${role}`);
    addAdminForm.reset();
    if (addAdminStatus) { addAdminStatus.textContent = `✓ ${name} added as ${role.replace(/_/g, ' ')}.`; addAdminStatus.classList.remove('hidden'); addAdminStatus.style.color = ''; setTimeout(() => addAdminStatus.classList.add('hidden'), 4000); }
    renderAdminUsers();
    // Update admin count badge
    const badge = document.querySelector('[data-tab-count="admin-users"]');
    if (badge) { const n = parseInt(badge.textContent) || 0; badge.textContent = n + 1; }
  });

  // ── Admin Activity Log ───────────────────────────────────────────────
  async function renderAdminLog() {
    if (!adminLogList) return;
    adminLogList.innerHTML = `<p class="text-sm text-archive-muted">Loading…</p>`;
    let data, error;
    try {
      ({ data, error } = await withTimeout(
        supabase.from('admin_activity_log').select('*')
          .order('created_at', { ascending: false }).limit(500)
      ));
    } catch (err) {
      adminLogList.innerHTML = `<p class="text-sm text-archive-muted">⏱ ${escapeHtml(err.message)}</p>`;
      return;
    }
    if (error) { adminLogList.innerHTML = `<p class="text-sm text-archive-muted">${escapeHtml(error.message)}</p>`; return; }
    if (!data?.length) {
      adminLogList.innerHTML = `<p class="text-sm text-archive-muted italic">No activity recorded yet.</p>`;
      return;
    }

    const actionColor = a => ({
      login:            'bg-archive-paper text-archive-muted',
      create:           'bg-green-50 text-green-700',
      update:           'bg-blue-50 text-blue-700',
      delete:           'bg-red-50 text-red-600',
      publish:          'bg-green-100 text-green-800',
      unpublish:        'bg-amber-50 text-amber-700',
      approve:          'bg-green-100 text-green-800',
      reject:           'bg-red-50 text-red-600',
      akt_verify:       'bg-blue-50 text-blue-700',
      add_admin:        'bg-purple-50 text-purple-700',
      deactivate_admin: 'bg-red-50 text-red-600',
      reactivate_admin: 'bg-green-50 text-green-700',
    }[a] || 'bg-archive-paper text-archive-muted');

    adminLogList.innerHTML = `
      <div class="overflow-hidden border border-archive-line">
        <div class="border-b border-archive-line bg-archive-paper/50 px-5 py-3 grid grid-cols-[auto_1fr_auto_auto] gap-4 text-[10px] font-black uppercase tracking-[.12em] text-archive-gold">
          <span>Action</span><span>Admin · Target</span><span>Section</span><span>When</span>
        </div>
        ${data.map(row => {
          const when = new Date(row.created_at).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', hour12:true });
          return `<div class="grid grid-cols-[auto_1fr_auto_auto] gap-4 items-start border-b border-archive-line/60 last:border-b-0 px-5 py-3 hover:bg-archive-cream/30">
            <span class="mt-0.5 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[.08em] whitespace-nowrap ${actionColor(row.action)}">${escapeHtml(row.action)}</span>
            <div class="min-w-0">
              <p class="text-xs font-bold text-archive-ink truncate">${escapeHtml(row.admin_name || row.admin_email)}</p>
              ${row.target_title ? `<p class="text-[11px] text-archive-muted truncate">${escapeHtml(row.target_title)}</p>` : ''}
              <p class="text-[10px] text-archive-muted/60 truncate">${escapeHtml(row.admin_email)} · ${escapeHtml(row.admin_role || '')}</p>
            </div>
            <span class="text-xs text-archive-muted whitespace-nowrap">${row.section ? escapeHtml(row.section) : '—'}</span>
            <span class="text-[11px] text-archive-muted/70 whitespace-nowrap text-right">${when}</span>
          </div>`;
        }).join('')}
      </div>`;
  }

  async function loadTabCounts() {
    const tables = ['events', 'announcements', 'documents', 'videos', 'people', 'stories', 'organizations'];
    try {
      await withTimeout(Promise.all(tables.map(async (table) => {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
        const el = document.querySelector(`[data-tab-count="${table}"]`);
        if (el && count !== null) el.textContent = count;
      })));
      // Admin users count (superadmin only)
      if (currentAdminRole === 'superadmin') {
        const { count: ac } = await supabase.from('admin_users').select('*', { count: 'exact', head: true }).eq('is_active', true);
        const aEl = document.querySelector('[data-tab-count="admin-users"]');
        if (aEl && ac !== null) aEl.textContent = ac;
      }
      // Matrimony: sum profiles + requests
      const [{ count: pc }, { count: rc }] = await withTimeout(Promise.all([
        supabase.from('matrimony_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('matrimony_requests').select('*', { count: 'exact', head: true }),
      ]));
      const mEl = document.querySelector('[data-tab-count="matrimony"]');
      if (mEl) mEl.textContent = (pc || 0) + (rc || 0);
    } catch (err) {
      // Tab counts are cosmetic — log the timeout but don't block the admin
      console.warn('loadTabCounts timed out:', err.message);
    }
    // Refresh org cache when counts load
    orgsList = [];
  }

  async function renderList() {
    let data, error;
    try {
      ({ data, error } = await withTimeout(
        supabase
          .from(currentType)
          .select('*')
          .order('sort_order', { ascending: false })
          .order('created_at', { ascending: false })
      ));
    } catch (err) {
      list.innerHTML = `<div class="col-span-full border border-archive-line bg-white p-5 text-archive-muted">
        ⏱ ${escapeHtml(err.message)} —
        <button type="button" onclick="location.reload()" class="font-bold text-archive-green underline underline-offset-2">Reload page</button>
      </div>`;
      return;
    }

    if (error) {
      list.innerHTML = `<div class="col-span-full border border-archive-line bg-white p-5 text-archive-muted">${escapeHtml(error.message)}</div>`;
      return;
    }

    allEntries = data || [];

    // Org admins only see their assigned organisations
    if (currentAdminRole === 'org_admin' && currentType === 'organizations') {
      const allowed = currentAdminUser?.assigned_org_ids || [];
      if (allowed.length) allEntries = allEntries.filter(r => allowed.includes(r.id));
    }

    renderFilterChips();
    renderFilteredList();
    // Keep tab count badge in sync with current section
    const tabBadge = document.querySelector(`[data-tab-count="${currentType}"]`);
    if (tabBadge) tabBadge.textContent = allEntries.length;
  }

  function renderFilteredList() {
    const query = (searchInput?.value || '').trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);

    let filtered = allEntries.filter(row => {
      if (currentFilter === 'all')       return true;
      if (currentFilter === 'published') return row.published === true;
      if (currentFilter === 'drafts')    return row.published !== true;
      if (currentFilter === 'live')      return row.published === true;
      if (currentFilter === 'upcoming')  return (row.event_date || '') >= today;
      if (currentFilter === 'past')      return row.event_date && row.event_date < today;
      return true;
    });

    if (query) {
      filtered = filtered.filter(row =>
        [row.title, row.description, row.excerpt, row.body, row.category, row.location, row.author, row.designation]
          .join(' ').toLowerCase().includes(query));
    }

    updateSectionStats(allEntries, today);

    if (!filtered.length) {
      list.innerHTML = `<div class="col-span-full border border-archive-line bg-white p-8 text-center text-archive-muted">
        No ${contentTypeLabel(currentType)}s${query ? ` matching "${escapeHtml(query)}"` : ''}.
        ${!query && currentFilter === 'all' ? `<button data-create-inline type="button" class="ml-1 font-bold text-archive-green underline underline-offset-2">Create one</button>` : ''}
      </div>`;
      list.querySelector('[data-create-inline]')?.addEventListener('click', () => { resetFormState(currentType); showEditor(); });
      return;
    }

    if (currentType === 'events' && currentFilter === 'all' && !query) {
      const upcoming = filtered.filter(r => !r.event_date || r.event_date >= today);
      const past     = filtered.filter(r => r.event_date && r.event_date < today);
      past.sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''));
      let html = '';
      if (upcoming.length) html += groupDivider('Upcoming', upcoming.length) + upcoming.map(entryCard).join('');
      if (past.length)     html += groupDivider('Past', past.length)         + past.map(entryCard).join('');
      list.innerHTML = html;
    } else {
      list.innerHTML = filtered.map(entryCard).join('');
    }
  }

  function groupDivider(label, count) {
    return `<div class="col-span-full flex items-center gap-3 pt-2 pb-1">
      <span class="text-xs font-black uppercase tracking-[0.16em] text-archive-muted">${escapeHtml(label)}</span>
      <span class="text-xs font-bold text-archive-muted/50">(${count})</span>
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
    const chips  = currentType === 'events'
      ? [
          { key: 'all',      label: 'All',      count: allEntries.length },
          { key: 'live',     label: 'Published', count: allEntries.filter(r => r.published).length },
          { key: 'upcoming', label: 'Upcoming',  count: allEntries.filter(r => !r.event_date || r.event_date >= today).length },
          { key: 'drafts',   label: 'Drafts',    count: allEntries.filter(r => !r.published).length },
          { key: 'past',     label: 'Past',      count: allEntries.filter(r => r.event_date && r.event_date < today).length },
        ]
      : [
          { key: 'all',       label: 'All',      count: allEntries.length },
          { key: 'published', label: 'Published', count: allEntries.filter(r => r.published).length },
          { key: 'drafts',    label: 'Drafts',    count: allEntries.filter(r => !r.published).length },
        ];

    filterBar.innerHTML = chips.map(c => {
      const on = c.key === currentFilter;
      return `<button data-filter="${escapeHtml(c.key)}" type="button"
        class="${on
          ? 'min-h-8 rounded-full px-4 text-xs font-black uppercase tracking-[0.1em] bg-archive-green text-archive-cream'
          : 'min-h-8 rounded-full px-4 text-xs font-black uppercase tracking-[0.1em] border border-archive-line text-archive-muted hover:text-archive-green hover:border-archive-green'}">
        ${escapeHtml(c.label)}<span class="${on ? 'ml-1.5 text-archive-goldSoft' : 'ml-1.5 text-archive-muted/60'}">${c.count}</span>
      </button>`;
    }).join('');

    filterBar.querySelectorAll('button[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentFilter = btn.dataset.filter;
        renderFilterChips();
        renderFilteredList();
      });
    });
  }

  function entryCard(row) {
    const dateStr   = row.event_date || row.video_date || row.date || '';
    const sortOrder = Number(row.sort_order || 0);

    // Date stamp
    let stampHtml = '';
    if (dateStr) {
      const d = new Date(dateStr + 'T00:00:00');
      if (!isNaN(d)) {
        const day   = d.getDate();
        const month = d.toLocaleString('en-GB', { month: 'short' }).toUpperCase();
        const year  = d.getFullYear();
        stampHtml = `<div class="flex shrink-0 flex-col items-center justify-center bg-archive-green px-4 py-5 text-center min-w-[64px]">
          <span class="text-2xl font-black text-white leading-none">${day}</span>
          <span class="mt-1 text-xs font-bold uppercase tracking-wide text-archive-goldSoft">${month}</span>
          <span class="text-xs text-archive-paper/70">${year}</span>
        </div>`;
      }
    }

    // Pills
    const pills = [];
    pills.push(row.published
      ? `<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide bg-green-100 text-green-800">Live</span>`
      : `<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide border border-archive-line bg-archive-paper text-archive-muted">Draft</span>`);
    if (row.event_type) pills.push(`<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${row.event_type === 'webinar' ? 'bg-archive-goldSoft text-archive-ink' : 'bg-archive-green/10 text-archive-green'}">${escapeHtml(row.event_type)}</span>`);
    if (row.ribbon)     pills.push(`<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide bg-archive-maroon text-white">Ribbon</span>`);
    if (row.category && currentType !== 'events') pills.push(`<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide border border-archive-line text-archive-muted">${escapeHtml(row.category)}</span>`);

    const preview  = stripHtml(row.description || row.excerpt || row.body || '').slice(0, 120);
    const subLabel = row.designation ? escapeHtml(row.designation) : row.author ? `By ${escapeHtml(row.author)}` : row.location ? escapeHtml(row.location) : '';

    const iEdit  = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 1.5l3 3L4 13H1v-3L9.5 1.5z"/></svg>`;
    const iEyeOn = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><ellipse cx="7" cy="7" rx="5.5" ry="3.5"/><circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none"/></svg>`;
    const iEyeOff= `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M1 1l12 12M5.4 5.5A3.5 3.5 0 0 0 6.9 10.5M8.6 8.5A3.5 3.5 0 0 0 7.1 3.5"/><path d="M2.2 6.2C1.5 6.7 1 7 1 7s1.6 3.5 6 3.5a7 7 0 0 0 1.8-.3M11.8 7.8C12.5 7.3 13 7 13 7c-.4-.9-1.3-2.2-2.8-3"/></svg>`;
    const iTrash = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3.5h10M5 3.5V2h4v1.5M5.5 6v4.5M8.5 6v4.5M3.5 3.5l.7 8h5.6l.7-8"/></svg>`;
    const iDrag  = `<svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true"><circle cx="4" cy="3" r="1.2"/><circle cx="8" cy="3" r="1.2"/><circle cx="4" cy="7" r="1.2"/><circle cx="8" cy="7" r="1.2"/><circle cx="4" cy="11" r="1.2"/><circle cx="8" cy="11" r="1.2"/></svg>`;

    return `
      <article data-entry-card data-entry-id="${escapeHtml(row.id)}"
        class="flex overflow-hidden border border-archive-line bg-white transition-shadow hover:shadow-soft">
        ${stampHtml}
        <div class="flex flex-1 flex-col p-4 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <div class="flex flex-wrap items-center gap-1.5">${pills.join('')}</div>
            <div class="flex shrink-0 items-center -mr-1">
              <button data-drag-handle data-id="${escapeHtml(row.id)}" draggable="true"
                class="p-2 text-archive-muted/40 hover:text-archive-muted cursor-grab active:cursor-grabbing" type="button" aria-label="Drag to reorder">${iDrag}</button>
              <button data-action="edit"   data-table="${currentType}" data-id="${escapeHtml(row.id)}"
                class="p-2 text-archive-muted hover:text-archive-green"                  type="button" aria-label="Edit">${iEdit}</button>
              <button data-action="toggle" data-table="${currentType}" data-id="${escapeHtml(row.id)}" data-published="${row.published}"
                class="p-2 ${row.published ? 'text-green-600 hover:text-archive-muted' : 'text-archive-muted hover:text-green-600'}" type="button" aria-label="${row.published ? 'Unpublish' : 'Publish'}">${row.published ? iEyeOn : iEyeOff}</button>
              <button data-action="delete" data-table="${currentType}" data-id="${escapeHtml(row.id)}"
                class="p-2 text-archive-muted/40 hover:text-red-500"                     type="button" aria-label="Delete">${iTrash}</button>
            </div>
          </div>
          <h2 class="mt-2 font-display text-lg font-bold leading-snug text-archive-green">${escapeHtml(row.title)}</h2>
          ${subLabel ? `<p class="mt-0.5 text-xs font-bold text-archive-muted">${subLabel}</p>` : ''}
          ${preview ? `<p class="mt-1.5 line-clamp-2 text-xs leading-5 text-archive-muted">${escapeHtml(preview)}</p>` : ''}
          <div class="mt-auto pt-3">
            <span class="text-xs text-archive-muted/40">Order ${sortOrder}</span>
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

    if (table === 'announcements') return { id: base.id, title: base.title, body: String(data.get('body') || '').trim() || null, date: null, published: base.published, sort_order: base.sort_order, org_id: String(data.get('orgId') || '').trim() || null };

    if (table === 'events') return { ...base,
      description:      String(data.get('shortSummary') || '').trim() || null,
      body:             String(data.get('body') || '').trim() || null,
      ribbon:           data.get('ribbon') === 'on',
      event_type:       String(data.get('eventType') || 'live'),
      event_date:       String(data.get('date') || '') || null,
      location:         String(data.get('location') || '').trim() || null,
      video_url:        String(data.get('videoUrl') || '').trim() || null,
      registration_url: String(data.get('registrationUrl') || '').trim() || null,
      org_id:           String(data.get('orgId') || '').trim() || null,
    };

    if (table === 'videos')  return { ...base,
      video_date: String(data.get('videoDate') || '') || null,
      org_id:     String(data.get('orgId') || '').trim() || null,
    };

    if (table === 'people')  return { id: base.id, title: base.title,
      designation: String(data.get('designation') || '').trim() || null,
      photo_url:   String(data.get('photoUrl') || '').trim() || null,
      category:    base.category,
      body:        String(data.get('body') || '').trim() || null,
      published:   base.published, sort_order: base.sort_order,
    };

    if (table === 'stories') return { id: base.id, title: base.title,
      author:          String(data.get('author') || '').trim() || null,
      category:        String(data.get('cultureCategory') || '').trim() || null,
      cover_image_url: String(data.get('coverImageUrl') || '').trim() || null,
      excerpt:         String(data.get('shortSummary') || '').trim() || null,
      body:            String(data.get('body') || '').trim() || null,
      published:       base.published, sort_order: base.sort_order,
    };

    if (table === 'organizations') return {
      id:                slugify(data.get('title')),
      title:             String(data.get('title') || '').trim(),
      tagline:           String(data.get('orgTagline') || '').trim() || null,
      body:              String(data.get('body') || '').trim() || null,
      logo_url:          String(data.get('orgLogoUrl') || '').trim() || null,
      cover_image_url:   String(data.get('coverImageUrl') || '').trim() || null,
      contact_email:     String(data.get('orgContactEmail') || '').trim() || null,
      contact_phone:     String(data.get('orgContactPhone') || '').trim() || null,
      website_url:       String(data.get('orgWebsiteUrl') || '').trim() || null,
      address:           String(data.get('orgAddress') || '').trim() || null,
      how_to_contribute: String(data.get('orgContribute') || '').trim() || null,
      how_to_apply:      String(data.get('orgApply') || '').trim() || null,
      impact:            String(data.get('orgImpact') || '').trim() || null,
      founded_date:      String(data.get('orgFoundedDate') || '').trim() || null,
      founders:          String(data.get('orgFounders') || '').trim() || null,
      published:         base.published,
      sort_order:        base.sort_order,
      updated_at:        new Date().toISOString(),
    };

    // documents
    return { ...base, content_type: String(data.get('itemType') || '').trim() || null, org_id: String(data.get('orgId') || '').trim() || null };
  }

  function formPayloadFromJson(item, table) {
    const map = new Map([
      ['title', item.title], ['category', item.category], ['description', item.description || item.body],
      ['url', item.url], ['registrationUrl', item.registrationUrl], ['date', item.date], ['videoDate', item.video_date || item.date || ''],
      ['itemType', item.type], ['sortOrder', item.sortOrder || item.sort_order || 0],
      ['published', item.published === false ? '' : 'on'], ['eventType', item.event_type || 'live'],
      ['location', item.location || ''], ['videoUrl', item.video_url || ''],
      ['shortSummary', item.description || ''], ['body', item.body || ''],
      ['ribbon', item.ribbon ? 'on' : ''],
    ]);
    const payload = formPayload({ get: k => map.get(k) }, table);
    payload.id = item.id || payload.id;
    return payload;
  }

  function setStatus(msg) {
    if (!statusWrap || !statusEl) return;
    statusEl.textContent     = msg || '';
    statusWrap.style.display = msg ? 'flex' : 'none';
  }

  function updateFieldVisibility() {
    const show = {
      events:        ['eventType', 'date', 'location', 'videoUrl', 'registrationUrl', 'category', 'shortSummary', 'body', 'ribbon', 'orgId'],
      announcements: ['body', 'orgId'],
      documents:     ['category', 'itemType', 'url', 'descriptionText', 'orgId'],
      videos:        ['category', 'url', 'dateVideo', 'descriptionText', 'orgId'],
      people:        ['designation', 'photoUrl', 'category', 'body'],
      stories:       ['author', 'cultureCategory', 'coverImageUrl', 'shortSummary', 'body'],
      organizations: ['orgTagline', 'body', 'orgContribute', 'orgApply', 'orgImpact', 'orgLogoUrl', 'coverImageUrl', 'orgContact', 'orgMeta'],
    };
    const visible = new Set(show[currentType] || []);
    for (const [name, row] of Object.entries(fieldRows)) {
      if (!row) continue;
      row.style.display = visible.has(name) ? '' : 'none';
      row.querySelectorAll('input:not([type="hidden"]), textarea, select').forEach(el => {
        el.disabled = !visible.has(name);
      });
    }

    // Update publishing help text
    if (publishHelp) {
      const labels = { events:'Visible on the events page.', announcements:'Visible on the announcements page.', documents:'Visible on the documents page.', videos:'Visible on the videos page.', people:'Visible on the Achievers page.', stories:'Visible in the Culture section.', organizations:'Visible on the Organizations page.' };
      publishHelp.textContent = labels[currentType] || 'Visible on the site.';
    }
  }

  function updateTitlePlaceholder(type) {
    const el = form.querySelector('[name="title"]');
    if (!el) return;
    const ph = { people:'Name…', stories:'Story title…', events:'Event title…', announcements:'Announcement title…', documents:'Document title…', videos:'Video title…', organizations:'Organization name…' };
    el.placeholder = ph[type] || 'Title…';
  }

  function updateContextLabel(type, isEditing) {
    if (!contextLabel) return;
    const newLabels  = { events:'Drafting a new event', announcements:'Drafting a new announcement', documents:'Adding a new document', videos:'Adding a new video', people:'Adding a new person', stories:'Writing a story', organizations:'Adding a new organization' };
    const editLabels = { events:'Editing event', announcements:'Editing announcement', documents:'Editing document', videos:'Editing video', people:'Editing person', stories:'Editing story', organizations:'Editing organization' };
    contextLabel.textContent = isEditing ? (editLabels[type] || 'Editing entry') : (newLabels[type] || 'New entry');
  }

  function setPreviewLink(type, id) {
    if (!previewLink) return;
    const urls = {
      events:        '/events/',
      announcements: '/announcements/',
      documents:     '/documents/',
      videos:        '/videos/',
      people:        '/people/',
      stories:       id ? `/culture/detail/?id=${encodeURIComponent(id)}` : '/culture/',
      organizations: id ? `/organizations/detail/?id=${encodeURIComponent(id)}` : '/organizations/',
    };
    previewLink.href = urls[type] || '#';
    previewLink.style.display = id ? 'inline' : '';
  }

  async function loadEntryForEdit(table, row) {
    editingEntry = { table, id: row.id };
    currentType  = table;

    updateSectionTabs(table);

    form.elements.title.value       = row.title       || '';
    form.elements.category.value    = row.category    || '';
    form.elements.sortOrder.value   = Number(row.sort_order || 0);
    form.elements.published.checked = row.published !== false;

    if (form.elements.itemType)        form.elements.itemType.value        = row.content_type     || '';
    if (form.elements.url)             form.elements.url.value             = row.url              || '';
    if (form.elements.registrationUrl) form.elements.registrationUrl.value = row.registration_url || '';
    if (form.elements.date)            form.elements.date.value            = row.event_date || row.date || '';
    if (form.elements.videoDate)       form.elements.videoDate.value       = row.video_date || '';
    if (form.elements.location)        form.elements.location.value        = row.location         || '';
    if (form.elements.videoUrl)        form.elements.videoUrl.value        = row.video_url        || '';
    if (form.elements.shortSummary)    form.elements.shortSummary.value    = row.description || row.excerpt || '';
    if (form.elements.ribbon)          form.elements.ribbon.checked        = Boolean(row.ribbon);
    if (form.elements.description)     form.elements.description.value     = row.description || row.body || '';
    if (form.elements.designation)     form.elements.designation.value     = row.designation      || '';
    if (form.elements.photoUrl)        form.elements.photoUrl.value        = row.photo_url        || '';
    if (form.elements.author)          form.elements.author.value          = row.author           || '';
    if (form.elements.coverImageUrl)   form.elements.coverImageUrl.value   = row.cover_image_url  || '';
    if (form.elements.cultureCategory) form.elements.cultureCategory.value = row.category         || '';

    // Organizations-specific fields
    if (form.elements.orgTagline)      form.elements.orgTagline.value      = row.tagline           || '';
    if (form.elements.orgLogoUrl)      form.elements.orgLogoUrl.value      = row.logo_url          || '';
    if (form.elements.orgContactEmail) form.elements.orgContactEmail.value = row.contact_email     || '';
    if (form.elements.orgContactPhone) form.elements.orgContactPhone.value = row.contact_phone     || '';
    if (form.elements.orgWebsiteUrl)   form.elements.orgWebsiteUrl.value   = row.website_url       || '';
    if (form.elements.orgAddress)      form.elements.orgAddress.value      = row.address           || '';
    if (form.elements.orgContribute)   form.elements.orgContribute.value   = row.how_to_contribute || '';
    if (form.elements.orgApply)        form.elements.orgApply.value        = row.how_to_apply      || '';
    if (form.elements.orgImpact)       form.elements.orgImpact.value       = row.impact            || '';
    if (form.elements.orgFoundedDate)  form.elements.orgFoundedDate.value  = row.founded_date      || '';
    if (form.elements.orgFounders)     form.elements.orgFounders.value     = row.founders          || '';

    if (quill) quill.root.innerHTML = row.body || '';

    updateFieldVisibility();
    if (table === 'events') updateTypePills(row.event_type || 'live');
    updateTitlePlaceholder(table);
    updateCoverPreview();
    updateLogoPreview();
    updateSaveButtonLabel();
    updateContextLabel(table, true);
    setPreviewLink(table, row.id);

    const labels = { events:'Events', announcements:'Announcements', documents:'Documents', videos:'Videos', people:'People', stories:'Culture', organizations:'Organizations' };
    if (editorBreadcrumb) editorBreadcrumb.textContent = labels[table] || table;
    if (formTitle)        formTitle.textContent = `Edit ${contentTypeLabel(table)}`;
    if (editingNote)      editingNote.style.display = 'block';

    // Populate org dropdown (events/videos/announcements/documents) then set selected value
    if (['events', 'videos', 'announcements', 'documents'].includes(table)) {
      await loadOrgsDropdown();
      if (form.elements.orgId && row.org_id) form.elements.orgId.value = row.org_id;
    }

    // Show team members panel for existing organizations
    if (table === 'organizations' && orgMembersSection) {
      orgMembersSection.style.display = 'block';
      await renderOrgMembers(row.id);
    }

    showEditor();
    setStatus(`Editing "${row.title || 'entry'}".`);
  }

  function resetFormState(type = currentType) {
    editingEntry = null;
    form.reset();
    currentType = type;
    form.elements.published.checked = true;
    form.elements.sortOrder.value   = '0';
    if (quill)            quill.root.innerHTML = '';
    if (editingNote)    { editingNote.style.cssText = 'display:none'; editingNote.textContent = 'Editing existing entry.'; }
    if (coverPreviewEl)   coverPreviewEl.innerHTML = `<p class="px-4 text-center text-xs text-archive-muted/60">Landscape 1200×630 — drop or paste URL</p>`;
    if (logoPreviewEl)    logoPreviewEl.innerHTML  = `<p class="text-center text-[10px] text-archive-muted/50 px-1">No logo</p>`;
    if (orgMembersSection) orgMembersSection.style.display = 'none';
    if (saveStatus)       saveStatus.style.display  = '';
    if (previewLink)      previewLink.style.display = '';
    updateFieldVisibility();
    if (type === 'events') updateTypePills('live');
    updateTitlePlaceholder(type);
    updateSaveButtonLabel();
    updateContextLabel(type, false);
    const labels = { events:'Events', announcements:'Announcements', documents:'Documents', videos:'Videos', people:'People', stories:'Culture', organizations:'Organizations' };
    if (editorBreadcrumb) editorBreadcrumb.textContent = labels[type] || type;
    if (formTitle)        formTitle.textContent = `New ${contentTypeLabel(type)}`;
  }

  function contentTypeLabel(t) {
    return { events:'event', announcements:'announcement', documents:'document', videos:'video', people:'person', stories:'story', organizations:'organization' }[t] || 'entry';
  }

  // ── Matrimony ────────────────────────────────────────────────────────

  async function renderMatrimonyList() {
    if (!matrimonyList) return;
    updateMatrimonyTypeButtons();

    // ── Consents tab ──
    if (currentMatrimonyType === 'consents') {
      matrimonyList.innerHTML = `<div class="p-5 text-archive-muted text-sm">Loading consent records…</div>`;
      let data, error;
      try {
        ({ data, error } = await withTimeout(
          supabase.from('matrimony_members')
            .select('user_email, full_name, mobile, native_location, current_location, policy_agreed_at, policy_version, akt_profile_url, created_at')
            .not('policy_agreed_at', 'is', null)
            .order('policy_agreed_at', { ascending: false })
        ));
      } catch (err) {
        matrimonyList.innerHTML = `<div class="p-5 text-archive-muted">⏱ ${escapeHtml(err.message)}</div>`;
        return;
      }
      if (error) { matrimonyList.innerHTML = `<div class="p-5 text-archive-muted">${escapeHtml(error.message)}</div>`; return; }
      if (!data || !data.length) { matrimonyList.innerHTML = `<div class="border border-archive-line bg-archive-cream p-5 text-archive-muted">No consent records yet.</div>`; return; }

      matrimonyList.innerHTML = `
        <div class="mb-3 flex items-center justify-between">
          <p class="text-sm text-archive-muted">${data.length} member${data.length !== 1 ? 's' : ''} have agreed to the Matrimony Service Policy.</p>
        </div>
        <div class="border border-archive-line bg-white overflow-hidden">
          <div class="border-b border-archive-line bg-archive-paper/50 px-5 py-3 grid grid-cols-[1fr_1fr_auto_auto] gap-4 text-[10px] font-black uppercase tracking-[.12em] text-archive-gold">
            <span>Name / Email</span><span>Location</span><span>Policy Version</span><span>Agreed At</span>
          </div>
          ${data.map(consentRow).join('')}
        </div>`;
      return;
    }

    // ── Activity Log tab ──
    if (currentMatrimonyType === 'activity') {
      matrimonyList.innerHTML = `<div class="p-5 text-archive-muted text-sm">Loading activity log…</div>`;
      let data, error;
      try {
        ({ data, error } = await withTimeout(
          supabase.from('matrimony_activity_log').select('*').order('created_at', { ascending: false }).limit(300)
        ));
      } catch (err) {
        matrimonyList.innerHTML = `<div class="p-5 text-archive-muted">⏱ ${escapeHtml(err.message)} — <button type="button" onclick="location.reload()" class="font-bold text-archive-green underline">Reload</button></div>`;
        return;
      }
      if (error) { matrimonyList.innerHTML = `<div class="p-5 text-archive-muted">${escapeHtml(error.message)}</div>`; return; }
      if (!data || !data.length) { matrimonyList.innerHTML = `<div class="border border-archive-line bg-archive-cream p-5 text-archive-muted">No activity recorded yet.</div>`; return; }
      matrimonyList.innerHTML = `
        <div class="border border-archive-line bg-white overflow-hidden">
          <div class="border-b border-archive-line bg-archive-paper/50 px-5 py-3 grid grid-cols-[auto_1fr_auto_auto] gap-4 text-[10px] font-black uppercase tracking-[.12em] text-archive-gold">
            <span>Event</span><span>User</span><span>Details</span><span>Time</span>
          </div>
          ${data.map(activityRow).join('')}
        </div>`;
      return;
    }

    // ── Profiles / Seekers tabs ──
    let data, error;
    try {
      ({ data, error } = await withTimeout(
        supabase.from(currentMatrimonyType).select('*').order('created_at', { ascending: false }).limit(100)
      ));
    } catch (err) {
      matrimonyList.innerHTML = `<div class="p-5 text-archive-muted">⏱ ${escapeHtml(err.message)} — <button type="button" onclick="location.reload()" class="font-bold text-archive-green underline">Reload</button></div>`;
      return;
    }
    if (error) { matrimonyList.innerHTML = `<div class="p-5 text-archive-muted">${escapeHtml(error.message)}</div>`; return; }
    matrimonyList.innerHTML = (data || []).map(matrimonyCard).join('') || '<div class="border border-archive-line bg-archive-cream p-5 text-archive-muted">No matrimony submissions yet.</div>';
  }

  function consentRow(row) {
    const agreedAt = row.policy_agreed_at
      ? new Date(row.policy_agreed_at).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true })
      : '—';
    const location = [row.native_location, row.current_location].filter(Boolean).join(' → ') || '—';
    return `<div class="grid grid-cols-[1fr_1fr_auto_auto] gap-4 items-start px-5 py-4 border-b border-archive-line/60 last:border-b-0 hover:bg-archive-paper/30 transition-colors">
      <div class="min-w-0">
        <p class="font-bold text-archive-green text-sm truncate">${escapeHtml(row.full_name || '—')}</p>
        <p class="text-xs text-archive-muted truncate mt-0.5">${escapeHtml(row.user_email || '—')}</p>
        ${row.mobile ? `<p class="text-xs text-archive-muted/70 mt-0.5">${escapeHtml(row.mobile)}</p>` : ''}
      </div>
      <p class="text-xs text-archive-muted leading-5">${escapeHtml(location)}</p>
      <span class="inline-block rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-green-700 whitespace-nowrap">${escapeHtml(row.policy_version || '—')}</span>
      <p class="text-[11px] text-archive-muted/70 whitespace-nowrap text-right">${agreedAt}</p>
    </div>`;
  }

  const EVENT_LABELS = {
    login:              '🔑 Login',
    browse_open:        '👁 Browse opened',
    profile_view:       '📋 Profile viewed',
    shortlist_add:      '❤️ Shortlisted',
    shortlist_remove:   '🤍 Shortlist removed',
    policy_agree:       '✅ Policy agreed',
    candidate_submit:   '📤 Candidate submitted',
    requirement_submit: '📤 Requirement submitted',
  };

  function activityRow(row) {
    const time    = row.created_at ? new Date(row.created_at).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}) : '—';
    const label   = EVENT_LABELS[row.event_type] || escapeHtml(row.event_type);
    const metaBits = row.meta ? Object.entries(row.meta).map(([k,v]) => `<span class="text-archive-muted">${escapeHtml(k)}:</span> <strong class="text-archive-ink">${escapeHtml(String(v).slice(0,40))}</strong>`).join(' · ') : '';
    const rowBg   = { policy_agree:'bg-green-50', candidate_submit:'bg-blue-50', requirement_submit:'bg-blue-50', login:'bg-archive-paper/30' }[row.event_type] || '';
    return `<div class="grid grid-cols-[auto_1fr_auto_auto] gap-4 items-start px-5 py-3 border-b border-archive-line/60 text-sm ${rowBg} last:border-b-0">
      <span class="whitespace-nowrap font-bold text-archive-green">${label}</span>
      <span class="text-archive-muted truncate text-xs">${escapeHtml(row.user_email || '—')}</span>
      <span class="text-xs text-archive-muted max-w-[220px] truncate">${metaBits}</span>
      <span class="text-[11px] text-archive-muted/70 whitespace-nowrap">${time}</span>
    </div>`;
  }

  function matrimonyCard(row) {
    const isProfile = currentMatrimonyType === 'matrimony_profiles';
    const title     = isProfile ? row.candidate_name : row.seeker_name;
    const subtitle  = isProfile
      ? [row.candidate_gender, row.marital_status ? escapeHtml(row.marital_status) : '', row.current_location || row.city].filter(Boolean).join(' · ')
      : [row.seeking_for, row.preferred_gender ? `Seeking ${row.preferred_gender}` : '', row.preferred_age_range].filter(Boolean).join(' · ');
    const details   = isProfile
      ? [['Education',row.education],['Profession',row.profession],['Marital status',row.marital_status],['Photograph',row.photo_url],['Family background',row.family_background],['Expectations',row.expectations]]
      : [['Preferred location',row.preferred_location],['Notes',row.notes]];
    const createdAt = row.created_at ? new Date(row.created_at).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}) : '';
    const statusColour = { new:'text-amber-700 bg-amber-50', review:'text-amber-700 bg-amber-50', reviewing:'text-amber-700 bg-amber-50', approved:'text-green-700 bg-green-50', matched:'text-green-700 bg-green-50', rejected:'text-red-700 bg-red-50', archived:'text-slate-600 bg-slate-100', changes:'text-orange-700 bg-orange-50', revoked:'text-red-800 bg-red-100' }[row.status] || 'text-archive-muted bg-archive-paper';
    const iChevron  = `<svg data-chevron width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="transition:transform .2s"><path d="M4 6l4 4 4-4"/></svg>`;

    return `<article data-matrimony-card data-matrimony-id="${escapeHtml(row.id)}" class="border border-archive-line bg-archive-cream overflow-hidden">

      <!-- ── Collapsed header (always visible) ── -->
      <div data-card-toggle class="flex items-center gap-4 px-5 py-4 cursor-pointer select-none hover:bg-archive-paper/60 transition-colors">
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2 mb-0.5">
            <span class="text-[10px] font-black uppercase tracking-[.12em] text-archive-gold/80">${isProfile ? 'Candidate' : 'Seeker'}</span>
            <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${statusColour}">${escapeHtml(row.status || 'new')}</span>
          </div>
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h3 class="font-black text-archive-green text-base leading-snug">${escapeHtml(title || '—')}</h3>
            <span class="text-xs text-archive-muted truncate">${escapeHtml(subtitle || '')}</span>
          </div>
          <p class="text-[11px] text-archive-muted/70 mt-0.5">${escapeHtml(createdAt)}</p>
        </div>
        <button type="button" data-card-toggle class="shrink-0 p-1.5 text-archive-muted/50 hover:text-archive-muted" aria-label="Toggle">${iChevron}</button>
      </div>

      <!-- ── Expandable body ── -->
      <div data-card-body style="display:none" class="border-t border-archive-line px-5 pb-5 pt-4">
        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-4">
          <div></div>
          <div class="border border-archive-line bg-white px-4 py-3 text-sm leading-6 text-archive-muted shrink-0">
            <p><strong class="text-archive-ink">Contact:</strong> ${escapeHtml(row.contact_person_name||'—')}</p>
            <p><strong class="text-archive-ink">Phone:</strong> ${escapeHtml(row.phone_whatsapp||'—')}</p>
            ${row.email ? `<p><strong class="text-archive-ink">Email:</strong> ${escapeHtml(row.email)}</p>` : ''}
            ${row.relationship_to_candidate ? `<p><strong class="text-archive-ink">Relation:</strong> ${escapeHtml(row.relationship_to_candidate)}</p>` : ''}
          </div>
        </div>
        <dl class="grid gap-3 md:grid-cols-2">
          ${details.map(([l,v]) => v ? `<div class="border border-archive-line bg-white p-4"><dt class="text-xs font-black uppercase tracking-[0.12em] text-archive-gold">${escapeHtml(l)}</dt><dd class="mt-2 text-sm leading-6 text-archive-muted">${l==='Photograph' ? photoLink(v) : escapeHtml(v)}</dd></div>` : '').join('')}
          ${row.browser_hint ? `<div class="border border-archive-line bg-white p-4"><dt class="text-xs font-black uppercase tracking-[0.12em] text-archive-gold">Device hint</dt><dd class="mt-2 text-sm leading-6 text-archive-muted">${escapeHtml(row.browser_hint)}</dd></div>` : ''}
        </dl>
        <label class="mt-4 grid gap-2 text-sm font-bold text-archive-muted">Private admin notes
          <textarea data-admin-notes rows="3" class="border border-archive-line bg-white p-3 text-archive-ink">${escapeHtml(row.admin_notes||'')}</textarea>
        </label>
        ${isProfile && row.akt_profile_url ? `
        <div class="mt-4 flex flex-wrap items-center gap-2 rounded border border-blue-100 bg-blue-50 px-4 py-3">
          <span class="text-xs font-black uppercase tracking-[.12em] text-blue-700">AKT Profile</span>
          <a href="${escapeHtml(row.akt_profile_url)}" target="_blank" rel="noopener" class="text-xs font-bold text-blue-700 underline underline-offset-2 break-all hover:text-blue-900 flex-1">${escapeHtml(row.akt_profile_url)}</a>
          ${row.akt_verified
            ? `<span class="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black uppercase text-green-700">✓ Verified</span>`
            : `<button data-matrimony-action="akt-verify" class="border border-blue-300 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[.12em] text-blue-700 hover:bg-blue-100 transition-colors" type="button">Mark AKT Verified</button>`}
        </div>` : ''}
        <div class="mt-3 flex flex-wrap gap-2">
          <button data-matrimony-action="notes" class="border border-archive-gold bg-archive-gold px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-archive-ink" type="button">Save notes</button>
          ${['new','reviewing','approved','matched','rejected','archived'].map(s => `<button data-matrimony-action="status" data-status-value="${s}" class="border ${row.status===s ? 'border-archive-gold bg-white text-archive-green font-black' : 'border-archive-line text-archive-muted'} px-3 py-2 text-xs font-black uppercase tracking-[0.12em]" type="button">${s}</button>`).join('')}
        </div>
        ${isProfile ? `
        <div class="mt-3 pt-3 border-t border-archive-line/60">
          <button data-matrimony-action="revoke"
            class="border border-red-300 bg-red-50 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-red-700 hover:bg-red-100 transition-colors" type="button">
            ⟲ Revoke &amp; request resubmission
          </button>
          <p class="mt-1.5 text-[11px] text-archive-muted/70">Member will see your reason on next login and be prompted to resubmit.</p>
        </div>` : ''}
      </div>
    </article>`;
  }

  function updateMatrimonyTypeButtons() {
    matrimonyTypeButtons.forEach(btn => {
      const on = btn.dataset.matrimonyType === currentMatrimonyType;
      btn.className = on
        ? 'rounded-lg bg-archive-gold px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-archive-ink'
        : 'rounded-lg border border-archive-gold px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-archive-green';
    });
  }

  // ── Story submissions ─────────────────────────────────────────────────

  async function renderSubmissions() {
    if (!submissionsList) return;
    let data, error;
    try {
      ({ data, error } = await withTimeout(
        supabase.from('story_submissions').select('*').order('created_at', { ascending: false }).limit(100)
      ));
    } catch (err) {
      submissionsList.innerHTML = `<div class="p-5 text-archive-muted">⏱ ${escapeHtml(err.message)} — <button type="button" onclick="location.reload()" class="font-bold text-archive-green underline">Reload</button></div>`;
      return;
    }
    if (error) { submissionsList.innerHTML = `<div class="p-5 text-archive-muted">${escapeHtml(error.message)}</div>`; return; }
    submissionsList.innerHTML = (data||[]).map(submissionCard).join('') || '<div class="border border-archive-line bg-archive-cream p-5 text-archive-muted">No community story submissions yet.</div>';
  }

  function submissionCard(row) {
    const createdAt = row.created_at ? new Date(row.created_at).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}) : '';
    const STATUSES  = ['pending','approved','rejected','archived'];
    return `<article data-submission-card data-submission-id="${escapeHtml(row.id)}" class="border border-archive-line bg-archive-cream p-5">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.14em] text-archive-gold">Story Submission · ${escapeHtml(row.status||'pending')}${row.category?` · ${escapeHtml(row.category)}`:''}</p>
          <h3 class="mt-2 text-2xl font-black text-archive-green">${escapeHtml(row.title)}</h3>
          <p class="mt-1 text-sm font-bold text-archive-muted">By ${escapeHtml(row.author_name)}</p>
          ${row.author_bio ? `<p class="mt-1.5 text-xs text-archive-muted leading-5 max-w-xl italic">${escapeHtml(row.author_bio)}</p>` : ''}
          <p class="mt-2 text-xs font-bold text-archive-muted">${escapeHtml(createdAt)}</p>
        </div>
        <div class="flex flex-col gap-2">
          ${row.email ? `<div class="border border-archive-line bg-white px-4 py-3 text-sm text-archive-muted"><p><strong class="text-archive-ink">Email:</strong> ${escapeHtml(row.email)}</p></div>` : ''}
          ${row.akt_profile_url ? `<div class="border border-blue-100 bg-blue-50 px-4 py-3 text-sm"><p class="text-xs font-black uppercase tracking-[.1em] text-blue-600 mb-1">AKT Profile</p><a href="${escapeHtml(row.akt_profile_url)}" target="_blank" rel="noopener" class="text-xs font-bold text-blue-700 underline underline-offset-2 break-all">${escapeHtml(row.akt_profile_url)}</a></div>` : ''}
        </div>
      </div>
      <div class="mt-4 border border-archive-line bg-white p-4">
        <p class="mb-3 text-xs font-black uppercase tracking-[0.12em] text-archive-gold">Story content</p>
        <div class="prose-submission text-sm">${row.content||'<em class="text-archive-muted">No content provided.</em>'}</div>
      </div>
      <label class="mt-5 grid gap-2 text-sm font-bold text-archive-muted">Admin notes
        <textarea data-submission-notes rows="2" class="border border-archive-line bg-white p-3 text-archive-ink">${escapeHtml(row.admin_notes||'')}</textarea>
      </label>
      <div class="mt-4 flex flex-wrap gap-2">
        <button data-submission-action="notes" class="border border-archive-gold bg-archive-gold px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-archive-ink" type="button">Save notes</button>
        ${STATUSES.map(s=>`<button data-submission-action="status" data-status-value="${s}" class="border ${row.status===s?'border-archive-gold bg-white text-archive-green font-black':'border-archive-line text-archive-muted'} px-3 py-2 text-xs font-black uppercase tracking-[0.12em]" type="button">${s}</button>`).join('')}
      </div>
    </article>`;
  }

  // ── Drag helpers ─────────────────────────────────────────────────────

  async function persistDraggedOrder() {
    const cards = Array.from(list.querySelectorAll('[data-entry-card]'));
    if (!cards.length) return;
    setStatus('Saving order…');
    const total = cards.length;
    for (const [i, card] of cards.entries()) {
      const { error } = await supabase.from(currentType).update({ sort_order: (total - i) * 10 }).eq('id', card.dataset.entryId);
      if (error) { setStatus(error.message); await renderList(); return; }
    }
    setStatus('Display order saved.');
    await renderList();
  }

  function clearDropTargets() {
    list.querySelectorAll('.is-drop-target').forEach(c => c.classList.remove('is-drop-target'));
  }

  // ── Utilities ────────────────────────────────────────────────────────

  function stripHtml(html)   { return String(html||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(); }
  function photoLink(value)  { const u=safeExternalUrl(value); return u?`<a class="font-bold text-archive-green underline decoration-archive-gold underline-offset-4" href="${escapeHtml(u)}" target="_blank" rel="noopener">Open photograph</a>`:escapeHtml(value); }
  function safeExternalUrl(v){ try{const u=new URL(String(v||'').trim());return['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';} }
  function cssEscape(v)      { return window.CSS?.escape?window.CSS.escape(v):String(v).replace(/"/g,'\\"'); }
  function slugify(v)        { return String(v||'item').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')||`item-${Date.now()}`; }
  function escapeHtml(v)     { return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
})();
