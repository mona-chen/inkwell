# Inkwell — views pack (auth, landing pages, moderation, revisions)

This is a drop-in addition to the `inkwell` project you already downloaded, filling four of the
gaps called out earlier. Every file here uses the same path it belongs at inside your `inkwell/`
project root — copy this pack's `app/` and `config/` folders over your existing ones and they'll
land in the right place.

## What's in here

**New views/controllers (add — nothing to merge):**
- `app/views/devise/sessions/new.html.erb` — login screen
- `app/views/devise/passwords/{new,edit}.html.erb` — forgot-password flow
- `app/views/devise/shared/_error_messages.html.erb` — shared form error partial
- `app/themes/default/site/home.html.erb` — the actual marketing landing page (hero, featured
  posts grid, newsletter signup wired to the `newsletter` plugin's real route) — this is what
  was missing from the original brief specifically
- `app/themes/mono/site/home.html.erb` — same landing page, mono theme's version, proving a
  theme swap changes the homepage too, not just post pages
- `app/controllers/admin/comments_controller.rb` + `app/views/admin/comments/index.html.erb` —
  comment moderation queue (approve / spam / delete, filterable by status)
- `app/controllers/admin/post_revisions_controller.rb` +
  `app/views/admin/post_revisions/{index,show}.html.erb` — revision history list and a
  side-by-side diff view with one-click restore

**Edited (replace your existing copy):**
- `config/routes.rb` — added the nested `revisions` resource under `admin/posts` (the original
  had a stub `restore_revision` member route that never matched a real controller — fixed here)
- `app/views/admin/posts/_sidebar.html.erb` — added a "View revision history" link

## Why the landing page needed a theme-level file, not just a controller tweak

`SiteController#home` already rendered `"site/home"` — but that resolved to the one file at
`app/views/site/home.html.erb` regardless of which theme was active, because nothing under
`app/themes/*/site/` existed yet. Themes only had `site/home` NOT get resolved through the
per-theme lookup, so switching themes never changed the homepage — everything else (posts,
pages) was already theme-swappable, the homepage wasn't. Adding `app/themes/default/site/home.html.erb`
and `app/themes/mono/site/home.html.erb` closes that gap; `app/views/site/home.html.erb` (already
in your original download) now serves as the core fallback for any future theme that doesn't
define its own homepage.

## Verification done before packaging

- Every `.rb` file here: `ruby -c` syntax-checked.
- Every `.erb` file here: parsed with `ERB.new(...).src`.
- Every route helper referenced in these views (`admin_comment_path`, `admin_post_revisions_path`,
  `restore_admin_post_revision_path`, `new_password_path`, etc.) cross-checked against the routes
  defined in the included `config/routes.rb`.
- Not booted against a live Rails process — same caveat as the original package, no rubygems.org
  access in this environment.

## Still not built (unchanged from before)

Widgets/sidebars, the JSON:API surface, multisite host-switching, and automated test coverage
beyond the hooks spec. Comment moderation and revisions are now real; those four are not.
