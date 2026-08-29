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
      tags += canonical_tag
      tags += robots_tag
      tags += json_ld
      tags.compact
    end

    private

    # --- Basic Meta ---

    def basic_meta
      [
        tag_meta("description", description),
        tag_meta("author", author_name),
      ].compact
    end

    def description
      @record.seo_description.presence ||
        @record.excerpt.presence ||
        auto_description
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
      return nil unless image.present?

      image.start_with?("http") ? image : "#{@site.domain}#{image}"
    end

    # --- Twitter Card ---

    def twitter_card_tags
      [
        tag_meta("twitter:card", @record.twitter_card_type.presence || "summary_large_image"),
        tag_meta("twitter:title", og_title),
        tag_meta("twitter:description", og_description),
        tag_meta("twitter:image", og_image),
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
      "https://#{@site.domain}#{path}"
    end

    # --- Robots ---

    def robots_tag
      directives = []
      directives << "noindex" if @record.try(:noindex?)
      directives << "nofollow" if @record.try(:nofollow?)
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

      base = {
        "@context": "https://schema.org",
        "@type": og_type.titleize,
        headline: og_title,
        description: og_description,
        author: author_name.present? ? { "@type": "Person", name: author_name } : nil,
        publisher: {
          "@type": "Organization",
          name: @site.name,
          logo: @site.respond_to?(:logo_item) && @site.logo_item ? { "@type": "ImageObject", url: @site.logo_item.url } : nil
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

      %(<meta name="#{ERB::Util.html_escape(name)}" content="#{ERB::Util.html_escape(content)}">)
    end
  end
end
