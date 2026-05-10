import { createSupabaseClient } from './supabase-config.js';

(async function () {
  const supabase = await createSupabaseClient();
  const status = document.querySelector('[data-matrimony-status]');
  const profileForm = document.querySelector('[data-matrimony-profile-form]');
  const requestForm = document.querySelector('[data-matrimony-request-form]');

  if (!profileForm && !requestForm) return;

  wireForm(profileForm, 'matrimony_profiles', profilePayload);
  wireForm(requestForm, 'matrimony_requests', requestPayload);

  function wireForm(form, table, mapper) {
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitButton = form.querySelector('button[type="submit"]');
      const data = new FormData(form);

      if (String(data.get('website') || '').trim()) {
        form.reset();
        showStatus('Thank you. Your submission has been received for review.', false);
        return;
      }

      if (data.get('consent') !== 'on') {
        showStatus('Please confirm consent before submitting.', true);
        return;
      }

      const payload = {
        ...mapper(data),
        consent_confirmed: true,
        browser_hint: browserHint()
      };

      submitButton.disabled = true;
      submitButton.textContent = 'Submitting...';
      showStatus('Submitting securely...', false);

      const { error } = await supabase.from(table).insert(payload);
      submitButton.disabled = false;
      submitButton.textContent = table === 'matrimony_profiles' ? 'Submit profile' : 'Submit requirement';

      if (error) {
        showStatus(error.message || 'Submission failed. Please try again.', true);
        return;
      }

      form.reset();
      showStatus('Thank you. Your submission has been received for private admin review.', false);
    });
  }

  function profilePayload(data) {
    return {
      candidate_name: text(data, 'candidate_name'),
      photo_url: text(data, 'photo_url') || null,
      candidate_gender: text(data, 'candidate_gender'),
      age: numberOrNull(data.get('age')),
      marital_status: text(data, 'marital_status') || null,
      education: text(data, 'education') || null,
      profession: text(data, 'profession') || null,
      city: text(data, 'city') || null,
      country: 'India',
      family_background: text(data, 'family_background') || null,
      expectations: text(data, 'expectations') || null,
      contact_person_name: text(data, 'contact_person_name'),
      relationship_to_candidate: text(data, 'relationship_to_candidate') || null,
      phone_whatsapp: text(data, 'phone_whatsapp'),
      email: text(data, 'email') || null,
      status: 'new'
    };
  }

  function requestPayload(data) {
    return {
      seeker_name: text(data, 'seeker_name'),
      seeking_for: text(data, 'seeking_for') || null,
      preferred_gender: text(data, 'preferred_gender') || null,
      preferred_age_range: text(data, 'preferred_age_range') || null,
      preferred_location: text(data, 'preferred_location') || null,
      expectations: text(data, 'expectations') || null,
      contact_person_name: text(data, 'contact_person_name'),
      phone_whatsapp: text(data, 'phone_whatsapp'),
      email: text(data, 'email') || null,
      status: 'new'
    };
  }

  function browserHint() {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const size = window.screen ? `${window.screen.width}x${window.screen.height}` : '';
    return [navigator.language, timeZone, size].filter(Boolean).join(' · ');
  }

  function text(data, key) {
    return String(data.get(key) || '').trim();
  }

  function numberOrNull(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function showStatus(message, isError) {
    if (!status) return;
    status.hidden = false;
    status.classList.remove('hidden', 'text-archive-muted', 'text-red-700');
    status.classList.add(isError ? 'text-red-700' : 'text-archive-muted');
    status.textContent = message;
    status.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
})();
