# Iraqi Biradari Website — Project Handoff

**Last updated:** 30 May 2026
**Repository:** `/Users/shiraz/apnonkitalash/iraqibiradari-site`
**Branch:** `main`
**Latest commit:** `76e3bc0` — Fix checkbox labels splitting into columns on mobile
**Live domain:** `https://iraqibiradari.com/`
**Admin panel:** `https://iraqibiradari.com/admin/`
**Supabase project:** `dcslkrgocuxcogvmvfkr` (`mdshiraz.ib@outlook.com`)
**Related platform:** `https://apnonkitalash.com/` (separate genealogy project — do not mix)

---

## Quick Reference — File Map

| Purpose | File |
|---|---|
| Home page | `index.html` |
| About | `about/index.html` |
| Support / Volunteer | `contact/index.html` |
| Events listing | `events/index.html` |
| Event detail (SPA) | `events/detail/index.html` |
| Organizations listing | `organizations/index.html` |
| Organization detail (SPA) | `organizations/detail/index.html` |
| Our Culture / Achievers | `culture/index.html` |
| Culture story detail (SPA) | `culture/detail/index.html` |
| Culture story submission | `culture/submit/index.html` |
| Announcements | `announcements/index.html` |
| Matrimony | `matrimony/index.html` |
| Matrimony Service Policy | `matrimony/policy/index.html` |
| Helpdesk / FAQ | `helpdesk/index.html` |
| Admin panel | `admin/index.html` |
| Nav component | `assets/js/nav.js` |
| Supabase credentials | `assets/js/supabase-config.js` |
| Admin logic | `assets/js/admin.js` |
| Matrimony logic | `assets/js/matrimony.js` |
| Supabase base schema | `supabase/schema.sql` |

---

## 1. Platform Overview

**Iraqi Biradari** (`iraqibiradari.com`) is the public-facing heritage and community platform for the Iraqi Biradari community. It is entirely separate from **Apnon Ki Talash** (`apnonkitalash.com`), which is the private genealogy/Shajra platform.

The IB site is a static HTML/JS/Tailwind site hosted on GitHub Pages. All dynamic content (events, organizations, matrimony, culture stories, etc.) is stored in Supabase and fetched client-side.

**Stack:**
- Static HTML + Tailwind CSS (CDN) + vanilla ES modules
- Supabase (Postgres + Auth + RLS) for all data
- Google OAuth for matrimony member login
- Supabase magic-link for admin login
- No build step — edit and push directly

---

## 2. All Changes Made (Chronological)

### Phase 1 — Foundation (9–10 May 2026)

**Initial site setup (`f8272c1`):**
- Created the Iraqi Biradari heritage portal from scratch.
- Established the brand identity separate from Apnon Ki Talash.
- Set up favicon, logos, and consistent page titles across all pages.

**Branding unification (`1477d91`):**
- All secondary pages unified to show "Iraqi Biradari" — removed "Apnon Ki Talash" references.
- Consistent hero sections across About, Documents, Videos, Events, Contact.

**About page (`e056a19`):**
- Built `about/index.html` — explains the people, mission, and heritage context.
- Home page About section updated.

**Admin panel — Phase 1 (`c6672a9`, `902b068`):**
- Built `admin/index.html` and `assets/js/admin.js`.
- Magic-link authentication for `mdshiraz.ib@outlook.com`.
- CRUD for: Documents, Videos, Events, Announcements.
- Drag-and-drop sort ordering.
- One-time JSON seed tool.

**Support page (`3b1c454`, `f250a23`):**
- `contact/index.html` built with Axis Bank donation details (Foundation era).

**Announcements (`eb449de`):**
- Announcements feature built with publish/unpublish, expandable previews.

**Homepage links and hero reduction (`ed356dc`):**
- Compact hero sections on secondary pages for better mobile UX.
- Homepage links updated.

**Matrimony — Phase 1 (`19c6676`, `c2ff68e`, `719b872`):**
- First version of `matrimony/index.html` — anonymous form-based submission (no auth).
- Two submission flows: candidate profile + seeker requirements.
- Honeypot spam field, consent checkbox, no public listing.
- `photo_url` field added for private photograph links.
- Admin review section added to admin panel.

