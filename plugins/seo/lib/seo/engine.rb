module Seo
  class Engine < ::Rails::Engine
    include Inkwell::Plugin
    isolate_namespace Seo

    plugin_name "SEO Toolkit"
    plugin_description "Comprehensive SEO: meta tags, Open Graph, Twitter Cards, JSON-LD, sitemaps, and per-content optimization."
    plugin_version "2.0.0"

    register_admin_nav(label: "SEO", path: "/plugins/seo_toolkit/seo", icon: "search")

    def on_activate
      register_meta_tag_hooks
      register_sitemap_hooks
      register_editor_panels
    end

    def on_deactivate
      Inkwell::Hooks.remove_source!(plugin_slug)
    end

    private

    def register_meta_tag_hooks
      # Filter: emit comprehensive meta tags for every post/page render.
      # Covers: description, Open Graph, Twitter Cards, canonical, robots, JSON-LD.
      Inkwell::Hooks.on_filter(:head_meta, source: plugin_slug) do |tags, post:|
        next tags unless post

        builder = Seo::MetaTagBuilder.new(post)
        tags + builder.build_all
      end

      # Action: regenerate sitemap when content changes.
      Inkwell::Hooks.on_action(:post_published, source: plugin_slug) do |_post|
        Seo::RegenerateSitemapJob.perform_later
      end

      # Action: also regenerate on page publish (was missing in v1).
      Inkwell::Hooks.on_action(:page_published, source: plugin_slug) do |_page|
        Seo::RegenerateSitemapJob.perform_later
      end
    end

    def register_sitemap_hooks
      # No additional hooks needed — sitemap is handled by the controller.
    end

    def register_editor_panels
      # Inject SEO panel into post editor sidebar.
      Inkwell::Hooks.on_filter(:post_editor_panels, source: plugin_slug) do |_panels, post:|
        next [] unless post

        seo_panel_html(post, "post")
      end

      # Inject SEO panel into page editor sidebar.
      Inkwell::Hooks.on_filter(:page_editor_panels, source: plugin_slug) do |_panels, page:|
        next [] unless page

        seo_panel_html(page, "page")
      end
    end

    def seo_panel_html(record, type)
      helper = ActionView::Base.new(ActionView::LookupContext.new([]))
      form = ActionView::Helpers::FormBuilder.new(type, record, helper, {})
      field_prefix = type

      title_placeholder = record.respond_to?(:title) ? record.title : ""
      title_value = record.try(:seo_title) || ""
      desc_value = record.try(:seo_description) || ""
      noindex = record.try(:noindex?) || false
      nofollow = record.try(:nofollow?) || false

      <<~HTML.squish
        <div class="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
          <h3 class="text-xs font-semibold text-foreground">SEO</h3>
          <div>
            <label class="text-xs font-medium text-muted-foreground">SEO Title</label>
            <input type="text" name="#{field_prefix}[seo_title]" value="#{ERB::Util.html_escape(title_value)}" placeholder="#{ERB::Util.html_escape(title_placeholder)}"
              class="mt-0.5 w-full text-sm border border-border rounded px-2 py-1.5 bg-background text-foreground placeholder:text-muted-foreground">
          </div>
          <div>
            <label class="text-xs font-medium text-muted-foreground">Meta Description</label>
            <textarea name="#{field_prefix}[seo_description]" rows="2" placeholder="Auto-generated from content if left empty"
              class="w-full text-sm border border-border rounded px-2 py-1.5 bg-background text-foreground placeholder:text-muted-foreground resize-none">#{ERB::Util.html_escape(desc_value)}</textarea>
          </div>
          <div class="flex items-center gap-4">
            <label class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" name="#{field_prefix}[noindex]" value="1" #{"checked" if noindex} class="rounded accent-primary"> Noindex
            </label>
            <label class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" name="#{field_prefix}[nofollow]" value="1" #{"checked" if nofollow} class="rounded accent-primary"> Nofollow
            </label>
          </div>
        </div>
      HTML
    end
  end
end
