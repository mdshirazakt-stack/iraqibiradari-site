import { createSupabaseClient } from './supabase-config.js';

(async function () {
  const form        = document.getElementById('story-submit-form');
  const submitBtn   = document.getElementById('submit-btn');
  const successEl   = document.getElementById('submit-success');
  const errorEl     = document.getElementById('submit-error');
  const errorText   = document.getElementById('submit-error-text');
  const draftNotice = document.getElementById('draft-notice');
  const clearDraftBtn = document.getElementById('clear-draft');
  const draftSavedEl = document.getElementById('draft-saved');

  if (!form) return;

  const DRAFT_KEY = 'ib-culture-story-draft';

  // ── Quill editor ──────────────────────────────────────────────────────
  const quill = new Quill('#story-quill', {
    theme: 'snow',
    placeholder: 'Write your story here… Start with what you remember most vividly.',
    modules: {
      toolbar: [
        [{ header: [2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link', 'image', 'video'],
        ['clean'],
      ],
    },
  });

  // Custom image handler: prompt for URL instead of base64 upload
  quill.getModule('toolbar').addHandler('image', () => {
    const url = prompt('Paste a direct image URL (e.g. from Google Drive, Dropbox, or an image hosting site):');
    if (url && url.trim()) {
      const range = quill.getSelection(true);
      quill.insertEmbed(range.index, 'image', url.trim(), 'user');
      quill.setSelection(range.index + 1, 'silent');
    }
  });

  // Custom video handler: convert YouTube watch/share URLs to embed format
  quill.getModule('toolbar').addHandler('video', () => {
    const raw = prompt('Paste a YouTube video URL:');
    if (!raw || !raw.trim()) return;
    const embedUrl = toYouTubeEmbed(raw.trim());
    if (!embedUrl) {
      alert('Please paste a valid YouTube URL (e.g. https://www.youtube.com/watch?v=… or https://youtu.be/…)');
      return;
    }
    const range = quill.getSelection(true);
    quill.insertEmbed(range.index, 'video', embedUrl, 'user');
    quill.setSelection(range.index + 1, 'silent');
  });

  // ── Draft: restore on load ─────────────────────────────────────────────
  const saved = loadDraft();
  if (saved) {
    restoreFormFromDraft(saved);
    if (draftNotice) draftNotice.style.display = 'flex';
  }

  clearDraftBtn?.addEventListener('click', () => {
    clearDraft();
    form.reset();
    quill.root.innerHTML = '';
    if (draftNotice) draftNotice.style.display = 'none';
  });

  // ── Draft: auto-save on changes ───────────────────────────────────────
  let draftTimer;
  let savedIndicatorTimer;

  function scheduleSave() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      saveDraft();
      showSavedIndicator();
    }, 1200);
  }

  ['author_name', 'email', 'category', 'title'].forEach(name => {
    form.elements[name]?.addEventListener('input', scheduleSave);
  });
  quill.on('text-change', scheduleSave);

  function saveDraft() {
    const draft = {
      author_name: form.elements.author_name?.value || '',
      email:       form.elements.email?.value || '',
      category:    form.elements.category?.value || '',
      title:       form.elements.title?.value || '',
      body:        quill.root.innerHTML,
      ts:          Date.now(),
    };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* storage full */ }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }

  function restoreFormFromDraft(draft) {
    if (draft.author_name && form.elements.author_name) form.elements.author_name.value = draft.author_name;
    if (draft.email      && form.elements.email)       form.elements.email.value       = draft.email;
    if (draft.category   && form.elements.category)    form.elements.category.value    = draft.category;
    if (draft.title      && form.elements.title)       form.elements.title.value       = draft.title;
    if (draft.body && draft.body !== '<p><br></p>') {
      quill.root.innerHTML = draft.body;
    }
  }

  function showSavedIndicator() {
    if (!draftSavedEl) return;
    draftSavedEl.style.display = 'block';
    clearTimeout(savedIndicatorTimer);
    savedIndicatorTimer = setTimeout(() => {
      draftSavedEl.style.display = 'none';
    }, 2000);
  }

  // ── Form submit ───────────────────────────────────────────────────────
  const supabase = await createSupabaseClient();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Flush Quill to hidden input
    const quillHtml = quill.root.innerHTML;
    const bodyValue = quillHtml === '<p><br></p>' ? '' : quillHtml;
    const bodyInput = form.querySelector('[name="body"]');
    if (bodyInput) bodyInput.value = bodyValue;

    const fd          = new FormData(form);
    const author_name = String(fd.get('author_name') || '').trim();
    const email       = String(fd.get('email') || '').trim() || null;
    const category    = String(fd.get('category') || '').trim() || null;
    const title       = String(fd.get('title') || '').trim();
    const content     = bodyValue; // Quill HTML

    if (!author_name || !title || !category) {
      showError('Please fill in your name, a category, and a story title.');
      return;
    }
    if (!content || content === '<p><br></p>') {
      showError('Please write your story before submitting.');
      return;
    }

    hideError();
    submitBtn.disabled    = true;
    submitBtn.textContent = 'Submitting…';

    const { error } = await supabase
      .from('story_submissions')
      .insert({
        title,
        author_name,
        email,
        category,
        content,              // stores Quill HTML
        status:     'pending',
        created_at: new Date().toISOString(),
      });

    submitBtn.disabled    = false;
    submitBtn.textContent = 'Submit story';

    if (error) {
      showError(error.message || 'Something went wrong. Please try again.');
      return;
    }

    clearDraft();
    form.style.display      = 'none';
    successEl.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ── Utilities ──────────────────────────────────────────────────────────
  function toYouTubeEmbed(url) {
    try {
      const u = new URL(url);
      let videoId = null;
      if (u.hostname === 'youtu.be') {
        videoId = u.pathname.slice(1).split('?')[0];
      } else if (u.hostname.includes('youtube.com')) {
        if (u.pathname.startsWith('/embed/')) return url; // already embed
        videoId = u.searchParams.get('v');
      }
      if (!videoId) return null;
      return `https://www.youtube.com/embed/${videoId}?rel=0`;
    } catch {
      return null;
    }
  }

  function showError(msg) {
    if (!errorEl || !errorText) return;
    errorText.textContent = msg;
    errorEl.style.display = 'block';
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function hideError() {
    if (errorEl) errorEl.style.display = 'none';
  }
})();
