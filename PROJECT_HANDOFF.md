# Iraqi Biradari Website Handoff

Last updated: 10 May 2026  
Repository: `/Users/shiraz/apnonkitalash/iraqibiradari-site`  
Branch: `main`  
Latest pushed commit: `19c6676 Add private matrimony workflow`  
Live domain: `https://iraqibiradari.com/`  
Related genealogy platform: `https://apnonkitalash.com/`

## 1. Starting Point

The work began with two related but separate web properties:

- **Apnon Ki Talash / Shajra** at `apnonkitalash.com`
  - Existing genealogy/tree platform.
  - Has its own `index.html` and `admin.html`.
  - Uses GEDCOM upload/parsing and a separate Supabase project/account.
  - Connected with `mdshiraz.akt@gmail.com`.

- **Iraqi Biradari** at `iraqibiradari.com`
  - Intended as the public heritage, archive, events, videos, announcements, support, and community platform.
  - Should not appear as “Apnon Ki Talash” because Shajra is a separate genealogy tool.
  - Uses a different Supabase project/account.
  - Connected with `mdshiraz.ib@outlook.com`.

The initial Iraqi Biradari site had branding inconsistencies:

- Page title showed “Apnon Ki Talash”.
- Top ribbon/header also carried “Apnon Ki Talash”.
- Logo/icon handling needed to use the Iraqi Biradari assets.
- Secondary pages had inconsistent page title and header branding.

## 2. Major Decisions Made

### Separate Brand Identities

`iraqibiradari.com` is now positioned as the **Iraqi Biradari Heritage Platform**.

`apnonkitalash.com` remains the **Shajra / genealogy tree platform**.

Where the word **Shajra** appears on Iraqi Biradari pages, it should link to `https://apnonkitalash.com/`.

### Iraqi Biradari Site Scope

The Iraqi Biradari website is now treated as the public gateway for:

- Community announcements
- Events
- Documents
- Videos
- Support/foundation information
- About/people behind the initiative
- Matrimony assistance
- Links into Shajra where relevant

### Supabase Use

Supabase is used for content management and public rendering.

Current Iraqi Biradari Supabase project:

- Project ID: `dcslkrgocuxcogvmvfkr`
- URL: `https://dcslkrgocuxcogvmvfkr.supabase.co`
- Admin email: `mdshiraz.ib@outlook.com`

The anon public key is stored in:

- `assets/js/supabase-config.js`

The schema is maintained in:

- `supabase/schema.sql`

## 3. What Has Been Built

### Branding and Design

The site now uses Iraqi Biradari branding consistently:

- Correct page title: `Iraqi Biradari`
- Correct top identity: `Iraqi Biradari Heritage Platform`
- Iraqi Biradari logo and favicon files are used.
- Header logo treatment was adjusted so the white rounded logo image blends better with the cream page background.
- The home page was redesigned around heritage, community, documents, videos, support, events, and Shajra references.

Important files:

- `index.html`
- `Iraquibiradari-final-logo.png`
- `Iraquibiradari-final-logo-2.png`
- `iraqi_biradari_favicon.ico`
- `iraqi_biradari_favicon_16x16.png`
- `iraqi_biradari_favicon_32x32.png`

### Navigation and Page Uniformity

The following pages now share Iraqi Biradari identity and navigation:

- `/`
- `/about/`
- `/announcements/`
- `/documents/`
- `/videos/`
- `/events/`
- `/contact/`
- `/matrimony/`
- `/admin/`

The secondary-page hero sections were reduced so mobile users are not forced through overly large green intro blocks before seeing real content.

### About Page

A final About Us page was added:

- `about/index.html`

It explains:

- The people behind the initiative
- How they contribute
- Heritage preservation work
- Shajra separation
- Support/foundation route

The home page About content was also updated using a short summary adapted from:

- `https://en.wikipedia.org/wiki/Iraqi_Biradari`

Credit is shown on the page.

### Support Page

The contact page was repurposed into a support/foundation page:

- `contact/index.html`

Current bank details:

- Account Name: `INDIA IRAQUI BIRADARE WELFARE FOUNDATION CHARITABLE TRUST`
- Bank: `AXIS BANK`
- Branch: `Kumhrar, Patna - 800020`
- Account No.: `925020022131364`
- IFSC Code: `UTIB0002848`

Important note shown:

- `We do not accept foreign donations.`

### Admin Panel

The admin panel is at:

