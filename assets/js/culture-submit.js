import { createSupabaseClient } from './supabase-config.js';

(async function () {
  const form       = document.getElementById('story-submit-form');
  const submitBtn  = document.getElementById('submit-btn');
  const successEl  = document.getElementById('submit-success');
  const errorEl    = document.getElementById('submit-error');
  const errorText  = document.getElementById('submit-error-text');
  if (!form) return;

  const supabase = await createSupabaseClient();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fd          = new FormData(form);
    const author_name = String(fd.get('author_name') || '').trim();
    const email       = String(fd.get('email') || '').trim() || null;
    const category    = String(fd.get('category') || '').trim() || null;
    const title       = String(fd.get('title') || '').trim();
    const content     = String(fd.get('content') || '').trim();

    if (!author_name || !title || !content || !category) {
      showError('Please fill in all required fields.');
      return;
    }

    hideError();
    submitBtn.disabled     = true;
    submitBtn.textContent  = 'Submitting…';

    const { error } = await supabase
      .from('story_submissions')
      .insert({
        title,
        author_name,
        email,
        category,
        content,
        status:    'pending',
        created_at: new Date().toISOString(),
      });

    submitBtn.disabled    = false;
    submitBtn.textContent = 'Submit story';

    if (error) {
      showError(error.message || 'Something went wrong. Please try again.');
      return;
    }

    // Show success, hide form
    form.style.display    = 'none';
    successEl.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  function showError(msg) {
    if (!errorEl || !errorText) return;
    errorText.textContent  = msg;
    errorEl.style.display  = 'block';
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function hideError() {
    if (errorEl) errorEl.style.display = 'none';
  }
})();
