// "Coming soon" gate for the Obituaries section.
//
// While OBITUARIES_LIVE is false, visitors see a "Coming soon" notice instead of
// the real pages (so nobody can post before launch), and the menu tags the link
// "Soon". The site owner can preview the real pages on any device by opening
//     https://iraqibiradari.com/obituaries/?preview
// once (and ?nopreview to switch back). To launch publicly: set OBITUARIES_LIVE
// to true below. Nothing else needs to change.

export const OBITUARIES_LIVE = true;

const PREVIEW_KEY = 'ib_obit_preview';

(function applyPreviewLink() {
  try {
    const url = new URL(location.href);
    const on = url.searchParams.has('preview');
    const off = url.searchParams.has('nopreview');
    if (!on && !off) return;
    if (on) localStorage.setItem(PREVIEW_KEY, '1'); else localStorage.removeItem(PREVIEW_KEY);
    url.searchParams.delete('preview'); url.searchParams.delete('nopreview');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch { /* storage blocked */ }
})();

export function obituariesOpen() {
  if (OBITUARIES_LIVE) return true;
  try { return localStorage.getItem(PREVIEW_KEY) === '1'; } catch { return false; }
}

/** Loads the real page script, or shows "Coming soon" to the public. */
export async function openOrSoon(entry) {
  if (obituariesOpen()) { await import(`./${entry}`); return; }
  const main = document.querySelector('main');
  if (!main) return;
  main.innerHTML = `
    <section class="bg-archive-green py-10 md:py-14 text-archive-cream">
      <div class="mx-auto w-[min(1120px,calc(100%-36px))]">
        <p class="text-xs font-black uppercase tracking-[0.18em] text-archive-goldSoft">In Memoriam</p>
        <h1 class="mt-3 font-display text-4xl font-bold leading-tight text-white md:text-5xl">Obituaries.</h1>
      </div>
    </section>
    <section class="py-16">
      <div class="mx-auto w-[min(760px,calc(100%-36px))] border border-archive-line bg-white p-8 text-center">
        <p class="font-display text-3xl font-bold text-archive-green">Coming soon</p>
        <p class="mt-3 text-base leading-7 text-archive-muted">We are preparing a dedicated place where the community can announce the passing of our members and remember them together. Please check back soon.</p>
        <p class="mt-6"><a href="/" class="text-xs font-black uppercase tracking-[0.14em] text-archive-green underline">Back to the home page</a></p>
      </div>
    </section>`;
}