---

### Phase 2 — Navigation & Content Sections (24–25 May 2026)

**Grouped mobile-first navigation (`9f20b4e`):**
- Rebuilt `assets/js/nav.js` from scratch.
- Left-slide drawer for mobile.
- Grouped nav: About, Community (dropdown), Heritage (dropdown), Organizations, Connect (dropdown — later changed), Support.
- Consistent nav injected across all pages.

**Admin console redesign — Phases 2 & 3 (`4596004`, `c570fec`, `40a1cc9`, `902edc4`):**
- Rebuilt admin UI: slide-over drawer, card list, filter chips, search.
- Full-page 2-column editor layout.
- Added Events section with richer fields (category, registration URL, YouTube embed).
- CSS matched to a design mockup.

**Events & Announcements feature (`4596004`):**
- Events feature: rich content, detail pages, category filters.
- Event ribbon on homepage (shows active upcoming event or "Keep a watch" message).
- Announcements with expandable read-more.

**Our Culture / Achievers (`f9d1b28`, `785e98e`):**
- New `culture/` section: community stories and achievers.
- `culture/index.html` — listing page.
- `culture/submit/index.html` — public story submission form.
- Added Ancestral Places as a category.
- Rich Quill editor with auto-save and video embeds (`5f06c16`).

**Organizations feature (`1fc0065`):**
- New `organizations/` section.
- `organizations/index.html` — listing page.
- `organizations/detail/index.html` — SPA detail page (tabbed: About, Events, Members, Gallery).
- Full CRUD admin for organizations: name, type, founding year, contacts, logo, social links.
- Admin can assign events to an organization.
- Missing RLS admin policies patched (`e426fad`).

---

### Phase 3 — Matrimony v2 Rebuild (28–29 May 2026)

**Matrimony full rebuild (`02685f4`):**
- Tore down the anonymous form approach.
- Rebuilt with 8-stage workflow using Google OAuth authentication.
- New stages: `landing` → `consent` → `gate` → `browse` → `candidate-form` → `requirements-form` → `my-submissions` → `detail`.
- `matrimony_members` table: one record per authenticated user (membership verification step — name, mobile, location, AKT profile link).
- `matrimony_requirements` table: per-user match preferences.
- `matrimony_profiles` table extended: `user_id`, `initials`, `native_location`, `birth_location`, `current_location`, `akt_profile_url`, `published` flag.
- Multi-profile support (one user can submit multiple candidate profiles).
- Admin approve → sets `published = true` → profile appears in browse.
- SQL migration: `supabase/matrimony_migration.sql`.

**Google OAuth sign-in + multi-profile (`51c1c78`):**
- Google OAuth configured as the sole login method.
- Multi-profile architecture confirmed.

**Nav chip dropdown + My Submissions (`a7041ff`):**
- After login: green auth chip in top-right shows signed-in user avatar.
- Dropdown: "My Submissions", "Browse", "Sign out".
- My Submissions page: lists user's own candidate profiles + requirements with status.

**Browse grid redesign (`9311a70`):**
- Browse shows approved/published profiles.
- Card grid layout matching the design prototype.
- Initials avatar, age, location, education, profession shown on cards.

**Phone number display (`bcf1ea5`, `346a276`):**
- Admin detail view shows full phone + WhatsApp contact button.
- Browse/public view masks the phone number until admin-approved connection.

**Marital status normalisation (`2b1635d`):**
- Legacy `marital_status` values normalised to `'fresh'` for consistency.

**Requirement form fixes (`fc08b22`, `5a0f5c5`, `5996a74`, `32d2807`):**
- Fixed upsert vs insert/update logic for requirements form.
- Decoupled gate query from extended columns to prevent crashes.

**AKT profile links + verified badge (`239d0fd`):**
- Optional AKT profile URL field on candidate form.
- Admin can see AKT link in profile card.
- Verified badge shown on browse cards when AKT is confirmed.

**Shortlist heart icon (`88ce583`):**
- Browse cards show a heart icon to shortlist/unshortlist profiles.
- `matrimony_shortlists` table: `(user_id, profile_id)` unique pairs.
- SQL migration: `supabase/matrimony_shortlists_migration.sql`.

