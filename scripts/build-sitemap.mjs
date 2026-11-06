// Builds sitemap.xml: the site's fixed pages plus every published detail page
// (achievers, culture stories, events, announcements, organizations), which
// are rendered client-side and otherwise hard for Google to discover.
//
// Run: node scripts/build-sitemap.mjs   (also run daily by
// .github/workflows/sitemap.yml, which commits the result when it changes)

import { readFile, writeFile } from 'node:fs/promises';

const SITE = 'https://iraqibiradari.com';

// Reuse the public anon credentials from the site's own config rather than
// duplicating them (the file is a browser module, so read the constants).
const config = await readFile(new URL('../assets/js/supabase-config.js', import.meta.url), 'utf8');
const SUPABASE_URL = config.match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
const ANON_KEY = config.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)[1];

const STATIC_PAGES = [
  '/', '/about/', '/announcements/', '/contact/', '/culture/', '/directory/',
  '/documents/', '/events/', '/helpdesk/', '/matrimony/', '/matrimony/policy/',
  '/organizations/', '/people/', '/videos/',
];

// table → detail page; hasUpdated: whether the table has an updated_at column
const DETAIL_SOURCES = [
  { table: 'people',        path: '/people/detail/',        hasUpdated: false },
  { table: 'stories',       path: '/culture/detail/',       hasUpdated: false },
  { table: 'events',        path: '/events/detail/',        hasUpdated: true },
  { table: 'announcements', path: '/announcements/detail/', hasUpdated: true },
  { table: 'organizations', path: '/organizations/detail/', hasUpdated: true },
];

async function fetchRows(table, hasUpdated) {
  const cols = hasUpdated ? 'id,created_at,updated_at' : 'id,created_at';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${cols}&published=eq.true&order=created_at.asc`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const urls = STATIC_PAGES.map(p => ({ loc: SITE + p }));
for (const src of DETAIL_SOURCES) {
  for (const row of await fetchRows(src.table, src.hasUpdated)) {
    const stamp = row.updated_at || row.created_at;
    urls.push({
      loc: `${SITE}${src.path}?id=${encodeURIComponent(row.id)}`,
      lastmod: stamp ? new Date(stamp).toISOString().slice(0, 10) : null,
    });
  }
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${xmlEscape(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
await writeFile(new URL('../sitemap.xml', import.meta.url), xml);
console.log(`sitemap.xml: ${urls.length} URLs`);
