# Theme Runtime Contract — Implementation Brief

## Objective

Make Inkwell themes static-first and CMS-aware.

A developer must be able to build a normal HTML/CSS/JavaScript, React, Vue,
or similar frontend without installing Rails or depending on Inkwell locally.
After installation, Inkwell should recognize declared templates and parts and
provide real site data, SEO, navigation, authors, posts, comments, and
publishing controls.

The implementation must preserve the current theme package behavior:

- `theme.json` remains the package contract.
- Static themes serve compiled files from their declared public directory.
- Rails themes may use ERB, Stimulus, and Turbo through the host Rails runtime.
- Theme assets remain isolated under immutable release paths.
- Theme code is trusted package code, but must not gain arbitrary server or
  database execution privileges.

## Product model

Treat a theme as three layers:

1. **Frontend package** — source, compiled assets, routes, and dependencies.
2. **Theme runtime contract** — declared templates, parts, dynamic regions, and
   data requirements.
3. **CMS overlay** — route metadata, SEO overrides, navigation placement,
   publication state, and optional editable regions.

The theme owns presentation and interaction. Inkwell owns content, metadata,
permissions, publishing, and release lifecycle.

## Non-goals

- Do not load a theme's controllers, routes.rb, migrations, initializers, or
  application.rb into the host application.
- Do not execute npm, shell, Ruby, or gem installation during ordinary preview,
  activation, or request handling.
- Do not convert an entire compiled theme into Builder blocks automatically.
- Do not allow arbitrary HTML tags to invoke server code.
- Do not let a theme replace reserved admin, auth, API, Builder, plugin, or
  content-management namespaces.

## Manifest extension

Extend the existing `inkwell-theme-v1` manifest with an optional `inkwell`
section. Keep all existing manifests valid.

```json
{
  "format": "inkwell-theme-v1",
  "slug": "customer-app",
  "name": "Customer App",
  "kind": "static",
  "public": "dist",
  "routes": {
    "/": "index.html",
    "/blog": "blog.html",
    "/blog/:slug": "post.html",
    "/authors/:slug": "author.html"
  },
  "spa_fallback": "index.html",
  "asset_prefix": "/__inkwell_assets__/",
  "dependencies": {
    "gems": {},
    "packages": {
      "react": "^19.0.0",
      "react-dom": "^19.0.0"
    }
  },
  "inkwell": {
    "contract": "1",
    "parts": {
      "header": "header",
      "footer": "footer",
      "navigation": "navigation",
      "comments": "comments"
    },
    "templates": {
      "blog_index": "blog",
      "blog_post": "post",
      "author": "author",
      "search": "search",
      "404": "404"
    },
    "content_types": [
      "posts",
      "pages",
      "authors",
      "comments",
      "categories",
      "tags"
    ],
    "editable_regions": {}
  }
}
```

### Manifest validation

Add validation for:

- `inkwell` must be an object when present.
- `contract` must be a supported string.
- part/template keys must be lowercase identifiers.
- values must be safe relative paths or declared route keys.
- content types must come from an allowlist.
- editable-region types must come from an allowlist.
- no declared route may overlap a reserved Inkwell namespace.
- no theme may declare executable server code.

Unknown future keys should be ignored for forward compatibility, but malformed
known keys must fail installation with an actionable error.

## Canonical data contract

Define one normalized JSON shape used by static themes, JavaScript themes, and
Rails helpers. The same shape must be used by fixtures and production data.

```json
{
  "site": {
    "id": "site-id",
    "name": "Inkwell Demo",
    "url": "https://example.com",
    "logo": "/theme-assets/customer-app/logo.svg"
  },
  "navigation": [],
  "page": {
    "type": "post",
    "id": "post-id",
    "title": "A sample story",
    "slug": "a-sample-story",
    "url": "/blog/a-sample-story",
    "html": "<p>...</p>",
    "excerpt": "...",
    "published_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-02T00:00:00Z",
    "author": {},
    "seo": {}
  },
  "posts": [],
  "authors": [],
  "comments": [],
  "pagination": {
    "page": 1,
    "per_page": 10,
    "total": 0,
    "pages": 0,
    "next": null,
    "previous": null
  }
}
```

The serializer must whitelist fields. Never serialize ActiveRecord objects,
credentials, private settings, or arbitrary model attributes.

## Local static development

Themes may include fixtures:

```text
inkwell/
├── contract.json
├── fixtures/
│   ├── site.json
│   ├── navigation.json
│   ├── posts.json
│   ├── authors.json
│   └── comments.json
└── preview/runtime.js
```

The theme's own dev server loads fixtures. Inkwell must not be required for
this workflow. The production runtime and local fixtures must expose the same
data shape.

