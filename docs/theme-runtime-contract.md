# Theme runtime contract

## Build and install a CMS-backed static theme

1. Build your site with your usual frontend tooling. Keep browser-ready HTML,
   CSS, scripts and assets in the directory named by `public` in `theme.json`.
2. Register a literal archive route such as `/blog` and a detail route such as
   `/blog/:slug`. Map the roles `blog_index` and `blog_post` to those route
   keys. Use a distinct author prefix such as `/contributors/:slug` if the
   native author controller already owns your preferred URL.
3. Put representative HTML inside region wrappers. For an archive, use
   `posts` and `pagination`. For a detail page, use `post` and `comments`.
   For a contributor template, use `author` and `posts`. The default
   renderer replaces the wrapper contents, so style its generated classes
   such as `.ink-post-card` and `.ink-region-post`. Keep the wrapper and its
   layout classes. Links in generated cards use the CMS record’s public URL.
4. Declare reusable fragments in `inkwell.parts` and mount them with
   `data-inkwell-part`. Keep fixtures and fragments in the ZIP or GitHub
   archive alongside the manifest, even when they live outside `public`.
5. Run `bin/theme-preview /path/to/theme` for a Rails-free fixture preview.
   Build and ship the output, then install via Site design → Theme packages.
   Preview with real published content before activating. Check page two,
   missing slugs, comments, and direct navigation with JavaScript disabled.
6. In Pages, open the theme route to manage its SEO and publication state.
   Update the repository when changing the template, CSS or JavaScript.

Fixture preview checks layout and sample data. An installed preview is needed
to verify actual route ownership, publishing, SEO, and release asset URLs.

`theme.json` remains the package contract. An optional `inkwell` object declares
the CMS-facing runtime without making Inkwell a frontend framework dependency.

```json
{
  "format": "inkwell-theme-v1",
  "slug": "customer-app",
  "name": "Customer App",
  "kind": "static",
  "public": "dist",
  "routes": { "/": "index.html", "/blog": "blog.html", "/blog/:slug": "post.html" },
  "spa_fallback": "index.html",
  "inkwell": {
    "contract": "1",
    "runtime": "server_injected",
    "fixtures": "inkwell/fixtures",
    "parts": { "header": "inkwell/parts/header.html", "footer": "inkwell/parts/footer.html" },
    "templates": { "blog_index": "blog", "blog_post": "post" },
    "content_types": ["posts", "pages", "authors", "comments", "categories", "tags"],
    "editable_regions": {
      "homepage_hero": { "type": "rich_text", "builder": true }
    }
  }
}
```

Existing manifests without `inkwell` stay valid. Unknown future keys are
ignored; malformed known keys fail installation with an actionable error.
`contract` currently supports `"1"`. Runtime modes are `server_injected`
(default), `client_hydration`, and `data_endpoint`.

## Safe declarations

- Part/template keys are lowercase identifiers (`404` is allowed for the not-found template).
- Part/template values are safe relative paths or declared route keys.
- Content types come from the allowlist shown above.
- Editable region types: `rich_text`, `query`, `html`, `text`, `image`.
- Theme routes cannot use `admin`, `users`, `api`, `github`, `builder`, `plugins`,
  `docs`, `media`, `assets`, `rails`, `theme-assets`, `theme-islands`,
  `sitemap.xml`, `feed.xml`, `signup`, `new-site`, or `mcp`.
- Themes cannot declare controllers, routes.rb, migrations, initializers,
  middleware, jobs, models or an application. Static themes never get Rails execution.

## Canonical data

Every surface uses the same normalized shape: `site`, `navigation`, `page`,
`posts`, `authors`, `comments`, `pagination`. Fields are allowlisted; models,
credentials and private settings are never serialized. `ThemeRuntime::Serializer`
is the only production serializer.

Static requests receive the shape as escaped JSON before the theme bundle runs:

```html
<script type="application/json" id="inkwell-data" data-inkwell-contract="1">
  { ... }
</script>
```

The default is server injection plus server-rendered declared regions, so SEO
and initial content do not depend on client JavaScript. `client_hydration` and
`data_endpoint` remain available for explicitly client-first routes and mark the
response with `meta[name="inkwell-rendering"]`. The server logs a warning when a
route has no server-rendered content.

## Fixtures and local development

```text
inkwell/
├── contract.json
├── fixtures/
│   ├── site.json
│   ├── navigation.json
│   ├── page.json
│   ├── posts.json
│   ├── authors.json
│   ├── comments.json
│   └── pagination.json
└── parts/header.html
```

Fixture files are plain JSON and use exactly the canonical shape. A theme's own
dev server can read them directly; Inkwell is not required. `bin/theme-preview
/path/to/theme` is a standard-library-only preview server that serves the
declared public directory, applies static routes, and injects the fixture data.

Fixtures are checked during import/activation: missing or malformed fixture files
block activation.

## Declarative regions

```html
<section data-inkwell-region="posts" data-inkwell-query="latest" data-inkwell-limit="6"></section>
```

Allowed regions: `site`, `navigation`, `posts`, `post`, `authors`, `author`,
`comments`, `search`, `pagination`, `seo`. Region attributes are validated and
translated into fixed queries; attribute text is never evaluated. Unknown region
names stay ordinary HTML, and malformed known regions are left untouched.

The fixture markup remains in source for local development. In production,
Inkwell fills these regions server-side by default.

Declared parts can also be mounted explicitly:

```html
<div data-inkwell-part="header"></div>
```

The installed release supplies the part file; a site-level override wins without
changing the release. Overrides are versioned and can be reset.

## Theme routes and SEO

`ThemeRoute` records the CMS overlay (path, route key, title/SEO, canonical,
robots, JSON-LD, draft/published state, social image, navigation placement,
sitemap inclusion, revisions) for the active release. They appear in admin Pages
with a **Theme** badge. SEO is emitted into the initial `<head>` and is available
in the serialized `page.seo` object before hydration.

Route precedence is:

1. Admin, auth, API, Builder, plugin and other reserved routes
2. Native Inkwell pages and posts
3. Explicit active-theme routes
4. Theme SPA fallback for extensionless paths
5. 404

Missing assets always return 404 and never receive the SPA shell.

## Islands

Declared islands can request read-only data:

```html
<div data-inkwell-island="comments" data-inkwell-post="42">Comments are loading…</div>
```

`GET /theme-islands/:kind` supports `comments`, `search`, `posts`, `authors`,
`post` and `pagination`. Responses are site-scoped, published/approved only,
paginated, ETagged and public-cacheable. Unknown names are 404 and response size
is bounded.

## Rails themes

Rails themes keep ERB, Stimulus and Turbo through the host runtime. These helpers
return the same canonical data as static themes:

`inkwell_site`, `inkwell_navigation`, `inkwell_posts(limit:, query:)`,
`inkwell_post`, `inkwell_authors`, `inkwell_comments(post)`, `inkwell_seo`,
`theme_asset_path(path)`, plus `theme_part(key)`.

Declared parts can be overridden per site without editing the installed release.
Overrides are versioned and resettable.

## Agents

MCP tools use the scopes `theme:read`, `theme:write` and `theme:release`:

`theme.routes_read`, `theme.route_update_seo`, `theme.route_preview`,
`theme.parts_read`, `theme.editable_regions_read`, `theme.release_build`,
`theme.release_activate`, `theme.release_rollback`.

SEO writes require optimistic concurrency (`expected_revision` or
`expected_updated_at`). Activation and rollback are explicit, audited actions;
builds run only in the deployment workflow and are never triggered by preview
or activation.