**Tab-switch fix + step 3 dots removed (`bec56f0`):**
- Fixed bug where tab-switch in browse was kicking users back to gate.
- Removed extraneous step 3 dots from UI progress indicators.

**Admin: collapsible matrimony cards (`ac913ff`):**
- Admin matrimony cards (profiles, seekers) now collapse/expand with a chevron toggle.
- Reduces cognitive load when reviewing many submissions.

---

### Phase 4 — Organizations & Events Polish (28 May 2026)

**Organization page redesign (`e251cee`):**
- `organizations/index.html` redesigned: richer listing cards, type tags, founding year.
- `organizations/detail/index.html` redesigned: tabbed layout (About / Events / Members / Gallery).
- Admin: new fields for org detail (description, contact, logo URL, type, social links).
- Admin: YouTube embed thumbnails in org event tab.

**Event card fixes (`e445e54`, `da20bde`, `57cf14f`):**
- Event cards made fully clickable using stretched-link pattern.
- Fixed z-index so the stretched link doesn't get blocked by inner elements.
- Org events filtered out of the main events listing page (org events only show under their org).

---

### Phase 5 — Admin Stability Fixes (27–28 May 2026)

A series of fixes to address admin panel instability:

| Commit | Fix |
|---|---|
| `7e6f172` | Made `loadEntryForEdit` async — fixed SyntaxError on admin page load |
| `005d314` | Wrapped form upsert in try/catch — Saving button no longer gets stuck |
| `9ad3fa2` | Replaced upsert with explicit insert/update — fixed save hanging |
| `da0c84f` | Moved helper functions to top of organizations.js, added try/catch |
| `76688ae` | Pinned Supabase SDK version, cached client, added modulepreload to all pages |
| `f97f616` | Timeout safety net + daily keep-alive for Supabase free-tier pausing |
| `8272688` | Added `withTimeout` to all admin.js queries |
| `99f1e9c` | Increased keep-alive interval to 6 hours (free tier pauses after idle) |
| `282bf3c` | Added `withTimeout` to form submit insert/update — root cause of Save freezing |
| `b03bd17` | Stopped editor resetting when Supabase JWT auto-refreshes |
| `bb06a9f` | Fixed three more admin editor reset / data-loss bugs |
| `5ef695b` | Fixed root cause of 10–15s editor reset: `switchSection` was awaiting `loadTabCounts` |

---

### Phase 6 — Home Page, Nav & Support Revamp (29 May 2026)

**Home page updates (`1c4244c`, `c623442`, `a4559a2`):**
- Community Support banner changed to volunteer recruitment banner: "IraqiBiradari.com needs your help. Volunteer with us."
- Heritage cards reordered: Lineage → Matrimony → Community → Archives.
- Community card rewritten to reference Directory and Organizations with sub-links.
- Hero tagline updated.
- Trust Member Registration link fixed to point to `/organizations/`.

**Support page full rewrite (`bdd089e`):**
- Removed all Foundation/trust/Axis Bank/account number content.
- Rebuilt as a volunteer-first page with 9 contribution pathways:
  - Register your Organisation → `https://forms.gle/HKKqpmJ3nqnkXyfF6`
  - Matrimony Coordinator
  - Directory Curator
  - Archives & Documents
  - Our Culture submissions → `https://iraqibiradari.com/culture/submit/`
  - Podcast & Elder Stories → `https://iraqibiradari.com/culture/submit/`
  - Admin Volunteers
  - Financial Contribution → `https://forms.gle/uATjeKCZdsMzWQmM7`
  - WhatsApp Group → `wa.me/919818555830`

**Nav label "Support Us" (`7e92861`):**
- Nav label changed from "Support" to "Support Us" across nav.js and all footer instances.

**Webmaster profile link (`f9d63d5`):**
- Footer webmaster link updated to `https://mdshiraz.com/` (was LinkedIn, which produced errors).

---

### Phase 7 — Matrimony Policy & Compliance (29–30 May 2026)

**Matrimony Service Policy page (`2fe89c0`):**
- Created `matrimony/policy/index.html` — 9-section formal policy document.
- Sections: Purpose, Accuracy of Information, Independent Verification, Code of Conduct, Ghosting Policy, Privacy, No Matchmaking Guarantee, Limitation of Liability, Community Welfare Disclaimer.
- Policy version: `May2026-v1`.

