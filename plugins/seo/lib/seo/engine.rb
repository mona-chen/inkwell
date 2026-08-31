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
      Inkwell::Hooks.on_filter(:admin_stylesheet_tags, source: plugin_slug) do |tags|
        Array(tags) + [seo_admin_css]
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
        .ink-seo-workspace{overflow:hidden;scroll-margin-top:4.5rem}
        .ink-seo-workspace__body{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(18rem,.75fr);gap:1rem;padding:1rem}
        .ink-seo-panel{min-width:0;border:1px solid var(--nk-color-border);border-radius:.75rem;background:var(--nk-color-surface);padding:1rem}
        .ink-seo-panel summary{list-style:none}
        .ink-seo-panel summary::-webkit-details-marker{display:none}
        .ink-seo-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}
        .ink-seo-fields .is-wide{grid-column:1/-1}
        .ink-seo-field label{display:block;margin-bottom:.25rem;font-size:.6875rem;font-weight:600;color:var(--nk-color-muted-foreground)}
        .ink-seo-field input,.ink-seo-field textarea,.ink-seo-field select{box-sizing:border-box;width:100%;max-width:100%;border:1px solid var(--nk-color-border);border-radius:.5rem;background:var(--nk-color-background);color:var(--nk-color-foreground);font-size:.8125rem;padding:.5rem .625rem;outline:none}
        .ink-seo-field input:focus,.ink-seo-field textarea:focus,.ink-seo-field select:focus{border-color:var(--nk-color-primary);box-shadow:0 0 0 2px color-mix(in oklab,var(--nk-color-primary) 18%,transparent)}
        .ink-seo-check{display:flex;align-items:flex-start;gap:.5rem;font-size:.75rem;color:var(--nk-color-foreground)}
        .ink-seo-result{display:flex;gap:.5rem;font-size:.75rem;line-height:1.35}
        .ink-seo-result__dot{flex:0 0 auto;margin-top:.22rem;width:.5rem;height:.5rem;border-radius:999px;background:var(--nk-color-muted-foreground)}
        .ink-seo-result.is-good .ink-seo-result__dot{background:var(--nk-color-success)}
        .ink-seo-result.is-improvement .ink-seo-result__dot{background:var(--nk-color-warning)}
        .ink-seo-result.is-problem .ink-seo-result__dot{background:var(--nk-color-danger)}
        .ink-social-preview{overflow:hidden;border:1px solid var(--nk-color-border);border-radius:.65rem;background:var(--nk-color-background)}
        .ink-social-preview__image{display:grid;min-height:7rem;place-items:center;background:var(--nk-color-muted);color:var(--nk-color-muted-foreground);font-size:.6875rem;background-position:center;background-size:cover}
        @media(max-width:62rem){.ink-seo-workspace__body{grid-template-columns:minmax(0,1fr)}.ink-seo-fields{grid-template-columns:minmax(0,1fr)}}
      CSS
    end

    def register_editor_panels
      # Inject SEO panel into post editor sidebar.
      Inkwell::Hooks.on_filter(:post_editor_panels, source: plugin_slug) do |panels, post:|
        next Array(panels) unless post

        Array(panels) + [seo_summary_html(post)]
      end

      Inkwell::Hooks.on_filter(:post_editor_after_content, source: plugin_slug) do |panels, post:|
        next Array(panels) unless post

        Array(panels) + [seo_workspace_html(post, "post")]
      end

      # Inject SEO panel into page editor sidebar.
      Inkwell::Hooks.on_filter(:page_editor_panels, source: plugin_slug) do |panels, page:|
        next Array(panels) unless page

        Array(panels) + [seo_summary_html(page)]
      end

      Inkwell::Hooks.on_filter(:page_editor_after_content, source: plugin_slug) do |panels, page:|
        next Array(panels) unless page

        Array(panels) + [seo_workspace_html(page, "page")]
      end
    end

    def seo_summary_html(record)
      analysis = Seo::ContentAnalysis.new(record)
      readability = Seo::ReadabilityAnalysis.new(record)
      score = analysis.score
      score_color = score >= 80 ? "success" : score >= 50 ? "warning" : "danger"
      improvements = analysis.results.count { |item| item.status != :good }

      <<~HTML.squish
        <a href="#seo-optimization" class="flex items-center justify-between rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted/40">
          <span>
            <span class="block text-sm font-medium text-foreground">SEO optimization</span>
            <span class="mt-0.5 block text-xs text-muted-foreground">#{improvements} SEO items · Readability #{readability.score}</span>
          </span>
          <span class="ink-seo-score is-#{score_color}" aria-label="SEO score #{score}">#{score}</span>
        </a>
      HTML
    end

    def seo_workspace_html(record, type)
      <<~HTML.squish
        <section id="seo-optimization" class="ink-seo-workspace mt-8 rounded-xl border border-border bg-background shadow-sm">
          <header class="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-primary">SEO Toolkit</p>
              <h2 class="mt-0.5 text-lg font-semibold text-foreground">Search optimization</h2>
            </div>
            <span class="text-xs text-muted-foreground">Search appearance · Analysis · Social · Advanced</span>
          </header>
          #{seo_panel_html(record, type)}
        </section>
      HTML
    end

    def seo_panel_html(record, type)
      field_prefix = type
      title_placeholder = record.try(:title).to_s
      title_value = record.try(:seo_title) || ""
      desc_value = record.try(:seo_description) || ""
      noindex = record.try(:noindex?) || false
      nofollow = record.try(:nofollow?) || false
      noarchive = record.try(:robots_noarchive?) || false
      noimageindex = record.try(:robots_noimageindex?) || false
      nosnippet = record.try(:robots_nosnippet?) || false
      cornerstone = record.try(:cornerstone?) || false
      focus_keyword = record.try(:seo_focus_keyword) || ""
      og_title = record.try(:og_title) || ""
      og_desc = record.try(:og_description) || ""
      og_image = record.try(:og_image_url) || ""
      twitter_title = record.try(:twitter_title) || ""
      twitter_desc = record.try(:twitter_description) || ""
      twitter_image = record.try(:twitter_image_url) || ""
      slug_override = record.try(:seo_slug_override) || ""
      canonical_override = record.try(:canonical_url_override) || ""
      breadcrumb_title = record.try(:breadcrumb_title) || ""
      schema_page_type = record.try(:schema_page_type).presence || "WebPage"
      schema_article_type = record.try(:schema_article_type).presence || "Article"
      twitter_card = record.try(:twitter_card_type).presence || "summary_large_image"

      analysis = Seo::ContentAnalysis.new(record)
      readability = Seo::ReadabilityAnalysis.new(record)
      score = analysis.score
      score_color = score >= 80 ? "success" : score >= 50 ? "warning" : "danger"
      readability_color = readability.score >= 80 ? "success" : readability.score >= 50 ? "warning" : "danger"
      effective_title = title_value.presence || title_placeholder
      effective_desc = desc_value.presence || record.try(:seo_description) || record.try(:auto_meta_description) || ""
      title_len = effective_title.length
      desc_len = effective_desc.length
      site_domain = record.site&.domain || "example.com"
      preview_slug = slug_override.presence || record.try(:slug).to_s
      preview_og_image = og_image.presence || record.try(:seo_og_image).to_s
      preview_twitter_image = twitter_image.presence || preview_og_image
      escaped_og_image = ERB::Util.html_escape(og_image)
      escaped_twitter_image = ERB::Util.html_escape(preview_twitter_image)
      og_image_style = preview_image_style(preview_og_image)
      twitter_image_style = preview_image_style(preview_twitter_image)

      <<~HTML.squish
        <div class="ink-seo-workspace__body">
          <div class="space-y-4 min-w-0">
            <section class="ink-seo-panel">
              <div class="mb-3 flex items-center justify-between gap-3"><div><h3 class="text-sm font-semibold text-foreground">Search appearance</h3><p class="mt-0.5 text-xs text-muted-foreground">Preview and customize how this content can appear in Google.</p></div><span class="ink-seo-score is-#{score_color}" aria-label="SEO score #{score}">#{score}</span></div>
            <div class="ink-sep-preview">
              <div class="ink-serp-url">
                <span class="font-medium text-foreground">#{site_domain}</span> › #{ERB::Util.html_escape(preview_slug)}
              </div>
              <h4 class="ink-serp-title">#{ERB::Util.html_escape(effective_title.truncate(60))}</h4>
              <p class="ink-serp-desc">#{ERB::Util.html_escape(effective_desc.truncate(160))}</p>
            </div>
              <div class="ink-seo-fields mt-4">
                <div class="ink-seo-field is-wide"><label>Focus keyphrase</label><input type="text" name="#{field_prefix}[seo_focus_keyword]" value="#{ERB::Util.html_escape(focus_keyword)}" placeholder="e.g. customer support platforms"></div>
                <div class="ink-seo-field is-wide"><div class="flex items-center justify-between"><label>SEO title</label><span class="ink-seo-length #{title_len > 60 ? 'ink-seo-length-bad' : title_len > 50 ? 'ink-seo-length-warn' : 'ink-seo-length-good'}">#{title_len}/60</span></div><input type="text" name="#{field_prefix}[seo_title]" value="#{ERB::Util.html_escape(title_value)}" placeholder="#{ERB::Util.html_escape(title_placeholder)}"></div>
                <div class="ink-seo-field"><label>Slug</label><input type="text" name="#{field_prefix}[seo_slug_override]" value="#{ERB::Util.html_escape(slug_override)}" placeholder="#{ERB::Util.html_escape(record.try(:slug).to_s)}"></div>
                <div class="ink-seo-field"><label>Breadcrumb title</label><input type="text" name="#{field_prefix}[breadcrumb_title]" value="#{ERB::Util.html_escape(breadcrumb_title)}" placeholder="#{ERB::Util.html_escape(title_placeholder)}"></div>
                <div class="ink-seo-field is-wide"><div class="flex items-center justify-between"><label>Meta description</label><span class="ink-seo-length #{desc_len > 155 ? 'ink-seo-length-bad' : desc_len > 120 ? 'ink-seo-length-warn' : 'ink-seo-length-good'}">#{desc_len}/155</span></div><textarea name="#{field_prefix}[seo_description]" rows="3" placeholder="Auto-generated from content if left empty">#{ERB::Util.html_escape(desc_value)}</textarea></div>
              </div>
            </section>
            <section class="ink-seo-panel">
              <div class="mb-3"><h3 class="text-sm font-semibold text-foreground">Social appearance</h3><p class="mt-0.5 text-xs text-muted-foreground">Dedicated Open Graph and X cards override the search fallback.</p></div>
              <div class="grid gap-4 lg:grid-cols-2">
                <div class="min-w-0 space-y-3"><div class="ink-social-preview"><div class="ink-social-preview__image"#{og_image_style}>#{preview_og_image.present? ? '' : 'Facebook / LinkedIn image'}</div><div class="p-3"><p class="truncate text-sm font-semibold">#{ERB::Util.html_escape(og_title.presence || effective_title)}</p><p class="mt-1 line-clamp-2 text-xs text-muted-foreground">#{ERB::Util.html_escape(og_desc.presence || effective_desc)}</p></div></div><div class="ink-seo-field"><label>Open Graph title</label><input name="#{field_prefix}[og_title]" value="#{ERB::Util.html_escape(og_title)}" placeholder="Falls back to SEO title"></div><div class="ink-seo-field"><label>Open Graph description</label><textarea name="#{field_prefix}[og_description]" rows="2" placeholder="Falls back to meta description">#{ERB::Util.html_escape(og_desc)}</textarea></div><div class="ink-seo-field"><label>Open Graph image URL</label><input type="url" name="#{field_prefix}[og_image_url]" value="#{escaped_og_image}" placeholder="Uses the featured image by default"></div></div>
                <div class="min-w-0 space-y-3"><div class="ink-social-preview"><div class="ink-social-preview__image"#{twitter_image_style}>#{escaped_twitter_image.present? ? '' : 'X card image'}</div><div class="p-3"><p class="truncate text-sm font-semibold">#{ERB::Util.html_escape(twitter_title.presence || og_title.presence || effective_title)}</p><p class="mt-1 line-clamp-2 text-xs text-muted-foreground">#{ERB::Util.html_escape(twitter_desc.presence || og_desc.presence || effective_desc)}</p></div></div><div class="ink-seo-field"><label>X title</label><input name="#{field_prefix}[twitter_title]" value="#{ERB::Util.html_escape(twitter_title)}" placeholder="Falls back to Open Graph"></div><div class="ink-seo-field"><label>X description</label><textarea name="#{field_prefix}[twitter_description]" rows="2" placeholder="Falls back to Open Graph">#{ERB::Util.html_escape(twitter_desc)}</textarea></div><div class="ink-seo-field"><label>X image URL</label><input type="url" name="#{field_prefix}[twitter_image_url]" value="#{ERB::Util.html_escape(twitter_image)}" placeholder="Falls back to Open Graph image"></div><div class="ink-seo-field"><label>Card type</label><select name="#{field_prefix}[twitter_card_type]"><option value="summary_large_image" #{'selected' if twitter_card == 'summary_large_image'}>Large image</option><option value="summary" #{'selected' if twitter_card == 'summary'}>Summary</option></select></div></div>
              </div>
            </section>
          </div>
          <aside class="space-y-4 min-w-0">
            <details class="ink-seo-panel" open><summary class="flex cursor-pointer items-center justify-between"><span class="text-sm font-semibold text-foreground">SEO analysis</span><span class="ink-seo-score is-#{score_color}">#{score}</span></summary><div class="mt-3 space-y-2">#{analysis.results.map { |item| analysis_result_html(item) }.join}</div></details>
            <details class="ink-seo-panel" open><summary class="flex cursor-pointer items-center justify-between"><span class="text-sm font-semibold text-foreground">Readability</span><span class="ink-seo-score is-#{readability_color}">#{readability.score}</span></summary><div class="mt-3 space-y-2">#{readability.results.map { |item| analysis_result_html(item) }.join}</div></details>
            <details class="ink-seo-panel"><summary class="cursor-pointer text-sm font-semibold text-foreground">Schema</summary><div class="ink-seo-fields mt-3"><div class="ink-seo-field is-wide"><label>Page type</label><select name="#{field_prefix}[schema_page_type]">#{schema_options(%w[WebPage AboutPage ContactPage FAQPage ProfilePage CollectionPage ItemPage CheckoutPage SearchResultsPage], schema_page_type)}</select></div>#{type == 'post' ? "<div class=\"ink-seo-field is-wide\"><label>Article type</label><select name=\"#{field_prefix}[schema_article_type]\">#{schema_options(%w[Article BlogPosting NewsArticle ScholarlyArticle TechArticle SatiricalArticle], schema_article_type)}</select></div>" : ''}</div></details>
            <details class="ink-seo-panel"><summary class="cursor-pointer text-sm font-semibold text-foreground">Advanced</summary><div class="mt-3 space-y-3"><div class="ink-seo-field"><label>Canonical URL</label><input type="url" name="#{field_prefix}[canonical_url_override]" value="#{ERB::Util.html_escape(canonical_override)}" placeholder="Use the generated canonical URL"></div>#{seo_checkbox(field_prefix, 'cornerstone', cornerstone, 'Cornerstone content')}#{seo_checkbox(field_prefix, 'noindex', noindex, 'Keep out of search results')}#{seo_checkbox(field_prefix, 'nofollow', nofollow, 'Do not follow links')}#{seo_checkbox(field_prefix, 'robots_noarchive', noarchive, 'Do not cache this page')}#{seo_checkbox(field_prefix, 'robots_noimageindex', noimageindex, 'Do not index images')}#{seo_checkbox(field_prefix, 'robots_nosnippet', nosnippet, 'Do not show a search snippet')}</div></details>
          </aside>
        </div>
      HTML
    end

    def seo_checkbox(prefix, name, checked, label)
      <<~HTML.squish
        <label class="ink-seo-check"><input type="hidden" name="#{prefix}[#{name}]" value="0"><input type="checkbox" name="#{prefix}[#{name}]" value="1" #{"checked" if checked}><span>#{ERB::Util.html_escape(label)}</span></label>
      HTML
    end

    def schema_options(options, selected)
      options.map { |option| %(<option value="#{option}" #{'selected' if option == selected}>#{option.titleize}</option>) }.join
    end

    def preview_image_style(url)
      return "" if url.blank?

      parsed = URI.parse(url)
      return "" unless parsed.relative? || %w[http https].include?(parsed.scheme)

      safe_url = ERB::Util.html_escape(url.gsub(/["'()\\]/, ""))
      %( style="background-image:url(#{safe_url})")
    rescue URI::InvalidURIError
      ""
    end

    def analysis_result_html(item)
      <<~HTML.squish
        <div class="ink-seo-result is-#{item.status}">
          <span class="ink-seo-result__dot" aria-hidden="true"></span>
          <span><strong class="font-medium text-foreground">#{ERB::Util.html_escape(item.label)}:</strong> <span class="text-muted-foreground">#{ERB::Util.html_escape(item.message)}</span></span>
        </div>
      HTML
    end
  end
end
