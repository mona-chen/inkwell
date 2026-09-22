module ImageSources
  # Image Sources: one seam for getting pictures the site does not have yet — free stock
  # photos, brand logos, avatars and mascots, and screenshots of a live URL — without ever
  # leaving the site pointing at somebody else's CDN.
  #
  # The seam is deliberately provider-agnostic. Every provider is an adapter that declares its
  # own rules (does it need a key? must results be re-hosted or hot-linked? does the licence
  # require a visible credit?), because those rules genuinely differ and are the reason a naive
  # "just link the image" implementation breaks: Pixabay forbids permanent hotlinking, Unsplash
  # forbids the opposite. Core never learns any provider's name.
  class Engine < ::Rails::Engine
    include Inkwell::Plugin
    isolate_namespace ImageSources

    plugin_name "Image Sources"
    plugin_slug "image_sources"
    plugin_description "Search free photo, logo, avatar and screenshot libraries and file the results in this site's media library — licences and credits included."
    plugin_version "1.0.0"

    register_admin_nav(label: "Image Sources", path: "/plugins/image_sources/settings", icon: "image", section: "Extensions")

    def on_activate
      # The Copilot asks one question — "what image capabilities does this site have?" — through
      # a single filter, and this plugin answers it. Neither the Copilot plugin nor the builder
      # bundle ever names this plugin, so editing a search source never means editing them.
      # Nothing is published when the site has no usable source, which is what keeps an
      # unfulfillable tool out of the model's tool list.
      Inkwell::Hooks.on_filter(:builder_copilot_config, source: plugin_slug) do |config|
        adapters = ImageSources::Registry.enabled(Current.site)
        next config if adapters.empty?

        config.merge(
          imageSearchUrl: ImageSources::Engine.routes.url_helpers.searches_path,
          imageProviders: adapters.map { |adapter| { kind: adapter.kind, label: adapter.label, provider: adapter.provider } }
        )
      end
    end

    def on_deactivate
      Inkwell::Hooks.remove_source!(plugin_slug)
    end
  end
end
