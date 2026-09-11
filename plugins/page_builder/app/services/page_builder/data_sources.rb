module PageBuilder
  # Server-owned catalog of the dynamic values a builder element can bind to. The builder
  # reads this (embedded as JSON in the editor page) to render its data-source picker, and
  # the server resolves the same paths when the page is published.
  #
  # Plugins extend the registry by filtering:
  #   :builder_data_sources  — merge new sources, e.g. { "product" => { "label" => "Product", "fields" => {...}, "plugin" => "commerce" } }
  #   :builder_loop_sources  — merge new loop sources, e.g. { "products" => { "label" => "Products", "var" => "product", "scope" => "Current.site.products.published", "plugin" => "commerce" } }
  #   :builder_sample_data   — merge preview values used on the canvas
  #
  # Paths use `{{ source.field }}` token syntax so published rendering reuses the existing
  # ErbConverter pipeline. Only fields that exist as real model methods should be listed —
  # a missing method would raise when the published template renders.
  module DataSources
    SOURCES = {
      "site" => {
        "label" => "Site",
        "fields" => {
          "name" => "Site name",
          "tagline" => "Tagline",
          "domain" => "Domain",
          "url" => "Site URL"
        }
      },
      "page" => {
        "label" => "Current item (page or post)",
        "fields" => {
          "title" => "Title",
          "slug" => "Slug",
          "url" => "URL"
        }
      },
      "post" => {
        "label" => "Post (template or loop)",
        "fields" => {
          "title" => "Title",
          "slug" => "Slug",
          "excerpt" => "Excerpt",
          "published_at" => "Published date",
          "author.name" => "Author name",
          "featured_image_url" => "Featured image URL",
          "url" => "URL"
        }
      },
      "author" => {
        "label" => "Author",
        "fields" => {
          "name" => "Name",
          "bio" => "Bio"
        }
      }
    }.freeze

    LOOP_SOURCES = {
      "posts" => { "label" => "Posts", "var" => "post", "scope" => "Current.site.posts.published" },
      "pages" => { "label" => "Pages", "var" => "page", "scope" => "Current.site.pages.published" }
    }.freeze

    def self.sources
      Inkwell::Hooks.filter(:builder_data_sources, SOURCES.deep_dup)
    end

    def self.loop_sources
      Inkwell::Hooks.filter(:builder_loop_sources, LOOP_SOURCES.deep_dup)
    end

    def self.catalog
      { "sources" => sources, "loops" => loop_sources }
    end

    def self.as_json
      catalog.to_json
    end

    # Sample values used to preview bindings on the builder canvas. Never published — the
    # stored design keeps the `{{ source.field }}` tokens. Plugins can add their own keys.
    def self.sample_data(site)
      return {} unless site

      post = site.posts.published.recent.first || site.posts.first
      page = site.pages.first

      base = {
        "site" => {
          "name" => site.name,
          "tagline" => site.setting("tagline").to_s,
          "domain" => site.domain,
          "url" => site.url
        },
        "page" => page ? { "title" => page.title, "slug" => page.slug, "url" => page.url } : {},
        "post" => post ? {
          "title" => post.title,
          "slug" => post.slug,
          "excerpt" => post.excerpt.to_s,
          "published_at" => post.published_at&.to_date&.to_s,
          "author" => { "name" => post.author&.name.to_s, "bio" => post.author&.bio.to_s },
          "featured_image_url" => post.featured_image_url.to_s,
          "url" => post.url
        } : {}
      }

      Inkwell::Hooks.filter(:builder_sample_data, base, site: site)
    end
  end
end
