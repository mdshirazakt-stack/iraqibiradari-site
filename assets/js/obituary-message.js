// Dates and the ready-to-send WhatsApp messages for obituaries.
//
// Two styles, following the community's own notices:
//   'en' — formal English ("Demise in Kolkata …")
//   'ru' — Roman Urdu ("Nihayat hi afsos ke sath ittala di ja rahi hai …")
//
// The message may include things that are NEVER stored or shown on the website:
// the street address and condolence phone numbers (the `priv` argument). They
// exist only in the poster's browser.

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// One shared formatter (constructing Intl objects per call is slow and leaks native memory).
const IST_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });

/** Today's date in India, as YYYY-MM-DD. */
export function todayIst() { return IST_DAY.format(new Date()); }

export function parseYmd(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function addDays(s, n) {
  const d = parseYmd(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Whole days from b to a (a − b). */
export function diffDays(a, b) { return Math.round((parseYmd(a) - parseYmd(b)) / 86400000); }
export function weekdayName(s) { return DAYS[parseYmd(s).getUTCDay()]; }
export function isFriday(s) { return !!s && parseYmd(s).getUTCDay() === 5; }

function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`;
}
/** "Friday the 20th October 2026" */
export function longDate(s) {
  const d = parseYmd(s);
  return `${DAYS[d.getUTCDay()]} the ${ordinal(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
/** "20 October 2026" */
export function shortDate(s) {
  const d = parseYmd(s);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
/** "Tue 24 Nov" */
export function dayMonth(s) {
  const d = parseYmd(s);
  return `${DAYS[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
}

const clean = (v) => String(v ?? '').trim();

// ── Relations (free text: "wife of" + "Late Abdul Qadir") ────────────────
const LATE = /^late\s+/i;

function relLabel(r) {
  let l = clean(r.label).replace(/\s+/g, ' ');
  if (!l && r.rel) l = String(r.rel);              // older records stored a fixed keyword
  if (!l) return '';
  return /\bof$/i.test(l) ? l : `${l} of`;
}
function relName(r) {
  const n = clean(r.name);
  return r.late && !LATE.test(n) ? `Late ${n}` : n;  // older records had a separate "late" flag
}
/** "wife of Late Abdul Qadir" */
export function relationPhrase(r) { return `${relLabel(r)} ${relName(r)}`.trim(); }

// Roman Urdu for whatever the person typed; more specific words first.
const RU_RELATIONS = [
  ['saalee', 'ki', 'saali'], ['saali', 'ki', 'saali'], ['sali', 'ki', 'saali'],
  ['bhabhi', 'ki', 'bhabhi'], ['bhabi', 'ki', 'bhabhi'],
  ['daughter in law', 'ki', 'bahu'], ['bahu', 'ki', 'bahu'],
  ['son in law', 'ke', 'damad'], ['damad', 'ke', 'damad'],
  ['saalaa', 'ke', 'saale'], ['saala', 'ke', 'saale'], ['sala', 'ke', 'saale'],
  ['behnoi', 'ke', 'behnoi'], ['behnoyi', 'ke', 'behnoi'],
  ['khala', 'ki', 'khala'], ['phuphi', 'ki', 'phuphi'], ['phupho', 'ki', 'phuphi'],
  ['chachi', 'ki', 'chachi'], ['mamani', 'ki', 'mamani'],
  ['mamu', 'ke', 'mamu'], ['khalu', 'ke', 'khalu'], ['phuppa', 'ke', 'phuppa'], ['phupha', 'ke', 'phuppa'], ['chacha', 'ke', 'chacha'],
  ['daughter', 'ki', 'sahabzadi'], ['son', 'ke', 'sahabzade'], ['wife', 'ki', 'ahliya'], ['husband', 'ke', 'shohar'],
  ['mother', 'ki', 'walida'], ['father', 'ke', 'walid'], ['brother', 'ke', 'bhai'], ['sister', 'ki', 'behan'],
];
function ruRelation(label, female) {
  const words = ` ${label.toLowerCase().replace(/\bof$/, '').replace(/[^a-z]+/g, ' ').trim()} `;
  for (const [key, particle, noun] of RU_RELATIONS) if (words.includes(` ${key} `)) return [particle, noun];
  const plain = label.replace(/\s+of$/i, '').trim();
  return [female ? 'ki' : 'ke', plain || 'rishtedar'];
}

function contactLine(c) {
  const name = clean(c.name), number = clean(c.number);
  return name && number ? `${name}:- ${number}` : (number || name);
}

// ── English ──────────────────────────────────────────────────────────────
function relationsEn(o) {
  // lower-case start: it continues a sentence ("… Name wife of Late X and mother of Y")
  return (o.relations || []).map(r => { const p = relationPhrase(r); return p.charAt(0).toLowerCase() + p.slice(1); }).join(' and ');
}

function leavesEn(o, priv) {
  if (!o.leaves_from_kind) return '';
  // (The address, if given, is already stated in the "presently residing at" line.)
  const from = o.leaves_from_kind === 'residence' ? 'the residence' : clean(o.leaves_from_other);
  if (!from) return '';
  return `The Janaaza will leave from ${from}${clean(o.leaves_from_time) ? ` at ${clean(o.leaves_from_time)}` : ''}.`;
}

function janazaEn(o, today) {
  const date = o.janaza_date;
  if (!date && !clean(o.janaza_place) && !clean(o.janaza_timing)) return '';
  let dateWord = '';
  if (date) {
    const d = diffDays(date, today);
    dateWord = d === 0 ? `today, ${longDate(date)}` : d === 1 ? `tomorrow, ${longDate(date)}` : longDate(date);
  }
  let s = 'Janaaza Namaaz will be performed';
  if (dateWord) s += ` ${dateWord}`;
  if (clean(o.janaza_place)) s += ` at ${clean(o.janaza_place)}`;
  if (clean(o.janaza_timing)) s += ` ${clean(o.janaza_timing)}`;
  if (clean(o.burial_text)) s += ` and the subsequent Tadfeen will be done ${clean(o.burial_text)}`;
  return `${s}.`;
}

function english(o, priv, url) {
  const today = todayIst();
  const lines = [`Demise in ${clean(o.city)}`];
  const who  = [clean(o.honorific), clean(o.name)].filter(Boolean).join(' ');
  const rels = relationsEn(o);
  const home = clean(priv.address) || clean(o.residence_area);
  const d = diffDays(o.passed_on, today);
  const when = d === 0 ? 'today' : d === -1 ? 'yesterday' : `on ${longDate(o.passed_on)}`;
  lines.push(`${who}${rels ? ` ${rels}` : ''}${home ? `, presently residing at ${home}` : ''} has passed away ${when}.`);
  const leaves = leavesEn(o, priv);
  if (leaves) lines.push(leaves);
  const jz = janazaEn(o, today);
  if (jz) lines.push(jz);
  if (clean(o.message)) lines.push(clean(o.message));
  const contacts = (priv.contacts || []).filter(c => clean(c.number) || clean(c.name));
  if (contacts.length) {
    lines.push('For Condolence📱');
    contacts.forEach(c => lines.push(contactLine(c)));
  }
  if (url) lines.push(`🔗 ${url}`);
  return lines.join('\n');
}

// ── Roman Urdu ───────────────────────────────────────────────────────────
const RU_BURIAL = {
  'at the same place':         'wahin par',
  'in the adjoining qabristan': 'qareeb ke qabristan me',
};

function timingRu(t) {
  const m = /^after (\w+) namaaz\b(.*)$/i.exec(clean(t));
  return m ? `bad namaz ${m[1].toLowerCase()}${m[2]}` : clean(t);
}

function romanUrdu(o, priv, url) {
  const today = todayIst();
  const female = o.gender === 'female';
  const verb = female ? 'thin' : 'the';
  const hon  = clean(o.honorific) || (female ? 'mohtarma' : 'janab');
  const rels = (o.relations || []).map(r => {
    const [particle, noun] = ruRelation(relLabel(r), female);
    const n = clean(r.name);
    const late = r.late || LATE.test(n);
    return `${late ? 'marhoom ' : ''}${n.replace(LATE, '')} ${particle} ${noun} ${verb}`;
  }).join(' aur ');
  const area = clean(o.residence_area) || clean(priv.address);
  const live = area ? ` aur ${area} me ${female ? 'rahti thin' : 'rahte the'}` : '';
  const marhoom = female ? 'Marhooma' : 'Marhoom';

  const lines = [
    `Wafaat in ${clean(o.city)}`,                        // headline, like "Demise in Kolkata"
    'Assalam alaikum wa rahmatullah wa barakatahu',
    `Nihayat hi afsos ke sath ittala di ja rahi hai ki ${hon} ${clean(o.name)} ${female ? 'sahiba' : 'sahab'} ka intaqal ho gaya hai${rels ? `, jo ${rels}` : ''}${live}. ` +
      `Inna lillahe wa inna alaihe rajeoon. Allah pak ${marhoom.toLowerCase()} ki maghfirat farmaye aur unko jannatul firdaus me ala maqam ata farmaey. Aameen`,
  ];

  // Janaza paragraph
  const from = o.leaves_from_kind === 'residence'
    ? `unke ghar${clean(priv.address) ? ` ${clean(priv.address)}` : ''}`
    : o.leaves_from_kind === 'other' ? clean(o.leaves_from_other) : '';
  const leaves = from
    ? `${marhoom} ka janaza ${from}${clean(o.leaves_from_time) ? ` se ${clean(o.leaves_from_time)} pe` : ''} uthega aur `
    : `${marhoom} ki `;
  let dateWord = '';
  if (o.janaza_date) {
    const d = diffDays(o.janaza_date, today);
    dateWord = d === 0 ? 'aaj' : d === 1 ? 'kal' : `${weekdayName(o.janaza_date)} ${shortDate(o.janaza_date)}`;
  }
  if (from || dateWord || clean(o.janaza_place) || clean(o.janaza_timing)) {
    let s = `${leaves}Namaz janaza inshaAllah`;
    if (dateWord) s += ` ${dateWord}`;
    if (clean(o.janaza_place)) s += ` ${clean(o.janaza_place)} me`;
    if (clean(o.janaza_timing)) s += ` ${timingRu(o.janaza_timing)}`;
    s += ' hogi';
    const burial = clean(o.burial_text);
    if (burial) s += ` aur tadfeen bhi ${RU_BURIAL[burial.toLowerCase()] || burial} hogi`;
    lines.push(s);
  }
  if (clean(o.message)) lines.push(clean(o.message));
  lines.push('Aap sabhi hazrat se shirkat aur maghfirat ki dua ki darkhwast hai');

  const contacts = (priv.contacts || []).filter(c => clean(c.number) || clean(c.name));
  if (contacts.length) {
    lines.push('Taziyat ke liye 📱');
    contacts.forEach(c => lines.push(contactLine(c)));
  }
  if (url) lines.push(`🔗 ${url}`);
  return lines.join('\n');
}

/**
 * Builds the WhatsApp message.
 * @param {'en'|'ru'} style
 * @param {object} o     public obituary fields
 * @param {object} priv  { address, contacts: [{name, number}] } — never stored on the website
 * @param {string} [url] link to the obituary page
 */
export function buildMessage(style, o, priv = {}, url = '') {
  return style === 'ru' ? romanUrdu(o, priv, url) : english(o, priv, url);
}

export function whatsappLink(text) { return `https://wa.me/?text=${encodeURIComponent(text)}`; }
