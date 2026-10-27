# Ruut recapture verification — 26 October 2026

Capture: `ruut-recapture-20261026`, source `https://ruut.chat/`, additional
origin `https://ruutai.framer.ai`, depth 8, maximum 80 pages.

- 37 documents captured and mapped, including all 13 linked blog articles.
- 36 distinct local paths after merging the two origins' homepage path.
- Six identical-document aliases retained instead of expanding duplicate links.
- One source failure: `https://ruut.chat/blogs` returns HTTP 403. The original
  `/blogs.html` and Framer `/blogs` listing were both captured successfully.

All 36 preserved routes returned HTTP 200 on a temporary local staging site.
All 13 article pages loaded their original runtime without uncaught browser errors
and retained their content and local canonical URLs. Clicking from `/blogs.html`
to an article and refreshing retained the local article URL. The homepage now uses the updated `https://ruutai.framer.ai/` capture, as requested,
with its updated design and runtime. This origin is saved as the preferred source
for future captures; the original ruut.chat origin remains available for legacy paths.
Owner SEO, publication state and existing native Builder content are retained.
The updated homepage loaded with zero uncaught JavaScript errors before and after
reload; browser instrumentation observed eight animation starts inside the main page.
The preferred-source refresh regression and preserved-page request checks passed
(7 examples).

The verified refresh was applied to the existing local site as import 2. It
refreshed 11 existing pages and created 25 draft pages, including the 13 articles.
Existing publication state and native Builder content were retained. The one
previously published page remains published; the remaining 35 routes are drafts.
No production deployment or bulk publication was performed.

Capture manifests, source HTML, responsive evidence, mapped editable stores and
verification data are under `tmp/site-captures/ruut-recapture-20261026/`,
`tmp/ruut-recapture-review.json`, and `tmp/ruut-browser-verification.json` in this
workspace. Source/CDN asset dependencies still apply.

## Frontend theme runtime checks

A real React bundle was imported and built using the new theme commands. Client
navigation to `/customers/42/conversations?tab=open` and a full reload both showed
the same screen with no browser errors. Missing chunks returned 404. The generated
HTML loaded its bundle through the theme asset namespace.

A Rails theme using ERB, the host Hotwire packages and its own Stimulus application
was imported separately. Its counter incremented, Turbo navigation retained the
same JavaScript context, and refreshing `/pricing` retained that page, with no
browser errors. A separate preserved-document check confirmed that local links
and refresh work even when the source page registers a competing click router.

Temporary QA themes and sites are removed after verification. The migration's
actual imported pages and capture artifacts are retained for review.

Final checks: 56 Rails examples, 8 Node tests, Zeitwerk validation, and the full
Builder smoke suite passed. The smoke suite included newly imported article 75,
which loaded native editable content without duplicate IDs, missing images or
console errors.
