# Inkwell — a WordPress rethought for 2026

## The core bet

WordPress's genius was never PHP or MySQL — it was **the hook system** (`do_action`/`apply_filters`)
and **the theme/plugin filesystem contract**. Those two ideas are why a 20-year-old CMS still runs
40% of the web. Everything else about it — global mutable `$post`, template-name-guessing via
`get_template_part`, plugins that monkey-patch each other through globals, admin-ajax.php as a
universal hairball endpoint — is 2003-era engineering debt.

So the design principle here is: **keep the two ideas that made WordPress extensible, rebuild
everything else with what Rails/Hotwire give us for free in 2026.**

| WordPress concept | Inkwell equivalent | Why it's better here |
|---|---|---|
| `functions.php` global hooks | `Inkwell::Hooks` registry (typed actions/filters) | No global namespace pollution; hooks are objects you can introspect, test, and disable per-plugin |
| Plugins as loose PHP files in `/wp-content/plugins` | Plugins as **Rails Engines** under `/plugins` | Real namespacing, their own migrations/models/routes/assets, can be gem-packaged and versioned independently |
| Themes as PHP template files + `functions.php` | Themes as **view-path bundles** resolved via `ActionView::FileSystemResolver` | Themes are just Rails views — no new templating language, full ERB/ViewComponent power, theme = a folder Rails already knows how to render |
| Shortcodes / `the_content()` filter soup | **Block-based content** stored as structured JSON, rendered through a `BlockComponent` registry | Content is data, not a string full of `[shortcode]` tags to regex-parse. Safe by construction — no `eval`-adjacent parsing |
| `wp_options` key-value soup | `Option` model (still key-value where it belongs — site settings) + real columns/tables everywhere else | Only genuinely dynamic config lives as KV; structured data gets structured tables |
| admin-ajax.php megaphone endpoint | Turbo Frames/Streams + real RESTful controllers | Every admin interaction is a real route, testable, cacheable, no `action` string dispatch |
| XML-RPC / REST API bolted on | JSON:API-style API from day one under `/api`, same models | One source of truth, not two integration surfaces |
| jQuery everywhere | Stimulus controllers, scoped, no global `$` | Predictable, testable, no plugin-vs-plugin jQuery version wars |

## Layered architecture

```
┌─────────────────────────────────────────────────────────┐
│  Public site (theme-rendered)     Admin (Hotwire SPA-ish)│
│  SiteController / PostsController  Admin::* controllers  │
└───────────────┬───────────────────────────┬──────────────┘
                │                           │
        ┌───────▼───────┐           ┌───────▼────────┐
        │ ThemeResolver  │           │  BlockRenderer  │
        │ (view paths)   │           │ (ViewComponents)│
        └───────┬───────┘           └───────┬────────┘
                │                           │
        ┌───────▼───────────────────────────▼────────┐
        │              Inkwell::Hooks                  │
        │   actions: do_action-equivalent (pub/sub)     │
        │   filters: apply_filters-equivalent (pipeline)│
        └───────┬───────────────────────────┬──────────┘
                │                           │
        ┌───────▼───────┐          ┌────────▼────────┐
        │ PluginManager  │          │  Core Models     │
        │ loads Engines  │          │ Post/Page/Term/  │
        │ from /plugins  │          │ Media/Menu/User  │
        └────────────────┘          └──────────────────┘
```

## The hook system (`lib/inkwell/hooks.rb`)

Two primitives, same as WordPress, but typed and instance-based instead of global functions:

- **Actions** — "something happened, do your side effects" (fire-and-forget, multiple listeners,
  no return value used). E.g. `Inkwell::Hooks.fire(:post_published, post)`.
