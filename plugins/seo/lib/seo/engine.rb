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
      field_prefix = type
      title_placeholder = record.respond_to?(:title) ? record.title : ""
      title_value = record.try(:seo_title) || ""
      desc_value = record.try(:seo_description) || ""
      noindex = record.try(:noindex?) || false
      nofollow = record.try(:nofollow?) || false

      # SEO score calculation
      score = calculate_seo_score(record)
      score_color = score >= 80 ? "success" : score >= 50 ? "warning" : "danger"
      score_label = score >= 80 ? "Good" : score >= 50 ? "OK" : "Needs work"

      # Title/description length analysis
      effective_title = title_value.presence || record.respond_to?(:title) ? record.title : ""
      effective_desc = desc_value.presence || record.try(:seo_description) || record.try(:auto_meta_description) || ""
      title_len = effective_title.length
      desc_len = effective_desc.length

      # SERP preview domain
      site_domain = record.site&.domain || "example.com"

      <<~HTML.squish
        <details class="group mb-2" open>
          <summary class="flex items-center justify-between text-sm text-foreground cursor-pointer py-1 hover:text-primary transition-colors">
            <span class="flex items-center gap-2">
              SEO
              <span class="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-#{score_color}-foreground bg-#{score_color}">#{score}</span>
            </span>
          </summary>
          <div class="mt-3 pl-0 space-y-4">

            <!-- SERP Preview -->
            <div class="rounded-lg border border-border/50 bg-background p-3">
              <div class="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2">
                <span class="font-medium text-foreground">inkwell</span>
                <span>›</span>
                <span>#{record.respond_to?(:slug) ? record.slug : type}</span>
              </div>
              <h4 class="text-sm text-primary font-normal leading-snug" style="color: #1a0dab;">
                #{ERB::Util.html_escape(effective_title.truncate(60))}
              </h4>
              <p class="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                #{ERB::Util.html_escape(effective_desc.truncate(160))}
              </p>
            </div>

            <!-- Title field with length indicator -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-xs text-muted-foreground">Search title</label>
                <span class="text-[10px] #{title_len > 60 ? 'text-danger' : title_len > 50 ? 'text-warning' : 'text-muted-foreground'}">#{title_len}/60</span>
              </div>
              <input type="text" name="#{field_prefix}[seo_title]" value="#{ERB::Util.html_escape(title_value)}" placeholder="#{ERB::Util.html_escape(title_placeholder)}"
                class="w-full text-sm border border-border rounded px-2 py-1.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20">
            </div>

            <!-- Description field with length indicator -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-xs text-muted-foreground">Description</label>
                <span class="text-[10px] #{desc_len > 155 ? 'text-danger' : desc_len > 120 ? 'text-warning' : 'text-muted-foreground'}">#{desc_len}/155</span>
              </div>
              <textarea name="#{field_prefix}[seo_description]" rows="2" placeholder="Auto-generated from content if left empty"
                class="w-full text-sm border border-border rounded px-2 py-1.5 bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring/20">#{ERB::Util.html_escape(desc_value)}</textarea>
            </div>

            <!-- Robots -->
            <div class="flex items-center gap-4">
              <label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" name="#{field_prefix}[noindex]" value="1" #{"checked" if noindex} class="rounded accent-primary"> Noindex
              </label>
              <label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" name="#{field_prefix}[nofollow]" value="1" #{"checked" if nofollow} class="rounded accent-primary"> Nofollow
              </label>
            </div>
          </div>
        </details>
      HTML
    end

    def calculate_seo_score(record)
      score = 100
      title = record.try(:seo_title).presence || record.try(:title).to_s
      desc = record.try(:seo_description).presence || record.try(:auto_meta_description).to_s

      # Title checks
      score -= 20 if title.length < 10
      score -= 15 if title.length > 60
      score -= 10 if title == record.try(:title).to_s  # using default title

      # Description checks
      score -= 20 if desc.length < 30
      score -= 15 if desc.length > 155

      # Featured image
      score -= 10 if record.try(:featured_image_url).blank?

      # Noindex
      score -= 5 if record.try(:noindex?)

      [0, score].max
    end
  end
end