- `/admin/`

It uses Supabase magic-link login for:

- `mdshiraz.ib@outlook.com`

Admin can currently manage:

- Documents
- Videos
- Events
- Announcements
- Matrimony submissions

Important files:

- `admin/index.html`
- `assets/js/admin.js`
- `assets/js/supabase-config.js`

### Content Tables

Supabase-backed content tables:

- `announcements`
- `events`
- `documents`
- `videos`

Features already implemented:

- Create content
- Edit title/description/metadata
- Publish/unpublish
- Delete
- Drag-and-drop display ordering
- One-time starter JSON seed tool
- Public pages read Supabase first and can fall back to local JSON where implemented

### Events Behavior

Homepage event ribbon now says:

- `Upcoming Events: No upcoming events. Keep a watch.`

When an event is published with:

- Future/current event date
- Registration URL
- Published status

then the ribbon can show an active event with attention-grabbing animation.

To delist an event:

- Let the event date pass, or
- Unpublish it in admin

### Announcements Page

Announcements are blog-like:

- Small preview content
- Expandable/read-more style behavior
- Managed through admin

Useful for:

- Appeals
- Community announcements
- Notices
- Public messages

### Documents and Videos

Documents and videos are Supabase-backed and admin-managed.

Existing Drive archive material was curated selectively. Useless or irrelevant content, such as old tree export files, should not be published unless needed later.

### Matrimony Section

Newest work added a private, moderated matrimony workflow.

Public page:

- `/matrimony/`
- File: `matrimony/index.html`

Frontend script:

- `assets/js/matrimony.js`

Admin review:

- Built into `/admin/`
- Implemented in `assets/js/admin.js`

Supabase tables added:

- `matrimony_profiles`
- `matrimony_requests`

Design decision:

- There is **no public profile directory**.
- There is **no public browsing/searching of candidates**.
- Visitors can only submit details.
- Admin privately reviews submissions.

Two public submission flows:

1. **Submit candidate details**
   - For candidate/family profile submission.

2. **Share match requirement**
   - For seekers/families looking for a suitable match.

Abuse-prevention choices already included:

- No public listing
- Consent checkbox required
- Honeypot field for basic spam reduction
- Admin-only review queue
- Admin status tracking
- Admin private notes

Admin statuses:

- `new`
- `reviewing`
- `approved`
- `matched`
- `rejected`
- `archived`

## 4. Supabase Schema Status

The repo contains the latest schema here:

- `supabase/schema.sql`

The latest schema includes:

- Existing content tables
- New matrimony tables
- RLS policies
- Admin-only management policies
- Public insert-only policies for matrimony
- Indexes for matrimony review queues

Important:

After the latest code push, the new matrimony forms will only work live after running the updated `supabase/schema.sql` in the Iraqi Biradari Supabase SQL editor.

## 5. Latest Pushed Commits

Recent Iraqi Biradari commits:

- `19c6676 Add private matrimony workflow`
- `f250a23 Update support bank details`
- `c7a364d Move founding year into community detail`
- `805dabd Remove homepage heritage nav link`
- `e056a19 Finalize About Us page`
- `ed356dc Update homepage links and compact page heroes`
- `902b068 Add admin edit mode and drag ordering`
- `3b1c454 Add support page and admin ordering controls`
- `eb449de Add announcements page and event visibility rules`
- `ee59a7d Fix admin auth redirect URL`
- `c6672a9 Add Supabase-backed content admin`
- `1477d91 Unify secondary page branding`

Recent AKT/Shajra commits:

- `dde19a5 Polish landing page and visitor table`
- `703fd0f Enrich visitor activity tracking`
- `74ed8b9 Add import stats and fix tree printing`
- `42d2a1c Latest allnamefile.json`
- `e604509 Add GEDCOM upload safeguards and archive references`
- `01541bd Add project handoff notes`

## 6. AKT / Shajra Platform Status

Repository:

- `/Users/shiraz/apnonkitalash/akt`

Purpose:

- Genealogy-only Shajra platform.

Important current behavior:

- GEDCOM upload/parser works.
- Duplicate GEDCOM filename warning was added.
- Person duplicate check was intentionally removed from upload flow for now.
- Stats tab was repurposed toward import stats / migration thinking.
- Print tree bug was fixed so search results do not get appended to tree printouts.
- Visitor/admin tracking was enriched with timestamp, visits, activity, device/timezone, and optional location hint.
- Landing page was beautified with the Apnon Ki Talash logo/favicon treatment.