**Activity logging (`2fe89c0`):**
- `logActivity(event_type, meta)` helper added to `matrimony.js`.
- Logs silently to `matrimony_activity_log` table (never blocks UX).
- Events logged: `login`, `browse_open`, `profile_view`, `shortlist_add`, `shortlist_remove`, `policy_agree`, `candidate_submit`, `requirement_submit`.
- SQL migration: `supabase/matrimony_activity_log_migration.sql`.

**Admin Activity Log tab (`2fe89c0`):**
- New "Activity Log" tab in admin matrimony section.
- Shows event type, user email, timestamp, and meta data.

**Policy gate for existing members (`153f0eb`):**
- When an existing member logs in without `policy_agreed_at`, they are intercepted before the dashboard.
- A dedicated `policy-gate` stage shows the full terms with a checkbox.
- Submit button is disabled until checkbox is ticked.
- On agree: updates `matrimony_members` with `policy_agreed_at`, `policy_version`, `user_email`.
- SQL migration: `supabase/matrimony_policy_fields_migration.sql` — adds `policy_agreed_at` and `policy_version` to `matrimony_members`.

**Policy-gate submit button gating (`f92bc4b`):**
- Fixed: submit button starts disabled + greyed (`opacity-40`, `cursor-not-allowed`).
- JS listener enables it only when checkbox is ticked.

**Policy accessibility (`7d08d37`, `acc7798`, `a8879b8`):**
- Policy link available in: auth chip dropdown ("Service Policy"), notice bar above footer, footer nav link, landing page below sign-in CTA.

**Nav: Connect → Matrimony (`70d975f`, `41c1a27`):**
- Replaced "Connect" dropdown (which had Directory + Matrimony) with a direct "Matrimony" top-level link.
- NEW badge was tried (inline, then floating) but removed — was overlapping the nav text.

**Country code selector + phone validation (`f8b63c2`, `10f8dae`):**
- Replaced plain `<input name="mobile">` in consent form with:
  - `<select id="mobile-cc">` — 13 countries with per-country regex (`data-pattern`) and hint (`data-hint`).
  - `<input id="mobile-num">` — number digits only.
  - `<input type="hidden" name="mobile" id="mobile-hidden">` — populated with E.164 value (e.g. `+919876543210`).
- "Other country" option: no regex, accepts 6–15 digits, user enters full number.
- `validateMobile(showErr)` validates on blur and blocks form submit if invalid.

**AKT URL validation + 3-state badge + admin verify (`ebf6827`):**
- `validateAktUrl(showErr)`: URL must start with `https://apnonkitalash.com/` (optional field, empty passes).
- Name advisory box: tells users to use their exact AKT profile name for matching.
- 3-state badge on browse cards:
  - `akt_verified = true` → green "AKT Verified ✓"
  - URL present but not verified → amber "⏳ AKT Pending"
  - No URL → no badge
- Admin: AKT section in profile card with clickable URL + "Mark AKT Verified" button.
- SQL migration: `supabase/matrimony_akt_verified_migration.sql` — adds `akt_verified boolean DEFAULT false` to `matrimony_profiles`.

**Dedicated Consents tab in admin (`10fd3bb`):**
- Separate from Activity Log.
- Queries `matrimony_members WHERE policy_agreed_at IS NOT NULL ORDER BY policy_agreed_at DESC`.
- 4-column grid: Name / Email / Mobile | Location | Policy Version pill | Agreed At timestamp.
- Count shown above the table.

**`user_email` column on `matrimony_members` (`4371afa`, SQL):**
- `user_email text` column added to `matrimony_members`.
- Saved in both: consent form on first join, and policy-gate agree for existing members.
- SQL migration: `supabase/matrimony_member_email_migration.sql`.
- Backfill SQL for existing records: `UPDATE matrimony_members m SET user_email = u.email FROM auth.users u WHERE m.user_id = u.id AND m.user_email IS NULL;`

**Policy version standardised (`4371afa`):**
- Constant `POLICY_VERSION = 'May2026-v1'` in `matrimony.js`.
- Updated everywhere that previously said `2025-v1`.

