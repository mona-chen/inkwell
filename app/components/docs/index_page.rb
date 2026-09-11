# frozen_string_literal: true

module Docs
  # The Inkwell documentation: architecture, content model, themes, the Builder, plugins/apps,
  # multisite, webhooks, the Content API, and configuration. App-owned Phlex (no external UI
  # runtime) so it renders anywhere regardless of the active theme.
  class IndexPage < ApplicationComponent
    SECTIONS = [
      { id: "overview", title: "Overview" },
      { id: "getting-started", title: "Getting started" },
      { id: "architecture", title: "Architecture" },
      { id: "content-model", title: "Content model" },
      { id: "themes", title: "Themes & templates" },
      { id: "builder", title: "The Ink Builder" },
      { id: "dynamic-content", title: "Dynamic content" },
      { id: "plugins", title: "Building plugins" },
      { id: "apps", title: "Plugins vs. apps" },
      { id: "multisite", title: "Multisite" },
      { id: "webhooks", title: "Webhooks" },
      { id: "api", title: "Content API" },
      { id: "configuration", title: "Configuration" },
      { id: "conventions", title: "Conventions" }
    ].freeze

    def view_template
      render Docs::Layout.new(title: "Documentation", sections: SECTIONS, active: :docs) do
        intro
        overview
        getting_started
        architecture
        content_model
        themes
        builder
        dynamic_content
        plugins
        apps
        multisite
        webhooks
        api
        configuration
        conventions
      end
    end

    private

    def section(id, title)
      h2(id: id) { title }
    end

    def code_block(text)
      pre { code { plain(text) } }
    end

    def callout(&block)
      div(class: "docs-callout", &block)
    end

    def docs_table(headers, rows)
      table_node = table(class: "docs-table") do
        thead { tr { headers.each { |h| th { h } } } }
        tbody { rows.each { |row| tr { row.each { |cell| td { plain(cell) } } } } }
      end
      table_node
    end

    def intro
      h1 { "Inkwell documentation" }
      p(class: "docs-lead") do
        "Everything you need to build with Inkwell: the content model, themes, the drag-and-drop Builder, and how to extend the platform with plugins and apps."
      end
      p do
        plain "Looking for the HTTP interface? Jump to the "
        a(href: docs_api_path) { "API reference" }
        plain ", generated from the OpenAPI spec at "
        code { "GET /docs/openapi.json" }
        plain "."
      end
    end

    def overview
      section("overview", "Overview")
      p do
        "Inkwell is a modern, plugin-first publishing platform built on Rails. It pairs a structured JSON content model with a visual drag-and-drop Builder, a classic block editor, and a theme system — so you can write, design, and publish without leaving the browser."
      end

      h3 { "Principles" }
      ul do
        li do
          strong { "Structured content." }
          plain " Content is JSON blocks, not opaque HTML — easy to render, transform, and serve headlessly."
        end
        li do
          strong { "Extensions are first-class." }
          plain " Plugins are plain Rails engines that register navigation, hooks, blocks, settings, templates, and data sources."
        end
        li do
          strong { "The platform owns the design vocabulary." }
          plain " Inkwell owns its components, tokens, and Builder elements; plugins ride on them."
        end
        li do
          strong { "Site-scoped by default." }
          plain " Every request resolves a site; content, media, settings, and plugins are scoped to it."
        end
      end

      h3 { "The stack" }
      docs_table(%w[Layer Technology], [
        [ "Framework", "Rails 8 (server-rendered)" ],
        [ "UI", "Ink — an app-owned Phlex component system" ],
        [ "Builder", "Vanilla-JS v2 runtime compiled with webpack" ],
        [ "Content", "JSONB blocks + a recursive Builder store" ],
        [ "Jobs", "ActiveJob on Solid Queue" ],
        [ "Database", "PostgreSQL" ]
      ])
    end

    def getting_started
      section("getting-started", "Getting started")
      p { "Inkwell is a standard Rails app. Install dependencies, prepare the database, and boot the server:" }
      code_block(<<~SH)
        bundle install
        bin/rails db:prepare
        bin/rails db:seed        # demo site, admin user, sample content
        bin/rails server -p 3000
      SH
      p do
        plain "The seed creates an admin ("
        code { "admin@inkwell.test / password123" }
        plain ") and a demo site. Sign in at "
        code { "/users/sign_in" }
        plain "."
      end

      h3 { "Builder development" }
      p { "The Builder runtime is compiled separately. Rebuild it whenever you change anything under plugins/page_builder/app/builder/src:" }
      code_block(<<~SH)
        cd plugins/page_builder/app/builder
        npm install
        npm run build     # compiles dist + copies to public/page_builder_assets
        npm run watch     # rebuild on change
        npm run smoke     # drives the real builder in headless Chrome
      SH
      callout do
        strong { "Regression safety." }
        plain " Run "
        code { "bin/rails builder:smoke" }
        plain " after any Builder, template, or layout change."
      end
    end

    def architecture
      section("architecture", "Architecture")
      p do
        plain "Inkwell is a single Rails application with a "
        strong { "plugin engine architecture" }
        plain ". Core provides the content model, admin shell, themes, and Builder; each plugin lives in "
        code { "plugins/<name>" }
        plain " as a mounted Rails::Engine and loads automatically at boot."
      end

      h3 { "Request lifecycle" }
      ol do
        li do
          code { "Multisite::SiteResolver" }
          plain " resolves the current site from the request host (session override → exact domain → custom domain → subdomain → default → first site)."
        end
        li do
          plain "The controller populates "
          code { "Current.site" }
          plain " and "
          code { "Current.user" }
          plain ", which every query and view uses."
        end
        li { plain "Public pages render theme templates; admin pages render the Ink shell." }
      end

      h3 { "Key directories" }
      docs_table(%w[Path Purpose], [
        [ "app/components", "Phlex components: Ink primitives and admin chrome" ],
        [ "app/themes", "Themes (layouts, templates, parts)" ],
        [ "app/controllers/admin", "Admin controllers" ],
        [ "app/services", "Block renderer, theme manager, and other services" ],
        [ "plugins/<name>", "Plugin engines (models, controllers, components, migrations)" ],
        [ "lib/inkwell", "Plugin manager, hooks, the Plugin base module" ]
      ])
    end

    def content_model
      section("content-model", "Content model")
      p { "Content is stored as structured data. The core models are:" }
      docs_table(%w[Model Purpose], [
        [ "Site", "A tenant: domain, subdomain, theme, settings, plan, lifecycle state" ],
        [ "Post", "Dated, categorized blog content" ],
        [ "Page", "Static/structured pages, including Builder templates" ],
        [ "Term", "Categories and tags (polymorphic, via post_terms)" ],
        [ "MediaItem", "Uploaded files with alt text and captions" ],
        [ "Menu / MenuItem", "Navigation with a nested item tree" ],
        [ "User / Role", "Accounts and capabilities" ]
      ])

      h3 { "Blocks" }
      p do
        plain "A post or page's body is a JSON array of blocks: "
        code { '[{ "type": "heading", "data": { "text": "…" } }, …]' }
        plain ". Blocks dispatch to app-owned components by "
        code { "BlockRenderer" }
        plain ", and plugins can register new block types."
      end
      code_block(<<~RUBY)
        # A post's live content (published) vs. draft content (in-progress)
        post.content_blocks     # => [{ "type" => "paragraph", "data" => { "text" => "Hi" } }]
        post.draft_content      # editor's uncommitted work
        post.publish_draft!     # commit draft → live
      RUBY

      h3 { "Draft vs. live" }
      p { "Editing never touches the live page. Drafts are committed to the published body only by an explicit publish action (the WordPress model). Builder pages additionally keep a recursive element store for re-editing, plus custom CSS/JS." }
    end

    def themes
      section("themes", "Themes & templates")
      p do
        plain "A theme is a directory of Rails templates under "
        code { "app/themes/<slug>" }
        plain ". Inkwell prepends the active theme's path to the view resolver, so a theme can override any view and fall back to core (template hierarchy)."
      end
      code_block(<<~TXT)
        app/themes/<slug>/
          theme.json          # name, description, declared templates
          layouts/application.html.erb
          pages/default.html.erb, full-width.html.erb, landing.html.erb
          posts/index.html.erb, show.html.erb
          site/home.html.erb
          partials/
      TXT

      h3 { "How a page picks a template" }
      ul do
        li do
          code { "pages.template" }
          plain " selects the layout: "
          code { "default" }
          plain ", "
          code { "full-width" }
          plain ", or "
          code { "landing" }
          plain "."
        end
        li do
          plain "Themes can opt into chrome suppression via "
          code { "content_for :full_bleed" }
          plain " / "
          code { "content_for :hide_chrome" }
          plain "."
        end
        li do
          plain "If a theme lacks the template, rendering falls back to core "
          code { "pages/default" }
          plain "."
        end
      end

      h3 { "Builder content templates" }
      p do
        plain "Instead of hand-coding a post template, design one in the Builder. A page marked with a "
        strong { "template role" }
        plain " replaces the theme's default rendering for that content type. Manage them in "
        strong { "Appearance → Content templates" }
        plain "."
      end
      docs_table(%w[Role Renders], [
        [ "single_post", "One post (the post becomes the current item)" ],
        [ "archive", "A list of posts" ],
        [ "index", "The /posts blog index" ]
      ])
      p { "Roles are a registry, so plugins can add their own (e.g. commerce.single_product). See Building plugins." }

      h3 { "Creating a theme" }
      p do
        plain "Copy an existing theme directory, edit "
        code { "theme.json" }
        plain ", then adjust the templates. Activate it under "
        strong { "Appearance → Themes" }
        plain "."
      end
    end

    def builder
      section("builder", "The Ink Builder")
      p do
        plain "The Builder is a visual editor that stores a "
        strong { "recursive element store" }
        plain " (version 2) — not templates. The canvas renders from the store; publishing serializes the canvas to HTML and converts dynamic tokens to server-rendered ERB."
      end

      h3 { "Element store" }
      code_block(<<~JSON)
        {
          "version": 2,
          "type": "page",
          "settings": { "title": "Home", "theme": { "colors": {}, "typography": {} } },
          "children": [
            { "id": "…", "type": "heading",
              "settings": { "text": "Hello", "tag": "h1" },
              "styles": { "desktop": { "base": { "color": "#111827" } } },
              "children": [] }
          ]
        }
      JSON

      h3 { "Elements" }
      p { "Elements are registered in the runtime and grouped in the library: Layout (Container, Frame, Grid), Basic (Heading, Paragraph, Button, Image), data widgets, Magic UI effects, and Dynamic elements. Each element exposes schema-driven controls, so the panel and the Copilot both know its shape." }

      h3 { "Styles & custom code" }
      p do
        plain "Per-element styles are stored per device and state, then compiled to scoped CSS. Page-level "
        code { "custom_css" }
        plain " and "
        code { "custom_js" }
        plain " are preserved across saves and injected ahead of the body on publish."
      end

      h3 { "Publish pipeline" }
      ol do
        li { plain "The canvas is cloned and editor-only state is stripped." }
        li do
          plain "Dynamic content is emitted as tokens (e.g. "
          code { "{{ blocks }}" }
          plain ")."
        end
        li { plain "Tokens are converted to ERB at save; the published page evaluates them per request, resolving live data." }
      end
    end

    def dynamic_content
      section("dynamic-content", "Dynamic content")
      p { "The Builder can pull from site and content data. Bindings are stored as tokens and resolved server-side on publish, while the canvas previews sample values." }

      h3 { "Binding an element to data" }
      ol do
        li { plain "Add an element (Heading, Paragraph, Button, Image)." }
        li do
          plain "Open the Content tab and use "
          strong { "Dynamic content" }
          plain " (or "
          strong { "Dynamic image" }
          plain " / "
          strong { "Dynamic link" }
          plain ") to pick a source and field."
        end
      end
      docs_table(%w[You want Use], [
        [ "Post body content", "The Post content element" ],
        [ "Post title", "Heading → Dynamic content → Post → Title" ],
        [ "Excerpt", "Paragraph → Dynamic content → Post → Excerpt" ],
        [ "Featured image", "Image → Dynamic image → Featured image URL" ],
        [ "Date / author / URL", "Bind to Published date / Author name / URL" ],
        [ "A list of posts", "Query Loop (set source + count) with a card template inside" ]
      ])

      h3 { "Query Loop" }
      p do
        plain "Query Loop repeats its child template over a source. It publishes a "
        code { "{{ loop posts:N }} … {{ /loop }}" }
        plain " region, which the server expands with live records."
      end

      h3 { "Tokens" }
      docs_table(%w[Token Meaning], [
        [ "{{ site.name }}", "Site field" ],
        [ "{{ page.title }}", "Current item (page or post) field" ],
        [ "{{ post.title }}", "Post field (template or loop item)" ],
        [ "{{ loop posts:3 }}", "Repeat over published posts" ],
        [ "{{ blocks }}", "The record's rich content blocks" ]
      ])

      h3 { "Data sources" }
      p do
        plain "The field catalog is served to the builder as "
        code { "window.inkDataSources" }
        plain " from "
        code { "PageBuilder::DataSources" }
        plain ", and plugins extend it (see below)."
      end
    end

    def plugins
      section("plugins", "Building plugins")
      p do
        plain "A plugin is a Rails engine in "
        code { "plugins/<name>" }
        plain ". Drop it in, and Inkwell loads it at boot, registers its navigation, and runs its "
        code { "on_activate" }
        plain " hook."
      end

      h3 { "Anatomy of a plugin" }
      code_block(<<~TXT)
        plugins/commerce/
          lib/commerce.rb                 # require "commerce/engine"
          lib/commerce/engine.rb          # the Rails::Engine + Inkwell::Plugin
          app/models/commerce/…           # models
          app/controllers/commerce/…      # controllers
          app/components/commerce/…       # Phlex admin UI
          app/jobs/commerce/…
          app/services/commerce/…
          config/routes.rb                # mounted at /plugins/commerce
          db/migrate/…                    # auto-registered with the app
      TXT

      h3 { "The engine" }
      code_block(<<~RUBY)
        module Commerce
          class Engine < ::Rails::Engine
            include Inkwell::Plugin
            isolate_namespace Commerce

            plugin_name "Commerce"
            plugin_description "Products, orders, and checkout."
            plugin_version "1.0.0"

            # Sidebar entries (supports sections, parents, and children)
            register_admin_nav(label: "Commerce", icon: "shopping_bag", section: "Site", children: [
              { label: "Orders", path: "/plugins/commerce/orders", icon: "receipt" },
              { label: "Products", path: "/plugins/commerce/products", icon: "package" }
            ])

            def on_activate
              Inkwell::Hooks.on_action(:post_published, source: plugin_slug) { |post| Commerce::SyncJob.perform_later(post.id) }
            end

            def on_deactivate
              Inkwell::Hooks.remove_source!(plugin_slug)
            end
          end
        end
      RUBY

      h3 { "The plugin module" }
      docs_table(%w[Method Purpose], [
        [ "plugin_name / description / version", "Metadata shown in the Plugins admin" ],
        [ "plugin_slug", "Stable identifier for records, routes, and hooks" ],
        [ "register_admin_nav(...)", "Add sidebar entries (with section/parent/children)" ],
        [ "on_activate / on_deactivate", "Subscribe/teardown at boot or activation" ]
      ])

      h3 { "Hooks" }
      p { "Hooks are the WordPress-style action/filter system. Listeners are namespaced by source and can be site-gated by the multisite plugin." }
      code_block(<<~RUBY)
        # Actions: side effects
        Inkwell::Hooks.on_action(:post_published, source: plugin_slug) { |post| … }
        Inkwell::Hooks.fire(:post_published, post)

        # Filters: transform a value
        Inkwell::Hooks.on_filter(:head_meta, source: plugin_slug) do |tags, post:|
          tags + [%(<meta name="x" content="y">)]
        end
        Inkwell::Hooks.filter(:head_meta, [], post: post)
      RUBY
      p { "Fireable events include: post_published, post_updated, page_published, comment_moderated, contact_form_submitted, newsletter_subscribed, settings_updated, plugin_activated, plugin_deactivated." }

      h3 { "Migrations, routes, and settings" }
      ul do
        li do
          plain "Migrations in "
          code { "plugins/<name>/db/migrate" }
          plain " are appended to the app's migration paths — run "
          code { "bin/rails db:migrate" }
          plain "."
        end
        li do
          plain "Routes in "
          code { "config/routes.rb" }
          plain " are mounted at "
          code { "/plugins/<slug>" }
          plain "."
        end
        li do
          plain "Persist per-site settings via "
          code { "Current.site.set_setting!(key, value)" }
          plain " / "
          code { "Current.site.setting(key)" }
          plain "."
        end
      end

      h3 { "Registering content templates & data sources" }
      p { "Plugins can contribute Builder templates, dynamic fields, loop sources, and preview data:" }
      code_block(<<~RUBY)
        def on_activate
          # Content-type templates (namespaced to avoid collisions)
          Inkwell::Hooks.on_filter(:page_template_roles, source: plugin_slug) do |roles|
            roles + [ { role: "commerce.single_product", label: "Single product",
                        icon: "shopping_bag", plugin: plugin_slug,
                        content: "<div>{{ page.title }}</div>" } ]
          end

          # Data sources shown in the binding picker
          Inkwell::Hooks.on_filter(:builder_data_sources, source: plugin_slug) do |sources|
            sources.merge("product" => { "label" => "Product", "plugin" => plugin_slug,
                                         "fields" => { "title" => "Title", "price" => "Price" } })
          end

          # Loop sources usable by Query Loop
          Inkwell::Hooks.on_filter(:builder_loop_sources, source: plugin_slug) do |loops|
            loops.merge("products" => { "label" => "Products", "var" => "product",
                                        "scope" => "Current.site.products.published" })
          end

          # Canvas preview values
          Inkwell::Hooks.on_filter(:builder_sample_data, source: plugin_slug) do |data, site:|
            data.merge("product" => { "title" => "Sample product", "price" => "9.99" })
          end
        end
      RUBY

      h3 { "Admin UI" }
      p do
        plain "Build admin screens with the Ink components (Phlex). "
        code { "Admin::BaseController" }
        plain " gives you authentication, authorization, and the admin shell."
      end
      code_block(<<~RUBY)
        module Commerce
          class ProductsController < Admin::BaseController
            def index
              render Commerce::ProductsPage.new(products: Current.site.products)
            end
          end
        end
      RUBY
    end

    def apps
      section("apps", "Plugins vs. apps")
      p do
        plain "In Inkwell there is one extension primitive — the "
        strong { "plugin" }
        plain ". A plugin can be a small integration (a hook and a settings screen) or a full application (models, admin screens, storefront routes, Builder elements). The sidebar's "
        strong { "Extensions" }
        plain " group is where plugins surface."
      end
      p { "A plugin may contribute to the sidebar in several ways:" }
      docs_table(%w[Pattern Example], [
        [ "A top-level entry", %(register_admin_nav(label: "SEO", path: …, icon: "search", section: "Site")) ],
        [ "Under an existing parent", %(register_admin_nav(label: "Custom CSS", path: …, section: "Site", parent: "Appearance")) ],
        [ "A nested group", %(register_admin_nav(label: "Commerce", icon: …, section: "Site", children: [...])) ]
      ])
      p { "Active plugins are listed under Extensions → Plugins, where they can be activated or deactivated globally. In multisite, per-site activation is configured by the network admin under Sites." }
    end

    def multisite
      section("multisite", "Multisite")
      p do
        plain "The "
        code { "multisite" }
        plain " plugin turns Inkwell into a multi-tenant platform: many sites on one installation, each resolved by host."
      end

      h3 { "Site resolution" }
      p { "SiteResolver (Rack middleware) resolves the site for every request in this order:" }
      ol do
        li { plain "Session override (admin switched sites)" }
        li { plain "Exact domain match" }
        li { plain "Custom domain match" }
        li { plain "Tenant subdomain of the base domain" }
        li { plain "Default site, then the first site" }
      end

      h3 { "Sites & domains" }
      p do
        plain "Each site has a primary domain, an optional subdomain, and any number of "
        strong { "custom domains" }
        plain ". Add and verify custom domains from the site editor; point DNS at the server and use Check connection for diagnostics."
      end

      h3 { "Per-site settings & plugins" }
      ul do
        li do
          plain "Content, media, menus, widgets, users, and settings are all scoped to "
          code { "Current.site" }
          plain "."
        end
        li do
          plain "Plugins run per site depending on the site's plugin mode, enforced by "
          code { "Multisite::PluginGate" }
          plain "."
        end
        li { plain "Site creation can be Open, Invite-only, or Closed (Network Admin → Sites)." }
      end

      h3 { "Self-serve signup" }
      p { "When enabled, /signup provisions a Site and its owner, then runs an onboarding flow (Welcome → Theme → Settings). Site owners get a scoped role, not platform admin." }
    end

    def webhooks
      section("webhooks", "Webhooks")
      p { "The webhooks plugin delivers signed HTTP callbacks when content changes." }

      h3 { "Signature" }
      p do
        plain "Each request is signed with HMAC-SHA256 over "
        code { "<unix_timestamp>.<raw_json_body>" }
        plain " and sent as "
        code { "X-Inkwell-Signature: sha256=…" }
        plain ", alongside "
        code { "X-Inkwell-Event" }
        plain " and "
        code { "X-Inkwell-Timestamp" }
        plain ". Verify signatures in constant time."
      end

      h3 { "Events" }
      p { "post_published, post_updated, page_published, comment_moderated, contact_form_submitted, newsletter_subscribed." }
      p { "Delivery is asynchronous (Solid Queue) with retries and a delivery log. Manage endpoints under Extensions → Webhooks." }
    end

    def api
      section("api", "Content API")
      p do
        plain "Inkwell exposes a read-only JSON API for headless frontends. The full reference is at the "
        a(href: docs_api_path) { "API reference" }
        plain ", generated from "
        code { "GET /docs/openapi.json" }
        plain "."
      end
      code_block(<<~SH)
        curl https://acme.example.com/api/v1/posts
        curl -H "Authorization: Bearer $TOKEN" https://acme.example.com/api/v1/posts?status=draft
      SH
      ul do
        li { plain "Site-scoped by host." }
        li { plain "Published content is public; a per-site token unlocks drafts and unpublished content." }
        li do
          plain "CORS is configurable via "
          code { "INKWELL_API_ORIGINS" }
          plain "."
        end
        li { plain "Manage tokens in Site Settings → API." }
      end
    end

    def configuration
      section("configuration", "Configuration")
      docs_table(%w[Variable Purpose], [
        [ "INKWELL_BASE_DOMAIN", "Base domain for tenant subdomains (lvh.me in dev)" ],
        [ "INKWELL_API_ORIGINS", "Comma-separated CORS allowlist for the Content API" ]
      ])

      h3 { "Credentials" }
      p do
        plain "Rails encrypted credentials hold "
        code { "secret_key_base" }
        plain " and integration keys. Edit with "
        code { "bin/rails credentials:edit" }
        plain "."
      end

      h3 { "Background jobs" }
      p do
        plain "Jobs run on Solid Queue. In development, start a worker with "
        code { "bin/jobs" }
        plain ", or use "
        code { "bin/dev" }
        plain " to run the web server and worker together."
      end
    end

    def conventions
      section("conventions", "Conventions")
      ul do
        li do
          strong { "Server-rendered first." }
          plain " Prefer Rails controllers, Phlex components, and progressive enhancement (Hotwire)."
        end
        li do
          strong { "Own the design system." }
          plain " Use the Ink components and tokens; do not introduce an external UI runtime."
        end
        li do
          strong { "Content is structured." }
          plain " Store data as JSON blocks; drafts never touch live content until published."
        end
        li do
          strong { "Extensions are namespaced." }
          plain " Prefix plugin slugs, template roles (vendor.role), and hooks with your plugin slug."
        end
        li do
          strong { "Test the Builder." }
          plain " Run bin/rails builder:smoke after builder, template, or layout changes."
        end
      end
    end
  end
end
