# Dashboard and site design implementation

Implemented 2026-10-27 against the dashboard/theme-builder audit.

## Workspace

- Replaced the greeting banner, glow effects, decorative metric icons, and floating metric cards with a compact overview and a divided inventory strip.
- Responsive columns use the available workspace width. Supporting metric and task text wraps rather than disappearing behind ellipses.
- Recent work combines posts and pages. Templates are excluded from ordinary page inventory and homepage choices.
- Standardized list widths, toolbar separators, headings, and shared card geometry across inner pages.
- Sidebar groups are Content, Site design, Tools, Administration, and Help. Design-specific destinations share a secondary navigation under Site design.
- Native plugin icon names resolve through Ink/Lucide instead of silently becoming circles. Unknown names have a deliberate fallback.
- Mobile navigation isolates the background, contains keyboard focus, restores focus, excludes closed navigation from tab order, and clears modal state when switching to desktop.
- Site-scoped moderation badges and dashboard statuses agree. Post totals exclude trash. Media storage is aggregated in SQL.

## Theme building

`/admin/design` brings together templates, header/footer parts, inherited styles, navigation, widgets, and theme packages.

- Dedicated header and footer editors are created on demand as site-part design documents, separate from ordinary pages.
- Templates show Theme default / Draft / Live and unpublished-change states. Editing opens the source-owned visual Builder.
- Creating a draft never replaces the public theme rendering. Save stages template changes; Publish commits them. Preview uses the working draft with relevant sample content.
- Reset restores the theme default while preserving the design as a draft page. Discard removes only unpublished template changes.
- Role assignments are unique per site, enforced in the database and model; repeated Create requests reuse the existing design.
- Filtered post lists prefer archive templates. The blog index prefers index templates.
- Template documents stay out of ordinary page URLs and sitemaps. Builder live links point to the affected content route rather than a template page URL.
- Native Builder pages inherit site colors, typography, and spacing through constrained application-owned CSS variables. Explicit page and element values win. “Use site colors, typography & spacing” clears page theme overrides as an undoable action.
- Shared-part working trees survive draft saves without changing the published site registry. Publishing merges only the submitted shared parts and preserves unrelated parts.
- Theme packages retain import, readiness checks, preview, and activation. Removed illustrative site mockups from the library so they cannot be mistaken for screenshots of the installed frontend.

## Practical boundaries

- Existing compiled Builder pages need one publish to adopt site-style inheritance. They are not silently rewritten. Imported frontend packages retain their own CSS.
- Shared parts are source references in the Builder, but published pages contain rendered output. Publishing a part updates the site registry; already published pages using it need republishing to refresh that output. The management screen states this explicitly.
- Template assignment currently uses registered content roles. Arbitrary conditional rules, release-wide rollback, theme-package export, and dependency execution in the admin are separate capabilities, not implied by the new hub.

## Verification

- Focused Rails request coverage exercises draft/live template isolation, idempotent creation, preview, reset/discard, conventional publishing, dedicated parts, site styles, site-scoped badges, role precedence, and existing editor/auth behavior.
- Source-level Node tests verify inherited style fallbacks and explicit page overrides, including zero spacing.
- The existing full Builder smoke harness verifies editing, drag/drop, styles, reconstruction, shared parts, publishing, and console errors. Its layout assertion now measures resolved CSS values rather than expecting literal values in generated stylesheet text.
- The app UI smoke visits the dashboard and inner pages, checks horizontal overflow, and exercises the mobile navigation lifecycle.
