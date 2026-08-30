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
      register_admin_styles
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

    def register_admin_styles
      # Inject SEO-specific admin CSS via the plugin stylesheet hook.
      Inkwell::Hooks.on_filter(:admin_stylesheet_tags, source: plugin_slug) do |_tags|
        [seo_admin_css]
      end
    end

    def seo_admin_css
      <<~CSS.squish
        /* SEO plugin: SERP preview styling */
        .ink-sep-preview{border:1px solid var(--nk-color-border);border-radius:0.75rem;padding:0.75rem;background:var(--nk-color-background)}
        .ink-serp-url{font-size:0.625rem;color:var(--nk-color-muted-foreground);margin-bottom:0.25rem}
        .ink-serp-title{font-size:0.875rem;color:#1a0dab;line-height:1.3;margin:0}
        .ink-serp-desc{font-size:0.75rem;color:var(--nk-color-muted-foreground);line-height:1.4;margin-top:0.25rem}
        /* Length indicators */
        .ink-seo-length{font-size:0.625rem}
        .ink-seo-length-good{color:var(--nk-color-success)}
        .ink-seo-length-warn{color:var(--nk-color-warning)}
        .ink-seo-length-bad{color:var(--nk-color-danger)}
        /* Score badge */
        .ink-seo-score{display:inline-flex;align-items:center;justify-content:center;width:1.25rem;height:1.25rem;border-radius:9999px;font-size:0.625rem;font-weight:700}
        .ink-seo-score.is-good{background:var(--nk-color-success);color:var(--nk-color-success-content)}
        .ink-seo-score.is-warn{background:var(--nk-color-warning);color:var(--nk-color-warning-content)}
        .ink-seo-score.is-bad{background:var(--nk-color-danger);color:var(--nk-color-danger-content)}
      CSS
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
      focus_keyword = record.try(:seo_focus_keyword) || ""
      og_title = record.try(:og_title) || ""
      og_desc = record.try(:og_description) || ""

      score = calculate_seo_score(record)
      score_color = score >= 80 ? "success" : score >= 50 ? "warning" : "danger"
      effective_title = title_value.presence || (record.respond_to?(:title) ? record.title : "")
      effective_desc = desc_value.presence || record.try(:seo_description) || record.try(:auto_meta_description) || ""
      title_len = effective_title.length
      desc_len = effective_desc.length
      site_domain = record.site&.domain || "example.com"

      <<~HTML.squish
        <details class="group mb-2" open>
          <summary class="flex items-center justify-between text-sm text-foreground cursor-pointer py-1 hover:text-primary transition-colors">
            <span class="flex items-center gap-2">
              SEO
              <span class="ink-seo-score is-#{score_color}">#{score}</span>
            </span>
          </summary>
          <div class="mt-3 pl-0 space-y-4">
            <div class="ink-sep-preview">
              <div class="ink-serp-url">
                <span class="font-medium text-foreground">#{site_domain}</span> › #{record.respond_to?(:slug) ? record.slug : type}
              </div>
              <h4 class="ink-serp-title">#{ERB::Util.html_escape(effective_title.truncate(60))}</h4>
              <p class="ink-serp-desc">#{ERB::Util.html_escape(effective_desc.truncate(160))}</p>
            </div>
            <div>
              <label class="text-xs text-muted-foreground">Focus keyword</label>
              <input type="text" name="#{field_prefix}[seo_focus_keyword]" value="#{ERB::Util.html_escape(focus_keyword)}" placeholder="e.g. customer support platforms"
                class="mt-1 w-full text-sm border border-border rounded px-2 py-1.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20">
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-xs text-muted-foreground">Search title</label>
                <span class="ink-seo-length #{title_len > 60 ? 'ink-seo-length-bad' : title_len > 50 ? 'ink-seo-length-warn' : 'ink-seo-length-good'}">#{title_len}/60</span>
              </div>
              <input type="text" name="#{field_prefix}[seo_title]" value="#{ERB::Util.html_escape(title_value)}" placeholder="#{ERB::Util.html_escape(title_placeholder)}"
                class="w-full text-sm border border-border rounded px-2 py-1.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20">
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-xs text-muted-foreground">Description</label>
                <span class="ink-seo-length #{desc_len > 155 ? 'ink-seo-length-bad' : desc_len > 120 ? 'ink-seo-length-warn' : 'ink-seo-length-good'}">#{desc_len}/155</span>
              </div>
              <textarea name="#{field_prefix}[seo_description]" rows="2" placeholder="Auto-generated from content if left empty"
                class="w-full text-sm border border-border rounded px-2 py-1.5 bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring/20">#{ERB::Util.html_escape(desc_value)}</textarea>
            </div>
            <details class="group">
              <summary class="flex items-center justify-between text-xs text-muted-foreground cursor-pointer py-1 hover:text-foreground transition-colors">
                <span>Social preview</span>
              </summary>
              <div class="mt-2 pl-0 space-y-3">
                <div>
                  <label class="text-xs text-muted-foreground">OG title</label>
                  <input type="text" name="#{field_prefix}[og_title]" value="#{ERB::Util.html_escape(og_title)}" placeholder="Falls back to SEO title"
                    class="mt-1 w-full text-sm border border-border rounded px-2 py-1.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20">
                </div>
                <div>
                  <label class="text-xs text-muted-foreground">OG description</label>
                  <textarea name="#{field_prefix}[og_description]" rows="2" placeholder="Falls back to meta description"
                    class="w-full text-sm border border-border rounded px-2 py-1.5 bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring/20">#{ERB::Util.html_escape(og_desc)}</textarea>
                </div>
              </div>
            </details>
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
