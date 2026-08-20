module Seo
  class Engine < ::Rails::Engine
    include Inkwell::Plugin
    isolate_namespace Seo

    plugin_name "SEO Toolkit"
    plugin_description "Meta tags, Open Graph, and per-post SEO fields for every post and page."
    plugin_version "1.0.0"

    register_admin_nav(label: "SEO", path: "/admin/plugins/seo", icon: "magnifying-glass")

    def on_activate
      # Filter: every post/page render asks `head_meta` for tags to inject — this plugin
      # appends its own without core needing to know SEO exists.
      Inkwell::Hooks.on_filter(:head_meta, source: plugin_slug) do |tags, post:|
        next tags unless post

        tags + [
          %(<meta name="description" content="#{ERB::Util.html_escape(Seo::MetaTagBuilder.new(post).description)}">),
          %(<meta property="og:title" content="#{ERB::Util.html_escape(post.title)}">),
          %(<meta property="og:type" content="article">),
        ]
      end

      # Action: when a post is published, ping the sitemap regenerator.
      Inkwell::Hooks.on_action(:post_published, source: plugin_slug) do |post|
        Seo::RegenerateSitemapJob.perform_later
      end
    end

    def on_deactivate
      Inkwell::Hooks.remove_source!(plugin_slug)
    end
  end
end
