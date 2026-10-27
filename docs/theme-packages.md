# Importing frontend themes

Themes own frontend source; Rails application features and APIs remain in Inkwell
and its plugins. A theme can contain ERB views, Stimulus controllers, Turbo
navigation, compiled React/Vue/etc., or ordinary HTML/CSS/JS. It is not an isolated
Rails application: arbitrary controllers, routes.rb, migrations, initializers and
application.rb are not loaded from a theme. Move required backend functionality
into an Inkwell plugin and map frontend URLs explicitly.

Platform admins can upload a ZIP at **Appearance → Themes → Import theme**.
A package can have a single enclosing folder. For a bare compiled React/other SPA
bundle without `theme.json`, select **Client-side routing** in the upload form.
CLI directory import:

```sh
bin/rails 'themes:import[/path/to/frontend,my-theme]'
# A bare SPA distribution without a manifest:
bin/rails 'themes:import[/path/to/dist,my-app,true]'
bin/rails 'themes:dependencies[my-theme]'
bin/rails 'themes:build[my-theme]'
```

Imports never overwrite existing themes or activate them. All sources stay under
`app/themes/<slug>/`; copy that directory into version control and deployment.
ZIP extraction rejects traversal and symlinks and has file/size limits. Importing
and building themes are trusted-code operations restricted to platform admins
and the deployment CLI. Uploaded scripts are not executed during import.

## Static multipage sites

A ZIP of a static website with `index.html` works without a manifest: the importer
creates `theme.json`, puts the files in `public/`, and maps HTML files to their
original and extensionless URLs. Directory `index.html` gets a directory alias.
Keep files referenced with relative URLs at their original relative locations.
Use a manifest when a route differs from its file path or when SPA routing is
required. Site-local asset URLs retain their original paths; namespaced assets
are also available at `/theme-assets/<slug>/<path>`.

```json
{
  "format": "inkwell-theme-v1",
  "slug": "marketing",
  "name": "Marketing website",
  "kind": "static",
  "public": "public",
  "routes": {
    "/": "index.html",
    "/about": "about.html",
    "/about.html": "about.html"
  }
}
```

## Bundled client applications and deep links

```json
{
  "format": "inkwell-theme-v1",
  "slug": "customer-app",
  "name": "Customer app",
  "kind": "static",
  "public": "dist",
  "routes": { "/": "index.html" },
  "spa_fallback": "index.html",
  "dependencies": {
    "packages": { "react": "^19.0.0", "react-dom": "^19.0.0" }
  }
}
```

Include the source, `package.json`, lockfile and a `build` script that writes
into the declared public directory. Already-built distributions work too, without
npm or package declarations. The output directory may be absent at import when a
build script is provided. Activation and preview stay blocked until output exists.

For `/customers/42?tab=open`, Rails returns the SPA shell at that same URL with
HTTP 200. The client router reads `location` and selects the screen. Refresh,
back/forward and direct links use the same mechanism. The server does not redirect
to `/`. A root `<base href="/">` is inserted if none exists so relative bundle
URLs still work at nested paths. Build for the site root (router basename `/`).

Missing file URLs such as `/assets/missing.js` return 404, never HTML. The fallback
only applies to extensionless GET/HEAD paths. If your client routes contain dots,
add those paths to `routes` explicitly. POST/PUT/DELETE are not handled by themes.
Admin/auth/API/builder/plugin/content routes take precedence over theme routes.
An app cannot replace those reserved namespaces. Declared theme routes take
precedence over imported page paths, which precede the SPA fallback.

Host Rails assets win name collisions. Theme `/assets/...` bundles resolve through
the current site's active theme, including absolute imports produced by bundlers.
Other public files resolve through the final frontend route. Only public asset
extensions are served; server templates, dotfiles and package manifests are not.
If a reverse proxy or CDN intercepts `/assets`, configure missing assets to fall
through to Rails, or build using `/theme-assets/<slug>/` as the asset base. Theme
assets should be content-hashed by the bundler; redeploy and cache them with the
same version as their HTML.

A browser-rendered SPA retains its own SEO behavior. Inkwell cannot turn a bundle
into server-rendered React: use pre-rendered HTML/ERB for pages requiring initial
HTML content, or supply an appropriate separate SSR backend.

## Rails ERB, Stimulus and Hotwire

A conventional Rails frontend can retain `app/views/` and its JavaScript source.
Supply a manifest mapping routes to view paths and expose browser-ready JavaScript
under the public directory, either through a build or direct ESM files:

```json
{
  "format": "inkwell-theme-v1",
  "slug": "rails-marketing",
  "name": "Rails marketing",
  "kind": "rails",
  "views": "app/views",
  "public": "public",
  "routes": { "/": "marketing/home", "/pricing": "marketing/pricing" },
  "imports": {
    "theme/application": "application.js",
    "theme/counter_controller": "controllers/counter_controller.js"
  },
  "entrypoint": "theme/application",
  "dependencies": {
    "gems": { "turbo-rails": ">= 2", "stimulus-rails": ">= 1" }
  }
}
```

`app/views/layouts/application.html.erb` is required. Include:

```erb
<head>
  <%= csrf_meta_tags %>
  <%= csp_meta_tag %>
  <%= theme_javascript_tags %>
  <%= stylesheet_link_tag theme_asset_path("site.css") %>
</head>
<body><%= yield %></body>
```

`theme_javascript_tags` combines Inkwell's existing import map with theme-owned
module declarations and imports the theme entrypoint. It does not start Inkwell's
admin JavaScript. Example `public/application.js`:

```js
import "@hotwired/turbo-rails"
import { Application } from "@hotwired/stimulus"
import Counter from "theme/counter_controller"
const application = Application.start()
application.register("counter", Counter)
```

Use `theme_asset_path` for namespaced assets; relative module imports work within
that namespace. Rails layouts, partials, helpers, forms and Turbo navigation use
the host Rails runtime. Route views receive `@site`/`Current.site` and Rails
helpers; controller-specific instance variables from another Rails app must be
adapted. Inkwell's default templates supply content routes omitted by a theme.
For full CMS styling, include the normal `pages`, `posts`, and `authors` views in
the theme's views directory as well.

## Dependencies and deployment

`dependencies.gems` maps gem names to RubyGems requirements. It produces a
`Gemfile.theme` reference file. Add those declarations to the host Gemfile, run
`bundle install`, and restart Rails. All sites share one Rails process and bundle;
themes cannot require incompatible gem versions independently. Activation checks
the versions actually loaded in that process. A source Gemfile is retained as
source evidence but is not evaluated automatically.

`dependencies.packages` maps npm names to version strings that must match the
package's `package.json` dependencies/devDependencies. `themes:build` runs `npm ci`
when a package lock exists (otherwise `npm install`), followed by `npm run build`
in that theme directory. Build scripts and transitive lifecycle scripts execute
only when this deployment command is explicitly run. Keep lockfiles with source.
No source changes or gem/package installations occur during activation.