Fallback content must be realistic and complete enough to show cards, empty
states, pagination, comments, avatars, and long titles. It is not acceptable to
replace every dynamic region with an empty box.

## Dynamic regions

Use constrained declarative markers, not arbitrary executable custom tags:

```html
<section
  data-inkwell-region="posts"
  data-inkwell-query="latest"
  data-inkwell-limit="6">
  <!-- normal fixture markup remains visible in local development -->
</section>
```

Allowed region types initially:

- `site`
- `navigation`
- `posts`
- `post`
- `authors`
- `author`
- `comments`
- `search`
- `pagination`
- `seo`

Unknown regions remain ordinary HTML. Region attributes must be validated and
queries must be translated into a fixed query object; never evaluate code from
HTML attributes.

## Static runtime modes

Support three strategies, selected by the theme and route:

1. **Server-injected JSON** — Inkwell renders the HTML shell and injects a
   serialized, escaped data object before the theme bundle runs.
2. **Client hydration** — the theme reads the data object and replaces or
   hydrates declared regions.
3. **Read-only data endpoint** — the theme fetches route-scoped JSON for
   comments, search, pagination, or other deferred islands.

The default should be server-injected JSON for initial page content and SEO.
Client-only rendering must be explicit because it weakens initial indexing.

## Rails themes

Rails themes can declare ERB templates and parts while using the host runtime:

```json
{
  "kind": "rails",
  "views": "app/views",
  "public": "public",
  "routes": {
    "/": "marketing/home",
    "/pricing": "marketing/pricing"
  },
  "inkwell": {
    "parts": {
      "header": "parts/header",
      "footer": "parts/footer"
    }
  }
}
```

Provide helpers that serialize the canonical contract:

- `inkwell_site`
- `inkwell_navigation`
- `inkwell_posts(limit:, query:)`
- `inkwell_post`
- `inkwell_authors`
- `inkwell_comments(post)`
- `inkwell_seo`
- `theme_asset_path(path)`

Helpers must return safe, scoped view data and must not expose arbitrary
database querying.

## Theme parts and templates

Resolve parts independently from top-level templates, similar to a CMS
template-part system:

```text
parts/header
parts/footer
parts/navigation
parts/comments
templates/blog/index
templates/blog/post
templates/author
templates/search
templates/404
```

Parts may be reused by multiple templates. A part should be replaceable by a
site-level override without modifying the installed release. Overrides must be
versioned and reversible.

## Theme pages / CMS overlay

Create a `ThemeRoute` model scoped to a site and theme release:

```text
ThemeRoute
- site_id
- theme_release_id
- path
- route_key
- title_override
- seo_title
- meta_description
- canonical_url
- social_image_id
- robots
- schema_json
- status
- draft_data
- published_at
```

Theme routes should appear in the Pages UI with a `Theme` badge. They support:

- SEO editing;
- social preview;
- draft/publish;
- revision history;
- navigation assignment;
- sitemap inclusion;
- preview and rollback;
- agent/MCP access.

The theme remains responsible for layout and behavior. Inkwell owns route
metadata and content bindings.

## Route precedence

Implement and test this order:

1. Admin, auth, API, Builder, plugin, and other reserved routes.
2. Native Inkwell Pages and Posts.
3. Explicit active-theme routes.
4. Theme SPA fallback for extensionless paths.
5. 404.

Never allow a theme to shadow a reserved namespace.

## SEO

For every theme route, support:

- title;
- meta description;
- canonical URL;
- robots directives;
- Open Graph title/description/image;
- Twitter card metadata;
- JSON-LD schema;
- sitemap inclusion;
- preview and validation.

Server-rendered theme routes should emit these tags in the initial HTML. SPA
routes should receive serialized route metadata before hydration. Warn when a
route is client-only and has no server-rendered content.

## Builder integration

Do not convert the entire theme to Builder nodes. Allow explicitly declared
editable regions:

```json
"editable_regions": {
  "homepage_hero": {
    "type": "rich_text",
    "builder": true
  },
  "featured_posts": {
    "type": "query",
    "builder": true
  }
}
```

Only declared regions may be edited in Builder. Store overrides separately from
the installed theme release, and make them easy to reset when the theme updates.

## Dynamic islands

Support deferred read-only regions for comments, search, recommendations, and
personalized controls:

```html
<div
  data-inkwell-island="comments"
  data-inkwell-post="{{ page.id }}">
  <p>Comments are loading…</p>
</div>
```

Requirements:

- GET-only data endpoints;
- site and route authorization;
- response size limits;
- pagination;
- ETags and cache headers;
- loading, empty, and error states;
- no private content in public cache keys;
- no arbitrary endpoint names from theme markup.

