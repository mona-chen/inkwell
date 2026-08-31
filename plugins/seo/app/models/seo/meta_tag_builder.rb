module Seo
  # Builds comprehensive meta tags for a post or page.
  # Covers: description, Open Graph, Twitter Cards, canonical, robots, JSON-LD.
  class MetaTagBuilder
    def initialize(post_or_page)
      @record = post_or_page
      @site = @record.site
      @is_page = @record.is_a?(Page)
    end

    def build_all
      tags = []
      tags += basic_meta
      tags += open_graph_tags
      tags += twitter_card_tags
      tags << canonical_tag
      tags << robots_tag
      tags << json_ld
      tags.compact
    end

    private

    # --- Basic Meta ---

    def basic_meta
      [
        tag_meta("description", description),
        tag_meta("author", author_name),
        tag_meta("google-site-verification", @site.setting("seo_google_verification", "")),
        tag_meta("msvalidate.01", @site.setting("seo_bing_verification", "")),
      ].compact
    end

    def description
      value = @record.seo_description.presence ||
        @record.try(:excerpt).presence ||
        auto_description
      value.to_s.truncate(160).presence
    end

    def auto_description
      text = @record.content_blocks.map { |b| b.dig("data", "text").to_s }.join(" ")
      text.present? ? text.truncate(160) : nil
    end

    def author_name
      @record.respond_to?(:author) ? @record.author&.name : nil
    end

    # --- Open Graph ---

    def open_graph_tags
      [
        tag_meta("og:type", og_type),
        tag_meta("og:title", og_title),
        tag_meta("og:description", og_description),
        tag_meta("og:url", canonical_url),
        tag_meta("og:site_name", @site.name),
        tag_meta("og:image", og_image),
        tag_meta("og:locale", "en_US"),
      ].compact
    end

    def og_type
      @is_page ? "website" : "article"
    end

    def og_title
      @record.seo_og_title
    end

    def og_description
      @record.seo_og_description
    end

    def og_image
      image = @record.seo_og_image
      image = @site.setting("seo_default_og_image", "") if image.blank?
      return nil unless image.present?

      absolute_image_url(image)
    end

    # --- Twitter Card ---

    def twitter_card_tags
      [
        tag_meta("twitter:card", @record.twitter_card_type.presence || "summary_large_image"),
        tag_meta("twitter:title", @record.try(:twitter_title).presence || og_title),
        tag_meta("twitter:description", @record.try(:twitter_description).presence || og_description),
        tag_meta("twitter:image", absolute_image_url(@record.try(:twitter_image_url).presence) || og_image),
        tag_meta("twitter:site", @site.setting("seo_twitter_handle", "")),
      ].compact
    end

    # --- Canonical ---

    def canonical_tag
      return nil unless canonical_url.present?

      %(<link rel="canonical" href="#{ERB::Util.html_escape(canonical_url)}">)
    end

    def canonical_url
      return nil unless @site.domain.present?

      path = @record.respond_to?(:canonical_url) ? @record.canonical_url : "/#{@record.slug}"
      return path if path.match?(/\Ahttps?:\/\//i)

      "#{site_origin}#{path.start_with?("/") ? path : "/#{path}"}"
    end

    # --- Robots ---

    def robots_tag
      directives = []
      directives << "noindex" if @record.try(:noindex?) || content_type_disabled?
      directives << "nofollow" if @record.try(:nofollow?)
      directives << "noarchive" if @record.try(:robots_noarchive?)
      directives << "noimageindex" if @record.try(:robots_noimageindex?)
      directives << "nosnippet" if @record.try(:robots_nosnippet?)
      return nil if directives.empty?

      tag_meta("robots", directives.join(", "))
    end

    # --- JSON-LD Structured Data ---

    def json_ld
      schema = build_json_ld_schema
      return nil unless schema

      %(<script type="application/ld+json">#{schema.to_json.html_safe}</script>)
    end

    def build_json_ld_schema
      return nil unless @site.domain.present?

      representation = @site.setting("seo_site_representation", "organization")
      representation_name = @site.setting("seo_organization_name", "").presence || @site.setting("seo_site_name", "").presence || @site.name
      representation_logo = @site.setting("seo_organization_logo", "").presence

      base = {
        "@context": "https://schema.org",
        "@type": schema_type,
        headline: og_title,
        description: og_description,
        author: author_name.present? ? { "@type": "Person", name: author_name } : nil,
        publisher: {
          "@type": representation == "person" ? "Person" : "Organization",
          name: representation_name,
          logo: representation_logo.present? ? { "@type": "ImageObject", url: representation_logo } : (@site.respond_to?(:logo_item) && @site.logo_item ? { "@type": "ImageObject", url: @site.logo_item.url } : nil)
        },
        mainEntityOfPage: canonical_url,
        datePublished: @record.respond_to?(:published_at) ? @record.published_at&.iso8601 : nil,
        dateModified: @record.updated_at&.iso8601,
      }

      image = og_image
      base[:image] = image if image.present?

      base.compact
    end

    # --- Helpers ---

    def tag_meta(name, content)
      return nil if content.blank?

      attribute = name.start_with?("og:") ? "property" : "name"
      %(<meta #{attribute}="#{ERB::Util.html_escape(name)}" content="#{ERB::Util.html_escape(content)}">)
    end

    def schema_type
      if @is_page
        @record.try(:schema_page_type).presence || "WebPage"
      else
        @record.try(:schema_article_type).presence || "Article"
      end
    end

    def absolute_image_url(image)
      return nil if image.blank?
      return image if image.match?(/\Ahttps?:\/\//i)

      "#{site_origin}#{image.start_with?("/") ? image : "/#{image}"}"
    end

    def site_origin
      domain = @site.domain.to_s
      domain.match?(/\Ahttps?:\/\//i) ? domain.sub(%r{/+\z}, "") : "https://#{domain}"
    end

    def content_type_disabled?
      setting = @is_page ? "seo_index_pages" : "seo_index_posts"
      @site.setting(setting, "1") != "1"
    end
  end
end
