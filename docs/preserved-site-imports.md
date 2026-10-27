# Preserved website imports

An import has two representations: original source HTML with its runtime, and a
native editable builder store. Publishing the original never executes that source
inside the builder or replaces the native store. Publishing native switches the
representation deliberately. Imports remain drafts until published.

Each imported page reserves a unique `public_path` within its site, retaining nested
paths and extensions. Application and plugin routes take precedence. Conflicting
paths fail import rather than silently renaming production URLs. The imported `/`
is used when no explicit homepage is configured. Public lookup is site-scoped and
only serves published pages. Legacy `/pages/:slug` links continue to work.

Original rendering is shared between the homepage and page controller. It keeps
scripts, source DOM, and asset resolution, replaces SEO tags through the existing
head metadata hook, and rewrites links to published imported pages. Canonicals and
sitemap entries use preserved paths. Runtime navigation implemented inside source
JavaScript still needs browser verification; HTML link rewriting cannot rewrite a
framework's route manifest.

For an existing capture, run `bin/rails 'imports:preserve_paths[CAPTURE_ID]'` to
assign paths transactionally without changing publication status or render mode.
A conflict rolls back the operation. Re-capture older imports to discover article
origins: the current capture job adopts public article origins and captures again.
For Ruut, the additional origin is `https://ruutai.framer.ai`.

Review the original version on staging before publishing. CSS, fonts, images,
modules and APIs may still load from their source/CDN URLs: preservation is not a
self-contained export or a guarantee that Framer services can be shut down.
Retain those services until dependencies have been inventoried and migrated.

Reapplying a capture now matches existing imported pages by source URL or preserved
path, even across capture IDs. It refreshes original HTML/provenance while retaining
publication state, SEO edits, parent relationships and native builder data. New
routes are drafts. Shared site parts are retained on refresh. When sibling origins
carry the same path, the primary origin wins and the alternate URLs become local
navigation aliases. A preserved-path conflict with a manually authored page still
fails transactionally rather than overwriting it.

Preserved documents retain their external base URL for source assets. Captured
navigation is rewritten to absolute URLs on the current request's origin so that
base cannot send visitors back to the old website. A small capture-phase handler
uses full document navigation for known imported routes, including links recreated
by source JavaScript, so an old framework router cannot take over Inkwell URLs.
Modifier keys, new tabs and downloads retain normal browser behavior; same-page
fragment links still scroll. Client-side cross-page transitions from the captured
framework are not retained. Import the original frontend as an SPA theme if the
application needs to own its router and transitions across screens.

Capture supports `--resume` to reuse completed responsive evidence after an
interrupted run. Its document identity ignores rotating Cloudflare email keys but
includes rendered text so a shared SPA shell does not collapse distinct screens.
Duplicate pages are recorded as aliases and are not expanded again. HTTP failures
are reported rather than imported as content. Browser caching is disabled during
fresh capture; valid 304 revalidations are not classified as HTTP errors.
