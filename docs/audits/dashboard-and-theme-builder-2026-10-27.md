# Dashboard and theme builder audit

Date: 2026-10-27

Implementation follow-up: see [dashboard-design-implementation-2026-10-27.md](dashboard-design-implementation-2026-10-27.md). Findings below describe the state before that implementation.

Scope: dashboard screenshot and source review of the shared admin shell, navigation, dashboard data, theme library, content templates, frontend template resolution, and Builder theme/global-part persistence. This is an architectural and UI audit, not an exhaustive interaction, contrast, or device certification of every plugin screen. No application behavior was changed for this audit.

## Assessment

Inkwell has a capable visual page builder and substantial theme infrastructure. It does not yet present a complete, integrated site/theme editor. The dashboard has improved styling, but navigation, density, responsive composition, and system feedback still need a consistent product model.

## Prioritized findings

### P1 — Draft templates can replace public rendering

`Admin::TemplatesController#create` creates a draft with `template_for` immediately assigned. `Page.template_for` resolves it without a published-status condition. `PostsController#index/show` then uses that result instead of the theme default. The renderer reads `content_blocks`, so a newly created empty draft can replace the public content area with empty output. This follows directly from the source path; it was not reproduced by creating a template on the user's site.

Separate working templates from active published assignments. Keep the existing live template until explicit publication; preview drafts separately. Add regression coverage for creating, editing, publishing, and reverting templates.

Sources: `app/controllers/admin/templates_controller.rb`, `app/models/page.rb:72`, `app/controllers/posts_controller.rb`, `plugins/page_builder/app/services/page_builder/template_renderer.rb`.

### P1 — “Global” style scope is misleading

Builder `PanelManager.updateTheme` writes to the current document's `settings.theme` and labels the history operation “Change global …”. Those controls are document-level in this path; they do not establish a shared site style registry. Header/footer trees do have a separate site registry, making the scope distinction especially important.

Introduce explicit Site styles, Page styles, and Element styles with inherited values and visible overrides. Do not promise site-wide propagation until persistence and published rendering support it.

Sources: `plugins/page_builder/app/builder/src/core/PanelManager.js:320`, `app/models/site.rb:36`, `plugins/page_builder/app/controllers/page_builder/builder_controller.rb:135`.

### P2 — Theme authoring is fragmented

Installed themes, content templates, header/footer parts, navigation, widgets, and Builder styling have separate entry points. The template list only offers Create/Edit, without a visible publication state, assignment conditions, preview, or reset action. The theme library offers import/preview/activation, not a complete visual theme-authoring lifecycle. Its illustrative swatches are not actual site previews.

Use one Site design entry with Overview, Templates, Header & footer, Styles, Navigation, and Theme packages. Keep package installation distinct from visual editing inside this area.

Sources: `app/components/admin/templates_page.rb`, `app/components/admin/themes_page.rb`, `app/components/admin/shell.rb`.

### P2 — Navigation icon contract breaks for plugins

The shell maps a limited set of legacy icon strings and falls back to a circle. Plugins register `sparkles`, `image`, `search`, and `globe_2`, which are not in that map. This explains several generic circles visible in the sidebar.

Normalize all registrations to the application-owned Ink icon contract, validate registered names, and use a deliberate fallback only for unknown names.

Sources: `app/components/admin/shell.rb`, plugin engine registrations under `plugins/*/lib/*/engine.rb`.

### P2 — Mobile sidebar lacks modal focus handling

The sidebar controller changes translation, overlay visibility, body scrolling, and aria-expanded, but does not move focus into the open drawer, contain keyboard focus, make the background inert, or restore focus on close. Crossing to desktop while open also needs explicit cleanup of the body scroll lock.

Implement one accessible drawer lifecycle and verify keyboard behavior across breakpoint changes.

Sources: `app/javascript/controllers/admin_shell_controller.js`, `app/components/ink/shell.rb`.

### P2 — Dashboard status and counts need correction

- “Needs review” can show pending comments alongside “Comments are up to date”: the detail checks spam count rather than pending count.
- The shared navigation badge counts pending comments globally, while the dashboard scopes comments to the current site.
- Total posts includes trashed posts, and total pages includes content templates. These counts need explicit definitions matching their destination lists.
- “Recent work” only contains posts; pages are excluded despite the broader label.
- Storage usage enumerates every media record and reads blob sizes in Ruby on every dashboard request. Use an aggregate query and avoid per-record loading.

Sources: `app/components/admin/dashboard_page.rb:163`, `app/components/admin/layout.rb`, `app/controllers/admin/dashboard_controller.rb`.

### P2 — Dashboard composition wastes attention at constrained widths

The large greeting dominates the screen and awkwardly addresses “Site Admin” as “Site”. Four metric cards compete for the remaining width, and truncated supporting text removes useful meaning. These are visible in the supplied screenshot and reflected in the large heading, four-column breakpoint, and truncate classes.

Use a compact site overview, one primary creation action, and a prominent actionable queue. Make metric layout depend on available content width. Allow meaningful supporting text to wrap. Keep ordinary dashboard padding modest; preserve edge-to-edge editor surfaces and attached inspectors where appropriate.

Source: `app/components/admin/dashboard_page.rb`.

### P3 — Shared navigation needs a clearer hierarchy

The sidebar mixes content work, site design, standalone utilities, plugins, and platform administration. Ink Builder competes with Appearance even though the concepts overlap. Small low-emphasis group labels and many separate destinations make scanning harder as plugins grow.

Recommended hierarchy: Home; Content (Posts, Pages, Media, Comments); Site design (Templates, Header & footer, Styles, Navigation, Themes); Tools (Import, SEO and enabled utilities); Administration (People, Settings, Extensions, Sites when permitted). Plugin destinations should declare a stable category rather than append arbitrary top-level items.

## Theme-builder capability matrix

| Capability | Current assessment |
| --- | --- |
| Editable visual page design | Present: source-owned Builder runtime/store |
| Dynamic content templates | Present: core roles and plugin registration; publication safety needs repair |
| Shared header/footer parts | Present: site registry and Builder integration; needs a clearer management surface |
| Page colors, typography, spacing | Present in document settings |
| Inherited site-wide design system | Partial: current theme controls reviewed here are document-scoped |
| Theme ZIP install, preview, activation | Present |
| Rails/ERB and static/bundled frontend packages | Present infrastructure; package requirements determine readiness |
| Dependency installation/build management | CLI workflow; not a complete admin workflow |
| Conditional template assignment | Basic role mapping; no condition-management UI in template list |
| Unified site editor and theme release workflow | Incomplete |
| Theme export/portable visual authoring UI | Not exposed in the reviewed theme/template UI |

## Recommended implementation order

1. Repair template publication safety and assignment uniqueness; preserve a safe published fallback.
2. Correct sidebar icon mapping, site-scoped badges, dashboard statuses and count definitions; complete drawer keyboard behavior.
3. Establish shared layout rules for overview, list, settings, and editor screens; use consistent heading, density, focus, and action placement.
4. Build the Site design hub around existing Builder capabilities, with accurate scope labels and visible draft/live states.
5. Add site-wide style inheritance, template previews/assignments, and a deliberate publish/rollback workflow.

The right direction is to integrate and strengthen the existing source-owned architecture. A replacement UI runtime or a second independent builder would increase the fragmentation this audit identifies.
