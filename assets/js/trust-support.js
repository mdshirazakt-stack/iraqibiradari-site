import { createSupabaseClient, withTimeout } from './supabase-config.js';

// Support Us page — "Support the Trust" band.
// 1. Copy buttons next to the bank details.
// 2. Refreshes the Trust's phone/email/address from its Organizations record,
//    so an edit in the admin panel shows here too. The HTML already carries the
//    current values, so if this fetch fails the page still reads correctly.

const TRUST_ORG_ID = 'iraqi-biradari-welfare-foundation-charitable-trust';

document.querySelectorAll('.trust-copy').forEach(btn => {
  btn.addEventListener('click', async () => {
    const value = btn.parentElement.querySelector('[data-copy-value]')?.textContent.trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      btn.textContent = 'Copied';
    } catch {
      btn.textContent = 'Select & copy';
    }
    setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
  });
});

function digitsOnly(phone) {
  return String(phone || '').replace(/\D/g, '');
}

(async function refreshContact() {
  try {
    const supabase = await createSupabaseClient();
    const { data, error } = await withTimeout(
      supabase.from('organizations')
        .select('contact_email,contact_phone,address')
        .eq('id', TRUST_ORG_ID)
        .eq('published', true)
        .single()
    );
    if (error || !data) return;

    const phone = String(data.contact_phone || '').trim();
    const digits = digitsOnly(phone);
    if (phone && digits.length >= 10) {
      document.querySelectorAll('[data-trust-phone-text]').forEach(el => { el.textContent = phone; });
      document.querySelectorAll('[data-trust-whatsapp]').forEach(el => { el.href = `https://wa.me/${digits}`; });
      document.querySelectorAll('[data-trust-call]').forEach(el => { el.href = `tel:+${digits}`; });
    }
    const email = String(data.contact_email || '').trim();
    if (email.includes('@')) {
      document.querySelectorAll('[data-trust-email-text]').forEach(el => { el.textContent = email; });
      document.querySelectorAll('[data-trust-email]').forEach(el => { el.href = `mailto:${email}`; });
    }
    const address = String(data.address || '').trim();
    if (address) {
      document.querySelectorAll('[data-trust-address-text]').forEach(el => { el.textContent = address; });
    }
  } catch {
    // keep the values already in the page
  }
})();