**Checkbox label mobile fix (`76e3bc0`):**
- Fixed: `flex` on `<label>` was treating each text node and `<a>`/`<strong>` tag as a separate flex column on mobile.
- Fix: wrapped text content in `<span>` on all 5 consent checkboxes across the matrimony page.

---

## 3. Database Schema

### Supabase Project
- **Project ID:** `dcslkrgocuxcogvmvfkr`
- **URL:** `https://dcslkrgocuxcogvmvfkr.supabase.co`
- **Admin email:** `mdshiraz.ib@outlook.com`
- **Anon key location:** `assets/js/supabase-config.js`

### Tables

| Table | Purpose |
|---|---|
| `announcements` | Community announcements, managed in admin |
| `events` | Events with date, category, registration URL |
| `documents` | Heritage documents with Drive links |
| `videos` | Heritage video links |
| `people` | People behind the initiative |
| `stories` | Our Culture / Achievers community stories |
| `organizations` | Community organisations |
| `matrimony_profiles` | Candidate profiles submitted by members |
| `matrimony_requests` | (Legacy) anonymous match requests |
| `matrimony_requirements` | Per-member match preferences |
| `matrimony_members` | Auth-gated membership record (one per user) |
| `matrimony_shortlists` | User shortlisted profiles |
| `matrimony_activity_log` | Per-event audit trail of member activity |

### Key `matrimony_members` columns
```
id, user_id, full_name, mobile, native_location, current_location,
akt_profile_url, user_email, policy_agreed_at, policy_version,
created_at, updated_at
```

### Key `matrimony_profiles` columns
```
id, user_id, candidate_name, initials, photo_url, candidate_gender,
age, marital_status, education, profession, native_location,
birth_location, current_location, family_background, expectations,
akt_profile_url, akt_verified, consent_confirmed, status,
published, admin_notes, created_at, updated_at
```

### `matrimony_activity_log` event types
| Event | Trigger |
|---|---|
| `login` | User signs in |
| `browse_open` | User opens Browse section |
| `profile_view` | User opens a candidate detail |
| `shortlist_add` | User shortlists a profile |
| `shortlist_remove` | User removes a shortlist |
| `policy_agree` | User agrees to matrimony policy |
| `candidate_submit` | User submits a candidate profile |
| `requirement_submit` | User submits match requirements |

---

## 4. SQL Migrations — Status

| File | Purpose | Status |
|---|---|---|
| `supabase/schema.sql` | Base schema (all content tables + original matrimony tables) | Run |
| `supabase/matrimony_migration.sql` | Matrimony v2: `matrimony_members`, `matrimony_requirements`, extends `matrimony_profiles` | Run |
| `supabase/matrimony_policy_fields_migration.sql` | Adds `policy_agreed_at`, `policy_version` to `matrimony_members` | Run |
| `supabase/matrimony_activity_log_migration.sql` | Creates `matrimony_activity_log` table + RLS + indexes | Run |
| `supabase/matrimony_shortlists_migration.sql` | Creates `matrimony_shortlists` table + RLS | Run |
| `supabase/matrimony_member_email_migration.sql` | Adds `user_email` column to `matrimony_members` | **Needs to be run** |
| `supabase/matrimony_akt_verified_migration.sql` | Adds `akt_verified boolean` to `matrimony_profiles` | **Needs to be run** |
| `supabase/matrimony_normalise_marital_status.sql` | Normalises legacy `marital_status` values | Run |

### Email backfill (run after `matrimony_member_email_migration.sql`)
```sql
UPDATE matrimony_members m
SET user_email = u.email
FROM auth.users u
WHERE m.user_id = u.id
  AND m.user_email IS NULL;
```

---

## 5. Navigation Structure (Current)

```
About
Community ▾
  ├─ Events
  ├─ Organizations
  ├─ Our Culture
  └─ People
Heritage ▾
  ├─ Documents
  ├─ Videos
  └─ Announcements
Organizations
Matrimony          ← was "Connect" dropdown, now direct link
Directory          ← PLANNED — not yet live, to be restored in next phase
Helpdesk           ← FAQ and guidance page at /helpdesk/
Support Us
```