Data-migration direction discussed:

- Short term: delete and reupload GEDCOM data carefully.
- Better future direction: allow reupload of an existing GEDCOM and compare/apply changes incrementally.

## 7. Current Known Gaps / Watch Items

### Iraqi Biradari

1. **Run Supabase schema**
   - Required for matrimony tables before live submissions work.

2. **Matrimony moderation policy**
   - The page is structurally private, but the human review rules still need to be decided:
     - Who can review?
     - What information must be verified?
     - When to contact a family?
     - When to reject/archive?

3. **Matrimony notification flow**
   - Admin currently has to check the admin panel.
   - Future improvement: email notification to admin when a new matrimony submission arrives.

4. **Data privacy text**
   - Current page has basic privacy/safety copy.
   - A more formal privacy/disclaimer statement should be added before wider launch.

5. **Admin delete/archive for matrimony**
   - Current matrimony admin can status-track and save notes.
   - Deletion is not exposed in UI yet.
   - Safer default is archive, but deletion may be needed for privacy requests.

6. **Drive archive curation**
   - Continue categorizing relevant Drive files only.
   - Avoid old tree files, random images, and irrelevant folders unless explicitly needed.

7. **Visual QA after deploy**
   - Check `/matrimony/` on mobile and desktop after GitHub Pages/deploy finishes.
   - Check `/admin/` after schema is run.

### AKT / Shajra

1. **Future GEDCOM update strategy**
   - Decide between:
     - Delete and reupload entire GEDCOM dataset
     - Incremental GEDCOM diff/update system

2. **Data governance**
   - Need a clear policy for edited GEDCOM files, reuploads, duplicates, and family updates.

3. **Visitor analytics**
   - Current tracking is richer, but needs ongoing monitoring for privacy and usefulness.

4. **Sorting/source file order**
   - Source file dropdown ordering issue was observed and should be kept under watch.

## 8. Recommended Next Steps

### Immediate

1. Run the latest Iraqi Biradari `supabase/schema.sql` in Supabase.
2. Test `/matrimony/` by submitting one test candidate profile.
3. Test one seeker requirement submission.
4. Sign into `/admin/` and verify both submissions appear.
5. Change statuses and save private notes.
6. Archive or delete test records directly in Supabase if not needed.

### Short Term

1. Add admin-side delete button for matrimony submissions, with confirmation.
2. Add an email notification mechanism for new matrimony submissions.
3. Add a short privacy/disclaimer section on `/matrimony/`.
4. Add optional fields:
   - caste/sub-community notes, if appropriate
   - preferred education
   - preferred profession
   - family contact verification status
5. Add admin filters:
   - status
   - gender
   - city
   - profile/request type

### Medium Term

1. Add a proper coordinator workflow:
   - assigned_to
   - follow_up_date
   - last_contacted_at
   - verification_status
2. Add export capability for admin review.
3. Add audit log for admin actions.
4. Add Supabase Edge Function or trusted server process for email notifications.
5. Add a privacy policy page for the whole site.

### Later

1. Consider role-based admin access if more coordinators are added.
2. Consider private invite-only family matching dashboard.
3. Consider OTP or email verification before accepting matrimony submissions.
4. Consider rate limiting or CAPTCHA alternative if spam appears.

## 9. Deployment Notes

The Iraqi Biradari site is static and GitHub-backed.

Recent changes have already been pushed to:

- `main`

Latest push:

- `19c6676 Add private matrimony workflow`

After future changes:

```bash
git status
git add <files>
git commit -m "<message>"
git push
```

## 10. Useful URLs

- Iraqi Biradari live site: `https://iraqibiradari.com/`
- Iraqi Biradari admin: `https://iraqibiradari.com/admin/`
- Iraqi Biradari matrimony: `https://iraqibiradari.com/matrimony/`
- Iraqi Biradari support: `https://iraqibiradari.com/contact/`
- Shajra / Apnon Ki Talash: `https://apnonkitalash.com/`
- Wikipedia source used for brief community summary: `https://en.wikipedia.org/wiki/Iraqi_Biradari`

## 11. Guiding Principle

The current architecture keeps the two products cleanly separated:

- **Apnon Ki Talash** is the private/technical genealogy and Shajra system.
- **Iraqi Biradari** is the public-facing heritage and community platform.

That separation should be preserved unless there is a strong reason to merge functionality later.