- **Filters** — "here's a value, transform it and pass it on" (pipeline, each listener gets the
  previous listener's output). E.g. `Inkwell::Hooks.filter(:post_content, html, post: post)`.

Plugins register listeners in their Engine's `config/initializers/plugin.rb`. Because it's Ruby
objects, not string-keyed global functions, you get: stack traces that make sense, the ability to
unregister a listener, priority ordering, and RSpec can assert "did this fire" without stubbing
globals.

## Plugins as Engines

Every plugin under `/plugins/<name>` is a full `Rails::Engine`:

```
plugins/seo/
  lib/seo/engine.rb       # isolates the namespace, registers hooks on boot
  lib/seo.rb
  app/models/seo/...      # optional, plugin-owned tables via engine migrations
  app/views/...
  db/migrate/             # plugin owns its own schema, mounted via engine
```

This means a plugin can ship its own ActiveRecord models, migrations, routes, background jobs, and
even admin UI panes — mounted into `Admin` namespace via a registered nav item — without ever
touching core files. Uninstalling a plugin is `bundle remove` / folder delete, not archaeology
through `functions.php`.

## Themes as view-path bundles

A theme is a directory with a `theme.json` manifest and standard Rails view folders
(`layouts/`, `posts/`, `pages/`, `partials/`). `ThemeManager` prepends the active theme's directory
to `ActionController::Base.view_paths` before render, per-request, based on the site's active theme
setting (with a request-time override for live preview). No new template lookup rules to learn —
it's just Rails resolving `posts/show` and finding the theme's version first, falling back to core
defaults if the theme doesn't override a view (exactly like WordPress's parent/child theme
fallback, but using Rails' own resolver chain instead of a bespoke `locate_template()`).

## Content model: blocks instead of a content blob

`Post#content` is `jsonb`: an ordered array of `{ type:, data: {} }` block records (this is
deliberately Gutenberg-shaped — that part of WordPress's evolution was correct). Each block type
maps to a `BlockComponent` (ViewComponent) responsible for both the editor UI (via a Stimulus
controller) and the front-end render. Rendering the post is `BlockRenderer.render(post.content)`,
which is a strict allow-list dispatch — there is no free-text HTML execution path, which structurally
closes off the entire class of "shortcode injection" and "eval-in-template" vulnerabilities that
have plagued WP plugins for two decades.

## What's built vs. stubbed in this pass

**Built for real, read the code:**
- `Inkwell::Hooks` action/filter registry + specs
- Plugin engine loading + one working example plugin (SEO: injects meta tags via a `head_meta`
  filter, adds an admin settings pane)
- `ThemeManager` + two real themes (`default`, `mono`) proving the resolver-swap works
- Block editor: Stimulus drag/drop controller + 4 block types (heading, paragraph, image, quote)
  with live-preview, ViewComponent-rendered on both sides
- Core schema: sites, users/roles, posts, pages, terms/taxonomies (ancestry-based, so categories
  nest like WP), media (ActiveStorage), comments (closure_tree nested), menus (drag-orderable)
- Admin dashboard shell, posts CRUD with the block editor wired in, plugin manager UI, theme
  switcher with live preview iframe, menu builder

**Deliberately stubbed with clear extension points** (would be the next sprints, not because they're
hard to design — because "zero missing features vs. 20 years of WordPress" is a multi-quarter build,
not a single response):
- Full REST/JSON:API surface (routes reserved under `/api`, one resource implemented as the pattern)
- Multisite (schema has `site_id` FKs everywhere so it's additive, not a rewrite)
- Widgets/sidebars (menus + blocks cover 90% of the use case; a `Widget` model stub is included)
- Full plugin marketplace/installer UI (PluginManager can load from `/plugins`; remote install from
  a registry is a service-object stub)
- i18n content translation, revisions diffing UI, comment moderation queue UI

## Stack choices (the "modern WP" part of the brief)

- **Rails 7.1 + Hotwire** — Turbo Frames for the admin's inline editing (post list row → edit
  without a full page swap), Turbo Streams for things like "flash a save confirmation" or "media
  library grid updates after upload" without writing a JS framework.
- **Stimulus, no React/Vue** — the editor is the one place with real client-side state (block
  order, in-progress edits); Stimulus + a tiny in-memory block array is enough, and it means every
  plugin author only needs to know one JS pattern, not "pick your framework."
- **Tailwind** — utility classes, no scoped `<style>` blocks (matches your stated preference),
  theme-level design tokens live in each theme's own `tailwind.theme.css` so themes can diverge
  visually without touching core CSS.
- **ViewComponent** — both for blocks and for reusable admin UI (buttons, badges, the media picker)
  — testable in isolation, which a decade of WP admin spaghetti never had.
- **Sortable.js via importmap** for drag-and-drop (blocks, menu items) — the one "nice animation
  library" pulled in, everything else (transitions, hover states) is Tailwind + CSS, no extra JS
  weight for polish that CSS already does well.
- **Postgres `jsonb`** for block content + `pg_search` for full-text search — no separate search
  service needed at this scale; swap to OpenSearch behind the same query object when you outgrow it.