---

## 6. Key External Links / Integrations

| Integration | URL / Value |
|---|---|
| Register Organisation form | `https://forms.gle/HKKqpmJ3nqnkXyfF6` |
| Financial Contribution form | `https://forms.gle/uATjeKCZdsMzWQmM7` |
| WhatsApp community | `https://wa.me/919818555830` |
| Culture story submission | `https://iraqibiradari.com/culture/submit/` |
| Webmaster profile | `https://mdshiraz.com/` |
| AKT genealogy platform | `https://apnonkitalash.com/` |
| Admin phone (footer) | `9818555830` |
| Admin location (footer) | Kanpur |
| Webmaster name | Mohammad Shiraz Anwar |

---

## 7. Known Pending Items

### SQL to run in Supabase (urgent)
1. `supabase/matrimony_member_email_migration.sql` — adds `user_email` to `matrimony_members`.
2. `supabase/matrimony_akt_verified_migration.sql` — adds `akt_verified` to `matrimony_profiles`.
3. Run the email backfill SQL above after step 1.

### Features not yet built

#### Directory (next phase — priority)
- The Directory was previously under the "Connect" dropdown alongside Matrimony.
- When Matrimony was promoted to a top-level nav item, Directory was removed from the nav and deferred.
- **Directory needs to be brought back** as its own top-level section (`/directory/`).
- Suggested scope:
  - Searchable listing of community members (name, city, profession, contact).
  - Public-facing with optional login gate for contact details.
  - Admin CRUD to manage and approve directory entries.
  - Separate Supabase table (`directory_members` or similar).
  - Nav entry to be added back alongside Matrimony once ready.

#### Other pending features
- Admin delete button for matrimony records (currently only status change).
- Email notification to admin when a new matrimony submission arrives.
- Matrimony coordinator assignment workflow (`assigned_to`, `follow_up_date`).
- Admin export of matrimony records (CSV/PDF).
- Rate limiting / CAPTCHA for matrimony submission.

### Design / UX
- Visual QA pass on `/matrimony/` on real iOS/Android devices after latest fixes.
- Review admin matrimony cards on narrow laptop screens.

---

## 8. Admin Panel — Section Guide

| Tab | What it manages |
|---|---|
| Events | Create/edit/publish events with date, category, registration URL |
| Announcements | Community notices, expandable previews |
| Documents | Heritage documents with category and Drive links |
| Videos | Heritage videos with YouTube URLs |
| People | People behind the initiative |
| Stories | Our Culture / Achievers community submissions |
| Organizations | Full org CRUD with contacts, type, events, gallery |
| Matrimony → Profiles | Candidate profiles: review, approve, reject, add notes |
| Matrimony → Seekers | Seeker requirements: review, status, notes |
| Matrimony → Consents | One row per member who accepted the policy, with timestamp |
| Matrimony → Activity Log | Full event log: logins, browses, shortlists, submits |

**Admin login:** Magic-link to `mdshiraz.ib@outlook.com`.

---

## 9. Deployment

The site is static and hosted on GitHub Pages behind the `iraqibiradari.com` CNAME.

```bash
# After any change:
git add <files>
git commit -m "description"
git push
# GitHub Pages auto-deploys within ~60 seconds
```

No build step. No CI/CD pipeline. Just push to `main`.

---

## 10. Guiding Principles

1. **Iraqi Biradari ≠ Apnon Ki Talash.** Keep the two platforms strictly separate. IB is the public community hub; AKT is the private genealogy tool. Where Shajra is referenced on IB pages, it links to `apnonkitalash.com`.

2. **No public matrimony directory.** Profiles are only visible to authenticated, admin-approved members. The browse section requires login and membership verification.

3. **Admin is the single source of truth.** All content is Supabase-backed and managed through `/admin/`. No local JSON overrides are active.

4. **Policy version is a constant.** `POLICY_VERSION = 'May2026-v1'` in `matrimony.js` flows into all consent records. To update the policy, bump this constant and update `matrimony/policy/index.html`.

5. **No anonymous matrimony submissions.** The v2 rebuild requires Google OAuth sign-in + membership verification before any profile can be submitted or browsed.