## Installation and release behavior

Installation must validate:

- manifest schema;
- route safety and reserved namespaces;
- required output files;
- part/template declarations;
- fixture compatibility;
- package dependency declarations;
- asset references;
- SPA fallback;
- editable-region types.

Builds remain explicit. A build may run `npm ci`/`npm install` and
`npm run build` only from the deployment/build workflow. Preview and activation
must never execute package scripts.

GitHub releases should remain immutable by commit SHA. A release is installable
only after output and readiness checks pass. Preview, activation, rollback, and
automatic activation must continue to work with the new contract.

## Agent/MCP surface

Add narrowly scoped tools:

```text
theme.routes_read
theme.route_update_seo
theme.route_preview
theme.parts_read
theme.editable_regions_read
theme.release_build
theme.release_activate
theme.release_rollback
```

SEO and route metadata writes require optimistic concurrency (`revision` or
`updated_at`). Release activation must be an explicit audited operation, not an
implicit side effect of an agent edit.

## Database and migration plan

1. Add `theme_routes` and indexes for `(site_id, path)` and
   `(site_id, theme_release_id, route_key)`.
2. Add `theme_route_revisions` or use the existing revision/event system.
3. Add a release reference to each route so old releases remain previewable.
4. Backfill routes from currently installed static manifests without changing
   active behavior.
5. Keep deletion/rollback recoverable; do not remove old release files during
   ordinary activation.

## Test plan

### Manifest and package tests

- Existing v1 manifests remain valid.
- Valid `inkwell` declarations parse.
- Invalid regions, content types, routes, and paths fail safely.
- Missing outputs block activation.
- Asset prefixes remain namespaced.

### Runtime tests

- Static route renders its HTML.
- SPA deep link reload returns the shell.
- Missing asset returns 404, never the SPA shell.
- Reserved routes always win.
- Fixture mode and production serialization have equivalent shapes.
- Unknown dynamic regions remain harmless HTML.

### CMS tests

- Theme routes appear in Pages.
- SEO overrides persist and render in `<head>`.
- Draft routes are not public.
- Published routes enter the sitemap.
- Route preview uses the selected release.
- Rollback restores the previous release.

### Security tests

- Theme markup cannot select arbitrary models or endpoints.
- Serialized data excludes private fields.
- Dynamic endpoints enforce site scope.
- Theme routes cannot shadow reserved paths.
- Uploaded packages cannot contain symlinks or traversal paths.
- Build scripts are never executed during activation or preview.

### Browser and Builder tests

- Fixture content is visually complete.
- Theme parts render in preview.
- Editable regions remain editable after a theme update.
- Resetting an override restores the repository version.
- Ruut’s existing animations and asset paths continue to work.
- Run the existing Builder smoke suite after template/runtime changes.

## Delivery sequence

### Phase 1 — Contract

- Add manifest schema and validation.
- Add canonical serializer.
- Add fixtures and contract documentation.
- No production rendering changes yet.

### Phase 2 — Static bridge

- Add region markers and fixture runtime.
- Add production data injection.
- Add route-aware SEO injection.
- Add static runtime tests.

### Phase 3 — Theme routes

- Add `ThemeRoute` and revisions.
- Add Pages UI and SEO controls.
- Add sitemap/navigation integration.

### Phase 4 — Rails support

- Add helpers and part/template resolution.
- Add Rails theme integration tests for ERB, Stimulus, and Turbo.

### Phase 5 — Dynamic islands

- Add safe read-only endpoints.
- Add comments/search/pagination islands.
- Add caching and error states.

### Phase 6 — Builder and agents

- Add declared editable regions.
- Add Builder preview fixtures.
- Add MCP tools with revisions, permissions, audit events, and rollback.

### Phase 7 — Ruut migration

- Add Ruut’s manifest contract and fixtures.
- Map homepage, blog, author, comments, and navigation regions.
- Verify all animations, nested assets, deep links, SEO, and mobile behavior.
- Install from GitHub and test preview, activation, update, and rollback.

## Acceptance criteria

The feature is complete when:

1. A developer can build and preview a theme without Rails or Inkwell.
2. The same package installs from ZIP and GitHub.
3. Theme routes appear in Pages and have editable SEO metadata.
4. Header, footer, blog, author, comments, navigation, and 404 parts can be
   declared and rendered dynamically.
5. Local fixture rendering and production data use the same schema.
6. Static SPA deep links survive direct navigation and reload.
7. Missing assets never receive an HTML fallback.
8. Declared Builder regions are editable without converting the whole theme.
9. Agents can safely update route SEO and request releases through audited MCP
   tools.
10. Existing themes and the Ruut theme continue to pass the full regression and
    Builder smoke suites.
